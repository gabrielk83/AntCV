# AntCV nightly — 2026-10-28 (CI, unattended, GitHub Actions)

- **Runner:** GitHub Actions, unattended, Opus 4.8, fresh clone.
- **Base:** `origin/main` `60dcfca1` (SYNC FIRST: `git fetch` + `pull --rebase origin main` already up to date).
- **Suite:** `node scripts/run-tests.mjs pwa` → **1850/1850 pass, 0 fail**. `check-register.mjs` OK before + after (93 ACTIVE rows).
- **Shipped:** nothing. No `pwa/` asset touched, no version consumed, no shift claim, no worker deploy (`ALLOW_DEPLOY` not set).
- **Scope:** Band E1 register-staleness sweep (the standing NIGHTLY_BACKLOG_RECONCILE slot). Bands A-D are blocked by the CI environment (no sign-in, no real LLM gen, no live CPU profile, no second physical device, no worker deploy) — see CLOUD CAVEATS in `docs/qa/CLOUD_ROUTINE_PROMPT.md`.

## Band E1 — stalest-row sweep

Took the 6 stalest rows from `node scripts/check-register.mjs --stalest` (all tied at `verified: 2026-10-17`). Every code anchor re-confirmed INTACT on HEAD `60dcfca1`; each row kept ACTIVE on its existing gate and date-refreshed to **2026-10-28** in both the index (`OPEN_REGISTER.md`) and the detail (`REGISTER_ACTIVE_DETAIL.md`).

| Row | ID | Anchor re-verified | Residual gate (why not closed) |
|---|---|---|---|
| 19 | `JD-SCOPE-OCC2-GUARD-001` | `shouldAdoptCloudPointer` in `pwa/antcv-jd-scope.js` ×2 + `app.src.js` ×1; `jd-scope-isolation.test.mjs` green | two-real-device test (owner, physical devices, not fakeable headlessly) |
| 103 | `RELAY-TUNE-COVERAGE-GAP-001` | `workers/proxy/src/multi-llm.js` `ROLE_KEYS`/`roleHeadOrder` 4 refs; `scripts/relay-cost-quality-tune.mjs` present | compress client-lever + analysis addressability — owner-gated on real traffic + same-prompt benchmark; no code owed |
| 45 | PERF-001 | `pwa/antcv-pdf-preview-gate.js` openModal loading-shell leg present; `pwa/test/diag-generate-click-profile.mjs` present | setTimeout leg needs a live-model CPU profile (BLOCKED in CI); PARTIAL 1.51.158 intact |
| 35 | `OVERLAY-EARLY-HALT-001` | `__antcvGenCost` heartbeat gate `app.src.js` ×10 + `app.js` ×4; shipped 1.51.41 intact | one real 3-6 min regen-confirm (owner key) |
| 36 | `GEN-CORECOMP-BROAD-001` | broad core_comp rule inside `__neutralCo` `app.src.js` ×5; `unsolicited-corecomp-broad.test.mjs` green (both-bundle guard); shipped 1.51.41 intact | live regen-confirm |
| 37 | `FOCUS-LABEL-EO-001` | `FOCUS-LABEL` prompt rule `app.src.js` ×2; `antcv-core-comp-compress.js` present + loaded by `index.html`; `core-comp-compress-eo.test.mjs` green; shipped 1.51.42/43 intact | live regen-confirm |

**No owner-gated row was force-closed** — each residual is an owner / live / real-device / regen step, not a code gap.

## Bands A-D — not advanced (environment-blocked)

- **A1/A2 (mobile & tab isolation):** need a live mobile gen + a second physical device.
- **B1/B2 (data loss / crash):** need a signed-in headless repro with real cloud-persisted content.
- **C/D (content correctness / perf):** need live LLM routing, a worker deploy, or a real render/CPU profile.

None are available in unattended CI.

## State after the sweep

New stalest band is rows **25** (`TABLE-GEOMETRY-PARITY-001`) and **6** (`BANNED-WORDS-MERGE-001`) at 2026-10-18, then the 2026-10-19 band. Both new-stalest rows need real-PDF geometry measurement / an owner eyeball gate — a desktop or live run should take them next; left untouched rather than date-refreshed without a real check.

## Owed to a desktop run

Nothing shipped → **no post-deploy live-verify owed this run.** The owner / live / regen legs on all six swept rows carry forward.

## Pushed to `main`

Docs + registers only: this report, `REGISTER_RUNLOG.md` (run summary at top), `OPEN_REGISTER.md` (6 date refreshes), `REGISTER_ACTIVE_DETAIL.md` (6 re-verify notes). No code, no version, no deploy.
