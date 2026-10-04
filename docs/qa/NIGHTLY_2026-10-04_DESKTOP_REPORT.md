# AntCV Desktop Nightly — 2026-10-04

**Outcome:** live attest PASS at `1.51.4791-profile-prefix`. Band E2 and E4 PASS. The E3 DEAD finding was a bug in the audit's classifier, now fixed (AUDIT-DISABLED-DEAD-001, test harness only, no version). Row 39 telemetry leg still open: no `llm_calls` since 2026-09-28.

## Preflight / sync
- Host Gabo-PC, Opus 5.5. Preflight exit 3 (WORKSPACE DIRTY: owner WIP in `package.json`, `workers/access-relay/src/index.js`, one relay test). Worked in `C:/Users/Karpg/antcv-worktrees/routine-antcv-nightly-muu16md9` on `origin/main` `edac84e3`.
- TOKEN OK, expires 2026-10-08T06:50Z (3.6 d left).
- **DISPATCH GAP 3.4 d** (previous start 2026-10-01). The 10-02 and 10-03 desktop runs did not fire. Routines are desktop-app-local. The token self-renews only while routines fire.
- No shift claim: no version number consumed. Live claim on origin: 1.51.4786-4790 (vm session, last beat 2026-10-01).
- Overlap: today's CI report (`NIGHTLY_2026-10-04_CI_REPORT.md`) ran E1 on rows 18/60/61/57/59 and shipped no code. No DESKTOP NIGHTLY entry existed for today. This run took the desktop legs only.

## Baseline
- `run-tests.mjs pwa` 1784/1784. Boot smoke OK (glDemo=function, errors=0). `check-register.mjs` OK (95 ACTIVE).

## Live attest (desktop-only)
- `diag-live-guard-sidecars.mjs`: 9/9 served, executed, content-identical. 3 boot 401s (expected, no auth session).
- `browser-qa.mjs --only version-live,sidecars-live`: 2/2 PASS.
- Live `sw.js` CACHE `antcv-1.51.4791-profile-prefix` and `app.js?v=1.51.4791-profile-prefix` equal the repo.
- `/health` 200 ×4, all equal repo constants: access-relay `auth-38-subtitle-guard-qual-put`, cv-proxy + antcv-demo-proxy `3.8.4-brand-ink-match`, docx-worker `1.14.174-appline-edit`.

## Bands
- **A–D:** not advanced. The remaining items need a real device, a live LLM generation, or an owner call (same finding as CI). Row 115 (PWA cost meter) is marked owner call; not touched.
- **E1:** left to CI (it swept rows 18/60/61/57/59 today).
- **E2** `diag-settings-panel-churn.mjs`: selftest PASS. Personal/Layout/Account/Advanced 0 mutations/8s. PASS.
- **E3** `diag-panel-button-audit.mjs`: first pass 211 buttons, 0 THROWS, **1 DEAD: "Undo last change"**. Verified: the JSON entry had `disabled: true` (empty undo stack). The classifier routed only `!visible` buttons to `not-visible-or-disabled`. A visible but disabled button fell through to the `force:true` click (force bypasses disabled), did nothing, and was scored DEAD. Not an app bug: the second, enabled Undo instance scored `active`. **Fixed** (AUDIT-DISABLED-DEAD-001, `pwa/test/diag-panel-button-audit.mjs`, `!next.visible || next.disabled`). Re-run: 206 buttons, 0 DEAD, 0 THROWS, 0 page errors. Button count varies 206–216 between runs (enumeration order); not a regression.
- **E4** `diag-results-preview-export-parity.mjs`: OK.

## Register rows
| Row | ID | Status |
|---|---|---|
| 39 | GEN-MODELROLE-001 | verified, still open. D1 `llm_calls` newest row 2026-09-28 (`claude-sonnet-5`, 1 call). No production traffic since, so no `claude-opus-5-5` row yet. Blocked on: real LLM gen. |
| 114 | TELEMETRY-BGJOB-GAP-001 | not touched. |
| 115 | PWA-COST-METER-OPUS55-001 | not touched (owner call). |

## Observations
- **Local wrangler D1 read fails**: `wrangler d1 execute ant_memory --remote` returns APIError 7403 ("account is not valid or is not authorized"). It worked on 09-30. The Cloudflare D1 connector worked in this session and served the read. Deploys go through `deploy.yml` (repo secrets), so they are not affected.
- `llm_calls.ts` is unix **seconds**, not ms. Note for future queries.

## Evidence index
- `docs/qa/PANEL_BUTTON_AUDIT_2026-10-04.md` + `.json` (post-fix run).
- `docs/qa/last-browser-qa.json`.
- D1: `SELECT date(ts,'unixepoch') d, provider, model, COUNT(*) FROM llm_calls GROUP BY d, provider, model ORDER BY d DESC` → newest 2026-09-28.

## Owner-verify
- None new.

## Owner decisions
- Row 115: meter by the served model id (app.js edit, shift lane). Yes or no.
- Optional: `npx wrangler login` on Gabo-PC. The D1 connector covers reads.
- Dispatch gap: the 10-02 and 10-03 desktop runs missed. Check the desktop app was open.

## Non-claims
- No PWA asset changed, no version consumed, no deploy. Nothing live changed, so no post-deploy verify is owed.
- E1 not run here (CI did it).
- No live LLM generation.
