#!/usr/bin/env python3
"""company_financials.py — COMPANY-FINANCIALS-001 (owner 2026-11-05: "for each position
research the company also using financial data from Proff").

Proff's Danish figures come from the annual reports every Danish company files with
Erhvervsstyrelsen. Proff itself is NOT read: its robots.txt disallows the whole site to
anthropic-ai / ClaudeBot / Claude-Web, and reading it from an AI pipeline would get
around that opt-out. The same figures are open government data, read here directly:

  1. CVR number  - given (--cvr, doc.financials[uk].cvr, which discovery seeds from a
                   Jobnet ad's cvr), else the CVR register (free credentials from
                   Erhvervsstyrelsen in ANTCV_CVR_USER / ANTCV_CVR_PASS), else cvrapi.dk
                   (free, small daily quota), else a "CVR-nr. 12345678" in the relay's
                   web-research snippets (rare: search snippets seldom carry it).
  2. Filing      - http://distribution.virk.dk/offentliggoerelser (open Elasticsearch,
                   no key): the newest annual report (AARSRAPPORT / _ESEF) as XBRL.
  3. Facts       - revenue, gross profit, operating result, net result, equity, total
                   assets, average employees, for the report year and the year before,
                   from the undimensioned contexts of the filed period.
The XBRL entity name is compared with the company name; a mismatch is reported, so a
wrong CVR never passes silently as the employer's figures.

Output feeds gen-runner's prompt (an EMPLOYER FINANCIALS block: the figures plus the letter
angle) and the tracker doc map financials[uk] (the PWA keeps unknown top-level keys), where
`angles` holds the recruiter questions, letter angles and interview prep (FIN-ANGLES-001).

Usage:
  python company_financials.py show --name "Ibsen Photonics" [--cvr 12345678] [--json]
  python company_financials.py enrich [--uk UK] [--limit 20] [--dry]
Sweden (proff.se figures come from Bolagsverket) is not covered yet.
"""
import argparse
import datetime
import gzip
import importlib.util
import json
import os
import re
import sys
import urllib.parse
import urllib.request

VIRK_SEARCH = "http://distribution.virk.dk/offentliggoerelser/_search"
CVRAPI = "https://cvrapi.dk/api?search=%s&country=dk"
UA = "AntCV-company-research/1.0 (personal job-search tool)"
ANNUAL = ("AARSRAPPORT", "AARSRAPPORT_ESEF")
TAGS = {"revenue": ("Revenue",), "gross_profit": ("GrossProfitLoss", "GrossResult"),
        "operating_result": ("ProfitLossFromOrdinaryOperatingActivities",),
        "net_result": ("ProfitLoss",), "equity": ("Equity",), "assets": ("Assets", "LiabilitiesAndEquity"),
        "employees": ("AverageNumberOfEmployees",)}
LABELS = [("revenue", "revenue"), ("gross_profit", "gross profit"), ("operating_result", "operating result"),
          ("net_result", "net result"), ("equity", "equity"), ("assets", "total assets"), ("employees", "employees")]


