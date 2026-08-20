# AntCV CI NIGHTLY — 2026-08-20 (GitHub Actions, unattended, Opus 4.8)

**Mode:** verify + attest + reconcile. **NO code shipped to main, no PR.** `ALLOW_DEPLOY=false`
(worker deploys not attempted). Repo `gabrielk83/AntCV`.

## Base
- SYNC clean: `git fetch && git pull --rebase origin main` → already up to date.
- HEAD `02f0fbde` — release `1.51.4326-claude-rate` (PWA CACHE/TARGET).
- Tree clean.

## Delta since the 08-19 CI report (`024a5de5`) — all already registered + deployed
`git log 024a5de5..HEAD` = 3 commits; the one code touch was landed by the **08-19 DESKTOP
nightly (Opus 5)**, already self-registered:

| Commit | What | Surface | Registered? |
|---|---|---|---|
| `d992c768` | shift claim 1.51.4326-1.51.4345 | `NIGHT_SHIFT.md` | yes (ledger) |
| `04ebfaf4` | **LLM-COST-CLAUDE-RATE-001** — client cost meter's rate map keyed `anthropic` while telemetry logs `claude`, so every claude call fell to the `{10,30}` fallback and priced 3.04x too high; added `claude` alias key at $3/$15 in both bundles + guard test | `pwa/app.js` + `app.src.js` + quintet, `pwa/test/llm-cost-provider-rates.test.mjs` | yes (ACTIVE_BUGS + OPEN_REGISTER + desktop report) |
| `02f0fbde` | release ledger tidy | `NIGHT_SHIFT.md` | yes (ledger) |

**`app.js`/`app.src.js` DID change this cycle** (the llm-cost fix) → full app.js re-verification run
below (boot-smoke + invariants + render diags), unlike a zero-delta night.

## Verification — GREEN
- **PWA suite `node scripts/run-tests.mjs pwa`: 1591/1591** (0 fail, 0 skip) — up from 1574 (the
  17-check `llm-cost-provider-rates.test.mjs` landed with the desktop fix).
- **Full repo `node scripts/run-tests.mjs`: 1914/1914** (0 fail) — includes docx render V&V + worker tests.
- `pwa/app.js`: `startsWith("(()=>{")` **true** · **0** `"use strict"` · `node --check` OK · 1,116,454 bytes.
- **boot-smoke OK** — `glDemo=function, errors=0` (Chromium installed this run) → HEAD boots past sign-in.
- **Cache-bust gate `5e8e8e92..HEAD`: OK** — all 2 changed loaded assets got a `?v` bump.
  - ANTCV_VERSION seed, TARGET, CACHE all = `1.51.4326-claude-rate` this cycle (the llm-cost fix DID
    touch app.js, so the seed advanced with it — no SEED-VS-TARGET split this time).

## Render-gated Playwright diags — RE-RUN GREEN (app.js changed → all re-run)
- copenhagen-overflow-storm: **DIAG PASS** (ON 2 writes / 0px usablePx-drift / 0 err; OFF 1 write / 0px / 0 err).
- settings-panels-probe: **DIAG PASS** (Account / Layout each 0 mutations/6s, rootFound=true, 0 page errors).
- sidebar-stable: **OK** (0 writes / 12 scrolls / width 262.02px stable / heightConverged / 0 err).
- panel-button-audit (E3): **NOT RUN** — exceeds the 2-min CI tool budget. The `PANEL_BUTTON_AUDIT_2026-08-19`
  desktop artifact stands; a desktop re-run owns pass 2.

## Live attest — PWA + all 4 production workers reachable this run
- **PWA MATCH:** `antcv.pages.dev/sw.js` CACHE = `antcv-1.51.4326-claude-rate` == repo HEAD, and
  `app.js?v=1.51.4326-claude-rate` fetches **HTTP 200** live — the latest push is deployed and the
  changed `?v` (the claude-rate fix) reaches browsers.
- **Workers ALL LIVE** `/health` = **200**: `antcv-access-relay`, `cv-proxy`, `antcv-demo-proxy`,
  `docx-worker` (all on `*.karp-gabriel-a.workers.dev`). No worker code changed → nothing undeployed.
  - **NOTE (hostname correction):** the *production* relay/demo hostnames carry an `antcv-` prefix
    (`antcv-access-relay`, `antcv-demo-proxy`) — the bare `access-relay`/`demo-proxy` names are NOT
    the deployed workers (they return CF `error 1042`). Future CI probes must use the prefixed names
    (grep `pwa/` for the `karp-gabriel-a.workers.dev` hosts).

