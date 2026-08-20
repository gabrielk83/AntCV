#!/usr/bin/env python3
# JOB-TRACKER-001 — headless batch generation runner.
# =====================================================================
# Makes the nightly job-tracker generation queue AUTOMATIC. For each
# eligible row in the D1 job-tracker doc it:
#   1. builds a per-section generation PLAN (each section = one
#      /v1/messages body carrying a compact-but-faithful profile kernel
#      + the row's JD + owner Additional Signals + role intel), phrased
#      so the cv-proxy's prompt-augment.js recognises the task and
#      prepends its anti-fabrication + banned-words + task frames;
#   2. drives the resumable gen-job on the LIVE proxy
#      (POST /job/create -> repeated POST /job/step -> terminal), which
#      runs every section through the full augmented per-section path
#      and a cross-section coherence pass — byte-identical belts to the
#      app's own generation (workers/proxy/src/gen-job.js);
#   3. writes a REVIEW BUNDLE (per-row JSON of every section result +
#      coherence findings + usage) to the output dir; and, ONLY with
#      --persist, POSTs a real AntCV application, PUTs the generated
#      cv/cl sections, and writes the artifact ids back onto the doc.
#
# This is GENERIC tooling (no candidate data). The profile kernel is
# pulled LIVE from the relay (authoritative — matches "source from the
# live app, never a re-typed export", antcv-deliverable-standards) or
# from a local master-profile JSON via --kernel-file. Review bundles
# are written OUTSIDE the repo (default: the scratchpad) per the repo's
# "no candidate data" rule.
#
# WHY the belts still apply headlessly (verified 2026-07-09): the proxy
# augments EVERY /v1/messages call by task signature and injects the
# CV-generation system frame; a nonsense prompt is refused. So section
# prompts MUST be phrased as real CV/CL section-generation asks and MUST
# carry the candidate kernel — the augmentation supplies the FRAME, not
# the facts.
#
# Auth: the owner's PWA JWT at ~/.antcv/token (env ANTCV_TOKEN /
# ANTCV_TOKEN_FILE). Cloudflare 403s the default python UA, so every
# request presents a browser UA + Origin https://antcv.pages.dev .
# Token expires ~weekly; a 401/403 is reported, not retried.
#
# Usage:
#   python gen-runner.py list                 # show eligible rows + tiers
#   python gen-runner.py run --row demant_pm  # generate one row, review-only
#   python gen-runner.py run                   # auto-select eligible, honour caps
#   python gen-runner.py run --persist         # also save real applications + doc writeback
# Flags: --row UK (repeatable) | --max-high N (5) | --max-quick M (10)
#        --kernel-file PATH | --out DIR | --provider anthropic | --dry (plan only, no LLM)
import os, sys, json, time, argparse, urllib.request, urllib.error, urllib.parse, re, copy

# GOLD-RULES-SITE-001: caps + banned words read from the single control site
# (pwa/gold-rules.json); literals are fallbacks.
try:
    _GOLD = json.load(open(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "pwa", "gold-rules.json"), encoding="utf-8"))
except Exception:
    _GOLD = {}
_GOLD_CAPS = _GOLD.get("caps") or {}
_BULLET_CAP = int(_GOLD_CAPS.get("bullet_chars", 148))
_PARA_CAP = int(_GOLD_CAPS.get("paragraph_chars", 330))


RELAY = os.environ.get("ANTCV_RELAY", "https://antcv-access-relay.karp-gabriel-a.workers.dev").rstrip("/")
PROXY = os.environ.get("ANTCV_PROXY", "https://cv-proxy.karp-gabriel-a.workers.dev").rstrip("/")
UA    = "Mozilla/5.0 (AntCV gen-runner)"
ORIGIN = "https://antcv.pages.dev"
SCRATCH = os.environ.get("ANTCV_GENRUN_OUT") or os.path.join(
    os.environ.get("TEMP", os.path.expanduser("~")), "antcv-gen-runner")

# Model hints by tier. The proxy's cost-quality router may re-route, but
# the hint biases flagship vs fast. High = flagship + coherence; quick =
# fast + single pass. (Coherence runs server-side after the last section
# regardless; for 'quick' it is a cheap no-op on a 1-2 section plan.)
MODEL_HIGH  = os.environ.get("ANTCV_MODEL_HIGH",  "claude-opus-4-8")
# COST-QUALITY-BENCH-001 (owner 2026-07-11, docs/qa/COST_QUALITY_BENCHMARK_2026-07-11.md):
# the 'quick' tier was claude-haiku-4-5 — the benchmark's WORST gen model (quality 3.0,
# dirtiest 10.5 em-dashes/run, AND pricier than gpt-5-mini). gpt-5-mini is the cheap
# champion (quality 6.0 @ $0.06, 35x under opus). Provider is inferred from the model
# (see _prov_for), so a quick(openai)/high(anthropic) mix routes correctly.
MODEL_QUICK = os.environ.get("ANTCV_MODEL_QUICK", "gpt-5-mini")

def _prov_for(model):
    m = str(model or "").lower()
    if m.startswith("gpt") or m.startswith("o1") or m.startswith("o3"): return "openai"
    if m.startswith("gemini"): return "gemini"
    if m.startswith("mistral") or m.startswith("magistral") or m.startswith("ministral"): return "mistral"
    return "anthropic"

# The 11 real category ids the ACCESS-RELAY accepts (workers/access-relay
# CATEGORIES set). NEVER 'unsolicited' for a real JD (the app blanks the JD
# on open). CRITICAL: the relay's normalizeCategory() silently downgrades any
# id NOT in this exact set to 'unsolicited' — so guess_category MUST return
# only these literals (the 2026-07-12 wrong-category batch defect: it emitted
# project_management/quality_regulatory/business_analysis, all rejected →
# stored as unsolicited). Rough keyword routing; owner can override in the UI.
REAL_CATEGORIES = [
    "engineering_hardware", "engineering_software", "product_management",
    "program_management", "operations", "data_analytics",
    "research_phd", "consulting", "executive", "finance", "people_soft",
]

# ── auth / http ────────────────────────────────────────────────────
def _token():
    t = os.environ.get("ANTCV_TOKEN")
    if t: return t.strip()
    p = os.environ.get("ANTCV_TOKEN_FILE", os.path.expanduser("~/.antcv/token"))
    if os.path.exists(p):
        return open(p, "r", encoding="utf-8").read().strip()
    sys.exit("No token. Set ANTCV_TOKEN or put the PWA JWT in " + p)

# Persist a rotated token (relay X-Auth-Refresh) so ~/.antcv/token self-renews
# as long as the nightly keeps running; no single token outlives its 7-day exp.
def _save_token(t):
    if not t or os.environ.get("ANTCV_TOKEN"): return
    try:
        p = os.environ.get("ANTCV_TOKEN_FILE", os.path.expanduser("~/.antcv/token"))
        os.makedirs(os.path.dirname(p), exist_ok=True)
        open(p, "w", encoding="utf-8").write(t.strip())
    except Exception: pass

# GENRUNNER-TRANSPORT-RETRY-001 (nightly 2026-08-18): a TRANSPORT failure
# (socket read timeout, dropped connection, DNS blip) used to propagate out of
# urlopen and kill the whole run with a traceback - losing an in-flight, fully
# resumable gen-job and every row after it. A slow /job/step is normal: one step
# can be a flagship section or the cross-section coherence repair. Transport
# errors are now converted to a synthetic 599 so every existing "code != 200"
# path handles them, and idempotent polls simply step the SAME job again.
_TRANSPORT_ERRORS = (TimeoutError, urllib.error.URLError, ConnectionError, OSError)

def _req(base, path, method="GET", body=None, timeout=120, retries=2):
    data = json.dumps(body).encode() if body is not None else None
    last = "unknown"
    for attempt in range(retries + 1):
        r = urllib.request.Request(base + path, data=data, method=method, headers={
            "Authorization": "Bearer " + _token(),
            "Content-Type": "application/json",
            "Origin": ORIGIN,
            "User-Agent": UA,
        })
        try:
            with urllib.request.urlopen(r, timeout=timeout) as resp:
                _save_token(resp.headers.get("X-Auth-Refresh"))
                return resp.status, json.loads(resp.read().decode() or "{}")
        except urllib.error.HTTPError as e:
            try: payload = json.loads(e.read().decode() or "{}")
            except Exception: payload = {"raw": "unparseable"}
            return e.code, payload
        except _TRANSPORT_ERRORS as e:
            last = "%s: %s" % (type(e).__name__, e)
            if attempt < retries:
                print("   [transport] %s %s -> %s; retry %d/%d" % (method, path, last, attempt + 1, retries))
                time.sleep(2.0 * (attempt + 1))
    return 599, {"error": "transport_failed", "detail": last}

# ── kernel + doc ───────────────────────────────────────────────────
def load_kernel(kernel_file=None):
    """Return the parsed kernel dict {identity, history, preferences, ...}.
    Live relay by default (authoritative); a local master-profile JSON if
    --kernel-file is given."""
    if kernel_file:
        raw = json.load(open(kernel_file, "r", encoding="utf-8"))
        # master-profile exports wrap the kernel differently; normalise.
        return raw.get("kernel") or raw
    code, b = _req(RELAY, "/api/profile/kernel")
    if code != 200:
        sys.exit(f"kernel fetch failed: {code} {str(b)[:200]}")
    return b.get("kernel") or b

def _asdict(v):
    if isinstance(v, str):
        try: return json.loads(v)
        except Exception: return {}
    return v or {}

def compact_profile(kernel):
    """A compact-but-faithful profile block for the section prompts +
    coherence grounding. Strips the photo, keeps every fact the writing
    belts need. This is the SINGLE SOURCE OF TRUTH the model may draw
    identity/employers/education/certs from (prompt-augment identity lock)."""
    ident = _asdict(kernel.get("identity"))
    hist  = _asdict(kernel.get("history"))
    keep_ident = [
        "name", "headline", "location", "citizenship", "email", "phone",
        "linkedin", "googleScholar", "background", "specialization",
        "positioning", "targetRoles", "targetIndustries", "workStyle",
        "personality", "accessibility", "interests", "selectedOutcomes",
        "proofPoints", "experience", "eligibility", "publicationsStructured",
        "foundation", "skillsInventory", "toolsItems", "recommendations",
    ]
    prof = {k: ident[k] for k in keep_ident if k in ident and ident[k] not in (None, "", [], {})}
    keep_hist = [
        "workHistory", "education", "certifications", "languages",
        "publications", "patentNumber", "patentDescription", "regulatory",
        "tools", "additional",
    ]
    prof["_history"] = {k: hist[k] for k in keep_hist if k in hist and hist[k] not in (None, "", [], {})}
    banned = ident.get("bannedWords") or (_asdict(ident.get("stylePrefs")).get("banned_words"))
    if banned: prof["_bannedWords"] = banned
    return prof

def get_doc():
    code, b = _req(RELAY, "/api/job-tracker")
    if code != 200:
        sys.exit(f"job-tracker GET failed: {code} {str(b)[:200]}")
    return b.get("rev"), (b.get("doc") or {})

def put_doc(doc, base_rev):
    code, b = _req(RELAY, "/api/job-tracker", "PUT", {"doc": doc, "base_rev": base_rev})
    return code, b

# ── research (RESEARCH-001) ────────────────────────────────────────
# Google-CSE web research on the employer via the relay /api/research
# (JWT-auth; GOOGLE_CSE_KEY lives on the relay). Returns a compact digest
# folded into the generation as SUBORDINATE context (grounds "why this
# company" / values / recent news; never the candidate's identity).
def research(company, role, num=6):
    q = ('"%s" %s Denmark' % (company or "", role or "")).strip()
    if len(q) < 3:
        return ""
    try:
        c, b = _req(RELAY, "/api/research", "POST", {"q": q, "num": num, "dateRestrict": "y1"})
        if c != 200 or not isinstance(b, dict) or not b.get("ok"):
            return ""
        out = []
        for it in (b.get("items") or [])[:num]:
            t = (it.get("title") or "").strip()
            s = (it.get("snippet") or "").strip().replace("\n", " ")
            ln = (it.get("link") or "").strip()
            if t or s:
                out.append("- %s — %s (%s)" % (t, s[:200], ln))
        return "\n".join(out)
    except Exception:
        return ""

# ── brand capture (BRAND-DECIDES-RESEARCH-001) ─────────────────────
# The brand is colours AND company SPIRIT + VALUES, collected as RESEARCH in the
# SAME site-crawl as the colour exploration. brand_fit.capture_brand drives the
# proxy /api/fetch-brand-colors worker (research:true) which resolves the
# employer's CANONICAL site (aggregators are discovery-only), samples colours,
# reads the About/values/careers text, and LLM-summarises {spirit, values, tone}.
# The record feeds: doc['brand'][uk], the slogan PLACEMENT (antcv:clSloganMode),
# and the slogan BRIEF the CL-slogan section fuses to. Server-side by necessity:
# the shell is 403-gated to the workers (nightly-sandbox-network-constraint) and
# a raw fetch of an arbitrary company site would reopen the SSRF surface the
# worker already guards. Never fabricates: on failure spirit/values are empty +
# flagged.
def _brand_post(body):
    """post_json closure brand_fit injects: hits the proxy brand-colors endpoint
    and returns (status, dict)."""
    return _req(PROXY, "/api/fetch-brand-colors", "POST", body, timeout=45)

def capture_brand_for(row):
    """Return the v2 brand_record for a row (colours + spirit/values/tone +
    placement + slogan brief), or None on hard failure. Idempotent per company."""
    try:
        import brand_fit
    except Exception as e:
        print(f"   [brand] brand_fit import failed ({str(e)[:80]})"); return None
    url = row.get("url") or ""
    # BRAND-URL-RECRUITER-GUARD-001 (2026-07-25): a posting hosted on a job board /
    # recruiter domain must NOT drive brand research - iheadhunt.dk poisoned
    # Napatech's brand record twice this way (the "brand" became the recruiter's
    # own pitch). If the posting URL's host shares no >=4-char token with the
    # employer name, drop the URL so brand_fit resolves the employer's CANONICAL
    # site from the company name instead. Worst case is no-brand (honest neutral),
    # never a wrong brand.
    try:
        from urllib.parse import urlparse
        host = (urlparse(url).hostname or "").lower()
        toks = [t for t in re.sub(r"[^a-z0-9]+", " ", str(row.get("company") or "").lower()).split() if len(t) >= 4]
        if host and toks and not any(t in host for t in toks):
            print(f"   [brand] posting host {host} unrelated to employer - resolving canonical site by name")
            url = ""
    except Exception:
        pass
    try:
        rec = brand_fit.capture_brand(url, row.get("company") or "", _brand_post)
    except Exception as e:
        print(f"   [brand] capture failed ({str(e)[:80]})"); return None
    rsr = rec.get("research") or {}
    vals = rsr.get("values") or []
    if rsr.get("spirit") or vals or rsr.get("tone"):
        print("   [brand] %s -> tone=%s values=%s placement=%s (site %s)" % (
            rec.get("source") or "?", rsr.get("tone") or "-",
            (", ".join(vals[:4]) or "-"), rec.get("slogan_placement"), rsr.get("site") or "-"))
    else:
        print("   [brand] no brand signal (%s) -> placement=%s, slogan falls back to candidate-fit only"
              % (rsr.get("flag") or "empty", rec.get("slogan_placement")))
    return rec

# ── row eligibility ────────────────────────────────────────────────
def row_uk(row):  return row[11] if len(row) > 11 and row[11] else (str(row[1]) + "|" + str(row[2]))

def jd_content_len(jd):
    """Meaningful JD length = whitespace-collapsed content, NOT raw chars.
    Scraped 'Career Opportunities:' listing headers are a bare title + a
    'Requisition ID … - Posted - …' line padded with hundreds of CRLFs;
    they clear a raw len>200 gate but carry <100 chars of real JD, so
    generating from them would force fabrication. Collapse runs of
    whitespace before measuring so only rows with a real posting body pass."""
    return len(re.sub(r"\s+", " ", jd or "").strip())

def eligible_rows(doc, only=None, force=False):
    """Rows to generate: queue truthy OR (queue undefined AND no artifact),
    AND jd >200 chars, AND no CV/CL artifact yet. Honour tier from gen[uk].
    force=True bypasses the no-artifact gate — a CLEAN re-gen of rows that
    already have an application (owner 2026-07-15: regenerate the queued apps
    with today's fixes). The active-pointer guard in cmd_run still protects the
    user's working app."""
    rows = doc.get("rows") or []
    jd = doc.get("jd") or {}; queue = doc.get("queue") or {}
    gen = doc.get("gen") or {}; arts = doc.get("artifacts") or {}
    urls = doc.get("urls") or {}
    out = []
    for row in rows:
        uk = row_uk(row)
        if only and uk not in only:
            continue
        a = arts.get(uk) or {}
        has_art = bool(a.get("cv_export_url") or a.get("application_id"))
        jd_ok = jd_content_len(jd.get(uk)) > 200
        q = queue.get(uk)
        want = bool(q) or (q is None and not has_art)
        if only:  # explicit selection bypasses the queue flag, still needs a JD
            want = True
        if want and jd_ok and (force or not has_art):
            out.append({
                "uk": uk, "rank": row[0], "company": row[1], "role": row[2],
                "tier": gen.get(uk) or "quick", "jd": jd.get(uk) or "",
                # BRAND-DECIDES-RESEARCH-001: the CANONICAL posting URL (doc.urls[uk])
                # seeds the brand crawl — the worker follows an aggregator link
                # through to the employer's own site (aggregators discovery-only).
                "url": urls.get(uk) or "",
            })
    return out

