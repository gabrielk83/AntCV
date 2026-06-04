# AntCV — Master Backlog (Active Bugs + Planned Features)

> **Single consolidated list.** Compiled from the three working sources so there is one
> place to scan everything open:
> - `docs/qa/ACTIVE_BUGS.md` — living session log + the folded-in v4 backlog.
> - `docs/qa/AntCV_QA_backlog_index_v4.md` — canonical ID index + severities (generated from
>   `AntCV_UI_UX_Spec_and_QA_Plan_v4.docx`, the formatted master).
> - `docs/plan/Batch_2026-06-04_feature-and-bug-triage.md` — owner feature/bug dump + layering verdicts.
>
> When this file and the v4 .docx disagree, **the .docx wins** (authority rule). Update this
> file as work lands; it is a roll-up, not a second source of truth for prose detail.

Branch: `claude/antcv-roadmap-bugs-L9Sqa`. Compiled 2026-06-04.

## Authority + acceptance rules (apply to every item)

- **Output parity (GEN-001):** every change must behave identically in Preview, DOCX, and PDF, and on desktop and mobile, unless a requirement explicitly excludes export.
- **Acceptance gate — a fix is NOT accepted if it:** works in Preview but not DOCX/PDF; affects the wrong item; lands a drag-drop at the end when the indicator showed elsewhere; anchors the watermark to text flow instead of the page box; hides/clips controls or needs horizontal scroll to reach them; or only works after a hard refresh.
- **Standard control order:** Page Break, CJLR, Enhance, Fit, Delete (drop Delete where unsupported). Section-move sits to the LEFT of that group. Page Break icon = semantic page glyph, never a down arrow. No user-facing text may say "Compress" (use "Fit").

## Status legend

| Tag | Meaning |
|----|---------|
| `OPEN` | Not started, or diagnosed but unfixed. |
| `PARTIAL` | Some sub-items shipped; spec not fully met. |
| `VERIFYING` | Code shipped this engagement; live (Preview+PDF+DOCX, desktop+mobile) acceptance owed. |
| `FIXED✓` | Owner-confirmed working. |
| `PROBE-GATED` | Diagnostic-first per CLAUDE.md: read-only probe must run before any patch. |

---

# PART 1 — ACTIVE BUGS

## 1. Global requirements / Definition of Done (§3)

| ID | Requirement | Status |
|----|-------------|--------|
| GEN-001 | Preview / DOCX / PDF parity | PARTIAL (enforced per-item) |
| GEN-002 | Control locality (button affects only its owning item) | PARTIAL |
| GEN-003 | Standard control order | PARTIAL — HIWC + Selected Outcomes reordered (1.50.120); Publications/Core/WIB still owed |
| GEN-004 | No "Compress" wording; must say "Fit" | PARTIAL — runtime rewriters + HIWC/Outcomes source renamed (1.50.120); audit remaining surfaces |
| GEN-005 | Edit persistence (survives blur, reopen, export) | PARTIAL |
| GEN-006 | Controls visible (not clipped/hidden/h-scroll) | PARTIAL |
| GEN-007 | Drag-and-drop parity with panel controls | OPEN |
| GEN-008 | Accessible controls (deterministic tooltip + label) | PARTIAL |
| GEN-009 | Preview utility visibility + responsive parity | OPEN |
| GEN-010 | Status/validation severity clarity (warn=yellow, err=red) | VERIFYING (see VAL-001) |
| GEN-011 | Generation captures source-table content, not only paragraphs | OPEN (see CL-006 / GEN-002b) |

## 2. Cover Letter (CL)

| ID | Item | Sev | Status |
|----|------|-----|--------|
| CL-001 / VF-001 | Remove duplicated Preview action-button overlay (two 4-button groups) | — | OPEN |
| CL-002 | Make Closure directly editable + persist | — | OPEN |
| CL-003 / VF-002 | Model "How I Would Contribute" as Intro + per-bullet rows + Closing (+Add at end; closing never a bullet) | — | PARTIAL (editing shipped; full model owed) |
| CL-004 / VF-003 | Attach one control group per Foundation textbox (not between textboxes) | — | OPEN |
| CL-005 / VF-006 | Normalize CL body controls + add section-move button | — | PARTIAL (`cl-body-move-button-341` ☰ Move — VERIFYING) |
| CL-006 / VF-017 | Capture table data in CL generation | — | OPEN |
| CL-007 | HIWC bullets flicker on the cover letter (oscillate rendered ↔ kernel placeholders) | High | VERIFYING (idempotent repaint, 1.50.57) |
| CL-HEADER-001 | "Application: [Role] — [Company]" header not editable in CL preview + wrong font/colour | High | PROBE-GATED (`antcv-cl-header-probe.js`; root: `wrapApplicationSentence` never attaches host on CL) |
| CL-LAYOUT-002 | Constrain Application line to usable page width in Preview/PDF/DOCX | High | OPEN |