## New observation (benign, no action owed)
- **C2PA-WORKER-DORMANT-001 (INFO, not a defect):** `c2pa-worker.karp-gabriel-a.workers.dev`
  returns HTTP 404 / CF `error 1042` (workers.dev route not serving). This is **not** a production
  regression: `ANTCV_C2PA_WORKER` is **never set in `pwa/index.html`**, and the only reference
  (`antcv-privacy-led.js`) reads it defensively in a try/catch — the PWA never actually calls the
  C2PA signer. C2PA signing is a dormant/unconfigured feature. Recorded so a future run doesn't
  re-flag it as a worker outage; owner can ignore unless/until C2PA is wired up.

## E1 staleness sweep — the stalest tracked open rows (app.js changed → re-verify, not just re-date)
- **Row 3 (float-spine) — RE-VERIFIED GREEN, was 08-15.** Flag default-OFF intact against current
  source: `workers/docx-worker/src/index.js:24674` `floatSpine = payload.float_spine===true || style.floatSpine===true`;
  `pwa/antcv-docx-client.js:1253` gated on `localStorage antcv:float-spine==='1'`. Gate logic intact.
- **Row 1 (page/CV convergence, export-only parity) — RE-VERIFIED GREEN, was 08-16.** Browser-
  independent subset: docx render V&V + full suite 1914/1914, app.js head `(()=>{`/0 `"use strict"`,
  copenhagen-overflow-storm render diag PASS, boot-smoke OK, live PWA `1.51.4326` == repo source.
- **Rows 35/36/37 (regen-confirm) — anchors RECONFIRMED on current source** (the llm-cost fix shifted
  line numbers ~10 lines but the code is intact): Row 35 `KERNEL-STUCK-LAST-CMD-001`/`OVERLAY-EARLY-HALT-001`
  heartbeat watchdog at `app.src.js:32333/32340/32348`; Row 36 broad core_comp inside `__neutralCo`
  (`app.src.js:27137/27418`) + guard test `unsolicited-corecomp-broad.test.mjs` green in suite; Row 37
  `FOCUS-LABELS-001` at `app.src.js:4086`. All three still need a **live-model regen** to content-confirm
  (BLOCKED in CI). Re-dated 2026-08-20.
- **Row 9** — already **CLOSED 2026-07-13 (in production)**; its 2026-07-07 verified date is cosmetic,
  not open work. Left as-is.

## Owed / carried OPEN (all owner-side unless noted)
- **Rows 35/36/37 fresh-generation content check** — need a live-model generation; BLOCKED in CI.
- **panel-button-audit pass 2 (row 23)** — exceeds CI tool budget; owed to a desktop run.
- **post-deploy live-verify** for the 08-19 desktop LLM-COST-CLAUDE-RATE-001 ship — the code marker
  is confirmed in the *built live bundle* (app.js?v=…-claude-rate = 200), but a signed-in in-app
  Browser-pane confirm of the cost meter showing $3/$15 for a claude call is owed to a desktop run.
- **CI-CF-TOKEN-EXPIRED-001** — rotate the GitHub-Actions `CLOUDFLARE_API_TOKEN`; worker deploys are
  desktop-only until then (`ALLOW_DEPLOY=false` this run regardless).
- **ANTCV-TOKEN-EXPIRED-2026-08-14-001** — re-save `~/.antcv/token` (expired 08-14); blocks
  position-discovery + job-tracker + all relay/gen live checks.
- **LLM-TRAFFIC-GAP-2026-08 / RELAY-TUNE-COVERAGE-GAP-001** — no recent LLM traffic; relay
  cost-quality tune blind, no fresh-gen content check possible.
- **CAP-AMPUTATED-ENUMERATION-002** — OPEN (filed 08-18); hard-cap cutter can drop list items
  mid-enumeration (`gen-runner.py`, non-PWA). Not touched this run.
- Row 19 two-real-device test — needs a physical second device (owner).

## Bottom line
HEAD is healthy and live: PWA suite 1591/1591 + full-repo 1914/1914, boot-smoke clean, all three
standing render diags PASS, latest push (`1.51.4326-claude-rate`) deployed to `antcv.pages.dev` with
the changed `?v` reaching browsers, and all four production workers answering `/health` 200. No code
shipped by this run; no PR owed (no unverified worker/app defect found — the only code delta since the
last CI report was the 08-19 desktop llm-cost fix, already registered, deployed, and now live-attested).
E1 re-verified the two stalest tracked rows (1, 3) against the changed HEAD and reconfirmed the
35/36/37 anchors; one benign observation logged (C2PA-WORKER-DORMANT-001). Live regen-confirm and the
panel-button-audit pass 2 remain owed to a live-model / desktop run.
