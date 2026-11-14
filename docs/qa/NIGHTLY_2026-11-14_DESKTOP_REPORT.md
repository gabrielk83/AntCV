# Desktop nightly 2026-11-14 (Gabo-PC, Opus 5.5)

**Outcome:** no code shipped. Two rows advanced from desktop-only reads: row 114 is closed in code since 11-05 (awaiting the first `srv:gen-job` row), row 97's D1 JD check is done (Aimpoint "Optical Engineer" JD is wrong). E1-E4 PASS. Live attest PASS at `1.51.6565-tab-rationale`.

## Preflight / sync

- `routine-preflight start` exit 3: owner WIP in the shared clone (`package.json`, `workers/access-relay/src/index.js`, its test, an untracked DAMC doc). Worked in `C:/Users/Karpg/antcv-worktrees/routine-antcv-nightly-mwgiac1i`.
- Base HEAD `208568c3` (cost-quality 11-12).
- TOKEN OK, 3.4 d left (expires 2026-11-17T23:14Z).
- DISPATCH GAP 3.3 d (previous start 11-11 08:04). No desktop nightly fired 11-12 or 11-13.
- No shift claim: no `pwa/` asset touched, no version consumed.

## Duplicate / CI overlap

No CI report since 10-28. `nightly.yml` failed 11-11, 11-12, 11-13, 11-14 (~30 s each). No desktop entry for today in the runlog. Full run.

## Baseline

| Check | Before | After |
|---|---|---|
| `run-tests.mjs pwa` | 2161/2161 | 2161/2161 (no `pwa/` change) |
| `boot-smoke.mjs` | glDemo=function, errors=0 | not re-run (no `app.js` change) |
| `check-register.mjs` | OK, 99 rows | OK, 99 rows |

## Bands A-D

| Row | Status |
|---|---|
| 136 `CI-NIGHTLY-CREDIT-EXHAUSTED-001` | **verified**. 17 days down. The 11-11 hardening works live: run `43578263482` prints `agent result: Credit balance is too low \| is_error=true api_error_status=400 turns=1`. Blocked: owner (key top-up). |
| A-D rows | not advanced. Blockers unchanged: owner click-through, real device, real LLM gen. Token was valid, but a signed-in pane drive against the production store was not run: the pane profile is shared with the owner's tabs (app-switch overwrite class). |

## Band E

| Leg | Result |
|---|---|
| E1 row 97 `DELIVERABLES-3CO-001` | **advanced** (D1 read). Demant 2732/2771/2801 and 2737/2776: real JD body behind a ~150-char careers-chrome prefix; duplicates. Aimpoint 2783 Engineering Manager: real. Aimpoint 2762 "Optical Engineer": a marine-tech project-lead JD, no "Aimpoint", no "optic". Aimpoint 2812: 573-char careers list scrape. Blocked: owner (real JD), real LLM gen. |
| E1 row 114 `TELEMETRY-BGJOB-GAP-001` | **advanced**. Gap closed in code by `c2da4988` (#389, 11-05): `loggedRunSection` (`workers/proxy/src/index.js:114`) logs each job section as `srv:gen-job`. Live cv-proxy 3.8.4 = repo; 11 `srv:cascade` rows from the same commit prove the deploy. 0 `srv:gen-job` rows: no `llm_calls` row at all after 11-08 13:05 UTC. Close on the first job-gen row. |
| E1 row 94 `CONTENT-LANG-STAMP-001` | verified. 4 refs `app.js`, 6 refs relay. Blocked: real LLM gen. |
| E1 row 92 `EXPORT-PREVIEW-PAGINATION-DIVERGENCE-001` | verified. 31 pagination markers in docx-worker. Blocked: owner repro. |
| E1 row 123 `PKG-ID-PERSIST-MIGRATE-001` | verified live. `palette-mix` FAIL, same shape. Render correct. Owner-gated app.js init edit. |
| E2 Settings churn | `--selftest` PASS; diag PASS, 4/4 panels at rest. |
| E3 button audit pass 2 | 212 buttons (209 on 11-11), 0 regressions, 0 recoveries, 0 page errors, 0 labels gone. "CJLR: cycle" hidden 3 → 6: known instance-count flap. `PANEL_BUTTON_AUDIT_2026-11-14.{md,json}`. |
| E4 Results preview/export parity | RESULTS-PREVIEW-EXPORT-PARITY OK. |

## Live attest

- Served `sw.js` CACHE `antcv-1.51.6565-tab-rationale` = repo.
- Served `app.js?v=1.51.6445-open-stale-tab` = repo.
- `diag-live-guard-sidecars.mjs`: 9/9 served, executed, content-identical. First attempt timed out on `page.goto` (30 s); the retry passed.
- `browser-qa --only version-live,sidecars-live`: 2/2 PASS (first attempt timed out, retry passed).
- `/health` 200: cv-proxy `3.8.4-brand-ink-match`, antcv-demo-proxy, antcv-access-relay `auth-40-application-snapshots`, docx-worker `1.14.176-slogan-case`.

No PWA push, so no post-push live check owed.

## Evidence index

- `docs/qa/PANEL_BUTTON_AUDIT_2026-11-14.md` / `.json`
- `docs/qa/last-browser-qa.json`
- wrangler SELECTs on `llm_calls` and `application` (read only)
- CI run `43578263482` log

## Owner-verify

- None new.

## Owner decisions

1. Row 136: top up or rotate `ANTHROPIC_API_KEY`. 17 days with no CI band coverage.
2. Relay token expires 2026-11-17: re-save `~/.antcv/token` before then.
3. Row 97: paste the real Aimpoint Optical Engineer JD (2762 holds a wrong JD, 2812 is a list scrape), or name 2783 as the Aimpoint target.
4. Rows 141, 142: close calls still pending.
5. Desktop routines skipped 11-12 and 11-13 (gap 3.3 d). Routines only fire while the desktop app runs.

## Non-claims

- No live regeneration, no signed-in click-through, no worker deploy.
- Row 114 is not closed: the `srv:gen-job` path has never written a row in production.
- The `page.goto` timeouts were not diagnosed; one retry passed both.
