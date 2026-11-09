# AntCV desktop nightly — 2026-11-09

**Outcome:** fixed DISCOVERY-MED-MUST-EXAMPLE-002 (new row 143, script only, no version consumed): four false negatives left by the parallel row 137 fix. Band E1-E4 PASS. Live attest PASS at `1.51.6565-tab-rationale`. CI nightly still down (row 136, 11 days).

## Preflight / sync

- Host: Gabo-PC, Opus 5.5, scheduled run.
- `routine-preflight start`: exit 3 WORKSPACE DIRTY (owner WIP in `package.json`, `workers/access-relay/src/index.js`, `workers/access-relay/tests/cluster-qual-fit-scoring.test.mjs`). Worked in `C:/Users/Karpg/antcv-worktrees/routine-antcv-nightly-mw8z49ad` on `origin/main` `be3462aa`. Shared clone not touched. Owner WIP not read, built or tested.
- TOKEN OK, expires 2026-11-15T21:12Z (6.5 d left).
- **DISPATCH GAP 4.0 d.** Previous start 2026-11-05. No desktop nightly fired 11-06, 11-07, 11-08.
- No shift claim: no `pwa/` asset changed, no version number consumed.

## Duplicate / CI overlap

- No CI report since `NIGHTLY_2026-10-28_CI_REPORT.md`. No DESKTOP NIGHTLY entry for today, so a full run.
- CI nightly runs: 11-05 `42002739245`, 11-06 `42194757703`, 11-07 `42356948509` failed `is_error:true`; the 11-07 artifact ends `Credit balance is too low`, `terminal_reason: api_error`. 11-08 `42465207013` failed earlier: `Unexpected HTTP response: 504`, exit 127. Row 136 updated.

## Baseline

| Check | Before | After |
|---|---|---|
| `node scripts/run-tests.mjs pwa` | 2160/2160 | 2160/2160 (no `pwa/` change) |
| `node pwa/test/boot-smoke.mjs` | glDemo=function, errors=0 | same (no `app.js` change) |
| `node scripts/check-register.mjs` | OK, 98 ACTIVE | OK, 98 ACTIVE |

## Bands A-D

