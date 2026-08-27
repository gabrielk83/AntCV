#!/usr/bin/env python3
"""check-postings.py — POSTING-OBSOLETE-001.

Sweep every job-tracker row's posting URL and ARCHIVE the rows whose posting has
gone obsolete, so the JD list stops showing dead roles.

Hiding mechanism (deliberately reuses what the island already has — no UI change,
no PWA asset touched, so no cache-bust and no shift claim):
  * band (row index 12) -> "D9D9D9" = the Archive tier. defaultJLFilters() in
    JobTracker.tsx leaves Archive UNCHECKED, so an archived row disappears from
    the Job List the moment the doc reloads, and the owner can tick the Archive
    swatch to see it again. Nothing is deleted (hide over delete).
  * tracked status (index 8) -> "Archive / closed", which also satisfies the
    island's isClosedRow() so the row leaves Top-5 and the next live row refills.
  * queue[uk] -> False, so the gen nightly can never spend tokens drafting a CV
    for a posting that no longer exists.

FALSE-POSITIVE DISCIPLINE — archiving a LIVE role is worse than carrying a dead
one for two days, so evidence is GRADED by what it actually proves. The split is
between the site STATING the ad is over (a positive fact) and the ad merely being
ABSENT (which a CDN edge, a redirect race or a routing blip also produces):

  hard evidence -> archives on FIRST sight
  CLOSED   the page says so in words ("no longer accepting applications",
           "stillingen er besat", ...).
  EXPIRED  the posting states a deadline that has passed (trusted only on
           jobbank.dk / jobindex.dk, where the field is structured), or the board
           has moved the ad to its own archive.

  soft evidence -> needs TWO strikes on separate DAYS
  GONE     HTTP 404/410. Absence, not a statement.
  SUSPECT  redirected off the posting onto something with no job identity.

  no evidence -> NEVER counts, ever
  WALLED   401/403/429/999/CF challenge. A bot wall says nothing about whether
           the job is open.
  ERROR    timeout/DNS/TLS/5xx.
  LIVE     resets the strike count to zero.
Strikes live per-row in doc["postingcheck"][uk] (substructure-keyed, so parallel
routines cannot clobber each other's counts through one shared blob), and a soft
verdict may strike AT MOST ONCE PER CALENDAR DAY — two routines sweeping the same
day must not turn one CDN blip into two corroborating strikes (see next_misses).

Usage:
  python scripts/job-tracker/check-postings.py check              # dry run
  python scripts/job-tracker/check-postings.py check --apply      # archive
  python scripts/job-tracker/check-postings.py check --json --limit 20

Auth: ~/.antcv/token, same relay contract as discover-positions.py.
Network-free unit test: scripts/job-tracker/test_check_postings.py
"""
import argparse
import datetime
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

RELAY = os.environ.get("ANTCV_RELAY",
                       "https://antcv-access-relay.karp-gabriel-a.workers.dev").rstrip("/")
_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
       "(KHTML, like Gecko) Chrome/124 Safari/537.36")

ARCHIVE_BAND = "D9D9D9"
ARCHIVE_STATUS = "Archive / closed"
STRIKES_TO_ARCHIVE = 2
# The site stated the ad is over -> act now. Absence alone -> corroborate first.
HARD_VERDICTS = ("CLOSED", "EXPIRED")
SOFT_VERDICTS = ("GONE", "SUSPECT")

# Phrases an employer/board shows once an ad is closed. Matched case-insensitively
# on the page text. HARD evidence (CLOSED archives on first sight), so every entry
# must be unambiguous on its own - keep this list narrow, and never add a phrase
# that could plausibly appear on a page for a DIFFERENT, still-open job.
DEAD_PHRASES = [
    # English
    "no longer accepting applications", "this job is no longer available",
    "this position is no longer available", "position has been filled",
    "posting has expired", "this posting is closed", "job posting is no longer",
    "applications are now closed", "vacancy is closed", "job has been closed",
    "this job has expired", "no longer available for applications",
    # Danish
    "stillingen er besat", "ansøgningsfristen er udløbet", "ansoegningsfristen er udloebet",
    "jobbet er ikke længere tilgængeligt", "annoncen er udløbet",
    "opslaget er lukket", "stillingsopslaget er udløbet", "jobannoncen er udløbet",
    # Swedish
    "tjänsten är tillsatt", "annonsen har utgått", "ansökningstiden har gått ut",
]