## 3. Page Break (PB) + export-preview

| ID | Item | Status |
|----|------|--------|
| PB-001 | Manual break from BOTH main + sidebar updates state, page model, numbering, all outputs | PARTIAL (sidebar via `329`/1.50.115; main-area + on-entry control unverified) |
| PB-002 | Break on first sub-subsection moves whole subsection to next page w/ original heading, no dup | OPEN |
| PB-003 | Non-first sub-subsection duplicates heading + localized "Cont." 18pt from top | OPEN |
| PB-004 / TB-002 | Table: first row moves whole table; later row splits + repeats headers | OPEN (per-row toggle TABLE-PAGEBREAK-001 PARKED — needs per-doc keying that reaches DOCX worker) |
| PB-005 | Replace down-arrow icon + "Compress" text (semantic page glyph; "Fit") | VERIFYING (`page-break-icon-357`, `help-text-wording-357`, `row-controls-wording-341`) |
| PB-006 / VF-018 | Preserve Professional Experience CONT pattern (reference) | OPEN (reference behaviour to keep) |
| EXPORT-PAGE2-001 | Export preview shows only page 1 / breaks not applied | PROBE-GATED (`antcv-export-page2-probe.js`; worker engine passes smoke tests → defect in client `antcv-pdf-preview-gate.js` clone path) |
| PDF-LAYOUT-001 | PDF page 2 shows stray Selected Outcomes heading before Professional Experience continuation | High · OPEN |
| PAGEBREAK-002 | Break should show on entry + on natural A4 overflow, not only after pressing button | OPEN (add overflow probe to `284`) |
| PAGEBREAK-005 | Cascade colour across ALL CV sections + CL (today only Professional Experience) | OPEN (extend `page-button-polish-327`) |

## 4. Watermark (WM)

| ID | Item | Sev | Status |
|----|------|-----|--------|
| WM-001 / VF-004 | Anchor watermark to last-page corner, page-level not text flow | — | OPEN |
| WM-002 | Avoid collision; lower corner by clearance | — | OPEN |
| WM-003 | Text-only, no border/fill/shadow | Med | OPEN |
| WM-004 | CL watermark page-anchored | High | OPEN |
| WM-005 | PDF watermark last page only | High | OPEN |

## 5. Candidate / Application / movement (CA)

| ID | Item | Status |
|----|------|--------|
| CA-001 / VF-005 | Candidate Preview editing (spec line `[Specialisation — …]` editable) | PARTIAL (FIXED✓ for spec line via `341`; SPECIALISATION-EDIT-001 react-rendered line still owed) |
| CA-002 | Application sentence sync (panel Role/Company ↔ rendered sentence, no dup label) | OPEN (see CL-HEADER-001) |
| CA-003 / VF-006 | Section-move button on all movable rows (CL body, CV sidebar, CV main) | OPEN |
| CA-004 / VF-007 | Precise insertion-point drag-and-drop (not drop-at-end) | OPEN |
| CA-005 | Preserve destination styling/contrast after move + Restore | OPEN |
| APP-SENTENCE-STYLE-001 | Application sentence doesn't follow chosen package style (e.g. Nordic=white) | OPEN (`candidate-preview-editor-341:334–350`) |
| NAME-ALIGN-001 | Name renders left while CJLR control reads "center" | FIXED✓ (sidecar `name-align-fix` 1.1.0, passive CSS rule) |

## 6. Tables / Selected Outcomes / Publications

