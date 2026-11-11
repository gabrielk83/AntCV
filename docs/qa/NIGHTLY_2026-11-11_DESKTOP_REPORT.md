# Desktop nightly 2026-11-11 (Gabo-PC, Opus 5.5)

**Outcome:** shipped CI-NIGHTLY-CAUSE-SURFACE-001 (row 136 hardening: workflow step + script, no `pwa/` asset, no version consumed). E1-E4 PASS. Live attest PASS at `1.51.6565-tab-rationale`.

## Preflight / sync

- `routine-preflight start` exit 3: owner WIP in the shared clone (`package.json`, `workers/access-relay/src/index.js`, its test, an untracked DAMC doc). Worked in `C:/Users/Karpg/antcv-worktrees/routine-antcv-nightly-mwbaz1nw`.
- Base HEAD `42108afb` (the 11-09 desktop report). No commits on main since.
- TOKEN OK, 4.9 d left (expires 2026-11-15T21:12Z). Owner re-save due before 11-15.
- DISPATCH GAP 1.6 d (previous start 11-09). This fire ran at 00:19 local, not 08:00.
- No shift claim: no `pwa/` asset touched.

## Duplicate / CI overlap

No CI report since 10-28. `nightly.yml` runs 11-08 (504), 11-09, 11-10 failed. The 11-09 (`42596108759`) and 11-10 (`42793987453`) artifacts end `"result": "Credit balance is too low"`, `api_error_status: 400`, 1 turn. No desktop entry for today in the runlog. Full run.

## Baseline

| Check | Before | After |
|---|---|---|
| `run-tests.mjs pwa` | 2160/2160 | 2160/2160 (no `pwa/` change) |
| `boot-smoke.mjs` | glDemo=function, errors=0 | not re-run (no `app.js` change) |
| `check-register.mjs` | OK, 98 rows | OK |

## Bands A-D

| Row | Status |
|---|---|
| 136 `CI-NIGHTLY-CREDIT-EXHAUSTED-001` | **advanced**. Hardening shipped (below). Credit top-up still owner. 13 days down. |
| A-D rows | not advanced. Same blockers: signed-in real LLM gen, real device, owner eyeball. |

**CI-NIGHTLY-CAUSE-SURFACE-001.** The action log says only `result is_error:true`; the cause sits in the artifact. New step `Surface agent error cause` (`if: failure()`, after the artifact upload) runs `node scripts/ci-surface-agent-error.mjs`. It reads the last `type: "result"` entry and prints `::error::agent result: <text> | is_error=… api_error_status=… turns=…` plus the same line in the step summary. Always exits 0, so it never masks or adds a failure. Local proof:

- 11-10 artifact → `agent result: Credit balance is too low | is_error=true api_error_status=400 turns=1`
- 11-09 artifact with `GITHUB_STEP_SUMMARY` set → summary file gets the heading + line
- missing file → `no execution output file (agent never started)`
- bad JSON → `execution output unreadable: …`
- no result entry → `no result entry in execution output`

## Band E

| Leg | Result |
|---|---|
| E1 row 2 `LINKIFY-EXPORT-001` | verified. `sidebar_ratio` 2 refs; `main-column-ratio-width.test.mjs` 1/1. Residual in row 25 (real PDF). |
| E1 row 47 `MOBILE-TOPBAR-SAFEAREA-001` | verified. Safe-area padding in both bundles; tools-347 loaded once; FAB absent. Blocked: real phone. |
| E1 row 49 `SIDEBAR-GROUP-PAGE-BREAK-001` | verified, still not started. `CONT_SUFFIX` section-level only (`:24705`). Three worker commits since 10-23 do not touch it. |
| E1 row 50 `UPLOAD-SCREEN-TOP-CLIP-001` | verified. Test 4/4. Blocked: owner live check. |
| E1 row 51 `PREVIEW-SCROLL-JITTER-001` | verified. Test 3/3. Blocked: owner live check. |
| E2 Settings churn | `--selftest` PASS; diag PASS, 4/4 panels at rest. |
| E3 button audit pass 2 | 209 buttons (212 on 11-09), 0 regressions, 0 recoveries, 0 page errors, 0 labels gone. "CJLR: cycle left / center / right / justify" hidden 6 → 3: instance count, state flap class. `PANEL_BUTTON_AUDIT_2026-11-11.{md,json}` (the harness named it 11-10, UTC; renamed to the local date). |
| E4 Results preview/export parity | RESULTS-PREVIEW-EXPORT-PARITY OK. |