# Explicit application-deadline fields, trusted only on the two Danish boards
# where the label is a real structured field rather than prose.
DEADLINE_HOSTS = ("jobbank.dk", "jobindex.dk")
DEADLINE_RE = re.compile(
    r"(?:frist|ansøgningsfrist|ansoegningsfrist|deadline|apply\s+before)\s*:?\s*"
    r"(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{4})", re.I)

# A final URL with none of these looks like a careers INDEX, not a posting.
_JOB_PATH_HINT = re.compile(r"/(job|jobs|vis-job|stilling|career|vacanc|position|opening|o)/|"
                            r"[?&](jobid|job_id|reqid|req_id|gh_jid|career_job_req_id)=", re.I)

# Boards that move an ad to a dedicated ARCHIVE once it expires. Landing there is
# the site stating outright that the ad is over — the same grade of fact as a
# stated past deadline, so it archives on first sight rather than on two strikes.
# jobindex.dk 301s an expired /jobannonce/ to /arkiv/vis/ and then to
# jobindexarkiv.dk (observed on the FDPARTS + KK Group rows, 2026-08-26).
_ARCHIVE_URL = re.compile(r"jobindexarkiv\.dk|/arkiv/vis/", re.I)


# ------------------------------------------------------------------ relay glue

def _token():
    p = os.path.expanduser("~/.antcv/token")
    if not os.path.exists(p):
        sys.exit("NO TOKEN at ~/.antcv/token — owner must re-save it from the PWA console.")
    return open(p, encoding="utf-8").read().strip()


