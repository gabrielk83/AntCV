# AntCV nightly report — 2026-09-16 (CI, GitHub Actions, unattended, Opus 4.8)

## Entry state
- SYNC FIRST: `git fetch origin && git pull --rebase origin main` → already up to date, HEAD `3f595acf`.
- Suite: `node scripts/run-tests.mjs pwa` → **1715/1715**, 0 fail.
- `node scripts/check-register.mjs` → OK, 93 ACTIVE rows.
- `ALLOW_DEPLOY=false`. deploy.yml dead since 2026-08-01 (row 109 `DEPLOY-YML-CF-AUTH-BROKEN-001`, owner-owed token rotation).

## What ran
Band A–D are each blocked on a capability CI does not have — signed-in live-verify, a real LLM
generation, a second physical device, a real CloudConvert PDF render, and worker deploy. Per the
owner hard rule ("an end result, not a brickable mid-product") no speculative app.js/worker surgery
was attempted. The productive lane in CI is **Band E1 — register staleness sweep**.

## Band E1 — staleness sweep (10 rows advanced to 2026-09-16)
The 07-08→29 desktop batches were bumped to 09-11→15 by the last five CI runs, so the genuinely
stalest non-STANDING rows are now the **2026-08-20→25 code/PWA band**. Each was re-confirmed by a
present code marker on HEAD `3f595acf` plus green tests; the detail row and the index date were
advanced, and the remaining owner/live-gated leg noted.

| row | ID | code marker (HEAD 3f595acf) | test evidence | remaining leg |
|---|---|---|---|---|
| 45 | PERF-001 | `antcv-pdf-preview-gate.js` openModal loading-shell (11 markers) | `diag-generate-click-profile.mjs` present | setTimeout leg needs a live-model CPU profile |
| 40 | SO-003 | `antcv-outcomes-loss-guard.js` | `core-comp-format-preserves-outcomes.test.mjs` green | owner-verify (change core-comp row count, outcomes survive) |
| 35 | OVERLAY-EARLY-HALT-001 | `__antcvGenCost` app.js×4 / app.src×10 | in-suite green | live 3–6 min regen-confirm |
| 36 | GEN-CORECOMP-BROAD-001 | `__neutralCo`×5 app.src.js | `unsolicited-corecomp-broad.test.mjs` green | live regen-confirm |
| 37 | FOCUS-LABEL-EO-001 | `FOCUS-LABEL`×2 + `antcv-core-comp-compress.js` | `core-comp-compress-eo.test.mjs` green | live regen-confirm |
| 3 | FLOAT-SPINE-001 | `floatSpine`×6 docx-worker + `float-spine`×2 docx-client (default OFF) | in-suite green | owner visual re-export (no reference docx in CI) |
| 14 | JD-SCAN-HALLUCINATION-001 | charset/filename/garbled→vision anchors app.src.js | `jd-extract-hardening` green | live model-behaviour leg |
| 20 | CONTACT-TRACK-TIGHT-001 | headlineAlign / fix_orphans / SIRIN-SEMANTICS-001 / CONTACT-TRACK-TIGHT-001 (docx-worker) | in-suite green | real CloudConvert PDF eyeball |
| 52 | GROUP-EMPTY-HIDE-001 | `__grpHasChild`×3 app.src + `__gc`×3 app.js + `renderRichBlock`×7 docx-worker | `group-empty-hide.test.mjs` 29/29 | none (shipped 1.51.194) |
| 103 | RELAY-TUNE-COVERAGE-GAP-001 | `ROLE_KEYS`/`roleHeadOrder` multi-llm.js + `relay-cost-quality-tune.mjs` | tune tests green | owner call on real traffic + same-prompt compress benchmark |

Targeted guard-test isolation run: `group-empty-hide` + `core-comp-format-preserves-outcomes` +
`core-comp-compress-eo` + `unsolicited-corecomp-broad` → **60/60** green.

## Not swept this run (owned by other routines)
The 08-26/27 rows at the same staleness (18 ANITA, 102 DEMAND-SEED, 105 JOBSRC-FETCH, 106
POSTING-OBSOLETE, 107 IMPORT-REWRAP, 108 JOBTRACKER-PYTEST-UNWIRED) are advanced by the
job-tracker + demand-seed scheduled routines, not this antcv nightly. Left for their owners.

## Shipped / PRs
- **No code shipped, no PR.** Docs + registers only (OPEN_REGISTER index dates, REGISTER_ACTIVE_DETAIL
  re-verify notes, REGISTER_RUNLOG top entry, this report). No cache-bust, no shift claim.

## Owed to a desktop / owner run
- All 10 rows' remaining legs above are owner/live-gated (see table).
- **Row 109** owner action still owed: rotate `CLOUDFLARE_API_TOKEN` (Workers Edit + Pages Edit) and
  set `CLOUDFLARE_ACCOUNT_ID` so `deploy.yml` works again — until then every "deploy via deploy.yml"
  instruction silently no-ops.
- Row 89 D1 rate INSERTs remain owner-gated (workers already deployed 2026-09-15).
- No PWA change shipped this run, so no post-deploy live-verify is owed from this run.
