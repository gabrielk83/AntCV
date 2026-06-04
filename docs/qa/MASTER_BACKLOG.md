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

**Next-action tags:** `[console]` needs a live browser/probe; `[code]` safe to do from source now; `[islands]` needs a Vite rebuild of `antcv-react-islands.js`; `[worker]` Cloudflare worker change; `[owner]` needs an owner decision; `[verify]` just confirm on live.

---

# PART 1 — ACTIVE BUGS

## 1. Global requirements / Definition of Done (§3)

| ID | Requirement | Status | Next action |
|----|-------------|--------|-------------|
| GEN-001 | Preview / DOCX / PDF parity | PARTIAL | `[verify]` Enforced per-item; no standalone task — gate each fix against it. |
| GEN-002 | Control locality | PARTIAL | `[console]` Audit any control that acts on the wrong item; covered per-area below. |
| GEN-003 | Standard control order | PARTIAL | `[code]` Extend the 1.50.120 reorder to Publications + Core/WIB rows (after PP-003 risk check). |
| GEN-004 | No "Compress"; say "Fit" | PARTIAL | `[code]` Grep all sidecars for user-facing "Compress" titles/labels; rename at source. |
| GEN-005 | Edit persistence | PARTIAL | `[console]` Spot-check edits survive blur/reopen/export per area. |
| GEN-006 | Controls visible (not clipped) | PARTIAL | `[console]` Roll up under PRV/PP/mobile items below. |
| GEN-007 | Drag-and-drop parity | OPEN | `[console]` Tackle with CA-004 (insertion-point dnd). |
| GEN-008 | Accessible tooltips/labels | PARTIAL | `[code]` Sweep button `title`/`aria-label` for "action + target" naming. |
| GEN-009 | Preview utility responsive parity | OPEN | `[console]` Pair with PRV-001..003 + RESPONSIVE-001. |
| GEN-010 | Validation severity clarity | VERIFYING | `[console]` Confirm VAL-001 consumer renders yellow/red on live. |
| GEN-011 | Generation captures table content | OPEN | `[worker]` Same work as CL-006 / GEN-002b. |

## 2. Cover Letter (CL)

| ID | Item | Status | Next action |
|----|------|--------|-------------|
| CL-001 / VF-001 | Remove duplicated Preview action-button overlay | OPEN | `[console]` Capture the two 4-button groups' DOM; remove the duplicate emitter. |
| CL-002 | Closure directly editable + persist | OPEN | `[console]` Find Closure node; wrap editable + write-back store. |
| CL-003 / VF-002 | Model HIWC as Intro + per-bullet rows + Closing | PARTIAL | `[code]` Finish per-bullet row model in `how-contribute-controls-245`; closing stays paragraph. |
| CL-004 / VF-003 | One control group per Foundation textbox | OPEN | `[console]` Identify Foundation textboxes; attach a group to each. |
| CL-005 / VF-006 | Normalize CL body controls + section-move | PARTIAL | `[console]` Verify `cl-body-move-button-341` ☰ Move fires on live; add ▶ first button. |
| CL-006 / VF-017 | Capture table data in CL generation | OPEN | `[worker]` Feed WIB/table signals into CL generation prompt+payload. |
| CL-007 | HIWC bullets flicker on CL | VERIFYING | `[console]` Confirm no oscillation on 1.50.57+; if persists, find 2nd repaint writer. |
| CL-HEADER-001 | Application header not editable + wrong font/colour | PROBE-GATED | `[console]` Run `antcv-cl-header-probe.js`; fix `wrapApplicationSentence` attach on CL. |
| CL-LAYOUT-002 | Constrain Application line to page width | OPEN | `[console]` Confirm overflow in export (not just preview), then wrap/clamp with parity. |

## 3. Page Break (PB) + export-preview

