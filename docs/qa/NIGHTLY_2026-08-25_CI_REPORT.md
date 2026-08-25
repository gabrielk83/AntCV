# AntCV CI Nightly — 2026-08-25 (GitHub Actions, Opus 4.8, unattended)

**Verify + attest + E1 sweep. NO code shipped to main, no PR, no deploy.** `ALLOW_DEPLOY` not `true`.

## Sync / baseline
- SYNC FIRST clean: `git fetch origin && git pull --rebase origin main` → **Already up to date**.
- HEAD `d51376bb` — the 08-24 CI report commit — release **`1.51.4346-cost-rates`** (sw.js CACHE /
  TARGET_VERSION / ANTCV_VERSION seed / index.html `app.js?v` all match).
- Baseline = the 08-24 CI report, which **is** the current HEAD `d51376bb`.

## Code delta since the 08-24 CI report — NONE
`git log ae55e774..HEAD -- pwa/app.js pwa/app.src.js workers/` = only the pre-existing
`60d8b07b` (LLM-COST-EFFECTIVE-FROM-001, already in the 08-22/08-23/08-24 verified lineage) and
`1512d4ef`; nothing app.js/app.src.js/worker-touching has landed since the 08-24 report. **`pwa/app.js`
and `pwa/app.src.js` are byte-identical to `ae55e774` (release `1.51.4346-cost-rates`).** Nothing new
to ship — this is a full verify + attest + E1 cycle. Ran the render-gated pass anyway (Chromium
installed this run) for a fresh independent attestation of the current bytes.

## Verification — ALL GREEN
- **PWA suite `node scripts/run-tests.mjs pwa`: 1621 / 1621** (0 fail, 0 skip).
- **boot-smoke** (`node pwa/test/boot-smoke.mjs`): `glDemo=function, errors=0` — HEAD boots past sign-in.
- `pwa/app.js`: `node --check` OK, head `(()=>{window`, **0** `"use strict"`.

## Render-gated diags (Chromium installed this run) — GREEN on HEAD `d51376bb`
- `diag-copenhagen-overflow-storm` (row 1): **DIAG PASS** — ON (default) 2 writes / 0px usablePx-drift / 0 err; OFF 1 write / 0px / 0 err; CV preview converges band ON and OFF.
- `scripts/run-docx-diags.mjs` (docx render V&V): **50 / 50 passed**.
- `diag-align-flap` (row 16): **ALIGN-FLIPS (0)** — `tableRow0` header `center`; `tableRow1` / `tableRow2` both measure `a:justify inline:justify` consistently — no justify↔left flap.
- `diag-settings-panels-probe` (E2, row 17): Personal / Account / Layout each **0 mut / 6s**, rootFound=true, **0 page errors** — standard settings panels at rest.
- `diag-sidebar-stable` (row 11): writes=0, width stable (262.02→262.02), height converged after 12 scrolls, 0 page errors — no runaway style writes during scroll.

## Live attest — ALL GREEN (repo source == live browsers; stale-`?v` phantom-ship check clean)
- `antcv.pages.dev/sw.js` CACHE **`antcv-1.51.4346-cost-rates`** == repo HEAD → the shipped bundle is LIVE in browsers.
- `antcv.pages.dev/app.js?v=1.51.4346-cost-rates` → HTTP **200**.
- Repo version quintet consistent: sw.js CACHE == TARGET_VERSION == ANTCV_VERSION seed == index `app.js?v` == `1.51.4346-cost-rates`.
- Worker `/health`: **antcv-access-relay 200**, **cv-proxy 200**, **antcv-demo-proxy 200**, **docx-worker 200**.

## E1 staleness sweep — rotated to the stalest un-swept row (52) + re-confirmed render rows (1 / 11 / 16 / 17)
The 08-22 run swept 1/16/17/35/36/37; 08-23 swept 3/9/14 + reconfirm 1/16/17; 08-24 swept row 20 +
reconfirm 1/11/16/17. This run rotated to **row 52** — the stalest current `verified:` date in the
register (`2026-07-31`, un-swept since) — and re-confirmed the render rows.
- **Row 52 (GROUP-EMPTY-HIDE-001, SHIPPED 1.51.194)** — code legs RE-CONFIRMED on current source:
  `__grpHasChild` ×3 in `pwa/app.src.js`; minified mirror `__gc` ×3 in `pwa/app.js`; `renderRichBlock`
  ×7 in `workers/docx-worker/src/index.js`. Guard test `pwa/test/unit/group-empty-hide.test.mjs`
  re-run in isolation: **29 / 29 pass** (brace-extracts both real helpers + asserts preview↔export
  parity). All anchors in place, un-regressed. Re-dated 2026-08-25.
- **Rows 1 / 11 / 16 / 17** — render/probe diags re-run above (all green), re-dated 2026-08-25.
- **Rows 35 / 36 / 37** (OVERLAY-EARLY-HALT / GEN-CORECOMP-BROAD / FOCUS-LABEL-EO) — anchors held by
  the green suite (`pwa/test/unsolicited-corecomp-broad.test.mjs` + both-bundle mirror lock all pass).
  Unchanged; live regen-confirm still owed (needs real LLM generation — BLOCKED in CI).

## Owed / carried OPEN (all owner-side or desktop/live-model — unchanged this run)
- **Post-deploy live-verify signed-in on `antcv.pages.dev`** (in-app Browser pane) — owed to a desktop
  run. This run confirmed the deploy is live and byte-matches repo via public `sw.js`/`app.js` fetch,
  but the signed-in in-browser leg (cost-meter render, gen cycle) needs the desktop pane.
- **Row 20** owner verify list — a real Hard Refresh + CL regen + CV re-export eyeball (esp. leg (a)
  sidebar↔main headline alignment in a real CloudConvert PDF).
- Rows **35/36/37** fresh-generation content check (needs live models).
- **CI-CF-TOKEN-EXPIRED-001** — rotate the Actions `CLOUDFLARE_API_TOKEN`; worker deploys stay desktop-only.
- **Row 19 / 39a leg 3** two-real-device test (needs a physical second device).
- **A1** GEN-BACKGROUND flip-default (needs a real mobile foreground gen A/B).
- **SO-004** (row 41) — no headless React #185 repro.
- **Register hygiene** (owner decision, carried from 08-21..08-24) — split `OPEN_REGISTER.md` into
  ACTIVE / CLOSED, or prune closed rows. At ~100 accumulated rows the roll-up is costing diagnosis
  time on already-shipped rows. Recommend the owner decide.

## Nothing shipped by this run
No PWA/worker code changed by the 08-25 CI nightly → no PR, no cache-bust, no version consumed,
nothing owed live-verify FROM tonight beyond the pre-existing signed-in in-browser leg noted above.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
