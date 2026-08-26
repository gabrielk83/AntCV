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

# ---- deadline helper --------------------------------------------------------
check("dk date parses", js._dk_date("Frist: 07.09.2026"), datetime.date(2026, 9, 7))
check("dk date rejects junk", js._dk_date("snarest muligt"), None)

if fails:
    print("FAIL (%d):" % len(fails))
    for f in fails:
        print("  - " + f)
    sys.exit(1)
print("PASS - job_sources parsers (%d checks)" % 15)
