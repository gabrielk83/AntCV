#!/usr/bin/env python3
"""discover-positions.py — safe persistence half of the position-discovery task.

The AGENT does the judgment (web-search against the Dream Envelope, vet fit,
extract company/role/location/url, optionally the JD). This script does only the
DETERMINISTIC, SAFE part: dedup, append PROPOSED rows to the job-tracker doc, and
maintain a "discovered" ledger so a lead is never re-proposed after the owner
deletes or ignores it.

HARD SAFETY INVARIANTS (never auto-apply, never auto-generate):
  - Every proposed row gets queue[uk]=False. The gen nightly's gate is
    `bool(q) or (q is None and not has_art)` — an explicit False is NOT truthy
    and NOT None, so a proposed row is INELIGIBLE until the owner flips the ⏰
    flag (queue=True) in the UI. (Verified against gen-runner.eligible_rows.)
  - No application is created, no CV/CL is generated, nothing is submitted.
  - Rows land in group "Proposed" with flag "🔎" so they are visually separate.

Commands:
  context                       -> print existing companies/roles/urls + ledger
                                   keys (feed the agent so it does not re-search
                                   what is already tracked or already proposed)
  add --candidates <file.json>  -> file is a JSON list of objects:
      {company, role, location, url, why, fit?, jd?, tier?}
    Appends the non-duplicate ones as Proposed rows, updates the ledger, PUTs
    the doc rev-safe (re-fetch+merge+retry on 409). Prints what was added/skipped.

Auth: ~/.antcv/token (the PWA JWT). Requests send a browser User-Agent (CF 403s
the default python UA) and Origin https://antcv.pages.dev .
"""
import argparse
import datetime
import json
import os
import re
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import deadlines  # noqa: E402  DEADLINE-RELEVANCE-001

RELAY = os.environ.get("ANTCV_RELAY", "https://antcv-access-relay.karp-gabriel-a.workers.dev").rstrip("/")
_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"

# Fit tier -> band hex, matching the JobTracker island TIERS map exactly:
#   T1 DDEBF7 strong direct fit (EO / photonics / optical-systems, open+reachable)
#   T2 E2EFDA transferable / PM-side envelope fit, a step away  (DEFAULT)
#   T3 FCE4D6 weak / off-domain — apply only if pivoting (or conditional far-DK)
# The agent assigns fit_tier per the Dream Envelope; unknown -> T2.
_TIER_BAND = {"T1": "DDEBF7", "T2": "E2EFDA", "T3": "FCE4D6"}


def _token():
    p = os.path.expanduser("~/.antcv/token")
    if not os.path.exists(p):
        sys.exit("NO TOKEN at ~/.antcv/token — owner must re-save it from the PWA console.")
    return open(p, encoding="utf-8").read().strip()


# JT-PUT-SLOW-UPLINK-001 (job-tracker nightly 2026-10-30): the job-tracker doc
# is ~1.4 MB and this host's uplink measured 17-33 KB/s. Since Python 3.5 the
# socket timeout bounds the WHOLE sendall, so a fixed timeout lost two sweeps'
# verdicts at the PUT ('The write operation timed out'). A request body now gets
# at least len(body) / 10 KB/s seconds; GETs and small bodies keep the floor.
_UPLINK_FLOOR_BPS = 10 * 1024


def _body_timeout(data, timeout):
    return max(timeout, len(data) / _UPLINK_FLOOR_BPS) if data else timeout

