# AntCV — Active Bug Tracker

Living list of open issues. Newest section at top. Mark items `[FIXED]`, `[VERIFYING]`, or `[OPEN]`.
This file now folds in the canonical `AntCV_UI_UX_Spec_and_QA_Plan_v4.docx` backlog (see "QA SPEC BACKLOG" below) so there is a single working list. The .docx remains the source of full prose detail; a machine-retrievable ID index lives alongside this file at `docs/qa/AntCV_QA_backlog_index_v4.md`.

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
- **PB-005** — [ ] Replace down-arrow icon and "Compress" text. (Overlaps GEN: semantic page glyph; "Fit".)
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
- **TB-003** — [ ] Fix "What I Bring" help text; no "Compress" or down arrow.
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
- **VAL-001** — [ ] Errors red, warnings yellow, distinct labels. (Overlaps GEN-011.)

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

## VERIFYING (shipped this session, confirm on fresh code)

- **section-panel-211 v1.40.350** — endless Publications mini-button flicker / re-injection. Idempotent attribute writes + observer guard + attribute-first classification.
- **pub-injected-reaper-352** — removes the two stale `data-antcv-pub-injected` Enhance/Fit buttons wherever they appear. (PP-003)
- **mobile-fab-cleanup-351** — hides mobile JD/Fusion FABs; relocates mobile Privacy into the top bar as a compact higher-contrast pill. (PRV-005)
- **cl-body-move-button-341 v1.40.350** — ☰ Move button mounts on CL body rows (`data-antcv-align-sid` selector fix). (CL-005)
- **personal-info-anti-thinning-353 → v1.40.354** — blocks load-time near-total wipe of local personalInfo; narrowed so it never touches generation/editing writes.
- **cloud-put-shrink-guard-355** — compares a thin /api/prefs PUT against a fresh cloud GET; blocks a large shrink. (Committed; wiring/verification pending.)
- **analysis-panel-jd-block-356** — embedded unified JD-analysis block in the Analysis panel (runs both /api/recheck-fit and /api/jd-analysis; renders in-panel + writes rationale). Replaces redundant jd-input-356. (Pending: index.html script tag.)

---

## NOTES / DEPENDENCIES

- Deployed app.js does NOT yet render `recruiter` / `red_flags` from `rationale`. The 356 block renders those in-panel itself (Option A). Native panel render of those fields needs an app.js push (manual; minified bundle).
- Housekeeping (low priority): prune stale `.claude/worktrees/*` once page-break/watermark/CL work is closed; keep `fix+page-break-model`, `fix+watermark-page-anchor`, `fix+cover-letter-editor`, `fix+regression-sweep`.
- The QA-spec IDs above are summarized from `AntCV_UI_UX_Spec_and_QA_Plan_v4.docx`; consult that doc for full per-ID prose, screenshots, and acceptance detail. The retrievable ID index is `docs/qa/AntCV_QA_backlog_index_v4.md`.
