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
import os, sys, json, time, argparse, urllib.request, urllib.error, re, copy

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

def _req(base, path, method="GET", body=None, timeout=120):
    data = json.dumps(body).encode() if body is not None else None
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

# ── row eligibility ────────────────────────────────────────────────
def row_uk(row):  return row[11] if len(row) > 11 and row[11] else (str(row[1]) + "|" + str(row[2]))

def eligible_rows(doc, only=None):
    """Rows to generate: queue truthy OR (queue undefined AND no artifact),
    AND jd >200 chars, AND no CV/CL artifact yet. Honour tier from gen[uk]."""
    rows = doc.get("rows") or []
    jd = doc.get("jd") or {}; queue = doc.get("queue") or {}
    gen = doc.get("gen") or {}; arts = doc.get("artifacts") or {}
    out = []
    for row in rows:
        uk = row_uk(row)
        if only and uk not in only:
            continue
        a = arts.get(uk) or {}
        has_art = bool(a.get("cv_export_url") or a.get("application_id"))
        jd_ok = len((jd.get(uk) or "")) > 200
        q = queue.get(uk)
        want = bool(q) or (q is None and not has_art)
        if only:  # explicit selection bypasses the queue flag, still needs a JD
            want = True
        if want and jd_ok and not has_art:
            out.append({
                "uk": uk, "rank": row[0], "company": row[1], "role": row[2],
                "tier": gen.get(uk) or "quick", "jd": jd.get(uk) or "",
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
    if rhas("product manager", "product owner", "product / project", "produkt"): return "product_management"
    if rhas("project manager", "programme manager", "program manager", "project steering", "head of project", "projektleder"): return "program_management"
    if rhas("data scientist", "data analyst", "data engineer", "analytics engineer", "business intelligence"): return "data_analytics"
    if rhas("scientist", "phd", "postdoc", "researcher"): return "research_phd"
    if rhas("software", "developer", "backend", "frontend", "full stack", "full-stack"): return "engineering_software"
    if rhas("manufacturing", "operations", "supply"): return "operations"
    # quality/audit/regulatory titles are operations even when they say 'engineer'
    if rhas("quality", "auditor", "audit", "regulatory", "compliance"): return "operations"
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

# ── section plan ───────────────────────────────────────────────────
# Each section: an Anthropic /v1/messages body. The user turn carries the
# profile + JD + signals + the section ask (trigger words match
# prompt-augment.js's detectCVTask so the belts fire). system stays lean;
# the proxy PREPENDS its task frame + anti-fabrication + banned list.
CV_SECTIONS = [
    ("cv_profile",          "PROFILE",           "Write the CV PROFILE section (2-3 tight sentences + optional 'Work style:' clause) for this candidate résumé."),
    ("cv_outcomes",         "SELECTED OUTCOMES", "Generate the CV SELECTED OUTCOMES section: 5-6 verb-led outcomes, each with a bold lead and a body. Return one per line as 'LEAD / body'."),
    ("cv_core",             "CORE COMPETENCIES", "Generate the CV CORE COMPETENCIES table: 6 rows, each 'Focus Area | Strategic Expertise'. Backward-looking, role-independent."),
]
CL_SECTIONS = [
    ("cl_opening",          "Opening",           "Write the COVER LETTER OPENING line (1-2 first-person sentences): a specific, engaging hook that names the role and gives a genuine, concrete reason this candidate is drawn to it - NOT a flat 'I am applying for the X position at Y'. Calm professional register, no filler, no greeting line, no name."),
    ("cl_who_i_am",         "WHO I AM",          "Write the COVER LETTER WHO I AM section (2-4 first-person sentences)."),
    ("cl_what_i_bring",     "WHAT I BRING",      "Generate the COVER LETTER WHAT I BRING table (4-6 rows 'Focus Area | Strategic Expertise'), forward-looking, focus areas drawn from THIS job description."),
    ("cl_why_this_position","WHY THIS POSITION", "Write the COVER LETTER WHY THIS POSITION section (2-4 sentences specific to this role and company)."),
    ("cl_how_i_would_contribute","HOW I WOULD CONTRIBUTE","Write the COVER LETTER HOW I WOULD CONTRIBUTE section (3-6 verb-led bullets)."),
    ("cl_foundation",       "FOUNDATION",        "Write the COVER LETTER FOUNDATION section: two short paragraphs labelled 'Hands-on:' and 'Professionally:'."),
    ("cl_closure",          "Closure",           "Write the COVER LETTER CLOSURE (1-2 first-person sentences): a warm, confident sign-off that INVITES a conversation and points at the concrete value the candidate would bring to THIS employer. Do NOT restate why the candidate is drawn to the role (the opening already does that); focus on the invitation and the value. Not generic boilerplate. No 'Sincerely'/signature line, no name."),
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
        lines.append("Company: " + str(meta.get("company", "")) + "  |  Role: " + str(meta.get("role", "")))
        lines.append(meta["jd"][:14000])
        lines.append("")
    if meta.get("signals"):
        lines.append("=== ADDITIONAL SIGNALS (owner-supplied framing; subordinate) ===")
        lines.append(str(meta["signals"])[:2500]); lines.append("")
    if meta.get("support"):
        lines.append("=== ROLE INTEL (needs / bring / signals; subordinate) ===")
        lines.append(json.dumps(meta["support"])[:2500]); lines.append("")
    if meta.get("research"):
        lines.append("=== RECENT WEB RESEARCH on the employer (Google CSE; SUBORDINATE — may be dated, verify; NEVER a source of the candidate's identity/history) ===")
        lines.append(str(meta["research"])[:2500]); lines.append("")
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
                "system": "You write precise, factual CV and cover-letter sections in a calm Danish-toned professional register. No hype, no filler, no banned words.",
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
    view = None
    skipped_coh = False
    for _ in range(max_steps):
        c, view = _req(PROXY, "/job/step", "POST", {"job_id": jid})
        if c != 200:
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
BANNED_SAMPLE = ["spearhead", "leverage", "robust", "passionate", "committed",
                 "cutting-edge", "world-class", "results-driven", "—", "–"]
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
    t = t.replace("—", "-").replace("–", "-")
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
    rows = eligible_rows(doc, only)
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
    results_index = []
    for r in todo:
        uk = r["uk"]
        language = detect_language(r["jd"])
        rsch = research(r["company"], r["role"]) if getattr(args, "research", True) else ""
        if rsch: print("   research: %d findings" % len(rsch.splitlines()))
        meta = {"company": r["company"], "role": r["role"], "jd": r["jd"],
                "signals": signals.get(uk), "support": support.get(uk),
                "research": rsch, "language": language}
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
        res = drive(sections, prov, model,
                    source_cv=json.dumps(profile, ensure_ascii=False)[:38000], jd_text=r["jd"],
                    skip_coherence=(r["tier"] != "high"))
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
            persist_application(doc, r, res, guess_category(r["role"], r["jd"]), language)
    idx_path = os.path.join(args.out, "index.json")
    json.dump(results_index, open(idx_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"\nindex -> {idx_path}")
    if args.persist:
        # re-fetch + writeback the doc rev-safe (artifacts were mutated in place)
        rev2, cur = get_doc()
        cur["artifacts"] = {**(cur.get("artifacts") or {}), **(doc.get("artifacts") or {})}
        cur["queue"] = {**(cur.get("queue") or {}), **(doc.get("queue") or {})}
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
    rows = []
    for ln in (md or "").split("\n"):
        ln = ln.strip()
        if not ln.startswith("|"): continue
        cells = [c.strip() for c in ln.strip("|").split("|")]
        if all(set(c) <= set("-: ") for c in cells): continue  # separator
        rows.append(cells)
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

# Nordic-Minimal compaction targets (~1.5-2 pages). Trims the verbose MAIN-column
# blocks; leaves the short sidebar furniture intact. Tunable; logs what it cut
# (NORDIC-COMPACT-001, 2026-07-12 — owner: the persisted batch ran 3-5 pages).
_NORDIC = {"exp_roles": 4, "exp_bullets": 3, "richblock_items": 6,
           "outcomes": 4, "core_rows": 5}
def compact_for_nordic(cv, cl, limits=None):
    lim = {**_NORDIC, **(limits or {})}
    cut = []
    for s in cv:
        sid, typ = s.get("id"), s.get("type")
        if typ == "experience" and isinstance(s.get("roles"), list):
            if len(s["roles"]) > lim["exp_roles"]:
                cut.append(f"experience roles {len(s['roles'])}->{lim['exp_roles']}")
                s["roles"] = s["roles"][:lim["exp_roles"]]
            for role in s["roles"]:
                b = role.get("bullets")
                if isinstance(b, list) and len(b) > lim["exp_bullets"]:
                    role["bullets"] = b[:lim["exp_bullets"]]
        elif sid == "outcomes" and isinstance(s.get("items"), list) and len(s["items"]) > lim["outcomes"]:
            cut.append(f"outcomes {len(s['items'])}->{lim['outcomes']}"); s["items"] = s["items"][:lim["outcomes"]]
        elif sid == "core_comp" and isinstance(s.get("rows"), list) and len(s["rows"]) > lim["core_rows"] + 1:
            cut.append(f"core_comp rows {len(s['rows'])-1}->{lim['core_rows']}"); s["rows"] = s["rows"][:lim["core_rows"] + 1]
        elif typ == "rich_block" and isinstance(s.get("items"), list):
            # count only real items (skip group headers); items may be dicts or
            # plain strings (e.g. certs). Cap the visible items, keep group headers.
            def _isgrp(i): return isinstance(i, dict) and i.get("grp")
            reals = [i for i in s["items"] if not _isgrp(i)]
            if len(reals) > lim["richblock_items"]:
                kept, seen = [], 0
                for i in s["items"]:
                    if _isgrp(i): kept.append(i); continue
                    if seen < lim["richblock_items"]: kept.append(i); seen += 1
                cut.append(f"{sid} items {len(reals)}->{lim['richblock_items']}"); s["items"] = kept
    return cut

def build_structured_sections(sk, sections, company, role, language="en"):
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
    set_lead(cl, "who", gen("cl_who_i_am"))
    set_lead(cl, "why", gen("cl_why_this_position"))

    ho, pro, intro = _ov_foundation(raw("cl_foundation"))
    ho = "" if _is_scaffold(ho) else ho; pro = "" if _is_scaffold(pro) else pro
    f = _ov_find(cl, "foundation")
    if f and (ho or pro):
        items = [{"b": "Foundation", "t": intro or "I connect what I do best with the outcomes this employer is after.", "bullets": []}]
        if ho: items.append({"b": "Hands-on", "t": ho, "mk": True})
        if pro: items.append({"b": "Professionally", "t": pro, "mk": True})
        f["items"] = items

    # what_i_bring: a 2-col table -> labelled bullets.
    brows = [rr for rr in _ov_table(raw("cl_what_i_bring"))
             if rr and rr[0].strip().lower() != "focus area" and not any(_is_scaffold(x) for x in rr)]
    bs = _ov_find(cl, "bring")
    if bs and brows:
        items = [{"b": "What I bring", "t": "", "bullets": []}]
        for rr in brows:
            if len(rr) >= 2: items.append({"b": sanitize_text(rr[0]), "t": sanitize_text(rr[1]), "mk": True})
        if len(items) > 1: bs["items"] = items
    # how_i_would_contribute: a BULLET list (its prompt asks for 3-6 verb-led
    # bullets, NOT a table) -> labelled bullets. Parsing it as a table (the old
    # behaviour) silently dropped every real bullet run.
    contrib = gen("cl_how_i_would_contribute")
    cs = _ov_find(cl, "contribute")
    if cs and contrib:
        blines = [re.sub(r"^[-*•]\s+", "", ln).strip() for ln in contrib.split("\n")
                  if ln.strip() and not ln.strip().startswith("|")]
        blines = [sanitize_text(b) for b in blines if b and not _is_scaffold(b)]
        if blines:
            items = [{"b": "How I would contribute", "t": "", "bullets": []}]
            items += [{"b": "", "t": b, "mk": True} for b in blines]
            cs["items"] = items

    # Greeting: clean, JOB-language furniture (no hiring-manager name captured;
    # owner rule = greet only a named manager).
    g = _ov_find(cl, "greeting")
    if g: g["content"] = _furn(language, "greeting", company, role)
    # Opening + closure are GENERATED; fall back to clean JOB-language furniture
    # (never the skeleton's bracket scaffolding).
    op = _ov_find(cl, "opening")
    if op:
        op_t = gen("cl_opening").strip() or _furn(language, "opening", company, role)
        items = op.get("items") or [{"b": "", "t": ""}]
        items = list(items); items[0] = {**items[0], "b": "", "t": op_t}
        op["items"] = items
    cz = _ov_find(cl, "closure")
    if cz:
        cz["content"] = gen("cl_closure").strip() or _furn(language, "closure", company, role)

    # FINAL SWEEP (defence in depth): drop any generated CL section that STILL
    # carries scaffolding (e.g. who/why/bring/contribute the model left empty),
    # and strip any residual '[...]' token from surviving text. This guarantees
    # no instructional template ('[INTRO LINE ...]') ever reaches a persisted app.
    GEN_CL = {"opening", "who", "why", "bring", "contribute", "foundation", "closure"}
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
    return cv, cl

def persist_application(doc, r, res, category, language):
    """POST a real application, PUT a FULL me()-shaped section set (sidebar +
    experience + furniture) with the 8 generated sections overlaid by id/shape.
    Falls back to flat {type:text} blocks only if the skeleton fixture is
    missing (logs a warning), so a persist never crashes."""
    uk = r["uk"]
    company, role = str(r["company"]), str(r["role"])
    sk = load_skeleton()
    if sk:
        cv, cl = build_structured_sections(sk, res["sections"], company, role, language=language)
        # Nordic-Minimal length: the full skeleton runs 3-5 pages; compact the
        # verbose main-column blocks to ~1.5-2 pages (quick tier == Nordic).
        if r["tier"] != "high":
            cut = compact_for_nordic(cv, cl)
            if cut: print(f"   [nordic] compacted: {', '.join(cut)}")
        print(f"   [skeleton] overlaid: cv={len(cv)} cl={len(cl)} sections (full-fidelity)")
    else:
        print("   [skeleton] MISSING ~/.antcv/cv_skeleton.json — falling back to flat text blocks (low fidelity)")
        cv = [{"id": sid, "title": s["title"], "type": "text", "content": sanitize_text(s.get("result") or ""), "loc": "main"}
              for sid, s in res["sections"].items() if sid.startswith("cv_")]
        cl = [{"id": sid, "title": s["title"], "type": "text", "content": sanitize_text(s.get("result") or ""), "loc": "main"}
              for sid, s in res["sections"].items() if sid.startswith("cl_")]
    c, b = _req(RELAY, "/api/applications", "POST", {
        "jd_text": r["jd"], "jd_company": str(r["company"]), "jd_role": str(r["role"]),
        "category": category, "jd_language": language, "save_as_new": True,
        "meta": {"source": "gen-runner", "tier": r["tier"], "urlkey": uk},
    })
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
        p.add_argument("--dry", action="store_true", help="build the plan only; no LLM calls")
        p.add_argument("--no-research", dest="research", action="store_false", help="skip Google-CSE employer research")
    args = ap.parse_args()
    if args.cmd == "list": cmd_list(args)
    elif args.cmd == "run": cmd_run(args)
    else: ap.print_help()

if __name__ == "__main__":
    main()