def _req(path, method="GET", body=None, timeout=60):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(RELAY + path, data=data, method=method, headers={
        "Authorization": "Bearer " + _token(), "User-Agent": _UA,
        "Origin": "https://antcv.pages.dev", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(r, timeout=_body_timeout(data, timeout)) as resp:
            return resp.status, json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, {"error": e.read().decode()[:300]}


def get_doc():
    c, b = _req("/api/job-tracker")
    if c != 200:
        sys.exit(f"job-tracker GET failed: {c} {str(b)[:200]}")
    return b.get("rev"), (b.get("doc") or {})


# DISCOVER-URLKEY-QUERY-001 (2026-10-16): query parameters that CARRY the ad's
# identity. HR-Manager (Talentech) addresses every ad as
# ApplicationInit.aspx?cid=…&ProjectId=…, SuccessFactors as career?…&career_job_req_id=…,
# Greenhouse as ?gh_jid=…, Indeed as viewjob?jk=…; dropping the whole query gave every
# such ad on a host ONE ledger key, so the second ad ever proposed was skipped as a
# duplicate (FMI / Teknisk projektleder, 2026-10-15). Tracking and channel
# parameters (utm_*, MediaId, DepartmentId, ref, source) stay OUT of the key so the same
# ad reached through two channels still collapses to one key.
_ID_QUERY_KEYS = frozenset({
    "id", "cid", "projectid", "jobid", "job_id", "jobreqid", "job_req_id",
    "career_job_req_id", "reqid", "req_id", "requisitionid", "requisition_id",
    "jk", "gh_jid", "vacancyid", "vacancy_id", "positionid", "position_id",
    "postingid", "posting_id", "jobnumber", "jobno", "adid", "ad_id", "offerid",
    "offer_id", "advertid", "advert_id", "npostingtargetid",
})


def _norm_url(u):
    u = (u or "").strip().lower()
    u = re.sub(r"^https?://(www\.)?", "", u)
    u = u.split("#")[0]
    path, _, query = u.partition("?")
    path = path.rstrip("/")
    keep = []
    for part in query.split("&"):
        k, _, v = part.partition("=")
        if v and k in _ID_QUERY_KEYS:
            keep.append(k + "=" + v)
    # A URL with no identifying parameter keys exactly as before (path only), so
    # every ledger key written before this change still matches.
    return path + ("?" + "&".join(sorted(keep)) if keep else "")


def _norm_cr(company, role):
    def n(s):
        return re.sub(r"[^a-z0-9]+", "", (s or "").lower())
    return n(company) + "|" + n(role)


def _slug(company, existing):
    base = re.sub(r"[^a-z0-9]+", "_", (company or "job").lower()).strip("_")[:20] or "job"
    uk = base
    i = 2
    while uk in existing:
        uk = f"{base}_{i}"
        i += 1
    return uk


def _existing_keys(doc):
    """Every dedup key already represented: existing-row url/company|role AND the
    ledger. A lead matching any of these is skipped."""
    rows = doc.get("rows") or []
    urls = doc.get("urls") or {}
    keys = set()
    uks = set()
    for row in rows:
        uk = row[11] if len(row) > 11 and row[11] else (str(row[1]) + "|" + str(row[2]))
        uks.add(uk)
        keys.add(_norm_cr(row[1] if len(row) > 1 else "", row[2] if len(row) > 2 else ""))
    for u in urls.values():
        if u:
            keys.add(_norm_url(u))
    for k, v in (doc.get("discovered") or {}).items():
        keys.add(k)
        # A ledger entry written before DISCOVER-URLKEY-QUERY-001 holds a path-only
        # key for a query-addressed ad; its stored url re-keys it under the new rule.
        u = (v or {}).get("url") if isinstance(v, dict) else None
        if u:
            keys.add(_norm_url(u))
    return keys, uks


# DISCOVERY-EVIDENCE-GATE-001 (owner 2026-11-01). The Dream Envelope's work-task row
# scores "AI workflow / training / governance" tasks, so discovery proposed ~50 AI-adoption,
# AI-trainer, AI-governance, newsroom, webshop and banking-product roles that the owner then
# had to close by hand ("Tryg AI trainer? no fit", "DSB weird fit", "website manager - not
# relevant"). The envelope stays the owner's; this gate decides what may be PROPOSED.
EVIDENCE_GATE_TEXT = """\
## EVIDENCE GATE (owner 2026-11-01) - read before proposing anything
A role is proposed ONLY when its core work sits in Gabriel's track record:
  optics / photonics / electro-optics / lasers / fibre; camera, imaging, LiDAR, thermal,
  radar or other sensors; hardware system architecture and systems engineering; technical
  or hardware project / product management of PHYSICAL or deep-tech products (medtech,
  defence, photonics, semiconductor, instruments, consumer hardware); NPI, test,
  validation and qualification; requirements and change control in regulated hardware.
The envelope's work-task count NEVER qualifies a role on its own. An AI-workflow /
digital role qualifies when the posting NEEDS (or lists as nice-to-have) serious product
management, business analysis, supplier / vendor control, or hardware (owner rule,
2026-11-01). Without one of those it is a no-fit, however many envelope tasks it ticks.
Do NOT propose: AI adoption / enablement / governance / trainer / strategist / consultant
roles; GenAI-build / chatbot roles; webshop, MarTech, website, content or newsroom roles;
commercial / sales-led product roles without engineering ownership - unless the posting
carries one of the four qualifiers above.
Also do NOT propose (owner 2026-11-01, round 2; GATE-002):
  - banking, insurance, pension, payments or consumer-telecom employers (Nykredit, Danske
    Bank, Nordea, Ikano Bank, Mastercard, YouSee ...), whatever the product-management
    content. Investment / infrastructure funds such as CIP are NOT banks and stay allowed.
  - construction-product roles that want a building-industry background (VELUX).
  - medtech roles where medical-device experience is a MUST. Read the full posting: propose
    only when it says "or another regulated industry", nice-to-have, an advantage, or nothing.
  - roles that want a building-automation / installation background (CTS/BMS, KNX, installer
    or system integrator; Lemvigh-Mueller, owner 2026-11-01).
  - public-sector IT business-analyst roles with no hardware or product-engineering core
    (STIL exam systems, owner 2026-11-01), and roles whose pay sits below the envelope floor.
  - any posting whose application deadline is TODAY or earlier (DEADLINE-RELEVANCE-001: the
    owner reads a same-day deadline as passed). Put the deadline in "jd" so add() can see it.
A jobindex.dk ad is a teaser: open it, follow the link to the employer's or recruiter's own
posting, and pass THAT full text as "jd". A jobindex url with a teaser-length jd is skipped.
add() enforces the obvious cases deterministically (see _evidence_gate)."""

# Title families that are a no-fit UNLESS the posting shows a qualifier (below).
_NO_CORE = re.compile(
    r"\bAI[- ](?:trainer|adoption|enablement|governance|engagement|strateg\w*|consult\w*|"
    r"innovation|track)\b|ai-?konsulent|"
    r"generative ai|\bgenai\b|chatbot|prompt engineer|deployment strategist|"
    r"webshop|e-?commerce|martech|website|web manager|\bseo\b|newsroom|redaktionel|"
    r"enablement program|learning partner|governance specialist", re.I)
# The owner's four qualifiers: serious product management, business analysis,
# supplier / vendor control, hardware (and the engineering track it implies).
_QUALIFIER = re.compile(
    r"product manag\w*|product owner|business analy\w*|forretningsanaly\w*|"
    r"supplier|vendor|leverandør|procurement|sourcing|"
    r"hardware|optic|photon|laser|fib(?:er|re)|sensor|camera|imaging|lidar|radar|electro|"
    r"mechanic|mechatron|embedded|firmware|system(?:s)? (?:architect|engineer|designer)|"
    r"medical device|medtech|endoscop|scanner|semiconductor|wafer|\bnpi\b|"
    r"new product introduction|test engineer|qualification|defen[cs]e|electronic warfare", re.I)
# Web / MarTech platform roles hide behind neutral titles ("Digital Product Specialist").
_WEB_BODY = re.compile(r"webshop|martech|\bcdp\b|e-?commerce|website", re.I)
_HW_ONLY = re.compile(r"hardware|optic|photon|laser|sensor|camera|imaging|electro|mechanic|"
                      r"embedded|firmware|medical device|semiconductor|\bnpi\b", re.I)


# GATE-002 (owner 2026-11-01): employer families that are a no-fit whatever the role says.
_FINANCE_TELCO = re.compile(
    r"\bbank\b|bankdata|nykredit|danske bank|nordea|ikano|jyske|sydbank|spar nord|"
    r"arbejdernes landsbank|saxo bank|\blunar\b|mastercard|\bvisa\b|\bnets\b|\bnexi\b|"
    r"forsikring|insurance|\btryg\b|topdanmark|alm\.? brand|\bcodan\b|\bpfa\b|danica|"
    r"pension|realkredit|totalkredit|\byousee\b|\btelia\b|telenor|\bhi3g\b|\b3 danmark", re.I)
_CONSTRUCTION_CO = re.compile(r"\bvelux\b", re.I)
_CONSTRUCTION_NEED = re.compile(
    r"(?:background|experience|erfaring|baggrund)\s+(?:\w+\s+){0,3}(?:in|from|within|fra|i|med|inden for)\s+"
    r"(?:the\s+)?(?:construction|building(?:\s+materials)?|bygge\w*)|"
    r"(?:construction|building)\s+industry\s+(?:background|experience)", re.I)
# Medical-must: one sentence carrying a medical-experience term, an experience word and a
# must marker, with no soft marker. "or another regulated industry" / nice-to-have pass.
_MED_TERM = re.compile(r"medical[- ]device|medtech|medico|medical industry|medicinsk udstyr|"
                       r"iso 13485|iec 62304|\b(?:eu )?mdr\b|21 cfr 820|life[- ]science", re.I)
_EXP_WORD = re.compile(r"experience|background|track record|knowledge|years|erfaring|baggrund|"
                       r"kendskab|\bår\b", re.I)
_MUST = re.compile(r"required|requirement|\bmust\b|essential|mandatory|minimum|at least|"
                   r"\d+\+?\s*years|necessary|\bkrav\b|skal have|forudsætning|nødvendig", re.I)
_SOFT = re.compile(r"or (?:an)?other regulated|or (?:a )?similar(?:ly)? regulated|regulated industr|"
                   r"nice[- ]to[- ]have|advantage|a plus|\bbonus\b|preferabl|ideally|desir|might|"
                   r"\bfordel\b|gerne|\bor\b[^.]{0,40}\b(?:automotive|aerospace|defen[cs]e)", re.I)
_JOBINDEX = re.compile(r"(?:^|//|\.)jobindex\.dk/", re.I)
# GATE-003 (owner 2026-11-01, Lemvigh-Mueller): a background in building automation / installation is a
# building-industry background too.
_BUILDING_AUTOMATION_NEED = re.compile(
    r"(?:erfaring|baggrund|experience|background)[^.\n]{0,90}(?:bygningsautomation|bygningsstyring|"
    r"bygningssystem|building automation|building management system|\bCTS\b|\bBMS\b|\bKNX\b|"
    r"installat(?:ør|or|ion)|systemintegrator)", re.I)
# GATE-003 (owner 2026-11-01, STIL): a public-sector IT business-analyst seat with no hardware core.
_BA_TITLE = re.compile(r"forretningsanalytiker|business analyst|it-analytiker", re.I)
_PUBLIC = re.compile(r"styrelse|ministeri|kommune|\bregion\b|forvaltning|agency|\bSTIL\b", re.I)
_BELOW_FLOOR = re.compile(r"below (?:the )?(?:\d+k )?floor|under (?:the )?(?:\d+k )?floor|below (?:the )?envelope", re.I)
JOBINDEX_MIN_JD = 600


def _medical_must(text):
    """The first sentence that makes medical-device experience a must, else None."""
    for sent in re.split(r"[.;\n•]+", text or ""):
        if _MED_TERM.search(sent) and _EXP_WORD.search(sent) and _MUST.search(sent) \
                and not _SOFT.search(sent):
            return sent.strip()[:90]
    return None


def _evidence_gate(c):
    """Reason string when a candidate is an obvious no-fit, else None.
    A role fails when its TITLE is in a no-core family AND nothing in title/why/fit/jd
    shows a hardware / optics / systems / engineering-product core. Override only with
    {"override_gate": true, "override_reason": "..."}, recorded on the row."""
    if c.get("override_gate") and str(c.get("override_reason") or "").strip():
        return None
    title = str(c.get("role") or "")
    body = " ".join(str(c.get(k) or "") for k in ("role", "why", "fit", "jd"))
    if _NO_CORE.search(title) and not _QUALIFIER.search(body):
        return ("evidence gate: %r is an AI-adoption/web role family with no product-management, "
                "business-analysis, supplier or hardware need" % title[:60])
    if re.search(r"\bdigital\b", title, re.I) and _WEB_BODY.search(body) and not _HW_ONLY.search(body):
        return "evidence gate: %r is a web / MarTech platform role with no hardware core" % title[:60]
    company = str(c.get("company") or "")
    if _FINANCE_TELCO.search(company):
        return ("evidence gate: %r is a banking / insurance / payments / consumer-telecom employer "
                "(owner: not relevant)" % company[:50])
    if _CONSTRUCTION_CO.search(company) or _CONSTRUCTION_NEED.search(body):
        return "evidence gate: construction-product role that wants a building-industry background"
    med = _medical_must(str(c.get("jd") or "") + "\n" + str(c.get("fit") or ""))
    if med:
        return "evidence gate: medical-device experience is a must (%r)" % med
    if _BUILDING_AUTOMATION_NEED.search(body):
        return "evidence gate: wants a building-automation / installation background (owner: building industry)"
    if _BA_TITLE.search(title) and _PUBLIC.search(company + " " + title) and not _HW_ONLY.search(body):
        return "evidence gate: public-sector IT business-analyst role with no hardware core (owner: STIL)"
    if _BELOW_FLOOR.search(str(c.get("why") or "") + " " + str(c.get("fit") or "")):
        return "evidence gate: pay noted below the envelope floor"
    dl = deadlines.find_deadline(str(c.get("jd") or ""))
    if deadlines.is_past(dl):
        return "evidence gate: application deadline %s has passed (today counts as passed)" % dl.isoformat()
    if _JOBINDEX.search(str(c.get("url") or "")) and len(str(c.get("jd") or "").strip()) < JOBINDEX_MIN_JD:
        return ("evidence gate: jobindex teaser only - follow the ad to the employer's or recruiter's "
                "posting and pass its full text as jd")
    return None


def cmd_context(_):
    _, doc = get_doc()
    rows = doc.get("rows") or []
    urls = doc.get("urls") or {}
    led = doc.get("discovered") or {}
    print(EVIDENCE_GATE_TEXT)
    nofit = [r for r in rows if str(r[8] if len(r) > 8 else "").startswith("Archive / not a fit")]
    if nofit:
        print("## closed as NOT A FIT by the owner - do not propose similar roles:")
        for r in nofit:
            print(f"  - {r[1]} | {r[2]}")
    print(f"# tracker has {len(rows)} rows, {len(led)} discovered-ledger keys")
    print("## already tracked (company | role | location):")
    for row in rows:
        loc = row[3] if len(row) > 3 else ""
        print(f"  - {row[1]} | {row[2]} | {loc}")
    print("## posting URLs already tracked:")
    for u in urls.values():
        if u:
            print(f"  - {u}")
    print("## discovered-ledger keys (already proposed once; do NOT re-propose):")
    for k, v in led.items():
        print(f"  - {k}  ({(v or {}).get('first_seen','?')})")


def cmd_add(args):
    cands = json.load(open(args.candidates, encoding="utf-8"))
    if not isinstance(cands, list):
        sys.exit("--candidates must be a JSON list")
    today = datetime.date.today().isoformat()
    added, skipped = [], []

    for attempt in range(4):
        rev, doc = get_doc()
        doc.setdefault("rows", [])
        doc.setdefault("urls", {})
        doc.setdefault("jd", {})
        doc.setdefault("queue", {})
        doc.setdefault("gen", {})
        doc.setdefault("discovered", {})
        keys, uks = _existing_keys(doc)
        added, skipped = [], []
        ranks = [row[0] for row in doc["rows"] if isinstance(row[0], (int, float))]
        next_rank = (max(ranks) + 1) if ranks else 1

        for c in cands:
            company = str(c.get("company") or "").strip()
            role = str(c.get("role") or "").strip()
            url = str(c.get("url") or "").strip()
            if not company or not role:
                skipped.append((company or url or "?", "missing company/role"))
                continue
            gate = _evidence_gate(c)
            if gate:
                skipped.append((f"{company} / {role}", gate))
                continue
            ck_url = _norm_url(url) if url else None
            ck_cr = _norm_cr(company, role)
            if (ck_url and ck_url in keys) or ck_cr in keys:
                skipped.append((f"{company} / {role}", "duplicate/already-proposed"))
                continue
            uk = _slug(company, uks)
            uks.add(uk)
            loc = str(c.get("location") or "").strip()
            fit = str(c.get("fit") or "").strip()
            why = str(c.get("why") or "").strip()
            jd = str(c.get("jd") or "").strip()
            band = _TIER_BAND.get(str(c.get("fit_tier") or "").upper().strip(), _TIER_BAND["T2"])
            # row schema: [rank,company,role,location,commute,group,fit,posting,
            #              tracked,next,flag,urlkey,band] — matches the app's own
            #              addRow shape (JobTracker.tsx). band (index 12) is a
            #              SEMANTIC TIER colour (DDEBF7=T1/E2EFDA=T2/FCE4D6=T3),
            #              NOT a free fill: the discovery agent's envelope-fit
            #              judgment sets it so a proposed lead is tier-QUALIFIED on
            #              arrival (feeds fitPercent + Top-5 candidacy) — same as a
            #              manual add. Proposed-ness shows via group "Proposed" +
            #              the 🔎 flag + a non-closed "Identified" tracked status,
            #              so the lead stays LIVE (Top-5-eligible), never archived.
            flag = ("🔎 " + why) if why else "🔎 proposed (auto-discovered)"
            if c.get("override_gate"):
                flag += "\n⚠ evidence gate overridden: " + str(c.get("override_reason") or "")[:200]
            doc["rows"].append([
                next_rank, company, role, loc, "", "Proposed", fit, "OPEN",
                "Identified (posting saved)", "Review", flag, uk, band])
            next_rank += 1
            if url:
                doc["urls"][uk] = url
            if len(jd) > 200:
                doc["jd"][uk] = jd            # stored, but NEVER auto-generated:
            doc["queue"][uk] = False          # <-- the hard safety gate
            if c.get("tier"):
                doc["gen"][uk] = str(c["tier"])
            ledkey = ck_url or ck_cr
            doc["discovered"][ledkey] = {"first_seen": today, "uk": uk,
                                         "company": company, "role": role, "url": url,
                                         "why": str(c.get("why") or "")[:300]}
            keys.add(ledkey)
            if ck_url:
                keys.add(ck_url)
            keys.add(ck_cr)
            added.append((f"{company} / {role}", uk, "jd" if len(jd) > 200 else "url-only"))

        if not added:
            break
        c, b = put_doc(doc, rev)
        if c == 200:
            break
        if c == 409:
            print(f"  409 (rev moved to {b.get('rev')}), re-merging (attempt {attempt+1})…")
            continue
        sys.exit(f"PUT failed: {c} {str(b)[:200]}")

    print(f"\nADDED {len(added)} proposed row(s):")
    for name, uk, mode in added:
        print(f"  + {name}  [{uk}, {mode}, queue=False]")
    print(f"SKIPPED {len(skipped)}:")
    for name, why in skipped:
        print(f"  - {name}  ({why})")
    # machine-readable tail for the agent's report
    print("\nJSON " + json.dumps({"added": len(added), "skipped": len(skipped),
                                  "added_rows": [{"name": n, "uk": u} for n, u, _ in added]}))


def put_doc(doc, base_rev):
    return _req("/api/job-tracker", "PUT", {"doc": doc, "base_rev": base_rev})


def main():
    # JOBSRC-STDOUT-ENCODING-001: `context` prints every tracked company and role.
    # Redirected on Windows that is cp1252, and a name outside cp1252 raises. Pin it.
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("context").set_defaults(fn=cmd_context)
    a = sub.add_parser("add")
    a.add_argument("--candidates", required=True)
    a.set_defaults(fn=cmd_add)
    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
