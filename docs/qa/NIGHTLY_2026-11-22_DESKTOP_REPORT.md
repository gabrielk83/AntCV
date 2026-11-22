# Desktop nightly 2026-11-22 (Gabo-PC, Opus 5.5)

**Outcome:** quiet night, no code change. E1 rows 40/66/69/100/101 verified. E2-E4 PASS. Live attest PASS. No `pwa/` asset, no version consumed, no shift claim.

## Preflight / sync

- `routine-preflight start` exit 3: owner WIP in the shared clone (`package.json`, `workers/access-relay/*`, untracked DAMC doc). Worked in `C:/Users/Karpg/antcv-worktrees/routine-antcv-nightly-mws2oysf`.
- Base HEAD `e5602975` (origin/main; no commit since the 11-20 job-tracker run).
- TOKEN OK, expires 2026-11-26T21:16Z (4.2 d left).
- DISPATCH GAP: none printed. Previous start 2026-11-20T09:13Z (2.3 d): the 11-21 desktop nightly did not fire (no `start` line, no runlog entry).
- No shift claim: docs-only run.

## Duplicate / CI overlap

No CI report since 10-28. `nightly.yml` run `45009140371` (11-22 09:46Z) failed in 36 s: `Credit balance is too low | is_error=true api_error_status=400 turns=1`. Same for `44891389898` (11-21). Row 136 signature. No desktop entry for today in the runlog. Full run.

## Baseline

| Check | Result |
|---|---|
| `run-tests.mjs pwa` | 2176 pass, 0 fail |
| `boot-smoke.mjs` | glDemo=function, errors=0 |
| `check-register.mjs` | OK, 101 rows (re-run after edits) |

## Bands A-D

| Row | Status |
|---|---|
| 136 `CI-NIGHTLY-CREDIT-EXHAUSTED-001` | **verified** unchanged: 11-21 + 11-22 CI runs failed on credit. Day 25. Blocked: owner (key top-up). |
| 147 `PROXY-POSTING-GUARD-UNDEPLOYED-001` | **verified** still undeployed: cv-proxy + antcv-demo-proxy `/health` `3.8.4-brand-ink-match`. Blocked: owner call. |

No other Band A-D row has a safe unattended leg at this HEAD: the rest need a real device, a real LLM gen, or an owner session.

## Band E

### E1 staleness sweep (stalest by index `verified`, 10-26 / 10-27)

| Row | Status | Evidence |
|---|---|---|
| 40 (SO-003) | **verified** | `antcv-outcomes-loss-guard.js` on disk and loaded by `index.html` (1 ref); `core-comp-format-preserves-outcomes.test.mjs` 10/10; served bytes identical (live sidecar diag 9/9). Blocked: owner session (cloud-persisted repro). |
| 66 `LINKEDIN-CLICK-001` | **verified** | `DELIVERABLE_PREFLIGHT_CHECKLIST.md` present; live docx-worker `1.14.177-role-line-one`. Blocked: real LLM gen + owner eyeball. |
| 69 (CL polish / em-dash) | **verified** | `__AINOTICE` map present (2 refs); `AI-assisted - author` hyphen footer (4 refs). Standing-rule anchor. |
| 100 `GRAB-ZONE-DISMISS-THRESHOLD-001` | **verified** | `diag-mobile-grab-zone-touch.mjs` OK: A1 Sections + A2 Analysis 40 px graze scroll forward, grab zone kept; B 120 px swipe dismisses; 0 page errors. Blocked: real Android device. |
| 101 `ZOOM-FLOOR-001` | **verified** | same diag, leg C: minus button 46 % to 10 % floor, plus to 20 %. Floor `Math.max(.1,Math.min(5.2` present in `app.js` (1) and `app.src.js` (1). Blocked: real-device pinch. |

### E2 Settings-panel churn

`--selftest` PASS (probe sees injected churn on every tab). Real run: 4/4 panels at rest, DIAG PASS.

### E3 button audit pass 2

213 buttons, 0 regressions, 0 page errors (`PANEL_BUTTON_AUDIT_2026-11-22.md`). Diff vs 11-20: the SIDEBAR headline alignment cycle label and `⇥ Fit` flip between runs (state-dependent labels; the same flip appeared 11-20 in reverse). Not findings.

### E4 export/preview parity

RESULTS-PREVIEW-EXPORT-PARITY OK, 0 page errors.

## Live attest

- `diag-live-guard-sidecars.mjs`: 9/9 served, executed, content-identical.
- `browser-qa --only version-live,sidecars-live`: 2/2.
- Live `sw.js` CACHE `antcv-1.51.6585-askai-insight` = repo; live `app.js?v=1.51.6571-role-line-one` = repo.
- `/health` 200: cv-proxy + antcv-demo-proxy `3.8.4-brand-ink-match`, antcv-access-relay `auth-40-application-snapshots`, docx-worker `1.14.177-role-line-one`.

## Evidence index

- `docs/qa/PANEL_BUTTON_AUDIT_2026-11-22.md` / `.json`
- CI run `45009140371` failed-log line quoted above.

## Owner-verify

- Row 40: change the Core Competencies row count in a signed-in session; Selected Outcomes must survive.
- Rows 100/101: grab-zone graze + pinch zoom-out on the Android phone.

## Owner decisions

- Row 136: top up the CI key credit (day 25).
- Row 147: deploy cv-proxy + antcv-demo-proxy (POSTING-GUARD-001, merged 11-05).
- Token expires 2026-11-26 (4.2 d): re-save `~/.antcv/token` before then.

## Non-claims

- No signed-in click-through, no real generation, no D1 read this run.
- The 11-21 desktop nightly did not fire; cause not investigated (no log line).
