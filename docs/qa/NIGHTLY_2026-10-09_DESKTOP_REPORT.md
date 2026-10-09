# AntCV Desktop Nightly — 2026-10-09

**Outcome:** live attest PASS at `1.51.4873-linear-enriched` (served `index.html` and `app.js` byte-identical to the repo, four workers `/health` 200 at repo versions). Band E2, E3, E4 PASS. E1 closed two stale rows with evidence (14 JD-SCAN-HALLUCINATION-001, 52 GROUP-EMPTY-HIDE-001) and refreshed three (3, 20, 25). No code changed, no pwa asset touched, no version consumed. ACTIVE 90 → 88.

## Preflight / sync
- Host Gabo-PC, Fable 5.1. Preflight exit 3 (WORKSPACE DIRTY: owner WIP in `package.json`, `workers/access-relay/src/index.js`, one relay test). Worked in `C:/Users/Karpg/antcv-worktrees/routine-antcv-nightly-mv0n1sja` on `origin/main` `694f2da5` (branch `routine-antcv-nightly-2026-10-09`). The shared clone was not touched.
- TOKEN OK, expires 2026-10-15T11:12Z (6.2 d left). DISPATCH GAP 0.8 d (previous start 2026-10-08T12:04Z). Not flagged.
- Shift claim `1.51.4893-1.51.4912` (commit `45e11297`), made from inside the worktree. No number consumed. Released at the end.
- Overlap: the CI nightly had not fired for 2026-10-09 when this run started (newest run 37753335820, 2026-10-08 08:57Z). No DESKTOP NIGHTLY entry existed for today. Position-discovery 22:00 fire on 10-08 was the newest push (`694f2da5`); none of its rows were touched here.
- `node_modules` junction to the shared clone for the Playwright diags; removed before commit.

## Baseline (before any edit)
- `run-tests.mjs pwa` 1821/1821 (80 s wall time). Boot smoke OK (glDemo=function, errors=0). `check-register.mjs` OK (90 ACTIVE).

## Live attest (desktop-only)
- `diag-live-guard-sidecars.mjs`: 9/9 served, executed, content-identical. 3 boot 401s (expected, no auth session).
- `browser-qa.mjs --only version-live,sidecars-live`: 2/2 PASS (live `1.51.4873-linear-enriched`, patch 4873 = repo target 4873).
- Served constants equal the repo: `sw.js` CACHE `antcv-1.51.4873-linear-enriched`, boot seed `1.51.4873-linear-enriched`, `antcv-version-override.js?v=1.51.4873-linear-enriched` with `TARGET_VERSION` the same, `app.js?v=1.51.4812-import-rewrap-siblings`. Served `index.html` (82290 B) and `app.js` (1125086 B) are byte-identical to the repo files after stripping CR.
- `/health` 200 ×4 at repo versions: antcv-access-relay `auth-38-subtitle-guard-qual-put`, cv-proxy `3.8.4-brand-ink-match`, antcv-demo-proxy `3.8.4-brand-ink-match`, docx-worker `1.14.174-appline-edit` (`pdf_via: cloudconvert`). `antcv-mcp`, `antcv-c2pa-worker` and `docx-worker-staging` answer 404 on `/health` (no such route or no such worker); unchanged from earlier runs, not filed.
- The 1.51.4873 ship (linear CV enriched details, lane 4873-4892, released 10-08) is what production serves. No deploy was pending.

## Bands
- **A1 row 38:** verified (live attest). Blocked on: real device.
- **A2 rows 39a / 19:** 39a verified (live attest); the authed downgrade PUT was not run, no scratch application id. 19 blocked on: second real device.
- **B rows 40 / 41:** verified (live attest). 40 blocked on: owner session. 41 blocked on: real device.
- **C rows 42 / 43 / 44:** verified (live attest). Blocked on: real LLM gen (42), owner session (43, 44).
- **D row 45:** not touched (refreshed 10-08). Blocked on: owner profile of a real export.
- **D row 39:** verified, still open. D1 `llm_calls` newest day 2026-09-28 (D1 MCP connector, read-only). Blocked on: real LLM gen.
- **E1:** stalest set rows 3 / 14 / 20 / 52 (2026-09-26) and 25 (2026-09-27).
  - Row 14 CLOSED. All three legs are deterministic code, present in both bundles and on the served `app.js`; 17 unit checks green. The "needs real models" caveat predates the ship, by the row's own 07-04 audit text. Fourteen sweeps had re-confirmed it unchanged.
  - Row 52 CLOSED. `__grpHasChild` / `__gc` / `renderRichBlock` present at HEAD and live; 29-case preview↔export parity test green; docx-worker live at repo version; no owner re-report in three months.
  - Rows 3 / 20 / 25 refreshed: anchors present, live worker = repo. Each still needs a real CloudConvert export eyeballed by the owner. This run did not spend CloudConvert credits on an unattended export.
