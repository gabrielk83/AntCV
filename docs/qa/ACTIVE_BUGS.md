# AntCV — Active Bug Tracker

Living list of open issues. Newest section at top. Mark items `[FIXED]`, `[VERIFYING]`, or `[OPEN]`.
This file now folds in the canonical `AntCV_UI_UX_Spec_and_QA_Plan_v4.docx` backlog (see "QA SPEC BACKLOG" below) so there is a single working list. The .docx remains the source of full prose detail; a machine-retrievable ID index lives alongside this file at `docs/qa/AntCV_QA_backlog_index_v4.md`.

---

## 2026-06-04 (batch) — owner feature + bug dump triaged

Full triage with per-item IDs, layer, and sidecar-vs-app.js verdict lives in
`docs/plan/Batch_2026-06-04_feature-and-bug-triage.md`. Summary:

- **Landed (sidecar):** `JD-TEXTAREA-001` (JD textarea halved + host panels
  scrollable, incl. mobile); `PRIVACY-FAB-FLICKER-001` (top-bar pill background
  bleep — see below).
- **New feature, NOT in locked docs:** `FEATURE-CONF-001` — per-sentence
  confidence overlay (Application-tab toggle, default off; red=low/yellow=medium;
  hover shows issue). Locked docs use "confidence" only in the tone sense. Needs
  a WORKER self-check pass + app.js toggle/store + preview renderer. Spec'd in the
  triage doc; raise as a new Writing-System "verification/confidence" section.
- **Priority regression:** `DOCX-EXPORT-REGRESSION-001` — DOCX export was wired to
  the preview-panel button only; export now runs from the print-setup view, which
  doesn't call `exportDocxViaWorker`. Needs branch-archaeology (find the prior
  fix) + re-wire the print-setup export handler in app.js.
- **Registered (app.js / React / worker):** `PAGEBREAK-001..005` (export-preview
  marker, on-entry + A4-overflow detection, continuation header, cascade colour
  across all sections + CL), `VISUAL-PKG-001..003`, `MERGE-DUP-001..003`,
  `SETTINGS-HEAD-001`, `SECTION-LAYOUT-001`, `LOCATION-001`, `DEMO-WARN-001`,
  `PRIVACY-SETTINGS-001`, `WIZARD-001..002`, `IMPORT-COUNT-001`,
  `PHOTO-PLACEMENT-001` (only sidebar photo positions render in the preview;
  header/main/bridge placements are no-ops — app.js render gap, format-prefs
  sidecar only stores the pref).

---

## 2026-06-04 (later) — section-layout help text trimmed + CL-HEADER-001 DOM captured

### Fixed — LAYOUT help-text overflow
- Owner: the Per-section-overrides help paragraph is too long. Replaced the §4.4 wall of text in `src/islands/LayoutPicker/LayoutPicker.tsx` with "Per-section overrides — pick a layout and set a length hint, or reset (↺) to use the style default." Rebuilt `pwa/antcv-react-islands.js` (Vite); bundle `?v=` → 1.50.70, `sw.js` → `antcv-1.50.70`, `version-override` TARGET → 1.50.70 (1.50.69 added to STALE).

### PRIVACY-FAB-FLICKER-001 — FIXED (the "bleeping" background)
- Owner (high priority): the privacy 🛡 pill in the top bar pulses ("bleeps") its background.
- **Diagnosis:** `worst` (the privacy level) is read from a stable localStorage key, so it does not legitimately flap. The only periodic actor is `antcv-privacy-led.js`'s **2 s `setInterval` → `refreshFabAppearance`**, which every tick rewrote `textContent`, detached/re-appended the `.antcv-privacy-dot`, and re-asserted `background … !important`. The element carried `transition: background-color 0.15s`, so each re-assert cross-faded the fill — a periodic repaint seen as a pulse. (`topbar-tools-347` restyles size/visibility only — no background; `mobile-fab-cleanup-351` uses a translucent fill but only on the separate mobile FAB, which privacy-led's `FAB_MARKER` selector does not match — so no cross-sidecar background contention on the desktop pill.)
- **Fix (v1.50.74):** (1) dropped `background-color` from the FAB's `transition` so the fill can never animate; (2) added an idempotency guard in `refreshFabAppearance` — a `data-antcv-pl-sig` (worst|glyph|calls) short-circuits all DOM writes when the visible appearance is unchanged, so the 2 s tick stops repainting. Border/glyph colour still fade on a real level change. Cache-bust: `?v=1.50.74-nobleep`, `sw.js` → `antcv-1.50.74`, `version-override` TARGET → `1.50.74` (1.50.73 → STALE).

