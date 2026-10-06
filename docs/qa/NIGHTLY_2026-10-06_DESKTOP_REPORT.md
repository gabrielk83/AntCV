# AntCV Desktop Nightly — 2026-10-06

**Outcome:** shipped `1.51.4833-cache-bust-set` (CACHE-BUST-SET-001, new row 120, CLOSED) and live-verified it. PR #379 had shipped 1.51.4832 with the boot seed and the version-override `?v` left at 1.51.4812. New `--set` gate, real-tree test lock, hook step and a PR workflow close the class. Live attest PASS before and after. Band E2, E3, E4 PASS. E1 closed rows 70-73, refreshed 74.

## Preflight / sync
- Host Gabo-PC, Fable 5.1. Preflight exit 3 (WORKSPACE DIRTY: owner WIP in `package.json`, `workers/access-relay/src/index.js`, one relay test). Worked in `C:/Users/Karpg/antcv-worktrees/routine-antcv-nightly-muwcgp0a` on `origin/main` `af8c0f02`, rebased onto `a862b467` (job-tracker nightly, same morning) before the push. The shared clone was not touched.
- TOKEN OK, expires 2026-10-12T16:40Z (6.4 d left). DISPATCH GAP 0.9 d (previous start 2026-10-05T10:15Z). No gap flag.
- Shift claim `1.51.4833-1.51.4852`, made from inside the worktree. Used 1.51.4833. Released at the end.
- Overlap: no CI report for today (the cloud nightly's last run was 2026-10-05 09:04Z). No DESKTOP NIGHTLY entry existed for today. The job-tracker nightly ran today and closed row 113; this run did not touch its rows.

## Baseline (before any edit)
- `run-tests.mjs pwa` 1805/1805. Boot smoke OK (glDemo=function, errors=0). `check-register.mjs` OK (95 ACTIVE).

## Live attest (desktop-only)
Run twice: before the edit at `1.51.4832-edu-detail`, and after the deploy at `1.51.4833-cache-bust-set`.
- `diag-live-guard-sidecars.mjs`: 9/9 served, executed, content-identical, both times. 3 boot 401s (expected, no auth session).
- `browser-qa.mjs --only version-live,sidecars-live`: 2/2 PASS, both times.
- `/health` 200 ×4: access-relay `auth-38-subtitle-guard-qual-put`, cv-proxy + antcv-demo-proxy `3.8.4-brand-ink-match`, docx-worker `1.14.174-appline-edit` (URL `docx-worker.karp-gabriel-a.workers.dev`; the `antcv-docx-worker` name returns a Cloudflare 404 page).
- Before the ship the live constants did NOT agree: `sw.js` CACHE `1.51.4832-edu-detail`, boot seed `1.51.4812-import-rewrap-siblings`, `antcv-version-override.js?v=1.51.4812`. The headless attest still passed, because a fresh profile has no cached override. That is the gap below.
- After the ship (Pages deploy landed in ~90 s): `sw.js` CACHE, boot seed, override `?v` and the served override's TARGET_VERSION all read `1.51.4833-cache-bust-set`.

## Shipped

### CACHE-BUST-SET-001 — row 120, `1.51.4833-cache-bust-set`, commit `ebb00fff`
- Verify-first: `git show b6175919` (PR #379, cloud thread opbo38) changed `antcv-bullet-targets.js` + its `?v`, `gold-rules.json`, `sw.js` CACHE, TARGET_VERSION and STALE_VERSIONS. It did not change the boot seed or the override's own `?v`. `check-cache-bust.mjs --range b6175919~1..b6175919` → `✗ antcv-version-override.js`. PR #376 (1.51.4813) had the same shape the day before. Nothing ran the gate: it lives in the local pre-push hook, and a PR merges through GitHub. No test read the constants; `hdr-type-controls.test.mjs` compared the seed with app.js's `?v`, which happened to agree.
- Fix, pwa: CACHE, TARGET_VERSION, STALE_VERSIONS += `1.51.4832-edu-detail`, boot seed, override `?v`, all `1.51.4833-cache-bust-set`. No app.js change. `check-cache-bust.mjs --range origin/main..HEAD` OK.
- Fix, tooling: `check-cache-bust.mjs --set` reads the five release constants and fails unless they are one version and TARGET is not in STALE_VERSIONS. `pwa/test/unit/cache-bust-set.test.mjs`: 7 fixture checks + a real-tree lock (suite 1805 → 1813). Negative control: the pure check on origin/main's three files reports exactly the two #379 offenders. `hdr-type-controls.test.mjs` now compares the seed with TARGET_VERSION (it went red on this sidecar-only bump; that was the test, not the fix). `scripts/git-hooks/pre-push` runs `--set` on any push touching `pwa/`. New `.github/workflows/pr-gate.yml`: on pull_request to main, `--range origin/<base>...HEAD`, `--set`, PWA suite.
- Gates: suite 1813/1813, boot smoke OK, `--set` OK, register OK.
- Docs: CLAUDE.md patch protocol step 9, band plan HARD RULE 4, FEATURES_REGISTRY CI note, ACTIVE_BUGS top block.

## Bands
- **A1 row 38:** verified (live attest). Blocked on: real device.
- **A2 rows 39a / 65 / 19:** 39a verified (live attest). The authed downgrade PUT was not run (no scratch app id). Row 19 blocked on: second real device. Row 65 not touched.
- **B rows 40 / 41:** verified (live attest). 40 blocked on: owner session. 41 blocked on: real device.
- **C rows 42 / 43 / 44:** verified (live attest). Blocked on: real LLM gen (42), owner session (43, 44).
- **D row 45:** not touched. Blocked on: real LLM gen.
- **D row 39:** verified, still open. D1 `llm_calls` newest day 2026-09-28 (wrangler read-only SELECT). Blocked on: real LLM gen.
- **E1:** stalest set rows 74/73/72/71/70 (all 2026-09-23, refreshed three times by CI with no change). Closed 73, 72, 71, 70: deliverables DONE 2026-07-08; worker markers at HEAD (`__mt = bodyLevel ? 822 : 806` at `index.js:23839`, `ai_wm_side` 1, `mainTint` 2); live worker 1.14.174 ≥ 1.14.135/136; residuals already carried by rows 61 and 66. Row 74 refreshed; leg (C) BACKGROUND-STALL stays, blocked on a real foreground mobile gen. Next stalest after this run: rows 69, 67, 66, 65, 68 (2026-09-23).
- **E2** row 17: selftest PASS. Personal / Layout / Account / Advanced 0 mutations per 8 s. PASS.
- **E3** row 23: 212 buttons (209 on 10-05), 0 THROWS, 0 DEAD, 0 page errors. Against 10-05 by label: 8 class flips, 1 label gone ("⇥ Fit"), 0 added. Listed on row 23. Not investigated; none DEAD or THROWS.
- **E4** row 34: `diag-results-preview-export-parity.mjs` OK.

## Register rows
| Row | ID | Status |
|---|---|---|
| 120 | CACHE-BUST-SET-001 | new, shipped, CLOSED |
| 70, 71, 72, 73 | —, AI-NOTICE-INLINE-001, AI-NOTICE-ANCHOR-FIX-001, — | CLOSED (E1, evidence in REGISTER_CLOSED) |
| 74 | JD-SWAP-STALE-RATIONALE-001 | verified; blocked: owner session (foreground mobile gen) |
| 38 | GEN-BACKGROUND-001 | verified; blocked: real device |
| 39a | AUTOSAVE-NO-DOWNGRADE-001 | verified; blocked: owner decision (scratch app id) |
| 40 | SO-003 | verified; blocked: owner session |
| 41 | SO-004 | verified; blocked: real device |
| 42 | GEN-LANGFAB-001 | verified; blocked: real LLM gen |
| 43 | CA-006 | verified; blocked: owner session |
| 44 | JD-ANALYSIS-PRINT-001 | verified; blocked: owner session |
| 34 | ROLE-MERGE-STORED-001 | verified (E4 + live attest) |
| 39 | GEN-MODELROLE-001 | verified, still open; blocked: real LLM gen |
| 17 | SETTINGS-PERSONAL-STABILIZE-001 | verified (E2, STANDING) |
| 23 | NIGHTLY-PREVIEW-BUTTON-AUDIT-001 | verified (E3, STANDING) |
| 89 | MODEL-TABLE-FRESHNESS-001 | not touched; worker deploy ×3 still owed |
| 110 | ANTCV-TOKEN-EXPIRED-2026-09-02-001 | not touched; token healthy |
| 114, 115 | TELEMETRY-BGJOB-GAP-001, PWA-COST-METER-OPUS55-001 | not touched (owner calls) |

ACTIVE 95 → 90 (four closed here, row 113 closed by the job-tracker nightly).

## Evidence index
- Commit `ebb00fff` (fix + gate + tests + hook + workflow). Register commit follows it.
- `pwa/test/unit/cache-bust-set.test.mjs` (8 checks). `pwa/test/unit/hdr-type-controls.test.mjs` (17 checks).
- `docs/qa/PANEL_BUTTON_AUDIT_2026-10-06.md` + `.json`. `docs/qa/last-browser-qa.json`.
- D1: `SELECT date(ts,'unixepoch') d, provider, model, COUNT(*) n FROM llm_calls GROUP BY d, provider, model ORDER BY d DESC LIMIT 6` via `npx wrangler d1 execute ant_memory --remote` from `workers/access-relay`. Newest 2026-09-28.

## Owner-verify
- Open https://antcv.pages.dev/ in a browser that had the app loaded before today. The version chip should read 1.51.4833 after one reload, and the console `freshness-guard-789` line should say `loaded 1.51.4833 >= deployed 1.51.4833`.
- The PR gate workflow has not run yet. It fires on the next pull_request event against main; check the Actions tab for "AntCV PR gate" then.

## Owner decisions
- Branch protection: make "AntCV PR gate" a required status check on `main`. Without it the workflow reports but cannot block a merge like #379.
- Row 39a: name a scratch application id for the downgrade PUT. Unchanged from 10-05.
- Row 89: three worker deploys still owed. The shared clone still holds uncommitted relay WIP. Unchanged from 10-05.
- Row 115: meter by served model id, yes or no. Unchanged from 10-04.

## Non-claims
- The PR gate workflow was not exercised. No PR event occurred during this run and the workflow has no manual trigger.
- No live LLM generation. No signed-in session opened. No relay write. No worker deploy. No app.js change.
- The installed pre-push hook in the shared clone matched the previous repo copy and was refreshed to the new one (local file, outside git).
- The 8 button-class flips in E3 were not investigated.
- The version 1.51.4813 (PR #376) sat inside the desktop's 10-05 lane 1.51.4812-4831; no number collided, but the cloud thread took it without a claim. Noted, not acted on.
