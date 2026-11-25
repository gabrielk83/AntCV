# Desktop nightly 2026-11-25 (Gabo-PC, Opus 5.5)

**Outcome:** one fix set shipped and live: EDITOR-IDLE-CHURN, PWA `1.51.6645-idle-churn`. Eleven red diags now green (row 152). E1-E4 done. Live attest PASS. No new rows.

## Preflight / sync

- `routine-preflight start` exit 3: owner WIP in the shared clone (`package.json`, `workers/access-relay/*`, untracked DAMC doc). Worked in `C:/Users/Karpg/antcv-worktrees/routine-antcv-nightly-mwwhvbi5`.
- Base `d76fb56a`; the claim rebased onto the job-tracker run, the push onto `42ddc965`.
- TOKEN OK, expires 2026-12-02T19:10Z (7.0 d left; 5.6 d at start, the expiry moved during the run, cause not checked). DISPATCH GAP 1.5 d (previous start 11-24 07:10Z), no gap warning printed.
- Shift claim 1.51.6645-1.51.6664; used 1.51.6645.

## Duplicate / CI overlap

No desktop entry for today. CI run `45602955404` failed in 37 s: credit balance too low (row 136). Full run.

## Baseline → final

| Check | Baseline | Final |
|---|---|---|
| `run-tests.mjs pwa` | 2196 pass, 0 fail | 2204 pass, 0 fail |
| `boot-smoke.mjs` | glDemo=function, errors=0 | same |
| `check-register.mjs` | OK, 106 rows | OK (after edits) |
| `diag-rerender-storm` | FAIL 34.4 mutations/s, 92 rAF/s | OK 1.2/s, 10 rAF/s |

## Bands A-D

| Row | Status |
|---|---|
| 45 PERF-001 | **shipped** (idle half). Export / preview stall blocked: owner session, real LLM gen. |
| 152 `DIAG-FLEET-ROT-001` | **advanced**: 11 green, 58 of 74 left. |
| 41 SO-004 | **verified**: stress diag repaired, 0 React #185. Blocked: real device. |
| 151 `TAB-CLAIM-WIPE-001` | blocked: owner decision. Not re-checked. |
| 147, 153, 154 | blocked: owner decision. Not re-checked. |

Other Band A-D rows: no safe unattended leg (real device, real LLM gen, owner session). D1 `llm_calls`: 246 rows, newest 2026-11-08, unchanged. Not individually re-checked.

## The fix

Causes, evidence and limits: ACTIVE_BUGS top entry. Four sidecars, 8 unit tests (4 red pre-fix). Checked in a headless editor: overlay stays visible (0 class toggles in 8 s), alt-circle dropdown opens and closes, both FABs stay hidden, 0 page errors.

## Band E

### E1 (stalest by `check-register --stalest`)

| Row | Status | Blocker for the rest |
|---|---|---|
| 99 `REG-GROUP-FOLD-NAMED-001` | **verified** | owner check |
| 110 `ANTCV-TOKEN-EXPIRED-2026-09-02-001` | **verified** | owner decision (machine token) |
| 19 `JD-SCOPE-OCC2-GUARD-001` | **verified** | real device |
| 45 PERF-001 | **advanced** | owner session, real LLM gen |
| 35 `OVERLAY-EARLY-HALT-001` | **verified** | real LLM gen |
| 136 `CI-NIGHTLY-CREDIT-EXHAUSTED-001` | **verified**, day 28 | owner key top-up |

Row 106 was re-verified by the job-tracker run today.

### E2 Settings-panel churn

`--selftest` PASS; real run 4/4 panels at rest, before and after the fix.

### E3 button audit pass 2

214 buttons (211 on 11-24), 0 regressions, 0 page errors (`PANEL_BUTTON_AUDIT_2026-11-25.md`). One visibility change (CJLR cycle hidden 3 → 7), state-dependent. Run before the fix.

### E4 export/preview parity

OK before and after the fix.

## Live attest (after deploy run `45691133005`)

- `sw.js` CACHE, boot seed, version-override `?v` and the four sidecar `?v` = `1.51.6645-idle-churn`; `app.js?v=1.51.6605-jd-remove` = repo.
- sha1 live = repo: overlay `1e589eea`, metric-guard `4c4382e7`, mobile-ui `68aac40a`, owner-guard `fb541bfe`, `app.js` `a741b809`.
- `diag-live-guard-sidecars` 9/9; `browser-qa --only version-live,sidecars-live` 2/2.
- `/health` 200 on all four. Versions read before the push: cv-proxy and antcv-demo-proxy `3.8.4-brand-ink-match`, docx-worker `1.14.177-role-line-one`, relay `auth-41-jt-doc-size`.

## Evidence index

- `pwa/test/unit/editor-idle-churn.test.mjs`, `pwa/test/diag-rerender-storm.mjs`, the ten diags named in row 152.
- `docs/qa/PANEL_BUTTON_AUDIT_2026-11-25.md` / `.json`. Deploy run `45691133005`.
- Register rows 19, 35, 41, 45, 99, 110, 136, 152.

## Owner-verify

- Desktop editor, real application: the bottom-right overlay buttons do not blink while you read.

## Owner decisions

- Row 152: a role you drag goes back to reverse-chronological. 06-16 said a manual order stands; 06-19 canonical order wins in code. Which?
- Row 154: settings-JSON import appends to the banned lists, or replaces as today?
- Row 153: `npm audit fix` now (5 packages, no major), vite 8 later?
- Row 151: the two-part tab-claim fix.
- Row 147: deploy cv-proxy + antcv-demo-proxy (POSTING-GUARD-001).
- Row 136: CI key credit.

## Non-claims

- No signed-in click-through, no real generation, no mutation count measured on prod with a real account.
- How many real documents met the overlay fight is not known.
- The multi-second export / preview stall (row 45) was not profiled.
- Shell-sticky still fights the overlay when a document is emptied after being shown; not changed.
- In the headless alt-circle probe, picking another colour did not move the trigger mark, the same before and after this change; not investigated.
- 58 diags are still red; none is claimed harmless.
