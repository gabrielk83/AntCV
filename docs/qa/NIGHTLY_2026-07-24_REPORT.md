# AntCV nightly — 2026-07-24 (DESKTOP session, Opus 4.8)

Substrate: desktop Windows worktree (`recursing-mirzakhani-f848a3`), Browser pane +
worker-deploy + live-verify available (the capabilities the CI / GitHub-Actions nightly
lacks). Preflight: main clone DIRTY (owner live work) → worked in this isolated worktree.
SYNC: `git fetch && pull --rebase origin main`; during the run origin/main advanced
`8d43d66 → b85c2a6` (a parallel JOBTRACKER-EMPTY-BAND-CRASH fix) and the shift claim
rebased onto it cleanly. Shift lane claimed: **1.51.3682-1.51.3701** (used 3682).

## Headline — one SOLID verified fix, SHIPPED to main + live-verified in production

**CPH-HEADER-BAND-OVERFLOW-STORM-001 — SHIPPED (`1.51.3682-cph-storm`, on production).**
This was the top open register row: a **default-ON, every-user** preview reflow storm. The
2026-07-24 CI nightly root-caused + fixed it on branch `nightly/cph-header-band-overflow-storm-fix`
(`84ecb083`) but could NOT merge/live-verify (GitHub Actions has no Browser pane, and it
flagged that a headless single-page fixture can't prove the real multi-page + salmon case).
This desktop session closed that gap and landed it.

### What was done
- **Independently re-verified the CI fix** on this machine (headless Chromium): applied the
  branch's `antcv-sidebar-fill-equalize-227.js` guard change (gate on `mainContentH`
  children-bottom, not the stretched `String(mainH)`) → `diag-copenhagen-overflow-storm.mjs`
  band ON **31 writes / 480px drift (main) → 2-3 writes / 30px (fix)**; band OFF unchanged.
- **Added the multi-page + salmon verification the CI could not do** (a genuine 6-heavy-role
  CV, sidebar ≈ 2.7 A4 pages, salmon splitter active, Copenhagen band default-ON):
  **main 35 writes / 526px / sidebar climbs to 3087px (RUNAWAY) → fix 3 writes / 67px /
  sidebar 2562px (CONVERGED, navy fill preserved).** Same fixture on both sidecars, so the
  guard change is provably the converging factor.
- **Row-17 detector corroboration:** `diag-settings-panels-probe.mjs` DIAG **FAIL on main →
  PASS** with the fix (all standard settings panels at rest, 0 mutations).
