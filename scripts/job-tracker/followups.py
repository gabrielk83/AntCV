#!/usr/bin/env python3
"""followups.py — FOLLOWUP-001 (2026-11-05, from ai-job-search's /outcome followup).

A submitted application that has gone quiet gets a short, polite follow-up after
QUIET_DAYS (10), at most MAX_FOLLOWUPS (2) times. The tracker had no "submitted on"
date and no follow-up log, so nothing could say which rows were due. This script is the
deterministic half (dates, counts, the doc write); the drafting is the agent's, under
the rules in scripts/job-tracker/README.md "Follow-ups":
  60-120 words, the application's language, every claim from the materials already
  submitted (no new claims), one value reminder, one timeline question, no "just
  checking in"; drafts only - the owner sends.

State lives in the job-tracker doc, top-level map `followups` (the PWA keeps unknown
top-level keys, TrackerDoc's index signature + normalizeDoc's spread):
  followups[uk] = {"submitted": "YYYY-MM-DD", "submitted_source": "first-seen"|"owner",
                   "sent": ["YYYY-MM-DD", ...], "thanks": ["YYYY-MM-DD", ...]}
"first-seen" = the first sweep that saw the row as Submitted: a LOWER bound on the real
date; `set-submitted` replaces it with the owner's date.

Commands:
  stamp                          stamp today on Submitted rows with no date (nightly)
  due [--days 10] [--json]       rows due a follow-up (read-only)
  log --uk UK [--date D] [--kind followup|thanks]   after the owner sent it
  set-submitted --uk UK --date D
"""
import argparse
import datetime
import importlib.util
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("discover_positions", os.path.join(HERE, "discover-positions.py"))
_dp = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_dp)
get_doc, put_doc = _dp.get_doc, _dp.put_doc

SUBMITTED = "Submitted"
QUIET_DAYS = 10
MAX_FOLLOWUPS = 2
COL_COMPANY, COL_ROLE, COL_STATUS, COL_UK = 1, 2, 8, 11


def _day(s):
    try:
        return datetime.date.fromisoformat(str(s)[:10])
    except (TypeError, ValueError):
        return None


def _rows(doc):
    for row in doc.get("rows") or []:
        if isinstance(row, list) and len(row) > COL_UK and row[COL_UK]:
            yield row


def stamp(doc, today):
    """Stamp today as the submitted date on Submitted rows that have none. -> [uk]"""
    fu = doc.setdefault("followups", {})
    done = []
    for row in _rows(doc):
        uk = row[COL_UK]
        if str(row[COL_STATUS]).strip() == SUBMITTED and not (fu.get(uk) or {}).get("submitted"):
            fu.setdefault(uk, {}).update(submitted=today.isoformat(), submitted_source="first-seen")
            done.append(uk)
    return done


def due(doc, today, days=QUIET_DAYS):
    """Submitted rows quiet for `days` since the submitted date or the last follow-up,
    with fewer than MAX_FOLLOWUPS sent. Rows with an unreadable date are reported, not
    guessed (`date_problem`)."""
    fu = doc.get("followups") or {}
    notes = doc.get("notes") or {}
    urls = doc.get("urls") or {}
    arts = doc.get("artifacts") or {}
    out = []
    for row in _rows(doc):
        uk = row[COL_UK]
        if str(row[COL_STATUS]).strip() != SUBMITTED:
            continue
        rec = fu.get(uk) or {}
        sent = [d for d in rec.get("sent") or [] if _day(d)]
        if len(sent) >= MAX_FOLLOWUPS:
            continue
        since = _day(max(sent)) if sent else _day(rec.get("submitted"))
        base = {"uk": uk, "company": row[COL_COMPANY], "role": row[COL_ROLE], "sent": len(sent),
                "posting": urls.get(uk, ""), "hiring_manager": (notes.get(uk) or {}).get("hm", "")
                if isinstance(notes.get(uk), dict) else "",
                "application_id": (arts.get(uk) or {}).get("application_id")}
        if since is None:
            out.append(dict(base, date_problem="no readable submitted date - run stamp or set-submitted"))
            continue
        quiet = (today - since).days
        if quiet >= days:
            out.append(dict(base, quiet_days=quiet, since=since.isoformat(),
                            since_kind="follow-up" if sent else rec.get("submitted_source", "?"),
                            last_allowed=len(sent) + 1 == MAX_FOLLOWUPS))
    return sorted(out, key=lambda r: -r.get("quiet_days", 10 ** 6))


