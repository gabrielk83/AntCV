#!/usr/bin/env python3
"""job_sources.py — JOBSRC-FETCH-001.

Deterministic listing fetchers for the two mandatory discovery sources whose
search pages a generic HTML-to-markdown fetch CANNOT read:

  jobindex.dk  the /jobsoegning result page paints its ads client-side, so a
               plain fetch returns nav chrome and zero ads. The site DOES expose
               the same result set as a fully server-rendered RSS feed at
               /jobsoegning.rss?q=... — that is what we read.
  jobbank.dk   there is no /en/job-search endpoint (404). The real search path is
               /job/?soegeord=... , and its rows are NOT <a href> links: each ad
               is a div.job-item whose destination lives in an inline
               onclick="document.location.href='/job/<id>/<slug>/<slug>/'".
               A link scrape finds nothing; we parse the onclick.

Both were reported unreadable by the 2026-08-26 position-discovery run. Encoding
matters on both hosts: jobindex declares ISO-8859-1 in the XML prolog, and
jobbank sends a UTF-8 Content-Type header while actually serving cp1252 — so we
sniff rather than trust the header.

Usage:
  python scripts/job-tracker/job_sources.py search --q "produktchef"
  python scripts/job-tracker/job_sources.py search --q "product manager" \
      --source jobbank --limit 40 --json

Output rows: {source, title, company, location, url, posted, deadline}.
Network-free unit test: scripts/job-tracker/test_job_sources.py
"""
import argparse
import datetime
import html
import json
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
       "(KHTML, like Gecko) Chrome/124 Safari/537.36")

JOBINDEX_RSS = "https://www.jobindex.dk/jobsoegning.rss?q={q}"
JOBBANK_SEARCH = "https://www.jobbank.dk/job/?soegeord={q}"


