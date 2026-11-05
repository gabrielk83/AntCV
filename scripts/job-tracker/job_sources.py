#!/usr/bin/env python3
"""job_sources.py — JOBSRC-FETCH-001.

Deterministic listing fetchers for the two mandatory discovery sources whose
search pages a generic HTML-to-markdown fetch CANNOT read:

  jobindex.dk  the /jobsoegning result page paints its ads client-side, so a
               plain fetch returns nav chrome and zero ads. The site DOES expose
               the same result set as a fully server-rendered RSS feed at
               /jobsoegning.rss?q=... — that is what we read.
  jobbank.dk   there is no /en/job-search endpoint (404). The real search path is
               /job/?key=... (soegeord= is now ignored), and its rows are NOT <a href> links: each ad
               is a div.job-item whose destination lives in an inline
               onclick="document.location.href='/job/<id>/<slug>/<slug>/'".
               A link scrape finds nothing; we parse the onclick. Since
               JOBSRC-UPSTREAM-001 the RSS feed /job/rss/?key= (100 items, same
               teaser text) is read first and the onclick scrape is the fallback.

Both were reported unreadable by the 2026-08-26 position-discovery run. Encoding
matters on both hosts: jobindex declares ISO-8859-1 in the XML prolog, and
jobbank sends a UTF-8 Content-Type header while actually serving cp1252 — so we
sniff rather than trust the header.

JOBSRC-UPSTREAM-001 (2026-11-05, from the ai-job-search review) added three public
sources and the fetch hygiene below:
  jobnet.dk      the STAR portal's own JSON API (/bff/FindJob/Search). It answers
                 without a login when the request carries `x-csrf: 1` (the Duende
                 BFF anti-forgery header); every other path, robots.txt included,
                 307s to the login page, which is why it was dropped on 2026-10-15.
  freehire.me    keyless JSON API pooling ~50 ATS platforms (Workday, Greenhouse,
                 Emply, hr-manager, ...) plus jobnet/jobindex/thehub. Covers the
                 employer career sites nothing else here reads. One-person service,
                 no SLA: an extra source, never the only one.
  jobdanmark.dk  keyless JSON search API (POST /api/jobsearch/search/<page>).
Fetch: 20 s timeout, two retries on 429/5xx/transport errors with backoff that
honours Retry-After, and a robots.txt gate (wildcard-aware) on every public source.

Usage:
  python scripts/job-tracker/job_sources.py search --q "produktchef"
  python scripts/job-tracker/job_sources.py search --q "product manager" \
      --source jobbank --limit 40 --json
  python scripts/job-tracker/job_sources.py health          # JOBSRC-HEALTH-001

Output rows: {source, title, company, location, url, posted, deadline}; freehire
rows also carry `via` (the board or ATS freehire read it from), jobnet rows `cvr`
(the employer's CVR number; pass it to discover-positions add as "cvr").
Network-free unit test: scripts/job-tracker/test_job_sources.py
"""
import argparse
import datetime
import email.utils
import os
import html
import json
import random
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
       "(KHTML, like Gecko) Chrome/124 Safari/537.36")

JOBINDEX_RSS = "https://www.jobindex.dk/jobsoegning.rss?q={q}"
# key=, NOT soegeord=: since ~2026-09 jobbank ignores soegeord and returns the same
# unfiltered 20 ads for every query (JOBSRC-JOBBANK-PARAM-001, register row 111).
JOBBANK_SEARCH = "https://www.jobbank.dk/job/?key={q}"


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


# ------------------------------------------------------------------ fetch hygiene
# JOBSRC-UPSTREAM-001: one request per query stays the rule; a 429/5xx or a transport
# reset gets two retries (2 s, 6 s + jitter, or the server's Retry-After when longer).
# A Retry-After past RETRY_CAP_S fails the source fast instead of stalling the run.
RETRY_WAITS = (2.0, 6.0)
RETRY_CAP_S = 30.0
_sleep = time.sleep


class RobotsDisallowed(RuntimeError):
    pass


def _retry_after_s(value):
    """Retry-After as seconds (delta-seconds or an HTTP-date); None when unreadable."""
    v = (value or "").strip()
    if not v:
        return None
    if v.isdigit():
        return float(v)
    try:
        when = email.utils.parsedate_to_datetime(v)
    except (TypeError, ValueError):
        return None
    if when is None:
        return None
    now = datetime.datetime.now(when.tzinfo or datetime.timezone.utc)
    return max((when - now).total_seconds(), 0.0)


def _robots_regex(path_rule: str):
    """Google robots semantics: '*' = any run of chars, a trailing '$' anchors the end."""
    anchored = path_rule.endswith("$")
    body = path_rule[:-1] if anchored else path_rule
    return re.compile("".join(".*" if ch == "*" else re.escape(ch) for ch in body)
                      + ("$" if anchored else ""))


