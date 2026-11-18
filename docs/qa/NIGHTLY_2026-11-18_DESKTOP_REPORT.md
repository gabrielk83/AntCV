# Desktop nightly 2026-11-18 (Gabo-PC, Opus 5.5)

**Outcome:** quiet night, no code change. E1-E4 PASS. Live attest PASS. Rows 136 and 147 still need the owner.

## Preflight / sync

- `routine-preflight start` exit 3: owner WIP in the shared clone (`package.json`, `workers/access-relay/*`, an untracked DAMC doc). Worked in `C:/Users/Karpg/antcv-worktrees/routine-antcv-nightly-mwlsegq9`.
- Base HEAD `9774bd3a` (job-tracker Workday fix; no `pwa/` change since the 11-17 run at `6b92824c`).
- TOKEN OK, expires 2026-11-24T18:15Z (6.5 d left).
- DISPATCH GAP: no gap line printed; previous start 2026-11-17T18:09Z (0.5 d).
- No shift claim: no `pwa/` asset touched, no version number consumed.

## Duplicate / CI overlap

No CI report since 10-28. Last `nightly.yml` run `44067429387` (11-17) failed, credit (row 136). Today's run had not fired at start time. No desktop entry for today in the runlog. Full run.

## Baseline

| Check | Before | After |
|---|---|---|
| `run-tests.mjs pwa` | 2175/2175 | 2175/2175 (no `pwa/` change) |
| `boot-smoke.mjs` | glDemo=function, errors=0 | not re-run (no `app.js` change) |
| `check-register.mjs` | OK, 103 rows | OK, 103 rows |

## Bands A-D

| Row | Status |
|---|---|
| 136 `CI-NIGHTLY-CREDIT-EXHAUSTED-001` | **verified** unchanged (no new run since 11-17). Day 21. Blocked: owner (key top-up). |
| 147 `PROXY-POSTING-GUARD-UNDEPLOYED-001` | **verified** still undeployed. cv-proxy last deployment 11-05 10:07Z, antcv-demo-proxy 08:38Z. Blocked: owner call. |
| Other A-D rows | not advanced. Blockers unchanged: owner click-through, real device, real LLM gen. No signed-in pane drive: the pane profile is shared with the owner's tabs. |

## Band E

| Leg | Result |
|---|---|
| E1 row 41 (SO-004, React #185) | verified. Guard sidecars 9/9 live; E3 0 page errors. Blocked: real device. |
| E1 row 42 `GEN-LANGFAB-001` | verified. D1 `llm_calls` newest day 2026-11-08 (13 calls); no fresh gen to check. Blocked: real LLM gen. |
| E1 row 43 (CA-006 label bleed) | verified unchanged; E4 parity OK. Blocked: owner session. |
| E1 row 44 `JD-ANALYSIS-PRINT-001` | verified. Sidecar loaded at `?v=1.51.2072-analysis-cloudconvert`, untouched since 07-22. Blocked: owner session. |
| E1 row 63 `ANALYSIS-STALE-ON-APP-LOAD-001` | verified. Unsol-guard at `app.src.js:18892`, `__antcvUnsol` 37 refs. Blocked: owner session. |
| E2 Settings churn | `--selftest` PASS; diag PASS, 4/4 panels at rest. |
| E3 button audit pass 2 | 212 buttons (212 on 11-17), 0 regressions, 0 recoveries, 0 page errors. One label gone: "What I Bring row 0 alignment" (the usual flap). One visibility move: CJLR cycle hidden 4 -> 5 (state left by an earlier click). `PANEL_BUTTON_AUDIT_2026-11-18.{md,json}`. |
| E4 Results preview/export parity | RESULTS-PREVIEW-EXPORT-PARITY OK. |

## Live attest

- Served `sw.js` CACHE `antcv-1.51.6585-askai-insight` = repo.
- Served `app.js?v=1.51.6571-role-line-one` = repo.
- `diag-live-guard-sidecars.mjs`: 9/9 served, executed, content-identical (unauthenticated 401s in the console, expected without sign-in).
- `browser-qa --only version-live,sidecars-live`: 2/2 PASS.
- `/health` 200: cv-proxy `3.8.4-brand-ink-match`, antcv-demo-proxy `3.8.4-brand-ink-match`, antcv-access-relay `auth-40-application-snapshots`, docx-worker `1.14.177-role-line-one`.

## Evidence index

- `docs/qa/PANEL_BUTTON_AUDIT_2026-11-18.md` / `.json`
- `docs/qa/last-browser-qa.json` (not committed; local)
- wrangler D1 SELECT on `llm_calls` (date grouping, read-only)
- `wrangler deployments list` for cv-proxy and antcv-demo-proxy (read-only)

## Owner-verify

- ASKAI-INSIGHT-001: one real Insight turn on live (owed since 11-17).
- Export one real CV with a located role and check the role line (owed since 11-15).

## Owner decisions

1. Row 147: deploy POSTING-GUARD-001 to cv-proxy and demo-proxy, or not. If yes, bump VERSION in both first.
2. Row 136: top up or rotate `ANTHROPIC_API_KEY`. 21 days with no CI band coverage.
3. Rows 97, 141, 142: still pending.

## Non-claims

- No real-data export, no signed-in click-through, no live regeneration, no worker deploy.
- Row 42: no generation output was read; only the call count by day.
