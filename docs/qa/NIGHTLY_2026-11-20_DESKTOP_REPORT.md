# Desktop nightly 2026-11-20 (Gabo-PC, Opus 5.5)

**Outcome:** one test fix (stale `diag-jd-scope-runtime` assertion, JD-SCOPE-DIAG-STALE-001). E1 rows 39/39a/62/65/67/74 verified. E2-E4 PASS. Live attest PASS. No `pwa/` asset, no version consumed.

## Preflight / sync

- `routine-preflight start` exit 3: owner WIP in the shared clone (`package.json`, `workers/access-relay/*`, untracked DAMC doc). Worked in `C:/Users/Karpg/antcv-worktrees/routine-antcv-nightly-mworh5ar`.
- Base HEAD `baa2f874` (position-discovery docs since the 11-19 desktop run; no `pwa/` change).
- TOKEN OK, expires 2026-11-26T21:16Z (6.5 d left).
- DISPATCH GAP: none printed; previous start 2026-11-19T16:25Z (0.7 d).
- No shift claim: the only code change is a test file not loaded by `index.html`; no version number consumed.

## Duplicate / CI overlap

No CI report since 10-28. Newest `nightly.yml` run is still `44504715335` (11-19, failure in 34 s, row 136 signature); today's scheduled run has not fired yet at this hour. No desktop entry for today in the runlog. Full run.

## Baseline

| Check | Before | After |
|---|---|---|
| `run-tests.mjs pwa` | 2176 pass, 0 fail, 0 skipped | same (diag is not in the suite) |
| `boot-smoke.mjs` | glDemo=function, errors=0 | not re-run (no `app.js` change) |
| `check-register.mjs` | OK, 101 rows | OK (re-run after edits) |

## Bands A-D

| Row | Status |
|---|---|
| 136 `CI-NIGHTLY-CREDIT-EXHAUSTED-001` | **verified** unchanged. No new run since 11-19. Day 23. Blocked: owner (key top-up). |
| 147 `PROXY-POSTING-GUARD-UNDEPLOYED-001` | **verified** still undeployed: both proxies `/health` `3.8.4-brand-ink-match`. Blocked: owner call. |
| Other A-D rows | not advanced. Blockers unchanged: owner click-through, real device, real LLM gen. |

## Band E

| Leg | Result |
|---|---|
| E1 row 39 `GEN-MODELROLE-001` | verified. `MODEL_ROLES` in both proxy `wrangler.toml`. D1 `llm_calls` (wrangler, SELECT only, 30 d): newest day 11-08; `analysis` -> mistral as mapped; no writer `generate` row. Blocked: real LLM gen. |
| E1 row 39a `AUTOSAVE-NO-DOWNGRADE-001` | verified + **test fixed**. Relay guard present; pointer-stale-guard loaded. `diag-jd-scope-runtime.mjs` FAILED at HEAD: it asserted the `kernel` staging slot survives an app switch; JD-SCOPE-COLDSTART-001 (1.51.3762) consumes it by design. Diag now asserts the consume and adds a two-real-app isolation check. OK; negative control (consume disabled) FAILED. Blocked: real second device. |
| E1 row 62 `HEADER-BANNER-DESIGN-RULES-001` | verified. docx-worker `diag-contact-icons`, `diag-contact-fullwidth`, `diag-photo-bridge-export` all OK. Blocked: owner session. |
| E1 row 74 `JD-SWAP-STALE-RATIONALE-001` | verified. Both clear sites present in `app.src.js`. Blocked: owner foreground gen, real device (leg C). |
| E1 row 67 `CV-CORECOMP-BLANK-001` | verified. Slogan sidecars loaded. Blocked: real LLM gen, owner desktop session. |
| E1 row 65 `PTR-STALE-GUARD-001` | verified. `diag-cross-device-gen-leak-guard` OK. Blocked: owner device info. |
| E2 Settings churn | `--selftest` PASS; diag PASS, 4/4 panels at rest. |
| E3 button audit pass 2 | 213 buttons (213 on 11-19), 0 regressions, 0 recoveries, 0 page errors. 3 visibility changes and label churn are the cycle buttons (alignment state left by earlier clicks), not findings. `PANEL_BUTTON_AUDIT_2026-11-20.{md,json}`. |
| E4 Results preview/export parity | RESULTS-PREVIEW-EXPORT-PARITY OK. |

## Live attest

- Served `sw.js` CACHE `antcv-1.51.6585-askai-insight` = repo.
- Served `app.js?v=1.51.6571-role-line-one` = repo.
- `diag-live-guard-sidecars.mjs`: 9/9 served, executed, content-identical (401s are the unauthenticated relay calls, expected).
- `browser-qa --only version-live,sidecars-live`: 2/2 PASS.
- `/health` 200: cv-proxy + antcv-demo-proxy `3.8.4-brand-ink-match`, antcv-access-relay `auth-40-application-snapshots`, docx-worker `1.14.177-role-line-one`.

## Evidence index

- `pwa/test/diag-jd-scope-runtime.mjs` (fixed) + negative-control run (consume line removed, reverted)
- `docs/qa/PANEL_BUTTON_AUDIT_2026-11-20.md` / `.json`
- `docs/qa/last-browser-qa.json` (local, not committed)
- D1 `llm_calls` SELECT via wrangler (rows read only)

## Owner-verify

- ASKAI-INSIGHT-001: one real Insight turn on live (owed since 11-17).
- Export one real CV with a located role and check the role line (owed since 11-15).

## Owner decisions

1. Row 147: deploy POSTING-GUARD-001 to cv-proxy and demo-proxy, or not.
2. Row 136: top up or rotate `ANTHROPIC_API_KEY`. 23 days with no CI band coverage.
3. Rows 59, 97, 141, 142: still pending.

## Non-claims

- No real-data export, no signed-in click-through, no live regeneration, no worker deploy, no `pwa/` asset change.
- Row 74: clear sites checked in `app.src.js` only; the minified `app.js` mirror was not re-traced.
