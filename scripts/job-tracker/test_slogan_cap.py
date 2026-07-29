#!/usr/bin/env python3
"""Self-test for the CL slogan word-cap — pure units, no relay/network.
Run: python test_slogan_cap.py  (exit 0 = green).

Covers:
  - SLOGAN-WORD-CAP-001        <= maxw words; clean clause cut preferred
  - SLOGAN-WORD-CAP-DANGLE-001 hard-chop fallback drops a trailing dangling
                               stopword so the capped slogan ends on a content
                               word (mirrors window.__antcvSloganCap).
"""
import importlib.util
import os
import sys

_here = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("genrunner", os.path.join(_here, "gen-runner.py"))
_gr = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_gr)
cap = _gr._cap_slogan_words

_n = 0
_fail = 0


def eq(name, got, want):
    global _n, _fail
    _n += 1
    if got == want:
        print("PASS " + name)
    else:
        _fail += 1
        print("FAIL " + name + f"\n   got:  {got!r}\n   want: {want!r}")


def test_slogan_cap():
    # under/at the cap — returned unchanged (no chop, no scrub)
    eq("cap: short slogan untouched",
       cap("Short slogan under nine words here", 9),
       "Short slogan under nine words here")
    eq("cap: exactly maxw untouched (even if trailing stopword)",
       cap("Data pipelines that scale reliably and cost across the", 9),
       "Data pipelines that scale reliably and cost across the")

    # DANGLE-001: the reported Anita brand-decides case — 12 words, no early
    # clause break, hard-chopped 9th word is a conjunction ("and") -> dropped.
    eq("cap: drops trailing 'and' after hard chop",
       cap("Reliable seasonal operations that keep last-mile routes winter-ready and audit-ready", 9),
       "Reliable seasonal operations that keep last-mile routes winter-ready")

    # other trailing stopwords land on the chop boundary -> dropped
    eq("cap: drops trailing 'through'",
       cap("Reliable seasonal operations that keep last-mile routes staying through winter and spring", 9),
       "Reliable seasonal operations that keep last-mile routes staying")
    eq("cap: drops trailing 'with'",
       cap("Alpha beta gamma delta epsilon zeta eta theta with iota kappa", 9),
       "Alpha beta gamma delta epsilon zeta eta theta")

    # a content word on the boundary is kept (no over-trim)
    eq("cap: keeps a content word on the boundary",
       cap("One two three four five six seven eight nine ten eleven", 9),
       "One two three four five six seven eight nine")

    # clause-cut path (comma) is unchanged and takes precedence over the chop
    eq("cap: clause cut on comma preferred",
       cap("Keeping every last-mile route ready, whatever the winter throws at us", 9),
       "Keeping every last-mile route ready")

    # single-drop parity with the app-side: only ONE trailing stopword is
    # removed (window.__antcvSloganCap does the same), so preview == export
    eq("cap: single stopword drop (parity with app __antcvSloganCap)",
       cap("Reliable operations keeping every last-mile route ready for the winter season", 9),
       "Reliable operations keeping every last-mile route ready for")


if __name__ == "__main__":
    test_slogan_cap()
    print(f"\nSLOGAN-CAP SELF-TEST: {_n - _fail}/{_n} checks passed")
    sys.exit(1 if _fail else 0)