def parse_robots(text: str, agent: str = "antcv") -> list:
    """Rules [(allow, path_rule)] for the group naming `agent`, else the '*' group.
    Python's urllib.robotparser ignores '*' inside paths, so it would read
    'Disallow: /jobsoegning*q=ofir' as a literal prefix and allow what it bans."""
    groups, agents, rules, in_rules = [], [], [], False
    for raw in (text or "").splitlines():
        line = raw.split("#", 1)[0].strip()
        if ":" not in line:
            continue
        key, val = (s.strip() for s in line.split(":", 1))
        key = key.lower()
        if key == "user-agent":
            if in_rules:
                groups.append((agents, rules))
                agents, rules, in_rules = [], [], False
            agents.append(val.lower())
        elif key in ("allow", "disallow") and agents:
            in_rules = True
            if val:                                   # an empty Disallow allows everything
                rules.append((key == "allow", val))
    if agents:
        groups.append((agents, rules))
    for want in (agent.lower(), "*"):
        for names, rs in groups:
            if want in names:
                return rs
    return []


def robots_allows(rules: list, path: str) -> bool:
    """Longest matching rule wins; on a tie Allow wins; no match = allowed."""
    best_len, allowed = -1, True
    for allow, rule in rules:
        if _robots_regex(rule).match(path):
            n = len(rule)
            if n > best_len or (n == best_len and allow):
                best_len, allowed = n, allow
    return allowed


_ROBOTS = {}


def _robots_rules_for(host: str) -> list:
    if host not in _ROBOTS:
        try:
            text = _http("https://%s/robots.txt" % host, timeout=15, retries=False)
        except Exception:                                      # noqa: BLE001
            text = ""                                          # unreachable robots.txt = no rules
        # A robots.txt that redirects to an HTML login page (jobnet.dk) carries no rules.
        _ROBOTS[host] = [] if "<html" in text[:500].lower() else parse_robots(text)
    return _ROBOTS[host]


def check_robots(url: str):
    p = urllib.parse.urlsplit(url)
    path = (p.path or "/") + ("?" + p.query if p.query else "")
    if not robots_allows(_robots_rules_for(p.netloc.lower()), path):
        raise RobotsDisallowed("robots.txt disallows %s" % url)


def _http(url: str, timeout: int = 20, data=None, headers=None, retries=True) -> str:
    h = {"User-Agent": _UA,
         "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
         "Accept-Language": "da,en;q=0.8"}
    h.update(headers or {})
    waits = RETRY_WAITS if retries else ()
    for attempt in range(len(waits) + 1):
        req = urllib.request.Request(url, data=data, headers=h)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return _decode(resp.read())
        except urllib.error.HTTPError as e:
            if e.code != 429 and e.code < 500 or attempt == len(waits):
                raise
            ra = _retry_after_s(e.headers.get("Retry-After") if e.headers else None)
            if ra is not None and ra > RETRY_CAP_S:
                raise
            wait = max(waits[attempt] + random.uniform(0, 0.5), ra or 0.0)
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            if attempt == len(waits):
                raise
            wait = waits[attempt] + random.uniform(0, 0.5)
        _sleep(wait)
    raise RuntimeError("unreachable")                          # pragma: no cover


def fetch(url: str, timeout: int = 20, data=None, headers=None, robots=True) -> str:
    """GET (or POST when `data` is given) a public source, behind the robots.txt gate."""
    if robots:
        check_robots(url)
    return _http(url, timeout=timeout, data=data, headers=headers)


def _text(s: str) -> str:
    """Strip tags, unescape entities, collapse whitespace."""
    s = re.sub(r"<[^>]+>", " ", s or "")
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def _dk_date(s: str):
    """'07.09.2026' / '07-09-2026' / ISO '2026-09-07' -> date. None if unparseable."""
    iso = re.search(r"\b(\d{4})-(\d{2})-(\d{2})\b", s or "")
    if iso:
        try:
            return datetime.date(int(iso.group(1)), int(iso.group(2)), int(iso.group(3)))
        except ValueError:
            return None
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
        # Teasers vary: "Fuldtidsjob hos X, <places>" but also
        # "Fuldtidsjob | Graduate/trainee hos X, <places>". Cut at the LAST
        # " hos " so every job-type prefix is discarded, not just the first.
        company, location = _jobbank_teaser(_class_text(block, "job-teaser"))
        out.append({
            "source": "jobbank", "title": _class_text(block, "job-header"),
            "company": company, "location": location,
            "url": urllib.parse.urljoin("https://www.jobbank.dk/", href.group("href")),
            "posted": _class_text(block, "job-date-updated").replace("Opdateret:", "").strip(),
            "deadline": _class_text(block, "job-date-application").replace("Frist:", "").strip(),
        })
    return out


