#!/usr/bin/env python3
"""Self-test for the 2026-08-16 evidence-QA rules - pure units, no relay/network.
Run: python test_evidence_qa.py  (exit 0 = green).

Covers:
  - CONTRADICTION-QA-001  years claims outside the kernel's stated set are
                          rewritten to the kernel's canonical figure
  - COMPOUND-BACKED-001   a technical bigram whose words exist in the kernel
                          but never co-occur in one statement is REPORTED
                          (never auto-rewritten); JD-quoted and kernel-backed
                          compounds pass silently
  - METRIC-SEMANTIC-001   cv_fit's gate rejects a rewrite that re-binds a
                          surviving number to a different noun phrase
"""
import sys

import quality_pass as QP
import cv_fit as CVF

_n = 0
_fail = 0


def check(name, ok, detail=""):
    global _n, _fail
    _n += 1
    if ok:
        print("PASS " + name)
    else:
        _fail += 1
        print("FAIL " + name + (" -- " + str(detail) if detail else ""))


KERNEL = {
    "background": "Electro-optics engineer with 15+ years across laser-based sensing.",
    "experience": [
        {"bullets": [
            "Established the laser lab and automated test benches.",
            "Supported defence-grade thermal EO products.",
            "Reviewed module packaging constraints with display suppliers.",
            "Managed prototype-to-production transfer and supplier qualification.",
        ]},
    ],
}

# --- CONTRADICTION-QA-001 ---------------------------------------------------
cl = [{"id": "opening", "content": "With 33+ years across the disciplines below, I bring depth."}]
rep = []
QP.rule_kernel_contradiction([], cl, KERNEL, rep)
check("years: 33+ rewritten to kernel 15+", "15+ years" in cl[0]["content"], cl[0]["content"])
check("years: rewrite reported", any("contradiction" in r for r in rep), rep)

cl2 = [{"id": "opening", "content": "15 years in electro-optics and hardware systems."}]
rep2 = []
QP.rule_kernel_contradiction([], cl2, KERNEL, rep2)
check("years: kernel-consistent claim untouched", cl2[0]["content"].startswith("15 years") and not rep2, rep2)

# --- COMPOUND-BACKED-001 ----------------------------------------------------
cv = [{"id": "experience", "roles": [{"bullets": [
    "Owned thermal packaging for LiDAR modules.",          # thermal + packaging exist apart -> flag
    "Established the laser lab and automated test benches.",  # verbatim kernel -> pass
]}]}]
rep3 = []
QP.rule_compound_backed(cv, [], KERNEL, "", rep3)
check("compound: 'thermal packaging' flagged", any("thermal packaging" in r for r in rep3), rep3)
check("compound: kernel-backed phrase not flagged", not any("laser lab" in r or "test benches" in r for r in rep3), rep3)
check("compound: report-only (text unchanged)", "thermal packaging" in cv[0]["roles"][0]["bullets"][0])

rep4 = []
QP.rule_compound_backed(cv, [], KERNEL, "The role owns thermal packaging of optical modules.", rep4)
check("compound: JD-quoted compound passes", not any("thermal packaging" in r for r in rep4), rep4)

# --- METRIC-SEMANTIC-001 ----------------------------------------------------
orig = "Cut the change cycle from roughly 250 days to about 10 days via structured change control."
good = "Cut the change cycle from 250 days to 10 days via change control."
bad = "Cut late-stage rework from 250 days to 10 days across the programme."
log = []
check("gate: faithful compression passes", CVF._gate(good, orig, "en", log) is not None, log)
log2 = []
check("gate: metric re-bound to 'rework' rejected", CVF._gate(bad, orig, "en", log2) is None, log2)
check("gate: rejection names the rebound", any("metric rebound" in e for e in log2), log2)

print("\n%d checks, %d failed" % (_n, _fail))
sys.exit(1 if _fail else 0)
