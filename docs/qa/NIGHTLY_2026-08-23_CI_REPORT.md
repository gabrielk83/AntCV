# AntCV CI Nightly — 2026-08-23 (GitHub Actions, Opus 4.8, unattended)

**Verify + attest + E1 sweep. NO code shipped to main, no PR, no deploy.** `ALLOW_DEPLOY=false`.

## Sync / baseline
- SYNC FIRST clean: `git fetch origin && git pull --rebase origin main` → **Already up to date**.
- HEAD `00d3a286` — release **`1.51.4346-cost-rates`** (sw.js CACHE / TARGET_VERSION / ANTCV_VERSION seed all match).
- Baseline = the 08-22 CI report, which **is** the current HEAD `00d3a286`.

## Code delta since the 08-22 CI report — NONE
`git log 5fff943a..HEAD` = one commit, `00d3a286` (the 08-22 CI report itself, docs-only). The last
`pwa/app.js` / `pwa/app.src.js`-touching commit is `ae55e774` (release `1.51.4346-cost-rates`),
already in the 08-22 verified lineage. **`pwa/app.js` and `pwa/app.src.js` are byte-identical to the
08-22 verify.** Nothing new to ship — this is a full verify + attest + E1 cycle. Ran the render-gated
pass anyway (Chromium installed this run) for a fresh independent attestation of the current bytes.

## Verification — ALL GREEN
- **PWA suite `node scripts/run-tests.mjs pwa`: 1621 / 1621** (0 fail, 0 skip).
- **boot-smoke** (`node pwa/test/boot-smoke.mjs`): `glDemo=function, errors=0` — HEAD boots past sign-in.
- `pwa/app.js`: `node --check` OK, head `(()=>{window`, **0** `"use strict"`.

## Render-gated diags (Chromium installed this run) — GREEN on HEAD `00d3a286`
- `diag-copenhagen-overflow-storm` (row 1): **DIAG PASS** — ON (default) 5 writes / 15px usablePx-drift / 0 err; OFF 1 write / 0px / 0 err; CV preview converges band ON and OFF.
- `scripts/run-docx-diags.mjs` (docx render V&V): **50 / 50 passed**.
- `diag-align-flap` (row 16): `tableRow0` header `center`; `tableRow1` / `tableRow2` both measure `a:justify inline:justify` consistently — **no justify↔left flap**.
- `diag-settings-panels-probe` (E2, row 17): Account **0 mut / 6s**, Layout **0 mut / 6s**, rootFound=true, **0 page errors** — standard settings panels at rest.
- `diag-sidebar-stable`: writes=0, width 262.02px stable, height converged, 0 page errors — no runaway style writes during scroll.

## Live attest — ALL GREEN (repo source == live browsers; stale-`?v` phantom-ship check clean)
- `antcv.pages.dev/sw.js` CACHE **`antcv-1.51.4346-cost-rates`** == repo HEAD → the shipped bundle is LIVE in browsers.
- `antcv.pages.dev/app.js?v=1.51.4346-cost-rates` → HTTP **200**.
- Worker `/health`: **antcv-access-relay 200**, **cv-proxy 200**, **antcv-demo-proxy 200**, **docx-worker 200** (correct host `docx-worker.karp-gabriel-a.workers.dev`, not `antcv-docx-worker`).
- `c2pa-worker` is a POST-only signer — 404 on GET `/`, `/health`, `/status` is expected (reachable, no GET health endpoint); not in the canonical health set.

## E1 staleness sweep — rotated to the stalest un-swept rows (3 / 9 / 14) + re-confirmed render rows (1 / 16 / 17)
The 08-22 run swept 1/16/17/35/36/37; this run re-dated those it re-ran and rotated to the three
oldest rows the 08-22 sweep did **not** touch:
- **Row 9** (Cluster demand model, stalest at `verified: 2026-07-07`) — writer pipeline RE-CONFIRMED on current source: `recomputeClusterTop20` at `access-relay/src/index.js:2496`, invoked on JD extraction at :2574 and :2900, rank-scaled (NOT flat) weight comment at :2592 (`RESEARCH_WEIGHT*(21-rank)/20`). Stays **CLOSED / in production**. Re-dated 2026-08-23.
- **Row 3** (Floating spine byte-diff) — flag default-OFF RE-CONFIRMED: `docx-worker/src/index.js:24674` `floatSpine: payload.float_spine===true || !!(payload.style && payload.style.floatSpine===true)` (default OFF, unchanged). Still owner-visual-gated — no reference docx in CI to byte-diff. Re-dated 2026-08-23.
- **Row 14** (JD-scan-hallucination ingest reorder) — JD-SCAN-HALLUCINATION-001 anchors RE-CONFIRMED in `pwa/app.src.js`: charset-statistics hardening ~892, filename↔content echo ~929, garbled-text-layer → vision-OCR route ~1003-1012. Code-shipped (1.51.100/102); live model-behaviour leg stays owner/live-gated. Re-dated 2026-08-23.
- **Row 1 / 16 / 17** — render/probe diags re-run above (all green), re-dated 2026-08-23.
- **Rows 35 / 36 / 37** (OVERLAY-EARLY-HALT / GEN-CORECOMP-BROAD / FOCUS-LABEL-EO) — anchors held by the green suite (`pwa/test/unsolicited-corecomp-broad.test.mjs` + both-bundle mirror lock all pass). Unchanged since 08-22; live regen-confirm still owed (needs real LLM generation — BLOCKED in CI).

## Owed / carried OPEN (all owner-side or desktop/live-model — unchanged this run)
- **Post-deploy live-verify signed-in on `antcv.pages.dev`** (in-app Browser pane) — owed to a desktop
  run. This run confirmed the deploy is live and byte-matches repo via public `sw.js`/`app.js` fetch,
  but the signed-in in-browser leg (cost-meter render, gen cycle) needs the desktop pane.
- Rows **35/36/37** fresh-generation content check (needs live models).
- **CI-CF-TOKEN-EXPIRED-001** — rotate the Actions `CLOUDFLARE_API_TOKEN`; worker deploys stay desktop-only.
- **Row 19 / 39a leg 3** two-real-device test (needs a physical second device).
- **A1** GEN-BACKGROUND flip-default (needs a real mobile foreground gen A/B).
- **SO-004** (row 41) — no headless React #185 repro.
- **Register hygiene** (owner decision, carried from 08-21/08-22) — split `OPEN_REGISTER.md` into
  ACTIVE / CLOSED, or prune closed rows. At ~100 accumulated rows the roll-up is costing diagnosis
  time on already-shipped rows. Recommend the owner decide.

## Nothing shipped by this run
No PWA/worker code changed by the 08-23 CI nightly → no PR, no cache-bust, no version consumed,
nothing owed live-verify FROM tonight beyond the pre-existing signed-in in-browser leg noted above.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
