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

5. **1.50.524 — LANGUAGES-CARD-PERSONAL-001** `[auto-deploys]`. Settings → Personal
   lost its order-based flex-column wrapper, so the LanguageCard island couldn't anchor
   (`findSettingsFlexColumn`) and fell below "Done" with its spelling/tense controls.
   The section `order` values were still authored (Background 10, CV Sidebar 15,
   Languages 20, Experience-Tense 22, Advanced Tone 30, Banned Words 40, Personality 45)
   but inert under block layout. Fix: the Personal subtab container (app.src.js `yl` +
   app.js mirror) is now `display:flex; flex-direction:column` — that single change
   ACTIVATES the whole pre-authored order layout; the island mounts at order 20 and the
   tense/spell sidecars re-anchor on it. Unblocks the Personal half of EXP-TENSE.
   Verified: `diag-languages-card-personal.mjs` (5 checks).

6. **1.50.525 — VISUAL-PKG-001 + MERGE-DUP-003** `[auto-deploys]`. VISUAL-PKG-001:
   native Layout heading "STYLE PACKAGE" → "Visual package" (app.src.js + app.js mirror)
   AND PackagePicker `STYLE_PACKAGE_RE` widened to `/^(STYLE PACKAGE|Visual package)$/i`
   (same release, so the card never orphans). MERGE-DUP-003: WritingStylePicker copy
   "Saved tones"→"Saved customs" (storage/load/save unchanged). Islands rebuilt via vite
   (reproducible; also corrected a STALE committed bundle missing the band/`#33446F` +
   head/`#00746E` palette tokens). Verified: `diag-visual-pkg-relabel.mjs` (heading
   reads "Visual package", no "STYLE PACKAGE" left, PackagePicker still anchors).

7b. **1.50.526 — RESULTS-PREVIEW-LAMINATION-PARITY-001** `[auto-deploys]` (owner
   2026-06-17: "results are seen in all roles in export — preview only in part and
   with weird content"). The export laminates each role from its OWN data (role.results
   → role.outcomes[] → proofPointIds vs personalInfo.proofPointsByRole) and only
   token-spreads SELECTED OUTCOMES for leftover roles; the PREVIEW skipped tiers 1-3 and
   went straight to the token spread — so it showed Results on only some roles, with
   mismatched content. Fix: added the export's tiers 1-3 to the preview IIFE as `__lam`,
   threaded into the existing editable render via guarded short-circuits; unlaminated
   roles still fall through to the unchanged spread (no regression). app.js mirrored.
   Verified: `diag-results-preview-lamination.mjs` (tiers 1/2/3 each render per role).

7. **LANG-EXPAND-003 (plan, owner 2026-06-17)** `[docs]`. Added §10 to
   `docs/plan/LANG-EXPAND-001.md`: Polish (pl, Tier 1), Guaraní (gn, Tier 1 +
   native-review, thin dictionary → proofing-disabled-with-notice), and Spanish variants
   es-ES (España) + es-MX (México) as variants of `es` (en-GB↔en-US pattern). German (de)
   + Russian (ru) confirmed already covered by §9. Post-003: 26 base + 3 variants; §2
   BCP-47 gate + 6.6 selector/dictionary rule still apply.

## Backlog dig (after owner "look in older bugs and features")

Swept the full reconciled old-open backlog (`AntCV_old_open_reconciled_2026-06-16.md`,
102 IDs) + `FEATURES_REGISTRY.md`. The Settings-route + preview headless harnesses built
this session unlocked items previously marked "owner-present":

- **8. MERGE-DUP-001** `[SHIPPED 1.50.527]` — probed the live Personal subtab (3 selects:
  legacy writing-style dup, custom-slots, island), then the WritingStylePicker island
  hides ONLY the legacy writing-style `<select>` (scoped to the element, never its
  container — the two legacy buttons stay). Verified `diag-merge-dup-writing-style.mjs`
  (4/4): legacy select display:none+tagged, island + custom-slots untouched.
