# AntCV — Active Bug Tracker

Living list of open issues. Newest section at top. Mark items `[FIXED]`, `[VERIFYING]`, or `[OPEN]`.
Canonical detailed QA spec remains `AntCV_UI_UX_Spec_and_QA_Plan_v4.docx`; this file is the fast-moving working list.

---

## OPEN

### CL-HEADER-001 — Cover-letter "Application: [Role] — [Company]" header not editable, wrong font/colour
- **Status:** OPEN — not yet touched.
- **Symptom:** The header line "Application: [Role] — [Company]" cannot be edited in the CL preview, and renders in the wrong font/colour versus the rest of the document.
- **Root cause (suspected):** Panel role/company edits write to a HIDDEN anchor (`data-antcv-candidate-anchor-hidden="1"`, `display:none`) while the VISIBLE editable sentence (`data-antcv-candidate-application-sentence="1"`, Trebuchet contenteditable spans) keeps the `[Role]` / `[Company]` placeholders. The two are not synced — edits land on the hidden node, the visible sentence never updates.
- **Fix direction:** Bridge panel Role/Company edits to the visible sentence spans (or make the visible sentence the single source of truth); correct the font/colour to match document tokens. Verify in Preview, PDF, and DOCX.

### APPHIST-ZIDX-001 — "Open in Settings →" opens Settings behind the preview
- **Status:** OPEN — needs live DOM evidence on fresh code before fixing.
- **Symptom:** From Application History, clicking "Open in Settings →" opens the Settings panel BEHIND the preview (z-index / stacking-context issue); user can't see/reach it.
- **Context:** app.js handler (v1.40.326) sets settingsTab + `window._antcvOpenSettingsRoute({tier:"standard",subtab:"apps"})`. Related sidecars: `antcv-app-history-zfix-291`, `antcv-app-history-back-to-preview-341`, `antcv-preview-shell-sticky-341`.
- **Fix direction:** Capture the stacking order live on current deployed code, then raise the Settings route above the preview shell (or lower the preview while Settings is foregrounded). Do not fix blind — confirm the actual offending stacking context first.

### EXPORT-PAGE2-001 — Document-export preview: page 2 missing / no page breaks
- **Status:** OPEN — re-verify on fresh code.
- **Symptom:** Export preview shows only page 1 / page breaks not applied; page 2 content missing from the rendered preview.
- **Context:** Gate collects all `.antcv-preview-paper`; `antcv-pdf-page-mismatch.js` chips on a count mismatch. Page-break sidecars: `antcv-page-breaks-everywhere-284`, `antcv-table-page-splits-327`, `antcv-sidebar-subsection-pagebreaks-329`. Watermark anchoring: `antcv-watermark-page-anchor-341`.
- **Fix direction:** Re-test on fresh deployed code first (several page-break fixes have shipped). If still broken, determine whether the break is dropped in the preview render path or only in the PDF/DOCX export path, and confirm against the QA spec PB-001..006 acceptance gates.

---

## VERIFYING (shipped this session, confirm on fresh code)

- **section-panel-211 v1.40.350** — endless Publications mini-button flicker / re-injection. Idempotent attribute writes + observer guard + attribute-first classification.
- **pub-injected-reaper-352** — removes the two stale `data-antcv-pub-injected` Enhance/Fit buttons wherever they appear.
- **mobile-fab-cleanup-351** — hides mobile JD/Fusion FABs; relocates mobile Privacy into the top bar as a compact higher-contrast pill.
- **cl-body-move-button-341 v1.40.350** — ☰ Move button mounts on CL body rows (`data-antcv-align-sid` selector fix).
- **personal-info-anti-thinning-353 → v1.40.354** — blocks load-time near-total wipe of local personalInfo; narrowed so it never touches generation/editing writes.
- **cloud-put-shrink-guard-355** — compares a thin /api/prefs PUT against a fresh cloud GET; blocks a large shrink. (Committed; wiring/verification pending.)
- **analysis-panel-jd-block-356** — embedded unified JD-analysis block in the Analysis panel (runs both /api/recheck-fit and /api/jd-analysis; renders in-panel + writes rationale). Replaces the redundant jd-input-356.

---

## NOTES / DEPENDENCIES

- Deployed app.js does NOT yet render `recruiter` / `red_flags` from `rationale`. The 356 block renders those in-panel itself (Option A). Native panel render of those fields needs an app.js push (manual; minified bundle).
- Housekeeping (low priority): prune stale `.claude/worktrees/*` once page-break/watermark/CL work is closed; keep `fix+page-break-model`, `fix+watermark-page-anchor`, `fix+cover-letter-editor`, `fix+regression-sweep`.
