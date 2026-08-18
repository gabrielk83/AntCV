# AntCV CI NIGHTLY — 2026-08-18 (GitHub Actions, unattended, Opus 4.8)

**Mode:** verify + attest + reconcile + REGISTER unlogged landed changes. **NO code shipped to
main, no PR.** `ALLOW_DEPLOY=false` (worker deploys not attempted). Repo `gabrielk83/AntCV`.

## Base
- SYNC clean: `git fetch && git pull --rebase origin main` → already up to date.
- HEAD `81692931` — release `1.51.4286-1.51.4305` (PWA CACHE/TARGET `1.51.4286-years-guard`).
- Tree clean.

## Not a quiet night — three owner-shipped commits since the 08-17 desktop report (`388dbc45`)
`git diff --stat 388dbc45..HEAD -- pwa/ workers/ .github/` = 9 files (all `pwa/`, no `workers/`, no
`.github/`):

| Commit | ID | Version | Author |
|---|---|---|---|
| `ba898b17` | SECTIONS-EMPTY-TEMPLATE-FLOOR-001 | 1.51.4246-template-floor | owner (Fable 5) |
| `e93d2940` | CL-GREETING-001 | 1.51.4266-cl-greeting | owner (Fable 5) |
| `674bd2ad` | YEARS-GUARD-001 | 1.51.4286-years-guard | owner (Fable 5) |

All three were shipped directly by the owner with green suites. My CI job was to VERIFY them, attest
they reached browsers, and close the registration gap (two of the three were never logged in the
canonical registers). No re-implementation, no PR — these are owner-authored, already live.

## Verification — GREEN
- **PWA suite `node scripts/run-tests.mjs pwa`: 1574/1574** (0 fail, 0 skip) — up +4 from the 1570
  baseline = the new `pwa/test/unit/years-guard.test.mjs` (4 tests, all pass).
- **Full repo: 1897/1897** (0 fail).
- `pwa/app.js`: head `(()=>{window` · **0** `"use strict"` · `node --check` OK.
- **boot-smoke OK** — `glDemo=function, errors=0` (chromium installed this run) → HEAD boots past sign-in.
- **Cache-bust gate `388dbc45..HEAD`: OK** — all 4 changed loaded assets got a `?v` bump.
  - app.js?v + ANTCV_VERSION seed at `1.51.4266-cl-greeting`; sw.js CACHE + version-override
    TARGET_VERSION at `1.51.4286-years-guard`. This split is the documented
    **SEED-VS-TARGET-VERSION-NONBUG** pattern: YEARS-GUARD-001 added a NEW sidecar
    (`antcv-years-guard.js`) + version-override + sw CACHE bump but did NOT touch `app.js`, so
    app.js?v/seed correctly stayed at cl-greeting (its last change). NOT a bug.

## Render-gated Playwright diags — RE-RUN GREEN
- copenhagen-overflow-storm: **DIAG PASS** (ON 2 writes / 0px drift / 0 err; OFF 1 write / 0px / 0 err).
- settings-panels-probe: **DIAG PASS** (Personal / Account / Layout each 0 mutations/6s, rootFound=true, 0 page errors).
- sidebar-stable: **OK** (0 writes / 12 scrolls / width stable / heightConverged / 0 err).
- sidebar-promote-margin: **OK** (hold-under-margin true).
- panel-button-audit: **208 buttons / 0 page errors** / 132 active / 14 skipped-dangerous / 17 ui-only
  / 45 not-visible-or-disabled. Artifacts: `docs/qa/PANEL_BUTTON_AUDIT_2026-08-18.{json,md}`.

## Live attest
- **PWA MATCH:** `antcv.pages.dev/sw.js` CACHE = `antcv-1.51.4286-years-guard` == repo HEAD, and
  `antcv-years-guard.js?v=1.51.4286-years-guard` fetches **HTTP 200** from the live origin — the
  latest push is deployed and the changed `?v` reaches browsers. (`/index.html` returns 0 bytes
  because Cloudflare Pages serves the document at `/`, not `/index.html` — not a defect; sw.js +
  sidecar reads are the authoritative live signal.)
- **Worker live-attest BLOCKED in CI.** The `*.workers.dev` `/health` hosts return HTTP 000 from the
  CI sandbox (while `antcv.pages.dev` and GitHub return 200), so the 4 worker surfaces
  (access-relay, cv-proxy, demo-proxy, docx-worker) could not be read live tonight. **No worker code
  changed this run** → nothing is undeployed; a routine desktop live-attest of the 4 workers is owed.

## Registered tonight (the shipping commits skipped the canonical logs)
- **ACTIVE_BUGS.md** (top block): added `YEARS-GUARD-001` and `CL-GREETING-001` as DONE/SHIPPED +
  VERIFIED entries with tonight's verification evidence.
- **FEATURES_REGISTRY.md**: added `FT-CL-GREETING` as increment **39** (Last updated 2026-08-18).
- **OPEN_REGISTER.md**: prepended this run's summary line.
- (SECTIONS-EMPTY-TEMPLATE-FLOOR-001 was already logged in ACTIVE_BUGS by the shipping session.)

## Owed / carried OPEN (all owner-side unless noted)
- **CL-GREETING-001 fresh-generation content check** — an actual generated CL opening with the
  greeting; BLOCKED in CI (no live models, no signed-in browser). Owed to a live-model / desktop run.
- **Worker live-attest of the 4 surfaces** — owed to a desktop run (CI sandbox can't reach workers.dev).
- **SECTIONS-EMPTY-TEMPLATE-FLOOR-001** — app #3485 (Shure) still needs one in-app regeneration to
  fill its row (owner; opens on the structured template now, not blank).
- **CI-CF-TOKEN-EXPIRED-001** — rotate the GitHub-Actions `CLOUDFLARE_API_TOKEN` (CF auth error
  10000); worker deploys are desktop-only until then.
- **ANTCV-TOKEN-EXPIRED-2026-08-14-001** — re-save `~/.antcv/token` (mtime 08-07, expired 08-14);
  blocks position-discovery + job-tracker + all relay/gen live checks.
- **Cloudflare D1 MCP connector** — reconnect (invalidated); blocks GEN-MODELROLE live `llm_calls`
  routing verification.
- **LLM-TRAFFIC-GAP-2026-08 / RELAY-TUNE-COVERAGE-GAP-001** — no LLM traffic since 07-30; no
  fresh-gen content check possible; the relay cost-quality tune remains blind.
- **DIAG-CORE-COMP-COMPRESS-STALE-001** — OPEN test-infra only (stale diag seeds the pre-migration
  `core_comp` shape); product covered green by the two core-comp-compress unit tests. Not re-run.
- Row 19 two-real-device test — needs a physical second device (owner).

## E1 staleness sweep
Rows 1/3/11/17/23 re-verified GREEN against this HEAD (render / settings / sidebar / button diags all
PASS tonight). Rows 35/36/37 carry no new drift (code surface unchanged bar the three owner commits,
which are covered by the 1574 suite + boot-smoke). Every open row has a status word for this run.

## Bottom line
HEAD is healthy and live: suite 1574/1574, boot-smoke clean, latest push deployed to
`antcv.pages.dev`. Two owner-shipped changes that had slipped the canonical registers are now logged.
No code shipped by this run; no PR owed (no unverified worker/app defect found). Worker live-attest
and the CL-greeting fresh-gen content check are owed to a desktop / live-model run.
