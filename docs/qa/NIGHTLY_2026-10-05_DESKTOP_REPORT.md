# AntCV Desktop Nightly — 2026-10-05

**Outcome:** shipped `1.51.4812-import-rewrap-siblings` (row 107 fixed and closed) and live-verified it. Live attest PASS before and after the ship. Band E2, E3, E4 PASS. One tooling fix: `check-register.mjs --stalest`. Row 39 telemetry leg still open.

## Preflight / sync
- Host Gabo-PC, Fable 5.1. Preflight exit 3 (WORKSPACE DIRTY: owner WIP in `package.json`, `workers/access-relay/src/index.js`, one relay test). Worked in `C:/Users/Karpg/antcv-worktrees/routine-antcv-nightly-muv3giv8` on `origin/main` `7c0ffeef`. The shared clone was not touched.
- TOKEN OK, expires 2026-10-11T16:25Z (6.3 d left).
- DISPATCH GAP 0.7 d (previous start 2026-10-04T16:24Z). No gap flag.
- Shift claim `1.51.4812-1.51.4831`, made from inside the worktree. Used 1.51.4812. Released at the end.
- Overlap: today's CI report (`NIGHTLY_2026-10-05_REPORT.md`) ran E1 on rows 63/64/58/62 and shipped no code. No DESKTOP NIGHTLY entry existed for today. This run took the desktop legs.

## Baseline (before any edit)
- `run-tests.mjs pwa` 1784/1784. Boot smoke OK (glDemo=function, errors=0). `check-register.mjs` OK (97 ACTIVE).

## Live attest (desktop-only)
Run twice: before the edit at `1.51.4792-demand-seed-refresh`, and after the deploy at `1.51.4812-import-rewrap-siblings`.
- `diag-live-guard-sidecars.mjs`: 9/9 served, executed, content-identical, both times. 3 boot 401s (expected, no auth session).
- `browser-qa.mjs --only version-live,sidecars-live`: 2/2 PASS, both times.
- Live `sw.js` CACHE, `app.js?v`, `antcv-version-override.js?v` and the boot seed equal the repo, both times.
- `/health` 200 ×4, all equal repo constants: access-relay `auth-38-subtitle-guard-qual-put`, cv-proxy + antcv-demo-proxy `3.8.4-brand-ink-match`, docx-worker `1.14.174-appline-edit`.

## Shipped

### IMPORT-REWRAP-SIBLING-DROP-001 — row 107, `1.51.4812-import-rewrap-siblings`, commit `ae90169c`
- Why this row: it was the stalest row in the register (`verified: 2026-08-26`). The CI E1 sweeps of 10-04 and 10-05 skipped it because it sits near the bottom of an unsorted table.
- Verify-first: the row was accurate. The admin settings import rewraps a bare personalInfo blob into `{ personalInfo: blob }` and kept only `photo`. Every other top-level key the chain reads was lost while the import reported success. The real read-set is wider than the row listed: also `memoryDigestHash`, the openai / mistral / gemini keys and models, `lineTargets`, `fontSizes`, `cvTableRatio`, `clTableRatio`, `consensusEnabled`.
- Fix: one arrow copies that read-set when the value is not null or undefined. `language` is copied only as a 2-letter string. Fields outside the read-set stay inside `personalInfo`.
- `app.js`: one surgical in-place edit, occurrence-guarded, `vm.Script` parse gate, still starts `(()=>{`, no `"use strict"`. Mirrored in `app.src.js`. No `build:app`.
- Test: `pwa/test/unit/import-rewrap-keeps-photo.test.mjs` extracts the real arrow from both bundles and runs it. 24 checks, two negative controls, and a lock that every `n.<key>` the chain reads is in the carried list. The first draft of the `language` guard let `["da"]` through; the test caught it before the commit.
- Cache-bust set: `app.js?v` and its 20 sibling refs, `antcv-version-override.js?v`, `sw.js` CACHE, TARGET_VERSION, STALE_VERSIONS += `1.51.4792-demand-seed-refresh`, boot seed. `check-cache-bust.mjs --range origin/main..HEAD` OK.
- Side fix in the same set: the boot seed `window.ANTCV_VERSION` was still `1.51.4791-profile-prefix` under TARGET `1.51.4792`. Now equal to TARGET.
- Gates: suite 1801/1801, boot smoke OK, Settings Advanced panel 0 mutations after the edit.
- Live: deploy run 37296932788 green. Served `app.js?v=1.51.4812-import-rewrap-siblings` is byte-identical to the repo (EOL-normalized), the new expression is present, the old form is absent. Production boots at 1.51.4812 in a real browser.

