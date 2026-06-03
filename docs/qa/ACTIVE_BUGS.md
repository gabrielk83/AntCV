# AntCV — Active Bug Tracker

Living list of open issues. Newest section at top. Mark items `[FIXED]`, `[VERIFYING]`, or `[OPEN]`.
This file now folds in the canonical `AntCV_UI_UX_Spec_and_QA_Plan_v4.docx` backlog (see "QA SPEC BACKLOG" below) so there is a single working list. The .docx remains the source of full prose detail; a machine-retrievable ID index lives alongside this file at `docs/qa/AntCV_QA_backlog_index_v4.md`.

---

## 2026-06-03 — test-infrastructure landing + roadmap status audit (branch `claude/antcv-roadmap-bugs-L9Sqa`)

Scope this entry covers: automated tests and status tracking only. No sidecar,
`app.js`, or React-island behaviour changed — the open UI/UX items below are
untouched and still owe live verification per the DoD gate.

### Landed
- **Proxy writing-engine unit tests (40, `node:test`).** `workers/proxy/test/writing-style-engine.test.mjs` (32) + `workers/proxy/test/registry-sync.test.mjs` (8). Pure logic, no Cloudflare bindings, no network — every LLM call is injected. `npm test` in `workers/proxy/` is now `node --test`. All 40 pass locally on Node 22.
- **Registry-drift guard.** `registry-sync.test.mjs` ties the worker's inline style + banned-list subset back to the canonical `writingSystems/registry.json` (style-id set, default, language partition, shared banned words + phrases exact, per-style active / allowed length / tone chips / glyph density, every legacy alias resolves, active-at-cut roster). The "keep in sync" comment in `writing-style-engine.js` is now enforced, not advisory.
- **CI gains a functional check.** `.github/workflows/deploy.yml` adds a `unit-tests` job (Node 22, `node --test`, no install step) and a `pull_request` trigger so `lint` + `unit-tests` run pre-merge. Deploy jobs stay gated on push-to-main / workflow_dispatch — a PR never deploys.
- **Docs updated:** `TESTING.md` (Unit row, new "Proxy worker" subsection, §8.4 row marked seeded, CI section), `README.md` Tests list.

### Roadmap status audit — confirmed implemented in code (live/visual verification per DoD is separate)
- **§4.7 writing-engine pipeline** — `workers/proxy/src/writing-style-engine.js`: request parse + normalisation, preamble enrichment, SCE banned-list filter, ≤2-retry loop with flagged third draft, ATS glyph conversion, telemetry. Now unit-covered.
- **§4.5 language-partitioned banned lists** — object keyed by ISO code in both registry and worker; a Danish output is never filtered against English bans. Now unit-covered (preamble + SCE partition tests).
- **§4.10 glyph rules** — `src/lib/glyph-rules.ts` (PWA) + worker copy; allowed bullets and ATS labels agree across both.
- **Registries present and driving output** — `packages/registry.json` (CSS bundle + DOCX palette), `writingSystems/registry.json` (12-style engine).
- **Pass-1 React islands** — present under `src/islands/` (LanguageCard, PreviewToolbar, SettingsRouter, PackagePicker, WritingStylePicker, ExportOptionsCard, LayoutPicker, Breadcrumbs, wizard pickers).
- **docx-worker per-package palette (v1.50.8)** — `workers/docx-worker/src/palette.js`, legacy-ATS Calibri fallback; baseline smoke (`test/smoke.js`) passes locally.

### Known environmental gap (not a product bug)
- `workers/access-relay/tests/*.mjs` hardcode the sql.js wasm at `/home/claude/work/sqljs/sql-wasm.{cjs,wasm}`, which is absent here, so both relay suites error on load (`MODULE_NOT_FOUND`) until that path is provisioned. They are not in CI for this reason. Candidate follow-up: make the wasm path overridable via env var and vendor or fetch sql.js so the relay suites can join the `unit-tests` job.

---

## SESSION LANDED — shipped to `main`, LIVE VERIFICATION OWED (highest priority)

Everything in this block is committed to `main` (code complete) but went straight to `main` **without passing the acceptance gate** (see DoD below). None of it has been confirmed on the live site. Treat live verification as the top open task — bias to short, careful checks, and do not mark any item FIXED until it passes in Preview + PDF + DOCX (where applicable) on **desktop and mobile**, with no Preview-only, wrong-item, or after-hard-refresh-only behaviour.