JOBBANK_RSS = "https://jobbank.dk/job/rss/?key={q}"   # no trailing slash = a 301 first
_JOBBANK_FRIST = re.compile(r"\(\s*(?:Ansøgningsfrist|Ansoegningsfrist|Frist)\s*:\s*([^)]*)\)", re.I)


def _jobbank_teaser(teaser: str):
    """'Fuldtidsjob | Graduate/trainee hos X, <places>' -> (company, location)."""
    t = teaser.rsplit(" hos ", 1)[-1].strip() if " hos " in teaser else teaser
    parts = [p.strip() for p in t.split(",") if p.strip()]
    return (parts[0], ", ".join(parts[1:])) if parts else ("", "")


def parse_jobbank_rss(xml_text: str) -> list:
    """RSS <item> -> rows. The <description> is the same teaser as the HTML list
    plus '(Ansøgningsfrist: dd.mm.yyyy)'."""
    body = re.sub(r"^\s*<\?xml[^>]*\?>", "", xml_text).strip()
    try:
        root = ET.fromstring(body)
    except ET.ParseError as e:
        raise ValueError("jobbank RSS did not parse: %s" % e)
    out = []
    for item in root.iter("item"):
        title = _text(item.findtext("title") or "")
        link = (item.findtext("link") or "").strip()
        if not title or not link:
            continue
        desc = _text(item.findtext("description") or "")
        m = _JOBBANK_FRIST.search(desc)
        deadline = m.group(1).strip() if m else ""
        company, location = _jobbank_teaser(_JOBBANK_FRIST.sub("", desc).strip())
        out.append({"source": "jobbank", "title": title, "company": company,
                    "location": location, "url": link,
                    "posted": (item.findtext("pubDate") or "").strip(), "deadline": deadline})
    return out


def search_jobbank(q: str, limit: int = 50) -> list:
    """RSS first (100 items, stable XML); the onclick page scrape only when the feed fails."""
    try:
        return parse_jobbank_rss(fetch(JOBBANK_RSS.format(q=urllib.parse.quote(q))))[:limit]
    except (ValueError, urllib.error.URLError):
        return parse_jobbank_html(fetch(JOBBANK_SEARCH.format(q=urllib.parse.quote(q))))[:limit]


# ---------------------------------------------------------------------- thehub
# JOBSRC-THEHUB-001 (owner 2026-11-01): thehub.io (the Nordic startup board, formerly
# thehub.dk). /jobs?search= is a Nuxt page: the result set is server-rendered, but only
# inside the window.__NUXT__ IIFE, not as HTML cards (a link scrape finds ONE job). Nuxt
# hoists repeated values into the IIFE's parameters, so a field can read title:aF and the
# string lives in the argument list at the end. We resolve those. Public page, robots.txt
# allows /jobs, and the site terms carry no automated-access clause (checked 2026-11-01);
# one request per query, no login.

THEHUB_SEARCH = "https://thehub.io/jobs?search={q}&countryCode=DK"
_JS_STR = r'"(?:[^"\\]|\\.)*"'
_JS_VAL = r'(?:' + _JS_STR + r'|[A-Za-z_$][\w$]*)'


def _js_split_top(s: str) -> list:
    """Split a JS argument list on commas at depth 0, respecting strings."""
    out, depth, cur, i, n = [], 0, [], 0, len(s)
    while i < n:
        ch = s[i]
        if ch == '"':
            m = re.match(_JS_STR, s[i:])
            cur.append(m.group(0)); i += len(m.group(0)); continue
        if ch in "[{(":
            depth += 1
        elif ch in "]})":
            depth -= 1
        if ch == "," and depth == 0:
            out.append("".join(cur).strip()); cur = []
        else:
            cur.append(ch)
        i += 1
    if "".join(cur).strip():
        out.append("".join(cur).strip())
    return out


def _js_unquote(tok: str) -> str:
    try:
        return json.loads(tok)
    except ValueError:
        return tok.strip('"')


def _nuxt_bindings(page: str) -> dict:
    """Map the IIFE's parameter names to their string arguments."""
    m = re.search(r"__NUXT__=\(function\(([^)]*)\)\{", page)
    if not m:
        return {}
    params = [p.strip() for p in m.group(1).split(",")]
    end = page.find("</script>", m.end())
    tail = page[m.end():end]
    k = tail.rfind("}(")
    if k < 0:
        return {}
    args = _js_split_top(tail[k + 2:].rstrip(";").rstrip(")"))
    return {p: _js_unquote(a) for p, a in zip(params, args) if a.startswith('"')}


