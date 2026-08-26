# AntCV CI Nightly — 2026-08-26 (GitHub Actions, Opus 4.8, unattended)

**Verify + attest + E1 sweep. NO code shipped to main, no PR, no deploy.** `ALLOW_DEPLOY=false`.

## Sync / baseline
- SYNC FIRST clean: `git fetch origin && git pull --rebase origin main` → **Already up to date**.
  Re-fetched at end of run — still `8356387f`, no parallel push landed during the run.
- HEAD `8356387f` — the 08-25 CI report commit — release **`1.51.4346-cost-rates`** (sw.js CACHE /
  TARGET_VERSION / ANTCV_VERSION seed / index.html `app.js?v` all match).
- Baseline = the 08-25 CI report, which **is** the current HEAD `8356387f`.

## Code delta since the 08-25 CI report — NONE
`git log -- pwa/app.js pwa/app.src.js workers/` shows nothing app.js/app.src.js/worker-touching has
landed since the 08-25 report (last app.js-touching commit remains `ae55e774` = release
`1.51.4346-cost-rates`; `60d8b07b` LLM-COST-EFFECTIVE-FROM-001 is already in the 08-21..08-25 verified
lineage). **`pwa/app.js` and `pwa/app.src.js` are byte-identical to `ae55e774`.** Nothing new to ship
— this is a full verify + attest + E1 cycle. Ran the render-gated pass on fresh Chromium (installed
this run) for an independent attestation of the current bytes.

## Verification — ALL GREEN
- **PWA suite `node scripts/run-tests.mjs pwa`: 1621 / 1621** (0 fail, 0 skip).
- **boot-smoke** (`node pwa/test/boot-smoke.mjs`): `glDemo=function, errors=0` — HEAD boots past sign-in.
- `pwa/app.js`: `node --check` OK, head `(()=>{window`, **0** `"use strict"`.

## Render-gated diags (Chromium installed this run) — GREEN on HEAD `8356387f`
- `diag-copenhagen-overflow-storm` (row 1): **DIAG PASS** — ON (default) 5 writes / 15px usablePx-drift
  / 0 err, OFF 1 write / 0px / 0 err; CV preview converges band ON and OFF. The ON 5 writes/15px is the
  documented within-tolerance mount-settle transient (write-count bounded, 0 errors, converges) — same
  class as the 08-23 run's ON 5/15px; still DIAG PASS.
- `scripts/run-docx-diags.mjs` (docx render V&V): **50 / 50 passed**.
- `diag-align-flap` (row 16): **ALIGN-FLIPS (0)** — `tableRow0` header `center`; `tableRow1` / `tableRow2`
  both measure `a:justify inline:justify` consistently — no justify↔left flap.
- `diag-settings-panels-probe` (E2, row 17): Personal / Account / Layout each **0 mut / 6s**,
  rootFound=true, **0 page errors**, DIAG PASS — standard settings panels at rest.
- `diag-sidebar-stable` (row 11): writes=0, width stable (262.02→262.02), height converged after 12
  scrolls, 0 page errors — no runaway style writes during scroll.
- `diag-panel-button-audit` (E3, row 23): **208 buttons, 0 page errors, 0 THROWS** (133 active / 15
  ui-only / 14 skipped-dangerous / 45 not-visible-or-disabled). **1 DEAD candidate** — "Undo last
  change", the same explainable no-op the 08-17/08-19 runs documented (undo correctly does nothing in
  the seeded audit state, which has no edit history), NOT a defect. Artifacts
  `docs/qa/PANEL_BUTTON_AUDIT_2026-08-26.{json,md}`.

## Live attest — ALL GREEN (repo source == live browsers; stale-`?v` phantom-ship check clean)
- `antcv.pages.dev/sw.js` CACHE **`antcv-1.51.4346-cost-rates`** == repo HEAD → the shipped bundle is LIVE in browsers.
- `antcv.pages.dev/app.js?v=1.51.4346-cost-rates` → HTTP **200**.
- Repo version quintet consistent: sw.js CACHE == TARGET_VERSION == ANTCV_VERSION seed == index `app.js?v` == `1.51.4346-cost-rates`.
- Worker `/health`: **access-relay 200**, **cv-proxy 200**, **demo-proxy 200**, **docx-worker 200**
  (`docx-worker.karp-gabriel-a.workers.dev/health` — note the subdomain is `docx-worker`, not `antcv-docx-worker`).

## E1 staleness sweep — rotated to the stalest DATED verifiable row (23) + re-confirmed render rows (1 / 11 / 16 / 17)
The 08-22 run swept 1/16/17/35/36/37; 08-23 swept 3/9/14; 08-24 swept row 20; 08-25 swept row 52. The
stalest DATED verifiable register row this run was **row 23** (button audit, last `verified: 2026-08-20`,
un-swept for 6 days) — refreshed via the E3 button-audit above.
- **Row 23 (panel-button audit pass 2)** — `diag-panel-button-audit` RE-RUN on HEAD `8356387f`:
  208 buttons, 0 THROWS, 0 page errors, 133 active; 1 explainable DEAD ("Undo last change" no-op on
  empty history). Consistent with the 08-20 desktop pass 2 (211 buttons, 0 THROWS). Re-dated 2026-08-26.
- **Rows 1 / 11 / 16 / 17** — render/probe diags re-run above (all green), re-dated 2026-08-26.
- **Rows 35 / 36 / 37** (OVERLAY-EARLY-HALT / GEN-CORECOMP-BROAD / FOCUS-LABEL-EO) — anchors held by
  the green suite (`pwa/test/unsolicited-corecomp-broad.test.mjs` + both-bundle mirror lock all pass).
  Unchanged; live regen-confirm still owed (needs real LLM generation — BLOCKED in CI).

## Owed / carried OPEN (all owner-side or desktop/live-model — unchanged this run)
- **Post-deploy live-verify signed-in on `antcv.pages.dev`** (in-app Browser pane) — owed to a desktop
  run. This run confirmed the deploy is live and byte-matches repo via public `sw.js`/`app.js` fetch,
  but the signed-in in-browser leg (cost-meter render, gen cycle) needs the desktop pane.
- **Row 20** owner verify list — a real Hard Refresh + CL regen + CV re-export eyeball.
- Rows **35/36/37** fresh-generation content check (needs live models).
- **CI-CF-TOKEN-EXPIRED-001** — rotate the Actions `CLOUDFLARE_API_TOKEN`; worker deploys stay desktop-only.
- **Row 19 / 39a leg 3** two-real-device test (needs a physical second device).
- **A1** GEN-BACKGROUND flip-default (needs a real mobile foreground gen A/B).
- **SO-004** (row 41) — no headless React #185 repro.
- **Register hygiene** (owner decision, carried from 08-21..08-25) — split `OPEN_REGISTER.md` into
  ACTIVE / CLOSED, or prune closed rows. At ~100 accumulated rows the roll-up is costing diagnosis
  time on already-shipped rows. Recommend the owner decide.

## Nothing shipped by this run
No PWA/worker code changed by the 08-26 CI nightly → no PR, no cache-bust, no version consumed,
nothing owed live-verify FROM tonight beyond the pre-existing signed-in in-browser leg noted above.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
