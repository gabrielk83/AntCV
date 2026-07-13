# GOLD STANDARD LOCKER — owner-locked generation & export rules

> LOCKED 2026-07-13 from the owner's live review session (apps 790–812, NVIDIA
> 808 deep review). These rules bind EVERY AntCV generation and export — not a
> per-application fix list. When code and this document disagree, this document
> wins; raise an issue. Enforcement locations are named so regressions are
> traceable. Companion references: `HWIC_TARGET_GABRIEL_UNSOLICITED.md` (gold
> unsolicited HWIC), memory `trackman-gold-target-antcv-output` (gold submitted
> doc), `DENSITY_SWEEP_SONNET5_HANDOFF.md` (tooling).

## 1. Line density (the gold look)

| Rule | Enforcement |
|---|---|
| Every bullet/paragraph ends on a last line ≥60% of column width (target 65–97%); bidirectional: lengthen from real facts or tighten wording — never trim-only | density_fit loop (gen-runner persist + sweep CLI); WIDTH CALIBRATION + PER-BULLET MEASURED WINDOWS in every gen/Fit-it/Enhance prompt (antcv-bullet-targets SHIP 3/4) |
| No force-justify stretch (wide word gaps) — paragraph appeal | measure_density STRETCHED metric; density respace mode |
| Results lines: one-line budget preferred, always complete | quality_pass + density loop |
| Quality metric = defect-free share of measured items, target 97.5% | measure_density `quality_pct` |
| Last PAGE: both columns end TOGETHER at the main column's bottom — gold does NOT fill the final page | `__balanceGate` last-page rule (antcv-auto-pagebreak-block-001) |
| Sidebar COLOR runs to the true page edge on every page | SIDEBAR-SPINE-VML-001 (docx-worker header-hosted rect) |

## 2. Content quality

| Rule | Enforcement |
|---|---|
| A Results line states a CHANGE metric (%, ×, →, time/volume/money delta) + mechanism; team sizes/site descriptions are bullets, never Results | RESULTS-OUTCOME-METRIC-001 (quality_pass; kernel selectedOutcomes pool, position-matched); GOLD CONTENT RULES gen-prompt block |
| Core-competency table: 2 highest-impact rows; complete-clause cells | quality_pass rule_core_comp (cap 2); gen prompt block |
| No truncations anywhere: every cut ends at a clause boundary with terminal punctuation; never a dangling connector/preposition ("…traceable from", "…while producing") | CAP-CLEAN-CUT-001 (gen-runner _cap_line/_cap_para); quality_pass prose rules + rule_bullet_periods; density trim guards |
| Partner/client names only with a JD signal; else "an ODM partner" | quality_pass _PARTNER_NAMES; gen prompt block |
| Certificates: no years; JD-relevance-ranked; rugby-class (coaching/concussion) last unless a sports JD; max 4; BABOK survives program/requirements/EA JDs | quality_pass rule_certs; gen-runner BABOK-RELEVANCE-001 |
| FVU Dansk: one short line ("FVU Dansk — KVUC, ongoing") | quality_pass rule_education |
| Interests compact (owner wordings: "Languages, food, board games", "Technology and systems thinking", "Calm under pressure", "Details via Google Scholar"); personality content protected — never padded, never deleted (the team joke, "(foreningsarbejde)") | quality_pass LINE_COMPRESS (VALUE-field substrings — the {b,t}/{l,v} split shapes!) + grow-only guard in density |
| Pan Idræt (foreningsarbejde) present on Denmark-context apps | quality_pass _restore_forening |
| No fabrication ever — growth only from the item/role/kernel facts, cross-family adversarially audited; numbers + acronyms verbatim | density_fit gates + verify_no_new_claims |
| No banned words; ASCII hyphen only (no em/en dash, no U+2010/2011) — measured on the RENDERED PDF | sanitize_text; density gate; export_pdfs BANNED-DASH-MEASURE-001 |

## 3. Header/furniture identity

| Rule | Enforcement |
|---|---|
| CV banner = the SPECIALIZATION triad; "Application: role — company" only when the stored subtitle is empty (and always on CLs) | CV-SPEC-OVER-APPLICATION-001 (docx-client) |
| The app's own generated slogan beats the global override unless the override's clSloganCtx ownership stamp matches value AND app; unsolicited keeps the standing motto | CL-SLOGAN-STALE-OWNER-001 (docx-client) |
| Citizenship canonical "EU citizen" (da/zh translate at generation); conditional-Danish covers the LOCATION line + forening terms, never citizenship | kernel (fixed); babel layers |
| København + Danish forms stay when the app is Danish OR the JD is Denmark-based — including exports | LOCALFORM-DA-CONDITIONAL-EXPORT-001 (docx-client, meta.jd_dk) |
| Photo present in every export (cloud prefs /photo); signature syncs to cloud (backfill) and rides headless exports once present | EXPORT-PARITY-001 (harness); SIGNATURE-CLOUD-BACKFILL-001 (sync sidecars) |

## 4. Accessibility — BEFORE any branding

| Rule | Enforcement |
|---|---|
| STANDING: every text ink is luminance-checked against its fill (≥3:1 or the higher-contrast candidate) — applies ON TOP of any sampled company brand; adjust the INK, never skip the check | CONTRAST-GUARD-001 (docx-client __ensureInk: table header, sidebar text/labels/headings, header band); TABLE-HEADER-INK-WORKER-001 (worker — was hardcoded white); AI-NOTICE-INK-001 (worker, notice over the spine) |
| Brand palettes apply ONLY to apps marked to that brand (per-app styleConfig); unmarked apps render the neutral package palette — no cross-company leaks (Teledyne is not NVIDIA green) | BRANDFIT-LEAK-EXPORT-001 (harness geometry-only fallback); the per-app brand storage remains the open `brandfit-per-app-scope` branch |

## 5. Verification discipline

Every export batch runs the per-file audit before any "done" claim: pages,
no blank pages, AI notice, spine-to-bottom pixel sample, banned separators on
rendered glyphs, photo presence, banner = triad, certs cleanliness,
**glyph-core header-ink contrast**, content completeness (token audit), and
the density quality metric. Failures are named per file, never smoothed over.