def _js_field(obj: str, name: str, env: dict) -> str:
    m = re.search(r"(?:^|[{,])" + re.escape(name) + r":(" + _JS_VAL + r")", obj)
    if not m:
        return ""
    v = m.group(1)
    return _js_unquote(v) if v.startswith('"') else (env.get(v, "") or "")


def _top_objects(arr: str) -> list:
    """'{..},{..}' -> list of top-level object strings (brace depth, string-aware)."""
    out, depth, start, i, n = [], 0, None, 0, len(arr)
    while i < n:
        ch = arr[i]
        if ch == '"':
            i += len(re.match(_JS_STR, arr[i:]).group(0)); continue
        if ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0 and start is not None:
                out.append(arr[start:i + 1]); start = None
        elif ch == "]" and depth == 0:
            break
        i += 1
    return out


def parse_thehub_html(page: str) -> list:
    """jobs.jobs.docs[] in the __NUXT__ payload -> rows."""
    env = _nuxt_bindings(page)
    a = page.find("jobs:{jobs:{")
    d = page.find("docs:[", a) if a >= 0 else -1
    if d < 0:
        return []
    out = []
    for obj in _top_objects(page[d + len("docs:["):]):
        comp = re.search(r"company:(\{.*?\}),views:", obj, re.S)
        company = _js_field(comp.group(1), "name", env) if comp else ""
        rest = obj[comp.end():] if comp else obj
        loc = re.search(r"location:(\{[^{}]*\})", rest)
        job_id = re.findall(r'(?:^|[{,])id:"([0-9a-f]{24})"', rest)
        title = _js_field(rest, "title", env)
        if not title or not job_id:
            continue
        out.append({
            "source": "thehub", "title": title, "company": company,
            "location": _js_field(loc.group(1), "address", env) if loc else "",
            "url": "https://thehub.io/jobs/" + job_id[-1],
            "posted": "", "deadline": "",
        })
    return out


def search_thehub(q: str, limit: int = 50) -> list:
    return parse_thehub_html(fetch(THEHUB_SEARCH.format(q=urllib.parse.quote(q))))[:limit]


# ---------------------------------------------------------------------- jobnet
# JOBSRC-UPSTREAM-001. External ads carry the employer/aggregator URL in jobAdUrl;
# internal ones have only the jobnet.dk/find-job/<id> page, which answers HTTP 404
# to a non-JS client even while live, so check-postings.py probes the BFF
# JobAdDetails endpoint for those instead (POSTING-JOBNET-001).
JOBNET_SEARCH = "https://jobnet.dk/bff/FindJob/Search"
JOBNET_FIND_JOB = "https://jobnet.dk/find-job/%s"
JOBNET_HEADERS = {"x-csrf": "1", "Accept": "application/json"}


def _iso_day(v) -> str:
    v = (v or "").strip() if isinstance(v, str) else ""
    return "" if not v or v.startswith("1900-01-01") else v[:10]


def parse_jobnet(payload) -> list:
    data = json.loads(payload) if isinstance(payload, str) else payload
    out = []
    for ad in (data or {}).get("jobAds") or []:
        jid = (ad.get("jobAdId") or "").strip()
        title = _text(ad.get("title") or "")
        if not jid or not title:
            continue
        out.append({
            "source": "jobnet", "title": title, "company": _text(ad.get("hiringOrgName") or ""),
            "location": _text(ad.get("postalDistrictName") or ad.get("municipality") or ""),
            "url": (ad.get("jobAdUrl") or "").strip() or JOBNET_FIND_JOB % jid,
            "posted": _iso_day(ad.get("publicationDate")),
            "deadline": _iso_day(ad.get("applicationDeadline")),
            # COMPANY-FINANCIALS-001: the employer's CVR number, for the annual-report lookup
            "cvr": str(ad.get("cvr") or "").strip() if re.fullmatch(r"\d{8}", str(ad.get("cvr") or "").strip()) else "",
        })
    return out


def search_jobnet(q: str, limit: int = 50) -> list:
    qs = urllib.parse.urlencode({"searchString": q, "resultsPerPage": max(1, min(limit, 100)),
                                 "pageNumber": 1, "orderType": "PublicationDate"})
    return parse_jobnet(fetch(JOBNET_SEARCH + "?" + qs, headers=JOBNET_HEADERS))[:limit]


# -------------------------------------------------------------------- freehire
# JOBSRC-UPSTREAM-001. robots.txt bans /api/ only for Googlebot/Bingbot; the '*'
# group allows it. countries=dk keeps it to Denmark; posted_within_days bounds age.
FREEHIRE_SEARCH = "https://freehire.me/api/v1/jobs/search"
FREEHIRE_DAYS = 14
_TRACKING_QS = re.compile(r"^(utm_[a-z]+|ref|source)$", re.I)
# freehire hands jobnet ads over in the retired job.jobnet.dk/CV/FindWork/Details/<id>
# form; the same ad from search_jobnet reads jobnet.dk/find-job/<id>.
_OLD_JOBNET = re.compile(r"^https?://job\.jobnet\.dk/CV/FindWork/Details/([0-9a-f-]{36})", re.I)


