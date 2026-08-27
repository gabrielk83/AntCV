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
# Only GONE/SUSPECT accumulate; a LIVE resets; WALLED/ERROR hold steady; and a
# soft verdict strikes at most ONCE PER DAY. This drives the REAL cp.next_misses
# - never a mirror of it, or a change to the rule would leave the test green.
DAY1 = datetime.date(2026, 8, 26)
DAY2 = datetime.date(2026, 8, 27)


def run(steps, start=0):
    """steps = [(verdict, day), ...] -> final miss count."""
    ent = {"misses": start}
    for v, day in steps:
        misses, struck = cp.next_misses(ent, v, day)
        ent = {"misses": misses, "last_strike": struck}
    return ent["misses"]


def archives(steps, start=0):
    return run(steps, start) >= cp.STRIKES_TO_ARCHIVE


check("one 404 alone is below the archive threshold", archives([("GONE", DAY1)]), False)
check("two 404s on SEPARATE days reach the threshold",
      archives([("GONE", DAY1), ("GONE", DAY2)]), True)
check("a LIVE between two 404s resets the count",
      archives([("GONE", DAY1), ("LIVE", DAY1), ("GONE", DAY2)]), False)
check("a wall after a 404 does NOT push the row over the line",
      archives([("GONE", DAY1), ("WALLED", DAY2)]), False)
check("an error after a 404 does NOT push the row over the line",
      archives([("GONE", DAY1), ("ERROR", DAY2)]), False)
check("mixed GONE then SUSPECT still corroborates",
      archives([("GONE", DAY1), ("SUSPECT", DAY2)]), True)

# The regression this gate exists for: the discovery run and the nightly both
# sweep on the days they overlap, so ONE blip is probed twice within the hour.
check("two 404s on the SAME day are one strike, not two",
      run([("GONE", DAY1), ("GONE", DAY1)]), 1)
check("and therefore do NOT archive a live role",
      archives([("GONE", DAY1), ("GONE", DAY1)]), False)
check("a third same-day probe still does not stack",
      run([("GONE", DAY1), ("GONE", DAY1), ("SUSPECT", DAY1)]), 1)
check("the next day's 404 does corroborate and archive",
      archives([("GONE", DAY1), ("GONE", DAY1), ("GONE", DAY2)]), True)

# last_strike must stay distinct from `last` (the probe date): a WALLED probe
# later the same day is not a strike and must not hold the count back a day.
check("a wall on day 1 does not consume day 2's strike slot",
      archives([("GONE", DAY1), ("WALLED", DAY2), ("GONE", DAY2)]), True)
check("a LIVE clears the strike stamp so a later 404 can still count",
      run([("GONE", DAY1), ("LIVE", DAY1), ("GONE", DAY1)]), 1)

# Legacy entries (written before last_strike existed) must not be trusted as
# 'already struck today' - a missing stamp counts normally.
check("an entry with no last_strike still increments",
      cp.next_misses({"misses": 1, "last": DAY1.isoformat()}, "GONE", DAY1)[0], 2)
check("LIVE clears the stamp", cp.next_misses({"misses": 3, "last_strike": "2026-08-26"},
                                              "LIVE", DAY1), (0, ""))
check("WALLED carries the stamp forward untouched",
      cp.next_misses({"misses": 1, "last_strike": "2026-08-26"}, "WALLED", DAY2),
      (1, "2026-08-26"))

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
print("PASS - check-postings classifier + per-day strike gate + archive edit")