def _decode(raw: bytes) -> str:
    """Sniff the real charset. jobbank advertises UTF-8 but serves cp1252, and
    jobindex serves ISO-8859-1; trusting the header mojibakes every Danish
    letter, which then breaks company-name matching downstream."""
    for enc in ("utf-8", "cp1252", "iso-8859-1"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", "replace")


def fetch(url: str, timeout: int = 45) -> str:
    req = urllib.request.Request(url, headers={
        "User-Agent": _UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "da,en;q=0.8",
    })
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return _decode(resp.read())


def _text(s: str) -> str:
    """Strip tags, unescape entities, collapse whitespace."""
    s = re.sub(r"<[^>]+>", " ", s or "")
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def _dk_date(s: str):
    """'07.09.2026' / '07-09-2026' -> date. None if unparseable."""
    m = re.search(r"(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})", s or "")
    if not m:
        return None
    try:
        return datetime.date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
    except ValueError:
        return None


# --------------------------------------------------------------------- jobindex

def parse_jobindex_rss(xml_text: str) -> list:
    """RSS <item> -> rows. The <title> is 'Role, Company' (company last, after the
    final comma); location and date live in the HTML-escaped <description>."""
    out = []
    # The prolog may declare ISO-8859-1 while the str we hold is already decoded;
    # strip it so ElementTree does not try to re-decode a str.
    body = re.sub(r"^\s*<\?xml[^>]*\?>", "", xml_text).strip()
    try:
        root = ET.fromstring(body)
    except ET.ParseError as e:
        raise ValueError("jobindex RSS did not parse: %s" % e)
    for item in root.iter("item"):
        title = _text(item.findtext("title") or "")
        link = (item.findtext("link") or "").strip()
        if not title or not link:
            continue
        desc = _text(item.findtext("description") or "")
        company, role = "", title
        if "," in title:
            role, company = title.rsplit(",", 1)
            role, company = role.strip(), company.strip()
        pub = (item.findtext("pubDate") or "").strip()
        out.append({
            "source": "jobindex", "title": role, "company": company,
            "location": _jobindex_location(desc), "url": link,
            "posted": pub, "deadline": "",
        })
    return out


def _jobindex_location(desc: str) -> str:
    """The description carries the ad teaser with the place name in front of the
    prose. Match a KNOWN place plus at most one qualifier token (so "København S"
    survives but the sentence after it does not bleed in). Best-effort — an empty
    string is fine, the agent verifies location on the posting itself."""
    m = re.search(r"\b(København|Copenhagen|Frederiksberg|Aarhus|Odense|Aalborg|"
                  r"Lyngby|Ballerup|Herlev|Glostrup|Hillerød|Roskilde|Birkerød|"
                  r"Farum|Taastrup|Hørsholm|Søborg|Brøndby|Malmö|Lund)"
                  r"(\s+(?:[SNVØK]|SV|NV|SØ|NØ|C|Kommune))?\b", desc)
    return (m.group(1) + (m.group(2) or "")).strip() if m else ""


def search_jobindex(q: str, limit: int = 50) -> list:
    return parse_jobindex_rss(fetch(JOBINDEX_RSS.format(q=urllib.parse.quote(q))))[:limit]


# --------------------------------------------------------------------- jobbank

_JOBBANK_ITEM = re.compile(
    r'<div\s+name="(?P<id>\d+)"\s+class="job-item".*?(?=<div\s+name="\d+"\s+class="job-item"|\Z)',
    re.S)
_JOBBANK_HREF = re.compile(r"document\.location\.href='(?P<href>/job/\d+/[^']*)'")


def _class_text(block: str, cls: str) -> str:
    m = re.search(r'<[^>]+class="[^"]*\b' + re.escape(cls) + r'\b[^"]*"[^>]*>(.*?)</',
                  block, re.S)
    return _text(m.group(1)) if m else ""


def parse_jobbank_html(html_text: str) -> list:
    """div.job-item blocks -> rows. The destination is in an inline onclick, not
    an href; the teaser reads 'Fuldtidsjob hos <Company>, <locations>'."""
    out = []
    seen = set()
    for m in _JOBBANK_ITEM.finditer(html_text):
        block = m.group(0)
        job_id = m.group("id")
        if job_id in seen:
            continue
        href = _JOBBANK_HREF.search(block)
        if not href:
            continue
        seen.add(job_id)
        teaser = _class_text(block, "job-teaser")
        company, location = "", ""
        # Teasers vary: "Fuldtidsjob hos X, <places>" but also
        # "Fuldtidsjob | Graduate/trainee hos X, <places>". Cut at the LAST
        # " hos " so every job-type prefix is discarded, not just the first.
        t = teaser.rsplit(" hos ", 1)[-1].strip() if " hos " in teaser else teaser
        if t:
            parts = [p.strip() for p in t.split(",") if p.strip()]
            if parts:
                company = parts[0]
                location = ", ".join(parts[1:])
        out.append({
            "source": "jobbank", "title": _class_text(block, "job-header"),
            "company": company, "location": location,
            "url": urllib.parse.urljoin("https://www.jobbank.dk/", href.group("href")),
            "posted": _class_text(block, "job-date-updated").replace("Opdateret:", "").strip(),
            "deadline": _class_text(block, "job-date-application").replace("Frist:", "").strip(),
        })
    return out


def search_jobbank(q: str, limit: int = 50) -> list:
    return parse_jobbank_html(fetch(JOBBANK_SEARCH.format(q=urllib.parse.quote(q))))[:limit]


# ------------------------------------------------------------------------ cli

SOURCES = {"jobindex": search_jobindex, "jobbank": search_jobbank}


def cmd_search(args):
    names = list(SOURCES) if args.source == "all" else [args.source]
    rows, errs = [], []
    for name in names:
        try:
            rows.extend(SOURCES[name](args.q, args.limit))
        except Exception as e:                                  # noqa: BLE001
            errs.append("%s: %s: %s" % (name, type(e).__name__, e))
    # Drop ads whose stated deadline has already passed — they are obsolete on
    # arrival and must never reach the proposal step (POSTING-OBSOLETE-001).
    today = datetime.date.today()
    live = []
    for r in rows:
        d = _dk_date(r.get("deadline", ""))
        if d and d < today:
            continue
        live.append(r)
    if args.json:
        print(json.dumps({"rows": live, "dropped_expired": len(rows) - len(live),
                          "errors": errs}, ensure_ascii=False, indent=1))
        return
    for r in live:
        bits = [r["title"] or "(no title)", r["company"], r["location"]]
        print(" | ".join(b for b in bits if b))
        print("    " + r["url"] + (("   frist " + r["deadline"]) if r["deadline"] else ""))
    print("\n%d live ad(s); %d dropped (deadline passed)" % (live and len(live) or 0,
                                                             len(rows) - len(live)))
    for e in errs:
        print("ERROR " + e)
    if errs and not live:
        sys.exit(1)


def main():
    ap = argparse.ArgumentParser(description="Fetch listings from jobindex.dk / jobbank.dk")
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("search")
    s.add_argument("--q", required=True)
    s.add_argument("--source", default="all", choices=["all", "jobindex", "jobbank"])
    s.add_argument("--limit", type=int, default=50)
    s.add_argument("--json", action="store_true")
    s.set_defaults(fn=cmd_search)
    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
