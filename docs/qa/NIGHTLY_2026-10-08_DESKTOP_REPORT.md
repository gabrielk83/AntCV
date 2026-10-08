# AntCV Desktop Nightly — 2026-10-08

**Outcome:** live attest PASS at `1.51.4833-cache-bust-set`. Band E2 and E4 PASS. Band E3's recurring "class flips" were measured as harness nondeterminism (11 labels differ between two runs at the same HEAD) and fixed at the source plus a diff leg that sorts changes by meaning (AUDIT-DIFF-NOISE-001, diag-only, no version). E1 refreshed rows 103, 45, 35, 36, 37; row 103's text now reflects that the analysis and kernel cascades are role-addressable. No pwa asset changed. No row closed.

## Preflight / sync
- Host Gabo-PC, Fable 5.1. Preflight exit 3 (WORKSPACE DIRTY: owner WIP in `package.json`, `workers/access-relay/src/index.js`, one relay test). Worked in `C:/Users/Karpg/antcv-worktrees/routine-antcv-nightly-muzhntxr` on `origin/main` `7e1b4fa8`. The shared clone was not touched.
- TOKEN OK, expires 2026-10-15T11:12Z (7.0 d left). DISPATCH GAP 2.2 d (previous start 2026-10-06T07:15Z). The 10-07 fire did not happen (app closed). Not flagged (< 3 d).
- Shift claim `1.51.4853-1.51.4872`, made from inside the worktree. No number consumed. Released at the end.
- Overlap: CI nightly 2026-10-08 ran E1 only (rows 98/99/100/101/19 at `54415990`). The job-tracker nightly, position-discovery and the weekly cost-quality tune all ran earlier today and pushed; none of their rows were touched here. No DESKTOP NIGHTLY entry existed for today.
- `node_modules` junction to the shared clone for the Playwright diags; removed before commit.

## Baseline (before any edit)
- `run-tests.mjs pwa` 1814/1814 (56 min wall time on this host). Boot smoke OK (glDemo=function, errors=0). `check-register.mjs` OK (90 ACTIVE).

## Live attest (desktop-only)
- `diag-live-guard-sidecars.mjs`: 9/9 served, executed, content-identical at live `1.51.4833-cache-bust-set`. 3 boot 401s (expected, no auth session).
- `browser-qa.mjs --only version-live,sidecars-live`: 2/2 PASS.
- Served constants equal the repo: `sw.js` CACHE `antcv-1.51.4833-cache-bust-set`, boot seed `1.51.4833-cache-bust-set`, `antcv-version-override.js?v=1.51.4833-cache-bust-set`, `app.js?v=1.51.4812-import-rewrap-siblings`.
- `/health` 200 ×4: access-relay `auth-38-subtitle-guard-qual-put`, cv-proxy `3.8.4-brand-ink-match` (host `cv-proxy.karp-gabriel-a.workers.dev`; the `antcv-proxy` name returns a Cloudflare 404, error 1042), antcv-demo-proxy `3.8.4-brand-ink-match`, docx-worker `1.14.174-appline-edit`.
- All three proxies were deployed today by the weekly tune (runs 37772931509 / 37773485941 / 37773581157), so the "deploy ×3 owed" line from the 10-06 report is cleared.

## Fixed

### AUDIT-DIFF-NOISE-001 — row 23 (STANDING), diag-only, no version
- Verify-first: the 10-04, 10-05, 10-06 reports each listed 5 to 12 class flips in the button audit and called them classifier noise. No run had proven it. This run ran the audit twice at the same HEAD with no edit between: 11 labels flipped verdict (active↔ui-only, visible↔not-visible), 1 label gone, 1 added. That is the harness, not the app.
- Cause: the `active`/`ui-only` split only asks whether a localStorage write landed inside one 600 ms settle, and the debounced autosave sometimes lands later. Visibility depends on what an earlier click left open. The nightly diffed by hand on label equality with no severity.
- Fix in `pwa/test/diag-panel-button-audit.mjs`: a second 900 ms settle before a DOM-moving button with no write is called `ui-only` (`settleMs` recorded per result); a `--diff <prev.json>` leg, default the newest earlier `PANEL_BUTTON_AUDIT_*.json`, `--no-diff` to skip. New `pwa/test/button-audit-diff.mjs` sorts label changes into regressions (responding → DEAD/THROWS/unclickable), recoveries, visibility moves, active↔ui-only timing flips (count only), gone, added. The block is appended to the markdown report.
- Evidence: runs 3→4 with the fix: 0 regressions, 0 recoveries, 1 visibility move, 8 timing flips, 0 gone/added. 12 buttons used the second window, 3 ended `active` instead of `ui-only`. `pwa/test/unit/button-audit-diff.test.mjs` 7/7.
- Not fixed: 8 labels still flip every run (✕ Close, Save as new application, Refresh list, Add to sidebar, 👁 Preview, Fuse CL signals, Chat drag handle, ×). Their write is conditional on state, not slow. They are now counted, not listed. A label-level allowlist is the next step only if a real regression is ever hidden by the count.

