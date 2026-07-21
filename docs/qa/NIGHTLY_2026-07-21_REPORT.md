# AntCV Nightly Report — 2026-07-21 (Opus 4.8)

**Outcome:** verify-first sweep + rule-7 docs reconcile of the P0 preview-freeze fix. **No code shipped** (the freeze fix is the day session's active lane — verified live, not re-implemented). All standing probes green; register fully swept.

Baseline: PWA `1.51.1644-compl-selflimit` (day sessions shipped `1.51.1576→1644` since the 07-19 sweep at 1558). `git fetch && pull --rebase origin main` clean — main in sync.

## Standing probes — all green (no regression)

| Probe | Result |
|---|---|
| PWA suite (`node scripts/run-tests.mjs pwa`) | **1323 / 1323**, 0 fail (~28s) |
| boot-smoke (`node pwa/test/boot-smoke.mjs`) | OK — glDemo=function, 0 errors |
| Personal-panel probe (`diag-personal-panel-probe.mjs`) | **DIAG PASS** — 0 mut / 8s, 0 page errors |
| button-audit (`diag-panel-button-audit.mjs`) | **190 buttons / 0 page errors / 0 DEAD / 0 throws** — 110 active, 51 not-visible/disabled, 12 skipped-dangerous, 17 ui-only |
| `app.js` head | `(()=>{window` — no `"use strict"`, minified-sacred intact (app.js NOT touched by any 1558→1644 commit) |

## Live-verify (PWA layer, curl to pages.dev)

- Live ANTCV_VERSION seed = TARGET `1.51.1644-compl-selflimit` — **no version regression / no stale-SW mask**.
- Live index.html references `antcv-sections-normalize-415.js?v=1.51.1644-compl-selflimit`.
- **The served sidecar at that `?v` contains the oscillation guard** (`grep "oscillation held"` = 1) → the P0 freeze fix is deployed + served.
- Cache-bust quintet fully consistent at 1644 (index.html normalize-415 `?v` + ANTCV_VERSION seed + `sw.js` CACHE + TARGET_VERSION + version-override own `?v`).
- STALE_VERSIONS invariant held: `1.51.1624-storm-osc-guard` + `1.51.1604-align-storm-001` in STALE, current 1644 only as TARGET.
- Worker `/health` live-attest still **BLOCKED** (unchanged env gate: shell DNS-gated to `*.workers.dev`; Browser pane denies the un-approved origin non-interactively + CORS). Worker layer no-drift vs 07-19 (no dispatch since).

## The reconcile — STORM-OSCILLATION-GUARD + ALIGN-STORM (rule-7 gap closed)

The P0 **"CV preview page-2 oscillation + freeze"** (owner live-diagnosed 07-19/20) shipped across three day-session legs and was documented **nowhere in `docs/`** (only commit messages, no dedicated unit test). Registered this run in ACTIVE_BUGS (top) + OPEN_REGISTER (2026-07-21 sweep) + FEATURES_REGISTRY (29). Verify-first — this is the day session's active lane, **not re-implemented**:

1. **ALIGN-STORM-001** (`1.51.1604`, 77dec1b/248e3c7): the freeze + certs/interests alignment jumpiness was a text-align write storm — ~200 writes/s (5054 mutations + 68 long-tasks / 25s) from three CJLR alignment sidecars fighting the same cells. `core-comp-234` observed `style` while writing `textAlign` (self-feedback); `antcv-item-align.js` had an untethered body observer (throttled to ≥300ms); `antcv-section-align.js` wrote `core_comp` to a different value than 234 (deferred `core_comp` to its owner). Halved the storm — root was upstream.
2. **STORM-OSCILLATION-GUARD-001** (`1.51.1624`, 0a020c6): the root — `antcv-sections-normalize-415` ping-pongs with a competing writer. `roleCanonTitles` shortens a title → `_samePosition` misses its PI source → `repairExperienceCompleteness` restores a HIDDEN role → `dropCanonHiddenDups`/competitor strips it → dispatch `antcv:sections-updated` → full re-render → align storm. Fix (`normalize-415.js:2049`): refuse to WRITE a serialised `sections` already written within ~4s; STORM-IDEMPOTENT companion keeps a true no-op silent.
3. **add-side** (`1.51.1644`, fe3ecdc): the guard fired (`oscillation held`) but the competitor produced a slightly-different `sections` each cycle, dodging the recent-writes dedup. Fix (`normalize-415.js:1242`): self-limit `repairExperienceCompleteness` — suppress the restore once the identical missing-role signature (`id|title|company`) recurs 3×/6s. Restored roles are HIDDEN (`on:false`) — a recover-in-one-click safety net, not visible content — so it is safe to stop re-adding; a genuine new missing set resets the counter.

## New finding — STORM-GUARD-TEST-COVERAGE-001 (low-pri, NOT actioned)

The two P0 freeze guards are `Date.now()`-window runtime guards in the sidecar IIFE observer and ship with **no dedicated unit test** (suite count unchanged 1323→1323; `diag-rerender-storm.mjs` + `unit/sections-normalize-idempotent.test.mjs` don't pin the new windows). A future refactor could silently drop the <4s recent-write dedup or the 3-identical-restore self-limit and the freeze would return **undetected by CI**. Recommend a `diag-rerender-storm` assertion or a normalize-415 unit test that drives the churn signature. Not fixed here — the day session owns this churning lane (add-side landed the same day); a speculative test on unsettled code risks immediate staleness/conflict.

## Also undocumented (day-session rule-7 gaps — flagged, not registered in detail)

Their own lane's next reconcile: MANUAL-SAVE-CATEGORY-001 (`1.51.1576`, 5b41fe9), AUTO-COMMIT-FRESHEST-001 (`1.51.1580`, 51c9b77), Application-History file-number display (`1.51.1584`, afb5e3b).

## Per-band status (unchanged from 07-19)

- **A1** GEN-BACKGROUND (38/38a): engine+sidecar live-served; flip-default **BLOCKED** (real mobile foreground gen A/B).
- **A2** tab/device isolation (39a): legs 1+2 verified; leg 3 (19) **BLOCKED** (2nd physical device).
- **B** SO-003 (40) shipped/suite-covered; SO-004 (41) **BLOCKED** (real-Android crash capture).
- **C** GEN-LANGFAB (42) live-served; CA-006 (43) / JD-ANALYSIS-PRINT (44) shipped/suite-covered.
- **D** PERF-001 (45) **OPEN** (single-owner cloud-sync profiling, no clean repro, no speculative edit); GEN-MODELROLE (39) config-shipped.
- Rows 93/94 SHIPPED+LIVE (owner eyeball owed).

No row implemented-but-still-open; no code shipped by this nightly.

## Owner-decision / owner-verify list (carried)

- **A1 flip-default:** needs a real mobile foreground-gen A/B before proposing the one-line default flip.
- **2nd physical device:** rows 19 / 39a-leg3, SO-004 real-Android crash capture.
- **STORM-GUARD-TEST-COVERAGE-001:** day session to add freeze-guard CI coverage.
- **Freeze eyeball:** owner to confirm the preview no longer freezes/oscillates on a real CV (the fix is live-served; owner-side runtime confirmation not reproducible headlessly — rAF freezes in a backgrounded tab).
