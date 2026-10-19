# JT-OWNER-PACKAGED-DEFAULT-ON-001 - the nightly must NAME default-on rows the
# owner already packaged or sent by hand.
# Run: python scripts/job-tracker/test_owner_packaged.py   (exit 0 = pass)
#
# Why this exists: a row the owner adds through the island has no queue entry,
# so eligible_rows elects it (`q is None and not has_art`). On 2026-10-16 and
# 2026-10-19 the queue held two such rows (3Shape, WD) that the owner had
# packaged by hand and then submitted. The block is report-only until the owner
# answers row 127 (b): eligibility must stay unchanged.
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

JD = "x " * 400
PKG = "\U0001F4E6 Package 1043 (2026-10-15): Downloads/1043_CV_v1.pdf"

fails = []
CHECKS = 0


def check(name, got, want):
    global CHECKS
    CHECKS += 1
    if got != want:
        fails.append("%s\n    got:  %r\n    want: %r" % (name, got, want))


def row(uk, rank, status="Identified (posting saved)", flag="note", band="DDEBF7"):
    return [rank, "Acme", "Optics Engineer", "Copenhagen", "", "", "", "OPEN",
            status, "Apply", flag, uk, band]


def doc(rows, queue=None, arts=None, jd=None):
    return {"rows": rows, "queue": queue or {}, "artifacts": arts or {},
            "jd": jd if jd is not None else {r[11]: JD for r in rows}, "gen": {}, "urls": {}}


def uks(rs):
    return [r["uk"] for r in rs]


# 1. the live 10-19 shape: Submitted + package line, default-on
d = doc([row("shape", 185, "Submitted", PKG), row("fresh", 190)])
pk = gr.owner_packaged_rows(d)
check("submitted + package row is named", uks(pk), ["shape"])
check("package flag detected", pk[0]["package"], True)
check("status carried", pk[0]["status"], "Submitted")
# eligibility is UNCHANGED (report-only)
check("eligible_rows still elects both", sorted(uks(gr.eligible_rows(d))), ["fresh", "shape"])

# 2. each signal alone is enough
for st in ("CV/CL drafted", "Applied", "Interview", "Offer received"):
    check("status %r alone" % st, uks(gr.owner_packaged_rows(doc([row("a", 1, st)]))), ["a"])
check("package line alone", uks(gr.owner_packaged_rows(doc([row("a", 1, flag=PKG)]))), ["a"])

# 3. exclusions
check("fresh add is not named", gr.owner_packaged_rows(doc([row("a", 1)])), [])
check("explicit queue=True (armed) is not named",
      gr.owner_packaged_rows(doc([row("a", 1, "Submitted")], queue={"a": True})), [])
check("explicit queue=False is not named",
      gr.owner_packaged_rows(doc([row("a", 1, "Submitted")], queue={"a": False})), [])
check("row with an application is not named",
      gr.owner_packaged_rows(doc([row("a", 1, "Submitted")], arts={"a": {"application_id": 9}})), [])
check("closed row is not named",
      gr.owner_packaged_rows(doc([row("a", 1, "Submitted", band="D9D9D9")])), [])
check("stub JD row is not named (never eligible)",
      gr.owner_packaged_rows(doc([row("a", 1, "Submitted")], jd={"a": "short"})), [])

# 4. sorted by rank
check("rank order", uks(gr.owner_packaged_rows(doc([row("b", 9, "Submitted"), row("a", 2, "Applied")]))),
      ["a", "b"])

# 5. the printed block
buf = io.StringIO()
with contextlib.redirect_stdout(buf):
    gr.print_owner_packaged_summary(d)
out = buf.getvalue()
check("block header", "OWNER-PACKAGED but default-on (1)" in out, True)
check("block names the row + tag", "status Submitted, package line" in out and "shape" in out, True)
buf = io.StringIO()
with contextlib.redirect_stdout(buf):
    gr.print_owner_packaged_summary(doc([row("a", 1)]))
check("silent when none", buf.getvalue(), "")

if fails:
    print("FAIL %d/%d" % (len(fails), CHECKS))
    for f in fails:
        print(" - " + f)
    sys.exit(1)
print("PASS %d/%d test_owner_packaged" % (CHECKS, CHECKS))
