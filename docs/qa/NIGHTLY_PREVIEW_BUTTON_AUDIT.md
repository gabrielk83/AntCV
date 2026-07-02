# NIGHTLY WORK ORDER — preview button audit + PDF parity (register row 23)

Owner order (2026-07-03): "Check ALL buttons for activity on the preview — e.g. on the
region where the CV and CL are visualised — and check that the correct positions of
CJLR, colors, roller etc. are passed to PDF generation."

Motivation: this week found THREE dead controls in one panel family (the name CJLR wrote
`headerItemAlign.name_input`, the two Application CJLRs wrote input-only keys — none moved
the band). Assume more exist. Two failure classes to catch:

- **Dead control** — clicking produces NO state/store/DOM delta.
- **Preview-only control** — the preview changes but the value never reaches the export
  payload (`buildPayload` in `pwa/antcv-docx-client.js` → docx-worker), so the PDF ignores it.

## Method (headless, owner-scale kernel — see docs/qa + pwa/test harnesses)

1. Boot the PWA headless (Playwright pattern from `pwa/test/boot-smoke.mjs`; inject
   auth/session/sections per [[headless-pwa-testing]]). Load the Gabriel-scale kernel so
   every section/panel renders.
2. **Enumerate**: query all `button, [role=button], input[type=checkbox], select,
   input[type=color], input[type=range]` inside (a) the preview region (the CV + CL paper
   surfaces) and (b) the editor side panels that configure them (candidate header editors,
   section editors, CL FORMAT panel, STYLE PACKAGE). Record label/title + DOM path.
3. **Activity probe** per control: snapshot `localStorage` (all `antcv:*` + known stores:
   `headerItemAlign`, `headerItemRule`, `stylePrefs`, section stores) + the relevant DOM
   subtree → click/toggle → assert SOME delta (store write, class/style change, React
   re-render marker). No delta = **DEAD** — file it.
4. **PDF-parity probe** per control FAMILY (CJLR alignment, rule lines on/off/pt/color,
   roller/thickness, palette colors, fonts, photo, slogan/signature): set a distinctive
   value → call `buildPayload` (docx-client is a plain module — import it in node, or call
   in-page) → assert the value appears in the payload field the worker reads
   (`header_align`, `header_rules`, `styleConfig`, `meta.slogan`, …). Preview-delta but no
   payload-delta = **PREVIEW-ONLY** — file it.
5. Known traps: single clicks on rows toggle expand (use the documented dblclick semantics);
   a 360ms stationary press used to trigger drag-drop (fixed 1.51.88 — regression-check it);
   controls re-render and detach (re-query, `isConnected` checks); vm-realm deepEqual.
6. Output: a table in this file (control → panel → activity ✓/✗ → payload field → parity ✓/✗),
   bugs filed in ACTIVE_BUGS.md + OPEN_REGISTER.md, fixes only for one-line dead-key wiring
   (anything structural gets filed, not guessed).

## STATUS

- [ ] Phase 1 — enumerate + activity probe (all preview-region + panel controls)
- [ ] Phase 2 — PDF-parity probe per control family
- [ ] Phase 3 — file findings; wire trivial dead-key fixes; regression tests