| ID | Item | Status | Next action |
|----|------|--------|-------------|
| PB-001 | Manual break from main + sidebar → all outputs | PARTIAL | `[console]` Confirm whether break shows in preview vs only fails in export; close main-area path. |
| PB-002 | First sub-subsection moves whole subsection, no dup | OPEN | `[console]` Repro on a sub-subsection; implement move-with-heading in page model. |
| PB-003 | Continuation heading + "Cont." 18pt from top | OPEN | `[code]` Extend continuation-header render in `284`/`329` to all sections. |
| PB-004 / TB-002 | Table: first row moves table; later row splits + repeats headers | OPEN | `[owner]` Scope per-doc-keyed row break reaching DOCX worker (TABLE-PAGEBREAK parked). |
| PB-005 | Semantic page glyph + "Fit" wording | VERIFYING | `[verify]` Confirm no down-arrow / "Compress" on live; report any control the matcher misses. |
| PB-006 / VF-018 | Preserve Professional Experience CONT pattern | OPEN | `[verify]` Reference behaviour — confirm it stays intact as PB work lands. |
| EXPORT-PAGE2-001 | Export preview shows only page 1 | PROBE-GATED | `[console]` Run `antcv-export-page2-probe.js`; fix the `pdf-preview-gate` clone path. |
| PDF-LAYOUT-001 | Stray Selected Outcomes heading on PDF page 2 | OPEN | `[console]` Reproduce in PDF; suppress orphan heading before Experience CONT. |
| PAGEBREAK-002 | Break on entry + natural A4 overflow | OPEN | `[code]` Add A4-overflow measurement to `284` to auto-insert markers. |
| PAGEBREAK-005 | Cascade colour across all CV sections + CL | OPEN | `[console]` Get CL button selectors live; extend cascade in `page-button-polish-327`. |

## 4. Watermark (WM)

| ID | Item | Sev | Status | Next action |
|----|------|-----|--------|-------------|
| WM-001 / VF-004 | Anchor watermark to last-page corner (page-level) | — | OPEN | `[console]` Re-anchor to page box, not text flow; verify PDF+DOCX. |
| WM-002 | Avoid collision; lower corner by clearance | — | OPEN | `[console]` Add corner clearance; do with WM-001. |
| WM-003 | Text-only, no border/fill/shadow | Med | OPEN | `[code]` Strip border/fill/shadow from watermark style. |
| WM-004 | CL watermark page-anchored | High | OPEN | `[console]` Same fix as WM-001 applied to CL. |
| WM-005 | PDF watermark last page only | High | OPEN | `[console]` Restrict PDF watermark to final page. |

## 5. Candidate / Application / movement (CA)

| ID | Item | Status | Next action |
|----|------|--------|-------------|
| CA-001 / VF-005 | Candidate Preview editing (spec line editable) | PARTIAL | `[console]` Wrap the React-rendered `[Specialisation — …]` line as editable (SPECIALISATION-EDIT-001). |
| CA-002 | Application sentence sync (no dup label) | OPEN | `[console]` Resolve with CL-HEADER-001 probe + fix. |
| CA-003 / VF-006 | Section-move on all movable rows | OPEN | `[console]` Add move button left of control group on CL body / CV sidebar / CV main. |
| CA-004 / VF-007 | Precise insertion-point drag-and-drop | OPEN | `[console]` Capture drop logic; land at indicator, not end. |
| CA-005 | Preserve destination styling + Restore | OPEN | `[console]` After-move style/contrast + Restore action. |
| APP-SENTENCE-STYLE-001 | Sentence doesn't follow package style | OPEN | `[code]` Fix style copy in `candidate-preview-editor-341:334–350` fallback. |
| NAME-ALIGN-001 | Name left vs CJLR "center" | FIXED✓ | `[verify]` Confirm Name follows CJLR on live. |

## 6. Tables / Selected Outcomes / Publications

