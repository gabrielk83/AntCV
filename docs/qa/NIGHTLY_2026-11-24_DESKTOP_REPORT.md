# Desktop nightly 2026-11-24 (Gabo-PC, Opus 5.5)

**Outcome:** one fix shipped and live: IMPORT-SEMRULE-KEY-001, PWA `1.51.6625-semrule-union`. Five red diags repaired (row 152). E1-E4 done. Live attest PASS. Two new rows (153, 154).

## Preflight / sync

- `routine-preflight start` exit 3: owner WIP in the shared clone (`package.json`, `workers/access-relay/*`, untracked DAMC doc). Worked in `C:/Users/Karpg/antcv-worktrees/routine-antcv-nightly-mwucv4ag`.
- Base `471ff03f`. Origin did not move during the run.
- TOKEN OK, expires 2026-11-29T16:55Z (5.4 d left). DISPATCH GAP: none (previous start 1.0 d ago).
- Shift claim 1.51.6625-1.51.6644; used 1.51.6625.

## Duplicate / CI overlap

No desktop entry for today. No CI report since 10-28. Last CI run `45159047161` (11-23) failed in 32 s; cause not read this run (row 136, not re-dated). Full run.

## Baseline → final

| Check | Baseline | Final |
|---|---|---|
| `run-tests.mjs pwa` | 2181 pass, 0 fail | 2196 pass, 0 fail |
| `boot-smoke.mjs` | glDemo=function, errors=0 | same |
| `check-register.mjs` | OK, 104 rows | OK, 106 rows |

## Bands A-D

| Row | Status |
|---|---|
| 152 `DIAG-FLEET-ROT-001` | **advanced**: 5 of 74 fixed, 69 left. |
| 153 `SEC-AUDIT-DEV-DEPS-001` | **new**, transcribed from the weekly audit. Blocked: owner WIP in `package.json`. |
| 154 `IMPORT-BANNED-APPEND-001` | **new**, probed. Blocked: owner decision. |
| 151 `TAB-CLAIM-WIPE-001` | blocked: owner decision. Not re-checked. |
| 147 `PROXY-POSTING-GUARD-UNDEPLOYED-001` | blocked: owner decision. Proxies still report `3.8.4-brand-ink-match`; deployment list not re-read. |

Other Band A-D rows: no safe unattended leg (real device, real LLM gen, owner session). D1 `llm_calls`: 246 rows, newest day 2026-11-08. Not individually re-checked.

## The fix

Importing a settings JSON replaced the stored style constraints; a backup restore dropped the current ones. Causes and fix: ACTIVE_BUGS top entry. 15 tests (7 red pre-fix), `diag-data-import` CHECK E red pre-fix.

**Slip caught before push:** the patch script's escaping turned `/\s+/` into `/s+/`. Thirteen tests passed with it. Found by reading the diff; two checks now fail on it. The two unpushed local commits were rebuilt.

## Row 152 diags

`data-import`, `sidebar-ratio-forward`, `login-clean-reload`, `kernel-import`, `preview-edit-persist`: all stale assertions, reasons in the row. `kernel-import` failed once under load (sidecar not loaded inside its wait), then 3/3.

## Band E

### E1 (stalest by `check-register --stalest`, all 10-27)

| Row | Status | Blocker for the rest |
|---|---|---|
| 88 | **verified** | owner decision / real render |
| 87 `OWNER-ROUND-2-RESIDUE-001` | **verified** | owner session / regen |
| 86 `GOLD-SESSION-FOLLOWUPS-001` | **verified** | owner decision / regen |
| 31 `META-STATE-CORRUPTION-002` | **verified** | owner session |
| 98 `BYOK-COST-AUDIT-001` | **verified** | none, unreverted |

### E2 Settings-panel churn

`--selftest` PASS; real run 4/4 panels at rest.

### E3 button audit pass 2

211 buttons (212 on 11-23), 0 regressions, 0 page errors (`PANEL_BUTTON_AUDIT_2026-11-24.md`). One visibility change (CJLR cycle hidden 4 → 3), state-dependent.

### E4 export/preview parity

RESULTS-PREVIEW-EXPORT-PARITY OK, 0 page errors.

E2-E4 ran on the base, before the fix; the fix touches only the two import files.

## Live attest (after deploy run `45363491995`)

- `sw.js` CACHE, boot seed, version-override `?v` and both import `?v` = `1.51.6625-semrule-union`; `app.js?v=1.51.6605-jd-remove` = repo.
- sha1 live = repo: `antcv-data-importer.js` `9f39ee4f`, `antcv-data-import-331.js` `7c733c54`, `app.js` `a741b809`.
- Merge probe in a headless page on prod: 3 of 3 V2 rules kept, 3 of 3 flat rules kept, 0 page errors.
- `diag-live-guard-sidecars` 9/9; `browser-qa --only version-live,sidecars-live` 2/2.
- `/health` 200: cv-proxy and antcv-demo-proxy `3.8.4-brand-ink-match`, relay `auth-40-application-snapshots`, docx-worker `1.14.177-role-line-one`.

## Evidence index

- `pwa/test/unit/import-semrules-union.test.mjs`; the five diags above.
- `docs/qa/PANEL_BUTTON_AUDIT_2026-11-24.md` / `.json`.
- Deploy run `45363491995`; audit run `45255364657`. Register rows 31, 86, 87, 88, 98, 152, 153, 154.

## Owner-verify

- Settings → writing style: the style constraints list is complete. If an import since 2026-06-18 (1.50.613) shortened it, re-import the older file: it now adds.

## Owner decisions

- Row 154: should a settings-JSON import append to the banned words and phrases, or replace them as today?
- Row 153: `npm audit fix` now (5 packages, no major), vite 8 later?
- Row 151: the two-part tab-claim fix.
- Row 147: deploy cv-proxy + antcv-demo-proxy (POSTING-GUARD-001).
- Row 136: CI key credit.

## Non-claims

- No signed-in click-through, no real generation, no import through the real dialog on prod.
- Not known whether any real account lost constraints; D1 personal data was not read.
- The three `orphan-preflight-*` diags look stale but are not proven.
- 69 diags are still red and untriaged; none is claimed harmless.
- Today's CI nightly had not fired.
