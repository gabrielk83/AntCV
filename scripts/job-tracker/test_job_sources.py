# JOBSRC-FETCH-001 — parser truth table for the two discovery sources whose
# search pages a generic HTML fetch cannot read.
# Run: python scripts/job-tracker/test_job_sources.py   (exit 0 = pass)
#
# Network-free: the fixtures below are trimmed captures of the REAL markup as
# served on 2026-08-26. Both encode the trap that broke the 2026-08-26 discovery
# run: jobindex paints /jobsoegning client-side (so we read the RSS instead), and
# jobbank's ads carry no <a href> at all — the destination is inside an inline
# onclick, which is exactly why a link scrape returned zero rows.
import datetime
import importlib.util
import os
import sys
import tempfile

# JOBSRC-HEALTH-001: the CLI logs every search's yield; keep the tests' runs out of
# the owner's real log (~/.antcv/job_sources_yield.jsonl). Children inherit this.
_TMP = tempfile.mkdtemp(prefix="jobsrc-test-")
os.environ["ANTCV_JOBSRC_YIELD"] = os.path.join(_TMP, "yield.jsonl")

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("js", os.path.join(HERE, "job_sources.py"))
js = importlib.util.module_from_spec(spec)
spec.loader.exec_module(js)

JOBINDEX_RSS = """<?xml version="1.0" encoding="ISO-8859-1"?>
<rss version="2.0"><channel>
<title>Jobindex - Ledige job</title>
<item>
  <title>Produktchef &#x2013; Raps &#x26; Korn, DSV Fr&#xF8; Danmark A/S</title>
  <link>https://www.jobindex.dk/vis-job/h1684394</link>
  <description>&#x3C;div&#x3E;Holstebro Vil du v&#xE6;re med?&#x3C;/div&#x3E;</description>
  <pubDate>Mon, 24 Aug 2026 06:00:00 +0200</pubDate>
</item>
<item>
  <title>Dom&#xE6;nespecialist til DUBU, KOMBIT A/S</title>
  <link>https://www.jobindex.dk/vis-job/h1691306</link>
  <description>K&#xF8;benhavn S Vil du v&#xE6;re med til at udvikle et af kommunernes
  vigtigste fagsystemer p&#xE5; b&#xF8;rne- og familieomr&#xE5;det? Som specialist
  bliver du en del af teamet bag DUBU.</description>
  <pubDate>Fri, 21 Aug 2026 06:00:00 +0200</pubDate>
</item>
</channel></rss>"""

# Two ad blocks. Note: no <a href> anywhere — destination is in the onclick.
JOBBANK_HTML = """<html><body>
<div name="3103475" class="job-item" id="jobItem3103475">
  <div class="clickable job-image" onclick="document.location.href='/job/3103475/carelink-gruppen/konsulent-til-psykisk-arbejdsmiljo/'"></div>
  <div class="job-content">
    <div class="job-header">Konsulent til psykisk arbejdsmiljø og ledelsesudvikling</div>
    <div class="job-teaser">Fuldtidsjob hos Carelink Gruppen, Storkøbenhavn, Øresundsregionen</div>
    <div class="job-date-updated">Opdateret: 26.08.2026</div>
    <div class="job-date-application">Frist: 07.09.2026</div>
  </div>
</div>
<div name="3105228" class="job-item" id="jobItem3105228">
  <div class="clickable job-image" onclick="document.location.href='/job/3105228/scales-as/microsoft-d365-graduate/'"></div>
  <div class="job-content">
    <div class="job-header">Microsoft D365 Finance &amp; Operations Graduate</div>
    <div class="job-teaser">Fuldtidsjob | Graduate/trainee hos SCALES A/S, Storkøbenhavn</div>
    <div class="job-date-updated">Opdateret: 25.08.2026</div>
    <div class="job-date-application">Frist: 01.01.2020</div>
  </div>
</div>
</body></html>"""

fails = []


def check(name, got, want):
    if got != want:
        fails.append("%s\n    got:  %r\n    want: %r" % (name, got, want))


# ---- jobindex RSS -----------------------------------------------------------
rows = js.parse_jobindex_rss(JOBINDEX_RSS)
check("jobindex: both items parsed", len(rows), 2)
check("jobindex: role is the title minus the trailing company",
      rows[0]["title"], "Produktchef – Raps & Korn")
check("jobindex: company is the segment after the LAST comma",
      rows[0]["company"], "DSV Frø Danmark A/S")