| ID | Item | Status |
|----|------|--------|
| TB-001 | Per-line CJLR on Core Competencies | OPEN |
| TB-003 / VF-008 | Fix "What I Bring" help text; no "Compress"/down arrow | VERIFYING (`help-text-wording-357`) |
| SO-001 / VF-009 | Add Page Break, CJLR, Enhance, Fit before Delete on each Selected Outcome row | PARTIAL (controls present; order fixed 1.50.120; Page-Break behaviour owed) |
| SO-002 | New outcome rows identical | OPEN |
| PP-001 / VF-010 | Expose hidden Publications controls in row layout | PARTIAL (`273` strict-row + `278` exclusion shipped; eye-leftmost / ✕-adjacent / ▲▼ visible owed) |
| PP-002 | Single input acts on whole entry | OPEN |
| PP-003 | HIGH-RISK; shared row-control model only; buttons row-anchored + stable in generation | PARTIAL (`pub-injected-reaper-352` — VERIFYING) |
| PUB-ROW-MULTIROW-001 | `273` controls attach only to row 1; rows 2-3 show input+delete only | OPEN (re-check after loop fix) |
| MERGED-MOVE-CONTROL-001 | Replace big up/down with compact stacked control across all list sub-subsections + drag-to-move reflected in preview | OPEN |
| CL-BODY-CONTROLS-001 | CL Body rows missing the ▶ first button; ☰ "Move Greeting" handler doesn't work | OPEN |

## 7. Preview shell / routing / validation (PRV / AH / VAL)

| ID | Item | Sev | Status |
|----|------|-----|--------|
| PRV-001 / VF-011 | Restore 3 desktop lower-right Preview utility buttons | — | OPEN |
| PRV-002 / VF-012 | Restore Privacy + Fuse CL→CV desktop placement, no hidden dups | — | OPEN |
| PRV-003 / VF-013 | PDF + DOCX buttons persistent in top Preview area, route-independent | — | OPEN |
| PRV-004 / VF-015 | Loading status not click-dismissable while a job runs | — | OPEN |
| PRV-005 | Circular buttons viewport-specific; mobile bottom-right kept | Med | VERIFYING (`mobile-fab-cleanup-351`) |
| AH-001 / VF-014 / APPHIST-ZIDX-001 | "Open in Settings" Application-history opens BEHIND preview | — | PROBE-GATED — **owner reports STILL BROKEN** (blind ancestor-lift failed); run `antcv-apphist-zindex-probe.js` |
| VAL-001 / VF-016 | Errors red, warnings yellow, distinct labels | — | VERIFYING (`validation-severity-341` + `-consumer-357`) |

## 8. Onboarding / import / language / wizard

| ID | Item | Sev | Status |
|----|------|-----|--------|
| IMPORT-001 | Import reports 0 work entries despite valid JSON | High | PARTIAL (`upload-recount-339` + importer bridge + `pwa/lib/import-normalize.js` 18 tests; live verify + sidecar adoption owed) |
| IMPORT-COUNT-001 | Upload extract count wrong (0 work/0 edu) — importer→personalInfo mapping | — | OPEN (app.js) |
| LANG-001 | Settings vs top-bar language mismatch; fallback EN+DA, wizard source of truth | Med | OPEN |
| ONBOARD-001 | Step 3B writing-register list not scrollable on mobile; Next unreachable | High | OPEN |
| WIZARD-001 | Step 6b must be scrollable — Next button unreachable | — | OPEN (app.js) |

## 9. Generation content + generation UI (§14.2)

| ID | Item | Sev | Status |
|----|------|-----|--------|
| GEN-001b | Kernel generation leaves major CV sections empty/underfilled; add unsolicited fallback + warnings | High | OPEN |
| GEN-002b / VF-017 | CL generation drops What I Bring table signals + Why This Position bullets | High | OPEN |
| GEN-UI-001 | Redundant Enhance/Fit buttons under generation Cancel action | Med | OPEN |
| GEN-UI-002 | Time estimate too optimistic; almost-done shown too early (use ~4 min) | Med | OPEN |
| GEN-UI-003 | Repeated/endless Fit controls under "Cancel & return to editor"; hard render guard when generation view active | High | OPEN |

## 10. Layout / export / responsive

| ID | Item | Sev | Status |
|----|------|-----|--------|
| LAYOUT-001 | Sidebar background does not extend to page bottom in Preview/PDF/DOCX | High | OPEN |
| EXPORT-001 | Missing download-start indicator for PDF/DOCX export | Med | OPEN |
| EXPORT-002 | PDF export fails; needs visible recovery + retry; must not corrupt current doc | Critical | OPEN |
| RESPONSIVE-001 | Mobile Preview loads desktop split-pane; Section/Analysis/Preview must be mobile bottom modes | High | OPEN |
| DOCX-EXPORT-REGRESSION-001 | DOCX export wired to preview-panel button only; print-setup view doesn't fire it | High | PARTIAL (`pdf-preview-gate` 1.50.90 hardened to find button or call worker directly — VERIFYING; root re-wire is app.js) |

