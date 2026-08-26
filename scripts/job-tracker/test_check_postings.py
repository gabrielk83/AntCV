# POSTING-OBSOLETE-001 - truth table for the obsolete-posting classifier and the
# archive edit. Run: python scripts/job-tracker/test_check_postings.py (exit 0 = pass)
#
# Network-free. The cases that matter most are the NEGATIVE ones: archiving a
# live role is worse than carrying a dead one for two days, so a bot wall, a
# timeout and a 5xx must never count as evidence, and a single 404 must not be
# enough on its own.
import datetime
import importlib.util
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("cp", os.path.join(HERE, "check-postings.py"))
cp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cp)

TODAY = datetime.date(2026, 8, 26)
U = "https://careers.example.com/jobs/1234-optical-pm"
JD = "<html><body><h1>Optical Product Manager</h1><p>You will own the roadmap.</p></body></html>"

fails = []


def check(name, got, want):
    if got != want:
        fails.append("%s\n    got:  %r\n    want: %r" % (name, got, want))


def verdict(status, final=None, text=JD, req=U):
    return cp.classify(status, final if final is not None else req, req, text, TODAY)[0]


# ---- hard evidence ----------------------------------------------------------
check("404 is GONE", verdict(404), "GONE")
check("410 is GONE", verdict(410), "GONE")
check("200 with a real JD is LIVE", verdict(200), "LIVE")

# ---- closed-ad phrases (EN / DA / SV) = CLOSED, hard evidence ---------------
# A page SAYING the ad is over is a positive statement, not an absence, so it does
# not wait for corroboration. Verified live 2026-08-26 against the real LinkedIn
# guest page for req 4434843281 (Verisure), which renders exactly this string.
check("LinkedIn closed-ad wording is CLOSED",
      verdict(200, text="<div>No longer accepting applications</div>"), "CLOSED")
check("Danish closed-ad wording is CLOSED",
      verdict(200, text="<p>Stillingen er besat.</p>"), "CLOSED")
check("Swedish closed-ad wording is CLOSED",
      verdict(200, text="<p>Tjansten ar tillsatt</p>".replace("Tjansten ar", "Tjänsten är")),
      "CLOSED")
check("CLOSED is graded hard (archives without a second run)",
      "CLOSED" in cp.HARD_VERDICTS, True)
check("GONE is graded soft (must be corroborated)", "GONE" in cp.SOFT_VERDICTS, True)
check("WALLED is in neither grade - it can never archive anything",
      ("WALLED" in cp.HARD_VERDICTS, "WALLED" in cp.SOFT_VERDICTS), (False, False))
check("ERROR is in neither grade",
      ("ERROR" in cp.HARD_VERDICTS, "ERROR" in cp.SOFT_VERDICTS), (False, False))

# ---- NEGATIVE CONTROLS: none of these may ever be treated as evidence --------
check("403 bot wall is WALLED, not GONE", verdict(403), "WALLED")
check("401 is WALLED", verdict(401), "WALLED")
check("429 rate limit is WALLED", verdict(429), "WALLED")
check("LinkedIn 999 is WALLED", verdict(999), "WALLED")
check("Cloudflare interstitial is WALLED",
      verdict(200, text="<title>Just a moment...</title><p>Enable JavaScript and cookies</p>"),
      "WALLED")
check("500 is ERROR, not GONE", verdict(500), "ERROR")
check("503 is ERROR", verdict(503), "ERROR")
check("network failure (status None) is WALLED, never a strike", verdict(None), "WALLED")

# ---- redirect handling ------------------------------------------------------
check("redirect to a careers index with no job identity is SUSPECT",
      verdict(200, final="https://careers.example.com/jobs"), "SUSPECT")
check("redirect that still lands on a posting path stays LIVE",
      verdict(200, final="https://careers.example.com/en/job/1234-optical-pm"), "LIVE")
check("trailing-slash-only difference is not a redirect",
      verdict(200, final=U + "/"), "LIVE")

# ---- stated deadline: trusted only on the two Danish boards -----------------
DK = "https://www.jobbank.dk/job/3103475/acme/optical-pm/"
check("past deadline on jobbank is EXPIRED",
      cp.classify(200, DK, DK, "<div>Frist: 01.01.2020</div>", TODAY)[0], "EXPIRED")
check("future deadline on jobbank is LIVE",
      cp.classify(200, DK, DK, "<div>Frist: 07.09.2026</div>", TODAY)[0], "LIVE")