Deploy anchor: islands bundle rebuild + Export-options move landed at commit `c475c4b` on `main`. Verify Cloudflare Pages has built that commit, then `?hardReset=1` before testing (clears the service worker + caches).

### What landed this session
- **QA spec v4 ingest.** Memory pointer added; canonical index committed at `docs/qa/AntCV_QA_backlog_index_v4.md`; this `ACTIVE_BUGS.md` folds in the v4 backlog. (Documentation — no live behaviour to verify, but it is the source of the IDs referenced below.)
- **357 sidecars + loader.** `antcv-validation-severity-consumer-357.js` (VAL-001 / VF-016 — stamps Set-menu validation nodes by severity so warnings render yellow, errors red), `antcv-help-text-wording-357.js` (PB-005 / TB-003 — rewrites "Compress" to "Fit" on non-button help/legend/caption nodes), `antcv-page-break-icon-357.js` (PB-005 / GEN-003 — swaps the down-arrow glyph for the semantic next-page glyph U+2398 on identified page-break controls only), and `antcv-357-loader.js` (runtime registrar; index.html also carries direct tags — double-registration is a no-op via per-file version guards + the loader's already-present skip).
- **Analysis-panel JD block — clean v1.40.358.** `antcv-analysis-panel-jd-block-356.js` rewritten after the branch copy was found corrupted (two conflicting `findAnalysisPanel` definitions merged from parallel worktrees → syntax error that stopped the whole sidecar parsing). The clean version (a) attaches to the EMPTY-state panel — keyed on the "Generate a CV first to see the analysis" text, not just the "Application Analysis" heading that the empty state never renders — and (b) uses a TIGHTENED ancestor climb (stop at the app shell, stop when the candidate begins to contain shell controls / the Advanced-Style button, stop past ~2.2x the marker width) so the block lands in the panel column, not an oversized wrapper. Hides the native placeholder once attached.
- **Export-options → Layout subtab.** React-island source change (not a sidecar): `ExportOptionsCard` is now collapsible and **collapsed by default** (open state persists in `localStorage:antcv:exportOptionsOpen`; header shows an "N on" badge when collapsed). Its mount (`src/islands/ExportOptions/mount.tsx`) is gated on the new `isLayoutSubtab()` and anchored immediately ABOVE the "Open Advanced → Style" hand-off button via the new `findAdvancedStyleButton()` (both in `src/lib/settings-dom.ts`). Requires the rebuilt `antcv-react-islands.js` (shipped at `c475c4b`); source changes alone do nothing until that bundle is built + the bundle `?v=` is bumped.

### Verification checklist (run on live, desktop AND mobile)
- [ ] **Analysis panel (empty state):** shows the JD paste/upload + "Analyse JD" block instead of only "Generate a CV first to see the analysis." Block sits in the panel column (not an oversized wrapper). Console shows `[analysis-panel-jd-block-356] installed v1.40.358`. Run completes both /api/recheck-fit and /api/jd-analysis and renders in-panel.
- [ ] **Export-options in Layout subtab:** appears collapsed by default, immediately above the "Open Advanced → Style" button; caret expands/collapses; "N on" badge reflects active toggles. Both ATS-safe and Legacy-tier toggles work and PERSIST across Settings close/reopen (write to `personalInfo.exportPrefs`).
- [ ] **Export-options removed from Personal subtab** (no duplicate, no orphan).
- [ ] **VAL-001 / VF-016:** validation warnings render yellow, errors red, with distinct labels.
- [ ] **PB-005 / TB-003:** no user-facing "Compress" wording in help/legend/caption text; page-break control shows the semantic page glyph, never a down arrow.
- [ ] Confirm none of the above is Preview-only, wrong-item, or only-after-hard-refresh.

### Known follow-ups if verification fails
- `anchorForButton` (Export-options) climb is a heuristic (max 2 single-child wrappers). If the card lands in an odd spot, report the Advanced-Style button's parent structure and tighten.
- Empty-state panel selector: if the JD block attaches to an oversized container, report `window.AntcvAnalysisPanelJdBlock356._findPanel()` (className + width) and tighten `maxW`.
- **Relay CORS mismatch (unresolved):** access-relay returns `Access-Control-Allow-Origin: https://antcv.pages.dev`, but testing was done on `cv-generator-det.pages.dev`, which is CORS-blocked at `/config` ("no relay access"). Decide the canonical live domain first, then patch the allowed origin(s) in `workers/access-relay/src/index.js`. Do not patch before the domain is settled.
- `LayoutPicker/mount.tsx` comment is now stale (it still says "between WritingStylePicker and ExportOptionsCard"); its anchor falls back correctly so it is doc-drift only.

---

## OPEN (session-level, highest priority)

### CL-HEADER-001 — Cover-letter "Application: [Role] — [Company]" header not editable, wrong font/colour
- **Status:** OPEN — not yet touched.
- **Symptom:** The header line "Application: [Role] — [Company]" cannot be edited in the CL preview, and renders in the wrong font/colour versus the rest of the document.
- **Root cause (suspected):** Panel role/company edits write to a HIDDEN anchor (`data-antcv-candidate-anchor-hidden="1"`, `display:none`) while the VISIBLE editable sentence (`data-antcv-candidate-application-sentence="1"`, Trebuchet contenteditable spans) keeps the `[Role]` / `[Company]` placeholders. The two are not synced — edits land on the hidden node, the visible sentence never updates.
- **Fix direction:** Bridge panel Role/Company edits to the visible sentence spans (or make the visible sentence the single source of truth); correct font/colour to document tokens. Verify in Preview, PDF, and DOCX.
- **Related QA-spec IDs:** CA-002 (Application sentence sync), CL-LAYOUT-002 (Application line width).

### APPHIST-ZIDX-001 — "Open in Settings →" opens Settings behind the preview
- **Status:** OPEN — needs live DOM evidence on fresh code before fixing.
- **Symptom:** From Application History, clicking "Open in Settings →" opens the Settings panel BEHIND the preview (z-index / stacking-context issue); user can't see/reach it.
- **Context:** app.js handler (v1.40.326) sets settingsTab + `window._antcvOpenSettingsRoute({tier:"standard",subtab:"apps"})`. Related sidecars: `antcv-app-history-zfix-291`, `antcv-app-history-back-to-preview-341`, `antcv-preview-shell-sticky-341`.
- **Fix direction:** Capture the stacking order live on current deployed code, then raise the Settings route above the preview shell (or lower the preview while Settings is foregrounded). Do not fix blind.
- **Related QA-spec IDs:** AH-001 (Open in Settings foregrounds Application History).

### EXPORT-PAGE2-001 — Document-export preview: page 2 missing / no page breaks
- **Status:** OPEN — re-verify on fresh code.
- **Symptom:** Export preview shows only page 1 / page breaks not applied; page 2 content missing from the rendered preview.
- **Context:** Gate collects all `.antcv-preview-paper`; `antcv-pdf-page-mismatch.js` chips on count mismatch. Page-break sidecars: `antcv-page-breaks-everywhere-284`, `antcv-table-page-splits-327`, `antcv-sidebar-subsection-pagebreaks-329`. Watermark: `antcv-watermark-page-anchor-341`.
- **Fix direction:** Re-test on fresh deployed code. If still broken, determine whether the break is dropped in the preview render path or only in PDF/DOCX export; confirm against PB-001..006 gates.
- **Related QA-spec IDs:** PB-001..006, WM-005.

---

## QA SPEC BACKLOG (merged from AntCV_UI_UX_Spec_and_QA_Plan_v4.docx)

Status legend: `[ ]` open · `[~]` partially addressed · `[x]` believed fixed (verify). Update as work lands.
Full ID list with severities: `docs/qa/AntCV_QA_backlog_index_v4.md`.

### Core rules / Definition of Done (GEN)
- **GEN-001..011** — [~] Preview/DOCX/PDF parity; control locality (a button acts only on its own item); standard control order = Page Break, CJLR, Enhance, Fit, Delete; "Compress" renamed "Fit" everywhere; edit persistence; no clipped/hidden controls; drag-drop parity; a11y labels; preview-utility responsive parity; warning = yellow, error = red; CL generation must capture table data.
- **Acceptance gate (DoD):** no fix accepted if it works in Preview but not DOCX/PDF; affects the wrong item; lands a drag-drop at the end when the indicator showed elsewhere; attaches the watermark to text flow instead of the page box; hides/clips controls; or only works after a hard refresh. Every fix verified in Preview + PDF + DOCX, desktop and mobile where relevant. Page Break icon must be a semantic page-change glyph, never a down arrow.

### Cover Letter (CL)
- **CL-001** — [ ] Remove duplicate Preview action-button overlay.
- **CL-002** — [ ] Make Closure directly editable + persist.
- **CL-003** — [ ] Model "How I Would Contribute" as Intro + per-bullet rows + Closing (closing never a bullet; +Add at end).
- **CL-004** — [ ] Attach one control group per Foundation textbox.
- **CL-005** — [ ] Normalize CL body controls + add section-move button. (Partially via `cl-body-move-button-341` ☰ Move — VERIFYING.)
- **CL-006** — [ ] Capture table data in CL generation.
- **CL-LAYOUT-002** — [ ] (High) Constrain Application line to usable page width in Preview/PDF/DOCX.

### Page Break (PB)
- **PB-001** — [ ] Manual break from main + sidebar updates state, page model, numbering, all outputs.
- **PB-002** — [ ] Break on first sub-subsection moves whole subsection to next page with original heading, no dup.
- **PB-003** — [ ] Non-first sub-subsection duplicates heading + localized "Cont." label 18pt from top.
- **PB-004** — [ ] Table: first row moves whole table; later row splits and repeats headers.
- **PB-005** — [~] Replace down-arrow icon and "Compress" text. (Semantic page glyph via `page-break-icon-357`; "Fit" wording via `help-text-wording-357`/`row-controls-wording-341` — VERIFYING this session.)
- **PB-006** — [ ] Keep Professional Experience CONT pattern.

### Watermark + Candidate (WM / CA)
- **WM-001** — [ ] Anchor watermark to last-page corner, page-level not text flow.
- **WM-002** — [ ] Avoid collision; lower corner by clearance.
- **WM-003** — [ ] Text-only, no border/fill/shadow.
- **WM-004** — [ ] CL watermark page-anchored.
- **WM-005** — [ ] PDF watermark last page only.
- **CA-001..005** — [ ] Candidate Preview editing; Application sentence sync (panel Role/Company vs rendered sentence, no dup label) [see CL-HEADER-001]; section-move on movable rows; insertion-point drag-drop; destination styling and Restore.

### Tables / Outcomes / Publications (TB / SO / PP)
- **TB-001** — [ ] Per-line CJLR on Core Competencies.
- **TB-002** — [ ] Page Break per row per PB-004.
- **TB-003** — [~] Fix "What I Bring" help text; no "Compress" or down arrow. (Help-text wording via `help-text-wording-357` — VERIFYING this session.)
- **SO-001** — [ ] Add Page Break, CJLR, Enhance, Fit before Delete on each Selected Outcome row.
- **SO-002** — [ ] New rows identical.
- **PP-001** — [ ] Expose hidden Publications controls in row layout.
- **PP-002** — [ ] Single input acts on whole entry.
- **PP-003** — [~] HIGH-RISK; shared row-control model only; buttons row-anchored and stable in generation. (Stale injected Enhance/Fit buttons addressed by `pub-injected-reaper-352` — VERIFYING.)

### Preview shell + validation (PRV / AH / VAL)
- **PRV-001** — [ ] Restore 3 desktop lower-right Preview utility buttons.
- **PRV-002** — [ ] Restore Privacy and Fuse CL-CV desktop placement, no hidden dups.
- **PRV-003** — [ ] PDF and DOCX buttons persistent in top Preview area, route-independent.
- **PRV-004** — [ ] Loading status not click-dismissable while a job runs.
- **PRV-005** — [ ] Circular buttons viewport-specific; mobile bottom-right kept. (Mobile FAB cleanup via `mobile-fab-cleanup-351` — VERIFYING.)
- **AH-001** — [ ] "Open in Settings" foregrounds Application History [see APPHIST-ZIDX-001].
- **VAL-001** — [~] Errors red, warnings yellow, distinct labels. (Token sidecar `validation-severity-341` + consumer `validation-severity-consumer-357` that stamps the rendered Set-menu nodes — VERIFYING this session. Overlaps GEN-011 / VF-016.)

### Onboarding / generation / layout / export / responsive (third + fourth pass)
- **LANG-001** — [ ] (Med) Settings vs top-bar language mismatch (Chinese ticked, not in bar); fallback EN+DA, wizard is source of truth.
- **IMPORT-001** — [ ] (High) Import reports 0 work entries despite valid JSON; map experience/education/certifications/publicationsStructured lengths.
- **ONBOARD-001** — [ ] (High) Step 3B writing-register list not scrollable on mobile; Next unreachable (dvh, sticky footer).
- **GEN-001b** — [ ] (High, §14.2) Kernel generation leaves major CV sections empty/underfilled; add unsolicited fallback + warnings.
- **GEN-002b** — [ ] (High, §14.2) CL generation drops What I Bring table signals + Why This Position bullets.
- **GEN-UI-001** — [ ] (Med) Redundant Enhance/Fit buttons under generation Cancel action.
- **GEN-UI-002** — [ ] (Med) Generation time estimate too optimistic; almost-done shown too early (use ~4 min default).
- **GEN-UI-003** — [ ] (High) Repeated/endless Fit controls under "Cancel & return to editor"; hard rendering guard when generation view active.
- **LAYOUT-001** — [ ] (High) Sidebar background does not extend to page bottom in Preview/PDF/DOCX.
- **EXPORT-001** — [ ] (Med) Missing download-start indicator for PDF/DOCX export.
- **EXPORT-002** — [ ] (Critical) PDF export fails; needs visible recovery + retry, must not corrupt current doc.
- **RESPONSIVE-001** — [ ] (High) Mobile Preview loads desktop split-pane layout; Section/Analysis/Preview must be mobile bottom modes.
- **PDF-LAYOUT-001** — [ ] (High) PDF page 2 shows stray Selected Outcomes heading before Professional Experience continuation.

---

## VERIFYING (shipped, confirm on fresh code)

- **export-options → Layout subtab (islands `c475c4b`)** — moved from Personal; collapsible, collapsed by default, above the Advanced-Style button. See SESSION LANDED checklist. (Export-options relocation.)
- **analysis-panel-jd-block-356 → v1.40.358** — clean rewrite; attaches to the empty-state panel + tightened ancestor selection; index.html tag + loader registered. See SESSION LANDED checklist. (Analysis panel empty-state usability.)
- **validation-severity-consumer-357** — stamps Set-menu validation nodes by severity (VAL-001 / VF-016). See SESSION LANDED checklist.
- **help-text-wording-357** — "Compress" → "Fit" on non-button help/legend/caption nodes (PB-005 / TB-003).
- **page-break-icon-357** — down-arrow → semantic page glyph U+2398 on identified page-break controls (PB-005 / GEN-003).
- **357-loader** — runtime registrar for the four sidecars above; skips any already present via a direct index.html tag.
- **section-panel-211 v1.40.350** — endless Publications mini-button flicker / re-injection. Idempotent attribute writes + observer guard + attribute-first classification.
- **pub-injected-reaper-352** — removes the two stale `data-antcv-pub-injected` Enhance/Fit buttons wherever they appear. (PP-003)
- **mobile-fab-cleanup-351** — hides mobile JD/Fusion FABs; relocates mobile Privacy into the top bar as a compact higher-contrast pill. (PRV-005)
- **cl-body-move-button-341 v1.40.350** — ☰ Move button mounts on CL body rows (`data-antcv-align-sid` selector fix). (CL-005)
- **personal-info-anti-thinning-353 → v1.40.354** — blocks load-time near-total wipe of local personalInfo; narrowed so it never touches generation/editing writes.
- **cloud-put-shrink-guard-355** — compares a thin /api/prefs PUT against a fresh cloud GET; blocks a large shrink. (Committed; wiring/verification pending.)

---

## NOTES / DEPENDENCIES

- Deployed app.js does NOT yet render `recruiter` / `red_flags` from `rationale`. The 356 block renders those in-panel itself (Option A). Native panel render of those fields needs an app.js push (manual; minified bundle).
- React-island changes (e.g. the Export-options move) require a Vite rebuild of `pwa/antcv-react-islands.js` and a bundle `?v=` bump — source edits alone never reach the live site. Last islands rebuild: `c475c4b`.
- Housekeeping (raised to MEDIUM): prune stale `.claude/worktrees/*`. These caused repeated git trouble this session — `main` advancing under local work, a recurring merge conflict on `antcv-analysis-panel-jd-block-356.js`, and an accidental push of `fix/validation-severity` (283 unpushed commits) from inside a worktree. Remove the ones not actively used before the next work session; confirm none is running an automated agent that pushes to `main`.
- The QA-spec IDs above are summarized from `AntCV_UI_UX_Spec_and_QA_Plan_v4.docx`; consult that doc for full per-ID prose, screenshots, and acceptance detail. The retrievable ID index is `docs/qa/AntCV_QA_backlog_index_v4.md`.