check("jobindex: link kept verbatim", rows[0]["url"], "https://www.jobindex.dk/vis-job/h1684394")
check("jobindex: pubDate carried", rows[0]["posted"], "Mon, 24 Aug 2026 06:00:00 +0200")
check("jobindex: role with a comma-free title still splits on the company",
      rows[1]["company"], "KOMBIT A/S")
# The bug this guards: a greedy location regex swallowed the whole teaser.
check("jobindex: location is the place plus at most one qualifier, no prose bleed",
      rows[1]["location"], "København S")

# ---- jobbank HTML -----------------------------------------------------------
b = js.parse_jobbank_html(JOBBANK_HTML)
check("jobbank: both onclick ads found (a link scrape finds ZERO)", len(b), 2)
check("jobbank: url built from the onclick target",
      b[0]["url"],
      "https://www.jobbank.dk/job/3103475/carelink-gruppen/konsulent-til-psykisk-arbejdsmiljo/")
check("jobbank: title from .job-header",
      b[0]["title"], "Konsulent til psykisk arbejdsmiljø og ledelsesudvikling")
check("jobbank: company from the teaser", b[0]["company"], "Carelink Gruppen")
check("jobbank: location is the teaser tail",
      b[0]["location"], "Storkøbenhavn, Øresundsregionen")
check("jobbank: deadline captured", b[0]["deadline"], "07.09.2026")
# The second teaser has TWO job-type tokens before " hos " — cutting at the first
# one leaves 'Graduate/trainee hos SCALES A/S' as the company.
check("jobbank: company survives a multi-part job-type prefix",
      b[1]["company"], "SCALES A/S")

# ---- a link scrape really would have found nothing (negative control) --------
import re  # noqa: E402
check("negative control: the fixture contains no <a href> job links at all",
      len(re.findall(r'<a[^>]+href="/job/\d+', JOBBANK_HTML)), 0)

# ---- JOBSRC-JOBBANK-PARAM-001: the search URL must filter ----------------------
check("jobbank search filters on key= (soegeord= is ignored since 2026-09)",
      js.JOBBANK_SEARCH.format(q="optik"), "https://www.jobbank.dk/job/?key=optik")

# ---- JOBSRC-THEHUB-001: thehub.io jobs live in the __NUXT__ payload --------------
# Trimmed from the real /jobs?search= page of 2026-11-01. The trap: Nuxt hoists repeated
# values into the IIFE parameters, so the 2nd job reads title:c and company name:d, and
# the strings sit in the argument list at the very end. Only one job is a real <a href>.
THEHUB_HTML = ('<html><body><a href="/jobs/6abb9356b84a86d63d038c39">x</a><script>'
    'window.__NUXT__=(function(a,b,c,d){return {state:{jobs:{jobs:{total:2,limit:15,page:1,docs:['
    '{saved:a,company:{logoImage:{path:"\\u002Ffiles\\u002Fa.png",id:"653f5a6f9b2d0f68a45ebbfa"},'
    'founded:"2022",name:"proprty.ai",key:"proprtyai",id:"64e625cd8740836a73707dd9"},'
    'views:{week:9030,total:35440},isFeatured:b,isRemote:a,'
    'location:{address:"Copenhagen, Denmark",locality:"Copenhagen",country:"Denmark"},'
    'title:"Data Engineer \\u002F Backend Developer",key:"data-engineer",id:"6abb9356b84a86d63d038c39"},'
    '{saved:a,company:{logoImage:{path:"\\u002Ffiles\\u002Fb.png",id:"686e254af437729986876af4"},'
    'founded:"2024",name:d,key:"dalea",id:"686e379c86599299a3cafde5"},'
    'views:{week:4891,total:6624},isFeatured:a,isRemote:a,'
    'location:{address:"Aarhus, Denmark",locality:"Aarhus",country:"Denmark"},'
    'title:c,key:"pm-1",id:"6ad2047798808f4c168f8553"}]}}}}}'
    '(false,true,"Project Manager","Dalea"));</script></body></html>')
h = js.parse_thehub_html(THEHUB_HTML)
check("thehub: both payload jobs found (a link scrape finds ONE)", len(h), 2)
check("thehub: literal title decoded (\\u002F -> /)", h[0]["title"], "Data Engineer / Backend Developer")
check("thehub: company is the company block's name, not the logo/company id", h[0]["company"], "proprty.ai")
check("thehub: url uses the JOB id (last id), not the company id",
      h[0]["url"], "https://thehub.io/jobs/6abb9356b84a86d63d038c39")
