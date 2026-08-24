# AntCV CI Nightly — 2026-08-24 (GitHub Actions, Opus 4.8, unattended)

**Verify + attest + E1 sweep. NO code shipped to main, no PR, no deploy.** `ALLOW_DEPLOY=false`.

## Sync / baseline
- SYNC FIRST clean: `git fetch origin && git pull --rebase origin main` → **Already up to date**.
- HEAD `199cbe84` — release **`1.51.4346-cost-rates`** (sw.js CACHE / TARGET_VERSION / ANTCV_VERSION seed all match).
- Baseline = the 08-23 CI report, which **is** the current HEAD `199cbe84`.

## Code delta since the 08-23 CI report — NONE
`git log ae55e774..HEAD` = docs-only commits (the 08-22 + 08-23 CI reports + the SO-003 test/register
commit). The last `pwa/app.js` / `pwa/app.src.js`-touching commit is `ae55e774` (release
`1.51.4346-cost-rates`), already in the 08-22/08-23 verified lineage. **`pwa/app.js` and
`pwa/app.src.js` are byte-identical to the 08-23 verify.** Nothing new to ship — this is a full verify
+ attest + E1 cycle. Ran the render-gated pass anyway (Chromium installed this run) for a fresh
independent attestation of the current bytes.

## Verification — ALL GREEN
- **PWA suite `node scripts/run-tests.mjs pwa`: 1621 / 1621** (0 fail, 0 skip).
- **boot-smoke** (`node pwa/test/boot-smoke.mjs`): `glDemo=function, errors=0` — HEAD boots past sign-in.
- `pwa/app.js`: `node --check` OK, head `(()=>{window`, **0** `"use strict"`.

## Render-gated diags (Chromium installed this run) — GREEN on HEAD `199cbe84`
- `diag-copenhagen-overflow-storm` (row 1): **DIAG PASS** — ON (default) 4 writes / 0px usablePx-drift / 0 err; OFF 1 write / 0px / 0 err; CV preview converges band ON and OFF.
- `scripts/run-docx-diags.mjs` (docx render V&V): **50 / 50 passed**.
- `diag-align-flap` (row 16): **ALIGN-FLIPS (0)** — `tableRow0` header `center`; `tableRow1` / `tableRow2` both measure `a:justify inline:justify` consistently — no justify↔left flap.
- `diag-settings-panels-probe` (E2, row 17): Account **0 mut / 6s**, Layout **0 mut / 6s**, rootFound=true, **0 page errors** — standard settings panels at rest.
- `diag-sidebar-stable` (row 11): writes=0, width stable, height converged after 12 scrolls, 0 page errors — no runaway style writes during scroll.

## Live attest — ALL GREEN (repo source == live browsers; stale-`?v` phantom-ship check clean)
- `antcv.pages.dev/sw.js` CACHE **`antcv-1.51.4346-cost-rates`** == repo HEAD → the shipped bundle is LIVE in browsers.
- `antcv.pages.dev/app.js?v=1.51.4346-cost-rates` → HTTP **200**.
- Worker `/health`: **antcv-access-relay 200**, **cv-proxy 200**, **antcv-demo-proxy 200**, **docx-worker 200** (correct host `docx-worker.karp-gabriel-a.workers.dev`).
- `c2pa-worker` is a POST-only signer — 404 on GET `/health` is expected (reachable, no GET health endpoint); not in the canonical health set.

## E1 staleness sweep — rotated to the stalest un-swept row (20) + re-confirmed render rows (1 / 11 / 16 / 17)
The 08-22 run swept 1/16/17/35/36/37; the 08-23 run swept 3/9/14 + reconfirm 1/16/17. This run rotated
to **row 20** — the stalest un-swept row (`verified: 2026-07-03`) — and re-confirmed the render rows.
- **Row 20** (OWNER VERIFY LIST, 6 legs) — code-shipped anchors RE-CONFIRMED on current source:
  (a) headline-align spacer present in `docx-worker/src/index.js` (continuation-page spacer ~25376,
  `headlineAlign` ~24692); (b) sidebar-runt orphan handling present (`fix_orphans` ~1301/2099); (d) Sirin
  numberless/team-semantics belts present (`SIRIN-SEMANTICS-001` ~4015, `RESULTS-DISTINCT-001` ~4169);
  (f) `CONTACT-TRACK-TIGHT-001` present (`docx-worker/src/index.js` ~26388-26394). The code legs are all
  in place. **Row 20 stays OWNER-GATED** — its acceptance is one Hard Refresh + CL regen + CV re-export
  eyeballed in a real CloudConvert PDF (esp. leg (a), whose round-2 fix was never proven in a real PDF);
  CI has no signed-in browser or CloudConvert. Re-dated 2026-08-24 (code-confirmed; live legs owed to owner/desktop).
- **Rows 1 / 11 / 16 / 17** — render/probe diags re-run above (all green), re-dated 2026-08-24.
- **Rows 35 / 36 / 37** (OVERLAY-EARLY-HALT / GEN-CORECOMP-BROAD / FOCUS-LABEL-EO) — anchors held by the
  green suite (`pwa/test/unsolicited-corecomp-broad.test.mjs` + both-bundle mirror lock all pass).
  Unchanged since 08-23; live regen-confirm still owed (needs real LLM generation — BLOCKED in CI).

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
- **Register hygiene** (owner decision, carried from 08-21/08-22/08-23) — split `OPEN_REGISTER.md` into
  ACTIVE / CLOSED, or prune closed rows. At ~100 accumulated rows the roll-up is costing diagnosis time
  on already-shipped rows. Recommend the owner decide.

## Nothing shipped by this run
No PWA/worker code changed by the 08-24 CI nightly → no PR, no cache-bust, no version consumed,
nothing owed live-verify FROM tonight beyond the pre-existing signed-in in-browser leg noted above.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