## Live attest

- Served `sw.js` CACHE `antcv-1.51.6565-tab-rationale` = repo.
- Served `app.js?v=1.51.6445-open-stale-tab` = repo.
- `diag-live-guard-sidecars.mjs`: 9/9 served, executed, content-identical (two 401s are the unauthenticated relay calls, expected).
- `browser-qa --only version-live,sidecars-live`: 2/2 PASS.
- `/health` 200: cv-proxy, demo-proxy, access-relay, docx-worker (`1.14.176-slogan-case`).

No PWA push this run, so no post-push live check owed.

## Evidence index

- `.github/workflows/nightly.yml` (+5 lines), `scripts/ci-surface-agent-error.mjs` (new)
- `docs/qa/PANEL_BUTTON_AUDIT_2026-11-11.md` / `.json`
- `docs/qa/last-browser-qa.json`
- CI artifacts `42596108759`, `42793987453` (downloaded to the session scratchpad, not committed)

## Owner-verify

- After the next failed scheduled CI nightly: the run summary should show "Nightly agent error" with the cause.

## Owner decisions

1. Row 136: top up or rotate `ANTHROPIC_API_KEY`. 13 days of no CI band coverage.
2. Relay token expires 2026-11-15: re-save `~/.antcv/token` before then.
3. Rows 141, 142 (from 11-09): close calls still pending.

## Non-claims

- The new CI step is not proven on a live runner yet.
- No signed-in click-through, no real generation, no worker deploy, no D1 read this run.
- Bands A-D rows other than 136 were not re-tested beyond the E1 five.

## Desktop cross-check (08:00 fire)

Second fire today; the 00:19 run above owns the day. Cross-check only. Worktree `routine-antcv-nightly-mwbu2014`, base `be1e3389`. No code change, no claim, no version consumed.

- TOKEN OK, 6.6 d left (expires 2026-11-17T23:14Z). Owner decision 2 above is done: the token was re-saved.
- CI nightly: no 11-11 run yet at fire time; last two (11-09, 11-10) failed. Row 136 unchanged.
- E2 Settings churn: `--selftest` PASS; diag PASS, 4/4 panels at rest.
- E3 button audit: 207 buttons (209 at 00:19), 0 regressions, 0 recoveries, 0 page errors. Label swap "CJLR: cycle …" / "What I Bring row 0 alignment …" is the known state flap (10-27, 10-30, 11-05, 11-09). Saved as `PANEL_BUTTON_AUDIT_2026-11-11-crosscheck.{md,json}`; the 00:19 files are kept.
- E4 parity: RESULTS-PREVIEW-EXPORT-PARITY OK.
- Live attest: `sw.js` CACHE `antcv-1.51.6565-tab-rationale` and `app.js?v=1.51.6445-open-stale-tab` = repo. Sidecars 9/9 identical (three 401s, unauthenticated relay, expected). `browser-qa` 2/2 PASS.
- `/health` 200: cv-proxy (`3.8.4-brand-ink-match`), antcv-demo-proxy, antcv-access-relay (`auth-40-application-snapshots`), docx-worker (`1.14.176-slogan-case`).

Non-claims: E1 not re-swept; Bands A-D not re-run; no signed-in step, no D1 read, no deploy.
