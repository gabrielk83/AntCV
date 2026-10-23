# AntCV desktop nightly — 2026-10-23 (Gabo-PC, Opus 5.5, worktree-isolated)

**Outcome:** no code shipped. Live attest PASS at `1.51.5094-brand-ink-fit`. Band E1-E4 PASS. E1 re-scoped row 55: legs b and f are already shipped under other tickets, leg c half-shipped. Token OK. Dispatch gap 3 days.

## Preflight / sync

- `routine-preflight start` exit 3 (WORKSPACE DIRTY: owner WIP in `package.json` + `workers/access-relay`) → worktree `C:/Users/Karpg/antcv-worktrees/routine-antcv-nightly-mvko8gdv` on `origin/main` `d7495a2b`.
- TOKEN OK, expires 2026-10-30T07:46:30Z (7.0 d).
- **DISPATCH GAP: previous start 2026-10-20T07:16Z, 3.0 days.** The 10-21 and 10-22 desktop runs did not fire. Routines are desktop-app-local; the token has a 6-day self-renewal window, so a longer gap risks expiry.
- No shift claim: no loaded `pwa/` asset changed, no version consumed.
- Overlap: CI 10-23 swept rows 2/47/50/51/49. This run took the next stalest (53-56) and did not re-touch CI's rows.

## Baseline (before any edit)

- `run-tests.mjs pwa` 1844/1844. `boot-smoke` glDemo=function, errors=0. `check-register` OK, 93 ACTIVE.

## Live attest (desktop-only)

| Check | Result |
|---|---|
| `diag-live-guard-sidecars.mjs` | PASS 9/9 (3 boot 401s expected) |
| `browser-qa --only version-live,sidecars-live` | 2/2 |
| served `sw.js` CACHE | `antcv-1.51.5094-brand-ink-fit` = repo |
| served `app.js?v` | `1.51.5094-brand-ink-fit` = repo |
| `/health` ×4 | 200: access-relay `auth-38-subtitle-guard-qual-put`, cv-proxy + demo-proxy `3.8.4-brand-ink-match`, docx-worker `1.14.174-appline-edit` (`pdf_via: cloudconvert`) = repo |

## Band E

- **E2** `diag-settings-panel-churn` selftest PASS; 4 panels at rest.
- **E3** `diag-panel-button-audit` 219 buttons (210 → 219), 0 regressions, 0 recoveries, page errors 0. One label gone ("⇥ Fit", was `active`, wrote `sections`/`meta`) while "Make It Fit (sidebar)" went hidden 1 → 0; three sidebar headline-alignment labels added (the cycle button's label carries its current state). Read as a state-dependent label swap, not a missing control. Not proven; watch on the next audit. Report `PANEL_BUTTON_AUDIT_2026-10-23.md`.
- **E4** `diag-results-preview-export-parity` OK.
- **E1** rows 53-56 (stalest, 2026-10-13):
  - **53 CROSS-APP-EXPORT-CONTAMINATION-001** — verified. MIRROR-LOAD-001 marker 2× in `app.src.js`; retired scope-guard 0 refs in `index.html`. Legs b-f still need a real targeted gen.
  - **54 GEN-JD-TAILOR-KERNEL-RECALL-001** — verified not started (0 markers in `pwa/` + `workers/`). Real-gen gated.
  - **55 TARGETED-OUTPUT-FURNITURE-001** — advanced (re-scoped). The row said "all six legs hand-fixed only". Code says otherwise:
    - (b) label localization: shipped. docx-worker `"Ansøgning til"` application line (e48dd55a, 2026-07-22); `EU-borger` via `antcv-identity-lang-heal.js` (26a0379d, 2026-07-12, loaded).
    - (f) AI-notice localization: shipped. FURNITURE-LANG-001 `__AINOTICE` map (da/es/zh/he/ar/am) in docx-worker (d32f50af, 2026-07-11).
    - (c) named-contact greeting: half. `antcv-react-islands.js` tells the CL prompt to greet the hiring manager by name when the tracker row's `hm` field is filled (b31a8704, 2026-07-29). No auto-extraction of the contact from the JD.
    - (a) CV header line type, (d) brand-fit, (e) merged-role title order on a targeted CV: open, need a real targeted export to confirm.
  - **56 GEN-JD-RELEVANCE-TRIM-001** — verified not started (0 markers). Real-gen gated.

## Bands A-D

Not advanced. A1/A2 need a second physical device. B1/B2 need a signed-in content repro. C/D need a real LLM generation or a worker deploy. Row 130 (ANALYTICS-EXPORT-SLOW-001) still waits on the owner.

## Owner-verify

1. Row 55: on the next targeted Danish export, check the CV header carries the specialisation line (a), the brand palette (d), and the merged-role title order (e). If all three hold, row 55 can close with leg c split out.
2. Rows 21 and 26: unchanged eyeballs.

## Owner decisions

- Row 130: approve the batched KV-read fix + default window and the proxy/demo-proxy deploys, or name another export source. Unchanged since 10-20.
- Row 55 leg c: should the generator pull the named contact from the JD text when the tracker `hm` field is empty?
- Dispatch gap: the desktop nightly skipped 10-21 and 10-22. Check the Claude desktop app was running on Gabo-PC.

## Non-claims

- No fix shipped, no worker deploy, no D1 read, no app.js edit, no `npm run build:app`, no real LLM generation.
- Row 55 legs b/c/f are verified by code read and commit history, not by a rendered export.
- The E3 "⇥ Fit" label swap is an inference from the paired visibility flip, not traced to its DOM node.
- Not tested on a real device.

## Evidence index

- `docs/qa/PANEL_BUTTON_AUDIT_2026-10-23.md` / `.json`.
- Live attest output: `diag-live-guard-sidecars` PASS line; `docs/qa/last-browser-qa.json` not committed (regenerated each run).
- Register: rows 53/54/55/56 in `OPEN_REGISTER.md` + `REGISTER_ACTIVE_DETAIL.md`; run summary in `REGISTER_RUNLOG.md`.