- **SECTION-LAYOUT-GRAPHIC-001 (#17)** — implemented a per-row format-shape thumbnail
  (`FormatPreview`) but **REVERTED, not shipped**: the SectionFormatPicker only renders
  inside the Advanced → Style "ADVANCED VISUAL STYLES" React-state collapsible, which I
  could not drive open headlessly, so I could not verify the thumbnail actually shows.
  Sound + additive (builds, tsc-clean) but unverifiable here — needs an owner look or a
  harness that opens that collapsible. The `results`-option half (#18) is deferred
  separately: it changes the GLOBAL `outcomesMode` semantics from a per-section control
  (design intent needed).
- **Rest of the 102 confirmed honestly out-of-scope for unattended work:** most features
  are stale-CLOSED (registry not pruned); list-row controls (9, 7 prior failed
  iterations), mobile (7), pagination remainder, candidate/application (6), preview-shell
  (mostly shipped) are owner-present/probe-first; LOCATION-001 touches the persisted
  personalInfo shape (data-risk). VISUAL-PKG-002/003 already shipped (decorateNativePackageButtons).

## RESULTS preview/export — single source of truth (owner-present, 2026-06-17)

After 1.50.526 (tiers 1-3 mirror) the owner still saw the preview Results wrong vs export
("all of the above"). Root cause: TWO copies of the distribution — the export's
`applyOutcomesMode` had the improvements (explicit outcome→role map, drop-unmatched,
numeric-favour, derive-from-bullet) but the preview kept the OLD token-spread that spilled
the (owner-confirmed STALE) SELECTED OUTCOMES onto roles. **Fix 1.50.529
(RESULTS-PREVIEW-EXPORT-SINGLE-SOURCE-001):** expose the export's `applyOutcomesMode` on
`window.AntcvApplyOutcomesMode`; the preview runs that exact function on a deep copy of its
sections and renders each role's `role.results` (memoised per render pass). When present it
is authoritative (a role with no export result shows none in preview). Verified
byte-identical preview-vs-export per role across tier-1/tier-3/token-spread/derive
(`diag-results-preview-export-parity.mjs`). **OWNER: hard-refresh to 1.50.529 and confirm
the preview Results now match the export.** Separate latent note (owner observation): the
SELECTED OUTCOMES *panel* can show stale outcomes after a regen — a panel-refresh concern,
independent of the results render; flag if it persists.

## Mobile session (owner-present, 2026-06-17) — emulated iPhone 13 + owner on-device

Drove an iPhone-13 viewport (390px) headlessly; owner confirmed on their real device.
- **5 items CONFIRMED CLOSED on-device** (owner: "all good — close them"):
  MOB-TOPBAR-001 (Ant icon + stray table control hidden), MOB-TOPBAR-002 (privacy pill
  visible, single-row topbar), MOB-ALT-001 (palette → one tap-to-open dot), MOB-BOTTOMNAV-001
  (bottom nav fits), MOBILE-TABLEWIDTH-001 (table-width sliders hidden < 900px).
- **MOBILE-FUSE-001 — verified resolved, not open:** the 🔀 FAB is hidden on mobile
  (correct, redundant) but the "Fuse" button IS live in the bottom nav
  (`antcv-bottom-fusion-343.js`) — `¶ Section · 🎯 Analysis · 👁 Preview · −/47%/+ · CV/CL · Fuse`.
- **MOBILE-EXTRACTION-001 → MOBILE-ASKAI-EXPORT-OVERLAP-001 [SHIPPED 1.50.528]:** the
  button overlapping the DOCX export turned out to be the **"🤖 Ask AI" doc-chatbot
  launcher** (not the kernel/extraction button). It defaulted to `bottom:96px` (above the
  Fuse toolbar) but still covered the DOCX export row; raised the default to `bottom:150px`
  (draggable saved position still wins). Verified the launcher moved y 531→477 at 390px.
  **OWNER ON-DEVICE: CONFIRMED** "ask ai is above now and is good." Mobile cluster (7) CLOSED.

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
- **DISCLOSURE-TRIANGLE-CONSISTENCY-001** — the other Advanced collapsibles are native
  `<details>/<summary>`; a consistent ▸/▾ needs carefully-scoped global CSS (risk of
  hitting other `<details>` like the wizard showcase) for cosmetic value. Quick
  owner-present tweak.
- **MERGE-DUP-001** (hide legacy writing-style `<select>`) — needs a live select-node
  probe before shipping the selector (overshoot risk). Owner-present.
- **Lane 5.1/5.2 kernel-button dedup + superset ingest** — `antcv-kernel-import.js`
  injects via a documentElement-wide observer + a BROAD text-match anchor. The existing
  `diag-kernel-import.mjs` already asserts no-duplicates for the basic case, so the
  owner's duplication (#1/#3) is in specific wizard/Personal DOM scenarios the diag
  doesn't reproduce. Dropping the text-match / scoping blind risks the button
  DISAPPEARING from a step where it's needed. Probe-first, owner-present (5.2 also has a
  STOP condition in its authorisation).
- **Lane 5.3 (quiz→6C) / 5.5 (showcase collapsible+mount)** — app.js/island changes
  whose verification needs the live multi-step wizard / mobile sidecar modal rendered.
  Queued for a focused wizard pass.
- **Lane 2 relay** — the "stranded" fixes (1.50.220–223) are long superseded; the PWA
  auto-deployed past them and access-relay is current (per ACTIVE_BUGS session
  registry). No pending relay deploy identified.

## Owner punch-list (eyeball / regen)

1. AI-notice PDF: CV 1/2/3-page + CL 1/2-page — notice once, last-page bottom corner,
   not over text, survives CloudConvert (the only WM risk).
2. CL-WIDTH-CAP: fresh CL PDF — WHAT-I-BRING table fills the wider body.
3. The 1.50.522 inline-label fix shows "Who I am:" / "Why …:" labels in the PREVIEW for
   IMPORTED data (was export-only).

State after run: PWA **1.50.529**, docx-worker **1.14.76**, suite **312/312**, 19 docx
diags green, mirror-guard green, tsc clean. Islands bundle rebuilt + un-staled.

Owner punch-list (additions): (4) Settings → Personal — the Languages card is back in
place (order 20, between CV Sidebar and the tense control) with its spelling/tense
controls; (5) Settings → Layout — the package heading now reads "Visual package" and
the "Saved customs" wording; confirm both read right and the package picker still works.
