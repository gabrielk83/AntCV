# AntCV nightly run — 2026-06-17 (autonomous)

Started from `docs/plan/NIGHTLY_RUN_SHEET_2026-06-16.md` (Lane 0 → 1 → 4 order).
Baseline 308/308 suite + 19 docx diags green; PWA 1.50.521 + docx-worker 1.14.74.
Synced local to origin/main first (was behind; concurrent session pushed Lanes 6/6.6
plan docs). Discipline held: spec-first, headless gate before deploy, cache-bust trio,
one worker deployer, push to main only.

## Shipped + verified this session

1. **docx-worker 1.14.75 — AI-WATERMARK-EXPORT-LOCATION-001 (WM-001/002/004/005)**
   `[DEPLOYED + health-verified]`. The AI notice was a FLOWED paragraph (floated
   mid-page when content was short; on a 2-page CV could ride a column that ends on
   page 1 = WM-005). Per `WM_AI_NOTICE_ANCHOR_SPEC_2026-06-16.md`:
   `buildAiDisclosureHangingTextbox` now emits a SENTINEL anchor paragraph (corner
   encoded) placed at the END of the last page's content (CV: final page table's main
   cell; CL: last section child / page-2 block); `postProcessDocx` swaps that run for a
   bottom-corner-anchored VML text frame (`v:rect`+textbox, no fill/stroke = WM-003,
   `mso-position-vertical:bottom` rel:margin, horizontal corner from `ctx.aiWmSide`).
   Same raw-VML layer the DEMO mark proves survives CloudConvert. Removed the flowed
   notice from both CV columns + both CL branches (1-page signature-line tab-stop
   disclosure dropped). Headless: `test/diag-ai-notice-anchor.mjs` (13 checks) — no
   flowed `AI-assisted` run, exactly one `AntCVAiNotice` shape, after the last page
   break, sentinel consumed, bottom+corner anchoring.
   **OWNER EYEBALL:** DOCX→PDF survivability of the bottom-anchored VML frame through
   CloudConvert/LibreOffice (spec §7 risk) — verify on a real PDF, CV (1/2/3-page) + CL.

2. **1.50.522 — SECTION-TYPE-NORMALIZE-INLINE-001** `[auto-deploys on push]`.
   `inlineifyWorkStyle` → `inlineifyLabeledText` in `antcv-sections-normalize-415.js`:
   now also promotes `who_i_am` + `why_company`/`why_role`/`why_position` (by id or
   title) from type `text` → `text_inline` on import, so the bold inline label renders
   in the PREVIEW (it already did in export). Explicitly skips CL boilerplate
   (greeting/opening/closure/closing). Verified in the real app past the sign-in gate:
   `diag-sections-normalize.mjs` asserts work_style + who_i_am become text_inline,
   greeting stays text.

3. **1.50.523 + docx-worker 1.14.76 — CL-WIDTH-CAP-001** `[DEPLOYED + health-verified]`.
   Widened the WHAT-I-BRING table: preview `wrapStyle` 72%/maxWidth:540 → 88%/720
   (app.src.js ~5081 + app.js mirror, byte-safe node replace), export `defaultClW`
   (PAGE_W-400)*0.8 → *0.9. Folds CL-PREVIEW-TABLE-WIDTH-001; a forwarded
   `s.tableWidth`/`tableRatio` still wins. `diag-cl-margins` now 5/5 (default content
   table = 10355 DXA = 0.9 of usable; margins/full-bleed band unchanged).
   **OWNER EYEBALL:** confirm the wider table fills the body in a fresh PDF.

4. **Lane 4 — app.src.js↔app.js mirror-guard CI** `[test-only]`.
   `pwa/test/unit/appjs-mirror-guard.test.mjs`: curated string-literal anchors must
   appear in BOTH files (terser preserves string contents) + structural invariants
   (head `(()=>{`, zero `"use strict"` = APPJS-BLUESCREEN-001 guard). 312/312 suite.

## Findings — stale-open / not-a-bug (recommend closing in ACTIVE_BUGS)

- **RESULTS-PDF-INK-BLACK-001** — ALREADY SHIPPED in docx-worker 1.14.73 (commit
  f3050ae); the per-role "Results:" label already uses `style.mainHeadColor` (teal).
  The A0-NIGHTLY "NEW OPEN" entry is stale. CLOSE.
- **RESULTS-DOCX-MISSING-001 (worker half)** — the worker already emits every
  `role.results` run (`diag-role-results-export` 5/5; renderExperience ~26322). The
  "not all positions" symptom is data-side (RESULTS-TIGHTENING-STRIP-001), regen-gated,
  NOT a worker render-branch bug. The worker half is not actionable.

## Deferred (with reasons) — not autonomous-closeable

- **INTERESTS-CONTENT-001 + ADDITIONAL-INFO-SPLIT/HIDE-001 (item 8)** — greenfield
  splitter; the INTERESTS content is the owner's data (`interests_items`, must not
  fabricate) and the gate needs his live data. Owner-present / needs a data fixture.
- **CL-006 (capture table data in CL generation)** — proxy prompt/schema; the effect
  is only judgeable on an owner REGEN (prompt-side, not headless-closeable).
- **DISCLOSURE-TRIANGLE-CONSISTENCY-001** — lives in app.src.js (not a sidecar);
  multi-site minified-mirror change + live-Settings-DOM verification for cosmetic
  value. Best done in an owner-present Settings pass alongside LANGUAGES-CARD.
- **Lane 0.B LANGUAGES-CARD-PERSONAL-001 / VISUAL-PKG-001 / MERGE-DUP / Lane 5 wizard**
  — app.src.js `yl` wrap + island rebuilds + wizard-DOM anchoring; longer-cycle work
  needing live Playwright verification of Settings/wizard mounts. Queued for a focused
  Settings/islands pass.
- **Lane 2 relay** — the "stranded" fixes (1.50.220–223) are long superseded; the PWA
  auto-deployed past them and access-relay is current (per ACTIVE_BUGS session
  registry). No pending relay deploy identified.

## Owner punch-list (eyeball / regen)

1. AI-notice PDF: CV 1/2/3-page + CL 1/2-page — notice once, last-page bottom corner,
   not over text, survives CloudConvert (the only WM risk).
2. CL-WIDTH-CAP: fresh CL PDF — WHAT-I-BRING table fills the wider body.
3. The 1.50.522 inline-label fix shows "Who I am:" / "Why …:" labels in the PREVIEW for
   IMPORTED data (was export-only).

State after run: PWA **1.50.523**, docx-worker **1.14.76**, suite **312/312**, 19 docx
diags green, mirror-guard green.
