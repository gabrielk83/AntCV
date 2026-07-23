# AntCV nightly — 2026-07-23 (CI / GitHub Actions, unattended, Opus 4.8)

Substrate: GitHub Actions on `gabrielk83/AntCV`. No in-app Browser pane (no live-deploy
verify), `ALLOW_DEPLOY=false` (no worker deploys). Headless Playwright available after
`npx playwright install chromium`. SYNC FIRST clean: `git fetch && pull --rebase origin main`
→ already up to date, HEAD `7f1e8fdc` (release 1.51.3642-1.51.3661). No shift claim (no
version-consuming change; all edits are docs + a standalone diag test).

## Headline — one solid VERIFIED finding, filed not shipped

**CPH-HEADER-BAND-OVERFLOW-STORM-001 (NEW, OPEN).** The standing row-17 probe
`diag-settings-panels-probe.mjs` went from PASS (07-22) to DIAG FAIL. Ran it down to a real,
default-ON regression rather than a probe artifact:

- **Symptom:** with the Copenhagen Stage-3 header band (default ON) the CV preview never
  settles. The single page-row's usable height climbs ~15px on EVERY measure cycle without
  bound — `antcv:mainOverflow.usablePx` 1053 → 1608+ over 9s while `totalMainPx`, `rows` and
  verdict stay constant. So `antcv-main-overflow-detect-364.js` re-writes
  `localStorage['antcv:mainOverflow']` ~4×/s indefinitely and `.antcv-document-sidebar` +
  `.antcv-document-main` + `.antcv-preview-paper` reflow continuously (permanent main-thread
  churn — the PERF-001 class). Reproduces on a trivial 1-section CV AND a realistic
  multi-section CV (36 writes, +540–555px drift both).
- **Root cause (grower):** the `antcv-sidebar-fill-equalize-227` / `antcv-page-fit` chain. Its
  LAST/single-row branch extends the sidebar to `mainH`; the row grows to the taller column;
  `main` (align-self:stretch) grows to the new row height; so `mainH` drifts UP each cycle and
  the equalize idempotency guard (`data-antcv-eq-h === String(mainH)`) never holds. The band's
  `display:grid;align-content:center;row-gap:18px` (copenhagen buildCSS) is what makes the
  row-height non-idempotent under equalize. 364's oscillation-damp only catches a two-state
  A,B,A,B flip — a monotone climb slips past it.
- **Bisect (headless, isolated worktrees):**
  - `1.51.1972` / `c77e38f2` (07-22 CI base): **1 write, 0px drift — CONVERGED.**
  - `c336c5a5` (Copenhagen Stage-2b table + Stage-3 header band, `1.51.3061` + wk 1.14.163):
    **35 writes — RUNAWAY.** → the introducing commit.
  - HEAD with `antcv:copenhagen-v2=0`: **1 write, 0px drift — CONVERGED.** → causation nailed
    + an owner workaround.
- **Impact:** Copenhagen is default-ON since 3061, so every user on the default template pays
  continuous forced reflow whenever the CV preview is open.
- **Why filed, not fixed here:** the fix lives in the equalize/page-fit/band interaction.
  CLAUDE.md flags this (salmon/pagination/preview layout) as the most blue-screen-prone area,
  and a preview-layout change cannot be live-verified from CI (no Browser pane) nor safely
  proven against real multi-page + salmon cases with a headless single-page fixture. Per the
  standing rule "one solid verified fix, never a brickable mid-product," this is left as a
  precise filed bug + a permanent repro.
- **Deliverable committed:** `pwa/test/diag-copenhagen-overflow-storm.mjs` — asserts the CV
  preview settles (≤6 `antcv:mainOverflow` writes AND ≤8px usablePx drift over 9s) with the
  band ON *and* OFF. Currently FAILs ON / PASSes OFF; it flips to full PASS when the loop is
  fixed. (Standalone `diag-*` — NOT in the `node --test` suite, so it does not turn the suite
  red.)
- **Fix options for the render-capable/desktop session** (in the register): make the equalize
  target the CONTENT height, not the stretched `mainH`, in the single-row+band case; OR add a
  monotone-climb detector to 364's damp (freeze when the last N signatures differ only by a
  steadily-growing `usablePx`); OR stop the band grid feeding its own container height back
  into the equalize measure.
- **Owner workaround today:** `localStorage['antcv:copenhagen-v2']='0'`.

Registered: ACTIVE_BUGS top entry + OPEN_REGISTER top block.

## Standing probes (baseline on `7f1e8fdc`)

- **PWA suite:** `node scripts/run-tests.mjs pwa` → **1464/1464 pass**, 0 fail (~4.7s).
- **app.js integrity:** head `(()=>{window…`, **0** `"use strict"` — minified-sacred intact.
- **boot-smoke:** `glDemo=function, errors=0` → BOOT-SMOKE OK (after `npx playwright install chromium`).
- **Button-audit (E3):** `diag-panel-button-audit.mjs` → **200 buttons** (160 active, 18
  not-visible/disabled, 22 skipped-dangerous), **0 page errors**, 0 DEAD/throws. No regression
  vs 07-22 (195-206 band). Artifact: `docs/qa/PANEL_BUTTON_AUDIT_2026-07-23.{json,md}`.
- **Personal-panel probe (E2 / row 17):** `diag-personal-panel-probe.mjs` → **0 mutations/8s,
  0 page errors — DIAG PASS** (panel at rest).
- **Settings-panels probe (row 17):** `diag-settings-panels-probe.mjs` → **DIAG FAIL** — this
  is the CPH-HEADER-BAND-OVERFLOW-STORM-001 finding above (DOM mutations 0 per panel; the fail
  is the `antcv:mainOverflow` set-count storm, not a settings-panel churn). The probe is
  behaving correctly; do NOT silence it.

## What could NOT be done in CI (owed elsewhere)

- **Worker deploys:** `ALLOW_DEPLOY=false` → none attempted; none owed by this run.
- **Live-deploy verify:** no Browser pane in CI → any PWA change would owe a desktop live-verify.
  This run shipped no PWA asset (docs + a diag test only), so nothing is owed on that front.
- **JOBTRACKER-EMPTY-BAND-CRASH-001** (prior open row): NOT actionable here — `build_workbook.py`
  and `job_tracker_doc.json` live outside the repo (Google Drive). Left for a job-tracker-tooling
  session. Unchanged.

## Register coverage this run

- CPH-HEADER-BAND-OVERFLOW-STORM-001 — NEW, filed OPEN (ACTIVE_BUGS + OPEN_REGISTER), repro committed.
- Row 17 (settings/personal panel stability) — verified: personal PASS; settings FAIL → the new
  bug above (previously a clean PASS, now a real regression surfaced).
- Button-audit standing coverage (E3) — verified clean (200 buttons / 0 errors).
- JOBTRACKER-EMPTY-BAND-CRASH-001 — confirmed still out-of-repo / not CI-actionable (no change).
- All other open rows are owner-gated / need a 2nd physical device / need live models or a real
  foreground gen / are content-density frontier items — none newly actionable from CI this run.

No code shipped to `main` beyond docs + one standalone diagnostic test. No app.js/app.src.js/
workers changes (would require a PR under the CI safety override); none were made.