### NAME-ALIGN-001 — FIXED (sidecar)
- Owner: the candidate Name renders `text-align: left` while its CJLR control reads "current: center". Confirmed the editor's `wrapEditable` does NOT touch text-align — the `left` comes from app.js rendering the Name with `text-align: y("name")`, which is desynced from the CJLR control. Pure app.js-internal state desync (the control's displayed value and `y("name")` disagree).
- **Fix:** new sidecar `pwa/antcv-name-align-fix.js` (v1.0.0) keeps the Name line's text-align in lock-step with its CJLR control: reads the control's `current: <align>`, persists it to `localStorage:antcv:nameLineAlign` (so it survives the panel being closed / reloads), and applies it `!important` to `[data-antcv-candidate-edit="name"]`, re-applying on re-render + on a CJLR click + a 1.2s backstop. Disable hatch `antcvDisableNameAlignFix`. Cache-bust: new tag `?v=1.0.0`, `sw.js` → `antcv-1.50.73`, `version-override` TARGET → `1.50.73` (1.50.72 → STALE).

### Candidate panel ↔ preview sync — TRIAGE (2026-06-04)
Owner reported, after the role/company fix landed: preview→panel input doesn't refresh; the Name panel input isn't connected to the preview Name; contact/Location fields aren't connected; the preview Specialisation line isn't editable; and the panel has a redundant combined "Location line" alongside city + country.
- **Root:** the contact/name/specialisation panel, the line-alignment store, and the "Location line" field all live in **minified `app.js`** (not the readable React islands). Each candidate field writes its own in-app state object and `app.js` owns the rendering, so a per-field sidecar bridge is the wrong shape (high-risk, untestable here, will conflict). The role/company fix only worked because that store was a clean top-level localStorage key (`meta`).
- **Recommendation:** treat the candidate panel↔preview two-way sync + field cleanup as one app.js/React task (plan CA-001..005), done with live testing — not a growing stack of blind sidecars.
- **Owner decisions captured (queued):** drop the redundant combined "Location line" input and relabel the city field to "Location" (keep country) — implementable as a safe hide/relabel sidecar next.

### CL-HEADER-001 — panel↔preview store mismatch FIXED (p0d-fix7)
- **Found via the panel + screenshot:** the Set-panel "Application — Role/Company" inputs and the top-bar chip use the localStorage **`meta`** object (chip renders `` `${meta.role} @ ${meta.company}` ``, app.js `setItem("meta")`). The preview sentence read `personalInfo.role/company` — a DIFFERENT store — so panel edits (`Gt`/`dfdf`) updated the chip but the sentence kept showing the showcase fallback (`Ideal: [Role] - That Company`, where `That Company` = `pi.targetCompany`).
- **Fix (`p0d-fix7`):** `candidate-preview-editor-341` now reads role/company from `meta` first (falling back to the legacy personalInfo keys) and writes preview edits back to `meta`, so the panel, the chip, and the preview sentence share one source of truth. Added a `storage`-event listener for the `meta` key to re-sweep. Cache-bust: `?v=p0d-fix7`, `sw.js` → `antcv-1.50.72`, `version-override` TARGET → `1.50.72` (1.50.71 → STALE).
- **Still owed (app.js, out of sidecar scope):** the panel exposes only Role + Company inputs, not the "Application" label word (CA-002 wants applicationLabel in the panel too); the label IS editable in the preview. Reverse sync (preview edit → live panel-input value) updates `meta` + chip but the panel input reads app in-memory state, so it refreshes on the app's next render, not instantly.