check("thehub: hoisted title resolved from the IIFE arguments", h[1]["title"], "Project Manager")
check("thehub: hoisted company name resolved", h[1]["company"], "Dalea")
check("thehub: location from the location block", h[1]["location"], "Aarhus, Denmark")
check("thehub: no payload -> no rows (never invents)", js.parse_thehub_html("<html>no nuxt</html>"), [])
check("negative control: the fixture has ONE <a href> job link but two jobs",
      len(re.findall(r'<a[^>]+href="/jobs/[0-9a-f]{24}', THEHUB_HTML)), 1)
check("thehub search is DK-scoped", js.THEHUB_SEARCH.format(q="optik"),
      "https://thehub.io/jobs?search=optik&countryCode=DK")
check("sources: thehub, careerhound (permission 2026-11-02), jobnet/freehire/jobdanmark "
      "(JOBSRC-UPSTREAM-001) registered; LinkedIn deliberately absent",
      sorted(js.SOURCES), ["careerhound", "freehire", "jobbank", "jobdanmark", "jobindex", "jobnet", "thehub"])

# ---- deadline helper --------------------------------------------------------
check("dk date parses", js._dk_date("Frist: 07.09.2026"), datetime.date(2026, 9, 7))
check("dk date rejects junk", js._dk_date("snarest muligt"), None)
check("dk date parses ISO (jobnet, freehire)", js._dk_date("2026-11-13"), datetime.date(2026, 11, 13))

# ---- JOBSRC-UPSTREAM-001: jobbank RSS (trimmed from the real feed, 2026-11-05) -------
import json  # noqa: E402
JOBBANK_RSS ="""<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
<title>Job  fra Akademikernes Jobbank</title>
<item>
  <title><![CDATA[Ingeniør til højpræcisionsstrømforsyninger]]></title>
  <description><![CDATA[Fuldtidsjob hos DANFYSIK A/S, Storkøbenhavn, Øresundsregionen (Ansøgningsfrist: 08.11.2026) ]]></description>
  <link>https://jobbank.dk/job/3138440/danfysik-as/ingenior-til-hojpraecisionsstro</link>
  <pubDate>Tue, 27 Oct 2026 00:00:00 +0100</pubDate>
</item>
<item>
  <title><![CDATA[Graduate til NPI]]></title>
  <description><![CDATA[Fuldtidsjob | Graduate/trainee hos Photon ApS, Aarhus]]></description>
  <link>https://jobbank.dk/job/3138441/photon-aps/graduate</link>
  <pubDate>Mon, 26 Oct 2026 00:00:00 +0100</pubDate>
</item>
</channel></rss>"""
r = js.parse_jobbank_rss(JOBBANK_RSS)
check("jobbank rss: both items", len(r), 2)
check("jobbank rss: company, location and deadline split out of the teaser",
      (r[0]["company"], r[0]["location"], r[0]["deadline"]),
      ("DANFYSIK A/S", "Storkøbenhavn, Øresundsregionen", "08.11.2026"))
check("jobbank rss: multi-part job-type prefix cut, no deadline -> ''",
      (r[1]["company"], r[1]["location"], r[1]["deadline"]), ("Photon ApS", "Aarhus", ""))
check("jobbank rss url has the trailing slash (no 301 per request)",
      js.JOBBANK_RSS.format(q="fysik"), "https://jobbank.dk/job/rss/?key=fysik")
_fetch = js.fetch
js.fetch = lambda url, **kw: (_ for _ in ()).throw(ValueError("rss broke")) if "/rss/" in url else JOBBANK_HTML
check("jobbank: a broken feed falls back to the onclick page scrape",
      [x["company"] for x in js.search_jobbank("x")], [b[0]["company"], b[1]["company"]])
js.fetch = _fetch

