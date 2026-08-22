# AntCV CI Nightly — 2026-08-22 (GitHub Actions, Opus 4.8, unattended)

**Verify + attest + E1 sweep. NO code shipped to main, no PR, no deploy.** `ALLOW_DEPLOY=false`.

## Sync / baseline
- SYNC FIRST clean: `git fetch origin && git pull --rebase origin main` → **Already up to date**.
- HEAD `5fff943a` — release **`1.51.4346-cost-rates`** (sw.js CACHE / TARGET_VERSION / ANTCV_VERSION seed all match).
- Baseline = the 08-21 CI report HEAD `9e055e8` (same release).

## Code delta since the 08-21 CI report — worker + test only, no PWA byte change
`git log 9e055e8..HEAD`: two commits — `60d8b07b` (relay `telemetry.js`: honour `effective_from`
when pricing `llm_calls`, LLM-COST-EFFECTIVE-FROM-001 — authored, tested and **DEPLOYED** by the
08-21 desktop run, self-registered) and `5fff943a` (a `test/so-003` core_comp trigger-side invariant
test + register edit). **`pwa/app.js` / `pwa/app.src.js` are byte-identical to the 08-21 CI/desktop
verify** (last app.js-touching commit is `ae55e774`, already in the 08-21 lineage). Nothing new to
ship — this is a full verify + attest + E1 cycle. Ran the render-gated pass anyway (Chromium
installed this run) for a fresh independent attestation of the current bytes.

## Verification — ALL GREEN
- **PWA suite `node scripts/run-tests.mjs pwa`: 1621 / 1621** (0 fail, 0 skip).
- **boot-smoke** (`node pwa/test/boot-smoke.mjs`): `glDemo=function, errors=0` — HEAD boots past sign-in.
- `pwa/app.js`: `node --check` OK, head `(()=>{window`, **0** `"use strict"`.

## Render-gated diags (Chromium installed this run) — GREEN on HEAD `5fff943a`
- `diag-copenhagen-overflow-storm` (row 1): **DIAG PASS** — ON (default) 2 writes / 0px usablePx-drift / 0 err; OFF 1 write / 0px / 0 err; CV preview converges band ON and OFF.
- `scripts/run-docx-diags.mjs` (docx render V&V): **50 / 50 passed**.
- `diag-align-flap` (row 16): `tableRow1` / `tableRow2` both measure `a:justify inline:justify` consistently — **no justify↔left flap**; `tableRow0` header `center` as expected.
- `diag-settings-panels-probe` (E2, row 17): Account **0 mut / 6s**, Layout **0 mut / 6s**, rootFound=true, **0 page errors** — all standard settings panels at rest.
- `diag-sidebar-stable`: writes=0, width 262.02px stable, height converged, 0 page errors — no runaway style writes during scroll.

## Live attest — ALL GREEN (repo source == live browsers; stale-`?v` phantom-ship check clean)
- `antcv.pages.dev/sw.js` CACHE **`antcv-1.51.4346-cost-rates`** == repo HEAD → the shipped bundle is LIVE in browsers.
- `antcv.pages.dev/app.js?v=1.51.4346-cost-rates` → HTTP **200**.
- Worker `/health` (`*.karp-gabriel-a.workers.dev`): antcv-access-relay **200**, cv-proxy **200**, antcv-demo-proxy **200**, docx-worker **200**.

## E1 staleness sweep — 6 rows re-verified on current HEAD `5fff943a`
- **Row 1** (quick-gen / CV 3-page convergence) — `diag-copenhagen-overflow-storm` re-run PASS above; docx render V&V 50/50. Re-dated 2026-08-22; owner live-verify unchanged.
- **Row 16** (sidebar TOOLS/REGULATORY justify↔left flap) — `diag-align-flap.mjs` re-run: no flap (both table rows stable at `justify`). Re-dated 2026-08-22; owner live-verify still open.
- **Row 17** (settings sweep-army cost) — `diag-settings-panels-probe`: Account/Layout 0 mut/6s, 0 errors. Still DONE, re-confirmed.
- **Rows 35 / 36 / 37** (OVERLAY-EARLY-HALT / GEN-CORECOMP-BROAD / FOCUS-LABEL-EO regen-confirm) — anchors RECONFIRMED on current bytes: `__antcvGenCost` heartbeat gate + `KERNEL-STUCK` watchdog present (row 35); broad core_comp rule inside `__neutralCo` present in `app.src.js` and locked in BOTH bundles by the green suite guard tests + `pwa/test/unsolicited-corecomp-broad.test.mjs` (row 36); `FOCUS-LABELS-001` compact-label rule present in `app.src.js` + `app.js` (row 37). Re-dated 2026-08-22. **Live regen-confirm still owed** (needs real LLM generation — BLOCKED in CI).

## Owed / carried OPEN (all owner-side or desktop/live-model — unchanged this run)
- **Post-deploy live-verify signed-in on `antcv.pages.dev`** (in-app Browser pane) — owed to a desktop
  run. This run confirmed the deploy is live and byte-matches repo via public `sw.js`/`app.js` fetch,
  but the signed-in in-browser leg (cost-meter render, gen cycle) needs the desktop pane.
- Rows **35/36/37** fresh-generation content check (needs live models, measured on its own run).
- **CI-CF-TOKEN-EXPIRED-001** — rotate the Actions `CLOUDFLARE_API_TOKEN`; worker deploys stay desktop-only.
- **Row 19 / 39a leg 3** two-real-device test (needs a physical second device).
- **A1** GEN-BACKGROUND flip-default (needs a real mobile foreground gen A/B).
- **SO-004** (row 41) — no headless React #185 repro.
- **Register hygiene** (owner decision, carried from 08-21) — split `OPEN_REGISTER.md` into ACTIVE /
  CLOSED, or prune closed rows out of the numbered table. At ~100 rows the roll-up is costing
  diagnosis sessions on already-shipped rows (row 40 cost three). Recommend the owner decide.

## Nothing shipped by this run
No PWA/worker code changed by the 08-22 CI nightly → no PR, no cache-bust, no version consumed,
nothing owed live-verify FROM tonight beyond the pre-existing signed-in in-browser leg noted above.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