def log(doc, uk, day, kind="followup"):
    if not any(r[COL_UK] == uk for r in _rows(doc)):
        raise KeyError("no row with urlkey %r" % uk)
    rec = doc.setdefault("followups", {}).setdefault(uk, {})
    key = "sent" if kind == "followup" else "thanks"
    if kind == "followup" and len(rec.get("sent") or []) >= MAX_FOLLOWUPS:
        raise ValueError("%s already has %d follow-ups; a third is not sent" % (uk, MAX_FOLLOWUPS))
    rec.setdefault(key, []).append(day.isoformat())
    return rec


def set_submitted(doc, uk, day):
    if not any(r[COL_UK] == uk for r in _rows(doc)):
        raise KeyError("no row with urlkey %r" % uk)
    doc.setdefault("followups", {}).setdefault(uk, {}).update(submitted=day.isoformat(), submitted_source="owner")


def _write(mutate):
    """Rev-safe read-modify-write (409 -> re-read and re-apply), as discover-positions does."""
    for attempt in range(4):
        rev, doc = get_doc()
        result = mutate(doc)
        if not result:
            return result
        code, body = put_doc(doc, rev)
        if code == 200:
            return result
        if code == 409:
            print("  409 (rev moved), re-applying (attempt %d)" % (attempt + 1))
            continue
        sys.exit("PUT failed: %s %s" % (code, str(body)[:200]))
    sys.exit("PUT kept conflicting; nothing written")


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass
    ap = argparse.ArgumentParser(description="Follow-up dates for submitted applications (FOLLOWUP-001)")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("stamp")
    d = sub.add_parser("due")
    d.add_argument("--days", type=int, default=QUIET_DAYS)
    d.add_argument("--json", action="store_true")
    lg = sub.add_parser("log")
    lg.add_argument("--uk", required=True)
    lg.add_argument("--date", default=None)
    lg.add_argument("--kind", choices=["followup", "thanks"], default="followup")
    ss = sub.add_parser("set-submitted")
    ss.add_argument("--uk", required=True)
    ss.add_argument("--date", required=True)
    a = ap.parse_args()
    today = datetime.date.today()
    if a.cmd == "stamp":
        got = _write(lambda doc: stamp(doc, today))
        print("stamped %d row(s): %s" % (len(got or []), ", ".join(got or []) or "-"))
    elif a.cmd == "due":
        _, doc = get_doc()
        rows = due(doc, today, a.days)
        if a.json:
            print(json.dumps(rows, ensure_ascii=False, indent=1))
            return
        for r in rows:
            if r.get("date_problem"):
                print("?  %s | %s  (%s)" % (r["company"], r["role"], r["date_problem"]))
            else:
                print("%3dd %s | %s  [%d sent%s] %s" % (r["quiet_days"], r["company"], r["role"], r["sent"],
                                                       ", last one" if r["last_allowed"] else "", r["posting"]))
        print("%d due" % sum(1 for r in rows if not r.get("date_problem")))
    elif a.cmd == "log":
        day = _day(a.date) if a.date else today
        if day is None:
            sys.exit("--date must be YYYY-MM-DD")
        rec = _write(lambda doc: log(doc, a.uk, day, a.kind))
        print("logged %s %s for %s -> %s" % (a.kind, day.isoformat(), a.uk, rec))
    elif a.cmd == "set-submitted":
        day = _day(a.date)
        if day is None:
            sys.exit("--date must be YYYY-MM-DD")
        _write(lambda doc: set_submitted(doc, a.uk, day) or True)
        print("submitted date for %s set to %s" % (a.uk, day.isoformat()))


if __name__ == "__main__":
    main()
