# AntCV desktop nightly — 2026-09-30

**Outcome:** live attest green at `1.51.4727-close-space`; Band E green except one unreproduced Personal-panel churn spike; row 39's deploy leg verified live (MODEL_ROLES + Opus 5.5 pin on both proxies); new row 114 filed (background-job gens write no `llm_calls`). No code, no version consumed.

## Preflight / sync

- Host Gabo-PC, Opus 5.5, unattended. `routine-preflight start` → WORKSPACE DIRTY (owner WIP in the shared clone: `package.json`, `workers/access-relay/**`). All work in worktree `C:/Users/Karpg/antcv-worktrees/routine-antcv-nightly-muntxnxq` on `origin/main` `1bc192ed`, rebased onto `8958c714` mid-run.
- TOKEN OK, expires 2026-10-06T19:40:25Z (6.5 d). No DISPATCH GAP line (previous start 0.4 d earlier).
- No shift claim: docs-only run. Owner lane 1.51.4746-1.51.4765 (main clone) untouched.
- CI overlap: today's `NIGHTLY_2026-09-30_REPORT.md` did E1 (rows 96/92/93/95/97) and live-deploy sanity; E1 not repeated. CI owed desktop: Band A/B headless and live legs, D2 live check.

## Baseline (before any edit)

| gate | result |
|---|---|
| `run-tests.mjs pwa` | 1746/1746 pass, 0 fail |
| `boot-smoke.mjs` | glDemo=function, errors=0 |
| `check-register.mjs` | OK, 93 ACTIVE (95 after rebase + row 114) |

## Live attest

- `diag-live-guard-sidecars.mjs`: 9/9 sidecars served, executed, content-identical to repo.
- `browser-qa.mjs --only version-live,sidecars-live`: 2/2 PASS (2 checks selected; the 09-29 false-green is fixed).
- Live `sw.js` CACHE `antcv-1.51.4727-close-space` = repo; live `app.js?v=1.51.4727-close-space` = repo.
- `/health` 200 ×4: access-relay `auth-38-subtitle-guard-qual-put`, cv-proxy + demo-proxy `3.8.4-brand-ink-match`, docx-worker `1.14.174-appline-edit`. All equal the repo constants.

## Bands

| band / row | status | note |
|---|---|---|
| A1 GEN-BACKGROUND-001 (38), A2 tab isolation | blocked: real device | guards live-attested above; A/B needs a phone |
| B1 SO-003 (40), B2 SO-004 #185 (41) | blocked: real device / owner session | guards live-attested above |
| C 42/43/44 | blocked: owner click-through | live-attested above |
| D1 PERF-001 | not taken | one verified leg tonight beat a half profile |
| **D2 / row 39 GEN-MODELROLE-001** | **advanced** | see below |
| E1 staleness | skipped: CI did it at this HEAD | |
| E2 settings churn (17) | verified, one flake | see below |
| E3 button audit | verified | 216 buttons, 0 THROWS, 0 DEAD, 0 page errors; 8 active↔ui-only flips vs 09-29, same classifier noise |
| E4 export/preview parity | verified | RESULTS-PREVIEW-EXPORT-PARITY OK |
| **row 114 TELEMETRY-BGJOB-GAP-001** | **new** | see below |
| row 110 token | verified | TOKEN OK to 10-06; uptime leg (a) still open |

### Row 39 — deploy leg verified live

- wrangler is authenticated on Gabo-PC again (09-29 blocker gone).
- `wrangler versions view` on the live versions: `cv-proxy` `babdf99e` (2026-09-29T22:14Z) and `antcv-demo-proxy` `7d0ec439` (22:15Z) both carry `MODEL_ROLES = {"writer":"anthropic","supervisor":"mistral","coherence":"openai","analysis":"mistral"}`, byte-equal to both `wrangler.toml`.
- The deployed `cv-proxy` bundle (Cloudflare MCP `workers_get_worker_code`) contains `claude-opus-5-5` 3×, same as `workers/proxy/src`. OPUS55-ADOPT-001 is deployed.
- Telemetry leg still open: `llm_calls` has 0 rows after 2026-09-28 21:38 UTC. No PWA gen since the deploy.
- Proxy `/health` still says `3.8.4-brand-ink-match`; the adopt did not bump the version string, so `/health` cannot show pre vs post.

### Row 114 — background-job gens are invisible to telemetry (new)

- The job-tracker nightly generated app 3505 this morning (gpt-5-mini), yet `llm_calls` shows nothing after 09-28.
- Only writer: relay `insertLlmCall` (`workers/access-relay/src/telemetry.js`), fed by PWA client events. The proxy has no writer. `pwa/antcv-gen-job-client.js` (loaded) and `gen-runner.py` use `/job/create` + `/job/step` and emit nothing.
- Effect: the weekly cost-quality tune, the row 39 role-split check and the first Opus 5.5 call check miss every job-path gen.
- Not fixed: it needs a design call (proxy posts events, or the client does).
- Side note: `llm_calls.ts` is seconds. A ms-based query returns nothing.

### Row 17 — E2 flake

8 runs. Run 1: Personal 257 mutations/8s FAIL; other tabs 0. Runs 2-8: all 0. Selftest 80/80. Breakdown of the failing run not captured. Not reproduced; recorded, not filed.

## Evidence index

- `docs/qa/PANEL_BUTTON_AUDIT_2026-09-30.{json,md}` (E3)
- `docs/qa/last-browser-qa.json` (live attest)
- D1 read-only SELECTs via `wrangler d1 execute ant_memory --remote` (no writes)
- `wrangler deployments list` / `versions view` for cv-proxy, antcv-demo-proxy

## Owner-verify

- The first real PWA generation on Opus 5.5: check `llm_calls` shows `claude-opus-5-5` on writer tasks and mistral on `parse_jd`.

## Owner-decision

- Row 114: who emits background-job telemetry — proxy `gen-job.js` → relay (also covers gen-runner), or the PWA job client.
- Bump the proxy `VERSION` on the next proxy deploy so `/health` shows the Opus 5.5 build.

## Non-claims

- No code changed, no deploy, no version consumed, no shift claim.
- The Opus 5.5 pin is verified in deployed code only; no live call has been observed.
- Not measured: what share of PWA gens take the job path.
- Band A/B/C device and owner legs not attempted.
