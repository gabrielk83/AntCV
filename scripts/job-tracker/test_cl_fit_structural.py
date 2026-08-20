#!/usr/bin/env python3
"""CL-FIT-WHO-GOAL-DROP-001 - the fit levers must not cut mandatory v5 rows.

CL-V5-WHO-GOAL-001 makes the WHO I AM lead sentence and the "My goal" row
MANDATORY and "Eligibility" the ONLY omittable one - and that omission is the
generator's call, not a fit-time trim. cl_fit LEVER A dropped any non-lead item
of the fullest section: on app 3490 (KOMBIT) it cut "How I operate" AND the
mandatory "My goal" while keeping the optional "Eligibility" - exactly inverted.
Label matching is not available as a guard because WHO-LANG-001 now renders
those labels in the letter's language, so the protection is structural.

Network-free. No candidate data.

Run: python scripts/job-tracker/test_cl_fit_structural.py
"""
import importlib.util, os, sys

CLFIT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cl_fit.py")
_spec = importlib.util.spec_from_file_location("clfit", CLFIT)
C = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(C)

LONG = "Rolige, strukturerede beslutninger truffet paa maalte data og klare skriftlige konklusioner overalt"


def _who(labels):
    return {"id": "who", "on": True,
            "items": [{"b": "lead", "t": "Jeg trives bedst i komplekse forloeb " + LONG}]
                     + [{"b": lab, "t": LONG, "mk": True} for lab in labels]}


def main():
    # English labels (pre-WHO-LANG apps) and Danish labels (post-fix) alike
    for labels in (["Professional summary", "How I operate", "Eligibility", "My goal"],
                   ["Professionel profil", "Saadan arbejder jeg", "Berettigelse", "Mit maal"]):
        assert C._droppable(_who(labels)) == [], (
            "WHO rows must be structurally undroppable, got %r" % (C._droppable(_who(labels)),))
    assert "who" in C.STRUCTURAL_IDS and "role_view" in C.STRUCTURAL_IDS, C.STRUCTURAL_IDS
    print("PASS: no WHO row is droppable, in either label language.")

    # role_view stays protected (ROLE-VIEW-3-BULLETS-001 must not regress)
    rv = {"id": "role_view", "on": True,
          "items": [{"b": "lead", "t": LONG}] + [{"b": "P%d" % i, "t": LONG} for i in range(3)]}
    assert C._droppable(rv) == [], C._droppable(rv)
    print("PASS: role_view still protected.")

    # an ordinary relevance-tail section is STILL droppable - the guard must not
    # freeze the fit levers everywhere
    bring = {"id": "bring", "on": True,
             "items": [{"b": "lead", "t": LONG}] + [{"b": "B%d" % i, "t": LONG} for i in range(3)]}
    dr = C._droppable(bring)
    assert len(dr) == 3, dr
    print("PASS: ordinary sections remain droppable (%d candidates)." % len(dr))
    print("\nOK - 3/3")


if __name__ == "__main__":
    sys.exit(main())