def _req(path, method="GET", body=None, timeout=60):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(RELAY + path, data=data, method=method, headers={
        "Authorization": "Bearer " + _token(), "User-Agent": _UA,
        "Origin": "https://antcv.pages.dev", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            return resp.status, json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, {"error": e.read().decode()[:300]}


def get_doc():
    c, b = _req("/api/job-tracker")
    if c != 200:
        sys.exit("job-tracker GET failed: %s %s" % (c, str(b)[:200]))
    return b.get("rev"), (b.get("doc") or {})


def put_doc(doc, base_rev):
    return _req("/api/job-tracker", "PUT", {"doc": doc, "base_rev": base_rev})


# ------------------------------------------------------------------- probing

def _parse_deadline(text, final_url):
    host = urllib.parse.urlparse(final_url or "").netloc.lower()
    if not any(h in host for h in DEADLINE_HOSTS):
        return None
    m = DEADLINE_RE.search(text or "")
    if not m:
        return None
    d = m.group(1)
    mm = re.match(r"(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})", d)
    try:
        return datetime.date(int(mm.group(3)), int(mm.group(2)), int(mm.group(1)))
    except (ValueError, AttributeError):
        return None


def classify(status, final_url, requested_url, text, today=None):
    """Pure, network-free verdict. Returns (verdict, detail)."""
    today = today or datetime.date.today()
    if status in (404, 410):
        return "GONE", "HTTP %d" % status
    if status in (401, 403, 429, 999) or status is None:
        return "WALLED", "HTTP %s" % status
    if status >= 500:
        return "ERROR", "HTTP %d" % status
    body = re.sub(r"<[^>]+>", " ", text or "")
    body = re.sub(r"\s+", " ", body).lower()
    if "just a moment" in body[:400] or "enable javascript and cookies" in body[:800]:
        return "WALLED", "bot challenge"
    if final_url and _ARCHIVE_URL.search(final_url):
        return "EXPIRED", "board moved the ad to its archive (%s)" % final_url[:70]
    dl = _parse_deadline(body, final_url)
    if dl and dl < today:
        return "EXPIRED", "stated deadline %s has passed" % dl.isoformat()
    for p in DEAD_PHRASES:
        if p in body:
            return "CLOSED", "page says: %r" % p
    # Redirected off the posting onto something with no job identity at all.
    if final_url and requested_url and final_url.rstrip("/") != requested_url.rstrip("/"):
        if not _JOB_PATH_HINT.search(final_url):
            return "SUSPECT", "redirected to non-posting page %s" % final_url[:80]
    return "LIVE", "HTTP %d" % status


def probe(url, timeout=25):
    req = urllib.request.Request(url, headers={
        "User-Agent": _UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en,da;q=0.8"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read(400_000)
            for enc in ("utf-8", "cp1252", "iso-8859-1"):
                try:
                    text = raw.decode(enc)
                    break
                except UnicodeDecodeError:
                    continue
            else:
                text = raw.decode("utf-8", "replace")
            return resp.status, resp.geturl(), text
    except urllib.error.HTTPError as e:
        try:
            body = e.read(200_000).decode("utf-8", "replace")
        except Exception:                                        # noqa: BLE001
            body = ""
        return e.code, getattr(e, "url", url), body
    except Exception as e:                                       # noqa: BLE001
        return None, url, "__probe_error__ %s: %s" % (type(e).__name__, e)


# ------------------------------------------------------------------ row edits

def row_uk(row):
    return row[11] if len(row) > 11 and row[11] else (str(row[1]) + "|" + str(row[2]))


def is_archived(row):
    return str(row[12] if len(row) > 12 else "").upper() == ARCHIVE_BAND


def archive_row(row, verdict, detail, today):
    """Hide the row: Archive band + closed status + an audit note on the flag.
    Idempotent — re-running never stacks a second marker."""
    while len(row) < 13:
        row.append("")
    row[12] = ARCHIVE_BAND
    row[8] = ARCHIVE_STATUS
    note = "⌛ posting closed %s (%s: %s)" % (today.isoformat(), verdict.lower(), detail)
    prev = str(row[10] or "")
    prev = re.sub(r"^⌛ posting closed [^\n]*\n?", "", prev)
    row[10] = note + ("\n" + prev if prev.strip() else "")
    return row


# ------------------------------------------------------------- strike counting

def next_misses(prev, verdict, today):
    """Strike count for one row after one probe. Returns (misses, last_strike).

    A soft verdict counts AT MOST ONCE PER CALENDAR DAY. The sweep is wired into
    two routines now — the twice-weekly discovery run and the nightly — so on the
    days they overlap a row is probed twice within the hour. Without this gate the
    two probes of a single CDN blip corroborate each other and archive a LIVE role,
    which is the exact false positive the graded-evidence design exists to prevent.
    Corroboration has to come from a DIFFERENT day, not a different process.

    `last_strike` is the date of the last increment, kept separate from `last`
    (the date of the last probe) so a WALLED/ERROR probe later the same day cannot
    be mistaken for a strike and hold the count back a day.
    """
    prev = prev or {}
    misses = int(prev.get("misses") or 0)
    struck = str(prev.get("last_strike") or "")
    if verdict == "LIVE":
        return 0, ""
    if verdict in SOFT_VERDICTS:
        if struck == today.isoformat():
            return misses, struck                    # already struck today
        return misses + 1, today.isoformat()
    return misses, struck                            # WALLED / ERROR hold steady


# ---------------------------------------------------------------------- main

def cmd_check(args):
    today = datetime.date.today()
    results = []

    for attempt in range(4):
        rev, doc = get_doc()
        doc.setdefault("rows", [])
        doc.setdefault("urls", {})
        doc.setdefault("queue", {})
        doc.setdefault("postingcheck", {})
        rows, urls = doc["rows"], doc["urls"]
        results = []
        archived = []

        checked = 0
        for row in rows:
            uk = row_uk(row)
            url = (urls.get(uk) or "").strip()
            if not url:
                continue
            if is_archived(row):
                continue
            if args.only and uk not in args.only.split(","):
                continue
            if args.limit and checked >= args.limit:
                break
            checked += 1

            status, final_url, text = probe(url, args.timeout)
            if isinstance(text, str) and text.startswith("__probe_error__"):
                verdict, detail = "ERROR", text.replace("__probe_error__ ", "")
            else:
                verdict, detail = classify(status, final_url, url, text, today)

            ent = dict(doc["postingcheck"].get(uk) or {})
            misses, struck = next_misses(ent, verdict, today)
            ent.update({"misses": misses, "last": today.isoformat(),
                        "last_strike": struck,
                        "status": verdict, "detail": detail[:200]})
            doc["postingcheck"][uk] = ent

            will_archive = (verdict in HARD_VERDICTS) or (
                verdict in SOFT_VERDICTS and misses >= STRIKES_TO_ARCHIVE)
            if will_archive and args.apply:
                archive_row(row, verdict, detail, today)
                doc["queue"][uk] = False
                ent["archived_on"] = today.isoformat()
                archived.append(uk)

            results.append({"uk": uk, "company": row[1] if len(row) > 1 else "",
                            "role": row[2] if len(row) > 2 else "", "url": url,
                            "verdict": verdict, "detail": detail[:200],
                            "misses": misses, "archived": bool(will_archive and args.apply),
                            "would_archive": bool(will_archive)})

        if not args.apply:
            break
        c, b = put_doc(doc, rev)
        if c == 200:
            break
        if c == 409:
            print("  409 (rev moved to %s), re-checking (attempt %d)..." % (b.get("rev"), attempt + 1))
            continue
        sys.exit("PUT failed: %s %s" % (c, str(b)[:200]))

    counts = {}
    for r in results:
        counts[r["verdict"]] = counts.get(r["verdict"], 0) + 1

    if args.json:
        print(json.dumps({"checked": len(results), "counts": counts,
                          "applied": bool(args.apply), "rows": results},
                         ensure_ascii=False, indent=1))
        return

    print("checked %d row(s) — %s" % (
        len(results), ", ".join("%s %d" % (k, v) for k, v in sorted(counts.items())) or "nothing"))
    for r in sorted(results, key=lambda x: x["verdict"]):
        if r["verdict"] == "LIVE":
            continue
        mark = "ARCHIVED" if r["archived"] else ("would archive" if r["would_archive"]
                                                 else "strike %d/%d" % (r["misses"], STRIKES_TO_ARCHIVE))
        print("  [%-7s] %s / %s  -> %s" % (r["verdict"], r["company"], r["role"], mark))
        print("            %s  (%s)" % (r["url"][:100], r["detail"]))
    live = counts.get("LIVE", 0)
    print("\n%d live, %d archived%s" % (
        live, sum(1 for r in results if r["archived"]),
        "" if args.apply else "  (dry run — pass --apply to write)"))


def main():
    # Routines redirect this to a file on Windows, where stdout defaults to the
    # console codepage and a Danish company name then writes cp1252 bytes into
    # what the caller reads back as UTF-8 JSON. Pin it.
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass
    ap = argparse.ArgumentParser(description="Archive job-tracker rows whose posting is obsolete")
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("check")
    c.add_argument("--apply", action="store_true", help="write the archive edits to the doc")
    c.add_argument("--json", action="store_true")
    c.add_argument("--limit", type=int, default=0, help="probe at most N rows")
    c.add_argument("--only", default="", help="comma-separated row keys to probe")
    c.add_argument("--timeout", type=int, default=25)
    c.set_defaults(fn=cmd_check)
    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
