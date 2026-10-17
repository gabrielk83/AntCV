# AntCV session log — 2026-10-17 (CI NIGHTLY, GitHub Actions, unattended, Opus 4.8)

Substrate: GitHub Actions, fresh isolated clone, `ALLOW_DEPLOY=false`. No in-app Browser pane,
no signed-in session, no live LLM, no worker deploy. SYNC FIRST: `git fetch` + `pull --rebase
origin main` — already up to date, HEAD `954cce5a`. Baseline: `node scripts/run-tests.mjs pwa`
**1830/1830** green; `node scripts/check-register.mjs` OK (92 ACTIVE rows). No `pwa/app.js`,
`pwa/app.src.js` or `workers/**` edit → no cache-bust / boot-smoke / PR owed, no shift claim
(docs-only run).

## CLOSED this run

- None. No owner-gated item was force-closed; all stalest rows carry residual legs that need a
  capability CI does not have (live browser / real device / real LLM gen / worker deploy / real
  relay traffic).

## Work done — Band E1 register staleness sweep (standing coverage)

Took the 6 stalest code-anchored rows from `check-register.mjs --stalest`, re-verified each anchor
against current code (HEAD `954cce5a`), and refreshed `verified:` to 2026-10-17 in both
`OPEN_REGISTER.md` (index) and `REGISTER_ACTIVE_DETAIL.md` (detail). All anchors INTACT:

| row | ID | anchor re-verified | residual (blocked in CI) |
|---|---|---|---|
| 19 | `JD-SCOPE-OCC2-GUARD-001` | `shouldAdoptCloudPointer` — `antcv-jd-scope.js` ×2 + `app.src.js` ×1; `jd-scope-isolation.test` green | two-real-device test (owner, physical devices) |
| 103 | `RELAY-TUNE-COVERAGE-GAP-001` | `multi-llm.js` `ROLE_KEYS`/`roleHeadOrder` 4 refs + `relay-cost-quality-tune.mjs` | compress client-lever + analysis addressability — owner-gated on real traffic + same-prompt benchmark |
| 45 | `PERF-001` | `antcv-pdf-preview-gate.js` openModal loading-shell (10 markers) + `diag-generate-click-profile.mjs` | setTimeout leg needs live-model CPU profile |
| 35 | `OVERLAY-EARLY-HALT-001` | `__antcvGenCost` gate — `app.src.js` ×10 + `app.js` ×4 | one real 3–6 min regen on owner's key |
| 36 | `GEN-CORECOMP-BROAD-001` | `__neutralCo` broad rule ×5; `unsolicited-corecomp-broad.test` green | live regen-confirm |
| 37 | `FOCUS-LABEL-EO-001` | `FOCUS-LABEL` rule ×2 + `antcv-core-comp-compress.js` + `core-comp-compress-eo.test` green | live regen-confirm |

Next stalest after this sweep = row 105 `JOBSRC-FETCH-001` (2026-10-08) — owned by the
`antcv-position-discovery` routine (re-verified 2×/wk against live job boards), not this nightly;
left untouched deliberately.

## OPEN (carry forward)

- **Bands A–D — all blocked in unattended CI.** A1 `GEN-BACKGROUND-001` / A2 tab-device isolation:
  need live A/B on a real mobile gen + a real second device (owner). B1 SO-003 (shipped belt,
  owner-verify owed) / B2 SO-004 React #185: need a headless repro drive — not attempted this run,
  no new finding. C1 `GEN-LANGFAB-001` / C2 CA-006 / C3 `JD-ANALYSIS-PRINT-001`: content fixes
  measured on FRESH gens (no live model here). D1 PERF-001 setTimeout leg (live profile) / D2
  `GEN-MODELROLE-001` (needs a proxy deploy check + D1 `llm_calls` split — `ALLOW_DEPLOY=false`).
- **Owner-gated / live-verify owed:** every stalest row's residual leg above; rows 25
  (real-CloudConvert table geometry), 105 (position-discovery routine).

## Needs the owner

- Nothing new. The standing owner-gated backlog (live regens, real-device tests, worker
  `MODEL_ROLES` flips, CloudConvert export reviews) is unchanged; CI cannot clear any of it.

## Post-deploy live-verify owed

- None this run — nothing was shipped, so no `?v`/CACHE/served-bundle verify is owed to a desktop
  run.