_DA_STOPWORDS = [" og ", " til ", " for ", " med ", " som ", " er ", " på ", " af ",
                 " ved ", " ikke ", " har ", " vil ", " skal ", " du ", " dig ",
                 " vi ", " vores ", " en ", " et ", " den ", " det "]
_EN_STOPWORDS = [" the ", " and ", " you ", " your ", " we ", " our ", " to ", " for ",
                 " with ", " of ", " will ", " a ", " in ", " on ", " is ", " are ",
                 " as ", " at ", " that ", " this "]
def detect_language(jd):
    """Per-application output language = the JOB's language, NOT the owner's
    global UI preference (which reflects their last UI state — a 'zh' UI must
    not make a Danish job application generate in Chinese). Compares Danish vs
    English stopword FREQUENCY (a ratio, so incidental Danish place-names like
    'Smørum' in an English posting don't flip it). Danish only when it clearly
    outweighs English. Extend here for other languages."""
    t = " " + (jd or "").lower() + " "
    da = sum(t.count(w) for w in _DA_STOPWORDS)
    en = sum(t.count(w) for w in _EN_STOPWORDS)
    return "da" if da > en * 1.15 and da >= 5 else "en"

def guess_category(role, jd):
    # Returns ONLY ids in REAL_CATEGORIES (== the relay's CATEGORIES set);
    # anything else the relay rewrites to 'unsolicited'. Fallback is
    # 'consulting' (a valid generic white-collar id), never 'other'/'unsolicited'.
    rt = str(role).lower()                      # ROLE TITLE = the authoritative signal
    t = (str(role) + " " + str(jd)).lower()     # combined = fallback only
    def rhas(*ks): return any(k in rt for k in ks)
    def has(*ks): return any(k in t for k in ks)
    # 1) ROLE-TITLE routing FIRST. The old code scanned role+JD together, so an
    # optical/process-engineer JD that merely MENTIONS "research"/"data" got
    # mis-routed to research_phd / data_analytics (the 2026-07-12 defect: NKT
    # 'Optical Engineer II' persisted as research_phd, 'Senior Process Engineer'
    # as data_analytics). The title decides; the JD body only breaks ties.
    # PM / PO titles win FIRST — 'Service Excellence PM' and 'Technical BA /
    # Proxy PO' are product roles, so they must beat the 'excellence'/'BA' rules
    # below that would otherwise catch their other title tokens.
    if rhas("product manager", "product owner", "proxy po", "product / project", "produkt",
            " po ", "po,", " pm", "pm,", "pm "): return "product_management"
    if rhas("project manager", "programme manager", "program manager", "project steering", "head of project", "projektleder"): return "program_management"
    if rhas("data scientist", "data analyst", "data engineer", "analytics engineer", "business intelligence"): return "data_analytics"
    if rhas("scientist", "phd", "postdoc", "researcher"): return "research_phd"
    if rhas("software", "developer", "backend", "frontend", "full stack", "full-stack"): return "engineering_software"
    if rhas("manufacturing", "operations", "supply"): return "operations"
    # quality/audit/regulatory titles are operations even when they say 'engineer'
    if rhas("quality", "auditor", "audit", "regulatory", "compliance"): return "operations"
    if rhas("business excellence", "process excellence", "service excellence", "lean", "six sigma"): return "operations"
    # business/technical analyst titles are consulting, NOT engineering — must be
    # decided by the title before the generic 'system'/'engineer' fallback below,
    # or a BA JD that mentions 'system' mis-routes to engineering_hardware.
    if rhas("business analyst", "ba -", " ba ", "ba,", "reinsurance", "consultant", "advisor"): return "consulting"
    if rhas("optical", "optics", "photonic", "engineer", "hardware", "system", "r&d"): return "engineering_hardware"
    # 2) Fallback to combined text for whatever the title did not decide.
    if has("product manager", "product owner", "senior pm", " pm,"): return "product_management"
    if has("project manager", "programme manager", "program manager", "project steering", "head of project"): return "program_management"
    if has("optical", "optics", "photonic", "process engineer", "hardware", "lead engineer", "development engineer", "test engineer", "system"): return "engineering_hardware"
    if has("analytics engineer", "data scientist", "data analyst", "data engineer", "business intelligence", " bi ", "analytics"): return "data_analytics"
    if has("research", "scientist", "phd", "postdoc"): return "research_phd"
    if has("software", "developer", "backend", "frontend"): return "engineering_software"
    if has("quality", "regulatory", "audit", "iso ", "compliance", "operations", "supply", "service excellence", "business excellence", "manufacturing"): return "operations"
    if has("cfo", "controller", "finance", "accounting", "treasury"): return "finance"
    if has("chief", "head of", "director", "vp ", "vice president"): return "executive"
    if has("hr ", "people", "talent", "recruit"): return "people_soft"
    if has("business analyst", "reinsurance", " ba ", "consult", "advisor", "specialist"): return "consulting"
    return "consulting"

# ── CATEGORY-RECALL-001: prior same-category application digest ─────
# Generation recall prefers the most-recent SAVED application of the same
# category over the generic style|lang kernel: its tone/altitude is already
# tuned to the category. The relay's GET /api/applications?category=&latest=1
# returns the newest row WITH cv_sections. The digest is SUBORDINATE
# reference material only — never a source of facts (identity lock wins).

def _digest_strings(node, out, limit):
    """Collect visible text strings from an app-native section tree."""
    if len(out) >= limit: return
    if isinstance(node, str):
        s = node.strip()
        if s and not s.startswith("data:"): out.append(s)
    elif isinstance(node, list):
        for v in node: _digest_strings(v, out, limit)
    elif isinstance(node, dict):
        for k in ("title", "label", "text", "t", "b", "lead", "body", "result",
                  "left", "right", "content", "rows", "bullets", "items", "children"):
            if k in node: _digest_strings(node[k], out, limit)