# ---- jobnet BFF (shape captured 2026-11-05) -------------------------------------
JOBNET = {"totalJobAdCount": 3, "jobAds": [
    {"jobAdId": "3558aa97-84b4-4e2d-8f9f-2fa00c0a34b1", "title": "Leder til Vedligeholdelsesområde",
     "hiringOrgName": "Forsvarets Vedligeholdelsestjeneste", "municipality": "Syddjurs",
     "jobAdUrl": "https://jobsamler.dk/job/leder-ta80", "isExternal": True, "cvr": "16287180",
     "applicationDeadline": "2026-11-13T00:00:00+01:00", "publicationDate": "2026-11-05T00:00:00+01:00"},
    {"jobAdId": "c6100943-1bbf-41d6-a1a8-51329184e0e6", "title": "Miljøingeniør til Aarhus ReWater",
     "hiringOrgName": "Teknik og Miljø", "municipality": "Aarhus", "postalDistrictName": "Brabrand",
     "jobAdUrl": "", "isExternal": False,
     "applicationDeadline": "1900-01-01T00:00:00+01:00", "publicationDate": "2026-11-05T00:00:00+01:00"},
    {"jobAdId": "", "title": "no id"}]}
n = js.parse_jobnet(json.dumps(JOBNET))
check("jobnet: ads without an id are dropped", len(n), 2)
check("jobnet: external ad keeps the employer url, ISO deadline + posted day",
      (n[0]["url"], n[0]["deadline"], n[0]["posted"], n[0]["location"]),
      ("https://jobsamler.dk/job/leder-ta80", "2026-11-13", "2026-11-05", "Syddjurs"))
check("jobnet: the employer's CVR rides along; a missing one is ''", (n[0]["cvr"], n[1]["cvr"]), ("16287180", ""))
check("jobnet: internal ad gets the find-job page, 1900-01-01 means no deadline, district wins",
      (n[1]["url"], n[1]["deadline"], n[1]["location"]),
      ("https://jobnet.dk/find-job/c6100943-1bbf-41d6-a1a8-51329184e0e6", "", "Brabrand"))
seen = {}
js.fetch = lambda url, **kw: seen.update(url=url, headers=kw.get("headers")) or json.dumps(JOBNET)
js.search_jobnet("fotonik", 5)
js.fetch = _fetch
check("jobnet: the search sends x-csrf: 1 (without it the BFF answers 401)",
      seen["headers"].get("x-csrf"), "1")
check("jobnet: search string and newest-first order in the query",
      ("searchString=fotonik" in seen["url"], "orderType=PublicationDate" in seen["url"]), (True, True))

# ---- freehire ------------------------------------------------------------------
FREEHIRE = {"meta": {"total": 3}, "data": [
    {"title": "Optical Design Engineers", "company": "Ibsen Photonics", "location": "Farum, Danmark",
     "url": "https://jobs.example/ibsen/42?utm_source=freehire.me&gh_jid=42", "source": "jobnet",
     "posted_at": "2026-11-03T10:06:53Z", "closed_at": None},
    {"title": "Closed one", "company": "X", "url": "https://x.example/1", "closed_at": "2026-11-01T00:00:00Z"},
    {"title": "Student Assistant", "company": "Phanofi", "location": "Lyngby",
     "url": "https://thehub.io/jobs/6ad9e03d9a061a7f2369bb53?utm_source=freehire.me", "source": "thehub",
     "posted_at": None}]}
f = js.parse_freehire(json.dumps(FREEHIRE))
check("freehire: closed postings dropped", [x["title"] for x in f], ["Optical Design Engineers", "Student Assistant"])
check("freehire: utm tracking stripped, the ad id kept", f[0]["url"], "https://jobs.example/ibsen/42?gh_jid=42")
check("freehire: a thehub url matches what search_thehub stores (dedup)",
      f[1]["url"], "https://thehub.io/jobs/6ad9e03d9a061a7f2369bb53")
check("freehire: a retired job.jobnet.dk url becomes the find-job form search_jobnet stores",
      js._strip_tracking("https://job.jobnet.dk/CV/FindWork/Details/8DF952E8-5978-44e7-b25f-6fdc0a1b2c3d"),
      "https://jobnet.dk/find-job/8df952e8-5978-44e7-b25f-6fdc0a1b2c3d")
check("freehire: via names the original board, posted cut to the day, missing date -> ''",
      (f[0]["via"], f[0]["posted"], f[1]["posted"]), ("jobnet", "2026-11-03", ""))
js.fetch = lambda url, **kw: seen.update(url=url) or json.dumps(FREEHIRE)
js.search_freehire("optical", 5)
js.fetch = _fetch
check("freehire: Denmark only, 14-day window", ("countries=dk" in seen["url"],
      "posted_within_days=14" in seen["url"]), (True, True))