## Bands
- **A1 row 38:** verified (live attest). Blocked on: real device.
- **A2 rows 39a / 19:** 39a verified (live attest); the authed downgrade PUT was not run, no scratch app id. 19 blocked on: second real device.
- **B rows 40 / 41:** verified (live attest). 40 blocked on: owner session. 41 blocked on: real device.
- **C rows 42 / 43 / 44:** verified (live attest). Blocked on: real LLM gen (42), owner session (43, 44).
- **D row 45:** verified (E1, markers intact and live). Blocked on: owner profile of a real export.
- **D row 39:** verified, still open. D1 `llm_calls` newest day 2026-09-28 (D1 MCP connector). Blocked on: real LLM gen.
- **E1:** stalest set rows 103 / 45 / 35 / 36 / 37 (all 2026-09-26, three CI refreshes with no change). Row 103 advanced in the text: `ROLE_KEYS` now carries `analysis` and `kernel`, both `wrangler.toml` pin `analysis:mistral`, the tune's `ROLE_TASKS` maps their telemetry labels; compress stays a client lever by design (raw passthrough lock). 35 / 36 / 37 markers intact and live; each needs one real regen. All refreshed to 2026-10-08, none closable.
- **E2** row 17: selftest PASS (80 synthetic mutations seen on all 4 tabs). Personal / Layout / Account / Advanced 0 mutations per 8 s, 0 page errors. PASS.
- **E3** row 23: final run 209 buttons, 0 THROWS, 0 DEAD, 0 page errors (active 132, ui-only 9, not-visible 55, skipped 13). See the fix above.
- **E4** row 34: `diag-results-preview-export-parity.mjs` OK.

## Register rows
| Row | ID | Status |
|---|---|---|
| 23 | NIGHTLY-PREVIEW-BUTTON-AUDIT-001 | verified (E3, STANDING); harness fix AUDIT-DIFF-NOISE-001 shipped |
| 103 | RELAY-TUNE-COVERAGE-GAP-001 | advanced (text); blocked: real traffic |
| 45 | PERF-001 | verified; blocked: owner profile / real gen |
| 35, 36, 37 | OVERLAY-EARLY-HALT-001, GEN-CORECOMP-BROAD-001, FOCUS-LABEL-EO-001 | verified; blocked: real LLM gen (regen-confirm) |
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
| 89 | MODEL-TABLE-FRESHNESS-001 | not touched; deploys done by the weekly tune today; D1 INSERT owner-gated |
| 110, 114, 115 | token / telemetry / meter rows | not touched; token healthy |

ACTIVE 90 → 90.

## Evidence index
- Commit for the fix (diag + lib + unit test + today's audit artifacts); register commit follows it.
- `docs/qa/PANEL_BUTTON_AUDIT_2026-10-08.md` (with the "Diff vs audit-run3.json" block) + `.json`. Runs 1 to 3 are in the session scratchpad only; their diffs are quoted above.
- `docs/qa/last-browser-qa.json`.
- D1: `SELECT date(ts,'unixepoch') d, provider, model, task, COUNT(*) n FROM llm_calls GROUP BY d, provider, model, task ORDER BY d DESC LIMIT 12` via the D1 MCP connector. Newest 2026-09-28. The wrangler path (`npx wrangler d1 execute ant_memory --remote`) answered 7403 once and then worked, with and without `CLOUDFLARE_ACCOUNT_ID`; transient, not filed.
- Tests before push: 1821/1821 (1814 + 7 new); `check-cache-bust.mjs --range origin/main..HEAD` OK (no pwa asset changed); `check-register.mjs` OK.

## Owner-verify
- Next E3 report: the "Diff vs previous" block should show 0 regressions. If a label ever appears under regressions, it is a real DEAD or THROWS, not jitter.

## Owner decisions
- Branch protection: make "AntCV PR gate" a required status check on `main`. Unchanged from 10-06.
- Row 39a: name a scratch application id for the downgrade PUT. Unchanged from 10-05.
- Row 115: meter by served model id, yes or no. Unchanged from 10-04.
- One real generation on the owner's key settles rows 39, 42, 35, 36, 37 and the opus-5-5 telemetry question at once. Nothing in `llm_calls` since 2026-09-28.

## Non-claims
- No pwa loaded asset changed; no cache-bust; no version consumed from the lane.
- No worker deployed by this run.
- The E3 settle change reduces, it does not remove, the active/ui-only jitter (11 → 8 flips, one pair of runs each; not a statistical claim).
- Rows 38-44 are attested served-and-identical, not exercised end-to-end.