### CL-HEADER-001 — edit-safety guard (p0d-fix6, shipped #107)
- On 1.50.70 the host DOES attach: `<div data-antcv-candidate-application-sentence="1">` with three `contenteditable` spans (`applicationLabel` "Application", `role` "[Role]", `company` "[Company]"). The fields read are correct — the editor reads `pi.role`/`pi.company`, which the probe confirmed the panel writes.
- **Real root cause:** `wrapApplicationSentence` ran `host.innerHTML = ''` and rebuilt the spans on EVERY sweep. With the preview re-rendering constantly (HIWC-RERENDER-LOOP-001), each sweep destroyed the span the user was typing into → focus lost, text reverted to placeholder. So the line was un-editable and never showed the entered role/company (only the app-name chip updated).
- **Fix (`p0d-fix6`):** edit-safety + idempotency guard — skip the teardown when focus is inside the host (user is editing) or when the existing spans already match label/role/company. Cache-bust: `?v=p0d-fix6`, `sw.js` → `antcv-1.50.71`, `version-override` TARGET → `1.50.71` (1.50.70 added to STALE). Verify on 1.50.71: typing in Application/Role/Company spans sticks; panel edits flow into the sentence.
- **Still open sub-items:** the `nowrap; overflow:hidden` on the header line is CL-LAYOUT-002 (clips to page width). NAME-ALIGN-001 (below).

### OPEN — NAME-ALIGN-001
- Owner: the candidate Name renders `text-align: left` while its CJLR control reads "current: center". The center alignment is not applied to the Name line. Captured: `<div data-antcv-candidate-edit="name" style="...text-align: left;...">` with a CJLR button titled "CJLR for Name line — current: center". Fix: apply the stored CJLR value to the name node. Needs to confirm whether the alignment writer is `candidate-preview-editor-341`, a CJLR sidecar, or app.js.

### PRIVACY-FAB update (2026-06-04, on 1.50.71-era capture)
- The button itself now renders visible in the panel-open state (the captured node no longer carries `display:none`/`visibility:hidden`). What remains is the inner `<span class="antcv-privacy-dot">` blinking — likely a CSS pulse "live" indicator and possibly intentional. The "invisible when section tabs are closed" state was not captured; still needs the closed-state DOM + the style-mutation watch (capture B) to decide if any patch is warranted.

### Still-not-fixed reports (need version confirm / further work)
- **HIWC template still hidden in CL (owner):** `prv-bullets3` keeps the template when no real-data sibling exists; if it is still blank, either 1.50.70 had not loaded yet, or the empty template is not emitted by the app render at all (not a dedup case). Confirm `ANTCV_VERSION` = 1.50.70 after hard refresh; if still blank, this is an app-render gap, not the dedup.
- **PRIVACY-FAB-FLICKER-001 worse:** now invisible when section tabs are closed, flickers when the section panel is open; should be a persistent topbar pill. Captured node still carries `display:none !important` + `opacity:1 !important` + `data-antcv-topbar-moved="1"` — `mobile-fab-cleanup-351` / `topbar-tools-347` / `privacy-led` fighting. Needs a mutation-source probe before patching.

---

## 2026-06-04 — HIWC bullet-dedup console flood (fixed) + re-render loop (new, OPEN)

Owner report: in the cover-letter "How I Would Contribute" the second group of three bullets pops in and out continuously, and the console is flooded so a probe readout can't be taken.

### Fixed — console flood from `antcv-preview-bullets-dedup-341.js`
- **Root cause:** a re-render loop elsewhere keeps re-mounting the template `<ul data-antcv-hiwc-list="1">` as FRESH DOM nodes (without the `data-antcv-prv-bullets-hidden` marker), so the dedup re-hides each new node and logged a per-node `console.debug` every time — thousands of lines that drown the console.
- **Fix (v1.40.341-prv-bullets2):** collapse the per-node log into one debounced summary (`hid N template-only list(s) since last report`, ≤1 / 2s). Behaviour-preserving — hide/show logic unchanged. Cache-bust: `index.html ?v`, `sw.js CACHE` → `antcv-1.50.68`, `version-override` TARGET → `1.50.68` (+ 1.50.42..67 added to STALE). The reported count now doubles as a re-render-rate signal.