| ID | Item | Status | Next action |
|----|------|--------|-------------|
| TB-001 | Per-line CJLR on Core Competencies | OPEN | `[console]` Add per-line CJLR (fragile table zone — verify live). |
| TB-003 / VF-008 | Fix "What I Bring" help text | VERIFYING | `[verify]` Confirm no "Compress"/down-arrow in WIB help on live. |
| SO-001 / VF-009 | Selected Outcome row controls + order | PARTIAL | `[console]` Order fixed 1.50.120; verify each control acts + Page-Break behaviour. |
| SO-002 | New outcome rows identical | OPEN | `[console]` Confirm added rows get the same control set. |
| PP-001 / VF-010 | Expose hidden Publications controls | PARTIAL | `[console]` 273 grid→flex; eye-leftmost, ✕-adjacent, ▲▼ visible (needs prod/relay DOM). |
| PP-002 | Single input acts on whole entry | OPEN | `[console]` Make one input drive the whole publication entry. |
| PP-003 | HIGH-RISK shared row-control model | PARTIAL | `[console]` Confirm `pub-injected-reaper-352` removes stale buttons; no blind edits. |
| PUB-ROW-MULTIROW-001 | Controls attach only to pub row 1 | OPEN | `[console]` Re-check after loop fix; debug per-row `wire()` if persists. |
| MERGED-MOVE-CONTROL-001 | Compact stacked move control everywhere + drag | OPEN | `[code]` Replace big up/down with compact stacked control across list sub-subsections. |
| CL-BODY-CONTROLS-001 | CL Body missing ▶; ☰ Move Greeting broken | OPEN | `[console]` Fix move handler wiring in `cl-body-move-button-341`; add ▶. |

## 7. Preview shell / routing / validation (PRV / AH / VAL)

| ID | Item | Sev | Status | Next action |
|----|------|-----|--------|-------------|
| PRV-001 / VF-011 | Restore 3 desktop lower-right utility buttons | — | OPEN | `[console]` Identify missing buttons on desktop; restore placement. |
| PRV-002 / VF-012 | Restore Privacy + Fuse desktop placement | — | OPEN | `[console]` Restore both circular buttons right side, no dups. |
| PRV-003 / VF-013 | PDF+DOCX buttons persistent, route-independent | — | OPEN | `[console]` Make export buttons render regardless of route. |
| PRV-004 / VF-015 | Loading status not click-dismissable | — | OPEN | `[code]` Block dismiss while a job is running. |
| PRV-005 | Circular buttons viewport-specific | Med | VERIFYING | `[verify]` Confirm `mobile-fab-cleanup-351` placement on mobile+desktop. |
| AH-001 / APPHIST-ZIDX-001 | "Open in Settings" opens BEHIND preview | — | PROBE-GATED | `[console]` **Owner: still broken.** Run `antcv-apphist-zindex-probe.js`, then targeted z-fix. |
| VAL-001 / VF-016 | Errors red, warnings yellow | — | VERIFYING | `[verify]` Confirm severity colours on live Set-menu. |

## 8. Onboarding / import / language / wizard

| ID | Item | Sev | Status | Next action |
|----|------|-----|--------|-------------|
| IMPORT-001 | Import reports 0 work entries | High | PARTIAL | `[console]` Verify in-app import live; adopt `lib/import-normalize.js` inside sidecars. |
| IMPORT-COUNT-001 | Upload extract count wrong | — | OPEN | `[console]` Fix importer→personalInfo mapping in app.js (root, not recount). |
| LANG-001 | Settings vs top-bar language mismatch | Med | OPEN | `[console]` Make wizard source of truth; fallback EN+DA. |
| ONBOARD-001 | Step 3B not scrollable on mobile | High | OPEN | `[console]` Identify the step-3B list element; add dvh-safe scroll + reachable Next. |
| WIZARD-001 | Step 6b not scrollable | — | OPEN | `[console]` Add max-height/overflow to the wizard card (needs stable selector). |

## 9. Generation content + generation UI (§14.2)

| ID | Item | Sev | Status | Next action |
|----|------|-----|--------|-------------|
| GEN-001b | Kernel leaves CV sections empty/underfilled | High | OPEN | `[worker]` Add unsolicited fallback + warnings to kernel generation. |
| GEN-002b / VF-017 | CL drops WIB table signals + Why-This-Position bullets | High | OPEN | `[worker]` Capture table signals in CL generation. |
| GEN-UI-001 | Redundant Enhance/Fit under Cancel | Med | OPEN | `[code]` Suppress row controls in the generation/cancel view. |
| GEN-UI-002 | Time estimate too optimistic | Med | OPEN | `[console]` Default estimate to ~4 min; delay almost-done messaging. |
| GEN-UI-003 | Endless Fit controls under Cancel & return | High | OPEN | `[code]` Hard render guard when generation view active. |

