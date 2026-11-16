# Desktop nightly 2026-11-16 (Gabo-PC, Opus 5.5)

**Outcome:** one owed deploy closed, one new gap found. access-relay now runs the 11-12 rate tables. POSTING-GUARD-001 (#390) was merged 11-05 and never deployed to either proxy. That is new row 147, owner call. E1-E4 PASS. Live attest PASS at `1.51.6571-role-line-one`.

## Preflight / sync

- `routine-preflight start` exit 3: owner WIP in the shared clone (same files as 11-15). Worked in `C:/Users/Karpg/antcv-worktrees/routine-antcv-nightly-mwj2xs13`.
- Base HEAD `462f0b16` (demand-seed weekly 11-16).
- TOKEN OK, expires 2026-11-22T17:06Z (6.3 d left). The owner re-saved it since 11-15.
- DISPATCH GAP 0.7 d (previous start 11-15 17:01Z).
- No shift claim: no `pwa/` asset touched, no version number consumed.

## Duplicate / CI overlap

No CI report since 10-28. `nightly.yml` run `43842237048` (11-16) failed in 33 s: "Credit balance is too low". No desktop entry for today in the runlog. Full run.

## Baseline

| Check | Before | After |
|---|---|---|
| `run-tests.mjs pwa` | 2162/2162 | 2162/2162 (no `pwa/` change) |
| `boot-smoke.mjs` | glDemo=function, errors=0 | not re-run (no `app.js` change) |
| `check-register.mjs` | OK, 101 rows | OK, 102 rows |
| access-relay tests | 152/152 | — |

## Shipped / deployed

| ID | Status |
|---|---|
| Row 89 `MODEL-TABLE-FRESHNESS-001`, relay leg | **deployed**. The 11-12 tune left proxy, demo-proxy and access-relay deploys owed, because a deploy from main could bundle other sessions' worker changes. Checked per worker with `wrangler deployments list` against `git log` on each `src/`. access-relay: last deployment 11-05 11:04Z; only `c2c7bf0e` (rates) since. Deployed: `deploy.yml target=access-relay` run `43843407282` green, new deployment 09:51Z, `/health` 200. |

## New row

| ID | Status |
|---|---|
| 147 `PROXY-POSTING-GUARD-UNDEPLOYED-001` | **open, owner call**. `91deec12` POSTING-GUARD-001 merged 11-05 11:23 +01. Last cv-proxy deployment 11-05 10:07Z, demo-proxy 08:38Z. Push deploys skip `deploy-worker`; no dispatch since. The guard is not live. Not deployed here: it can reject live JD traffic, and shipping a never-live feature to the production proxy is the owner's decision. VERSION is unchanged in source, so `/health` hides the gap. |

## Bands A-D

| Row | Status |
|---|---|
| 136 `CI-NIGHTLY-CREDIT-EXHAUSTED-001` | **verified**. Day 19. Blocked: owner (key top-up). |
| 89 `MODEL-TABLE-FRESHNESS-001` | **advanced** (relay leg). Proxy legs folded into row 147. |
| Other A-D rows | not advanced. Blockers unchanged: owner click-through, real device, real LLM gen. No signed-in pane drive: the pane profile is shared with the owner's tabs. |

## Band E

| Leg | Result |
|---|---|
| E1 row 55 `TARGETED-OUTPUT-FURNITURE-001` | verified. Leg f in code (Danish notice in docx-worker). a / d / e blocked: real targeted export. |
| E1 row 56 `GEN-JD-RELEVANCE-TRIM-001` | verified not started (0 markers). Blocked: real LLM gen. |
| E1 row 105 `JOBSRC-FETCH-001` | verified. `test_job_sources.py` PASS, 88 checks. No code owed. |
| E1 row 76 `JOBTRACKER-LLM-REFIT-BUTTON-001` | verified deferred. No code, no evidence it is needed. |
| E2 Settings churn | `--selftest` PASS; diag PASS, 4/4 panels at rest. |
| E3 button audit pass 2 | 211 buttons (206 on 11-15), 0 regressions, 0 page errors. Labels back: "⇥ Fit", "CJLR: cycle"; gone: "What I Bring row 0". The same flap as prior runs, reversed. `PANEL_BUTTON_AUDIT_2026-11-16.{md,json}`. |
| E4 Results preview/export parity | RESULTS-PREVIEW-EXPORT-PARITY OK. |

## Live attest

- Served `sw.js` CACHE `antcv-1.51.6571-role-line-one` = repo.
- Served `app.js?v=1.51.6571-role-line-one` = repo.
- `diag-live-guard-sidecars.mjs`: 9/9 served, executed, content-identical (one unauthenticated 401 resource in the console, expected without sign-in).
- `browser-qa --only version-live,sidecars-live`: 2/2 PASS.
- `/health` 200: cv-proxy `3.8.4-brand-ink-match`, antcv-demo-proxy `3.8.4-brand-ink-match`, antcv-access-relay `auth-40-application-snapshots`, docx-worker `1.14.177-role-line-one`.

## Evidence index

- `docs/qa/PANEL_BUTTON_AUDIT_2026-11-16.md` / `.json`
- `docs/qa/last-browser-qa.json`
- deploy run `43843407282`; CI run `43842237048` log
- `wrangler deployments list` for cv-proxy, antcv-demo-proxy, antcv-access-relay (read-only)

## Owner-verify

- None new. Still owed from 11-15: export one real CV with a located role and check the role line.

## Owner decisions

1. Row 147: deploy POSTING-GUARD-001 to cv-proxy and demo-proxy, or not. If yes, bump VERSION in both workers first so `/health` shows it, then one real JD analysis.
2. Row 136: top up or rotate `ANTHROPIC_API_KEY`. 19 days with no CI band coverage.
3. Rows 97, 141, 142: still pending from 11-14.

## Non-claims

- The relay deploy was not checked by fetching the live script; evidence is the green run, the new deployment timestamp and `/health`. VERSION was not bumped (rates-only change, matching how the tune ships rates).
- Whether POSTING-GUARD-001 behaves correctly on live traffic is untested; it has never run in production.
- No real-data export, no signed-in click-through, no live regeneration.
