# Desktop nightly 2026-11-23 (Gabo-PC, Opus 5.5)

**Outcome:** one fix shipped and live: JD-REMOVE-STICKY-002, PWA `1.51.6605-jd-remove`. E1-E4 done. Live attest PASS. Two new rows (151, 152).

## Preflight / sync

- `routine-preflight start` exit 3: owner WIP in the shared clone (`package.json`, `workers/access-relay/*`, untracked DAMC doc; clone 264 commits behind). Worked in `C:/Users/Karpg/antcv-worktrees/routine-antcv-nightly-mwsxbajw`.
- Base `140e00bb`; rebased onto `97a30cf8` (job-tracker nightly) before push.
- TOKEN OK, expires 2026-11-29T16:55Z (6.4 d left). DISPATCH GAP: none (previous start 0.6 d ago).
- Shift claim 1.51.6605-1.51.6624; used 1.51.6605.

## Duplicate / CI overlap

No CI report since 10-28 and no desktop entry for today. Full run. Today's CI run had not fired yet at run time; the last one (`45009140371`, 11-22) failed on credit (row 136, not re-dated).

## Baseline → final

| Check | Baseline | Final |
|---|---|---|
| `run-tests.mjs pwa` | 2176 pass, 0 fail | 2181 pass, 0 fail |
| `boot-smoke.mjs` | glDemo=function, errors=0 | same |
| `check-register.mjs` | OK, 101 rows | OK (re-run after edits) |

## Bands A-D

| Row | Status |
|---|---|
| 83 `JD-REMOVE-OWNER-VERIFY-001` | **shipped** JD-REMOVE-STICKY-002. Blocked to close: owner session (one pass). |
| 39a tab isolation | **verified**; side finding filed as row 151. |
| 151 `TAB-CLAIM-WIPE-001` | **new**, reproduced headless on pristine main. Blocked: owner decision (two-part fix in the isolation path). |
| 147 `PROXY-POSTING-GUARD-UNDEPLOYED-001` | **verified** still undeployed (11-05). Blocked: owner decision. |
| 152 `DIAG-FLEET-ROT-001` | **new**: 74 of 217 diags red on pristine main. |

Other Band A-D rows: no safe unattended leg (real device, real LLM gen, owner session). D1 `llm_calls` newest day still 11-08. Not individually re-checked this run.

## The fix (row 83)

Pre-fix, both orders, on the served code: Remove the JD, edit anything, refresh → the JD is back (list first) or the chip is empty for a JD that should show (prefs first). Four causes and the fix are in the ACTIVE_BUGS top entry. Regression check: the 217-diag sweep on a pristine worktree and on the patched tree gives the same failure set, except `foundation-controls`, which also fails 3 of 4 runs on pristine.

## Band E

### E1 (stalest by `check-register --stalest`, all 10-27)

| Row | Status | Evidence |
|---|---|---|
| 68 `JD-SYNC-001` | **verified** | `brandfit-per-app-scope` still `fc2477c`. Blocked: owner session / regen. |
| 75 | **verified** | island source + tests 11/11, 9/9. Blocked: live add-test. |
| 77 | **verified** | top5-rescore 11/11. Blocked: owner decision. |
| 81 | **verified** | photo-leak OK, remove-last-reset 9/9, photo-ui-merge OK after a stale-pin fix. Legs b, c, e: owner eyeball. |
| 83 | **shipped** | above. |

### E2 Settings-panel churn

`--selftest` PASS; real run 4/4 panels at rest.

### E3 button audit pass 2

212 buttons (213 on 11-22), 0 regressions, 0 page errors (`PANEL_BUTTON_AUDIT_2026-11-23.md`). Visibility and label changes are state-dependent.

### E4 export/preview parity

RESULTS-PREVIEW-EXPORT-PARITY OK, 0 page errors.

## Live attest (after deploy run `45135566027`)

- `sw.js` CACHE `antcv-1.51.6605-jd-remove`, boot seed and `app.js?v=1.51.6605-jd-remove` served; `app.js` sha1 `a741b809…` = repo, marker count 8 = 8.
- `diag-live-guard-sidecars` 9/9; `browser-qa --only version-live,sidecars-live` 2/2.
- `/health` 200: cv-proxy, antcv-demo-proxy, antcv-access-relay, docx-worker. docx-worker `1.14.177-role-line-one`, relay `auth-40-application-snapshots`.

## Evidence index

- `pwa/test/diag-jd-remove-sticky.mjs`, `pwa/test/unit/jd-remove-tombstone.test.mjs` (8 → 13).
- `docs/qa/PANEL_BUTTON_AUDIT_2026-11-23.md` / `.json`.
- Deploy run `45135566027`. Register rows 83, 151, 152.

## Owner-verify

- Row 83: on a targeted application press ✕ Remove, edit a line, refresh: the JD stays removed. Reopen it from the Job Tracker: the JD is back.
- Row 81 b, c, e: photo menu after a hard refresh.

## Owner decisions

- Row 151: approve the two-part tab-claim fix? Until then, reloading a second tab can move it to the other tab's application.
- Row 147: deploy cv-proxy + antcv-demo-proxy (POSTING-GUARD-001, merged 11-05).
- Row 136: CI key credit.

## Non-claims

- No signed-in click-through, no real generation. Row 83 is proven on a mocked relay plus byte-identity of the live bundle.
- The relay's own handling of a blank `jd_text` was not read (a privacy hook blocked the source grep; not retried). Only the D1 count is evidence.
- Failing diags in row 152 were not triaged; none is claimed harmless.
- Today's CI nightly result is unknown.