def _get(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json, */*"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read()
    return gzip.decompress(raw) if raw[:2] == bytes([0x1F, 0x8B]) else raw  # regnskaber.virk.dk gzips


# ------------------------------------------------------------------ CVR lookup
_CVR_NEAR = re.compile(r"CVR[\s.\-:]*(?:nr\.?|nummer|no\.?)?[\s.:]*(\d{8})\b", re.I)


def cvr_from_text(text):
    """Every distinct CVR number written next to a 'CVR' label, in order."""
    seen = []
    for m in _CVR_NEAR.finditer(text or ""):
        if m.group(1) not in seen:
            seen.append(m.group(1))
    return seen


CVR_REGISTER = "http://distribution.virk.dk/cvr-permanent/virksomhed/_search"


def cvr_from_register(name, opener=None):
    """CVR number from Erhvervsstyrelsen's CVR register (system-to-system access: free
    credentials on request from cvrselvbetjening@erst.dk), set as ANTCV_CVR_USER /
    ANTCV_CVR_PASS. None when unset. UNVERIFIED against the live index until the
    credentials exist: the query follows the register's documented field names."""
    user, pw = os.environ.get("ANTCV_CVR_USER"), os.environ.get("ANTCV_CVR_PASS")
    if not (user and pw) or not name:
        return None
    import base64
    body = json.dumps({"_source": ["Vrvirksomhed.cvrNummer", "Vrvirksomhed.virksomhedMetadata.nyesteNavn.navn"],
                       "size": 1, "query": {"match": {"Vrvirksomhed.virksomhedMetadata.nyesteNavn.navn": {
                           "query": name, "operator": "and"}}}}).encode("utf-8")
    req = urllib.request.Request(CVR_REGISTER, data=body, headers={
        "Content-Type": "application/json", "User-Agent": UA,
        "Authorization": "Basic " + base64.b64encode(("%s:%s" % (user, pw)).encode()).decode()})
    try:
        with (opener or urllib.request.urlopen)(req, timeout=20) as r:
            hits = json.loads(r.read()).get("hits", {}).get("hits") or []
    except Exception:                                          # noqa: BLE001
        return None
    v = hits and ((hits[0].get("_source") or {}).get("Vrvirksomhed") or {}).get("cvrNummer")
    return str(v) if v else None


def cvr_from_cvrapi(name, getter=_get):
    try:
        d = json.loads(getter(CVRAPI % urllib.parse.quote(name), 15))
    except Exception:                                          # noqa: BLE001
        return None
    v = d.get("vat") if isinstance(d, dict) else None
    return str(v) if v and not d.get("error") else None


# ------------------------------------------------------------------ filings + XBRL
def latest_annual_filing(cvr, getter=_get):
    """([xml_url, ...], period_start, period_end) of the newest annual report, else None.
    A listed company files a short Danish XBRL (AARSRAPPORT) beside the ESEF one that
    carries the IFRS figures, so every annual XML of the filing is returned, ESEF first."""
    q = urllib.parse.urlencode({"q": "cvrNummer:%s AND offentliggoerelsestype:regnskab" % int(cvr),
                                "size": 12, "sort": "offentliggoerelsesTidspunkt:desc"})
    d = json.loads(getter(VIRK_SEARCH + "?" + q))
    for h in (d.get("hits") or {}).get("hits") or []:
        s = h.get("_source") or {}
        per = (s.get("regnskab") or {}).get("regnskabsperiode") or {}
        urls = [doc.get("dokumentUrl") for kind in reversed(ANNUAL) for doc in s.get("dokumenter") or []
                if doc.get("dokumentType") == kind and doc.get("dokumentMimeType") == "application/xml"]
        if urls:
            return urls, per.get("startDato"), per.get("slutDato")
    return None


_CTX = re.compile(r"<(?:[\w-]+:)?context\b[^>]*\bid=\"([^\"]+)\"[^>]*>(.*?)</(?:[\w-]+:)?context>", re.S)
_UNIT = re.compile(r"<(?:[\w-]+:)?unit\b[^>]*\bid=\"([^\"]+)\"[^>]*>(.*?)</(?:[\w-]+:)?unit>", re.S)


def _contexts(xml):
    out = {}
    for cid, body in _CTX.findall(xml):
        g = lambda t: (re.search(r"<(?:[\w-]+:)?%s>\s*([\d-]{10})" % t, body) or [None, None])[1]
        out[cid] = {"start": g("startDate"), "end": g("endDate"), "instant": g("instant"),
                    "dims": bool(re.search(r"<(?:[\w-]+:)?(?:segment|scenario)\b", body))}
    return out


def _fact(xml, local, ctxs, want):
    """Value of <prefix:local contextRef=..> whose context satisfies want(ctx)."""
    for m in re.finditer(r"<([\w.-]+):%s\b([^>]*)>\s*([-\d.]+)\s*</\1:%s>" % (local, local), xml):
        ref = re.search(r'contextRef="([^"]+)"', m.group(2))
        c = ctxs.get(ref.group(1)) if ref else None
        if c and not c["dims"] and want(c):
            unit = re.search(r'unitRef="([^"]+)"', m.group(2))
            try:
                return float(m.group(3)), unit.group(1) if unit else None
            except ValueError:
                continue
    return None, None


def parse_xbrl(xml, start, end):
    """{name, cvr, period, currency, <metric>: value, prior: {<metric>: value}}"""
    ctxs = _contexts(xml)
    units = {uid: (re.search(r"iso4217:([A-Z]{3})", body) or [None, None])[1] for uid, body in _UNIT.findall(xml)}
    try:
        prev_end = (datetime.date.fromisoformat(start) - datetime.timedelta(days=1)).isoformat() if start else None
    except ValueError:
        prev_end = None
    out = {"period": [start, end], "prior": {}}
    nm = re.search(r"<[\w.-]+:NameOfReportingEntity(?:OrOtherMeansOfIdentification)?\b[^>]*>([^<]+)<", xml)
    out["name"] = nm.group(1).strip() if nm else ""
    cv = re.search(r"<[\w.-]+:IdentificationNumberCvrOfReportingEntity\b[^>]*>\s*(\d{8})", xml)
    out["cvr"] = cv.group(1) if cv else ""
    cur = None
    for key, locals_ in TAGS.items():
        for local in locals_:
            v, u = _fact(xml, local, ctxs, lambda c: (c["end"] == end and (c["start"] == start or not start))
                         or c["instant"] == end)
            if v is not None:
                out[key] = v
                cur = cur or units.get(u)
                pv, _ = _fact(xml, local, ctxs, lambda c: (c["end"] == prev_end) or c["instant"] == prev_end)
                if pv is not None:
                    out["prior"][key] = pv
                break
    out["currency"] = cur or "DKK"
    return out


# ------------------------------------------------------------------ summary + name check
_LEGAL = re.compile(r"\b(a/s|aps|a\.m\.b\.a\.?|i/s|k/s|p/s|ivs|holding|group|gruppen|danmark|denmark|"
                    r"the|og|and|&)\b|[.,]", re.I)


def _core(name):
    return " ".join(_LEGAL.sub(" ", (name or "").lower()).split())


def name_matches(company, filed):
    a, b = _core(company), _core(filed)
    return bool(a and b and (a in b or b in a or set(a.split()) & set(b.split())))


def _money(v, cur):
    a = abs(v)
    s = "%.1fbn" % (a / 1e9) if a >= 1e9 else "%.1fm" % (a / 1e6) if a >= 1e6 else "%.0fk" % (a / 1e3) if a >= 1e3 \
        else "%.0f" % a
    return "%s %s%s" % (cur, "-" if v < 0 else "", s)


def summary(f):
    """One research line: figures, change vs the year before, source."""
    if not f or not any(k in f for k, _ in LABELS):
        return ""
    bits = []
    for key, label in LABELS:
        if key not in f:
            continue
        v, pv = f[key], f["prior"].get(key)
        fmt = (lambda x: "%d" % x) if key == "employees" else (lambda x: _money(x, f["currency"]))
        val = fmt(v)
        if pv is not None and key != "equity":
            # a % change only means something between two positive years
            val += " (%+.0f%% y/y)" % (100.0 * (v - pv) / pv) if pv > 0 and v >= 0 else " (prior year %s)" % fmt(pv)
        bits.append("%s %s" % (label, val))
    p = f.get("period") or [None, None]
    return "%s annual report %s..%s: %s. Source: Erhvervsstyrelsen filing via Virk (the figures Proff shows)." % (
        f.get("name") or "Company", p[0], p[1], "; ".join(bits))


# ------------------------------------------------------------------ angles (FIN-ANGLES-001)
# Owner 2026-11-05: "merge the financial checks to guide questions to recruiter and cover letter
# improved fit (e.g. if there are losses... how I can help to improve from various aspects),
# also relate it to the interview preparation and mock interview". Deterministic signals from
# the figures -> what to ask, which proof to lead with, what to rehearse. The letter NEVER
# quotes a loss or a weak figure: it leads with the matching proof from the kernel.
def _pct(f, key):
    v, pv = f.get(key), (f.get("prior") or {}).get(key)
    if v is None or pv in (None, 0) or pv < 0 or v < 0:
        return None
    return 100.0 * (v - pv) / pv


def signals(f):
    """[(key, plain-language fact)] read off the figures."""
    if not f:
        return []
    out, cur, prior = [], f.get("currency", "DKK"), f.get("prior") or {}
    top = "revenue" if "revenue" in f else "gross_profit" if "gross_profit" in f else None
    net, pnet = f.get("net_result"), prior.get("net_result")
    if net is not None and net < 0:
        out.append(("loss", "net loss of %s%s" % (_money(net, cur).replace(cur + " -", cur + " "),
                                                   " (second loss year)" if pnet is not None and pnet < 0 else "")))
    elif net is not None and pnet is not None and pnet < 0:
        out.append(("turnaround", "back to profit (%s after a loss of %s)" % (_money(net, cur), _money(pnet, cur))))
    g = _pct(f, top) if top else None
    if g is not None and g >= 15:
        out.append(("growth", "%s up %.0f%%" % (top.replace("_", " "), g)))
    elif g is not None and g <= -5:
        out.append(("decline", "%s down %.0f%%" % (top.replace("_", " "), -g)))
    if f.get("revenue") and f.get("operating_result") is not None and f["revenue"] > 0:
        m = 100.0 * f["operating_result"] / f["revenue"]
        if m < 3:
            out.append(("thin_margin", "operating margin %.1f%%" % m))
    eq, assets = f.get("equity"), f.get("assets")
    if eq is not None and eq < 0:
        out.append(("negative_equity", "negative equity (%s)" % _money(eq, cur)))
    elif eq is not None and assets and assets > 0 and eq / assets < 0.2:
        out.append(("low_solvency", "equity ratio %.0f%%" % (100.0 * eq / assets)))
    h = _pct(f, "employees")
    if h is not None and h >= 10:
        out.append(("hiring", "headcount %d -> %d" % (prior["employees"], f["employees"])))
    elif h is not None and h <= -10:
        out.append(("shrinking", "headcount %d -> %d" % (prior["employees"], f["employees"])))
    return out


# key -> (question for the recruiter / hiring manager, cover-letter angle, interview: what they
# may ask you, what to rehearse). None = no letter angle (a risk for the candidate to weigh).
_ANGLES = {
    "loss": ("What are the priorities for the next 12-18 months (growth, margin or both), and where does this "
             "role move the needle?",
             "Lead with proof of lowering cost, time or scrap (yield, test time, cycle time, supplier cost), from "
             "the kernel only. Frame it as supporting profitable growth; never mention the loss.",
             "How would you cut cost or time in your first six months?",
             "Two STAR stories with a cost, yield or time figure you can defend line by line."),
    "turnaround": ("The company returned to profit last year: what changed, and what keeps it there?",
                   "Lead with proof of making improvements stick: process discipline, quality systems, handovers.",
                   "How do you keep an improvement from sliding back?",
                   "One story where you made a fix permanent (procedure, test, training), not just the fix."),
    "growth": ("What breaks first as you scale: production capacity, test, supply chain or onboarding?",
               "Lead with proof of scaling: NPI ramp-up, new processes or test set-ups, onboarding others, supplier "
               "capacity.",
               "How have you handled a ramp-up or a fast-growing team?",
               "A ramp-up story with volumes or lead times, and how you onboarded people into it."),
    "decline": ("Which new products or markets carry the next growth, and how does this team support them?",
                "Lead with proof of bringing products to market faster (NPI, time-to-market, customer launches).",
                "How would you help us win new customers or launch faster?",
                "A launch story with time-to-market and the customer outcome."),
    "thin_margin": ("Where do you see the biggest margin levers: cost of goods, yield, pricing or overhead?",
                    "Lead with proof of cost-of-goods, yield or supplier savings.",
                    "Where have you found margin in a product or a process?",
                    "A story with a cost-of-goods or yield figure, and how you found it."),
    "negative_equity": ("How is the business financed for the next phase: owners, group or investors?",
                        None,
                        "Why do you want to join us at this stage?",
                        "Your honest answer on risk appetite; ask about funding in a later round."),
    "low_solvency": ("How is the next phase financed, and is the team's budget set for the year?",
                     None,
                     "Why do you want to join us at this stage?",
                     "Your honest answer on risk appetite."),
    "hiring": ("Headcount grew last year: how is the team organised, and what does onboarding look like?",
               "Lead with proof of working across new and growing teams, and of onboarding or training others.",
               "How do you get productive fast in a team that is still forming?",
               "A first-90-days story from a previous role."),
    "shrinking": ("Headcount fell last year: how has the work been reorganised, and what does this hire replace?",
                  "Lead with proof of covering a broad scope and working independently across functions.",
                  "How do you handle a broad scope with few people?",
                  "A story where you covered several roles at once and what you dropped on purpose."),
}


def angles(f):
    """{signals, questions, cl_angles, interview: {likely_questions, rehearse}} for one filing."""
    sig = signals(f)
    out = {"signals": [t for _, t in sig], "questions": [], "cl_angles": [],
           "interview": {"likely_questions": [], "rehearse": []}}
    for key, _ in sig:
        q, cl, iq, rh = _ANGLES[key]
        out["questions"].append(q)
        if cl:
            out["cl_angles"].append(cl)
        out["interview"]["likely_questions"].append(iq)
        out["interview"]["rehearse"].append(rh)
    return out


def lookup(company, cvr=None, research=None, getter=_get):
    """{cvr, cvr_source, name_ok, financials, summary} or {error}. `research(company)`
    returns web-research text to mine for a CVR (gen-runner's relay research)."""
    tried = []
    cands = [(str(cvr), "given")] if cvr else []
    if not cands:
        c = cvr_from_register(company)
        if c:
            cands.append((c, "CVR register"))
    if not cands:
        c = cvr_from_cvrapi(company, getter)
        if c:
            cands.append((c, "cvrapi.dk"))
    if not cands and research:
        cands += [(c, "web research") for c in cvr_from_text(research(company))[:3]]
    for c, src in cands:
        tried.append(c)
        try:
            fil = latest_annual_filing(c, getter)
            if not fil:
                continue
            f = {}
            for url in fil[0]:
                f = parse_xbrl(getter(url).decode("utf-8", "replace"), fil[1], fil[2])
                if any(k in f for k, _ in LABELS):
                    break
        except Exception as e:                                 # noqa: BLE001
            return {"cvr": c, "cvr_source": src, "error": "%s: %s" % (type(e).__name__, str(e)[:120])}
        ok = name_matches(company, f.get("name"))
        if not ok and src != "given" and len(cands) > 1:
            continue                                           # a snippet's CVR for another firm
        return {"cvr": c, "cvr_source": src, "name_ok": ok, "financials": f,
                "summary": summary(f) + ("" if ok else " CHECK: filed under %r, not %r." % (f.get("name"), company)),
                "angles": angles(f) if ok else angles({}),
                "fetched": datetime.date.today().isoformat()}
    return {"error": "no annual report found" + (" for CVR %s" % ", ".join(tried) if tried else
                                                 ": no CVR number (pass --cvr or set financials[uk].cvr)")}


# ------------------------------------------------------------------ tracker doc
def _gen_runner():
    here = os.path.dirname(os.path.abspath(__file__))
    spec = importlib.util.spec_from_file_location("gen_runner", os.path.join(here, "gen-runner.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def research_text(company):
    try:
        return _gen_runner().research(company, "CVR")
    except Exception:                                          # noqa: BLE001
        return ""


def enrich(doc, uks, today, research=None, getter=_get, max_age_days=90):
    """Fill doc.financials[uk] for the given rows (skip ones fetched in the last 90 days).
    -> {uk: summary or error}"""
    fin = doc.setdefault("financials", {})
    rows = {r[11]: r for r in doc.get("rows") or [] if isinstance(r, list) and len(r) > 11}
    out = {}
    for uk in uks:
        row = rows.get(uk)
        if not row:
            continue
        old = fin.get(uk) or {}
        when = old.get("fetched")
        if when and (today - datetime.date.fromisoformat(when)).days < max_age_days and old.get("summary"):
            continue
        res = lookup(row[1], cvr=old.get("cvr"), research=research, getter=getter)
        fin[uk] = dict(old, **{k: v for k, v in res.items() if k != "financials"},
                       figures={k: v for k, v in (res.get("financials") or {}).items() if k != "prior"},
                       prior=(res.get("financials") or {}).get("prior", {}))
        out[uk] = res.get("summary") or res.get("error")
    return out


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass
    ap = argparse.ArgumentParser(description="Company financials from Danish annual reports (Virk open data)")
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("show")
    s.add_argument("--name", required=True)
    s.add_argument("--cvr", default=None)
    s.add_argument("--json", action="store_true")
    s.add_argument("--no-research", action="store_true", help="skip the relay web-research CVR lookup")
    e = sub.add_parser("enrich", help="fill financials[uk] in the tracker doc for live rows")
    e.add_argument("--uk", action="append")
    e.add_argument("--limit", type=int, default=20)
    e.add_argument("--dry", action="store_true")
    a = ap.parse_args()
    if a.cmd == "show":
        res = lookup(a.name, cvr=a.cvr, research=None if a.no_research else research_text)
        print(json.dumps(res, ensure_ascii=False, indent=1) if a.json else (res.get("summary") or res.get("error")))
        sys.exit(0 if res.get("summary") else 1)
    import followups as F                                      # rev-safe doc write, shared
    today = datetime.date.today()

    def run(doc):
        live = [r[11] for r in doc.get("rows") or [] if isinstance(r, list) and len(r) > 11
                and not str(r[8]).startswith(("Archive", "Rejected"))]
        uks = (a.uk or live)[: a.limit]
        return enrich(doc, uks, today, research=research_text)
    if a.dry:
        _, doc = F.get_doc()
        res = run(doc)
    else:
        res = F._write(run)
    for uk, line in (res or {}).items():
        print("%s: %s" % (uk, line))
    print("%d row(s) %s" % (len(res or {}), "checked (dry, nothing written)" if a.dry else "updated"))


if __name__ == "__main__":
    main()