| Row | Status |
|---|---|
| A-D rows | not advanced. Same blockers as 11-05: signed-in real LLM generation, second physical device, real mobile device, owner eyeball. |
| 137 `DISCOVERY-MED-MUST-EXAMPLE-001` | closed by the job-tracker nightly (`5f96a813`, 09:11) while this run had its own fix in a worktree. Duplicate dropped at rebase. |
| 143 `DISCOVERY-MED-MUST-EXAMPLE-002` | **shipped** (script only), new row. Close after the next position-discovery run. |
| 141 `ACCOUNT-ERASE-COMPLETE-001` | **verified** stale status. Index said "FIXED IN PR, not deployed". The erase code is on main (#388) and the live relay reports `auth-40-application-snapshots` = repo. No live erase run (destructive). Owner close call. |
| 142 `META-LEAK-GATE-001` | **verified** stale status. Merged as #402 + #403; `test_meta_guard.py` ALL PASS. Owner close call. |
| 140 `JT-EC-RESULTS-DERIVE-001` | not touched; still owner export eyeball. |

**Row 143 detail.** This run fixed row 137 first (red-before on the two 11-01 sentences, 7 checks). At push, `git pull --rebase` met `5f96a813`: the job-tracker nightly fixed the same row 40 minutes earlier. My commit was dropped. My negative controls, run against `5f96a813`, gave 4 FAIL:

1. "At least 5 years of medical device experience, such as ISO 13485 or IEC 62304 work, is required." passed. The skip looked only at the list, not at the medical term before it. This breaks GATE-002.
2. "Minimum 5 years of experience such as medical device or medtech development." passed: every list item is medical.
3. "salary likely below the envelope" passed.
4. "below the envelope on pay" passed. The envelope branch took only a pay word right after "envelope(s)".

Fix on top of `5f96a813`, its structure kept: the skip needs no medical term before the list and one non-medical item (`_example_items` returns `(n, other)`); `_BELOW_FLOOR` adds a pay word up to 40 characters before or 25 after "below the envelope". 4 new checks, red on `5f96a813`, 102/102 PASS after; the row 137 checks stay green.

## Band E

| Leg | Result |
|---|---|
| E1 row 130 `ANALYTICS-EXPORT-SLOW-001` | verified. Serial `await kv.get(k.name)` still at `workers/proxy/src/analytics-export.js:75`. Blocked: owner decision + cv-proxy deploy. |
| E1 row 27 `MAIN-RUNT-ORPHAN-SWEEP-001` | verified. Four ORPHAN-PREFLIGHT-V3 sidecars loaded once each. Blocked: real render / regen. |
| E1 row 28 `NIL-GEN-ADAPTATION-001` | verified. Both sidecars loaded once each. Blocked: real LLM gen. |
| E1 row 29 `NIL-TARGETED-STATE-STICK-001` | verified. Markers ×2 / ×5 / ×3 as before. Blocked: live writer-hunt (owner session). |
| E1 row 96 `CV-HEADER-BOX-001` | verified. `AntCVHeadBox` + `headerBox:` present; live docx-worker `1.14.176-slogan-case`. Blocked: owner eyeball. |
| E2 Settings churn | `--selftest` PASS; diag PASS, 4/4 panels at rest. |
| E3 button audit pass 2 | 212 buttons (212 on 11-05), 0 regressions, 0 recoveries, 0 page errors. "Make It Fit (sidebar)" hidden 0 → 1 (was 1 → 0 on 11-05: state flap). Labels "⇥ Fit" / "What I Bring row 0 alignment" swapped back (same flap). `PANEL_BUTTON_AUDIT_2026-11-09.{md,json}`. |
| E4 Results preview/export parity | RESULTS-PREVIEW-EXPORT-PARITY OK. |

## Live attest

| Check | Result |
|---|---|
| served `sw.js` CACHE | `antcv-1.51.6565-tab-rationale` = repo |
| served seed / `app.js?v` | `1.51.6565-tab-rationale` / `1.51.6445-open-stale-tab` = repo |
| `diag-live-guard-sidecars.mjs` | PASS, 9/9 served, executed, identical (unauthenticated 401 lines only) |
| `browser-qa --only version-live,sidecars-live` | 2/2 PASS |
| `/health` ×4 | 200: access-relay `auth-40-application-snapshots`, cv-proxy + demo-proxy `3.8.4-brand-ink-match`, docx-worker `1.14.176-slogan-case` |

No PWA push this run, so no post-push live check owed.

## Evidence index

- Fix commit (row 143) on top of `5f96a813`; dropped duplicate `38ef559d` (local only).
- `docs/qa/PANEL_BUTTON_AUDIT_2026-11-09.md` + `.json`.
- CI runs `42002739245`, `42194757703`, `42356948509` (artifact), `42465207013`.
- Suite, E2/E4 and live logs: `C:/Users/Karpg/antcv-worktrees/nightly-logs/` (not committed, removed with the worktree).
- Register: `OPEN_REGISTER.md` (rows 141, 142, 136, 130, 27, 28, 29, 96 → 2026-11-09; new row 143), `REGISTER_ACTIVE_DETAIL.md` (same rows), `REGISTER_RUNLOG.md`, `ACTIVE_BUGS.md` top block.

## Owner-verify

- Next position-discovery run: no lead skipped as "medical-device experience is a must" when medtech is one example of several, and no real medical must let through; then close row 143.

## Owner decisions

- **Top up or rotate `ANTHROPIC_API_KEY`** (row 136). CI nightly down 11 days (10-29..11-08). The 11-08 504 is a second failure mode; check after the key is fixed.
- **Desktop dispatch gap:** no desktop nightly 11-06..11-08. Routines are desktop-app-local; the token self-renews only while they fire.
- Close rows 141 and 142, or keep them for a live check.
- Row 130: approve the batched KV read + cv-proxy deploy, or retire the KV export.
- Token expires 2026-11-15. Re-save before then (row 110).

## Non-claims

- No real LLM generation, no export, no D1 read, no worker deploy this run.
- Row 143 is verified in unit checks only, not on a live discovery run.
- Two routines fixed row 137 the same morning. Both commit in the job-tracker scripts; the shift claim covers only version numbers, so it did not stop the overlap.
- Row 141: live erase not exercised; "deployed" rests on the live version string equal to the repo.
