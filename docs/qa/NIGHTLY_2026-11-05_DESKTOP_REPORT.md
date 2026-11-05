# AntCV desktop nightly — 2026-11-05

**Outcome:** shipped JT-EC-RESULTS-DERIVE-001 (row 140) as `1.51.5322-ec-no-derive`, live-verified. Band E1-E4 PASS. CI nightly still down on the credit error (row 136, days 6-7).

## Preflight / sync

- Host: Gabo-PC, Opus 5.5, scheduled run.
- `routine-preflight start`: exit 3 WORKSPACE DIRTY (owner WIP in `package.json`, `workers/access-relay/src/index.js`, `workers/access-relay/tests/cluster-qual-fit-scoring.test.mjs`, same three files as 10-30 and 11-02). Worked in `C:/Users/Karpg/antcv-worktrees/routine-antcv-nightly-mw3apzse` on `origin/main` `784f0f72`. Shared clone not touched.
- TOKEN OK, expires 2026-11-12T08:32Z (7.0 d left). No DISPATCH GAP line printed. Previous start 2026-11-02 (2.5 d ago).
- Shift claim `1.51.5322-1.51.5341`. Used `1.51.5322`. Released at end.

## Duplicate / CI overlap

- No CI report since `NIGHTLY_2026-10-28_CI_REPORT.md`. No DESKTOP NIGHTLY entry for today, so a full run.
- CI nightly failed again 11-03 (`41611776624`) and 11-04 (`41805475423`). The 11-04 `claude-execution-output` artifact still ends `Credit balance is too low`, `terminal_reason: api_error`. Row 136 updated.
- Worker deploys since 11-02: APP-ROW-WRITE-GUARD-001 (relay, run `41555803774`), SLOGAN-CASE-001 (docx-worker, `41557185584`, live `1.14.176-slogan-case`), cost-quality tune ×3 (11-05). Nothing OWED.

## Baseline

| Check | Before | After |
|---|---|---|
| `node scripts/run-tests.mjs pwa` | 1914/1914 | 1915/1915 |
| `node pwa/test/boot-smoke.mjs` | glDemo=function, errors=0 | same |
| `node scripts/check-register.mjs` | OK, 96 ACTIVE | OK, 96 ACTIVE |

## Bands A-D

| Row | Status |
|---|---|
| 140 `JT-EC-RESULTS-DERIVE-001` | **shipped** `1.51.5322-ec-no-derive`, commit `9c8f1980`. Blocked for close: owner eyeball on a real export with an Earlier career block. |
| other A-D rows | not advanced. Same blockers as 11-02: signed-in real LLM generation, a second physical device, a real mobile device, or owner eyeball. |

**Row 140 detail.** Repro first: `applyOutcomesMode` on an Earlier career role with three "(YYYY - YYYY)" lines put the Students Council line into `results` and dropped it from the bullets (the app 3527 shape). Fix: one guard in `pwa/antcv-docx-client.js` before the tier-5 `deriveResultFromRole`: id `earlier-career` keeps every line as a bullet, no Results line. Tiers 1-4 unchanged. New `pwa/test/unit/earlier-career-no-derive.test.mjs` (5 checks): red before the fix on the earlier-career check, green after; an ordinary role still derives its "35%" bullet and hides it.

Cache-bust note: `hdr-type-controls.test.mjs` and `role-location.test.mjs` require `antcv-docx-client.js?v` to equal `app.js?v`. I followed the existing lockstep and moved the whole `1.51.5302` set in `index.html` (8 refs: app.js, docx-client, two slogan sidecars, copenhagen-v2, pdf-preview-gate, roles-richblock-adapter, role-line-format, rich-block-editor) plus version-override `?v`, `sw.js` CACHE, `TARGET_VERSION`, boot seed; `STALE_VERSIONS` += `1.51.5302-slogan-case`. `app.js` content not changed. `check-cache-bust --set` and `--range origin/main..HEAD` OK.

## Band E