### REGISTER-STALEST-SCAN-MISS-001 — tooling, no version
- `node scripts/check-register.mjs --stalest [N]` prints the N stalest non-STANDING rows ranked on the verified column. 3 tests. The band plan E1 text and the index conventions now point at it.
- Current output after this run: rows 74, 73, 72, 71, 70 (all 2026-09-23).

## Bands
- **A1 row 38:** verified (live attest). Blocked on: real device.
- **A2 rows 39a / 65 / 19:** 39a verified (live attest + relay version). The authed downgrade PUT was not run, see owner decisions. Row 19 blocked on: second real device. Row 65 not touched.
- **B rows 40 / 41:** verified (live attest). 40 blocked on: owner session. 41 blocked on: real device (Android crash capture).
- **C rows 42 / 43 / 44:** verified (live attest). Blocked on: real LLM gen (42), owner session (43, 44).
- **D row 45:** not touched. Blocked on: real LLM gen (live-model profile).
- **D row 39:** verified, still open. D1 newest `llm_calls` 2026-09-28. Blocked on: real LLM gen.
- **E1:** done by CI (rows 63/64/58/62). This run closed the row CI missed (107).
- **E2** row 17: selftest PASS. Personal / Layout / Account / Advanced 0 mutations per 8 s. PASS.
- **E3** row 23: 209 buttons, 0 THROWS, 0 DEAD, 0 page errors. Against 10-04: 5 labels changed class between ui-only and active, 3 more CJLR entries enumerated as not-visible. Not investigated; none is DEAD or THROWS.
- **E4** row 34: `diag-results-preview-export-parity.mjs` OK.

## Register rows
| Row | ID | Status |
|---|---|---|
| 107 | IMPORT-REWRAP-SIBLING-DROP-001 | shipped, CLOSED |
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
| 110 | ANTCV-TOKEN-EXPIRED-2026-09-02-001 | not touched; token healthy today |
| 114, 115 | TELEMETRY-BGJOB-GAP-001, PWA-COST-METER-OPUS55-001 | not touched (owner calls) |

## Evidence index
- Commit `ae90169c` (fix + cache-bust). Deploy run 37296932788.
- `pwa/test/unit/import-rewrap-keeps-photo.test.mjs` (24 checks). `pwa/test/unit/register-hygiene.test.mjs` (15 checks, 3 new).
- `docs/qa/PANEL_BUTTON_AUDIT_2026-10-05.md` + `.json`.
- D1: `SELECT date(ts,'unixepoch') d, provider, model, COUNT(*) n FROM llm_calls GROUP BY d, provider, model ORDER BY d DESC LIMIT 12`. Newest 2026-09-28. Read through the Cloudflare D1 connector; wrangler was not needed.

## Owner-verify
- Optional, 1 minute: Settings, admin General, Import settings, with a bare personalInfo JSON that also has `"navyColor": "#123456"` at top level. The accent colour changes after the import.

## Owner decisions
- Row 39a: name a scratch application id the nightly may send the downgrade PUT to. Without one the leg stays unrun: a failed guard would blank a real row's company.
- Row 89: the three worker deploys for the two Gemini price rows are still owed. The shared clone holds uncommitted relay WIP, so this run left them. Say "deploy" or run them after the WIP lands.
- Row 115: meter by the served model id. Yes or no. Unchanged from 10-04.

## Non-claims
- The admin Import click was not driven in a browser. The tab renders only for `is_admin`. The proof is the real-code test plus the live bundle check.
- No live LLM generation. No signed-in session opened. No relay write. No worker deploy.
- E1 not run here beyond row 107 (CI did rows 63/64/58/62).
- The 5 button-class flips in E3 were not investigated.