- **E2** row 17: selftest PASS (80 synthetic mutations on all 4 tabs, 4 distinct fingerprints). Personal / Layout / Account / Advanced 0 mutations per 8 s, 0 page errors. PASS.
- **E3** row 23: one run with the 10-08 settle window and the new diff leg: 210 buttons (209 → 210, same label set), 0 THROWS, 0 DEAD, 0 page errors (active 134, ui-only 7, not-visible 56, skipped 13). Diff vs 10-08: 0 regressions, 0 recoveries, 1 visibility move (CJLR cycle hidden 3 → 4), 6 active↔ui-only timing flips, 0 gone / 0 added. The harness header still prints "Bundle: 1.51.4246-era app.js" (a stale literal, cosmetic).
- **E4** row 34: `diag-results-preview-export-parity.mjs` RESULTS-PREVIEW-EXPORT-PARITY OK.

## Register rows
| Row | ID | Status |
|---|---|---|
| 14 | JD-SCAN-HALLUCINATION-001 | CLOSED (E1, evidence in REGISTER_CLOSED) |
| 52 | GROUP-EMPTY-HIDE-001 | CLOSED (E1, evidence in REGISTER_CLOSED) |
| 3 | FLOAT-SPINE-001 | verified; blocked: owner session (real export, flag on) |
| 20 | CONTACT-TRACK-TIGHT-001 | verified; blocked: owner session (real PDF eyeball) |
| 25 | TABLE-GEOMETRY-PARITY-001 | verified; blocked: owner session (real PDF diff) |
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
| 45, 35, 36, 37, 103 | refreshed 10-08 | not touched; blocked: real gen / owner profile |
| 89, 110, 114, 115 | model table / token / telemetry / meter | not touched; token healthy (6.2 d) |

ACTIVE 90 → 88.

## Evidence index
- `docs/qa/PANEL_BUTTON_AUDIT_2026-10-09.md` + `.json` (with the "Diff vs previous" block against `PANEL_BUTTON_AUDIT_2026-10-08.json`).
- `docs/qa/last-browser-qa.json` (ranAt 2026-10-09T07:25Z).
- D1: `SELECT date(ts,'unixepoch') d, provider, model, task, COUNT(*) n FROM llm_calls GROUP BY d, provider, model, task ORDER BY d DESC LIMIT 12` via the D1 MCP connector; newest 2026-09-28; `changed_db:false`.
- Live fetches: `curl -sL https://antcv.pages.dev/` and `/app.js?v=1.51.4812-import-rewrap-siblings` compared with `cmp` after `tr -d '\r'`.
- Tests before push: suite 1821/1821 at baseline (no code changed); `check-cache-bust.mjs --range origin/main..HEAD` OK (no pwa asset); `check-register.mjs` OK after the edits.

## Owner-verify
- Row 52 (now closed): open a CV whose TOOLS & METHODS group has an empty sub-group; the heading must be absent in preview and export. A regression is a new row.
- Row 14 (now closed): if a JD scan hallucinates again, file a new row with the file and the output.
- Next E3 report: "Diff vs previous" should keep showing 0 regressions.

## Owner decisions
- Branch protection: make "AntCV PR gate" a required status check on `main`. Unchanged from 10-06.
- Row 39a: name a scratch application id for the downgrade PUT. Unchanged from 10-05.
- Row 115: meter by served model id, yes or no. Unchanged from 10-04.
- One real generation on the owner's key settles rows 39, 42, 35, 36, 37 and the opus-5-5 telemetry question at once. Nothing in `llm_calls` since 2026-09-28.
- Rows 3 / 20 / 25 all wait on one real CloudConvert export session. One sitting clears three rows.

## Non-claims
- No pwa loaded asset changed; no cache-bust; no version consumed from the lane; no worker deployed.
- Rows 38-44 are attested served-and-identical, not exercised end-to-end.
- Closing rows 14 and 52 rests on code presence, tests and the live bundle, not on a fresh owner eyeball; both are listed above for a non-blocking owner check.
