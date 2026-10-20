# POSTING-ERROR-STREAK-001 - check-postings records how long a posting has
# answered ERROR (5xx / timeout), for the report only.
# Run: python scripts/job-tracker/test_error_streak.py (exit 0 = pass)
#
# Network-free. Drives the real next_error_streak, apply_verdict and cmd_check.
# The negative cases matter most: the streak must never move the strike count
# or archive a row, and any non-ERROR verdict must clear it.
import argparse
import contextlib
import datetime
import importlib.util
import io
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("cp", os.path.join(HERE, "check-postings.py"))
cp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cp)

D1, D2, D3 = datetime.date(2026, 10, 18), datetime.date(2026, 10, 19), datetime.date(2026, 10, 20)
U = "https://careers.example.com/jobs/1234-optical-pm"
fails = []


def check(name, got, want):
    if got != want:
        fails.append("%s\n    got:  %r\n    want: %r" % (name, got, want))


# --- next_error_streak, the pure function
check("first ERROR starts a one-day streak", cp.next_error_streak({}, "ERROR", D1),
      ("2026-10-18", 1, "2026-10-18"))
p = {"err_since": "2026-10-18", "err_days": 1, "err_last": "2026-10-18"}
check("next day adds one", cp.next_error_streak(p, "ERROR", D2), ("2026-10-18", 2, "2026-10-19"))
check("same day twice counts once", cp.next_error_streak(p, "ERROR", D1),
      ("2026-10-18", 1, "2026-10-18"))
for v in ("LIVE", "WALLED", "GONE", "SUSPECT", "CLOSED", "EXPIRED"):
    check("%s clears the streak" % v, cp.next_error_streak(p, v, D2), ("", 0, ""))
legacy = {"status": "ERROR", "last": "2026-10-19", "misses": 0}
check("a pre-field ERROR row seeds from its last probe", cp.next_error_streak(legacy, "ERROR", D3),
      ("2026-10-19", 2, "2026-10-20"))
check("a pre-field ERROR probed today does not double count",
      cp.next_error_streak({"status": "ERROR", "last": "2026-10-20"}, "ERROR", D3),
      ("2026-10-20", 1, "2026-10-20"))
check("a pre-field WALLED row starts fresh",
      cp.next_error_streak({"status": "WALLED", "last": "2026-10-19"}, "ERROR", D3),
      ("2026-10-20", 1, "2026-10-20"))


# --- apply_verdict: the streak lands in postingcheck and never touches the strike
def fresh():
    r = [""] * 13
    r[1], r[2], r[11], r[12] = "Acme", "Optical PM", "acme", "DDEBF7"
    return r


def doc_with(pc=None):
    return {"rows": [fresh()], "urls": {"acme": U}, "queue": {}, "postingcheck": pc or {}}


doc = doc_with({"acme": {"misses": 1, "last_strike": "2026-10-17", "status": "GONE"}})
row = doc["rows"][0]
out = []
for day in (D1, D2, D3):
    out.append(cp.apply_verdict(doc, row, "acme", "ERROR", "HTTP 500", day, True))
ent = doc["postingcheck"]["acme"]
check("three ERROR days: streak 3 since 10-18",
      (ent.get("err_since"), ent.get("err_days"), ent.get("err_last")), ("2026-10-18", 3, "2026-10-20"))
check("three ERROR days: the GONE strike holds at 1, nothing archived",
      (ent["misses"], [o[2] for o in out], row[12], doc["queue"].get("acme")), (1, [False] * 3, "DDEBF7", None))
check("apply_verdict returns the streak", out[-1][3:], ("2026-10-18", 3))
cp.apply_verdict(doc, row, "acme", "LIVE", "HTTP 200", datetime.date(2026, 10, 21), True)
check("LIVE drops the three streak keys",
      [k for k in ("err_since", "err_days", "err_last") if k in doc["postingcheck"]["acme"]], [])

# --- reapply_results (409 path) carries the streak too
doc = doc_with({"acme": {"err_since": "2026-10-18", "err_days": 2, "err_last": "2026-10-19",
                         "status": "ERROR"}})
res = cp.reapply_results(doc, [{"uk": "acme", "url": U, "verdict": "ERROR", "detail": "HTTP 500"}], D3, True)
check("409 replay: streak recomputed from the server doc", (res[0]["err_since"], res[0]["err_days"]),
      ("2026-10-18", 3))

# --- cmd_check end to end: the summary names the streak, --json carries it
puts = []
SERVER = {"acme": {"err_since": "2026-10-10", "err_days": 10, "err_last": "2026-10-19",
                   "status": "ERROR", "misses": 0}}


def fake_get():
    return 7, doc_with(json.loads(json.dumps(SERVER)))


def fake_put(d, base_rev):
    puts.append(json.loads(json.dumps(d)))
    return 200, {"rev": 8}


def fake_probe(url, timeout):
    return 500, url, "Internal Server Error"


class _Day(datetime.date):
    @classmethod
    def today(cls):
        return D3


def run(**over):
    saved = (cp.probe, cp.put_doc, cp.get_doc, cp.datetime.date)
    cp.probe, cp.put_doc, cp.get_doc = fake_probe, fake_put, fake_get
    cp.datetime.date = _Day
    buf = io.StringIO()
    try:
        with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(io.StringIO()):
            cp.cmd_check(argparse.Namespace(**dict(dict(apply=True, json=False, limit=0, only="",
                                                        timeout=1), **over)))
    finally:
        cp.probe, cp.put_doc, cp.get_doc, cp.datetime.date = saved
    return buf.getvalue()


log = run()
check("summary names the streak", "ERROR 11 sweep days since 2026-10-10" in log, True)
check("summary still reads strike 0/2", "strike 0/2" in log, True)
check("the PUT persists the streak", puts[-1]["postingcheck"]["acme"]["err_days"], 11)
j = json.loads(run(json=True))
check("--json row carries err_since / err_days",
      (j["rows"][0]["err_since"], j["rows"][0]["err_days"], j["rows"][0]["archived"]), ("2026-10-10", 11, False))

if fails:
    print("FAIL (%d):" % len(fails))
    for f in fails:
        print("  - " + f)
    sys.exit(1)
print("PASS - check-postings ERROR streak (report only, never a strike)")
