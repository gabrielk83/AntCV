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


CHECKS = 0


def check(name, got, want):
    global CHECKS
    CHECKS += 1
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

# ---- unqueued_ready_rows (JT-READY-LIST-CLOSED-001) -------------------------
# The sweep archives with queue=False, which is exactly the "unarmed but ready"
# signature. The ready list must not advertise a job nobody can apply for.
def ready(d):
    return sorted(x["uk"] for x in gr.unqueued_ready_rows(d))


check("an unarmed live row is listed as ready",
      ready(doc([row("live")], {"live": False})), ["live"])
check("an unarmed ARCHIVED row is not listed as ready",
      ready(doc([row("dead", band="D9D9D9")], {"dead": False})), [])
check("an unarmed closed-status row (T1 band) is not listed as ready",
      ready(doc([row("dead", band="DDEBF7", status="Archive / closed")], {"dead": False})), [])
check("live and archived together: only the live one is listed",
      ready(doc([row("live"), row("dead", band="D9D9D9")], {"live": False, "dead": False})),
      ["live"])

# ---- armed_with_app_rows (JT-ARMED-ARTIFACT-NO-DRAIN-001) -------------------
# A row the owner armed that already has an application is skipped by
# eligible_rows without a word, while the island shows it as Queued. The list
# command must NAME it. Report-only: it must stay out of the eligible set.
import contextlib
import io


def armed(d):
    return sorted(x["uk"] for x in gr.armed_with_app_rows(d))


def doc_art(rows, queue, arts):
    d = doc(rows, queue)
    d["artifacts"] = arts
    return d


APP = {"application_id": 2781}
check("an armed row with an application is NOT eligible (the silent skip)",
      ukeys(doc_art([row("x")], {"x": True}, {"x": APP})), [])
check("...and it IS reported by armed_with_app_rows",
      armed(doc_art([row("x")], {"x": True}, {"x": APP})), ["x"])
check("--force makes that armed row eligible again (the manual regen path)",
      ukeys(doc_art([row("x")], {"x": True}, {"x": APP}), force=True), ["x"])
check("an armed CLOSED row with an application is reported too (stale flag)",
      armed(doc_art([row("x", status="Archive / closed")], {"x": True}, {"x": APP})), ["x"])
check("the closed flag is carried on the report",
      [r["closed"] for r in gr.armed_with_app_rows(
          doc_art([row("x", status="Archive / closed")], {"x": True}, {"x": APP}))], [True])
check("an armed row WITHOUT an application is eligible, not reported",
      armed(doc_art([row("x")], {"x": True}, {})), [])
check("a default-on row (no queue entry) with an application is not reported",
      armed(doc_art([row("x")], {}, {"x": APP})), [])
check("an unarmed (explicit False) row with an application is not reported",
      armed(doc_art([row("x")], {"x": False}, {"x": APP})), [])
check("a cv_export_url alone counts as an application",
      armed(doc_art([row("x")], {"x": True}, {"x": {"cv_export_url": "u"}})), ["x"])
check("an armed row with an EMPTY artifact entry is not reported",
      armed(doc_art([row("x")], {"x": True}, {"x": {}})), [])


def list_stdout(d):
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        gr.print_armed_summary(d)
    return buf.getvalue()


out = list_stdout(doc_art([row("napa", status="Archive / closed"), row("veo")],
                          {"napa": True, "veo": True}, {"napa": APP, "veo": {"application_id": 3500}}))
check("print_armed_summary names the block", "ARMED but already has an application (2)" in out, True)
check("print_armed_summary names both rows", ("napa" in out) and ("veo" in out), True)
check("print_armed_summary says how to regen", "--force --row" in out, True)
check("print_armed_summary marks the closed row's flag as stale", "CLOSED row, flag stale" in out, True)
check("print_armed_summary carries the app id", "app 3500" in out, True)
check("print_armed_summary is silent with nothing armed",
      list_stdout(doc_art([row("x")], {"x": False}, {"x": APP})), "")
check("print_armed_summary is silent for a plain unarmed backlog",
      list_stdout(doc([row("x")], {"x": False})), "")

if fails:
    print("FAIL (%d):" % len(fails))
    for f in fails:
        print("  - " + f)
    sys.exit(1)
print("PASS - closed-row generation gate (%d checks)" % CHECKS)