def _strip_tracking(url: str) -> str:
    m = _OLD_JOBNET.match(url)
    if m:
        return JOBNET_FIND_JOB % m.group(1).lower()
    p = urllib.parse.urlsplit(url)
    kept = [(k, v) for k, v in urllib.parse.parse_qsl(p.query, keep_blank_values=True)
            if not _TRACKING_QS.match(k)]
    return urllib.parse.urlunsplit(p._replace(query=urllib.parse.urlencode(kept)))


def parse_freehire(payload) -> list:
    data = json.loads(payload) if isinstance(payload, str) else payload
    out = []
    for j in (data or {}).get("data") or []:
        if j.get("closed_at"):
            continue
        title, url = _text(j.get("title") or ""), (j.get("url") or "").strip()
        if not title or not url:
            continue
        out.append({
            "source": "freehire", "title": title, "company": _text(j.get("company") or ""),
            "location": _text(j.get("location") or ""), "url": _strip_tracking(url),
            "posted": _iso_day(j.get("posted_at")), "deadline": "",
            "via": (j.get("source") or "").strip(),
        })
    return out


def search_freehire(q: str, limit: int = 50, countries=("dk",)) -> list:
    qs = [("q", q), ("limit", max(1, min(limit, 100))), ("posted_within_days", FREEHIRE_DAYS)]
    qs += [("countries", c) for c in countries]
    return parse_freehire(fetch(FREEHIRE_SEARCH + "?" + urllib.parse.urlencode(qs),
                                headers={"Accept": "application/json"}))[:limit]


# ------------------------------------------------------------------ jobdanmark
JOBDANMARK_BASE = "https://jobdanmark.dk"
JOBDANMARK_SEARCH = JOBDANMARK_BASE + "/api/jobsearch/search/1"     # 30 per page, fixed


def parse_jobdanmark(payload) -> list:
    data = json.loads(payload) if isinstance(payload, str) else payload
    out = []
    for j in (data or {}).get("items") or []:
        title, path = _text(j.get("title") or ""), (j.get("url") or "").strip()
        if not title or not path:
            continue
        addr = [p.strip() for p in _text(j.get("companyAddress") or "").split(",") if p.strip()]
        out.append({
            "source": "jobdanmark", "title": title, "company": _text(j.get("companyName") or ""),
            "location": addr[-1] if addr else "", "url": urllib.parse.urljoin(JOBDANMARK_BASE, path),
            "posted": (j.get("publishedDate") or "").strip(),
            "deadline": (j.get("applicationDeadline") or "").strip(),
        })
    return out


def search_jobdanmark(q: str, limit: int = 50) -> list:
    body = json.dumps({"jobTypes": [], "filters": [{"type": "freetext", "value": q, "displayText": q}],
                       "locationMode": "Text", "distance": 50}, ensure_ascii=False).encode("utf-8")
    return parse_jobdanmark(fetch(JOBDANMARK_SEARCH, data=body, headers={
        "Content-Type": "application/json; charset=utf-8", "Accept": "application/json"}))[:limit]


# ------------------------------------------------------------------------ cli
# Not added as account-backed fetchers, on purpose (owner asked 2026-11-01; checked that day):
#   LinkedIn     the discovery routine already reads the PUBLIC guest search (no login,
#                SCHEDULED_ROUTINES.md). Driving the owner's own session/token is not added:
#                the User Agreement bans automated access, and the account is what gets
#                restricted.
#   careerhound  ADDED 2026-11-03 (JOBSRC-CAREERHOUND-001) below, now that Career Hound has given
#                the written permission its terms s.7 require: Roman <roman@careerhound.io>,
#                2 Nov 2026, reply to "Permission request: personal automated access to my own
#                Career Hound results": "you have our permission to proceed for your personal
#                tracking". Scope: the owner's OWN results, personal tracking only, one polite
#                request per run. Not for other users, not for resale, no bulk crawling.