## 11. Profile photo (PHOTO) — largely shipped, export verify owed

| ID | Item | Sev | Status |
|----|------|-----|--------|
| PHOTO-001 | Pentagon shape, full Preview/DOCX/PDF parity | High | SHIPPED 1.50.56 (verify export) |
| PHOTO-002 | Shape round-trip fix (DOCX no longer forces circle) | High | SHIPPED 1.50.56 (verify export) |
| PHOTO-003 | Pentagon contour follows all five edges | Med | PARTIAL (preview/PDF shipped 1.50.57; downloaded DOCX stroke unverified) |
| PHOTO-004 | Photo shape persists + restores from cloud | Med | SHIPPED (verify) |
| PHOTO-005 | Pentagon swatch glyph in package picker | Low | SHIPPED 1.50.57 |
| PHOTO-PLACEMENT-001 | Only sidebar photo positions render; header/main/bridge are no-ops | — | OPEN (app.js render gap) |

## 12. Performance / re-render loop

| ID | Item | Sev | Status |
|----|------|-----|--------|
| HIWC-RERENDER-LOOP-001 | Coupled-oscillator re-render storm (~50 body-observing sidecars) | High | PARTIAL — rounds 1-7 idempotency fixes shipped; loop-damper REVERTED (1.50.89); residual rAF remains |
| RERENDER-STORM-001 | `requestAnimationFrame` violation flood (root of HIWC churn + perf drain) | High | OPEN (needs mutation-source probe) |
| PERF-001 | Long main-thread handlers on export/preview path (`click` 4-11s) | Med | OPEN (not root-caused) |

## 13. Settings panel / visual package (mostly APP.JS / React islands)

| ID | Item | Status |
|----|------|--------|
| VISUAL-PKG-001 | Rename app.js panel "STYLE PACKAGE" → "Visual package" | OPEN (fold into MERGE-DUP) |
| VISUAL-PKG-002 | Each package button shows icons + enabled functionality (palette/font/shape/photo size) | OPEN (PackagePicker island) |
| VISUAL-PKG-003 | Move "Segoe UI · circle · 120px" descriptor next to Alt circles; Alt keeps head/sidebar-pair fn | PARTIAL (caption aligned; descriptor relocation pending) |
| MERGE-DUP-001 | Merge two Writing-style selects into one (keep new engine) | OPEN (needs live probe + owner decision on which engine wins) |
| MERGE-DUP-002 | Merge duplicate Preferred-tone/Tone-chips; split run-on chip | PARTIAL (`dedup-341` splits run-on) |
| MERGE-DUP-003 | Merge "save tones" into "save customs" | OPEN |
| SETTINGS-HEAD-001 | Unify settings headlines to collapsible "▸" style; Languages after WRITING STYLE | PARTIAL (placement shipped 1.50.95 — VERIFYING) |
| SECTION-LAYOUT-001 | Move Section layout below Writing styles; collapsible, collapsed by default; refresh on style change | PARTIAL (placement shipped; collapsible/refresh owed) |
| LOCATION-001 | Remove combined Location input; add Location + City that load/write user data | OPEN (app.js) |
| DEMO-WARN-001 | Demo user shouldn't see "⚠ Setup needed" when demo config valid | OPEN |
| PRIVACY-SETTINGS-001 | Privacy 🛡 FAB hidden in Settings view | VERIFYING (sticky back-off) |
| PRIVACY-FAB-FLICKER-001 | Privacy pill background "bleeps" | FIXED✓ (1.50.84 CSS-passive) |

## 14. Mobile / top-bar (this engagement — VERIFYING)

