# Density sweep report — GOLD-TARGET-LAYOUT-DENSITY-001 (2026-07-13)

Data-only `density_fit.py --apply` pass across the 20 saved tracker applications
(CV + CL), excluding 723/670/794/796 per the handoff. Run from the desktop box
(the sandbox shell is 403-gated to the workers; this box reaches them). Deterministic
clause-boundary trims + gated LLM grow/shrink, cross-family no-new-claims verifier,
numbers/acronyms verbatim, table cells shrink-only. Every write text-verified;
PUT only on measured improvement. 3 tail passes hit LLM read-timeouts under parallel
load and were retried clean (811 CL persisted; 812 had no improvement).

| App | Doc | Quality before | after | Rewrites | Persisted |
|----|----|----|----|----|----|
| 790 | CL | 50.0% | 70.0% | 7 | yes |
| 790 | CV | 77.2% | 78.6% | 5 | yes |
| 791 | CL | 50.0% | 75.0% | 6 | yes |
| 791 | CV | 79.6% | 81.1% | 1 | yes |
| 792 | CL | 80.0% | 80.0% | 2 | — |
| 792 | CV | 77.8% | 87.0% | 10 | yes |
| 793 | CL | 75.0% | 90.0% | 5 | yes |
| 793 | CV | 75.4% | 76.7% | 1 | yes |
| 795 | CL | 90.0% | 90.0% | 0 | — |
| 795 | CV | 80.4% | 80.4% | 4 | — |
| 797 | CL | 75.0% | 80.0% | 2 | yes |
| 797 | CV | 76.5% | 78.0% | 2 | yes |
| 798 | CL | 80.0% | 80.0% | 0 | — |
| 798 | CV | 76.5% | 78.0% | 3 | yes |
| 799 | CL | 80.0% | 80.0% | 1 | — |
| 799 | CV | 78.7% | 81.7% | 3 | yes |
| 800 | CL | 85.0% | 85.0% | 0 | — |
| 800 | CV | 73.3% | 76.3% | 6 | yes |
| 801 | CL | 85.0% | 85.0% | 0 | — |
| 801 | CV | 75.0% | 78.0% | 6 | yes |
| 802 | CL | 80.0% | 85.0% | 1 | yes |
| 802 | CV | 73.2% | 73.2% | 4 | — |
| 804 | CL | 65.0% | 70.0% | 2 | yes |
| 804 | CV | 75.5% | 77.1% | 6 | yes |
| 805 | CL | 70.0% | 80.0% | 5 | yes |
| 805 | CV | 73.8% | 77.0% | 6 | yes |
| 806 | CL | 75.0% | 80.0% | 1 | yes |
| 806 | CV | 78.8% | 80.4% | 2 | yes |
| 807 | CL | 90.0% | 90.0% | 0 | — |
| 807 | CV | 76.4% | 76.4% | 8 | — |
| 808 | CL | 75.0% | 75.0% | 0 | — |
| 808 | CV | 75.0% | 76.7% | 9 | yes |
| 809 | CL | 75.0% | 80.0% | 1 | yes |
| 809 | CV | 81.5% | 83.1% | 13 | yes |
| 810 | CL | 75.0% | 75.0% | 0 | — |
| 810 | CV | 70.0% | 73.3% | 10 | yes |
| 811 | CL | 80.0% | 85.0% | 1 | yes |
| 811 | CV | 78.7% | 78.7% | 4 | — |
| 812 | CL | 85.0% | 85.0% | 0 | — |
| 812 | CV | 79.0% | 79.0% | 4 | — |

**25 passes persisted an improvement** (25 total incl. the 811 CL retry). CV mean quality 76.6% → 78.5%. CL mean 76.0% → 81.0%. No app reaches the 97.5% target — that is the content-density frontier (upstream pins, verbatim sections, no-fabrication ceiling), not a locker-rule failure.
## Residue classes (expected, per handoff — report don't chase)

- **Pinned upstream** — payload text sourced from fixture pins/overrides; a cv_sections write is a no-op.
- **Verbatim-policy sections** — certs/education/pubs/languages/core_comp/greeting/closure are measured + reported, never rewritten.
- **Un-growable personality lines** — interests/profile/work_style lines needing personal facts the model may not invent.
- **The 97.5% ceiling is content-bound**, not a layout-rule failure. The balance gate (preview-side autoPages, `__balanceGate`) is not exercised by these headless renders — it needs a live-browser verify pass.

## Notable
- **792 (KK Group, Danish)** CV 77.8% → 87.0% — the biggest gain, combining the Danish Results translation (done separately this session) with 10 density rewrites.
- **CL passes gained most** (several +5 to +25 pp) — cover letters carried more rewritable runts than the verbatim-heavy CVs.