# -------------------------------------------------------------------- careerhound
# Career Hound (careerhound.io) is a Next.js app with password-free e-mail login (NextAuth). The
# owner's own job feed sits behind the session: /api/view-jobs answers 307 -> /select-category
# without one. Auth = the owner's NextAuth session cookie, which the OWNER copies from the browser
# (DevTools > Application > Cookies > www.careerhound.io > __Secure-next-auth.session-token) into
# ~/.antcv/careerhound_session. It is read here and sent only to careerhound.io; never printed,
# logged or pasted into a session. Sessions expire (NextAuth default ~30 days): a redirect to
# /login or /select-category means "refresh the cookie" (or pick a category once in the browser).
CAREERHOUND_BASE = "https://www.careerhound.io"
CAREERHOUND_FEED = CAREERHOUND_BASE + "/api/view-jobs"
CAREERHOUND_COOKIE = "__Secure-next-auth.session-token"
CAREERHOUND_SESSION_FILE = os.path.join(os.path.expanduser("~"), ".antcv", "careerhound_session")
_CH_TITLE = ("title", "jobTitle", "job_title", "position", "name")
_CH_COMPANY = ("company", "companyName", "company_name", "employer", "employerName", "organization")
_CH_LOCATION = ("location", "locationName", "city", "locations", "jobLocation")
_CH_URL = ("url", "link", "applyUrl", "apply_url", "jobUrl", "job_url", "redirectUrl", "href")
_CH_POSTED = ("posted", "postedAt", "datePosted", "date_posted", "publishedAt", "createdAt")


class CareerHoundAuthError(RuntimeError):
    pass


def careerhound_cookie(path: str = CAREERHOUND_SESSION_FILE):
    """The owner's session cookie as a Cookie header value, or None when the file is missing."""
    try:
        with open(path, encoding="utf-8") as f:
            v = f.read().strip()
    except OSError:
        return None
    if not v:
        return None
    return v if "=" in v else CAREERHOUND_COOKIE + "=" + v


def _ch_pick(d: dict, keys) -> str:
    for k in keys:
        v = d.get(k)
        if isinstance(v, dict):
            v = v.get("name") or v.get("title") or v.get("label") or ""
        if isinstance(v, list):
            v = ", ".join(str(x.get("name") if isinstance(x, dict) else x) for x in v if x)
        if isinstance(v, (str, int, float)) and str(v).strip():
            return str(v).strip()
    return ""


def _ch_jobs_in(obj, out, depth=0):
    """Walk any JSON shape; every dict with a title-like and a url- or company-like field is a job."""
    if depth > 12:
        return
    if isinstance(obj, dict):
        if _ch_pick(obj, _CH_TITLE) and (_ch_pick(obj, _CH_URL) or _ch_pick(obj, _CH_COMPANY)):
            out.append(obj)
            return
        for v in obj.values():
            _ch_jobs_in(v, out, depth + 1)
    elif isinstance(obj, list):
        for v in obj:
            _ch_jobs_in(v, out, depth + 1)


def _ch_json_blobs(page: str) -> list:
    """JSON documents inside a Next.js page: __NEXT_DATA__, and app-router flight chunks."""
    blobs = []
    m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', page, re.S)
    if m:
        try:
            blobs.append(json.loads(m.group(1)))
        except ValueError:
            pass
    for chunk in re.findall(r'self\.__next_f\.push\(\[1,"(.*?)"\]\)', page, re.S):
        try:
            text = json.loads('"' + chunk + '"')
        except ValueError:
            continue
        for line in text.splitlines():
            body = line.split(":", 1)[1] if re.match(r"^[0-9a-f]+:", line) else line
            if body[:1] in "[{":
                try:
                    blobs.append(json.loads(body))
                except ValueError:
                    pass
    return blobs


def parse_careerhound(body: str, content_type: str = "") -> list:
    """Rows from a Career Hound feed response, JSON or a rendered Next.js page."""
    raw = []
    if "json" in content_type or body.lstrip()[:1] in "[{":
        try:
            _ch_jobs_in(json.loads(body), raw)
        except ValueError:
            pass
    if not raw:
        for blob in _ch_json_blobs(body):
            _ch_jobs_in(blob, raw)
    out, seen = [], set()
    for j in raw:
        url = _ch_pick(j, _CH_URL)
        if url.startswith("/"):
            url = CAREERHOUND_BASE + url
        row = {"source": "careerhound", "title": _text(_ch_pick(j, _CH_TITLE)),
               "company": _text(_ch_pick(j, _CH_COMPANY)), "location": _text(_ch_pick(j, _CH_LOCATION)),
               "url": url, "posted": _ch_pick(j, _CH_POSTED)[:10], "deadline": ""}
        key = row["url"] or (row["title"], row["company"])
        if key in seen:
            continue
        seen.add(key)
        out.append(row)
    return out


def _careerhound_get(cookie: str, timeout: int = 45):
    req = urllib.request.Request(CAREERHOUND_FEED, headers={
        "User-Agent": _UA + " AntCV-personal-tracker (owner-authorised, Career Hound permission 2026-11-02)",
        "Accept": "application/json,text/html;q=0.9,*/*;q=0.8",
        "Cookie": cookie,
    })
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, resp.geturl(), resp.headers.get("Content-Type", ""), _decode(resp.read())