# ---- jobdanmark ----------------------------------------------------------------
JOBDANMARK = {"currentPage": 1, "totalItems": 1, "items": [
    {"title": "Platform engineer til Statens IT", "companyName": "Statens It",
     "companyAddress": "Lautruphøj 2, 2750 Ballerup", "publishedDate": "04-11-2026",
     "applicationDeadline": "22-11-2026", "url": "/job/platform-engineer-til-statens-it"}]}
d = js.parse_jobdanmark(json.dumps(JOBDANMARK))
check("jobdanmark: absolute url, postal town as location, dd-mm-yyyy deadline parses",
      (d[0]["url"], d[0]["location"], js._dk_date(d[0]["deadline"])),
      ("https://jobdanmark.dk/job/platform-engineer-til-statens-it", "2750 Ballerup", datetime.date(2026, 11, 22)))
js.fetch = lambda url, **kw: seen.update(body=kw.get("data")) or json.dumps(JOBDANMARK)
js.search_jobdanmark("lægesekretær", 5)
js.fetch = _fetch
check("jobdanmark: POST body is UTF-8 JSON with the free-text filter",
      json.loads(seen["body"].decode("utf-8"))["filters"][0]["value"], "lægesekretær")

# ---- robots.txt gate (wildcards; urllib.robotparser ignores them) --------------
ROBOTS = """User-agent: Googlebot
Disallow: /api/

User-agent: *
Disallow: /jobsoegning*q=ofir
Disallow: /private/
Allow: /private/open
Disallow: /*.pdf$
"""
rules = js.parse_robots(ROBOTS)
check("robots: the '*' group applies, not Googlebot's", js.robots_allows(rules, "/api/v1/jobs"), True)
check("robots: a wildcard rule bans what it names", js.robots_allows(rules, "/jobsoegning.rss?q=ofir"), False)
check("robots: ... and nothing else", js.robots_allows(rules, "/jobsoegning.rss?q=produktchef"), True)
check("robots: the longer Allow beats the shorter Disallow", js.robots_allows(rules, "/private/open/1"), True)
check("robots: plain prefix Disallow", js.robots_allows(rules, "/private/x"), False)
check("robots: '$' anchors the end", (js.robots_allows(rules, "/a.pdf"), js.robots_allows(rules, "/a.pdf?x")),
      (False, True))
check("robots: an empty file allows everything", js.robots_allows(js.parse_robots(""), "/x"), True)
js._ROBOTS["blocked.example"] = js.parse_robots("User-agent: *\nDisallow: /\n")
try:
    js.fetch("https://blocked.example/jobs?q=x")
    refused = None
except js.RobotsDisallowed:
    refused = True
check("robots: fetch refuses a disallowed url before any request", refused, True)

# ---- retry / backoff -----------------------------------------------------------
import urllib.error  # noqa: E402
import urllib.request  # noqa: E402
check("retry-after: delta seconds", js._retry_after_s("5"), 5.0)
check("retry-after: a past HTTP-date is 0", js._retry_after_s("Wed, 21 Oct 2015 07:28:00 GMT"), 0.0)
check("retry-after: junk -> None", js._retry_after_s("soon"), None)


class _Resp:
    def __init__(self, body):
        self.body = body

    def read(self):
        return self.body

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def _err(code, ra=None):
    import email.message
    h = email.message.Message()
    if ra:
        h["Retry-After"] = ra
    return urllib.error.HTTPError("https://x.example/", code, "err", h, None)


def _run(script):
    calls, slept = [], []
    real_open, real_sleep = urllib.request.urlopen, js._sleep

    def fake(req, timeout=None):
        calls.append(req.full_url)
        step = script[len(calls) - 1]
        if isinstance(step, Exception):
            raise step
        return _Resp(step)
    urllib.request.urlopen, js._sleep = fake, slept.append
    try:
        out = js._http("https://x.example/")
    except Exception as e:                                      # noqa: BLE001
        out = e
    finally:
        urllib.request.urlopen, js._sleep = real_open, real_sleep
    return out, len(calls), slept


out, n_calls, slept = _run([_err(503), _err(429, "8"), b"ok"])
check("retry: 503 then 429 then 200 -> body after 3 calls", (out, n_calls), ("ok", 3))
check("retry: the 429's Retry-After (8 s) beats the 6 s backoff", slept[1] >= 8.0, True)
out, n_calls, _ = _run([_err(404)])
check("retry: a 404 is not retried", (getattr(out, "code", None), n_calls), (404, 1))
out, n_calls, _ = _run([_err(429, "120")])
check("retry: a Retry-After past the cap fails fast", (getattr(out, "code", None), n_calls), (429, 1))
out, n_calls, _ = _run([_err(500), _err(500), _err(500)])
check("retry: gives up after two retries", (getattr(out, "code", None), n_calls), (500, 3))

