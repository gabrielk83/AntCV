# POSTING-OBSOLETE-001 - the nightly generation gate must skip CLOSED rows.
# Run: python scripts/job-tracker/test_closed_row_gate.py   (exit 0 = pass)
#
# Why this exists: check-postings archives a dead posting by setting the Archive
# band + a closed status + queue=False. queue=False alone is NOT a sufficient
# belt, because eligible_rows' `q is None and not has_art` clause would still
# elect a row archived by hand (or by an older sweep) that never carried an
# explicit queue flag. That row has a stored JD, so the nightly would happily
# spend a full generation on a job nobody can apply for.
import importlib.util
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("gr", os.path.join(HERE, "gen-runner.py"))
gr = importlib.util.module_from_spec(spec)
sys.path.insert(0, HERE)
spec.loader.exec_module(gr)

JD = "x " * 400  # comfortably over the 200-char content gate

fails = []


def check(name, got, want):
    if got != want:
        fails.append("%s\n    got:  %r\n    want: %r" % (name, got, want))


def row(uk, band="E2EFDA", status="Identified (posting saved)", flag="note"):
    return [1, "Acme", "Optical PM", "Copenhagen", "", "Proposed", "strong", "OPEN",
            status, "Review", flag, uk, band]


def doc(rows, queue=None):
    return {"rows": rows, "jd": {r[11]: JD for r in rows},
            "queue": queue or {}, "gen": {}, "artifacts": {}, "urls": {}}


def ukeys(d, **kw):
    return sorted(x["uk"] for x in gr.eligible_rows(d, **kw))


# ---- is_closed_row truth table ---------------------------------------------
check("archive band is closed", gr.is_closed_row(row("a", band="D9D9D9")), True)
check("closed tracked status is closed",
      gr.is_closed_row(row("a", status="Archive / closed")), True)
check("rejected status is closed", gr.is_closed_row(row("a", status="Rejected")), True)
check("withdrawn status is closed", gr.is_closed_row(row("a", status="Withdrawn")), True)
check("dropped flag is closed", gr.is_closed_row(row("a", flag="Dropped (salary)")), True)
check("a live T2 row is NOT closed", gr.is_closed_row(row("a")), False)
check("a T1 row is NOT closed", gr.is_closed_row(row("a", band="DDEBF7")), False)
# "closed" must anchor on the STATUS field, not appear anywhere: a role titled
# "Closed-loop Control Engineer" must stay eligible.
live = [1, "Acme", "Closed-loop Control Engineer", "", "", "", "", "OPEN",
        "Identified (posting saved)", "Review", "note", "a", "E2EFDA"]
check("a role NAMED 'Closed-loop' is not treated as closed", gr.is_closed_row(live), False)
check("a short legacy row does not throw", gr.is_closed_row([1, "A", "B"]), False)

# ---- eligible_rows ----------------------------------------------------------
check("a live row with a JD is eligible", ukeys(doc([row("live")])), ["live"])
check("an ARCHIVED row is skipped even with queue truthy",
      ukeys(doc([row("dead", band="D9D9D9")], {"dead": True})), [])
check("an archived row with NO queue entry is skipped (the belt this adds)",
      ukeys(doc([row("dead", band="D9D9D9")])), [])
check("a closed-status row is skipped",
      ukeys(doc([row("dead", status="Archive / closed")])), [])
check("live and dead together: only the live one generates",
      ukeys(doc([row("live"), row("dead", band="D9D9D9")])), ["live"])
check("--only cannot resurrect an archived row",
      ukeys(doc([row("dead", band="D9D9D9")]), only={"dead"}), [])
check("--force cannot resurrect an archived row",
      ukeys(doc([row("dead", band="D9D9D9")]), force=True), [])

if fails:
    print("FAIL (%d):" % len(fails))
    for f in fails:
        print("  - " + f)
    sys.exit(1)
print("PASS - closed-row generation gate (16 checks)")
