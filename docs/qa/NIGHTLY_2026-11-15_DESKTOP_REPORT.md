# Desktop nightly 2026-11-15 (Gabo-PC, Opus 5.5)

**Outcome:** one fix shipped and deployed. DOCX-ROLE-LINE-UNDEPLOYED-001: the #404 role-line change was in the docx-worker source but never deployed; now live at `1.14.177-role-line-one`. E1-E4 PASS. Live attest PASS at `1.51.6571-role-line-one`.

## Preflight / sync

- `routine-preflight start` exit 3: owner WIP in the shared clone (`package.json`, `workers/access-relay/src/index.js`, its test, an untracked DAMC doc). Worked in `C:/Users/Karpg/antcv-worktrees/routine-antcv-nightly-mwi2zsvi`.
- Base HEAD `1b6aa4de` (#405, 1.51.6571 CI follow-up).
- TOKEN valid, 2.3 d left (expires 2026-11-17T23:14Z). Expiry warning.
- DISPATCH GAP 1.1 d (previous start 11-14 14:33).
- No shift claim: no `pwa/` asset touched, no version number consumed.

## Duplicate / CI overlap

No CI report since 10-28. `nightly.yml` run `43699195823` (11-15) failed in 29 s: `Credit balance is too low`. No desktop entry for today in the runlog. Full run.

## Baseline

| Check | Before | After |
|---|---|---|
| `run-tests.mjs pwa` | 2162/2162 | 2162/2162 (no `pwa/` change) |
| `boot-smoke.mjs` | glDemo=function, errors=0 | not re-run (no `app.js` change) |
| `check-register.mjs` | OK, 99 rows | OK, 99 rows |
| docx-worker tests | — | 82/82 after the VERSION bump |

## Shipped

| ID | Status |
|---|---|
| `DOCX-ROLE-LINE-UNDEPLOYED-001` | **shipped + deployed**. #404 (11-14) changed the classic role line in `workers/docx-worker/src/index.js` (ROLE-LOCATION-002: "title \| company · place<TAB>years") and the PWA preview. The PWA auto-deployed; the worker did not. VERSION stayed `1.14.176-slogan-case`; the last `deploy.yml target=docx-worker` dispatch was 11-08 13:21 UTC. Live preview and live export disagreed on every role with a location. Fix: VERSION → `1.14.177-role-line-one` (`3081c985`), deploy run `43739793563` green, `/health` = `1.14.177-role-line-one`. Live `/generate` probe (synthetic role, company + location) returns `Process Engineer \| Probe Labs · Odense<TAB>2021 - 2025`; old "years \| place" form absent. |

## Bands A-D

| Row | Status |
|---|---|
| 136 `CI-NIGHTLY-CREDIT-EXHAUSTED-001` | **verified**. Day 18. Blocked: owner (key top-up). |
| Other A-D rows | not advanced. Blockers unchanged: owner click-through, real device, real LLM gen. No signed-in pane drive: the pane profile is shared with the owner's tabs. |

## Band E

| Leg | Result |
|---|---|
| E1 row 95 `CV-POLISH-BATCH-001` | verified. Cell cap still in the gen prompt (`app.src.js` ~3918). Blocked: real LLM gen. |
| E1 row 93 `AUTO-ANALYSE-ON-JD-LOAD-ERROR-001` | verified. Sidecar loaded, 7 markers, no trap. Blocked: owner repro. |
| E1 row 53 `CROSS-APP-EXPORT-CONTAMINATION-001` | verified. MIRROR-LOAD-001 2×, retired guard 0 refs. Blocked: real targeted export. |
| E1 row 54 `GEN-JD-TAILOR-KERNEL-RECALL-001` | verified not started (0 markers). Blocked: real LLM gen. |
| E2 Settings churn | `--selftest` PASS; diag PASS, 4/4 panels at rest. |
| E3 button audit pass 2 | 206 buttons (212 on 11-14), 0 regressions, 0 page errors. Labels gone "⇥ Fit", "CJLR: cycle"; added "What I Bring row 0". Same flap as 10-30, 11-05, 11-09, 11-11. `PANEL_BUTTON_AUDIT_2026-11-15.{md,json}`. |
| E4 Results preview/export parity | RESULTS-PREVIEW-EXPORT-PARITY OK. |

## Live attest

- Served `sw.js` CACHE `antcv-1.51.6571-role-line-one` = repo.
- Served `app.js?v=1.51.6571-role-line-one` = repo.
- `diag-live-guard-sidecars.mjs`: 9/9 served, executed, content-identical.
- `browser-qa --only version-live,sidecars-live`: 2/2 PASS.
- `/health` 200: cv-proxy `3.8.4-brand-ink-match`, antcv-demo-proxy, antcv-access-relay `auth-40-application-snapshots`, docx-worker `1.14.177-role-line-one` (after the deploy).

## Evidence index

- `docs/qa/PANEL_BUTTON_AUDIT_2026-11-15.md` / `.json`
- `docs/qa/last-browser-qa.json`
- deploy run `43739793563`; CI run `43699195823` log
- live `/generate` probe (synthetic payload, script kept in the session scratchpad)

## Owner-verify

- Export one real CV with a located role and check the role line: "title | company · place", years alone on the right.

## Owner decisions

1. Row 136: top up or rotate `ANTHROPIC_API_KEY`. 18 days with no CI band coverage.
2. Relay token expires 2026-11-17: re-save `~/.antcv/token` before then.
3. Rows 97, 141, 142: still pending from 11-14.

## Non-claims

- The probe used the two-column renderer only; the linear path (`buildLinearCvDocument`) is covered by the unit tests, not probed live.
- No real-data export, no signed-in click-through, no live regeneration.
- The VERSION string was also stale across the 11-05 and 11-08 deploys; this run did not audit what those deploys carried beyond the 11-08 timing.