# ---- JOBSRC-HEALTH-001 ---------------------------------------------------------
GOOD = [{"title": "Ingeniør", "company": "A", "url": "https://www.jobindex.dk/vis-job/h1"}]
check("health: rows that look right -> healthy",
      js.check_source("jobindex", search=lambda q, n: GOOD)["status"], "healthy")
check("health: zero rows for the sentinel and the broad retry -> broken",
      js.check_source("jobindex", search=lambda q, n: [])["status"], "broken")
qs = []
js.check_source("jobindex", search=lambda q, n: qs.append(q) or ([] if len(qs) == 1 else GOOD))
check("health: one broader retry, no more", qs, ["ingeniør", "job"])
check("health: a 403 is inconclusive, never broken",
      js.check_source("jobbank", search=lambda q, n: (_ for _ in ()).throw(_err(403)))["status"], "inconclusive")
check("health: company empty on every row -> degraded",
      js.check_source("jobindex", search=lambda q, n: [dict(GOOD[0], company="")])["status"], "degraded")
check("health: rows pointing off the board's host -> degraded",
      "url off" in js.check_source("thehub", search=lambda q, n: GOOD)["detail"], True)
check("health: freehire rows may link anywhere",
      js.check_source("freehire", search=lambda q, n: GOOD)["status"], "healthy")
ylog = os.path.join(_TMP, "hist.jsonl")
for k in (4, 2, 0, 0, 0):
    js.log_yield(ylog, "jobbank", "q", k, None)
js.log_yield(ylog, "thehub", "q", 3, None)
hist = js.yield_history(ylog, "jobbank")
check("health: yield history counts searches, rows and the trailing zero streak",
      (hist["searches"], hist["with_rows"], hist["zero_streak"]), (5, 2, 3))
check("health: a missing log is an empty history", js.yield_history(os.path.join(_TMP, "none"), "x")["searches"], 0)
check("yield log: '' turns logging off", js.log_yield("", "jobbank", "q", 1, None), None)

# ---- JOBSRC-STDOUT-ENCODING-001: redirected output is UTF-8 on any codepage ---
# Each child runs the REAL main() with stdout piped and the codepage forced to
# cp1252 (the Windows default for a redirect), with only the network call stubbed.
# Unpinned, "ø" leaves as byte 0xf8 and "ő" (outside cp1252) raises in print().
import json  # noqa: E402
import subprocess  # noqa: E402

# A red run prints the Danish fixtures; keep the report itself printable.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

AD_COMPANY = "Københavns Optik"
AD_TITLE = "Produktchef til Frø og Kőr"


def run_child(script, body):
    child = "\n".join([
        "import importlib.util, sys",
        "spec = importlib.util.spec_from_file_location('m', sys.argv[1])",
        "m = importlib.util.module_from_spec(spec)",
        "spec.loader.exec_module(m)"] + body)
    env = dict(os.environ, PYTHONIOENCODING="cp1252")
    env.pop("PYTHONUTF8", None)
    return subprocess.run([sys.executable, "-c", child, os.path.join(HERE, script)],
                          capture_output=True, env=env)


def utf8(raw):
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError as e:
        return "NOT UTF-8: %s" % e


p = run_child("job_sources.py", [
    "ad = {'source': 'jobindex', 'title': %a, 'company': %a, 'location': '', 'url': 'u',"
    " 'posted': '', 'deadline': ''}" % (AD_TITLE, AD_COMPANY),
    "m.SOURCES = {'jobindex': lambda q, limit: [ad]}",
    "sys.argv = ['job_sources.py', 'search', '--q', 'x', '--source', 'jobindex', '--json']",
    "m.main()"])
check("stdout: search --json exits 0 under a cp1252 console", p.returncode, 0)
out = utf8(p.stdout)
try:
    got = json.loads(out)["rows"][0]["title"]
except (ValueError, KeyError, IndexError):
    got = out[:80]
check("stdout: search --json bytes parse as UTF-8 JSON, letters intact", got, AD_TITLE)

