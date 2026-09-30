# PERSIST-SKELETON-GATE-001 - `run --persist` must refuse without the skeleton.
# Run: python scripts/job-tracker/test_persist_skeleton_gate.py   (exit 0 = pass)
#
# Why this exists: on a host with no ~/.antcv/cv_skeleton.json the runner fell
# back to 4 flat CV text blocks (no experience, no sidebar), saved that as a real
# application and set queue=false. The row read as done; the app was unusable
# (apps 3504 + 3505, 2026-09-29/30). The gate must fire BEFORE any model call so
# the armed rows stay armed for a host that has the fixture.
import importlib.util
import os
import sys
import types

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("gr", os.path.join(HERE, "gen-runner.py"))
gr = importlib.util.module_from_spec(spec)
sys.path.insert(0, HERE)
spec.loader.exec_module(gr)

fails = []


def check(name, got, want):
    if got != want:
        fails.append("%s\n    got:  %r\n    want: %r" % (name, got, want))


SK = {"cv": [{"id": "experience"}], "cl": []}

# ---- persist_preflight truth table -------------------------------------------
check("persist + no skeleton -> abort", bool(gr.persist_preflight(True, False, None)), True)
check("persist + skeleton -> proceed", gr.persist_preflight(True, False, SK), None)
check("persist + no skeleton + --allow-flat -> proceed", gr.persist_preflight(True, True, None), None)
check("no persist + no skeleton -> proceed (review bundles only)",
      gr.persist_preflight(False, False, None), None)
check("abort message names the override",
      "--allow-flat" in (gr.persist_preflight(True, False, None) or ""), True)

# ---- the REAL cmd_run: gate fires before any model / research call ------------
JD = "x " * 400
ROW = [1, "Acme", "Optical Engineer", "Copenhagen", "", "Proposed", "T1", "OPEN",
       "Identified (posting saved)", "Review", "note", "acme", "DDEBF7"]
DOC = {"rows": [ROW], "jd": {"acme": JD}, "queue": {"acme": True}, "gen": {},
       "artifacts": {}, "urls": {}}


class Reached(Exception):
    pass


def _boom(*a, **k):
    raise Reached()


def run(persist, dry=False, allow_flat=False, skeleton=None):
    gr.load_kernel = lambda *a, **k: {}
    gr.compact_profile = lambda k: ""
    gr.get_doc = lambda: (1, DOC)
    gr.load_skeleton = lambda: skeleton
    gr._req = _boom                 # /api/prefs read = first network touch after the gate
    gr.research = _boom
    args = types.SimpleNamespace(out=os.path.join(os.environ.get("TEMP", "/tmp"), "gr-gate-test"),
                                 kernel_file=None, row=None, force=False, max_high=5,
                                 max_quick=10, persist=persist, dry=dry, allow_flat=allow_flat,
                                 research=True, brand=False, measure=False, max_pages=2,
                                 provider="anthropic")
    try:
        gr.cmd_run(args)
        return "returned"
    except SystemExit as e:
        return "exit %s" % e.code
    except Reached:
        return "reached-network"


check("cmd_run --persist without skeleton exits 5 before any call", run(True), "exit 5")
check("cmd_run --persist WITH skeleton proceeds past the gate",
      run(True, skeleton=SK), "reached-network")
check("cmd_run --persist --allow-flat proceeds past the gate",
      run(True, allow_flat=True), "reached-network")
check("cmd_run without --persist is not gated", run(False), "reached-network")

if fails:
    print("FAIL (%d):" % len(fails))
    for f in fails:
        print("  - " + f)
    sys.exit(1)
print("PASS - persist skeleton gate (9 checks)")