## 10. Layout / export / responsive

| ID | Item | Sev | Status | Next action |
|----|------|-----|--------|-------------|
| LAYOUT-001 | Sidebar background doesn't reach page bottom | High | OPEN | `[console]` Extend sidebar fill to page box in Preview/PDF/DOCX. |
| EXPORT-001 | No download-start indicator | Med | OPEN | `[code]` Show a start indicator on PDF/DOCX export click. |
| EXPORT-002 | PDF export fails; needs recovery | Critical | OPEN | `[console]` Reproduce failure; add visible retry without corrupting doc. |
| RESPONSIVE-001 | Mobile loads desktop split-pane | High | OPEN | `[console]` Route mobile Preview to bottom-mode layout. |
| DOCX-EXPORT-REGRESSION-001 | Print-setup export doesn't fire DOCX | High | PARTIAL | `[console]` Verify 1.50.90 gate path on live; re-wire print-setup handler in app.js. |

## 11. Profile photo (PHOTO) — largely shipped, export verify owed

| ID | Item | Sev | Status | Next action |
|----|------|-----|--------|-------------|
| PHOTO-001 | Pentagon shape parity | High | SHIPPED | `[verify]` Export pentagon from a rendered preview; DOCX geometry matches. |
| PHOTO-002 | Shape round-trip fix | High | SHIPPED | `[verify]` Export each shape; DOCX not forced to circle. |
| PHOTO-003 | Pentagon contour all five edges | Med | PARTIAL | `[verify]` Confirm 5-edge stroke in the downloaded Word DOCX. |
| PHOTO-004 | Shape persists + restores | Med | SHIPPED | `[verify]` Reload + fresh export keeps the shape. |
| PHOTO-005 | Pentagon swatch glyph | Low | SHIPPED | `[verify]` Picker swatch shows pentagon. |
| PHOTO-PLACEMENT-001 | Non-sidebar placements are no-ops | — | OPEN | `[console]` Implement header/main/bridge placements in app.js render. |

## 12. Performance / re-render loop

| ID | Item | Sev | Status | Next action |
|----|------|-----|--------|-------------|
| HIWC-RERENDER-LOOP-001 | Coupled-oscillator re-render storm | High | PARTIAL | `[console]` Re-run rAF + mutation-source probes; gate the residual emitter at source. |
| RERENDER-STORM-001 | rAF violation flood | High | OPEN | `[console]` Run mutation-source probe to name the pump (HIGH value). |
| PERF-001 | Long export/preview handlers (4-11s) | Med | OPEN | `[console]` Profile one export click; defer iframe build off the click thread. |

## 13. Settings panel / visual package (mostly APP.JS / React islands)

| ID | Item | Status | Next action |
|----|------|--------|-------------|
| VISUAL-PKG-001 | Rename "STYLE PACKAGE" → "Visual package" | OPEN | `[code]` Relabel app.js text node; fold into MERGE-DUP pass. |
| VISUAL-PKG-002 | Package buttons show icons + enabled fn | OPEN | `[islands]` Enrich PackagePicker buttons. |
| VISUAL-PKG-003 | Move descriptor next to Alt circles | PARTIAL | `[islands]` Relocate "Segoe UI · circle · 120px" descriptor. |
| MERGE-DUP-001 | Merge two Writing-style selects | OPEN | `[owner]` Decide which engine wins; then live probe + bridge. |
| MERGE-DUP-002 | Merge tone-chip sections; split run-on chip | PARTIAL | `[console]` Confirm `dedup-341` split on live; merge the sections. |
| MERGE-DUP-003 | Merge "save tones" into "save customs" | OPEN | `[islands]` Unify on `saveCurrentAsSlot`/`loadSlot`. |
| SETTINGS-HEAD-001 | Unify headlines to "▸" style; Languages placement | PARTIAL | `[verify]` Confirm 1.50.95 placement; collapsible headline style owed. |
| SECTION-LAYOUT-001 | Section layout collapsible/collapsed; refresh on style change | PARTIAL | `[islands]` Add collapse + refresh-on-style-change to LayoutPicker. |
| LOCATION-001 | Replace combined Location with Location + City | OPEN | `[console]` app.js: split fields, load/write user data, relabel city. |
| DEMO-WARN-001 | Hide "⚠ Setup needed" when demo valid | OPEN | `[console]` Gate badge on a demo-valid signal. |
| PRIVACY-SETTINGS-001 | Hide Privacy FAB in Settings | VERIFYING | `[verify]` Confirm FAB hidden in Settings on live. |
| PRIVACY-FAB-FLICKER-001 | Privacy pill background bleeps | FIXED✓ | `[verify]` Confirm no bleep on live. |

