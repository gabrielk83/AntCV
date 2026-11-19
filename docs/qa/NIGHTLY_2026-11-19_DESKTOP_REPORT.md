# Desktop nightly 2026-11-19 (Gabo-PC, Opus 5.5)

**Outcome:** quiet night, no code change. E1 rows 18/34/58/59/64 verified. E1-E4 PASS. Live attest PASS. Rows 136 and 147 still need the owner.

## Preflight / sync

- `routine-preflight start` exit 3: owner WIP in the shared clone (`package.json`, `workers/access-relay/*`, an untracked DAMC doc). Worked in `C:/Users/Karpg/antcv-worktrees/routine-antcv-nightly-mwnri0dl`.
- Base HEAD `0dacf961` (job-tracker docs only since the 11-18 desktop run; no `pwa/` change).
- TOKEN OK, expires 2026-11-25T19:06Z (6.1 d left).
- DISPATCH GAP: no gap line printed; previous start 2026-11-18T07:15Z (1.4 d).
- No shift claim: no `pwa/` asset touched, no version number consumed.

## Duplicate / CI overlap

No CI report since 10-28. Today's `nightly.yml` run `44504715335` (10:20Z) failed in 34 s, `is_error:true` right after init. Same signature as row 136. No desktop entry for today in the runlog. Full run.

## Baseline

| Check | Before | After |
|---|---|---|
| `run-tests.mjs pwa` | 2168 pass, 0 fail, 7 skipped | same (no `pwa/` change) |
| `boot-smoke.mjs` | glDemo=function, errors=0 | not re-run (no `app.js` change) |
| `check-register.mjs` | OK, 102 rows | OK, 102 rows |

## Bands A-D

| Row | Status |
|---|---|
| 136 `CI-NIGHTLY-CREDIT-EXHAUSTED-001` | **verified** unchanged. Run `44504715335` failed the same way. Day 22. Blocked: owner (key top-up). |
| 147 `PROXY-POSTING-GUARD-UNDEPLOYED-001` | **verified** still undeployed. cv-proxy last deployment 11-05 10:07Z, antcv-demo-proxy 08:38Z. Blocked: owner call. |
| Other A-D rows | not advanced. Blockers unchanged: owner click-through, real device, real LLM gen. No signed-in pane drive: the pane profile is shared with the owner's tabs. |

## Band E

| Leg | Result |
|---|---|
| E1 row 18 `ANITA-PERSONA-NO-PHOTO-001` | verified. `import-rewrap-keeps-photo.test.mjs` 24/24. Blocked: real LLM gen (CL leg). |
| E1 row 34 `ROLE-MERGE-STORED-001` | verified. Sidecar loaded at `?v=1.51.5013-grab-zone-scroll-target`; merge hook exposed; `role-merge-stored.test.mjs` green in the suite. Done as filed. |
| E1 row 58 `EXPORT-SETTLED-001` | verified. `diag-mob009-autopages-device-parity` OK; `diag-export-settled-gate` PASS. Blocked: owner bad-split PDF / real device. |
| E1 row 59 `GENERATOR-BASELINE-001` | verified. Leg (C) "no renderer" is stale: LibreOffice + `scripts/orphan-audit.py` exist on this host. Leg (A) stays generator-owned. Blocked: owner session. |
| E1 row 64 `ANALYSIS-EXPORT-DROPS-FILLED-ANSWERS-001` | verified. `diag-new2-gap-detail-export` OK. Blocked: owner session. |
| E2 Settings churn | `--selftest` PASS; diag PASS, 4/4 panels at rest. |
| E3 button audit pass 2 | 213 buttons (212 on 11-18), 0 regressions, 0 recoveries, 0 visibility changes, 0 page errors. One label back: "What I Bring row 0 alignment" (the usual flap). `PANEL_BUTTON_AUDIT_2026-11-19.{md,json}`. |
| E4 Results preview/export parity | RESULTS-PREVIEW-EXPORT-PARITY OK. |

## Live attest

- Served `sw.js` CACHE `antcv-1.51.6585-askai-insight` = repo.
- Served `app.js?v=1.51.6571-role-line-one` = repo.
- `diag-live-guard-sidecars.mjs`: 9/9 served, executed, content-identical (3 unauthenticated 401s, expected without sign-in).
- `browser-qa --only version-live,sidecars-live`: 2/2 PASS.
- `/health` 200: cv-proxy `3.8.4-brand-ink-match`, antcv-demo-proxy `3.8.4-brand-ink-match`, antcv-access-relay `auth-40-application-snapshots`, docx-worker `1.14.177-role-line-one`.

## Evidence index

- `docs/qa/PANEL_BUTTON_AUDIT_2026-11-19.md` / `.json`
- `docs/qa/last-browser-qa.json` (local, not committed)
- `gh run view 44504715335 --log-failed`
- `wrangler deployments list` for cv-proxy and antcv-demo-proxy (read-only)

## Owner-verify

- ASKAI-INSIGHT-001: one real Insight turn on live (owed since 11-17).
- Export one real CV with a located role and check the role line (owed since 11-15).

## Owner decisions

1. Row 147: deploy POSTING-GUARD-001 to cv-proxy and demo-proxy, or not. If yes, bump VERSION in both first.
2. Row 136: top up or rotate `ANTHROPIC_API_KEY`. 22 days with no CI band coverage.
3. Row 59: leg (C) can be struck from the row text (a renderer exists now). Say if you want it reworded.
4. Rows 97, 141, 142: still pending.

## Non-claims

- No real-data export, no signed-in click-through, no live regeneration, no worker deploy.
- Row 59: no generator pagination run; only tool presence checked.
