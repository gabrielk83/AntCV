# AntCV CI Nightly — 2026-10-25 (GitHub Actions, unattended, Opus 4.8)

Fresh clone on `origin/main` `255e56e3`. `ALLOW_DEPLOY=false`. No in-app Browser pane.

## Summary

Band E1 register-staleness sweep. The 5 stalest rows (38/41/42/43/44, all @ 2026-10-15,
10 days stale) re-verified against current HEAD and date-refreshed to 2026-10-25. Every residual
leg is live/real-device/regen/owner-session-gated, so **nothing shipped** — unattended CI cannot
sign in, drive a real LLM gen, render a real PDF, or touch a second device, and any `app.js` /
worker change would require a PR per the CI safety override (none was needed — this was a
verification sweep, no code edited).

## Hard rules

- **SYNC FIRST:** `git fetch origin && git pull --rebase origin main` → already up to date. No force-push.
- **Baseline:** `node scripts/run-tests.mjs pwa` → **1850/1850 pass / 0 fail**; `check-register.mjs`
  OK before + after (93 ACTIVE rows, 93 detail sections).
- The only commit since the 2026-10-24 sweep is the register-doc commit `255e56e3` (that sweep's own
  report). No code touched → no anchor could have regressed.
- No `app.js` / worker edit → no boot-smoke, cache-bust quintet, or shift-claim owed. No deploy.

## E1 — stalest-row sweep (`check-register.mjs --stalest 8`, took the 5 oldest)

All five code-anchored and INTACT; kept ACTIVE on their existing gate, `verified:` set to 2026-10-25
in both the index (`OPEN_REGISTER.md`) and the detail (`REGISTER_ACTIVE_DETAIL.md`). The 5 targeted
guard tests ran clean together: **35/35 pass**.

| row | ID | anchors verified | status | remaining leg (why not closable in CI) |
|---|---|---|---|---|
| 38 | `GEN-BACKGROUND-001` | `antcv-gen-memo.js` + `antcv-gen-job-client.js` loaded [2]; `AntcvGenJob`/`AntcvGenMemo`/`__antcvGenTrigger` exposed [3]; `gen-memo.test.mjs` + `gen-job-client.test.mjs` green | engine INTACT | owner A/B on a real mobile gen (`antcv:gen-resume=1`) + default-flip — real device |
| 41 | SO-004 CRASH (no id) | `antcv-debug-logger.js` #185 capture probe loaded [1] | instrumented, no repro | #185 = "Maximum update depth exceeded"; needs a real Android reflow oscillation headless can't produce |
| 42 | `GEN-LANGFAB-001` | `antcv-lang-fabrication-guard.js` loaded [1]; `lang-fabrication-guard.test.mjs` green | SHIPPED 1.51.136 | owner-verify on a FRESH targeted gen (German omitted, Danish B1) — regen-gated |
| 43 | CA-006 (no id) | `antcv-candidate-preview-editor-341.js` loaded [1] + `data-antcv-candidate-band` Path-C marker [2]; `ca006-pathc-header-guard.test.mjs` green | SHIPPED 1.51.139 | owner click-through eyeball on a targeted gen preview — owner session |
| 44 | `JD-ANALYSIS-PRINT-001` | `antcv-analysis-report-pdf-360.js` loaded [1] + offscreen-iframe `left:-99999px` [1]; `analysis-print-surface.test.mjs` green | SHIPPED 1.51.137 | owner click-through of "Download analysis (PDF)" — owner session |

No owner-gated row force-closed — each residual is an owner/live/real-device/regen step, not a code gap.

## Bands A–D — not advanced

A1/A2 need a live mobile gen + a second physical device; B1/B2 need a signed-in headless repro with
real content; C/D need live LLM routing / a worker deploy / a real CloudConvert render. None are
available in unattended CI (CLOUD CAVEATS).

## New stalest after the sweep (for the next desktop/live run)

Rows 59 `GENERATOR-BASELINE-001`, 63 `ANALYSIS-STALE-ON-APP-LOAD-001`, 64
`ANALYSIS-EXPORT-DROPS-FILLED-ANSWERS-001` (all @ 2026-10-15). Their remaining legs are
real-gen / signed-in app-load — left untouched rather than date-refreshed without a real check.

## Owed to a desktop run

Nothing shipped → no post-deploy live-verify owed this run. Carry forward: the owner mobile A/B
(row 38), the live Android #185 capture (row 41), the fresh-gen language check (row 42), and the
owner preview/analysis click-throughs (rows 43/44).

## Owner-gated / owner-decision

None new. The standing owner items from prior sweeps remain (see `OPEN_REGISTER.md`).
