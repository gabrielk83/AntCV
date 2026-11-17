# Desktop nightly 2026-11-17 (Gabo-PC, Opus 5.5)

**Outcome:** quiet night, no code change. ASKAI-INSIGHT-001 (#406, 1.51.6585) is live and byte-identical to the repo; registered in FEATURES_REGISTRY. E1-E4 PASS. Live attest PASS. Rows 136 and 147 still need the owner.

## Preflight / sync

- `routine-preflight start` exit 3: owner WIP in the shared clone (`package.json`, `workers/access-relay/*`, an untracked DAMC doc). Worked in `C:/Users/Karpg/antcv-worktrees/routine-antcv-nightly-mwl0baen`.
- Base HEAD `6b92824c` (ASKAI-INSIGHT-001, #406).
- TOKEN OK, expires 2026-11-22T17:06Z (5.0 d left).
- DISPATCH GAP: no gap line printed; previous start 2026-11-16T09:47Z (1.3 d).
- No shift claim: no `pwa/` asset touched, no version number consumed.

## Duplicate / CI overlap

No CI report since 10-28. `nightly.yml` run `44067429387` (11-17) failed in 40 s: "Credit balance is too low". No desktop entry for today in the runlog. Full run.

## Baseline

| Check | Before | After |
|---|---|---|
| `run-tests.mjs pwa` | 2175/2175 | 2175/2175 (no `pwa/` change) |
| `boot-smoke.mjs` | glDemo=function, errors=0 | not re-run (no `app.js` change) |
| `check-register.mjs` | OK, 103 rows | OK, 103 rows |

## Bands A-D

| Row | Status |
|---|---|
| 136 `CI-NIGHTLY-CREDIT-EXHAUSTED-001` | **verified**. Day 20. Blocked: owner (key top-up). |
| 147 `PROXY-POSTING-GUARD-UNDEPLOYED-001` | **verified** still undeployed. cv-proxy last deployment 11-05 10:07Z, demo-proxy 08:38Z. Blocked: owner call. |
| ASKAI-INSIGHT-001 (#406, no register row) | **verified live**. `antcv-doc-chatbot-440.js`, `antcv-analysis-persist.js`, `antcv-bullet-targets.js`, `antcv-version-override.js`, `sw.js` served sha1-identical to the repo (CRLF stripped). Was missing from FEATURES_REGISTRY; added as FT-ASKAI-INSIGHT. No real LLM call on live. |
| Other A-D rows | not advanced. Blockers unchanged: owner click-through, real device, real LLM gen. No signed-in pane drive: the pane profile is shared with the owner's tabs. |

## Band E

| Leg | Result |
|---|---|
| E1 row 82 `ROLE-CANON-AUDIT-LEG-001` | verified. `test_gold_residue.py` 18/18; wired at `gold_audit.py:22,94-95`. Blocked: owner es/zh eyeball. |
| E1 row 60 (header-rule / CL-slogan controls) | verified unchanged. Leg (d) still 0 reads. Only commit since 10-24 on the slogan sidecar is SLOGAN-CASE-001. Blocked: live-DOM repro. |
| E1 row 61 `LINE-DISTRIBUTION-GUIDELINES-001` | verified. `goldDensity()` 4, `__antcvRowFit` 8. |
| E1 row 57 `TARGETED-CV-POLISH-RULES-001` | verified unchanged. |
| E1 row 38 `GEN-BACKGROUND-001` | verified. Engine loaded, unit tests green. Blocked: real device. |
| E2 Settings churn | `--selftest` PASS; diag PASS, 4/4 panels at rest. |
| E3 button audit pass 2 | 212 buttons (211 on 11-16), 0 regressions, 0 recoveries, 0 page errors. Labels added: the new Insight chip (#406) and "What I Bring row 0 alignment" (the usual flap). `PANEL_BUTTON_AUDIT_2026-11-17.{md,json}`. |
| E4 Results preview/export parity | RESULTS-PREVIEW-EXPORT-PARITY OK. |

## Live attest

- Served `sw.js` CACHE `antcv-1.51.6585-askai-insight` = repo; boot seed `1.51.6585-askai-insight` = repo.
- Served `app.js?v=1.51.6571-role-line-one` = repo.
- `diag-live-guard-sidecars.mjs`: 9/9 served, executed, content-identical (unauthenticated 401s in the console, expected without sign-in).
- `browser-qa --only version-live,sidecars-live`: 2/2 PASS.
- `/health` 200: cv-proxy `3.8.4-brand-ink-match`, antcv-demo-proxy `3.8.4-brand-ink-match`, antcv-access-relay `auth-40-application-snapshots`, docx-worker `1.14.177-role-line-one`.

## Evidence index

- `docs/qa/PANEL_BUTTON_AUDIT_2026-11-17.md` / `.json`
- CI run `44067429387` log ("Surface agent error cause")
- `wrangler deployments list` for cv-proxy and antcv-demo-proxy (read-only)
- sha1 compare of the #406 files, live vs repo

## Owner-verify

- ASKAI-INSIGHT-001: one real Insight turn on live (paste a contact message, check cited facts, apply one CV edit and one letter edit).
- Still owed from 11-15: export one real CV with a located role and check the role line.

## Owner decisions

1. Row 147: deploy POSTING-GUARD-001 to cv-proxy and demo-proxy, or not. If yes, bump VERSION in both first.
2. Row 136: top up or rotate `ANTHROPIC_API_KEY`. 20 days with no CI band coverage.
3. Rows 97, 141, 142: still pending.

## Non-claims

- ASKAI-INSIGHT-001 behaviour on live is untested; only served bytes were compared.
- No real-data export, no signed-in click-through, no live regeneration, no worker deploy.
- FEATURES_REGISTRY is still missing other features shipped since 10-15; only #406 was added.
