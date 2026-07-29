# CV-3P-UNDER-STAGE4-001 - truth table for cv_fit's compression gates.
# Run: python scripts/job-tracker/test_cv_fit_gates.py   (exit 0 = pass)
#
# cv_fit fits an over-budget CV by COMPRESSION ONLY, so everything that keeps
# the compression honest lives in the gates. Each case below is a real rewrite
# an LLM returned during the 2026-07-26 refit of application 2733, kept as a
# regression: the accepted ones must stay accepted, and every rejected one was
# a defect that reached a rendered PDF before the gate existed.
import importlib.util, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
spec = importlib.util.spec_from_file_location("cv_fit", os.path.join(HERE, "cv_fit.py"))
CF = importlib.util.module_from_spec(spec)
spec.loader.exec_module(CF)

fails = 0
log = []

# (name, original, rewrite, expect_accept)
CASES = [
    ("accepted: whole clause dropped, every word survives from the original",
     "Customized Codebeamer ALM workflows and process logic through scripting and application-level development.",
     "Customize Codebeamer ALM workflows and process logic via scripting.", True),
    ("accepted: ordinary morphology (assembly/assemblies, test/tests)",
     "Set up the optical characterisation lab; define acceptance test procedures for incoming and outgoing optical assemblies.",
     "Set up optical characterisation lab; define acceptance tests for assembly.", True),
    ("rejected: invented a department the original never named",
     "Prepared decision material for management, suppliers, engineering, and customer-facing teams.",
     "Prepare management, supplier, engineering, sales decision material.", False),
    ("rejected: bought characters by clipping words",
     "Customized Codebeamer ALM workflows and process logic through scripting and application-level development.",
     "Customize Codebeamer ALM workflows via scripting and app-level dev.", False),
    ("rejected: a number disappeared",
     "Taught Introduction to Semiconductor Physics and Methods in Microelectronics across 7 semesters.",
     "Taught Introduction to Semiconductor Physics and Methods in Microelectronics.", False),
    ("rejected: an acronym disappeared",
     "Managed prototype-to-production transfer; owned DV and PV test plans and supplier qualification.",
     "Managed prototype-to-production transfer; owned test plans and supplier qualification.", False),
    ("rejected: em dash",
     "Coordinated the Sigma-Connectivity ODM engineering team across design reviews and prototyping.",
     "Coordinated the Sigma-Connectivity ODM team — design reviews, prototyping.", False),
    ("rejected: not shorter",
     "Mentored junior engineers on optical metrology and stray-light analysis.",
     "Mentored junior engineers on optical metrology and on stray-light analysis work.", False),
    ("rejected: ends on a dangling connector",
     "Delivered consulting projects bridging hardware product development and requirements traceability.",
     "Delivered consulting projects bridging hardware product development and", False),
]

for name, original, rewrite, expect in CASES:
    got = CF._gate(rewrite, original, "en", log)
    ok = bool(got) == expect
    if not ok:
        fails += 1
    why = "accepted" if got else (log[-1].split(": ", 1)[-1] if log else "rejected")
    print("%-4s %-58s -> %s" % ("PASS" if ok else "FAIL", name[:58], why))

# terminal punctuation is furniture: restored, never a rejection
kept = CF._gate("Set up the laser lab and automated test benches",
                "Set up the laser lab and automated the test benches for optics.", "en", log)
assert kept and kept.endswith("."), kept
print("PASS terminal period restored rather than rejected")

# the invention gate must not fire on morphology or on short function words
assert CF._invented("Managed 15 suppliers across qualification.",
                    "Managed 15 supplier qualifications across the programme.") is None
assert CF._invented("Ran the audit and the review.", "Ran the audit and the review.") is None
assert CF._invented("Ran the audit for finance.", "Ran the audit for the programme.") == "finance"
print("PASS invention gate: morphology clean, genuinely new word caught")

# the abbreviation gate only fires on a CLIPPED form of a word the original spelled out
assert CF._abbreviated("app-level dev", "application-level development") is not None
assert CF._abbreviated("EMC and EMI test", "EMC and EMI test coverage") is None
print("PASS abbreviation gate: clipped words caught, real short words kept")

# a rewrite must never be allowed to delete an item - fit_cv only ever swaps text
import re as _re
src = open(os.path.join(HERE, "cv_fit.py"), encoding="utf-8").read()
code = "\n".join(l for l in src.splitlines() if not l.lstrip().startswith("#"))
for banned in (r"\.pop\(", r"\bdel\s+\w", r"\.remove\(", r'\["items"\]\s*=', r'\["roles"\]\s*='):
    assert not _re.search(banned, code), "cv_fit must not contain a delete lever (%s)" % banned
print("PASS cv_fit carries no delete lever")

print(("FAILURES: %d" % fails) if fails else "ALL PASS")
sys.exit(1 if fails else 0)