p = run_child("discover-positions.py", [
    "m.get_doc = lambda: (1, {'rows': [[1, %a, %a, '']], 'urls': {}, 'discovered': {}})"
    % (AD_COMPANY, AD_TITLE),
    "sys.argv = ['discover-positions.py', 'context']",
    "m.main()"])
check("stdout: discover-positions context exits 0 under a cp1252 console", p.returncode, 0)
check("stdout: discover-positions context bytes are UTF-8, row text intact",
      (AD_COMPANY + " | " + AD_TITLE) in utf8(p.stdout), True)

# ---- JOBSRC-CAREERHOUND-001 (permission from Career Hound 2026-11-02) -------------------
import tempfile  # noqa: E402

FEED = json.dumps({"page": 1, "jobs": [
    {"id": 7, "title": "Hardware Project Manager", "company": {"name": "Acme Optics"},
     "location": "Copenhagen", "url": "/jobs/7", "postedAt": "2026-11-02T08:00:00Z"},
    {"id": 8, "jobTitle": "Barista", "companyName": "Cafe", "applyUrl": "https://cafe.example/apply"},
]})
rows = js.parse_careerhound(FEED, "application/json")
check("careerhound: JSON feed rows parsed", len(rows), 2)
check("careerhound: relative url made absolute, nested company name, date cut to the day",
      (rows[0]["url"], rows[0]["company"], rows[0]["posted"]),
      ("https://www.careerhound.io/jobs/7", "Acme Optics", "2026-11-02"))
NEXT = ('<html><script id="__NEXT_DATA__" type="application/json">'
        + json.dumps({"props": {"pageProps": {"results": [{"title": "Optical Engineer", "company": "Lumen",
                                                          "url": "https://lumen.example/j/1"}]}}})
        + '</script></html>')
check("careerhound: __NEXT_DATA__ page parsed", [r["title"] for r in js.parse_careerhound(NEXT, "text/html")],
      ["Optical Engineer"])
FLIGHT = ('<script>self.__next_f.push([1,"' + json.dumps('5:' + json.dumps(
    {"jobs": [{"title": "NPI Engineer", "employer": "Photon", "link": "https://p.example/2"}]}))[1:-1] + '"])</script>')
check("careerhound: app-router flight chunk parsed", [r["company"] for r in js.parse_careerhound(FLIGHT, "text/html")],
      ["Photon"])
check("careerhound: query filters on title or company words",
      [r["title"] for r in js.search_careerhound("hardware manager", cookie="x=y",
                                                 getter=lambda c: (200, "https://www.careerhound.io/api/view-jobs",
                                                                   "application/json", FEED))],
      ["Hardware Project Manager"])
try:
    js.search_careerhound("x", cookie="x=y", getter=lambda c: (200, "https://www.careerhound.io/login", "text/html", ""))
    expired = None
except js.CareerHoundAuthError as e:
    expired = "refresh" in str(e)
check("careerhound: landing on /login is reported as an expired session", expired, True)
with tempfile.TemporaryDirectory() as td:
    f = os.path.join(td, "careerhound_session")
    with open(f, "w", encoding="utf-8") as fh:
        fh.write("abc123\n")
    check("careerhound: a bare cookie value gets the NextAuth cookie name",
          js.careerhound_cookie(f), "__Secure-next-auth.session-token=abc123")
    check("careerhound: missing session file -> None", js.careerhound_cookie(os.path.join(td, "nope")), None)
_src, _acc = js.SOURCES, js.ACCOUNT_SOURCES
js.SOURCES = {"jobindex": lambda q, n: [], "careerhound": lambda q, n: (_ for _ in ()).throw(RuntimeError("called"))}
js.ACCOUNT_SOURCES = {"careerhound": lambda: None}
import io  # noqa: E402
from contextlib import redirect_stdout  # noqa: E402
buf = io.StringIO()
with redirect_stdout(buf):
    js.cmd_search(type("A", (), {"source": "all", "q": "pm", "limit": 5, "json": True})())
js.SOURCES, js.ACCOUNT_SOURCES = _src, _acc
check("careerhound: 'all' skips the account source when no session file exists",
      json.loads(buf.getvalue())["errors"], [])

if fails:
    print("FAIL (%d):" % len(fails))
    for f in fails:
        print("  - " + f)
    sys.exit(1)
print("PASS - job_sources parsers (%d checks)" % sum(1 for ln in open(__file__, encoding="utf-8") if ln.lstrip().startswith("check(")))