def search_careerhound(q: str, limit: int = 50, cookie=None, getter=None) -> list:
    """The owner's own Career Hound feed. q filters titles/companies (any word); '*' or '' keeps all."""
    cookie = cookie or careerhound_cookie()
    if not cookie:
        raise CareerHoundAuthError("no session file at %s (see the setup note in job_sources.py)"
                                   % CAREERHOUND_SESSION_FILE)
    status, final_url, ctype, body = (getter or _careerhound_get)(cookie)
    if re.search(r"/(login|select-category)\b", final_url or ""):
        raise CareerHoundAuthError("session expired or no category selected (landed on %s): refresh "
                                   "the cookie file or pick a category once in the browser" % final_url)
    rows = parse_careerhound(body, ctype)
    words = [w for w in re.split(r"\W+", (q or "").lower()) if len(w) > 2]
    if words and q.strip() != "*":
        rows = [r for r in rows if any(w in (r["title"] + " " + r["company"]).lower() for w in words)]
    return rows[:limit]


def cmd_careerhound_probe(args):
    """Shape-only report of the owner's feed (no job text, no cookie): to finish the parser on the
    first authenticated run."""
    cookie = careerhound_cookie()
    if not cookie:
        sys.exit("no session file at %s" % CAREERHOUND_SESSION_FILE)
    status, final_url, ctype, body = _careerhound_get(cookie)

    def shape(o, d=0):
        if d > 3:
            return "..."
        if isinstance(o, dict):
            return {k: shape(v, d + 1) for k, v in list(o.items())[:25]}
        if isinstance(o, list):
            return [shape(o[0], d + 1), "x%d" % len(o)] if o else []
        return type(o).__name__

    print(json.dumps({"status": status, "final_path": urllib.parse.urlparse(final_url).path,
                      "content_type": ctype, "bytes": len(body),
                      "json_shape": shape(json.loads(body)) if body.lstrip()[:1] in "[{" else None,
                      "next_blobs": len(_ch_json_blobs(body)),
                      "jobs_parsed": len(parse_careerhound(body, ctype))}, indent=1))


SOURCES = {"jobindex": search_jobindex, "jobbank": search_jobbank, "thehub": search_thehub,
           "jobnet": search_jobnet, "freehire": search_freehire, "jobdanmark": search_jobdanmark,
           "careerhound": search_careerhound}
# account-backed sources join "all" only when the owner's session file exists
ACCOUNT_SOURCES = {"careerhound": careerhound_cookie}

# JOBSRC-HEALTH-001: every CLI search appends one line per source to this log, so a
# parser that rots into "exit 0, zero rows" shows up as a yield drop in `health`.
YIELD_LOG = os.environ.get("ANTCV_JOBSRC_YIELD") or os.path.join(
    os.path.expanduser("~"), ".antcv", "job_sources_yield.jsonl")


def log_yield(path, name, q, n, err):
    if not path:
        return
    try:
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        with open(path, "a", encoding="utf-8") as f:
            f.write(json.dumps({"at": datetime.datetime.now().isoformat(timespec="seconds"),
                                "source": name, "q": q, "n": n, "error": err},
                               ensure_ascii=False) + "\n")
    except OSError:
        pass                                                   # the log never fails a search


def cmd_search(args):
    names = list(SOURCES) if args.source == "all" else [args.source]
    if args.source == "all":
        names = [n for n in names if n not in ACCOUNT_SOURCES or ACCOUNT_SOURCES[n]()]
    rows, errs = [], []
    ylog = getattr(args, "yield_log", None)
    for name in names:
        try:
            got = SOURCES[name](args.q, args.limit)
            rows.extend(got)
            log_yield(ylog, name, args.q, len(got), None)
        except Exception as e:                                  # noqa: BLE001
            errs.append("%s: %s: %s" % (name, type(e).__name__, e))
            log_yield(ylog, name, args.q, 0, "%s: %s" % (type(e).__name__, e))
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


# ---------------------------------------------------------------------- health
# JOBSRC-HEALTH-001 (from the ai-job-search /scrape health check). Scrapers rot
# silently: a markup change gives exit 0 and zero or junk rows. Per source: the yield
# history from YIELD_LOG, then ONE sentinel search (one broader retry only if it comes
# back empty), then a junk scan of what came back. A 401/403/429 or a robots.txt
# refusal is never evidence of breakage: "inconclusive". Exit 1 only when broken.
SENTINELS = {"jobindex": "ingeniør", "jobbank": "ingeniør", "thehub": "engineer",
             "jobnet": "ingeniør", "freehire": "engineer", "jobdanmark": "ingeniør",
             "careerhound": "*"}
