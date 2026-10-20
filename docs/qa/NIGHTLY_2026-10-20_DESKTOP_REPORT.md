# AntCV desktop nightly — 2026-10-20 (Gabo-PC, Opus 5.5, worktree-isolated)

**Outcome:** no code shipped. Live attest PASS. Band E2-E4 PASS. Row 24's live click-through (desktop-only) shows the session-wipe bug is gone but the two Export buttons hang 36-383 s, then reset: filed as new row 130 ANALYTICS-EXPORT-SLOW-001, fix and cv-proxy deploy owner-gated. Token OK.

## Preflight / sync

- `routine-preflight start` exit 3 (WORKSPACE DIRTY: owner WIP in `package.json` + `workers/access-relay`) → worktree `C:/Users/Karpg/antcv-worktrees/routine-antcv-nightly-mvgcnpqo` on `origin/main` `02c648a7`; rebased onto `15691641` (CI nightly 10-20 landed mid-run).
- TOKEN OK, expires 2026-10-25T20:15:59Z (5.5 d). No DISPATCH GAP line; previous start 1.0 d ago.
- No shift claim: nothing touched a loaded `pwa/` asset, so no version number was needed. The new diag sits in `pwa/test/`, not loaded by `index.html`.
- Overlap: CI 10-20 swept rows 24/26/27/28/29 (the same stalest five) and set their dates. This run did not re-touch the dates; it added the live legs CI cannot run.

## Baseline (before any edit)

- `run-tests.mjs pwa` 1837/1837. `boot-smoke` glDemo=function, errors=0. `check-register` OK, 92 ACTIVE.

## Live attest (desktop-only)

| Check | Result |
|---|---|
| `diag-live-guard-sidecars.mjs` | PASS 9/9 (3 boot 401s expected) |
| `browser-qa --only version-live,sidecars-live` | 2/2 |
| served `sw.js` CACHE | `antcv-1.51.5074-settings-route-fallback` = repo |
| served `app.js?v` | `1.51.5053-cc-tooltips-plain` = repo |
| `/health` ×4 | 200: access-relay `auth-38-subtitle-guard-qual-put`, cv-proxy + demo-proxy `3.8.4-brand-ink-match`, docx-worker `1.14.174-appline-edit` (`pdf_via: cloudconvert`) = repo |

## Band E

- **E2** `diag-settings-panel-churn` selftest PASS; 4 panels 0 mutations.
- **E3** `diag-panel-button-audit` 210 buttons, 0 regressions, 0 recoveries, 0 visibility moves, 0 labels gone, 1 label added ("What I Bring row 0 alignment…", the core-comp column from the 10-18 header rename), 8 timing flips. Page errors 0. Report `PANEL_BUTTON_AUDIT_2026-10-20.md`.
- **E4** `diag-results-preview-export-parity` OK.
- **E1** (CI took 24/26/27/28/29 today; desktop legs added):
  - **24 ANALYTICS-BUTTONS-SESSION-TIMEOUT-001** — advanced. Live headless click-through signed in with the saved token (new `pwa/test/diag-analytics-buttons-live.mjs`, GETs only). Token kept, no "session expired" alert, no gate reboot; View summary 200 in 0.8 s. Export JSON: hung, then `net::ERR_CONNECTION_RESET`; buttons stay busy meanwhile. Stays ACTIVE on row 130.
  - **26 / 27 / 28 / 29** — verified live: their sidecars (`antcv-sidebar-compact-001`, the four orphan-preflight sidecars, `antcv-profile-access-scrub`, `antcv-sidebar-relevance-cut`, `antcv-generate-cloud-sync-277`) are served byte-identical to the repo (CR-stripped md5). Gates unchanged: owner eyeball (26), real render/regen (27/28), signed-in writer hunt (29).

## New row 130 — ANALYTICS-EXPORT-SLOW-001 (ACTIVE, owner decision)

| Probe | Result |
|---|---|
| curl `/analytics/summary` (token) | 200, < 1 s |
| curl `/api/analytics/export?format=json&view=sessions` 07:24Z | 200, 36 s, 12 KB |
| same, ~07:40Z | 200, **383 s** |
| same, CSV | 200, 1.9 KB (first call) |
| browser Export JSON | no response, then `ERR_CONNECTION_RESET` |

Mechanism (code read): `workers/proxy/src/analytics-export.js` reads all 779 KV events with serial `await kv.get`. Unverified risk: near the per-invocation KV op cap; failed gets are swallowed, so a larger store would drop events silently. Proposed fix in the row: batched gets, a default time window, a client busy-state reset on failure; then proxy + demo-proxy deploy. Not done unattended: cv-proxy carries every generation.

## Bands A-D

Not advanced. Residuals need a second physical device (A1/A2, rows 19/63/64), a signed-in content repro (B), a real LLM generation or D1 telemetry (C/D), or an owner decision (rows 115/117/123/124).

## Owner-verify

1. After row 130 lands: Settings → Admin → Analytics, press the three buttons once.
2. Rows 21 and 26: unchanged eyeballs.

## Owner decisions

- Row 130: approve the batched-read fix + default window and the proxy/demo-proxy deploys, or name another export source.
- Rows 115 / 117 / 123 / 124: unchanged.

## Non-claims

- No fix shipped, no worker deploy, no D1 read or write, no app.js edit, no `npm run build:app`.
- The KV per-invocation cap risk is not measured.
- The 36 s → 383 s variance is observed, not explained (cold KV reads are the likely cause).
- Not tested on a real device.

## Evidence index

- `pwa/test/diag-analytics-buttons-live.mjs` (new; exit 0 PASS / 1 FAIL / 4 no token). Today: FAIL on the export leg.
- `docs/qa/PANEL_BUTTON_AUDIT_2026-10-20.md` / `.json`.
- Register: row 130 in `OPEN_REGISTER.md` + `REGISTER_ACTIVE_DETAIL.md`; desktop notes on rows 24/26/27/28/29; top block in `ACTIVE_BUGS.md`; run summary in `REGISTER_RUNLOG.md`.
