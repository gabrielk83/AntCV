# AntCV nightly — 2026-08-01 (DESKTOP, unattended, Opus 4.8, worktree-isolated)

Substrate: desktop clone `C:\Users\karpg\GitHub\AntCV`. Preflight found the clone **DIRTY**
(the owner's `PANEL_BUTTON_AUDIT_2026-07-31.*` WIP) → per STANDING RULE 0 all work done in an
isolated worktree (`determined-cannon-8d4c64`), never editing/rebasing the dirty clone.
**SYNC FIRST:** `git fetch && pull --rebase origin main` clean, base HEAD `7ed22c1`. No shift claim
(no versioned PWA/worker change — the one fix is a standalone test-infra file).

## Headline

A **CI sweep already ran earlier today** (`7ed22c1`, "CI SWEEP 2026-08-01") on byte-identical code and
found the whole surface green. `git diff --stat 988bb0e6..HEAD` over `pwa/app.js`, `pwa/app.src.js`,
`workers/**`, `.github/` is **empty** — production surface is byte-identical to the 07-31 desktop-attested
state. This desktop run adds **desktop-side confirmation of the probe battery + live attest + one
verified test-infra de-flake** (DIAG-CPH-STORM-DRIFT-FLAKE-001). **No product code merged.**

## The one fix — DIAG-CPH-STORM-DRIFT-FLAKE-001 (test-infra, no version/deploy)

The standing render probe `pwa/test/diag-copenhagen-overflow-storm.mjs` **false-FAILed on the first
desktop run**: ON writes=3 / drift=**945px**, OFF writes=2 / drift=**915px**. A second run on the same
commit read ON 15px / OFF 0px (PASS) → flaky, not a regression (code byte-identical to the CI-green
bundle).

- **Root cause:** `drift = u[last] - u[0]`; `u[0]` captures a mount-time / pre-layout transient
  `usablePx` that swings hundreds of px between runs (desktop first-write lands pre-layout, CI/warm
  lands settled).
- **Proof it was not a band storm:** (1) the **write count** — the diag's own decisive anti-storm
  signal (a real climb = 35 writes; 364 emits one write per distinct usablePx) — stayed bounded at
  **1-3** every run; (2) OFF (band killed) showed the SAME ~915px drift as ON → killing the band did
  not remove the drift.
- **Fix:** measure drift over the settled tail (`u.slice(1)`), excluding the single leading mount
  transient; the write-count bound is untouched (a real 35-write / 435px+ runaway still fails it AND
  shows a large tail drift → detection not weakened).
- **Verified:** stable **PASS ×3** (ON 2-3 writes / 0-30px = documented healthy one-time mount-settle,
  OFF 1-2 / 0); `node --check` clean; standalone diag (not in `run-tests.mjs`) → suite unaffected.

## Standing probes — GREEN on desktop (base `7ed22c1`, PWA `1.51.4046-company-retry`)
- **PWA suite:** `node scripts/run-tests.mjs pwa` → **1570/1570 pass**, 0 fail (~15s).
- **app.js integrity:** head `(()=>{window`, **0** `"use strict"`.
- **Code delta since CI base `988bb0e6`:** empty over app.js / app.src.js / workers / .github.
- **docx render V&V** (`node scripts/run-docx-diags.mjs`): **50/50**.

## Render-gated diags (Playwright, desktop) — GREEN / no regression
- **Copenhagen overflow-storm** (row 1 dependency): **DIAG PASS ×3 after the de-flake** (ON 2-3 writes /
  0-30px, OFF 1-2 / 0). Before the fix it false-FAILed once (see above).
- **Settings-panels probe** (row 17): **DIAG PASS** (Layout 0 mut/6s, rootFound=true, 0 page errors).
- **Sidebar-stable** (row 11): **OK** (width/height stable across 12 scrolls, ≤2 style writes, 0 errors).
- **Sidebar-promote-margin** (row 11): **OK** (hold-under-margin true across one-row + whole-group removal).
- **Panel button-audit** (row 23): **215 buttons / 0 page errors / 0 THROWS / 136 active** (14
  skipped-dangerous, 13 ui-only, 52 not-visible/disabled). Record `PANEL_BUTTON_AUDIT_2026-08-01.*`
  (desktop re-run; 208→215 vs CI = expected React-remount enumeration variance on identical bytes).

## LIVE ATTEST — PWA + all four workers, all readable, all match repo source

| Surface | Live `/health` (or CACHE) | In-repo source | Match |
|---|---|---|---|
| PWA (`antcv.pages.dev` `sw.js` CACHE) | `antcv-1.51.4046-company-retry` | seed + TARGET `1.51.4046-company-retry` | ✅ |
| access-relay (`antcv-access-relay.*`) | `auth-37-cap-disposable-only` | `RELAY_VERSION` same | ✅ |
| cv-proxy (`cv-proxy.*`) | `3.8.4-brand-ink-match` | `VERSION` same | ✅ |
| demo-proxy (`antcv-demo-proxy.*`) | `3.8.4-brand-ink-match` | `VERSION` same | ✅ |
| docx-worker (`docx-worker.*`) | `1.14.174-appline-edit` | `src/index.js VERSION` same | ✅ |

1042 hostname trap stays resolved (prefixed `antcv-` hosts for access-relay/demo-proxy). No worker
drift, no PWA version regression. Cosmetic (unchanged, low value): `antcv-demo-proxy` `/health` JSON
self-reports `"service":"cv-proxy"` (shared-code label; version string authoritative).

## Register coverage this run (full-coverage: every open row has a status word)
- **Row 1** (page convergence) — verified 2026-08-01: empty code delta + all render diags green + live
  attest; render/owner-gated, held OPEN. Advanced.
- **Row 3** (floating spine) — verified 2026-08-01: flag default-OFF re-confirmed (docx-worker:24668 +
  docx-client:1253 line refs stable, gate logic intact). Advanced.
- **Rows 11 / 17 / 23** — desktop diags re-run green tonight (sidebar-stable + promote-margin OK,
  settings-panels PASS, button-audit 0 errors/0 throws). Held/refreshed.
- **Rows 35 / 36 / 37** — already reconciled to 2026-08-01 by today's CI sweep (guard tests green). Held.
- **Rows 2 / 6 / 8 / 16 / 18 / 19 / 20 / 22 / 24-32 etc.** — no new signal; owner-gated / needs a
  signed-in gen / needs live models / needs a 2nd physical device / render-owed. None newly actionable
  from an unattended desktop run (login gate blocks a signed-in Preview/gen session).
- **NEW:** DIAG-CPH-STORM-DRIFT-FLAKE-001 — filed + fixed this run (ACTIVE_BUGS top block).

## Owed (cannot be done unattended on desktop)
- **DIAG-SALMON-EMPTY-REGION-STALE-001 / SALMON-MAIN-LENGTH-001** — render-owed; needs the in-app
  Preview pane with a loaded CV, which the unattended Google/OTP login gate blocks.
- **SO-004 (row 41) crash capture + PERF-001 (row 45) cloud-sync profiling** — need a live signed-in
  session.
- **GEN-BACKGROUND-001 mobile A/B (row 38) + JD-SCOPE two-real-device test (row 19)** — need a real
  phone / a 2nd physical device.
- **Worker deploys:** none owed — all four match source.

## Bands (07-05 plan) status this run
- **Band A (mobile/tab isolation):** A1 GEN-BACKGROUND shipped end-to-end, mobile A/B needs a real
  device (owner-gated). A2 relay AUTOSAVE-NO-DOWNGRADE + PTR-STALE-GUARD shipped; live same-device
  A/B needs a signed-in session. No unattended progress possible.
- **Band B (data-loss/crash):** SO-003/SO-004 have no headless repro; need a live session.
- **Band C (content):** GEN-LANGFAB / CA-006 / JD-ANALYSIS-PRINT need live-model fresh gens (spec rule 38).
- **Band D (perf/design):** PERF-001 needs profiling; GEN-MODELROLE env verified live in prior runs.
- **Band E (standing):** DONE this run — settings-panel + button-audit + sidebar + copenhagen-storm +
  docx V&V all desktop-confirmed green; one test-infra reliability fix shipped.

No product code merged to `main`: this run pushes only docs/registers (this report, the OPEN_REGISTER
+ ACTIVE_BUGS edits, the button-audit record) and the standalone diag de-flake.
