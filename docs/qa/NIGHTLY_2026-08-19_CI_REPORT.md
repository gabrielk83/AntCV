# AntCV CI NIGHTLY — 2026-08-19 (GitHub Actions, unattended, Opus 4.8)

**Mode:** verify + attest + reconcile. **NO code shipped to main, no PR.** `ALLOW_DEPLOY=false`
(worker deploys not attempted). Repo `gabrielk83/AntCV`.

## Base
- SYNC clean: `git fetch && git pull --rebase origin main` → already up to date.
- HEAD `5e8e8e92` — release `1.51.4306-demand-seed-refresh` (PWA CACHE/TARGET).
- Tree clean.

## Delta since the 08-18 CI report (`57c65b19`) — all already registered + deployed
`git log 57c65b19..HEAD` = 7 commits; the code/data touches were landed by the weekly demand-seed
routine and the job-tracker nightly, both already self-registered:

| Commit | What | Surface | Registered? |
|---|---|---|---|
| `1cbd0828` | demand-seed weekly cluster refresh → `1.51.4306` | `pwa/antcv-cluster-demand.js` (+ quintet) | yes (`f124262c` row 9 + session log) |
| `35628001` | corrected the demand-seed routine's step-4 doc | `SCHEDULED_ROUTINES.md` | yes (docs) |
| `5e8e8e92` | gen-runner cut-integrity + transport resilience | `scripts/job-tracker/gen-runner.py` | yes (ACTIVE_BUGS + FEATURES + OPEN_REGISTER) |

**No `app.js` / `app.src.js` / `workers/**` / `.github/**` delta since the last CI report.** The only
PWA-asset change was the demand-seed data sidecar refresh, which carried a correct cache-bust quintet.

## Verification — GREEN
- **PWA suite `node scripts/run-tests.mjs pwa`: 1574/1574** (0 fail, 0 skip).
- **Full repo `node scripts/run-tests.mjs`: 1897/1897** (0 fail).
- `pwa/app.js`: `startsWith("(()=>{")` **true** · **0** `"use strict"` · `node --check` OK · 1,116,417 bytes.
- **boot-smoke OK** — `glDemo=function, errors=0` (Chromium installed this run) → HEAD boots past sign-in.
- **Cache-bust gate `81692931..HEAD`: OK** — all changed loaded assets got a `?v` bump.
  - Note: ANTCV_VERSION seed = `1.51.4266-cl-greeting` while TARGET/CACHE = `1.51.4306-demand-seed-refresh`.
    This is the documented **SEED-VS-TARGET-VERSION-NONBUG**: the demand-seed refresh touched only the
    `antcv-cluster-demand.js` sidecar, not `app.js`, so the seed correctly stayed at its last app.js
    change (cl-greeting). Not a bug.

## Render-gated Playwright diags — RE-RUN GREEN
- copenhagen-overflow-storm: **DIAG PASS** (ON 2 writes / 0px drift / 0 err; OFF 1 write / 0px / 0 err).
- settings-panels-probe: **DIAG PASS** (Account / Layout each 0 mutations/6s, rootFound=true, 0 page errors).
- sidebar-stable: **OK** (0 writes / 12 scrolls / width 262.02px stable / heightConverged / 0 err).
- panel-button-audit (E3): **NOT RUN** — exceeds the 2-min CI tool budget (killed at 120s). The recent
  `PANEL_BUTTON_AUDIT_2026-08-18.{json,md}` desktop artifact stands; a desktop re-run owns pass 2.

## Live attest — PWA + all 4 workers reachable this run
- **PWA MATCH:** `antcv.pages.dev/sw.js` CACHE = `antcv-1.51.4306-demand-seed-refresh` == repo HEAD,
  and `antcv-cluster-demand.js?v=1.51.4306-demand-seed-refresh` fetches **HTTP 200** live — the latest
  push is deployed and the changed `?v` reaches browsers.
- **Workers ALL LIVE (unlike 08-18's HTTP 000):** `/health` = **200** for access-relay, cv-proxy,
  demo-proxy, and docx-worker (`*.karp-gabriel-a.workers.dev`). No worker code changed this run →
  nothing undeployed; this is a clean live confirmation of the four surfaces.

## E1 staleness sweep — the 3 stalest tracked rows (35/36/37, were verified 2026-08-01)
All three are regen-confirm items whose live confirmation needs a real LLM generation (BLOCKED in CI).
Statically reconfirmed against HEAD and re-dated to 2026-08-19:
- **Row 35 OVERLAY-EARLY-HALT-001** — heartbeat-gate watchdog `KERNEL-STUCK-LAST-CMD-001` present &
  intact at `app.src.js:32323` (`__antcvGenCost` heartbeat, idle + total-ceiling gate). Shipped code
  in place; live regen-confirm owed.
- **Row 36 GEN-CORECOMP-BROAD-001** — broad core_comp rule present INSIDE the unsolicited `__neutralCo`
  block, niche EO/photonics examples confined to the name-guarded Gabriel pin; 3 guard tests green in
  the 1574 suite. Live regen-confirm owed.
- **Row 37 FOCUS-LABEL-EO-001** — `FOCUS-LABELS-001` compact-label prompt rule present at
  `app.src.js:4076`. Live regen-confirm owed.

Row 9 (verified 2026-07-07, the numerically oldest) is already **CLOSED 2026-07-13 (in production)** —
its stale date is cosmetic, not open work.

## Owed / carried OPEN (all owner-side unless noted)
- **Rows 35/36/37 fresh-generation content check** — need a live-model generation; BLOCKED in CI.
- **panel-button-audit pass 2 (row 23)** — exceeds CI tool budget; owed to a desktop run.
- **CI-CF-TOKEN-EXPIRED-001** — rotate the GitHub-Actions `CLOUDFLARE_API_TOKEN`; worker deploys are
  desktop-only until then (`ALLOW_DEPLOY=false` this run regardless).
- **ANTCV-TOKEN-EXPIRED-2026-08-14-001** — re-save `~/.antcv/token` (expired 08-14); blocks
  position-discovery + job-tracker + all relay/gen live checks.
- **LLM-TRAFFIC-GAP-2026-08 / RELAY-TUNE-COVERAGE-GAP-001** — no LLM traffic recently; the relay
  cost-quality tune remains blind, no fresh-gen content check possible.
- **CAP-AMPUTATED-ENUMERATION-002** — OPEN (filed 08-18 job-tracker nightly); the hard-cap cutter can
  silently drop list items mid-enumeration. Not touched this run (`gen-runner.py`, non-PWA).
- Row 19 two-real-device test — needs a physical second device (owner).

## Bottom line
HEAD is healthy and live: suite 1574/1574 + full-repo 1897/1897, boot-smoke clean, all three standing
render diags PASS, latest push deployed to `antcv.pages.dev`, and all four workers answering `/health`
200. No code shipped by this run; no PR owed (no unverified worker/app defect found). Every landed
change since the last CI report was already registered by its own routine. The 3 stalest register rows
were statically reconfirmed and re-dated; their live regen-confirm and the panel-button-audit pass 2
are owed to a live-model / desktop run.