SENTINEL_BROAD = "job"
# Hosts a source's own rows must point at. jobnet (external ads) and freehire link
# to employer pages by design, so they are not host-checked.
SOURCE_HOSTS = {"jobindex": "jobindex.dk", "jobbank": "jobbank.dk", "thehub": "thehub.io",
                "jobdanmark": "jobdanmark.dk"}
_WALLED = re.compile(r"HTTP Error (401|403|429)|RobotsDisallowed|CareerHoundAuthError")


def yield_history(path, name, last=10):
    hist = []
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                try:
                    e = json.loads(line)
                except ValueError:
                    continue
                if e.get("source") == name:
                    hist.append(e)
    except OSError:
        return {"searches": 0, "with_rows": 0, "zero_streak": 0, "last_rows_at": None}
    hist = hist[-last:]
    streak = 0
    for e in reversed(hist):
        if e.get("n"):
            break
        streak += 1
    with_rows = [e for e in hist if e.get("n")]
    return {"searches": len(hist), "with_rows": len(with_rows), "zero_streak": streak,
            "last_rows_at": with_rows[-1]["at"] if with_rows else None}


def junk_reasons(name, rows) -> list:
    why = []
    if rows and all(not r.get("company") for r in rows):
        why.append("company empty on all %d rows" % len(rows))
    if any(not r.get("title") for r in rows):
        why.append("empty title")
    if any(re.search(r"&(amp|lt|gt|quot|#\d+);|<[a-z/]", r.get("title", "")) for r in rows):
        why.append("undecoded entity or markup in a title")
    host = SOURCE_HOSTS.get(name)
    if host and any(host not in urllib.parse.urlsplit(r.get("url", "")).netloc for r in rows):
        why.append("url off %s" % host)
    return why


def check_source(name, search=None, history=None) -> dict:
    search = search or SOURCES[name]
    res = {"source": name, "history": history or {}}
    rows = []
    for q in (SENTINELS.get(name, SENTINEL_BROAD), SENTINEL_BROAD):
        try:
            rows = search(q, 5)
        except Exception as e:                                  # noqa: BLE001
            msg = "%s: %s" % (type(e).__name__, e)
            res.update(status="inconclusive" if _WALLED.search(msg) else "broken", detail=msg)
            return res
        if rows:
            break
    if not rows:
        res.update(status="broken", detail="0 rows for the sentinel query and a broader retry")
        return res
    why = junk_reasons(name, rows)
    res.update(status="degraded" if why else "healthy", detail="; ".join(why) or "%d rows" % len(rows))
    return res


def cmd_health(args):
    names = [args.source] if args.source != "all" else [
        n for n in SOURCES if n not in ACCOUNT_SOURCES or ACCOUNT_SOURCES[n]()]
    report = [check_source(n, history=yield_history(args.yield_log, n)) for n in names]
    for r in report:
        h = r["history"]
        r["yield_drop"] = bool(h.get("zero_streak", 0) >= 3 and h.get("with_rows"))
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=1))
    else:
        for r in report:
            h = r["history"]
            print("%-11s %-12s %s" % (r["source"], r["status"], r["detail"]))
            if h.get("searches"):
                print("%-11s %-12s %d of the last %d searches returned rows; zero streak %d%s" % (
                    "", "", h["with_rows"], h["searches"], h["zero_streak"],
                    "  <- YIELD DROP" if r["yield_drop"] else ""))
    if any(r["status"] == "broken" for r in report):
        sys.exit(1)


def main():
    # JOBSRC-STDOUT-ENCODING-001: a routine redirects --json to a file. On Windows stdout
    # defaults to the console codepage, so "ø" lands as cp1252 byte 0xf8 and the
    # caller's UTF-8 read fails: zero ads, which reads as "source was dry". Pin it.
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass
    ap = argparse.ArgumentParser(description="Fetch listings from jobindex.dk / jobbank.dk / thehub.io / "
                                             "jobnet.dk / freehire.me / jobdanmark.dk / careerhound.io")
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("search")
    s.add_argument("--q", required=True)
    s.add_argument("--source", default="all", choices=["all"] + list(SOURCES))
    s.add_argument("--limit", type=int, default=50)
    s.add_argument("--json", action="store_true")
    s.add_argument("--yield-log", default=YIELD_LOG, help="per-source yield log ('' = off)")
    s.set_defaults(fn=cmd_search)
    hp = sub.add_parser("health", help="sentinel probe + yield history per source (exit 1 = broken)")
    hp.add_argument("--source", default="all", choices=["all"] + list(SOURCES))
    hp.add_argument("--json", action="store_true")
    hp.add_argument("--yield-log", default=YIELD_LOG)
    hp.set_defaults(fn=cmd_health)
    pr = sub.add_parser("careerhound-probe", help="shape-only report of the owner's Career Hound feed")
    pr.set_defaults(fn=cmd_careerhound_probe)
    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