### Fixed — empty HIWC section rendered blank (`prv-bullets3`)
- **Symptom (owner):** after the flood fix, the HIWC bullets were fully hidden unless text was typed in the section panel; the empty template placeholders should stay visible.
- **Root cause:** `hideTemplateLists` hid EVERY template-only `<ul>`/`<ol>` unconditionally — including when no real-data render existed to fall back to — so an empty section went blank. The module header always intended a sibling check ("hide only when a sibling editable-text span shows the same text") that the code never implemented.
- **Fix (v1.40.341-prv-bullets3):** added `hasRealDataSibling(list)` — a bounded (≤4-ancestor) search for a `[data-antcv-editable-text="true"]` span with real, non-placeholder content outside the list. Hide the template only when such a sibling exists; otherwise keep the template visible. Worst case degrades to the prior duplicate render, never a blank section. Cache-bust: `?v=prv-bullets3`, `sw.js` → `antcv-1.50.69`, `version-override` TARGET → `1.50.69` (1.50.68 added to STALE; invariant preserved).

### OPEN — PRIVACY-FAB-FLICKER-001
- **Status:** OPEN — note only; not yet diagnosed.
- **Symptom (owner):** the Privacy 🛡 FAB "bleeps" (flickers). Captured node carries conflicting inline styles — `display:none !important; visibility:hidden !important; pointer-events:none !important` AND `opacity:1 !important` AND `data-antcv-topbar-moved="1"` — i.e. competing sidecars (`mobile-fab-cleanup-351` / `topbar-tools-347` / `privacy-led`) fighting over its visibility/placement (PRV-005). Needs a probe of which sidecar writes the style last on each tick before any patch.

### OPEN — HIWC-RERENDER-LOOP-001 (the actual flicker)
- **Status:** OPEN — needs a targeted probe before any patch (diagnostic-first; do not blind-patch a central sidecar).
- **Symptom:** the template HIWC bullet list re-mounts on a loop, so the dedup is in a perpetual race (visible flash → hidden → visible …).
- **Suspected driver:** `antcv-candidate-preview-editor-341` writes sections (`source: 'candidate-preview-editor-341'`) → `antcv-personality` `forceRebuild` on `antcv:sections-updated` → React re-mounts the section → editor's observer fires → writes again. Console shows this chain repeating.
- **Next step:** instrument which sidecar re-fires `antcv:sections-updated` without a real data change, then gate that emit on an actual diff. Candidate fix sits in `candidate-preview-editor-341` (and/or the personality forceRebuild trigger), both readable sidecars.
- **Related QA-spec IDs:** CL-003 (HIWC modelled as Intro + per-bullet rows + Closing), GEN-UI-003 (endless controls under generation), PRV.

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
- **Root cause (CONFIRMED 2026-06-04 via `antcv-cl-header-probe.js` watch):** Panel Role/Company edits DO reach storage — the probe logged `piRole` and `piCompany` changing on each panel keystroke, each firing `candidate-preview-editor-341` → `antcv-personality` forceRebuild. The break is the OTHER direction: the snapshot showed `visible sentence hosts (0)` and the `sentence` fingerprint never changed. So `personalInfo.role/company` update fine, but `candidate-preview-editor-341`'s `wrapApplicationSentence` never attaches an editable host (its anchor/block search returns nothing on the CL), so the visible "Application:" line is neither editable nor re-rendered from the updated personalInfo. The old "writes to a hidden anchor" theory is wrong — panel→storage works; storage→visible line is the gap.
- **Next:** capture the visible "Application:" line's DOM (why `findCandidateBlock`/anchor search misses it), then fix the attach in `candidate-preview-editor-341` so the sentence renders from `personalInfo.role/company` and is editable. Verify Preview + PDF + DOCX.
- **Fix direction:** Bridge panel Role/Company edits to the visible sentence spans (or make the visible sentence the single source of truth); correct font/colour to document tokens. Verify in Preview, PDF, and DOCX.
- **Diagnostic (next step):** `pwa/antcv-cl-header-probe.js` — read-only console probe (NOT loaded by index.html, never writes DOM/storage). Paste it into the live console on the CL Preview; it snapshots which `personalInfo` key holds role/company, the visible-sentence host text + computed style vs the name leaf, the hidden anchor, and the Settings-panel Role/Company field values, then `__clHeaderProbe.watch()` attributes a panel edit to a storage write and/or a re-render. Run reproduce → probe → targeted patch per CLAUDE.md; do not patch before the probe output identifies the key/render path.
- **Related QA-spec IDs:** CA-002 (Application sentence sync), CL-LAYOUT-002 (Application line width).

