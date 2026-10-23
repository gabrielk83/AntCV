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
| Core-competency table: 3-4 TABLE ROWS (owner 2026-07-13: table rows vs cell lines are different things), highest-impact first; every cell a complete clause rendering in at most 2 lines of its column | quality_pass rule_core_comp (cap = caps.core_comp_data_rows = 4); 290 guard floor = min 3; gen prompt block; cell lines via density.cell_max_lines + narrow-cell cascade |
| Professional-experience roles: at most 3 bullets per role — a GENERATION cap (owner ruling 2026-07-13) | caps.role_bullets_max wired into the gold prompt block (rides every gen call via bullet-targets) |
| NARROW-CELL-CASCADE-001: no table cell over 2 rendered lines; no one-word-per-line wrap of a 3+-word label (owner 2026-07-13, Tech Mahindra focus cell). Levers: label hard-compress first, then tableRatio widen (0.28/0.31/0.34) gated on the value column holding its line count | measure_density _table_cell_scan (geometric — cells have no stream geometry); quality_pass label cap (site caps.table_label_max_chars 28); density_fit ratio ladder + per-app meta.styleConfig persist; gold_audit cell_cascade; prompt block line |
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

## 3b. Role control (identity + per-language canon)

| Rule | Enforcement |
|---|---|
| The stable canonical role id is the LANGUAGE-AGNOSTIC identity: a suffixed backfill twin (`<id>-2`) or a gen schema id (`r1..`) at the same company/tenure is the SAME position — exactly ONE role per canonical id after dedupe, the canonical id survives (the Results pins key on it) | SAME-ID-SAME-POSITION-001 (1.51.353) + BASE-ID/GEN-ID-SAME-POSITION (1.51.358) in `antcv-sections-normalize-415.js` `_samePosition` + `dedupeRoles` |
| Role TITLES are per-language RENDERINGS of that identity — canonical en/da/es/zh titles live in `gold-rules.json roles.canon_titles` (the ONE control site) and are applied deterministically on en/da/es/zh ribbons after dedupe; he/am/ar keep the translate output; a merged title with MORE &-segments than the canon is a deliberate merge-or-split structure and is never overwritten | ROLE-CANON-LANG-001 (1.51.394) `roleCanonTitles` in normalize-415 (gold-fetch + mirrored fallback); mirror-drift + owner pins + typography gated by `pwa/test/unit/gold-role-canon.test.mjs` (in the suite) |
| Merged "Earlier career" entries declare their constituents (`__covers`) so the completeness backfill never re-adds them; the backfill's duplicate check is id-based, so cross-LANGUAGE twins can no longer accumulate | ROLE-COVERS-001 (1.51.362) + the id rules above |

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

## 6. Reviewer feedback 2026-10-23 (course staff review of the Veo CV v7) and the source split

Owner 2026-10-23: the course reviewer's seven points become defaults, and the writing agents stop reading one source in one shape. `pwa/gold-rules.json` 1.9.6.

| Rule | Enforcement |
|---|---|
| PROOF-POINTS-FIRST-001: nordic-minimal / copenhagen-modern default to two columns; the sidebar (left) opens with a PROOF POINTS block of 4-5 numbers that already stand in a Results line or a Core Competencies row | `pwa/antcv-proof-points-sidebar.js` (deterministic, no model call; `layout_defaults`), prompt block |
| PROOF-POINTS-ORDER-001: proof points and competency rows ranked by what the ad stresses (volume first for DFM / mass production, cost first for a cost ad) | same sidecar (`rank`, `demand`), prompt block |
| BUDGET-SIZE-001 / SHAREABLE-FIGURES-001: "owned the budget" needs a stored size; internal-reporting figures print only when the stored fact is marked shareable | prompt block, `budget_claims` |
| PROFILE-LENGTH-001: the profile renders in 10-12 lines, two or three blocks, no block restating the ad | prompt block, `profile.min_lines` / `max_lines` / `blocks` |
| SCALE-SEMANTIC-001: a scale figure keeps its true object; years of experience counted from one named base | prompt block |
| AI-NOTICE-FOOTER-001: the AI notice is footer furniture on the last CV page only | prompt block (render already footer-only: antcv-watermark-page-anchor, docx-worker footer) |
| LANGUAGES-ORDER-001 (revised): English first, then Danish, Spanish, Hebrew | `languages_order`, antcv-languages-concise.js, quality_pass.py |
| EXPERIENCE-SPACING-001: role gap 14 px by default with nordic-minimal / copenhagen-modern | sidecar sets `styleConfig.roleGap` once; the "CV main · role gap" slider still wins |
| REFERENCES-RELATION-001: every named reference says how they know the candidate; hardware manager first for a director-level hardware role; only agreed referees | prompt block, `cv_pointers.references` (data: `personalInfo.referees[].relation`) |
| SOURCE-FRACTURES-001: the supervisor reads the source as a metric ledger + shuffled atomic facts, the coherence reviewer as a ledger + facts by kind, the repair writer as a ledger first; a number no source line carries fails the check before any model is asked (job-ad / company numbers are allowed as company facts only) | `workers/proxy/src/source-fractures.js` + supervisor.js + gen-coherence.js (demo-proxy byte-identical), `test/source-fractures.test.mjs` |

## 7. EU AI Act and GDPR (2026-10-23)

Owner 2026-10-23: AntCV follows the EU AI Act and the GDPR. Duty map and open items: `docs/compliance/EU_AI_ACT_GDPR.md`. `pwa/gold-rules.json` 1.9.7.

| Rule | Enforcement |
|---|---|
| SPECIAL-CATEGORIES-001: the writer never infers, adds or expands GDPR Art. 9 data (health, belief, politics, union, ethnicity, sex life) or criminal records; such a fact stays only where the candidate wrote it; no ID number, date of birth, marital status or children unless the source states it and the job's country expects it | prompt block |
| CL-GDPR-CV-001 (existing): an unsolicited letter offers the CV on request instead of attaching it | prompt block |
| REFERENCES-RELATION-001 (existing): only referees marked agreed are named; contact details on request | prompt block |
| GDPR-RIGHTS-001: account delete reaches every user-keyed D1 table; `GET /api/prefs/export` returns the server-side copy (API key values masked); the Personal launcher offers "Copy of my cloud data" and links `privacy.html` | `workers/access-relay/src/gdpr-user-data.js` (`USER_TABLES`), `tests/gdpr-user-data.test.mjs` (fails when a new `user_hash` table is not listed), `pwa/antcv-data-export-360.js` |
| PRIVACY-NOTICE-001: GDPR Art. 13 notice and AI use text | `pwa/privacy.html` |