| Leg | Result |
|---|---|
| E1 row 33 `WHY-RULE-EXPORT-PARITY-001` | verified. `antcv:nameLineAlign` ×2 + `headline_align` in docx-client, `headlineAlign` ×3 in docx-worker, `export-align-parity` green. Blocked: owner signed-in export eyeball. |
| E1 row 24 `ANALYTICS-BUTTONS-SESSION-TIMEOUT-001` | verified. `auth-401-wipe-scope` green. Blocked: owner click-through (row 130 tracks the slow export). |
| E1 row 26 `TOOLS-SIDEBAR-COMPRESS-001` | verified. `antcv-sidebar-compact-001.js` loaded once, `sidebar-compact` green. Blocked: owner visual on an unsolicited export. |
| E1 row 30 `LLM-IMAGE-ROUTING-001` | verified. `VISION_BLIND` ×3 in both `multi-llm.js`, `image-routing-ee` green. Code-complete; owner close call. |
| E1 row 32 `CL-PLATFORM-SIGNALS-001` | verified. `__platformRule` ×2 in app.src.js, `__pr` in app.js, `cl-platform-signals` green. Owner close call (real gen not run). |
| E2 Settings churn | `--selftest` PASS; diag PASS, 4/4 panels at rest. |
| E3 button audit pass 2 | 212 buttons (208 on 11-02), 0 regressions, 0 recoveries, 0 page errors. Moves: "Make It Fit (sidebar)" hidden 1 → 0; "CJLR: cycle …" hidden 2 → 6 (state flap class, seen 10-30 and 11-02); label gone "⇥ Fit"; label added "What I Bring row 0 alignment …". `PANEL_BUTTON_AUDIT_2026-11-05.{md,json}`. |
| E4 Results preview/export parity | RESULTS-PREVIEW-EXPORT-PARITY OK (run with the fix in place). |

## Live attest (after the push)

| Check | Result |
|---|---|
| deploy run `41997662336` | success |
| served `sw.js` CACHE | `antcv-1.51.5322-ec-no-derive` = repo |
| served `app.js?v` / `antcv-docx-client.js?v` / seed | `1.51.5322-ec-no-derive` = repo |
| served `antcv-docx-client.js` | sha256 identical to repo (CR-stripped), marker `JT-EC-RESULTS-DERIVE-001` present |
| `diag-live-guard-sidecars.mjs` | PASS, 9/9 served, executed, identical (one unauthenticated 401 console line, no session) |
| `browser-qa --only version-live,sidecars-live` | 2/2 PASS |
| `/health` ×4 | 200: access-relay `auth-38-subtitle-guard-qual-put`, cv-proxy + demo-proxy `3.8.4-brand-ink-match`, docx-worker `1.14.176-slogan-case` |

## Evidence index

- Commit `9c8f1980` (fix + test + cache-bust).
- `pwa/test/unit/earlier-career-no-derive.test.mjs`.
- `docs/qa/PANEL_BUTTON_AUDIT_2026-11-05.md` + `.json`.
- CI artifact `claude-execution-output` on run `41805475423`.
- Suite, E2/E4 and live logs: session scratchpad (not committed).
- Register: `OPEN_REGISTER.md` (rows 140, 136, 33, 24, 26, 30, 32 → 2026-11-05), `REGISTER_ACTIVE_DETAIL.md` (same rows), `REGISTER_RUNLOG.md`, `ACTIVE_BUGS.md` top block.

## Owner-verify

- Hard Refresh, open an application with an Earlier career block (app 3527 PEAK Wind after its regen), export: Earlier career shows no "Results:" line and keeps every summary line. Preview should match.

## Owner decisions

- **Top up or rotate `ANTHROPIC_API_KEY`** (row 136). CI nightly has now failed 7 days running (10-29..11-04).
- Rows 30 and 32 are code-complete; close or keep for a real-gen check.
- Token expires 2026-11-12. Re-save before then (row 110).

## Non-claims

- No real LLM generation, no CloudConvert export, no D1 read this run.
- Row 140 fix verified in unit, parity diag and served bytes; not on a real exported DOCX/PDF.
- The row 140 job-tracker report asked the owner to approve this `pwa/` change. This run shipped it under the nightly's own mandate (cache-bust protocol, shift lane, live verify). Revert is one guard line in `antcv-docx-client.js`.
- Owner WIP in the shared clone was not read, built or tested.