def prior_app_digest(category):
    """Fetch the newest same-category saved application and compress its
    cv profile/outcomes/core into a ~2000-char plain-text digest, or None."""
    try:
        c, b = _req(RELAY, "/api/applications?category=%s&latest=1"
                    % urllib.parse.quote(str(category)))
    except Exception as e:
        print(f"   [prior-app] fetch failed ({e})"); return None
    if c != 200: return None
    app = (b or {}).get("application")
    if not isinstance(app, dict): return None
    cv = app.get("cv_sections")
    if not cv: return None
    # keep only profile/outcome/competenc/core-flavoured sections when the
    # shape allows it; otherwise digest the whole tree.
    picked = cv
    if isinstance(cv, list):
        want = ("profile", "outcome", "core", "competenc", "specialis", "specializ")
        hits = [s for s in cv if isinstance(s, dict) and any(
            w in str(s.get("id", "")).lower() + str(s.get("title", "")).lower() for w in want)]
        if hits: picked = hits
    out = []
    _digest_strings(picked, out, 400)
    text = " | ".join(out)
    # sanitize: drop control chars, collapse whitespace, cap ~2000 chars
    text = re.sub(r"[\x00-\x08\x0b-\x1f\x7f]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()[:2000]
    if not text: return None
    header = "role: %s @ %s (category %s, saved %s)" % (
        app.get("jd_role") or "?", app.get("jd_company") or "?",
        app.get("category") or category, app.get("updated_at") or "?")
    return header + "\n" + text

# ── MODE-A-BASELINE-001: prior application for the SAME job (reopened ad) ──
# Owner 2026-07-21: "the nightly is not always a generation from scratch: an ad
# can be published more than once (closed, reopened)." v5 Mode A = adapt an
# existing baseline, not regenerate. If a PRIOR application exists for the SAME
# company+role (a different posting of the same job), attach its cv+cl as a
# BASELINE TO ADAPT (preserve deliberate wording, minimum change) - distinct
# from the same-CATEGORY tone reference above (which says "do NOT copy"). The
# current posting (identical jd_text) is excluded so we never "adapt" the row
# we are regenerating.
def _same_job_baseline(company, role, jd_text):
    co = (company or "").strip().lower()
    ro = (role or "").strip().lower()
    if not co or not ro:
        return None
    try:
        c, b = _req(RELAY, "/api/applications")
    except Exception as e:
        print(f"   [mode-a] list failed ({e})"); return None
    if c != 200:
        return None
    lst = (b or {}).get("applications") if isinstance(b, dict) else b
    if not isinstance(lst, list):
        return None
    cur = re.sub(r"\s+", " ", str(jd_text or "")).strip()[:400]
    cand = [a for a in lst if isinstance(a, dict)
            and str(a.get("jd_company") or a.get("company") or "").strip().lower() == co
            and str(a.get("jd_role") or a.get("role") or "").strip().lower() == ro]
    cand.sort(key=lambda a: a.get("id") or 0, reverse=True)
    for a in cand[:4]:
        try:
            cc, bb = _req(RELAY, "/api/applications/%s" % a.get("id"))
        except Exception:
            continue
        if cc != 200:
            continue
        app = (bb or {}).get("application")
        if not isinstance(app, dict):
            continue
        if re.sub(r"\s+", " ", str(app.get("jd_text") or "")).strip()[:400] == cur:
            continue  # same posting being regenerated, not a prior baseline
        cv, cl = app.get("cv_sections"), app.get("cl_sections")
        if not cv and not cl:
            continue
        out = []
        _digest_strings(cv, out, 70)
        _digest_strings(cl, out, 45)
        text = re.sub(r"[\x00-\x08\x0b-\x1f\x7f]", " ", " | ".join(out))
        text = re.sub(r"\s+", " ", text).strip()[:3500]
        if not text:
            continue
        return {"id": a.get("id"), "digest": text}
    return None

# ── section plan ───────────────────────────────────────────────────
# Each section: an Anthropic /v1/messages body. The user turn carries the
# profile + JD + signals + the section ask (trigger words match
# prompt-augment.js's detectCVTask so the belts fire). system stays lean;
# the proxy PREPENDS its task frame + anti-fabrication + banned list.
CV_SECTIONS = [
    ("cv_profile",          "PROFILE",           "Write the CV PROFILE section (2-3 tight sentences + optional 'Work style:' clause) for this candidate résumé. TARGETED-PROFILE-DOMAIN-001: the opener MUST match the JD domain (for an electro-optics / photonics / laser / LiDAR role: 'Electro-optics and photonics engineer with 15+ years across laser-based sensing, LiDAR, optical validation, supplier coordination and hardware product development.'); the second profile sentence carries scope or delivery evidence and must NEVER restate the separate 'Work style:' line (PROFILE-WORKSTYLE-DEDUP-001); a generic 'IT professional' opener on a targeted technical role is a FAILED generation."),
    ("cv_outcomes",         "SELECTED OUTCOMES", "Generate the CV SELECTED OUTCOMES section: 5-6 verb-led outcomes, each with a bold lead and a body. Each body follows the RESULTS-LINE FORMULA (v5): [SUPPORTED OUTCOME] + [SCALE OR METRIC] + [MECHANISM OR OPERATIONAL CONTEXT] - e.g. 'Cut LiDAR unit cost 90% (10x) by leading substitute selection and qualification across source, detector and timing trade-offs'. Use ONLY real, supported numbers; NEVER an unsupported superlative; do not repeat the leading clause of a role bullet; do not combine unrelated achievements to fill a line. Return one per line as 'LEAD / body'."),
    ("cv_core",             "CORE COMPETENCIES", "Generate the CV CORE COMPETENCIES table: 6 rows, each 'Focus Area | Strategic Expertise'. ROLE-SPECIFIC (V5-FOCUS-PRIORITIES-001, owner ruled v5 authoritative 2026-07-21 - this REPLACES the former 'backward-looking, role-independent' rule): the FIRST THREE rows MUST MIRROR the three ranked employer priorities of THIS job description, in the SAME ORDER, as short evidence-based labels; the remaining rows carry the candidate's other strongest supporting competencies. Every row must be drawn from the candidate's REAL experience - NEVER invent or stretch a competency just to match a priority; if the candidate cannot genuinely cover a priority, use the nearest real adjacent strength instead, stated in the KERNEL'S OWN WORDING - NEVER synthesise a new technical noun-compound from adjacent kernel words (no 'thermal packaging' from separate 'thermal' + 'packaging' facts; COMPOUND-BACKED-001)."),
    ("cv_specialization",   "SPECIALISATION",    "Write the CV SPECIALISATION / positioning line for the header: AT MOST THREE short concepts separated by ' • ' (a bullet), tailored to THIS role's domain and drawn from the candidate's real strengths. NOT a sentence, no company name, no punctuation at the end. Return ONLY the line."),
]
CL_SECTIONS = [
    ("cl_opening",          "Opening",           "Write the COVER LETTER OPENING line (1-2 first-person sentences): a specific, engaging hook that names the role and gives a genuine, concrete reason this candidate is drawn to it - NOT a flat 'I am applying for the X position at Y'. Calm professional register, no filler, no greeting line, no name."),
    ("cl_who_i_am",         "WHO I AM",          "Write the COVER LETTER WHO I AM end-block (CL-V5-STRUCT-001 - it sits near the END of the letter, after HOW I WILL CONTRIBUTE) in FIVE lines, in this exact order and format: (1) ONE lead sentence on the conditions the candidate works best in; then four labelled lines, each starting with its label and a colon - (2) 'Professional summary:' years, disciplines and the environments the candidate has come from; (3) 'How I operate:' ONE sentence of work style; (4) 'Eligibility:' ONLY when the candidate's stored record CONFIRMS it AND the role makes it relevant (residence/citizenship, criminal-record status, family-tie declarations) - omit the whole line otherwise, and NEVER infer eligibility or clearance from residence or citizenship; (5) 'My goal:' the contribution the candidate wants to make, never unilateral control. Each line at most ~30 words. EVERY line must start with its exact label followed by a colon - an unlabelled line cannot be placed. The lead sentence and the 'My goal:' line are MANDATORY (CL-V5-WHO-GOAL-001); only the 'Eligibility:' line may be omitted."),
    ("cl_what_i_bring",     "WHAT I BRING",      "Write the COVER LETTER WHAT I BRING section (CL-V5-STRUCT-001) as: (1) ONE short linking line naming what the candidate brings, ending with a colon; then (2) EXACTLY THREE rows, one per line, each 'Label | Evidence' (evidence cell max ~110 chars): row 1 = the DECISION FOUNDATION (evidence, requirements, supplier input, risk, gates), row 2 = the STRONGEST hands-on cost or technical result with its real number, row 3 = PROJECT, TEAM AND STAKEHOLDER DIRECTION with real scope. Lead with the most role-critical metric; never invent a number. These are the candidate's EVIDENCE - do NOT restate the employer problems from HOW I SEE THE ROLE and do NOT propose what you would do (that is HOW I WILL CONTRIBUTE). Return the lead-in line first, then the three rows."),
    ("cl_why_this_position","WHY THIS POSITION", "Write the COVER LETTER WHY THIS POSITION section: 2-3 SHORT sentences specific to this role and company, at most ~50 words (3-4 lines). Tight and readable. WHY-JOINED-SENTENCE-001 (hard): EVERY sentence must JOIN the employer to the CANDIDATE inside that same sentence - the employer's activity or product is the SUBJECT and the sentence lands on the candidate's named territory (a domain, system, method or result). A sentence that only states a fact about the employer is a FAILURE: they already know their own founding year, size, location and product line, and at this word budget a recited fact eats the whole section. NEVER write a standalone heritage line ('X has built Y since 1975', 'founded in 1968', 'a leading supplier of Y') and NEVER an empty bridge ('This role aligns with my background', 'This position matches my experience'). GOOD: \"Aimpoint's red-dot sights sit exactly where my career has been: optical-systems architecture, sensor integration and verification across defence sighting, camera optics and automotive LiDAR.\" BAD: \"Aimpoint has built red dot sights in Sweden since 1975. This role aligns with my defence-optics work: ...\" - the fact carries no candidate content and the second sentence never connects back."),
    ("cl_how_i_see_role",   "HOW I SEE THE ROLE","Write the COVER LETTER HOW I SEE THE ROLE section (CL-V5-STRUCT-001, NEW in v5) as: (1) ONE lead sentence naming the connected priorities the work centres on, ENDING WITH A COLON (example shape: 'The work appears to centre on three connected priorities:'); then (2) EXACTLY THREE rows, one per line, each 'Short label | ONE sentence'. Each row states the EMPLOYER'S problem ONLY - what this role has to solve, drawn from the job description. NO candidate evidence, NO proposed solution, no 'I'. Return the lead-in line first, then the three rows."),
    ("cl_how_i_would_contribute","HOW I WOULD CONTRIBUTE","Write the COVER LETTER HOW I WOULD CONTRIBUTE section in THREE parts, in this exact order and format (CL-V5-CONTRIB-3-CLOSE-001, owner-locked: OPENING + 3 BULLETS + CLOSING - never more, never fewer): (1) ONE lead-in sentence (~12-18 words) that frames the first priorities and ENDS WITH A COLON; (2) EXACTLY THREE short verb-led action bullets, one per line, each starting with '- ' - a fourth bullet is a FAILURE, fold the team-trust angle into one of the three when people coordination matters; (3) a MANDATORY FINAL line starting with 'Goal:' naming the concrete outcome the team gains (about 100 characters). All three parts are required; omitting the Goal line is a failed generation. Return only those lines."),
    # CL-V5-STRUCT-001: cl_foundation retired - v5 carries this content in the WHO I AM
    # end-block (Professional summary / How I operate). Kept out of CL_SECTIONS so the
    # nightly stops paying for a section the v5 letter no longer renders.
    ("cl_closure",          "Closure",           "Write the COVER LETTER CLOSURE (1-2 first-person sentences): a warm, confident sign-off that INVITES a conversation and points at the concrete value the candidate would bring to THIS employer. Do NOT restate why the candidate is drawn to the role (the opening already does that); focus on the invitation and the value. Not generic boilerplate. No 'Sincerely'/signature line, no name."),
    ("cl_slogan",           "SLOGAN",            "Write ONE cover-letter HEADLINE (the slogan), a single line of 4 to 13 WORDS (V5-SLOGAN-ROLE-001, v5 §1 'outcome-oriented headline LINKED TO THE ROLE'). SHORTER, SHARPER AND MORE MEMORABLE SCORES HIGHER - 13 is a hard ceiling, NOT a target; use the FEWEST words that still land the point. PREFERRED SHAPE: 'A [candidate's real role identity] WHO [concrete, role-specific value verb + domain object]' - the GOLD STANDARD is 'A PROJECT MANAGER WHO MOVES OPTICAL HARDWARE FROM LAB TO SCALABLE DELIVERY' - and FUSE impact with the candidate's PERSONALITY where a word can carry both (SLOGAN-PERSONALITY-IMPACT-001: 'TURNS MEASURED LIGHT INTO SHIPPED PRODUCT' - 'measured' is both temperament and metrology); a vague tagline that could head ANY letter is a FAILURE. ORGANISING PRINCIPLE = THE ROLE + THE OUTCOME: name what this ROLE does and the concrete OUTCOME the candidate moves it toward - e.g. 'Moving optical hardware from lab to scalable delivery' (8) or 'Project manager turning lab optics into product' (7). It must read as THIS role, not as a generic personal tagline. SECONDARY (never at the cost of the role linkage or of brevity): if an EMPLOYER BRAND block is present you MAY echo its register/tone, but NEVER name the company and NEVER invent a company value. Hard limits: 4-13 words, no trailing period, no quotation marks. Return ONLY the line."),
]

def _user_turn(profile_json, meta, section_ask):
    lines = []
    lines.append("You are generating one section of an AntCV CV/cover-letter for the candidate below.")
    lines.append("")
    lines.append("=== CANDIDATE PROFILE (the ONLY source of identity, employers, education, certifications, publications, and domain — see the identity lock) ===")
    lines.append(profile_json)
    lines.append("")
    if meta.get("jd"):
        lines.append("=== JOB DESCRIPTION (subordinate context: tells you which REAL experience to emphasise; never a source of identity/history) ===")
        # EVIDENCE-RANK-002 (owner 2026-08-16): exact-match-first + rarity weighting.
        lines.append("EVIDENCE RANKING (EVIDENCE-RANK-002): evidence matching an EXPLICIT JD requirement outranks ANY generic transferable evidence regardless of impact; the rarer the requirement the candidate genuinely covers (an automated optical test setup outranks generic project management), the higher that evidence ranks. Impact orders items only within the same relevance tier.")
        lines.append("Company: " + str(meta.get("company", "")) + "  |  Role: " + str(meta.get("role", "")))
        lines.append(meta["jd"][:14000])
        lines.append("")
    if meta.get("signals"):
        lines.append("=== ADDITIONAL SIGNALS (owner-supplied framing; subordinate) ===")
        # 8000, up from 2500: attached signal materials (SIGNAL-MATERIALS-001)
        # ride in this block and would not survive the old cap.
        lines.append(str(meta["signals"])[:8000]); lines.append("")
    if meta.get("support"):
        lines.append("=== ROLE INTEL (needs / bring / signals; subordinate) ===")
        lines.append(json.dumps(meta["support"])[:2500]); lines.append("")
    _notes = meta.get("notes") or {}
    if isinstance(_notes, dict) and (_notes.get("hm") or _notes.get("deadline") or _notes.get("why")):
        lines.append("=== APPLICATION NOTES (owner-captured; subordinate framing, never a source of the candidate's facts) ===")
        if _notes.get("hm"): lines.append("Hiring manager: " + str(_notes["hm"]).strip() + " — address the cover-letter greeting to this person by name.")
        if _notes.get("deadline"): lines.append("Application deadline: " + str(_notes["deadline"]).strip() + ".")
        if _notes.get("why"): lines.append("Why this role for the candidate (their OWN words — weave the genuine motivation into WHY-THIS-POSITION; do not quote verbatim): " + str(_notes["why"]).strip())
        lines.append("")
    if meta.get("research"):
        lines.append("=== RECENT WEB RESEARCH on the employer (Brave web search; SUBORDINATE — may be dated, verify; NEVER a source of the candidate's identity/history) ===")
        lines.append(str(meta["research"])[:2500]); lines.append("")
    if meta.get("brand_brief"):
        # BRAND-DECIDES-RESEARCH-001: the employer's own brand voice (spirit/
        # values/tone) sampled from its site. Subordinate framing for the VOICE
        # of the letter — above all the SLOGAN — never a source of candidate facts.
        lines.append("=== EMPLOYER BRAND (sampled from the company's own website — spirit, values, tone; SUBORDINATE framing for VOICE, never a source of the candidate's facts) ===")
        lines.append(str(meta["brand_brief"])[:1200]); lines.append("")
    if meta.get("prior_app"):
        # CATEGORY-RECALL-001: tone/altitude reference from the newest saved
        # same-category application. Subordinate — the identity lock and the
        # CANDIDATE PROFILE above stay the only source of facts.
        lines.append("=== PRIOR SAME-CATEGORY APPLICATION (tone/altitude reference; never a source of facts) ===")
        lines.append("Match its register, altitude, and density. Do NOT copy sentences, and do NOT import any fact, employer, number, or claim from it that is absent from the CANDIDATE PROFILE.")
        lines.append(str(meta["prior_app"])[:2000]); lines.append("")
    if meta.get("baseline"):
        # MODE-A-BASELINE-001 (v5 Mode A): a PRIOR application exists for this SAME
        # job (the ad was re-published / reopened). ADAPT it, do not start from
        # scratch. Opposite instruction to the same-category tone reference above:
        # here you SHOULD keep the candidate's deliberate wording and structure.
        _bl = meta["baseline"]
        _bltxt = _bl.get("digest") if isinstance(_bl, dict) else _bl
        lines.append("=== PRIOR APPLICATION FOR THIS SAME JOB — BASELINE TO ADAPT (v5 Mode A; the ad was re-published) ===")
        lines.append("This is your BASELINE for this exact role. ADAPT it rather than rewriting from scratch: KEEP the candidate's deliberate wording, structure and emphasis where they still work; change ONLY what the current posting needs; do NOT reproduce any accidental error (typo, mixed tense, singular/plural mismatch); the CANDIDATE PROFILE above remains the ONLY source of facts - never import a fact absent from it.")
        lines.append(str(_bltxt)[:3500]); lines.append("")
    _langname = {"da": "Danish", "en": "English", "sv": "Swedish"}.get(meta.get("language"), meta.get("language"))
    lines.append("OUTPUT LANGUAGE: write this section in " + str(_langname) + ".")
    lines.append("TASK: " + section_ask)
    lines.append("Return ONLY the section content — no preamble, no headings unless the section format calls for them, no commentary.")
    return "\n".join(lines)

def build_plan(profile, meta, tier):
    profile_json = json.dumps(profile, ensure_ascii=False)
    if len(profile_json) > 30000:
        profile_json = profile_json[:30000]  # source_cv caps at 40k server-side; keep headroom
    model = MODEL_HIGH if tier == "high" else MODEL_QUICK
    max_tokens = 1600 if tier == "high" else 1100
    secs = []
    for sid, title, ask in (CV_SECTIONS + CL_SECTIONS):
        secs.append({
            "id": sid, "title": title,
            "prompt": {
                "model": model,
                "system": "You write precise, factual CV and cover-letter sections in a calm Danish-toned professional register. No hype, no filler, no banned words. No contractions in professional documents (write 'do not', not 'don't'). When the output language is English, use British spelling. FACTUAL GUARD (v5): never infer a security clearance from residence, citizenship or work in an MISWG country, and distinguish screening eligibility from a completed clearance; if you use 'MISWG', expand it on first use as 'Multinational Industrial Security Working Group' and describe it as an international industrial-security group of member states and observers including NATO - NEVER call it a NATO body.",
                "messages": [{"role": "user", "content": _user_turn(profile_json, meta, ask)}],
                "max_tokens": max_tokens,
                "stream": True,
            },
        })
    return secs, model

# ── drive gen-job ──────────────────────────────────────────────────
def drive(sections, provider, model, source_cv, jd_text, max_steps=80, skip_coherence=False):
    c, b = _req(PROXY, "/job/create", "POST", {
        "sections": sections, "provider": provider, "model": model,
        "meta": {"runner": "gen-runner"}, "source_cv": source_cv, "jd_text": jd_text,
    })
    if c != 200 or not b.get("job_id"):
        return {"error": f"create_failed {c} {str(b)[:200]}"}
    jid = b["job_id"]
    print("   [job] %s" % jid)
    view = None
    skipped_coh = False
    for _ in range(max_steps):
        # A single step streams a whole flagship section (or runs the coherence
        # repair) synchronously, so 120s is too tight for opus-tier rows.
        c, view = _req(PROXY, "/job/step", "POST", {"job_id": jid}, timeout=300)
        if c != 200:
            if c == 599: print("   [job] step transport-failed, re-stepping %s" % jid)
            time.sleep(1.5); continue
        st = view.get("status")
        if st in ("done", "error", "cancelled"):
            break
        # COHERENCE-HOMOGENISATION-GUARD: when the last section finishes the job
        # enters status 'coherence' with every section done and filled in its
        # PRE-REPAIR state; the NEXT step runs the cross-section repair, which on
        # weak (quick-tier) models homogenises prose sections into the one table
        # section's "Focus Area | Strategic Expertise" shape (the 2026-07-12
        # persisted-batch defect). Stop here and keep the pre-repair sections.
        if skip_coherence and st == "coherence":
            skipped_coh = True
            break
        time.sleep(0.4)
    raw_status = view.get("status") if view else "unknown"
    out = {"job_id": jid,
           "status": "done" if (skipped_coh and raw_status == "coherence") else raw_status,
           "sections": {},
           "coherence": {"state": "skipped_by_runner"} if skipped_coh else (view or {}).get("coherence"),
           "totals": (view or {}).get("totals")}
    for s in (view or {}).get("sections", []):
        out["sections"][s["id"]] = {"title": s.get("title"), "state": s.get("state"),
                                    "result": s.get("result"), "error": s.get("error"),
                                    "coherence_revised": s.get("coherence_revised")}
    return out

# ── banned-word check (report only) ────────────────────────────────
BANNED_SAMPLE = (_GOLD.get("banned_words") or ["spearhead", "leverage", "robust", "passionate", "committed", "cutting-edge", "world-class", "results-driven"]) + ["—", "–"]
def banned_hits(text):
    t = (text or "").lower()
    return [w for w in BANNED_SAMPLE if w in t]

def provider_exhausted(res):
    """Return a short human reason if generation failed with a provider
    BILLING/QUOTA-exhaustion signature (the shared server key is out of
    credit/quota), else None. This blocks the ENTIRE batch — every remaining
    row would fail the same way and each wastes a /job/create — so the caller
    aborts fast + legibly instead of grinding on. Only the owner can clear it
    (top up Anthropic credit / OpenAI quota); it is NOT a code fault.
    Signatures seen live 2026-07-12: anthropic 400 'credit balance is too low',
    openai 429 'exceeded your current quota' / 'insufficient_quota'."""
    sigs = ("credit balance is too low", "out of credit", "exceeded your current quota",
            "insufficient_quota", "billing details", "quota_exceeded")
    blobs = [str(res.get("error") or "")]
    for s in (res.get("sections") or {}).values():
        blobs.append(str(s.get("error") or ""))
    for b in blobs:
        bl = b.lower()
        if any(g in bl for g in sigs):
            return b[:220]
    return None

# Conservative whole-word swaps for the banned buzzwords the writing belts are
# meant to block but the cheap quick model (gpt-5-mini) still leaks. Only the
# unambiguous, safe-to-replace ones are mapped (owner banned-words standard); a
# semantic-heavy word is left for a human rather than mangled. Case is preserved
# for a capitalised first letter.
_BANNED_SWAP = {
    "leverage": "use", "leveraging": "using", "leveraged": "used",
    "robust": "reliable", "spearhead": "lead", "spearheaded": "led",
    "cutting-edge": "advanced", "world-class": "leading",
    "results-driven": "outcome-focused", "passionate": "committed",
}
def _swap_banned(text):
    def repl(m):
        w = m.group(0); low = w.lower(); sub = _BANNED_SWAP[low]
        return sub[:1].upper() + sub[1:] if w[:1].isupper() else sub
    for bad in _BANNED_SWAP:
        text = re.sub(r"(?<![\w-])" + re.escape(bad) + r"(?![\w-])", repl, text, flags=re.I)
    return text

def sanitize_text(text):
    """Deterministic last-layer scrub before a section is PERSISTED. The writing
    belts still occasionally emit a banned em/en dash OR a banned buzzword (the
    'one layer isn't enough' class — emdash-hyphen-three-layers memory); the LLM
    path cannot be trusted to be the only guard. Owner rules: ALWAYS a plain
    hyphen; never a banned buzzword."""
    if not text: return text
    t = text.replace(" — ", " - ").replace(" – ", " - ")
    t = t.replace("—", "-").replace("–", "-").replace("‑", "-").replace("‐", "-")
    t = _swap_banned(t)
    return t

# ── commands ───────────────────────────────────────────────────────
def cmd_list(args):
    _, doc = get_doc()
    rows = eligible_rows(doc, set(args.row) if args.row else None)
    if not rows:
        print("no eligible rows (queue/jd/artifact gates).")
        return
    print(f"{'uk':16} {'tier':6} {'rank':>4}  company / role   (jd chars)")
    for r in rows:
        print(f"{r['uk']:16} {r['tier']:6} {r['rank']:>4}  {str(r['company'])[:22]} / {str(r['role'])[:26]}  ({len(r['jd'])})")

def cmd_run(args):
    os.makedirs(args.out, exist_ok=True)
    kernel = load_kernel(args.kernel_file)
    profile = compact_profile(kernel)
    rev, doc = get_doc()
    only = set(args.row) if args.row else None
    rows = eligible_rows(doc, only, force=getattr(args, "force", False))
    # tier caps + High-first ordering
    rows.sort(key=lambda r: (0 if r["tier"] == "high" else 1, r["rank"]))
    high = [r for r in rows if r["tier"] == "high"][:args.max_high]
    quick = [r for r in rows if r["tier"] != "high"][:args.max_quick]
    todo = high + quick
    if not todo:
        print("no eligible rows to generate."); return
    print(f"generating {len(high)} high + {len(quick)} quick (of {len(rows)} eligible). persist={args.persist} dry={args.dry}")
    # ACTIVE-POINTER-GUARD-001: POST /api/applications sets the new app as the
    # account's active application. A batch persist would otherwise hijack the
    # user's editing pointer to the last generated app. Capture it up front and
    # restore it after, so a headless run never disturbs the user's working app.
    saved_active = None
    if args.persist:
        try:
            _c, _p = _req(RELAY, "/api/prefs")
            saved_active = ((_p.get("active_application") or {}) or {}).get("id")
            print(f"   [active-guard] saved current active application: {saved_active}")
        except Exception as _e:
            print(f"   [active-guard] could not read current active ({_e})")
    support = doc.get("support") or {}; signals = doc.get("signals") or {}
    notes = doc.get("notes") or {}  # TARGET-FACTS-CAPTURE-001: per-row {hm, deadline, why}
    sigfiles = doc.get("sigfiles") or {}  # SIGNAL-MATERIALS-001: per-row attached materials (extracted text)
    def _signals_for(uk):
        """Typed signals + attached signal-material texts, composed the same way
        the JobTracker island composes them (signalsBlockOf)."""
        parts = []
        s = str(signals.get(uk) or "").strip()
        if s: parts.append(s)
        for f in (sigfiles.get(uk) or []):
            if isinstance(f, dict) and f.get("text"):
                parts.append("--- attached signal material: %s ---\n%s"
                             % (f.get("name") or "file", str(f["text"])[:3000]))
        return "\n".join(parts) or None
    results_index = []
    for r in todo:
        uk = r["uk"]
        language = detect_language(r["jd"])
        rsch = research(r["company"], r["role"]) if getattr(args, "research", True) else ""
        if rsch: print("   research: %d findings" % len(rsch.splitlines()))
        # CATEGORY-RECALL-001: category is decided BEFORE the plan is built so
        # the newest same-category saved application can ride along as a
        # subordinate tone/altitude reference (never a source of facts).
        cat = guess_category(r["role"], r["jd"])
        prior = prior_app_digest(cat)
        if prior: print(f"   [prior-app] same-category ({cat}) reference attached ({len(prior)} chars)")
        # MODE-A-BASELINE-001: reopened-ad detection - adapt a prior same-job app.
        baseline = _same_job_baseline(r["company"], r["role"], r["jd"])
        if baseline: print(f"   [mode-a] prior SAME-JOB baseline attached (app #{baseline.get('id')}, {len(baseline.get('digest',''))} chars) - ADAPTING, not from scratch")
        # BRAND-DECIDES-RESEARCH-001: crawl the employer site for colours AND
        # spirit/values/tone in one step; the brief fuses into the slogan (+ all
        # CL voice) and the placement seeds antcv:clSloganMode at persist.
        brand = capture_brand_for(r) if getattr(args, "brand", True) else None
        r["brand"] = brand
        meta = {"company": r["company"], "role": r["role"], "jd": r["jd"],
                "signals": _signals_for(uk), "support": support.get(uk),
                "research": rsch, "language": language, "prior_app": prior,
                "baseline": baseline, "notes": notes.get(uk),
                "brand_brief": (brand or {}).get("slogan_brief") or None}
        sections, model = build_plan(profile, meta, r["tier"])
        print(f"\n== {uk} [{r['tier']}] {r['company']} / {r['role']} — {len(sections)} sections, model={model}")
        if args.dry:
            plan_path = os.path.join(args.out, f"plan_{uk}.json")
            json.dump({"row": r, "sections": sections}, open(plan_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            print(f"   (dry) plan -> {plan_path}"); continue
        t0 = time.time()
        # Route provider by the tier's model (quick=gpt-5-mini→openai, high=opus→anthropic),
        # unless the caller pinned --provider to something non-default.
        prov = _prov_for(model) if args.provider == "anthropic" else args.provider
        # SUPERVISOR-CLEANUP-ALL-TIERS-001 (owner 2026-07-21: "supervisor cleanup step as
        # the last part of the generation/tightening process ... including cross-section
        # repetitions not observed when working on each paragraph separately"). The proxy's
        # gen-coherence supervisor already does exactly this (finds cross-section repetition/
        # contradiction/redundancy AND rewrites the offending sections), but it used to run on
        # the HIGH tier only. Run it on EVERY gen now, so quick-tier apps also get the final
        # cross-section cleanup. Escape hatch for cost: ANTCV_COHERENCE=high-only reverts.
        _coh_mode = os.environ.get("ANTCV_COHERENCE", "all")
        res = drive(sections, prov, model,
                    source_cv=json.dumps(profile, ensure_ascii=False)[:38000], jd_text=r["jd"],
                    skip_coherence=(_coh_mode == "high-only" and r["tier"] != "high"))
        dt = round(time.time() - t0, 1)
        pexh = provider_exhausted(res)
        if pexh:
            print(f"   PROVIDER OUT OF CREDIT/QUOTA: {pexh}")
            print("   ABORTING BATCH — the shared server key is exhausted; every remaining "
                  "row would fail the same way (each wastes a /job/create). Owner must top up "
                  "billing (Anthropic credit / OpenAI quota) before this batch can run.")
            results_index.append({"uk": uk, "error": pexh, "provider_blocked": True})
            break
        if res.get("error"):
            print(f"   FAILED: {res['error']}"); results_index.append({"uk": uk, "error": res["error"]}); continue
        # quality probe
        allbanned = {}
        for sid, s in res["sections"].items():
            hb = banned_hits(s.get("result"))
            if hb: allbanned[sid] = hb
        ndone = sum(1 for s in res["sections"].values() if s.get("state") == "done" and (s.get("result") or "").strip())
        print(f"   status={res['status']} sections_done={ndone}/{len(sections)} coherence={(res.get('coherence') or {}).get('state')} in {dt}s")
        if allbanned: print(f"   BANNED-WORD HITS: {allbanned}")
        else: print("   banned-word probe: clean")
        bundle = {"uk": uk, "row": r, "tier": r["tier"], "model": model,
                  "generated_at": int(time.time()), "result": res, "banned_hits": allbanned}
        bpath = os.path.join(args.out, f"gen_{uk}.json")
        json.dump(bundle, open(bpath, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"   review bundle -> {bpath}")
        results_index.append({"uk": uk, "status": res["status"], "done": ndone, "bundle": bpath})
        if args.persist and res["status"] in ("done",):
            persist_application(doc, r, res, cat, language,
                                kernel=kernel, measure=getattr(args, "measure", True) and not args.dry,
                                max_pages=getattr(args, "max_pages", 2))
    idx_path = os.path.join(args.out, "index.json")
    json.dump(results_index, open(idx_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"\nindex -> {idx_path}")
    if args.persist:
        # re-fetch + writeback the doc rev-safe (artifacts were mutated in place)
        rev2, cur = get_doc()
        cur["artifacts"] = {**(cur.get("artifacts") or {}), **(doc.get("artifacts") or {})}
        cur["queue"] = {**(cur.get("queue") or {}), **(doc.get("queue") or {})}
        # BRAND-DECIDES-RESEARCH-001: persist per-position brand records too.
        if doc.get("brand"):
            cur["brand"] = {**(cur.get("brand") or {}), **(doc.get("brand") or {})}
        c, b = put_doc(cur, rev2)
        print(f"doc writeback: {c} rev={b.get('rev')}")
        # restore the user's active-application pointer (see ACTIVE-POINTER-GUARD-001)
        if saved_active is not None:
            rc, _ = _req(RELAY, "/api/active", "POST", {"application_id": saved_active})
            print(f"   [active-guard] restored active application {saved_active} ({rc})")

# ── skeleton overlay (blocker #1: full-fidelity persist) ───────────
# The runner generates 8 tailored sections (cv_profile/outcomes/core +
# cl_who/why/bring/contribute/foundation). A saved application renders EXACTLY
# its cv_sections/cl_sections (no client-side me() merge — see the
# gabriel-master-profile / kernel-recovery-and-floor memories), so persisting
# only those 8 flat blocks yields an app MISSING the whole sidebar, experience
# roles, and competency furniture. Fix: OVERLAY the 8 generated sections onto a
# captured full me() skeleton (Gabriel's real structure+furniture), converting
# each into the app's native shape (bullets {b,t} / table rows / rich_block
# labelled bullets). The skeleton is captured ONCE from a live browser session
# (localStorage 'sections') to ~/.antcv/cv_skeleton.json — it carries real
# candidate data so it lives OUTSIDE the repo. Re-capture when the profile
# materially changes.
SKELETON_PATH = os.environ.get("ANTCV_SKELETON") or os.path.join(
    os.path.expanduser("~"), ".antcv", "cv_skeleton.json")

def _ov_find(arr, sid):
    for s in arr:
        if s.get("id") == sid: return s
    return None

def _ov_table(md):
    """Parse 2-col rows in EITHER markdown ('| A | B |') OR plain ('A | B') form.
    The quick model emits both; requiring a leading '|' silently dropped the
    plain 'Focus Area | Strategic Expertise' rows (WHAT I BRING / CORE)."""
    rows = []
    for ln in (md or "").split("\n"):
        ln = ln.strip()
        if "|" not in ln: continue
        cells = [c.strip() for c in ln.strip("|").split("|")]
        if all(set(c) <= set("-: ") for c in cells): continue  # separator row
        if len([c for c in cells if c]) >= 2: rows.append(cells)
    return rows

def _ov_outcomes(md):
    out = []
    for ln in (md or "").split("\n"):
        ln = ln.strip()
        if not ln: continue
        m = re.match(r"^\*\*(.+?)\*\*\s*/\s*(.+)$", ln)
        if m:
            out.append({"b": sanitize_text(m.group(1)), "t": sanitize_text(m.group(2)), "bullets": []})
        else:
            ln2 = re.sub(r"^[-*]\s+", "", ln)
            out.append({"b": "", "t": sanitize_text(re.sub(r"\*\*", "", ln2)), "bullets": []})
    return out

def _ov_foundation(md):
    txt = re.sub(r"\*\*", "", md or "")
    m_pro = re.search(r"Professionally\s*:\s*", txt)
    m_hands = re.search(r"Hands-?on\s*:\s*", txt, re.I)
    handson = professionally = intro = ""
    if m_hands:
        intro = txt[:m_hands.start()].strip()
        if m_pro and m_pro.start() > m_hands.start():
            handson = txt[m_hands.end():m_pro.start()].strip()
            professionally = txt[m_pro.end():].strip()
        else:
            handson = txt[m_hands.end():].strip()
    else:
        handson = txt.strip()
    return sanitize_text(handson), sanitize_text(professionally), sanitize_text(intro)

def load_skeleton():
    try:
        with open(SKELETON_PATH, encoding="utf-8") as f:
            sk = json.load(f)
        if isinstance(sk.get("cv"), list) and isinstance(sk.get("cl"), list):
            return sk
    except Exception as e:
        print(f"   [skeleton] not usable ({e})")
    return None

# ── content guards + language furniture + Nordic compaction ─────────
_SCAFFOLD_RE = re.compile(r"\[[^\]\n]{3,}\]")
def _is_scaffold(text):
    """True if text is empty or STILL carries the me() skeleton's instructional
    bracket-scaffolding ('[INTRO LINE ...]', '[Role title]', '[Focus area 1]',
    '[CLOSURE ...]'). Such text must NEVER be persisted — the overlay must fall
    back to clean furniture instead of the raw template."""
    t = (text or "").strip()
    if not t:
        return True
    for m in _SCAFFOLD_RE.findall(t):
        if any(ch.isalpha() for ch in m[1:-1]):
            return True
    return False

def _is_table_blob(text):
    """True if a (prose-intended) generated section came back as a markdown
    table — the coherence-homogenisation signature. Prose slots reject it."""
    lines = [l for l in (text or "").split("\n") if l.strip()]
    if not lines:
        return False
    piped = sum(1 for l in lines if l.strip().startswith("|"))
    return piped >= 1 and piped >= len(lines) - 1

def _strip_scaffold(text):
    """Last-resort: remove any residual '[...]' scaffolding tokens from a string."""
    if not text:
        return text
    return re.sub(r"\s*" + _SCAFFOLD_RE.pattern + r"\s*", " ", text).strip()

# Clean, language-correct cover-letter furniture (used only when a generated
# slot is empty/scaffold/table — never overrides good generated prose). Owner
# rule: greet only a named hiring manager; none is captured, so a neutral team
# greeting in the JOB's language (LANG-FURNITURE-001, 2026-07-12).
_FURNITURE = {
    "en": {"greeting": "Dear Hiring Team,",
           "opening":  "I am writing regarding the {role} position at {company}.",
           "closure":  "I would welcome the chance to discuss how I can contribute to {company}."},
    "da": {"greeting": "Kære ansættelsesteam,",
           "opening":  "Jeg skriver angående stillingen som {role} hos {company}.",
           "closure":  "Jeg vil meget gerne tale om, hvordan jeg kan bidrage til {company}."},
    "sv": {"greeting": "Hej,",
           "opening":  "Jag skriver angående tjänsten som {role} på {company}.",
           "closure":  "Jag skulle gärna diskutera hur jag kan bidra till {company}."},
}
def _furn(language, key, company, role):
    f = _FURNITURE.get(language) or _FURNITURE["en"]
    return f[key].format(role=role, company=company)

# Cover-letter FOUNDATION section labels + fallback intro, localised to the JD
# language (FOUNDATION-LANG-001, 2026-07-15). The generation prompt asks for the
# internal parse markers "Hands-on:"/"Professionally:" in English, but the
# DISPLAYED labels + fallback intro must follow the CL's language, or an English
# "Foundation / Hands-on / Professionally" leaks into a Danish/Swedish letter.
_FOUNDATION_FURNITURE = {
    "en": {"label": "Foundation", "handson": "Hands-on", "professionally": "Professionally",
           "intro": "I connect what I do best with the outcomes this employer is after."},
    "da": {"label": "Grundlag", "handson": "Praktisk", "professionally": "Fagligt",
           "intro": "Jeg forbinder det, jeg er bedst til, med de resultater, arbejdsgiveren søger."},
    "sv": {"label": "Grund", "handson": "Praktiskt", "professionally": "Professionellt",
           "intro": "Jag kopplar det jag är bäst på till de resultat arbetsgivaren söker."},
}
def _flabel(language, key):
    f = _FOUNDATION_FURNITURE.get(language) or _FOUNDATION_FURNITURE["en"]
    return f.get(key) or _FOUNDATION_FURNITURE["en"][key]

# Nordic-Minimal compaction targets (~1.5-2 pages). Trims the verbose MAIN-column
# blocks; leaves the short sidebar furniture intact. Tunable; logs what it cut
# (NORDIC-COMPACT-001, 2026-07-12 — owner: the persisted batch ran 3-5 pages).
# ── JD-relevance engine (the heart of a TAILORED CV) ────────────────
# A Nordic CV must fit ~1.75 pages AND lead with what THIS employer cares about.
# So compaction is relevance-driven, not first-N truncation: rank the candidate's
# real experience + sidebar detail against the JD, merge same-employer roles to
# preserve breadth in fewer entries, keep <=6 roles each with <=3 JD-relevant
# bullets + one result, and hide sidebar items the JD does not touch.
_STOP = set("""the a an and or of to in for with on at by from as is are be was were will would can
could should may might have has had do does did been being this that these those your our we you i it
its their they them then than into over under above below across per via not no all any each both more
most other some such only own same so up out off about who what which when where how why us job jobs
role roles position candidate company companies team teams work working works experience years year
strong ability able etc use used using make making made new help join want looking seek seeking apply
you're we're our within across using""".split())
def _toks(text):
    return [w for w in re.findall(r"[a-zçæøåéüö][a-z0-9+/#.-]{2,}", (text or "").lower()) if w not in _STOP]
def _jd_kw(jd):
    from collections import Counter
    return Counter(_toks(jd))
def _rel(text, jdkw):
    return sum(jdkw.get(t, 0) for t in set(_toks(text)))
# CAP-CLEAN-CUT-001 (owner 2026-07-13): the raw word-boundary fallback in the
# caps was a TRUNCATION FACTORY — "…10 days while producing", "…traceable
# from" (no terminal period, dangling connector/preposition). Every cut now
# ends CLEAN: clause boundary preferred, dangling words walked back, terminal
# period restored (visible-leak floor, line-distribution-guidelines rule 10).
_DANGLING_WORDS = {"and", "or", "with", "for", "of", "to", "in", "on", "via", "the",
                   "a", "an", "plus", "from", "into", "under", "across", "while",
                   "og", "eller", "med", "til", "i", "på", "samt", "en", "et", "fra", "af"}
def _walk_back_dangling(t):
    words = t.split(" ")
    while len(words) > 3 and words[-1].strip(".,;:()").lower() in _DANGLING_WORDS:
        words.pop()
    return " ".join(words).rstrip(" ,;:-")
def _clean_cut(win):
    """Trim a hard-capped window back to a clean end: strip separators, walk
    back dangling connectors/prepositions, close with a period.

    CAP-AMPUTATED-PARENTHETICAL-001 (nightly 2026-08-18, shipped live in the
    CIP letter of app 3488): when the cap landed INSIDE a parenthetical the cut
    kept the opening bracket and the first token of its contents, then closed
    with a period - 'reduced LiDAR unit cost by 90% (a 10x.' - an unbalanced
    bracket around a number amputated from its unit. Drop any parenthetical the
    cut could not complete, then re-walk the dangling connectors it exposes.
    """
    t = _walk_back_dangling(win.rstrip(" ,;:-"))
    while t.count("(") > t.count(")"):
        t = _walk_back_dangling(t[:t.rfind("(")].rstrip(" ,;:-"))
    if t and t[-1] not in ".!?:)":
        t += "."
    return t
# CAP-AMPUTATED-ENUMERATION-002 (nightly 2026-08-18, shipped live in apps 3489
# and 3487): the cap landing INSIDE a comma-list severed it before its closing
# conjunction — "drawing on inputs from investment, legal." — dropping tax,
# finance and ESG while reading as a finished sentence. Unlike the amputated
# parenthetical of -001 the output is grammatical, so nothing flags it: the
# letter simply asserts a shorter list than the source claimed. A cut may lose
# a whole clause; it may never restate a list as complete after shortening it.
_LIST_CONJ = (" and ", " or ", " as well as ", " og ", " eller ", " samt ",
              " und ", " oder ", " y ", " e ")
def _severs_enumeration(s, p):
    """True when cutting source `s` at the comma at index `p` would leave a
    comma-list that `s` went on to CLOSE with a conjunction.

    Scoped by item length: a list closer joins SHORT items ("legal", "tax",
    "finance and ESG"), so a long trailing clause ("…, and the team moved on")
    is an ordinary compound sentence and stays a legal cut point.
    """
    tail = s[p + 1:]
    end = len(tail)
    for term in (". ", "; ", "! ", "? "):
        q = tail.find(term)
        if q != -1: end = min(end, q)
    items = [x.strip() for x in tail[:end].split(",")]
    items = [x for x in items if x]
    if not items: return False
    if not any(c in (" " + items[-1].lower() + " ") for c in _LIST_CONJ): return False
    return all(len(x.split()) <= 4 for x in items)
def _drop_open_list(t, s):
    """Walk a word-boundary cut back OUT of an enumeration it left hanging open.

    Cutting to the list's first comma is not enough — "…inputs from investment."
    still asserts one input where the source named five. Drop the first item too
    (items are short by construction) until the tail is a dangling connector,
    which _clean_cut then walks back: "…drawing on inputs."
    """
    opens = [i for i, ch in enumerate(t) if ch == "," and _severs_enumeration(s, i)]
    if not opens: return t
    words = t[:opens[0]].split(" ")
    for _ in range(4):
        if len(words) <= 3: break
        if words[-1].strip(".,;:()").lower() in _DANGLING_WORDS: break
        words.pop()
    return " ".join(words)
def _cap_line(s, maxlen=None):
    """Limit a bullet/result to ~2 rendered lines, trimming at a clause or word
    boundary (owner: 'limit line lengths') — always a CLEAN, period-closed end."""
    maxlen = maxlen or _BULLET_CAP
    s = (s or "").strip()
    if len(s) <= maxlen: return s
    win = s[:maxlen]
    for sep in (". ", "; ", ", "):
        p = win.rfind(sep)
        while sep == ", " and p != -1 and _severs_enumeration(s, p):
            p = win.rfind(sep, 0, p)
        if p >= maxlen * 0.55: return _clean_cut(win[:p])
    return _clean_cut(_drop_open_list(win.rsplit(" ", 1)[0], s))
def _cap_para(s, maxlen=None):
    """Keep a cover-letter PARAGRAPH readable (~3-4 lines): trim to the last full
    sentence under maxlen (owner: 'too long, >3-4 lines per paragraph')."""
    maxlen = maxlen or _PARA_CAP
    s = (s or "").strip()
    if len(s) <= maxlen: return s
    win = s[:maxlen]
    p = max(win.rfind(". "), win.rfind("! "), win.rfind("? "))
    if p >= maxlen * 0.5: return win[:p + 1].strip()
    return _clean_cut(_drop_open_list(win.rsplit(" ", 1)[0], s))
# WHY-JOINED-SENTENCE-001 (owner 2026-07-26, on a live Aimpoint letter: "how the f
# this sentence makes sense?? 'Aimpoint has built red dot sights in Sweden since
# 1975. This role aligns with my defence-optics work: ...'").
# The WHY section must JOIN the employer to the candidate in EVERY sentence. The
# failure shape is a recited company fact standing alone (the employer already
# knows their own founding year) followed by an empty bridge that never connects
# back. The prompts now forbid it in both layers (proxy task frame + runner slot
# prompt), and this belt CATCHES it anyway - a prompt is guidance, a gate is a
# guarantee.
# DETECTOR - three PRECISE rules. An earlier draft flagged any employer-naming
# sentence without a first-person word; the live sweep proved that over-fires on
# GOOD prose ("NKT Photonics builds photonic hardware where ... meet production
# reality. That is the work I have run ...") where the next sentence connects
# back, and on every non-English letter (the first-person test was English-only).
# Precision beats zeal here: a false positive rewrites the owner's good writing.
#  (1) RECITED FACT - the employer's own heritage/scale, which they already know,
#      stated with no candidate anchor. This is exactly what the owner caught.
#  (2) HOLLOW BRIDGE - a sentence that would survive being pasted into any other
#      application ("This role aligns with my background").
#  (3) META LEAK - the model talking ABOUT the task inside the letter (prompt
#      commentary, injection notes). Never acceptable in shipped prose.
_WHY_RECITED_RX = re.compile(
    r"\bsince\s+(?:19|20)\d\d\b|\b(?:founded|established|started|created)\s+in\s+(?:19|20)\d\d\b"
    r"|\bis\s+(?:a|the)\s+(?:leading|largest|biggest|world'?s|global|premier|foremost)\b"
    r"|\bemploys\s+\d|\bhas\s+(?:over\s+)?[\d,]+\s+employees\b"
    r"|\bhas\s+been\s+(?:building|making|producing|delivering)\b",
    re.I)
_WHY_BRIDGE_RX = re.compile(
    r"^\s*(?:and\s+)?(?:this|the)\s+(?:role|position|opportunity|job|vacancy)\s+"
    r"(?:really\s+|closely\s+|directly\s+)?(?:aligns?|matches?|fits?|corresponds?|speaks?|maps?)\b"
    r"|^\s*i\s+(?:believe|feel|think)\s+i\s+(?:would|will|could)\s+be\s+a\s+(?:good|great|strong)\s+fit",
    re.I)
_WHY_META_RX = re.compile(
    # The letter must never TALK ABOUT its own inputs. Any mention of the job
    # description/prompt AS A DOCUMENT, of injections, or of the drafting process
    # is a leak - the window-limited first draft let a reworded leak slip through
    # ("the job description excerpt is mostly corporate boilerplate ... no
    # injection attempt visible"), so the JD-as-object mention alone is enough.
    r"\b(?:job description|job posting|the listing|prompt|instructions?)\b[^.]{0,140}"
    r"\b(?:injection|bracketed|fragment|flagged|boilerplate|excerpt|placeholder)\b"
    r"|\b(?:possible|prompt|attempted) injection\b|\bi have ignored (?:it|that|this)\b"
    r"|\bas an ai\b|\bthe (?:user|system) (?:prompt|message)\b"
    r"|\bi (?:cannot|can't|will not|won'?t) (?:comply|fabricate|invent)\b"
    r"|^\s*note\s*:\s*the\s+(?:job|listing|posting|jd)\b"
    r"|\b(?:i (?:have )?)?drafted (?:only )?from the (?:legitimate|real|actual)\b",
    re.I)
# Kept for the joined-ness signal; multilingual so a da/es/zh letter is judged on
# the same footing as an English one.
_FIRST_PERSON_RX = re.compile(
    r"\b(i|i'?ve|i'?m|my|me|mine|myself"          # en
    r"|jeg|mig|min|mit|mine"                        # da
    r"|yo|mi|mis|me|conmigo)\b"                     # es
    r"|我|我的",                                     # zh
    re.I)

def _why_company_tokens(company):
    """Distinctive tokens of the employer name (>=4 chars, no legal suffixes)."""
    stop = {"group", "technologies", "technology", "solutions", "systems", "holding",
            "holdings", "international", "denmark", "sweden", "norway", "global"}
    toks = [t for t in re.sub(r"[^A-Za-z0-9]+", " ", str(company or "")).split()
            if len(t) >= 4 and t.lower() not in stop]
    return toks[:3]

def _why_defects(text, company):
    """Return a list of human-readable defects in a WHY paragraph ('' = clean)."""
    out = []
    t = str(text or "").strip()
    if not t: return out
    toks = _why_company_tokens(company)
    # naive sentence split is enough here (the section is 2-4 short sentences)
    sents = [s.strip() for s in re.split(r"(?<=[.!?])\s+", t) if s.strip()]
    for s in sents:
        names_employer = any(re.search(r"\b" + re.escape(tok), s, re.I) for tok in toks)
        # (1) recited heritage/scale fact with no candidate anchor in the sentence
        if names_employer and _WHY_RECITED_RX.search(s) and not _FIRST_PERSON_RX.search(s):
            out.append("recited employer fact: %r" % s[:90])
        # (2) hollow bridge - says nothing, fits any application
        if _WHY_BRIDGE_RX.search(s):
            out.append("hollow bridge opener: %r" % s[:70])
        # (3) model meta-commentary leaked into the letter
        if _WHY_META_RX.search(s):
            out.append("model meta-commentary in letter: %r" % s[:90])
    return out

def _cap_para_sentences(s, maxlen=280):
    """Cap a paragraph to WHOLE sentences only. _cap_para falls back to a hard
    word-cut when no sentence boundary sits inside the window, which ships a
    dangling fragment ('... to ASPICE guidelines and passed.') - the owner saw
    exactly that on 2026-07-26. Here a paragraph is trimmed to the last COMPLETE
    sentence that fits; if not even the first sentence fits, return '' so the
    caller regenerates instead of shipping a fragment."""
    t = (s or "").strip()
    if not t: return ""
    if len(t) <= maxlen: return t
    parts, buf = [], t
    sents = re.split(r"(?<=[.!?])\s+", buf)
    out = ""
    for sent in sents:
        cand = (out + " " + sent).strip() if out else sent.strip()
        if len(cand) > maxlen: break
        out = cand
    return out if out and out.rstrip().endswith((".", "!", "?")) else ""

def _why_repair(text, company, role, jd, log=None):
    """One-shot LLM repair of a defective WHY paragraph: same evidence, joined
    sentences. Returns the repaired text, or '' when repair failed/was worse."""
    try:
        import density_fit as _DF
    except Exception:
        return ""
    sys_p = ("You repair ONE cover-letter paragraph (the WHY THIS POSITION section). "
             "RULE: every sentence must JOIN the employer to the CANDIDATE inside that same sentence - "
             "the employer's activity or product is the SUBJECT and the sentence lands on the candidate's "
             "named territory (a domain, system, method or result). A sentence that only states a fact about "
             "the employer is forbidden: they know their own founding year, size, location and product line. "
             "Forbidden too: empty bridges like 'This role aligns with my background'. "
             "KEEP every concrete fact about the CANDIDATE that is already in the paragraph - reuse the same "
             "evidence, do not invent any new fact, do not add numbers. Keep it to at most 3 sentences and "
             "roughly the same length. Only plain hyphens, never em or en dashes. "
             "Return ONLY the repaired paragraph, no preamble, no quotes.")
    user = ("EMPLOYER: %s\nROLE: %s\nJOB DESCRIPTION (excerpt):\n%s\n\nPARAGRAPH TO REPAIR:\n%s"
            % (company, role, str(jd or "")[:900], text))
    body = {"model": os.environ.get("ANTCV_DENSITY_MODEL", "claude-sonnet-5"),
            "max_tokens": 500, "system": sys_p, "stream": True,
            "messages": [{"role": "user", "content": user}]}
    try:
        req = urllib.request.Request(
            _DF.PROXY + "/v1/messages", data=json.dumps(body).encode(),
            headers={"Content-Type": "application/json", "x-provider": "anthropic",
                     "User-Agent": UA, "Origin": ORIGIN, "Authorization": "Bearer " + _token()})
        with urllib.request.urlopen(req, timeout=180) as r:
            new = _DF._sse_text(r.read().decode("utf-8", "replace")).strip().strip('"')
    except Exception as e:
        if log is not None: log.append("why-repair llm error " + str(e)[:60])
        return ""
    new = sanitize_text(new)
    if not new or len(new) < 40:
        return ""
    if _why_defects(new, company):
        return ""            # repair still defective -> keep the original, flag it
    return new

def _yr(years, first=False):
    ys = re.findall(r"\b(19\d\d|20\d\d)\b", years or "")
    if ys: return int(ys[0] if first else ys[-1])
    return 0 if first else (2026 if re.search(r"present|nu\b", (years or ""), re.I) else 0)

# Same-employer adjacent roles collapse into ONE entry (title carries both, dates
# span). Preserves career breadth while cutting the role count toward <=6.
_ROLE_MERGE = [
    (["innoviz-sa", "innoviz-ccr"], "System Architect / Change Request Lead"),
    (["mepro-eng", "mepro-tl"],     "R&D Electro-Optics Engineer / Team Leader"),
    (["tau-research", "tau-teaching"], "Research & Teaching Assistant"),
]
def _merge_roles(roles):
    clusters = {}
    for ids, title in _ROLE_MERGE:
        present = [r for r in roles if r.get("id") in ids]
        if len(present) < 2: continue
        ps = sorted(present, key=lambda r: _yr(r.get("years")), reverse=True)
        head = dict(ps[0]); head["title"] = title
        starts = [_yr(p.get("years"), first=True) for p in present if _yr(p.get("years"), first=True)]
        head["years"] = f"{min(starts) if starts else _yr(ps[-1].get('years'),True)} - {max(_yr(p.get('years')) for p in present)}"
        seen, bl = set(), []
        for p in ps:
            for b in (p.get("bullets") or []):
                k = b.strip()[:40].lower()
                if k not in seen: seen.add(k); bl.append(b)
        head["bullets"] = bl
        head["results"] = next((p.get("results") for p in ps if p.get("results")), None)
        # Declare the source kernel-role ids this merged entry covers, so the
        # app's role backfill/dedup recognises it and does NOT re-add the
        # constituents (ROLE-DOUBLING fix, option b).
        head["__covers"] = [p.get("id") for p in present if p.get("id")]
        first_id = next(r.get("id") for r in roles if r.get("id") in ids)
        for r in present:
            clusters[r.get("id")] = (first_id, head if r.get("id") == first_id else None)
    out = []
    for r in roles:
        rid = r.get("id")
        if rid in clusters:
            _fid, head = clusters[rid]
            if head is not None: out.append(head)   # emit merged head once, in place
        else:
            out.append(r)
    return out

_VOL_RE = re.compile(r"forening|volunteer|frivillig|\bcouncil\b|representative|pan idr", re.I)
def _score_roles(roles, jdkw):
    scored = []
    for r in roles:
        txt = " ".join([r.get("title", ""), r.get("company", "")] + (r.get("bullets") or []) + [r.get("results") or ""])
        vol = bool(_VOL_RE.search(r.get("title", "") + " " + r.get("company", "")))
        cur = 1 if ((r.get("isCurrent") or re.search(r"present|nu\b", (r.get("years") or ""), re.I)) and not vol) else 0
        scored.append((r, _rel(txt, jdkw), cur, _yr(r.get("years"))))
    return scored

def _select_roles(roles, jdkw, keep=6):
    if len(roles) <= keep: return roles
    scored = _score_roles(roles, jdkw)
    forced = [t for t in scored if t[2]]                       # always keep the current PROFESSIONAL role
    rest = sorted([t for t in scored if not t[2]], key=lambda t: (-t[1], -t[3]))
    chosen = forced + rest[:max(0, keep - len(forced))]
    return [t[0] for t in sorted(chosen, key=lambda t: -t[3])]  # reverse-chronological

_EC_TITLE = {"en": "Earlier career", "da": "Tidligere karriere", "sv": "Tidigare karriär",
             # ROLE-CANON-LANG-001: match gold-rules.json roles.canon_titles["earlier-career"]
             "es": "Trayectoria inicial", "zh": "早期职业"}
def _earlier_career(dropped, language="en"):
    """Collapse the dropped tail roles into ONE condensed 'Earlier career' entry
    (owner: never just drop the early roles). One compact line per role. Returns
    None if there is nothing worth summarising (<2 dropped)."""
    real = [r for r in dropped if (r.get("title") or "").strip()]
    if len(real) < 2:
        return None
    ds = sorted(real, key=lambda r: -_yr(r.get("years")))       # newest-first within the block
    starts = [_yr(r.get("years"), first=True) for r in real if _yr(r.get("years"), first=True)]
    span = f"{min(starts) if starts else ''} - {max(_yr(r.get('years')) for r in real)}"
    bullets = []
    for r in ds[:4]:
        head = r.get("title", "").strip()
        co = r.get("company", "").strip()
        yr = (r.get("years") or "").strip()
        line = head + (f", {co}" if co else "") + (f" ({yr})" if yr else "")
        desc = _cap_line(r.get("results") or (r.get("bullets") or [""])[0] or "", 60)
        bullets.append(_cap_line(line + (f" - {desc}" if desc else ""), 150))
    return {"id": "earlier-career", "title": _EC_TITLE.get(language, _EC_TITLE["en"]),
            "company": "", "location": "", "years": span, "isCurrent": False, "on": True,
            "bullets": bullets, "results": None,
            # source kernel-role ids this summary covers, so the app's role
            # backfill does not re-add them (ROLE-DOUBLING fix, option b).
            "__covers": [r.get("id") for r in real if r.get("id")]}

def _is_early(r):
    """A genuinely-early role: not current and ended >=~10y ago (<=2015). A
    recent role that merely lost on relevance (e.g. current volunteering) is NOT
    'earlier career' — it just drops."""
    cur = r.get("isCurrent") or re.search(r"present|nu\b", (r.get("years") or ""), re.I)
    return (not cur) and 0 < _yr(r.get("years")) <= 2015

def _select_and_summarize(roles, jdkw, keep=6, language="en"):
    """Keep the top JD-ranked roles in full; collapse the dropped EARLY roles into
    one 'Earlier career' entry so breadth is preserved, not lost. Recent roles that
    lose on relevance just drop. Earlier career always sorts last. <=keep total."""
    if len(roles) <= keep:
        return roles
    scored = _score_roles(roles, jdkw)
    forced = [t for t in scored if t[2]]
    rest = sorted([t for t in scored if not t[2]], key=lambda t: (-t[1], -t[3]))
    # Detailed set reserves one slot for Earlier career; the early roles it leaves
    # out (relative to that SAME top-(keep-1) set) are what the summary collapses.
    detailed = forced + rest[:max(0, (keep - 1) - len(forced))]
    core_ids = {id(t[0]) for t in detailed}
    early_dropped = [t[0] for t in scored if id(t[0]) not in core_ids and _is_early(t[0])]
    ec = _earlier_career(early_dropped, language)
    if ec:
        result = [t[0] for t in detailed] + [ec]
    else:
        result = [t[0] for t in (forced + rest[:max(0, keep - len(forced))])]  # no early tail -> keep `keep` detailed
    # reverse-chronological, Earlier career pinned last
    return sorted(result[:keep], key=lambda r: (1 if r.get("id") == "earlier-career" else 0, -_yr(r.get("years"))))

def _fit_role(role, jdkw, max_bullets=3, cap=148):
    bl = role.get("bullets") or []
    order = sorted(range(len(bl)), key=lambda i: -_rel(bl[i], jdkw))[:max_bullets]
    top = [bl[i] for i in sorted(order)]                        # keep original narrative order
    res = role.get("results")
    if not res:                                                 # every role gets >=1 result
        rest = [b for b in bl if b not in top] or top or bl
        withnum = [b for b in rest if re.search(r"\d", b)]
        res = withnum[0] if withnum else (rest[0] if rest else None)
        if res in top and len(top) > 1: top = [b for b in top if b != res]
    role["bullets"] = [_cap_line(b, cap) for b in top]
    if res: role["results"] = _cap_line(res, cap)
    return role

def _filter_sidebar_block(sec, jdkw, keep_min=4, keep_max=7, protect=()):
    items = sec.get("items") or []
    isgrp = lambda it: isinstance(it, dict) and it.get("grp")
    txt = lambda it: (it.get("b", "") + " " + it.get("t", "")) if isinstance(it, dict) else str(it)
    reals = [(i, it) for i, it in enumerate(items) if not isgrp(it)]
    if len(reals) <= keep_min: return 0
    ranked = sorted(reals, key=lambda x: -_rel(txt(x[1]), jdkw))
    keep = set()
    for i, it in reals:                       # owner-pinned entries survive any cut
        if any(p.lower() in txt(it).lower() for p in protect): keep.add(i)
    for rank, (i, it) in enumerate(ranked):
        if rank < keep_min or _rel(txt(it), jdkw) > 0: keep.add(i)
        if len(keep) >= keep_max: break
    if len(keep) >= len(reals): return 0
    out, cur_grp, buf = [], None, []
    def emit():
        if buf:
            if cur_grp is not None: out.append(cur_grp)
            out.extend(buf)
    for idx, it in enumerate(items):
        if isgrp(it): emit(); cur_grp, buf = it, []
        elif idx in keep: buf.append(it)
    emit()
    sec["items"] = out
    return len(reals) - len(keep)

def compact_jd_aware(cv, cl, jd, language="en"):
    """Relevance-driven Nordic compaction (~1.75 pages): merge + JD-rank
    experience to <=6 roles (<=3 bullets + a result each, capped lines), trim
    outcomes/core, and hide sidebar detail the JD does not touch."""
    jdkw = _jd_kw(jd)
    cut = []
    for s in cv:
        sid, typ = s.get("id"), s.get("type")
        if typ == "experience" and isinstance(s.get("roles"), list):
            n0 = len(s["roles"])
            roles = _select_and_summarize(_merge_roles(s["roles"]), jdkw, keep=6, language=language)
            for r in roles:
                if r.get("id") != "earlier-career":            # keep the summary compact, verbatim
                    _fit_role(r, jdkw, max_bullets=3, cap=148)
            s["roles"] = roles
            has_ec = any(r.get("id") == "earlier-career" for r in roles)
            cut.append(f"experience {n0}->{len(roles)} roles (merged + JD-ranked{', +Earlier career' if has_ec else ''}, <=3 bullets + result)")
        elif sid == "outcomes" and isinstance(s.get("items"), list) and len(s["items"]) > 4:
            s["items"] = s["items"][:4]; cut.append("outcomes ->4")
        elif sid == "core_comp" and isinstance(s.get("rows"), list) and len(s["rows"]) > 6:
            s["rows"] = s["rows"][:6]; cut.append("core ->5")
        elif typ == "rich_block" and s.get("loc") == "sidebar" and sid in ("tools", "regulatory", "certs"):
            # BABOK-RELEVANCE-001 (owner 2026-07-13): BABOK stays for program /
            # requirement-heavy roles and enterprise-architect-related JDs.
            protect = ()
            if sid == "certs" and re.search(
                    r"program\s+manag|programme\s+manag|requirement|enterprise\s+architect|business\s+analy",
                    jd or "", re.I):
                protect = ("BABOK",)
            removed = _filter_sidebar_block(s, jdkw, protect=protect)
            if removed: cut.append(f"{sid} sidebar -{removed} JD-irrelevant")
    return cut

# Back-compat alias (older call sites); the JD-aware path is preferred.
def compact_for_nordic(cv, cl, limits=None):
    return compact_jd_aware(cv, cl, "", "en")

# ── PERSIST-SCRUB-DK-001 (owner 2026-07-12) ──────────────────────────────────
# Two persist-time corrections applied to the final section set:
#  (a) DK rows: open-ended year ranges close at 2026 — '2022 - 2026 (present)'
#      and '2023 - present' both persist as '<start> - 2026' (owner 805
#      Teledyne review: Danish rows carry closed years, no '(present)').
#  (b) Pan Idræt is an INTEREST (foreningsarbejde), not an experience role
#      (pan-idraet-placement semantic constraint): drop the role, make the
#      rugby interest line name the club. ROLE-keeping exceptions: Danish
#      public-sector (e.g. KOMBIT) and sports-tech (e.g. Trackman) employers.
_DK_JD_RE = re.compile(r"danmark|denmark|danish|dansk|københavn|copenhagen|aarhus|århus|odense|aalborg|dk-\d{4}", re.I)
_PAN_KEEP_RE = re.compile(r"trackman|sports?[ -]?tech|idræt|idraet|kombit|kommune|kommunal|styrelse|ministeri|forbund|\bdgi\b", re.I)
_PAN_RE = re.compile(r"pan idr", re.I)
_RUGBY_INTEREST = {
    "da": {"b": "Rugby & inklusiv sport", "t": "Rugbyholddrift hos Pan Idræt (foreningsarbejde), assisterende træner, bogstaveligt talt en holdspiller"},
    "en": {"b": "Rugby & inclusive sport", "t": "Rugby team operations at Pan Idræt (volunteer club work), assistant coach, literally a team player"},
}
def _dk_row(r, language):
    blob = str(r.get("company") or "") + " " + str(r.get("jd") or "")
    return language == "da" or bool(_DK_JD_RE.search(blob))

def _ensure_rugby_interest(cv, language):
    want = _RUGBY_INTEREST.get(language, _RUGBY_INTEREST["en"])
    sec = next((s for s in cv if s.get("id") == "interests" and isinstance(s.get("items"), list)), None)
    if sec is None:
        return "interests section missing (rugby line not placed)"
    for it in sec["items"]:
        if isinstance(it, dict) and _PAN_RE.search(str(it.get("b", "")) + " " + str(it.get("t", ""))):
            return None                                    # already names the club
    for it in sec["items"]:
        if isinstance(it, dict) and re.search(r"rugby", str(it.get("b", "")) + " " + str(it.get("t", "")), re.I):
            it["b"], it["t"] = want["b"], want["t"]        # upgrade the generic rugby line
            return "rugby interest line now names Pan Idræt"
    sec["items"].insert(0, {"b": want["b"], "t": want["t"], "bullets": []})
    return "rugby interest line added"

def scrub_for_persist(cv, r, language):
    notes = []
    dk = _dk_row(r, language)
    keep_pan = bool(_PAN_KEEP_RE.search(str(r.get("company") or "") + " " + str(r.get("jd") or "")))
    for s in cv:
        if s.get("type") != "experience" or not isinstance(s.get("roles"), list):
            continue
        if dk:
            for role in s["roles"]:
                y = str(role.get("years") or "")
                if y and re.search(r"present|\bnu\b|至今", y, re.I):
                    m = re.search(r"\b(19|20)\d\d\b", y)
                    role["years"] = (m.group(0) + " - 2026") if m else "2026"
                    if role["years"] != y:
                        notes.append(f"years {y!r} -> {role['years']!r}")
        if not keep_pan:
            n0 = len(s["roles"])
            s["roles"] = [x for x in s["roles"] if not _PAN_RE.search(str(x.get("company") or "") + " " + str(x.get("title") or ""))]
            if len(s["roles"]) != n0:
                notes.append("Pan Idræt role -> interest (placement rule)")
                msg = _ensure_rugby_interest(cv, language)
                if msg:
                    notes.append(msg)
    return notes

# ── MEASURE-AND-FIT: render the real PDF, count pages, tighten to budget ─────
# The AntCV way is measure-don't-guess. After JD-relevance compaction, render the
# CV through the docx-worker's /generate-pdf (CloudConvert, the SAME renderer the
# app uses) and count pages with PyMuPDF. If it overflows the page budget, tighten
# and re-render until it fits. Needs `fitz` locally + network to the docx-worker;
# if either is missing the loop is skipped (never blocks a persist).
DOCX_WORKER = os.environ.get("ANTCV_DOCX_WORKER", "https://docx-worker.karp-gabriel-a.workers.dev").rstrip("/")
try:
    import fitz  # PyMuPDF
    _HAVE_FITZ = True
except Exception:
    _HAVE_FITZ = False

def _pi_from_kernel(kernel, subtitle=""):
    idy = _asdict(kernel.get("identity")) if isinstance(kernel, dict) else {}
    return {"name": idy.get("name", ""), "email": idy.get("email", ""), "phone": idy.get("phone", ""),
            "location": idy.get("location", ""), "citizenship": idy.get("citizenship", ""),
            "linkedin": idy.get("linkedin", ""),
            "specialization": subtitle or idy.get("specialization", "")}

# BYTE-EXACT payload: run the app's OWN buildPayload (pwa/antcv-docx-client.js)
# in Node with a localStorage shim seeded from a captured settings fixture. This
# produces the identical worker payload the PWA sends (rich_block sections, the
# real style/package/gaps/sidebar_ratio/photo/item_pages), so the measured page
# count MATCHES the app's export — not an approximation. Requires: node, the
# fixture (~/.antcv/export_settings.json, captured once from a live session), and
# the docx-client module. Missing any -> byte-exact render unavailable (None).
import subprocess, tempfile, shutil
_REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_HARNESS = os.path.join(_REPO, "scripts", "job-tracker", "render_payload.mjs")
_DOCX_CLIENT_SRC = os.path.join(_REPO, "pwa", "antcv-docx-client.js")
_EXPORT_SETTINGS = os.environ.get("ANTCV_EXPORT_SETTINGS") or os.path.join(os.path.expanduser("~"), ".antcv", "export_settings.json")
_DOCX_CLIENT_MJS = None
def _docx_client_mjs():
    """Node imports ESM only from .mjs; keep a temp .mjs copy of the module."""
    global _DOCX_CLIENT_MJS
    if _DOCX_CLIENT_MJS and os.path.exists(_DOCX_CLIENT_MJS):
        return _DOCX_CLIENT_MJS
    if not os.path.exists(_DOCX_CLIENT_SRC):
        return None
    dst = os.path.join(tempfile.gettempdir(), "antcv-docx-client.mjs")
    shutil.copyfile(_DOCX_CLIENT_SRC, dst)
    _DOCX_CLIENT_MJS = dst
    return dst

def _build_payload_exact(cv, cl, pi, style_config, meta, language):
    """Return the byte-exact docx-worker payload via the Node harness, or None."""
    mjs = _docx_client_mjs()
    if not (mjs and os.path.exists(_HARNESS) and os.path.exists(_EXPORT_SETTINGS) and shutil.which("node")):
        return None
    job = {"sections": {"cv": cv, "cl": cl}, "personalInfo": pi, "styleConfig": style_config,
           "doc": "cv", "meta": meta, "language": language if language in ("en", "da", "es", "zh") else "en"}
    env = {**os.environ, "ANTCV_DOCX_CLIENT": mjs, "ANTCV_SETTINGS": _EXPORT_SETTINGS}
    try:
        p = subprocess.run(["node", _HARNESS], input=json.dumps(job).encode("utf-8"),
                           capture_output=True, timeout=60, env=env)
        if p.returncode != 0:
            print(f"   [measure] payload build failed: {p.stderr.decode('utf-8', 'replace')[:120]}")
            return None
        return json.loads(p.stdout.decode("utf-8"))
    except Exception as e:
        print(f"   [measure] payload build error ({str(e)[:80]})")
        return None

def render_cv_pages(cv, cl, pi, style_config, meta, language):
    """Byte-exact CV page count via the app's buildPayload -> /generate-pdf ->
    PyMuPDF. None if measurement is unavailable."""
    if not _HAVE_FITZ:
        return None
    payload = _build_payload_exact(cv, cl, pi, style_config, meta, language)
    if payload is None:
        return None
    try:
        data = json.dumps(payload).encode()
        req = urllib.request.Request(DOCX_WORKER + "/generate-pdf", data=data, method="POST",
                                     headers={"Content-Type": "application/json", "User-Agent": UA, "Origin": ORIGIN})
        with urllib.request.urlopen(req, timeout=150) as r:
            pdf = r.read()
        return fitz.open(stream=pdf, filetype="pdf").page_count
    except Exception as e:
        print(f"   [measure] render skipped ({str(e)[:80]})")
        return None

def _tighten_once(cv, jd, level):
    """Apply one progressively-stronger cut to bring the CV under budget."""
    jdkw = _jd_kw(jd)
    exp = next((s for s in cv if s.get("type") == "experience"), None)
    if level == 1:  # trim the sidebar harder
        for s in cv:
            if s.get("type") == "rich_block" and s.get("loc") == "sidebar" and s.get("id") in ("tools", "regulatory", "certs"):
                _filter_sidebar_block(s, jdkw, keep_min=3, keep_max=5)
        return "sidebar->5"
    if level == 2 and exp and len(exp.get("roles", [])) > 4:  # drop the lowest-ranked role
        exp["roles"] = _select_roles(exp["roles"], jdkw, keep=len(exp["roles"]) - 1)
        return f"experience->{len(exp['roles'])} roles"
    if level == 3 and exp:  # 2 bullets per role
        for r in exp["roles"]:
            r["bullets"] = (r.get("bullets") or [])[:2]
        return "bullets->2"
    if exp and len(exp.get("roles", [])) > 4:
        exp["roles"] = _select_roles(exp["roles"], jdkw, keep=len(exp["roles"]) - 1)
        return f"experience->{len(exp['roles'])} roles"
    return "none"

def _export_style_config():
    """The user's live styleConfig from the captured export-settings fixture (its
    spacing/size tokens drive pagination). Empty {} if the fixture is absent."""
    try:
        s = json.load(open(_EXPORT_SETTINGS, encoding="utf-8"))
        return json.loads(s.get("styleConfig") or "{}")
    except Exception:
        return {}

def fit_to_pages(cv, cl, jd, pi, meta, language, max_pages=2, max_iters=4):
    """Byte-exact render; if over the page budget, tighten + re-render until it
    fits. Returns (final_pages, steps)."""
    style_config = _export_style_config()
    pages = render_cv_pages(cv, cl, pi, style_config, meta, language)
    if pages is None:
        return None, []
    steps = []
    # CV-3P-UNDER-STAGE4-001: every lever below DELETES (sidebar rows, a whole
    # role, bullets->2). Compression is always the cheaper way to buy a line, so
    # the non-destructive fitter gets first refusal and the delete levers only
    # run on a CV that compression could not bring under budget. Fail-open.
    if pages > max_pages:
        try:
            import cv_fit
            cv2, rep = cv_fit.fit_cv(cv, cl, pi, style_config, meta, language, max_pages=max_pages)
            if rep.get("fitted") and cv2 is not cv:
                cv[:] = cv2
                pages = rep.get("pages") or pages
                steps.append("compress -> %dpg" % pages)
        except Exception as e:
            print(f"   [cv-fit] skipped ({str(e)[:70]})")
    it = 0
    while pages and pages > max_pages and it < max_iters:
        it += 1
        what = _tighten_once(cv, jd, it)
        if what == "none":
            break
        pages = render_cv_pages(cv, cl, pi, style_config, meta, language)
        steps.append(f"{what} -> {pages}pg")
    return pages, steps

def build_structured_sections(sk, sections, company, role, language="en", hm=""):
    """Overlay the 8 generated sections onto a copy of the me() skeleton,
    converting each into the app's native structured shape. Returns (cv, cl)."""
    cv = copy.deepcopy(sk["cv"]); cl = copy.deepcopy(sk["cl"])
    def raw(sid): return (sections.get(sid) or {}).get("result") or ""
    def txt(sid): return sanitize_text(raw(sid))
    def gen(sid):
        """Generated text for a PROSE slot, or '' if the model returned nothing,
        scaffolding, or a homogenised table (never persist those)."""
        t = txt(sid)
        return "" if (_is_scaffold(t) or _is_table_blob(t)) else t

    # profile (+ split a trailing 'Work style:' line into work_style). Empty ->
    # keep the skeleton's REAL default profile/work_style (they are real content,
    # not scaffolding), so a failed section never blanks the CV.
    prof = gen("cv_profile")
    ws = None
    if prof:
        m = re.search(r"\n\s*Work style\s*:\s*(.+)$", prof, re.I | re.S)
        if m: ws = sanitize_text(m.group(1)); prof = prof[:m.start()].strip()
    p = _ov_find(cv, "profile")
    if p and prof: p["items"] = [{"b": "", "t": prof, "bullets": []}]
    if ws:
        w = _ov_find(cv, "work_style")
        if w:
            if w.get("type") == "rich_block": w["items"] = [{"b": "", "t": ws, "bullets": []}]
            else: w["content"] = ws

    ocr = raw("cv_outcomes")
    oc = [] if (_is_scaffold(ocr) or _is_table_blob(ocr)) else _ov_outcomes(ocr)
    o = _ov_find(cv, "outcomes")
    if o and oc: o["items"] = oc   # empty -> keep skeleton's real default outcomes

    # core_comp: the skeleton default is PLACEHOLDER rows ('[Focus area 1]'),
    # so it must be filled by generation or DROPPED — never persist placeholders.
    rows = [rr for rr in _ov_table(raw("cv_core"))
            if rr and rr[0].strip().lower() != "focus area" and not any(_is_scaffold(x) for x in rr)]
    c = _ov_find(cv, "core_comp")
    if c:
        if rows:
            c["rows"] = [["Focus Area", "Strategic Expertise"]] + [[sanitize_text(x) for x in rr] for rr in rows]
        else:
            cv = [s for s in cv if s.get("id") != "core_comp"]

    def set_lead(arr, sid, text):
        s = _ov_find(arr, sid)
        if s and text:
            items = s.get("items") or [{"b": "", "t": ""}]
            items = list(items); items[0] = {**items[0], "t": text}
            s["items"] = items
    # why: capped to ~3-4 lines (owner: paragraphs too long).
    # WHY-JOINED-SENTENCE-001: gate the generated paragraph - a recited employer
    # fact or an empty bridge is repaired once, and a still-defective repair keeps
    # the original text while printing the defect (visible, never silently shipped).
    # WHY-JOINED-SENTENCE-001b: whole-sentence cap (never a dangling fragment);
    # if not even one sentence fits, fall back to the legacy cap so the section
    # is never blanked, and let the gate below flag whatever comes out.
    __why_raw = gen("cl_why_this_position")
    __why = _cap_para_sentences(__why_raw, 280) or _cap_para(__why_raw, 280)
    if __why:
        __d = _why_defects(__why, company)
        if __d:
            print("   [why-gate] defect: " + "; ".join(__d[:2]))
            __fixed = _why_repair(__why, company, role, "")
            if __fixed:
                __fixed = _cap_para(__fixed, 280)
                print("   [why-gate] repaired -> " + __fixed[:110])
                __why = __fixed
            else:
                print("   [why-gate] repair FAILED - keeping original (flag for review)")
    set_lead(cl, "why", __why)

    # who: CL-V5-STRUCT-001 - the identity block moved to the END of the letter and became
    # a lead sentence + Professional summary / How I operate / Eligibility / My goal.
    # A model that still returns one paragraph falls back to the pre-v5 single lead row.
    # CL-V5-WHO-GOAL-001 (owner 2026-07-29: "Who I am should include the goal
    # lead-in"). Saved app #2802 shipped WHO I AM as lead + Professional summary +
    # How I operate + Eligibility and NO "My goal" row. Two parser holes caused it:
    # (a) only the EXACT English label with a ':'/'-' separator matched, so "Goal:",
    # an em-dash separator, or the Danish/Swedish label were dropped; (b) every
    # UNLABELLED line after the first was discarded, so a goal sentence the model
    # wrote without its label vanished. Widen the aliases and promote a trailing
    # unlabelled line to the goal — recovery of real model output, never invention.
    WHO_LABEL_ALIASES = [
        ("Professional summary", ["professional summary", "summary", "professionel profil", "profil"]),
        ("How I operate", ["how i operate", "how i work", "sådan arbejder jeg", "arbetssätt"]),
        ("Eligibility", ["eligibility", "berettigelse", "behörighet"]),
        ("My goal", ["my goal", "goal", "mit mål", "målet", "mitt mål"]),
    ]
    wraw = gen("cl_who_i_am")
    wlead, wrows, wloose = "", [], []
    for ln in (wraw or "").splitlines():
        t = ln.strip()
        if not t or _is_scaffold(t): continue
        hit = None
        for lab, aliases in WHO_LABEL_ALIASES:
            for al in aliases:
                m = re.match(r"(?i)^[*_\s]*" + re.escape(al) + r"[*_\s]*[:\-–—]\s*(.+)$", t)
                if m: hit = (lab, m.group(1)); break
            if hit: break
        if hit:
            if not any(r["b"] == hit[0] for r in wrows):
                wrows.append({"b": hit[0], "t": _cap_line(sanitize_text(hit[1]), 170), "mk": True})
        elif not wlead:
            wlead = _cap_line(sanitize_text(t), 170)
        else:
            wloose.append(_cap_line(sanitize_text(t), 170))
    if wrows and wloose and not any(r["b"] == "My goal" for r in wrows):
        wrows.append({"b": "My goal", "t": wloose[-1], "mk": True})
    if wrows and not any(r["b"] == "My goal" for r in wrows):
        print("   [who-gate] 'My goal' row MISSING from cl_who_i_am - letter ships without it")
    # Keep the v5 row order regardless of the order the model emitted them in.
    _worder = [lab for lab, _al in WHO_LABEL_ALIASES]
    wrows.sort(key=lambda r: _worder.index(r["b"]) if r["b"] in _worder else len(_worder))
    ws_ = _ov_find(cl, "who")
    if ws_ and wrows:
        ws_["items"] = [{"b": "Who I am", "t": wlead, "bullets": []}] + wrows
        ws_["leadColon"] = True
    else:
        set_lead(cl, "who", _cap_para(wraw, 300))

    # role_view: CL-V5-STRUCT-001 - "How I see the role", the employer-NEED subsection. The
    # section may be absent from an older captured skeleton, so create it after `why`.
    rvraw = raw("cl_how_i_see_role")
    rvrows = [rr for rr in _ov_table(rvraw)
              if rr and len(rr) >= 2 and not any(_is_scaffold(x) for x in rr)][:3]
    rvintro = ""
    for ln in (rvraw or "").splitlines():
        t = ln.strip()
        if t and "|" not in t and not _is_scaffold(t):
            rvintro = _cap_line(sanitize_text(t), 130); break
    if rvrows:
        rv = _ov_find(cl, "role_view")
        if rv is None:
            rv = {"id": "role_view", "title": "HOW I SEE THE ROLE", "loc": "main", "on": True,
                  "type": "rich_block", "headlineOff": True, "leadColon": True, "items": []}
            wi = next((i for i, x in enumerate(cl) if x.get("id") == "why"), -1)
            cl.insert(wi + 1 if wi >= 0 else 0, rv)
        rv["items"] = ([{"b": "How I see the role",
                         "t": rvintro or "The work appears to centre on three connected priorities:",
                         "bullets": []}]
                       + [{"b": sanitize_text(rr[0]), "t": _cap_line(sanitize_text(rr[1]), 120), "mk": True}
                          for rr in rvrows])
        rv["on"] = True

    # CL-V5-STRUCT-001: FOUNDATION is no longer generated - its content lives in the WHO I AM
    # end-block. Hide any foundation section a pre-v5 skeleton still carries so the letter
    # does not ship the section's instructional scaffolding.
    f = _ov_find(cl, "foundation")
    if f: f["on"] = False

    # what_i_bring: a LEAD-IN line + 2-col rows -> intro item + labelled bullets.
    braw = raw("cl_what_i_bring")
    brows = [rr for rr in _ov_table(braw)
             if rr and rr[0].strip().lower() != "focus area" and not any(_is_scaffold(x) for x in rr)]
    bintro = ""
    for ln in braw.split("\n"):                       # first NO-pipe, non-scaffold line = the lead-in
        t = ln.strip()
        if t and "|" not in t and not _is_scaffold(t):
            bintro = _cap_line(sanitize_text(t), 130); break
    bs = _ov_find(cl, "bring")
    if bs and brows:
        items = [{"b": "What I bring", "t": bintro, "bullets": []}]
        bs["leadColon"] = True
        for rr in brows:
            if len(rr) >= 2: items.append({"b": sanitize_text(rr[0]), "t": _cap_line(sanitize_text(rr[1]), 100), "mk": True})
        if len(items) > 1: bs["items"] = items
    # how_i_would_contribute: LEAD-IN sentence (colon) + 3-4 action bullets + a
    # 'Goal:' line (owner: the intro line, the sentence after it, and the goal
    # lead-in were all missing). Parse each part out of the generated lines.
    # CL-V5-CONTRIB-3-CLOSE-001 (owner 2026-07-29: "How will I contribute should
    # include opening, 3 bullets and closing"). Saved app #2802 shipped a lead + TWO
    # bullets and no closing: the 'Goal:' matcher only accepted the English label with
    # a ':'/'-' separator, and any trailing prose line after the intro was discarded.
    # Cap the bullets at THREE, widen the goal matcher, and promote a trailing prose
    # line to the closing when the model wrote it without the label.
    craw = gen("cl_how_i_would_contribute")
    cs = _ov_find(cl, "contribute")
    if cs and craw:
        cintro, goal, cbul, cloose = "", "", [], []
        for ln in craw.split("\n"):
            t = ln.strip()
            if not t or t.startswith("|") or _is_scaffold(t): continue
            mg = re.match(r"(?i)^[*_\s]*(?:my\s+)?(?:goal|mål|outcome|målet)[*_\s]*[:\-–—]\s*(.+)$", t)
            if mg: goal = _cap_line(sanitize_text(mg.group(1)), 130); continue
            if re.match(r"^[-*•]\s+", t):
                cbul.append(_cap_line(sanitize_text(re.sub(r"^[-*•]\s+", "", t)), 150)); continue
            if not cintro: cintro = _cap_line(sanitize_text(t), 150)   # first prose line = the lead-in
            else: cloose.append(_cap_line(sanitize_text(t), 130))
        if not goal and cloose: goal = cloose[-1]
        cbul = cbul[:3]                                   # owner-locked: EXACTLY three bullets
        if cbul:
            items = [{"b": "How I will contribute",
                      "t": cintro or "In the first months I would focus on a few concrete priorities:", "bullets": []}]
            items += [{"b": "", "t": b, "mk": True} for b in cbul]
            # The closing is a PLAIN line (no bold label), matching the app skeleton.
            if goal: items.append({"b": "", "t": goal, "bullets": []})
            else: print("   [contrib-gate] closing 'Goal' line MISSING - letter ships without it")
            cs["items"] = items

    # Greeting: address a CAPTURED hiring manager by name (owner rule = greet only
    # a NAMED manager, in the job language); else clean JOB-language furniture.
    g = _ov_find(cl, "greeting")
    if g:
        _hm = str(hm or "").strip()
        if _hm:
            g["content"] = {"da": "Kære ", "sv": "Hej ", "en": "Dear "}.get(language, "Dear ") + _hm + ","
        else:
            g["content"] = _furn(language, "greeting", company, role)
    # Opening + closure are GENERATED; fall back to clean JOB-language furniture
    # (never the skeleton's bracket scaffolding).
    op = _ov_find(cl, "opening")
    if op:
        op_t = _cap_para(gen("cl_opening").strip(), 280) or _furn(language, "opening", company, role)
        items = op.get("items") or [{"b": "", "t": ""}]
        items = list(items); items[0] = {**items[0], "b": "", "t": op_t}
        op["items"] = items
    cz = _ov_find(cl, "closure")
    if cz:
        cz["content"] = _cap_para(gen("cl_closure").strip(), 260) or _furn(language, "closure", company, role)

    # FINAL SWEEP (defence in depth): drop any generated CL section that STILL
    # carries scaffolding (e.g. who/why/bring/contribute the model left empty),
    # and strip any residual '[...]' token from surviving text. This guarantees
    # no instructional template ('[INTRO LINE ...]') ever reaches a persisted app.
    GEN_CL = {"opening", "who", "why", "role_view", "bring", "contribute", "closure"}
    def _sec_text(s):
        if s.get("content"): return str(s["content"])
        return " ".join(str((i or {}).get("t", "")) for i in (s.get("items") or []))
    kept_cl = []
    for s in cl:
        if s.get("id") in GEN_CL and _is_scaffold(_sec_text(s)):
            continue  # drop a section left as pure scaffolding
        kept_cl.append(s)
    cl = kept_cl
    for arr in (cv, cl):
        for s in arr:
            if isinstance(s.get("content"), str) and _SCAFFOLD_RE.search(s["content"]):
                s["content"] = _strip_scaffold(s["content"])
            for i in (s.get("items") or []):
                if isinstance(i, dict) and isinstance(i.get("t"), str) and _SCAFFOLD_RE.search(i["t"]):
                    i["t"] = _strip_scaffold(i["t"])

    # CL-V5-STRUCT-001: the captured skeleton may still carry the pre-v5 order
    # (who + foundation before bring). Force the v5 sequence; unknown ids keep
    # their relative order at the tail. Mirrors pwa/antcv-nordic-cl-order-971.js.
    V5_ORDER = ["greeting", "opening", "why", "role_view", "bring",
                "contribute", "who", "foundation", "closure"]
    known = [s for sid in V5_ORDER for s in cl if s.get("id") == sid]
    cl = known + [s for s in cl if s.get("id") not in V5_ORDER]
    return cv, cl

# Standing 3-concept specialisation line (SPEC-CATCHY-001) per language — the
# clean fallback when the generated line is empty/scaffold/unusable.
_STANDING_SPEC = {"en": "Processes • Products • People",
                  "da": "Processer • Produkter • Mennesker",
                  "sv": "Processer • Produkter • Människor"}
def _format_spec(text, language):
    """Normalise a generated specialisation line to at most three ' • '-joined
    concepts in the JD language; fall back to the standing line if unusable."""
    t = sanitize_text((text or "").strip()).strip(" .\"'")
    t = re.sub(r"\s*[•·|/]\s*", " | ", t)
    t = re.sub(r"\s+[-–—]\s+", " | ", t)
    parts = [p.strip() for p in t.split("|") if p.strip() and not _is_scaffold(p)]
    if not parts:
        return _STANDING_SPEC.get(language, _STANDING_SPEC["en"])
    return " • ".join(parts[:3])
# Trailing dangling-stopword scrub for a hard-chopped slogan (shared regexes so
# the drop is a single behaviour). Keep this list in sync with the app-side
# __antcvSloganCap (pwa/app.src.js / pwa/app.js): EN + Nordic function words.
_SLOGAN_TRAIL_PUNCT_RE = re.compile(r"[\s,;:•\-–—&]+$")
_SLOGAN_TRAIL_STOP_RE = re.compile(
    r"\s+(?:and|or|nor|but|with|to|through|for|of|the|a|an|og|eller|som|både)$",
    re.I)
# SLOGAN-CAP-DANGLE-VERB-001 (owner 2026-07-15): a hard word-count chop can leave
# a dangling "pronoun + transitive verb" fragment with no object ("...I bridge",
# "...that connect", "...we deliver"). Drop it so a truncated slogan ends on a
# complete phrase. Mirrors window.__antcvSloganDeDangle (pwa/app.src.js / app.js)
# so preview == export == gen.
_SLOGAN_DANGLE_PRON = {"i", "we", "they", "he", "she", "you", "it", "that",
                       "which", "who", "whom", "jeg", "vi", "de", "man", "som", "der"}
_SLOGAN_DANGLE_STOP = {"and", "or", "nor", "but", "with", "to", "through", "for",
                       "of", "the", "a", "an", "my", "our", "your", "their", "its",
                       "his", "her", "og", "eller", "som", "både", "med", "til", "af"}
def _scrub_dangle_verb(s):
    t = _SLOGAN_TRAIL_PUNCT_RE.sub("", (s or "").strip())
    words = t.split()
    if len(words) < 6:                       # only trim a chop that keeps >=4 words
        return t
    def _n(x):
        return re.sub(r"[^\wæøåäöü]", "", x, flags=re.U).lower()
    last, prev = _n(words[-1]), _n(words[-2])
    if prev in _SLOGAN_DANGLE_PRON and last and last not in _SLOGAN_DANGLE_STOP:
        return _SLOGAN_TRAIL_PUNCT_RE.sub("", " ".join(words[:-2])).strip()
    return t
def _cap_slogan_words(t, maxw=13):
    """SLOGAN-WORD-CAP-001 (owner 2026-07-13, app 810 was 12 words and wrapped):
    a CL slogan must be <= maxw words so it never slides to a 2nd line. Prefer a
    clean clause cut (the first comma/dash/semicolon segment when it is 4..maxw
    words) over a hard word-count truncation."""
    words = t.split()
    if len(words) <= maxw:
        return t
    for sep in (",", ";", " - ", " – ", " — ", ":"):
        i = t.find(sep)
        if i > 0:
            head = t[:i].strip()
            if 4 <= len(head.split()) <= maxw:
                return _scrub_dangle_verb(head)
    # SLOGAN-WORD-CAP-DANGLE-001 (owner 2026-07-15, Anita brand-decides demo):
    # a hard word-count cut with no clause break can strand a trailing
    # conjunction/preposition ("...winter-ready and"). Drop it so the capped
    # slogan ends on a content word. Mirrors window.__antcvSloganCap so
    # preview == export.
    hard = " ".join(words[:maxw]).rstrip(",;:- ")
    hard = _SLOGAN_TRAIL_PUNCT_RE.sub("", hard)
    hard = _SLOGAN_TRAIL_STOP_RE.sub("", hard)
    return _scrub_dangle_verb(hard.strip())

# SLOGAN-UNSOL-GENERIC-001 (owner 2026-07-15): an UNSOLICITED / open application
# has no employer + no brand block, so a "value to THIS employer" slogan is
# manufactured with nothing to anchor to. Owner rule: unsolicited keeps the
# GENERIC standing default (the specialisation triad) — no tailored slogan. This
# mirrors the app's window.__ANTCV_UNSOL_RE (pwa/index.html) so both sides agree;
# category == 'unsolicited' (the relay's fallback bucket) also counts.
_UNSOL_RE = re.compile(
    r"^(unsolicited|open\s+application|n/?a|uopfordret(\s+ansøgning)?|"
    r"åben\s+ansøgning|candidatura\s+espontánea|postulación\s+espontánea|"
    r"solicitud\s+espontánea|主动申请|自荐|开放式申请|מועמדות\s+יזומה|"
    r"פנייה\s+יזומה|ያልተጠየቀ\s+ማመልከቻ|طلب\s+عفوي|تقديم\s+عفوي|طلب\s+توظيف\s+عفوي)$",
    re.I | re.U)
def _is_unsolicited(company, category=""):
    if str(category or "").strip().lower() == "unsolicited":
        return True
    c = str(company or "").strip()
    return bool(c) and bool(_UNSOL_RE.match(c))

def _format_slogan(text):
    t = sanitize_text((text or "").strip()).strip(" .\"'")
    t = (t.split("\n")[0]).strip()
    if not t or _is_scaffold(t):
        return ""
    _maxw = int(((_GOLD.get("slogan") or {}).get("max_words")) or 13)
    return _cap_slogan_words(_cap_line(t, 90), _maxw)

def persist_application(doc, r, res, category, language, kernel=None, measure=False, max_pages=2):
    """POST a real application, PUT a FULL me()-shaped section set (sidebar +
    experience + furniture) with the 8 generated sections overlaid by id/shape.
    Falls back to flat {type:text} blocks only if the skeleton fixture is
    missing (logs a warning), so a persist never crashes."""
    uk = r["uk"]
    company, role = str(r["company"]), str(r["role"])
    sk = load_skeleton()
    if sk:
        cv, cl = build_structured_sections(sk, res["sections"], company, role, language=language,
                                           hm=str(((doc.get("notes") or {}).get(uk) or {}).get("hm") or "").strip())
        # PERSIST-QUALITY-001 (owner 2026-07-13, generalized from the 808/797
        # review): certs relevance + no years + rugby-class last, FVU compress,
        # sidebar one-liner compressions, core_comp top-4 + clause-complete
        # cells, NUMERIC results from the kernel outcome pool, CL sentence
        # health (dangling enumerations, lowercase starts) — every rule on
        # every persist, LLM repairs behind the density fact gates.
        try:
            import quality_pass
            qrep = quality_pass.apply_all(cv, cl, r["jd"], kernel, language=language)
            for line in qrep:
                print("   [quality] " + line)
        except Exception as e:
            print(f"   [quality] skipped ({str(e)[:80]})")
        # Nordic-Minimal (~1.75 pages) via JD-relevance: merge + rank experience
        # to <=6 roles, hide JD-irrelevant sidebar detail. COMPACT-ALL-TIERS-001
        # (owner 2026-07-12): high tier used to skip this gate entirely and
        # persisted the full 12-role skeleton (apps 666/807-initial) — every
        # tier now compacts; the page budget is the governor, not the tier.
        if True:
            cut = compact_jd_aware(cv, cl, r["jd"], language)
            if cut: print(f"   [nordic] {'; '.join(cut)}")
            # PERSIST-SCRUB-DK-001: closed DK years + Pan Idræt placement rule.
            scrub = scrub_for_persist(cv, r, language)
            if scrub: print(f"   [scrub] {'; '.join(scrub)}")
            # MEASURE-AND-FIT: render the real PDF, tighten if it overflows the
            # page budget (measure-don't-guess; catches the outliers a char
            # heuristic misses — e.g. cmc rendered 3 pages pre-fit).
            if measure:
                _meta_m = {"subtitle": "", "role": str(r["role"]), "company": str(r["company"])}
                pages, steps = fit_to_pages(cv, cl, r["jd"], _pi_from_kernel(kernel), _meta_m, language, max_pages=max_pages)
                if pages is not None:
                    tail = (" [" + "; ".join(steps) + "]") if steps else ""
                    print(f"   [measure] CV renders {pages} page(s) (budget {max_pages}){tail}")
                # GOLD-TARGET-LAYOUT-DENSITY-001: after the page budget settles,
                # drive the SHIPPING content to line density — no runt last
                # lines (<60% fill). Runs on what fit_to_pages kept, so no LLM
                # work is wasted on content the budget then drops; its own
                # page-budget guard never trades a page for a runt.
                if pages is not None:
                    try:
                        import density_fit
                        cv2, cl2, _drep = density_fit.fit_density(
                            cv, cl, _pi_from_kernel(kernel), _export_style_config(),
                            _meta_m, language, page_budget=max_pages,
                            kernel_facts=density_fit.kernel_digest(kernel, extra=r.get("jd", "")[:1200]),
                            # speed-tier mapping (owner: fast = lower quality,
                            # faster): quick tier gets the light pass, high the
                            # full loop
                            effort=("thorough" if r.get("tier") == "high" else "balanced"))
                        cv[:], cl[:] = cv2, cl2
                        # PAGE-FLOW-DURABLE-001: after density settles, stamp
                        # page=2 on the crossing role + aligned sidebar sections
                        # so a role never splits headerless across a page (the
                        # worker's (cont.) machinery then fires). Safe: reverts
                        # to natural flow if it would create an empty half-page.
                        try:
                            cvf, _pf = density_fit.fit_page_flow(
                                cv, cl, _pi_from_kernel(kernel), _export_style_config(),
                                _meta_m, language, doc="cv")
                            cv[:] = cvf
                        except Exception as e:
                            print(f"   [page-flow] skipped ({str(e)[:70]})")
                    except Exception as e:
                        print(f"   [density] skipped ({str(e)[:80]})")
                # CL-PAGE-BUDGET-ORPHAN-001 (owner 2026-07-24 "fix CL to one
                # page"): the cover letter gets its own page budget — the v5
                # structure under the copenhagen band orphaned the sign-off
                # onto page 2 on every 2026-07-23 regen. Measured, structure-
                # safe (cl_fit levers: relevance-tail item drops + line-aware
                # gated shrinks); fail-open — an unfitted CL persists as-is
                # and is REPORTED, never blocked.
                try:
                    import cl_fit
                    cl3, _crep = cl_fit.fit_cl(cv, cl, _pi_from_kernel(kernel),
                                               _export_style_config(), _meta_m, language)
                    if _crep.get("fitted") and _crep.get("pages") == 1:
                        cl[:] = cl3
                        print(f"   [cl-fit] CL fits 1 page ({_crep.get('renders')} renders)")
                    else:
                        print(f"   [cl-fit] NOT fitted (pages={_crep.get('pages')}) — persisting as-is")
                except Exception as e:
                    print(f"   [cl-fit] skipped ({str(e)[:80]})")
        print(f"   [skeleton] overlaid: cv={len(cv)} cl={len(cl)} sections (full-fidelity)")
    else:
        print("   [skeleton] MISSING ~/.antcv/cv_skeleton.json — falling back to flat text blocks (low fidelity)")
        cv = [{"id": sid, "title": s["title"], "type": "text", "content": sanitize_text(s.get("result") or ""), "loc": "main"}
              for sid, s in res["sections"].items() if sid.startswith("cv_")]
        cl = [{"id": sid, "title": s["title"], "type": "text", "content": sanitize_text(s.get("result") or ""), "loc": "main"}
              for sid, s in res["sections"].items() if sid.startswith("cl_")]
    # Target-language header furniture: specialisation -> subtitle (app renders
    # t.subtitle before the global personalInfo.specialization); slogan -> meta.
    spec = _format_spec((res["sections"].get("cv_specialization") or {}).get("result"), language)
    slogan = _format_slogan((res["sections"].get("cl_slogan") or {}).get("result"))
    _meta = {"source": "gen-runner", "tier": r["tier"], "urlkey": uk}
    # SUBTITLE-PI-FALLBACK-001 (owner 2026-07-29 "many times also the specialization
    # line" goes missing on an Application-History load): the runner's meta was minimal
    # and carried no subtitle, so an app whose `subtitle` COLUMN also came back empty
    # (rows 2797-2800 on 2026-07-29) restored a blank specialisation line. Persist it in
    # meta too, so the record describes itself on every load path.
    if spec: _meta["subtitle"] = spec
    # SLOGAN-UNSOL-GENERIC-001: an unsolicited application keeps the GENERIC
    # standing default (the specialisation triad) — do NOT persist a tailored
    # slogan for it. The render/export side (window.__antcvResolveSlogan) then
    # falls through to io.subtitle.
    _unsol = _is_unsolicited(company, category)
    if slogan and not _unsol: _meta["slogan"] = slogan
    # BRAND-DECIDES-RESEARCH-001: persist the v2 brand record (colours + real
    # spirit/values/tone) to doc['brand'][uk], and seed the slogan PLACEMENT
    # (tagline vs opening lead-in) into the app meta so the client sets
    # antcv:clSloganMode from the SAME research the slogan TEXT was fused to.
    brand = r.get("brand")
    if isinstance(brand, dict):
        doc.setdefault("brand", {})[uk] = brand
        placement = brand.get("slogan_placement")
        if placement in ("heading", "leadin"):
            _meta["slogan_placement"] = placement
        rsr = brand.get("research") or {}
        if rsr.get("spirit") or rsr.get("values") or rsr.get("tone"):
            _meta["brand_research"] = {k: rsr.get(k) for k in ("site", "spirit", "values", "tone")}
        # BRAND-COLORS-PERSIST-001: project the AA-fitted brand palette (slots)
        # onto the app's styleConfig keys so a runner-persisted app RENDERS in the
        # employer's colours (header/sidebar band + heads + slogan/signature/
        # AI-notice inks), mirroring the app's COMPANY-BRAND-FIT-SCOPE-001 and the
        # island's BRAND-FIT-OPEN-001. The app applies meta.styleConfig on per-app
        # restore. Was: brand only recorded in doc['brand'][uk] + described in
        # text, so the persisted CV never actually rendered in brand colours.
        slots = brand.get("slots") if isinstance(brand.get("slots"), dict) else None
        # Gate on the row's brandfit toggle (same signal the island Open path uses,
        # JobTracker.tsx:739) — a captured palette is only APPLIED when the owner
        # flagged this row for employer branding; otherwise the app keeps the
        # user's global/default style. A default-fallback palette (#1d2b45) never
        # reaches styleConfig this way.
        if slots and bool((doc.get("brandfit") or {}).get(uk)):
            def _hx(v):
                v = v.strip() if isinstance(v, str) else ""
                return v if re.match(r"^#[0-9a-fA-F]{6}$", v) else None
            _sc = {}
            for _dst, _src in (
                ("headerBg", "headerBg"), ("headerInk", "headerInk"),
                ("sidebarBg", "sidebarBg"), ("sidebarInk", "sidebarInk"),
                ("sidebarHeadColor", "sidebarHeadColor"),
                ("mainHeadColor", "mainHeadColor"), ("mainSubHeadColor", "mainSubHeadColor"),
                ("mainCompanyColor", "mainCompanyColor"), ("mainYearColor", "mainYearColor"),
                ("mainTextColor", "mainTextColor"),
                ("sloganColor", "sloganColor"), ("signatureColor", "signatureColor"),
                ("aiNoticeColor", "aiNoticeColor"),
                ("photoBorderColor", "photoContourColor"), ("sidebarLineColor", "accent"),
            ):
                _v = _hx(slots.get(_src))
                if _v:
                    _sc[_dst] = _v
            if _sc:
                _meta["styleConfig"] = _sc
    c, b = _req(RELAY, "/api/applications", "POST", {
        "jd_text": r["jd"], "jd_company": str(r["company"]), "jd_role": str(r["role"]),
        "category": category, "jd_language": language, "save_as_new": True,
        "subtitle": spec, "meta": _meta,
    })
    print(f"   [lang] subtitle={spec!r} slogan={('<suppressed:unsolicited>' if (slogan and _unsol) else slogan)!r}")
    if c != 200 or not (b.get("application") or {}).get("id"):
        print(f"   persist POST failed: {c} {str(b)[:160]}"); return
    app_id = b["application"]["id"]
    c2, b2 = _req(RELAY, f"/api/applications/{app_id}", "PUT",
                  {"cv_sections": cv, "cl_sections": cl, "jd_company": str(r["company"]), "jd_role": str(r["role"])})
    print(f"   persisted application_id={app_id} (PUT {c2})")
    arts = doc.setdefault("artifacts", {})
    arts[uk] = {**(arts.get(uk) or {}), "application_id": app_id, "generated_at": int(time.time())}
    q = doc.setdefault("queue", {}); q[uk] = False

def main():
    ap = argparse.ArgumentParser(description="AntCV job-tracker headless generation runner")
    sub = ap.add_subparsers(dest="cmd")
    for name in ("list", "run"):
        p = sub.add_parser(name)
        p.add_argument("--row", action="append", help="urlkey to include (repeatable)")
        p.add_argument("--kernel-file", default=None)
        p.add_argument("--out", default=SCRATCH)
        p.add_argument("--provider", default="anthropic")
        p.add_argument("--max-high", type=int, default=5)
        p.add_argument("--max-quick", type=int, default=10)
        p.add_argument("--persist", action="store_true", help="save real applications + doc writeback")
        p.add_argument("--no-measure", dest="measure", action="store_false", help="skip the render-and-fit page-budget loop (needs PyMuPDF + docx-worker)")
        p.add_argument("--max-pages", type=int, default=2, help="CV page budget for the render-and-fit loop (default 2)")
        p.add_argument("--dry", action="store_true", help="build the plan only; no LLM calls")
        p.add_argument("--force", action="store_true", help="regenerate even rows that already have an artifact (clean re-gen with today's fixes)")
        p.add_argument("--no-research", dest="research", action="store_false", help="skip Google-CSE employer research")
        p.add_argument("--no-brand", dest="brand", action="store_false", help="skip the brand-decides site-crawl (colours + spirit/values/tone)")
    args = ap.parse_args()
    if args.cmd == "list": cmd_list(args)
    elif args.cmd == "run": cmd_run(args)
    else: ap.print_help()

if __name__ == "__main__":
    main()