- **Landed to main** (not a naive branch merge — the branch was cut from an earlier base and
  would have deleted today's CI docs): applied only the sidecar fix + updated repro + a fresh
  cache-bust quintet on top of current main. `app.js` UNTOUCHED, boot-smoke OK, suite
  **1464/1464**, cache-bust gate OK. Quintet → `1.51.3682-cph-storm` (STALE += the previous
  `1.51.3622-stage4-docx`).
- **PRODUCTION LIVE-VERIFY (the owner-asked leg, now done):** `antcv.pages.dev` serves
  TARGET `1.51.3682-cph-storm` + the `mcSig` guard; boots clean (0 console errors). On the
  **real signed-in account** (50 applications, editor view, CV preview rendering, Copenhagen
  band ON) a read-only probe measured **`antcv:mainOverflow` = 0 writes / 0px drift over
  10s** (old build: ~40 writes / hundreds of px). No account mutation — pure observation.

Root cause (confirmed): with the Copenhagen header band (default ON since 1.51.3061), the
equalize LAST/single-row branch extends the sidebar to `mainH`; the page-row grows, `main`
(`align-self:stretch`) re-stretches taller each cycle, so `String(mainH)` is a new value
every pass and the idempotency guard never holds → unbounded climb →
`antcv-main-overflow-detect-364` re-writes localStorage ~4×/s → continuous preview reflow
(PERF-001 class). Gating on the stable CONTENT height converges in every case; the one-time
navy fill is unchanged.

Owner: nothing required. Optional eyeball on your own tab after a Hard Refresh (navy reaches
page bottom, preview no longer churns). Kill switch if ever needed: `antcv:copenhagen-v2=0`.

## Band coverage (priority order)

### Band A — MOBILE & TAB ISOLATION (P0)
- **A1 GEN-BACKGROUND-001 (rows 38/38a):** VERIFY-FIRST, not re-implemented. Confirmed the
  shipped engine is intact + loaded (`antcv-gen-memo.js` + `antcv-gen-job-client.js` both in
  index.html). The A/B (start → background → foreground auto-resume; mid-run reload) needs a
  **real mobile gen** — cannot be produced headlessly. **BLOCKED (needs real device).** No
  flip-default proposal this run (the A/B that would justify it can't run here).
- **A2 leg 1 AUTOSAVE-NO-DOWNGRADE-001:** relay live (`/health` 200), route fail-closed
  (unauth downgrade PUT → 401), `base_rev`-409 guard code present + deployed (relay
  src:3552-3559). The authenticated downgrade A/B needs the owner's Bearer (mutates a real
  account) — **owner-gated.** Client `antcv-app-rev-guard.js` present + loaded.
- **A2 leg 2 PTR-STALE-GUARD-001:** `antcv-pointer-stale-guard.js` present + loaded (intact).
  The same-device stale-pointer two-tab race A/B is owner/device-gated; **code verified
  intact.**
- **A2 leg 3 (row 19 two-real-device):** **BLOCKED — needs a second physical device.**

### Band B/C/D — carried, no regression observed
SO-003 (row 40) SHIPPED 1.51.138; SO-004 (row 41) instrumented, probe waits on a live Android
crash; GEN-LANGFAB-001 (42) SHIPPED 1.51.136; CA-006 (43) SHIPPED 1.51.139;
JD-ANALYSIS-PRINT-001 (44) SHIPPED 1.51.137; PERF-001 (45) PARTIAL; GEN-MODELROLE-001 (39)
VERIFIED-LIVE 2026-07-06. No new evidence contradicts these; last-verified dates stand. (The
CPH storm fixed this run WAS a live PERF-001-class regression — materially reduces row 45's
real-world impact.)

### Band E — STANDING sweeps (every run)
- **Register staleness sweep:** top row advanced SHIPPED (above); ACTIVE_BUGS + OPEN_REGISTER
  top updated. Long tail (verify-first queue) is owner/device/render-gated and unchanged.
- **Settings-panel stability probe:** `diag-settings-panels-probe.mjs` → **DIAG PASS**
  (Personal/Account/Layout all 0 mutations/6s at rest) with the shipped fix. Was FAIL on
  pre-fix main — this run's ship cleared it.
- **Button-audit pass 2:** `diag-panel-button-audit.mjs` → 188 buttons, 116 active, 13
  ui-only, 45 not-visible-or-disabled, **1 DEAD**, 0 page errors. The 45 not-visible = the
  known CJLR-not-hover-gated / dblclick-to-open family (row 23) — unchanged, not a regression.
- **Export/preview parity:** covered green by the suite (1464/1464 incl. role-merge-stored +
  rule-45 inventory). No parity regression.

## Suite / gates
suite `run-tests.mjs pwa` **1464/1464**; boot-smoke `glDemo=function errors=0`; `app.js` head
`(()=>{`, no `"use strict"`, untouched; cache-bust gate OK; parse-gate on all edited JS OK.

## Owner-decision / owner-verify list
- **No owner decision required this run.** (A1 flip-default NOT proposed — the justifying A/B
  needs a real device.)
- Optional owner live-verify: none blocking (the CPH storm was already production-live-verified
  here). A1 mobile-gen A/B, A2 authenticated downgrade A/B, and the two-real-device test remain
  device/owner-gated.

## Model attribution
All tasks this run: Opus 4.8 (desktop session). No subagents/parallel models fanned (single
solid fix + verifies; integration + deploy kept serial per hard rules).