| ID | Item | Status |
|----|------|--------|
| MOB-TOPBAR-001 | Hide Ant icon + leftover table control on mobile | VERIFYING (1.50.112) |
| MOB-TOPBAR-002 | Privacy pill clipped — single-row topbar, crop filename | VERIFYING (1.50.114-115) |
| MOB-ALT-001/002 | Alt-circles → tap-to-open dropdown, opens downward, escapes clip | VERIFYING (1.50.113/116) |
| MOB-BOTTOMNAV-001 | Bottom-nav buttons clipped — shrink on mobile | VERIFYING (1.50.108) |
| HIWC-EDIT-001/002/003 | HIWC bullets editable on mobile; strip on own row; wrap row | FIXED✓ (owner-confirmed, 1.50.117-119) |
| MOBILE-FUSE-001 | Fuse (🔀) not visible in mobile bottom panel | OPEN |
| MOBILE-TABLEWIDTH-001 | Hide table-width controls entirely on mobile | OPEN |
| MOBILE-EXTRACTION-001 | Document-Extraction button hovers in grey area on mobile — re-anchor | OPEN |
| LABEL-HISTORY-001 | Rename top-bar "Application history" → "History" | FIXED✓ (`antcv-label-history.js`) |

---

# PART 2 — PLANNED FEATURES (net-new, beyond bug-fixing)

| ID | Feature | Layers | Status / notes |
|----|---------|--------|----------------|
| **FEATURE-CONF-001** | Per-sentence **confidence visualization** in the Application tab. Toggle (default OFF); ON tints sentences red=low / yellow=medium, hover shows issue + score. Preview-only, never serialised to DOCX/PDF. | WORKER + APP.JS + UI | **Design decided:** confidence is emitted **as part of the existing analysis pass** (`workers/demo-proxy/src/jd-analysis.js`), reusing its anti-fabrication / `grounded` logic — not a separate self-check call. Proposed contract: `document_confidence: [{doc, section_id, idx, text, confidence:0..1, issue}]`. Blind-safe parts (analysis schema+normalize+unit test, and the renderer+toggle) buildable now; prompt behaviour + app.js persistence need a live run. NOT in the locked docs — owner to decide whether it becomes a Writing-System "Verification / confidence" section. |
| **DATA-EXPORT-001** | Personal menu: download stored data + personal analytics to a protected file. | APP.JS | Registered. Serialize `personalInfo`/`writingPrefs`/analytics localStorage keys to a JSON blob; "protected" = clear filename + optional WebCrypto passphrase encryption (confirm with owner whether encryption is required). |
| **DELETE-SAVE-001** | In the erase ("Are you sure?") flow, add "Save my data locally first" checkbox that triggers DATA-EXPORT-001 before `AntcvFullErase`. | APP.JS | Registered; shares the export serializer with DATA-EXPORT-001. |
| **WIZARD-002** | Add a missing wizard Step 6d: default-languages selection + inform user about Personal / Layout / Advanced-Style panels. | APP.JS | Registered (new wizard step). |
| **PHOTO-PLACEMENT-001** | Implement non-sidebar photo placements (header-left/right, main-left/right, sidebar-bridge) in the preview render. | APP.JS | Registered — `format-prefs` only stores the pref; render lives in app.js (honours sidebar positions only today). |

---

# PART 3 — Shipped this engagement (context; live acceptance still owed except FIXED✓)

- **GEN-003 + GEN-004** standard control order + "Fit" wording at source — HIWC + Selected Outcomes (1.50.120, VERIFYING).
- **357 sidecars:** validation-severity-consumer (VAL-001), help-text-wording (PB-005/TB-003), page-break-icon (PB-005/GEN-003).
- **analysis-panel-jd-block-356 → v1.40.358** clean rewrite (empty-state panel attach).
- **Export-options → Layout subtab** (islands `c475c4b`, collapsible/collapsed-by-default).
- **Visual-settings placement** (PackagePicker→Layout, Languages/Section-layout re-anchored, 1.50.95).
- **Re-render loop rounds 1-7** idempotency fixes; **PRIVACY-FAB-FLICKER-001** fixed at source.
- **DOCX-EXPORT-REGRESSION-001** preview-modal export hardened (1.50.90).
- Owner-confirmed: HIWC-EDIT-001/002/003, NAME-ALIGN-001, LABEL-HISTORY-001, VF-005/CA-001 spec line, CL-HEADER store-mismatch (p0d-fix7).

---

## Housekeeping / environment notes (not product bugs)

- React-island changes need a Vite rebuild of `pwa/antcv-react-islands.js` + a bundle `?v=` bump — source edits alone never reach live. Last rebuild: `c475c4b`.
- Relay CORS: access-relay allows `https://antcv.pages.dev`; settle the canonical live domain before patching allowed origins.
- Prune stale `.claude/worktrees/*` — caused merge conflicts + an accidental push this engagement.
- access-relay tests hardcode an absent sql.js wasm path → excluded from CI until the path is made env-overridable.