### APPHIST-ZIDX-001 — "Open in Settings →" opens Settings behind the preview
- **Status:** OPEN — needs live DOM evidence on fresh code before fixing.
- **Symptom:** From Application History, clicking "Open in Settings →" opens the Settings panel BEHIND the preview (z-index / stacking-context issue); user can't see/reach it.
- **Context:** app.js handler (v1.40.326) sets settingsTab + `window._antcvOpenSettingsRoute({tier:"standard",subtab:"apps"})`. Related sidecars: `antcv-app-history-zfix-291`, `antcv-app-history-back-to-preview-341`, `antcv-preview-shell-sticky-341`.
- **Fix direction:** Capture the stacking order live on current deployed code, then raise the Settings route above the preview shell (or lower the preview while Settings is foregrounded). Do not fix blind.
- **Diagnostic (next step):** `pwa/antcv-apphist-zindex-probe.js` — read-only console probe (NOT loaded by index.html, never writes DOM/storage). After clicking "Open in Settings →" so the mis-stacked panel is on screen, paste it into the console. It reports the chosen Settings panel + its full stacking-context chain (every ancestor that establishes a stacking context, with z-index), the preview-shell candidates and their chains, and — the ground truth — `paintOrderAtPanelCentre`: what `document.elementFromPoint` actually paints on top where the panel should be, and whether that topmost node is inside the preview or the panel. Distinct from `app-history-zfix-291` (which only raises the history dropdown above the slider). Run reproduce → probe → targeted patch.
- **Related QA-spec IDs:** AH-001 (Open in Settings foregrounds Application History).

### EXPORT-PAGE2-001 — Document-export preview: page 2 missing / no page breaks
- **Status:** OPEN — re-verify on fresh code.
- **Symptom:** Export preview shows only page 1 / page breaks not applied; page 2 content missing from the rendered preview.
- **Context:** Gate collects all `.antcv-preview-paper`; `antcv-pdf-page-mismatch.js` chips on count mismatch. Page-break sidecars: `antcv-page-breaks-everywhere-284`, `antcv-table-page-splits-327`, `antcv-sidebar-subsection-pagebreaks-329`. Watermark: `antcv-watermark-page-anchor-341`.
- **Fix direction:** Re-test on fresh deployed code. If still broken, determine whether the break is dropped in the preview render path or only in PDF/DOCX export; confirm against PB-001..006 gates.
- **Narrowed (2026-06-04):** the docx-worker page-break engine is healthy — `test/smoke-pagebreak.js` and `test/smoke-jd-questions-page2.js` pass 10/10 each, so the `.docx` export emits page 2 for the covered cases. That points the remaining defect at the CLIENT export-preview path: `antcv-pdf-preview-gate.js` builds `#antcv-pdf-preview-modal-iframe` and clones every `.antcv-preview-paper` into it (a v1.50.31 bug carried only page 1; v1.50.32 claims the fix). Preview page count = `[data-antcv-page-break="1"]` markers + 1.
- **Diagnostic (next step):** `pwa/antcv-export-page2-probe.js` — read-only console probe (NOT loaded by index.html, never writes DOM/storage). Open the export/PDF preview, paste it in. It compares the source `.antcv-preview-paper` papers + page-break markers against what the gate iframe actually carries (`paperCountSourceVsIframe`, `markerCountSourceVsIframe`), reports whether `break-before` is computed on the iframe markers, and flags any paper that overflows one page with no marker. That isolates whether page 2 is dropped in the clone, in the marker injection, or in the break CSS.
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
- **IMPORT-001** — [~] (High) Import reports 0 work entries despite valid JSON; map experience/education/certifications/publicationsStructured lengths. Shipped fixes: `antcv-upload-recount-339.js` (dual-key normalise + toast recount) and the importer's experience→sections.cv bridge. The contract is now codified + regression-covered in `pwa/lib/import-normalize.js` + `pwa/test/unit/import-normalize.test.mjs` (18 tests, incl. a static drift guard over both sidecars and the Anita persona as fixture). Live verification of the in-app import still owed; adopting the shared module inside the sidecars is a follow-up (touches loaded scripts → needs browser verification).
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
