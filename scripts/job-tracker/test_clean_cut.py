#!/usr/bin/env python3
# CAP-AMPUTATED-PARENTHETICAL-001 - regression test for gen-runner's hard-cap
# cutter. A cap landing inside a parenthetical used to ship an unbalanced
# bracket around an amputated number ("(a 10x.") into a real cover letter
# (app 3488, CIP, nightly 2026-08-18). Every capped line must end balanced.
import importlib.util, os, sys

_HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("genrunner", os.path.join(_HERE, "gen-runner.py"))
gr = importlib.util.module_from_spec(spec)
_argv = sys.argv[:]
sys.argv = ["gen-runner.py", "list"]
try:
    spec.loader.exec_module(gr)
except SystemExit:
    pass
finally:
    sys.argv = _argv

LIVE = ("Ran supplier coordination and trade-off analysis that reduced LiDAR unit "
        "cost by 90% (a 10\u00d7 reduction), making the platform commercially viable at scale.")

CASES = [
    # (text, cap, must_not_end_with)
    (LIVE, 100, "(a 10\u00d7."),
    ("Cut the bill of materials by 40% (across three suppliers) after requalification", 45, None),
    ("Delivered the sensor programme (optics, electronics and firmware) to production", 40, None),
]

def fails():
    bad = []
    for text, cap, banned in CASES:
        out = gr._cap_line(text, cap)
        if out.count("(") != out.count(")"):
            bad.append("unbalanced bracket at cap %d: %r" % (cap, out))
        if banned and out.endswith(banned):
            bad.append("amputated parenthetical at cap %d: %r" % (cap, out))
        if out and out[-1] not in ".!?:)":
            bad.append("unterminated cut at cap %d: %r" % (cap, out))
        if len(out) > cap + 1:
            bad.append("cut exceeded cap %d: %r" % (cap, out))
    # a parenthetical that FITS must survive untouched
    keep = "Cut unit cost by 90% (a 10x reduction)."
    if gr._cap_line(keep, 200) != keep:
        bad.append("intact parenthetical was altered: %r" % gr._cap_line(keep, 200))
    return bad

if __name__ == "__main__":
    bad = fails()
    for b in bad:
        print("FAIL:", b)
    print("test_clean_cut: %s (%d checks)" % ("FAIL" if bad else "PASS", len(CASES) + 1))
    sys.exit(1 if bad else 0)
