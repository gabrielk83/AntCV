# JT-HEALTH-CMD-001 - `gen-runner.py health` names every artifacts[uk].application_id
# that does not resolve to a live cloud application.
# Run: python scripts/job-tracker/test_health_cmd.py   (exit 0 = pass)
#
# Why this exists: the nightly's step 7 (0 dead pointers expected) had no tool,
# so each run rebuilt the check ad hoc. The doc stores ids as ints or strings;
# the relay list returns ints. Drives the real dead_pointer_rows, cloud_app_ids
# and cmd_health with stubbed get_doc / _req.
import contextlib
import importlib.util
import io
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("gr", os.path.join(HERE, "gen-runner.py"))
gr = importlib.util.module_from_spec(spec)
sys.path.insert(0, HERE)
spec.loader.exec_module(gr)

fails = []
CHECKS = 0


def check(name, got, want):
    global CHECKS
    CHECKS += 1
    if got != want:
        fails.append("%s\n    got:  %r\n    want: %r" % (name, got, want))


def row(uk, rank, company="Acme", status="Submitted", band="DDEBF7"):
    return [rank, company, "Engineer", "Copenhagen", "", "", "", "OPEN",
            status, "Apply", "", uk, band]


DOC = {
    "rows": [row("live_int", 3), row("live_str", 5), row("dead_b", 9, "Beta"),
             row("dead_a", 2, "Alpha", "Archive / closed", "D9D9D9"), row("no_art", 1)],
    "artifacts": {
        "live_int": {"application_id": 100},
        "live_str": {"application_id": "101"},
        "dead_b": {"application_id": 3500},
        "dead_a": {"application_id": "3600"},
        "orphan": {"application_id": 3700},
        "export_only": {"cv_export_url": "https://x"},
        "junk": "not a dict",
    },
}
APPS = [{"id": 100}, {"id": 101}, {"id": 102}]

# dead_pointer_rows
dead = gr.dead_pointer_rows(DOC, [100, 101, 102])
check("dead uks, rank order, orphan last", [d["uk"] for d in dead], ["dead_a", "dead_b", "orphan"])
check("dead apps as strings", [d["app"] for d in dead], ["3600", "3500", "3700"])
check("closed row flagged", [d["closed"] for d in dead], [True, False, False])
check("orphan company", dead[2]["company"], "?")
check("string ids from the relay match int pointers",
      [d["uk"] for d in gr.dead_pointer_rows(DOC, ["100", "101"])], ["dead_a", "dead_b", "orphan"])
check("all resolve -> empty", gr.dead_pointer_rows(DOC, [100, 101, 3500, 3600, 3700]), [])
check("empty doc", gr.dead_pointer_rows({}, []), [])

# cloud_app_ids
REQ = {}


def fake_req(base, path, method="GET", body=None, timeout=120, retries=2):
    return REQ[path]


gr._req = fake_req
REQ["/api/applications"] = (200, {"applications": APPS})
check("ids from a dict body", gr.cloud_app_ids(), {"100", "101", "102"})
REQ["/api/applications"] = (200, APPS + [{"name": "no id"}])
check("ids from a list body, id-less skipped", gr.cloud_app_ids(), {"100", "101", "102"})
REQ["/api/applications"] = (500, {"applications": APPS})  # status decides, not the body
check("non-200 -> None", gr.cloud_app_ids(), None)
REQ["/api/applications"] = (200, {"error": "odd"})
check("no list -> None", gr.cloud_app_ids(), None)

# cmd_health
gr.get_doc = lambda: (315, DOC)


def run_health():
    buf = io.StringIO()
    code = 0
    with contextlib.redirect_stdout(buf):
        try:
            gr.cmd_health(None)
        except SystemExit as e:
            code = e.code
    return code, buf.getvalue()


REQ["/api/applications"] = (200, {"applications": APPS})
code, out = run_health()
check("dead -> exit 1", code, 1)
check("summary line", out.splitlines()[0],
      "health: rev 315, 5 artifact pointers vs 3 cloud apps, 3 dead")
check("dead row named", "app 3500 not in the cloud" in out, True)
check("closed tag", "app 3600 not in the cloud (CLOSED row)" in out, True)
check("live row not named", "live_int" in out, False)

REQ["/api/applications"] = (200, {"applications": APPS + [{"id": 3500}, {"id": 3600}, {"id": 3700}]})
code, out = run_health()
check("clean -> exit 0", code, 0)
check("clean summary", out.strip(), "health: rev 315, 5 artifact pointers vs 6 cloud apps, 0 dead")

REQ["/api/applications"] = (401, {})
code, out = run_health()
check("list failure -> exit 2", code, 2)
check("list failure says so", "pointers not checked" in out, True)

if fails:
    print("FAIL %d/%d" % (len(fails), CHECKS))
    for f in fails:
        print(" - " + f)
    sys.exit(1)
print("OK %d checks" % CHECKS)
