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
check("sources: thehub registered; LinkedIn and careerhound deliberately absent",
      sorted(js.SOURCES), ["jobbank", "jobindex", "thehub"])

# ---- deadline helper --------------------------------------------------------
check("dk date parses", js._dk_date("Frist: 07.09.2026"), datetime.date(2026, 9, 7))
check("dk date rejects junk", js._dk_date("snarest muligt"), None)

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

if fails:
    print("FAIL (%d):" % len(fails))
    for f in fails:
        print("  - " + f)
    sys.exit(1)
print("PASS - job_sources parsers (%d checks)" % 20)