check("a 'deadline' string on an ARBITRARY host is not trusted",
      cp.classify(200, U, U, "<div>Deadline: 01.01.2020</div>", TODAY)[0], "LIVE")

# ---- board archive redirect (hard evidence, seen live on 2026-08-26) --------
ARK = "https://www.jobindexarkiv.dk/arkiv/vis/r13891995"
JIX = "https://www.jobindex.dk/jobannonce/r13891995/produktchef-til-lysteam"
check("a jobindex ad that 301s to the ARCHIVE is EXPIRED, not merely SUSPECT",
      cp.classify(200, ARK, JIX, JD, TODAY)[0], "EXPIRED")
check("the /arkiv/vis/ hop is caught too",
      cp.classify(200, "https://www.jobindex.dk/arkiv/vis/h1676309", JIX, JD, TODAY)[0], "EXPIRED")
check("a normal jobindex posting URL is untouched",
      cp.classify(200, JIX, JIX, JD, TODAY)[0], "LIVE")
# Guard the obvious over-match: 'arkiv' inside a company slug is not an archive.
check("a company slug containing 'arkiv' is not an archive redirect",
      cp.classify(200, "https://careers.example.com/job/rigsarkivet-pm",
                  "https://careers.example.com/job/rigsarkivet-pm", JD, TODAY)[0], "LIVE")

# ---- the two-strike rule ----------------------------------------------------
# Only GONE/SUSPECT accumulate; a LIVE resets; WALLED/ERROR hold steady. This
# mirrors the loop in cmd_check.
def run(verdicts, start=0):
    misses = start
    for v in verdicts:
        if v == "LIVE":
            misses = 0
        elif v in cp.SOFT_VERDICTS:
            misses += 1
    return misses


check("one 404 alone is below the archive threshold", run(["GONE"]) >= cp.STRIKES_TO_ARCHIVE, False)
check("two 404s reach the threshold", run(["GONE", "GONE"]) >= cp.STRIKES_TO_ARCHIVE, True)
check("a LIVE between two 404s resets the count",
      run(["GONE", "LIVE", "GONE"]) >= cp.STRIKES_TO_ARCHIVE, False)
check("a wall after a 404 does NOT push the row over the line",
      run(["GONE", "WALLED"]) >= cp.STRIKES_TO_ARCHIVE, False)
check("an error after a 404 does NOT push the row over the line",
      run(["GONE", "ERROR"]) >= cp.STRIKES_TO_ARCHIVE, False)
check("mixed GONE then SUSPECT still corroborates", run(["GONE", "SUSPECT"]) >= cp.STRIKES_TO_ARCHIVE, True)

# ---- the archive edit -------------------------------------------------------
def fresh():
    return [7, "Acme", "Optical PM", "Copenhagen", "", "Proposed", "strong", "OPEN",
            "Identified (posting saved)", "Review", "\U0001F50E strong EO fit", "acme", "DDEBF7"]


r = cp.archive_row(fresh(), "GONE", "HTTP 404", TODAY)
check("archive sets the Archive band (what the island's default filter hides)",
      r[12], cp.ARCHIVE_BAND)
check("archive sets a closed tracked status (drops the row out of Top-5)",
      r[8], cp.ARCHIVE_STATUS)
check("archive keeps the original why-note under the marker",
      r[10].endswith("\U0001F50E strong EO fit"), True)
check("archive stamps the date and reason", "posting closed 2026-08-26" in r[10], True)
check("the row is NOT deleted - company/role survive", (r[1], r[2]), ("Acme", "Optical PM"))

# Idempotent: a second sweep must not stack a second marker.
r2 = cp.archive_row(r, "GONE", "HTTP 404", TODAY)
check("re-archiving does not stack markers", r2[10].count("posting closed"), 1)

# A short row (older doc shape) must not throw.
short = [1, "Acme", "Optical PM"]
rs = cp.archive_row(short, "GONE", "HTTP 404", TODAY)
check("a short legacy row is padded, not crashed", (len(rs) >= 13, rs[12]), (True, cp.ARCHIVE_BAND))

# ---- is_archived / row_uk ---------------------------------------------------
check("is_archived true for the archive band", cp.is_archived(r), True)
check("is_archived false for a live tier", cp.is_archived(fresh()), False)
check("row_uk prefers the explicit key", cp.row_uk(fresh()), "acme")
check("row_uk falls back to company|role", cp.row_uk([1, "A", "B"]), "A|B")

if fails:
    print("FAIL (%d):" % len(fails))
    for f in fails:
        print("  - " + f)
    sys.exit(1)
print("PASS - check-postings classifier + archive edit (45 checks)")