## 14. Mobile / top-bar (this engagement — VERIFYING)

| ID | Item | Status | Next action |
|----|------|--------|-------------|
| MOB-TOPBAR-001 | Hide Ant icon + table control on mobile | VERIFYING | `[verify]` Confirm hidden on mobile. |
| MOB-TOPBAR-002 | Privacy pill clipped; single-row topbar | VERIFYING | `[verify]` Confirm pill visible, filename cropped. |
| MOB-ALT-001/002 | Alt-circles dropdown, opens down, escapes clip | VERIFYING | `[verify]` Confirm dropdown opens downward unclipped. |
| MOB-BOTTOMNAV-001 | Bottom-nav buttons clipped | VERIFYING | `[verify]` Confirm all controls visible on narrow viewport. |
| HIWC-EDIT-001/002/003 | HIWC editable on mobile; strip own row; wrap | FIXED✓ | — Done (owner-confirmed). |
| MOBILE-FUSE-001 | Fuse not visible in mobile bottom panel | OPEN | `[console]` Surface 🔀 in mobile bottom panel. |
| MOBILE-TABLEWIDTH-001 | Table-width controls partly visible on mobile | OPEN | `[code]` Hide table-width controls entirely on mobile. |
| MOBILE-EXTRACTION-001 | Extraction button hovers in grey area | OPEN | `[console]` Re-anchor the document-Extraction button on mobile. |
| LABEL-HISTORY-001 | Rename "Application history" → "History" | FIXED✓ | `[verify]` Confirm top-bar label. |

---

# PART 2 — PLANNED FEATURES (net-new, beyond bug-fixing)

| ID | Feature | Layers | Status | Next action |
|----|---------|--------|--------|-------------|
| **FEATURE-CONF-001** | Per-sentence confidence overlay in Application tab (toggle default OFF; red=low/yellow=med; hover=issue+score; preview-only). | WORKER + APP.JS + UI | DESIGNED | `[owner]` Confirm it becomes a Writing-System "Verification/confidence" section + the data contract. Then: `[worker/code]` extend `jd-analysis.js` schema+`normalize()` for `document_confidence` (+ unit test) and `[code]` build renderer+toggle; `[console]` wire app.js persistence + verify model scores. |
| **DATA-EXPORT-001** | Personal menu: download stored data + analytics to a protected file. | APP.JS | REGISTERED | `[owner]` Confirm whether encryption is required (vs plain JSON). Then `[console]` serialize personalInfo/writingPrefs/analytics keys to a download. |
| **DELETE-SAVE-001** | Erase flow: "Save my data locally first" checkbox → triggers DATA-EXPORT-001 before erase. | APP.JS | REGISTERED | `[console]` Add checkbox to the red confirm card; share the export serializer. |
| **WIZARD-002** | New wizard Step 6d: default-languages + inform about Personal/Layout/Advanced panels. | APP.JS | REGISTERED | `[console]` Author the new step in the app.js wizard. |
| **PHOTO-PLACEMENT-001** | Implement non-sidebar photo placements (header/main/bridge) in preview render. | APP.JS | REGISTERED | `[console]` Implement the non-sidebar placements in app.js render path. |

---

# PART 3 — Shipped this engagement (context; live acceptance owed except FIXED✓)

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
