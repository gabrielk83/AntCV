# AntCV nightly — desktop 2026-10-26 (Gabo-PC)

**Outcome:** no code shipped. Live attest PASS, Band E2-E4 PASS, E1 rows 34/39a/39/66/65 re-verified with desktop-only legs. No version consumed, no shift claim.

## Preflight / sync

- Preflight exit 3 (owner WIP in `package.json`, `workers/access-relay/src/index.js`, its cluster test). Worked in `C:/Users/Karpg/antcv-worktrees/routine-antcv-nightly-mvp05rib` on `origin/main` `3a1e15d2` (CI 10-26 already in).
- TOKEN OK, expires 2026-11-01 (6.5 d). No DISPATCH GAP line (previous start 0.5 d ago).
- CI 10-26 swept rows 62/74/69/67/40/18. This run took the next five stalest and the legs CI cannot reach.

## Baseline

| Check | Result |
|---|---|
| `run-tests.mjs pwa` | 1850/1850 pass |
| `boot-smoke.mjs` | glDemo=function, errors=0 |
| `check-register.mjs` | OK, 93 ACTIVE rows |

## Live attest (desktop-only)

| Check | Result |
|---|---|
| `diag-live-guard-sidecars.mjs` | PASS 9/9 served, executed, content-identical |
| `browser-qa.mjs --only version-live,sidecars-live` | 2/2 PASS |
| served sw.js CACHE | `antcv-1.51.5139-demand-seed-refresh` = repo |
| served app.js `?v` | `1.51.5094-brand-ink-fit` = repo |
| `/health` ×4 | 200: access-relay `auth-38-subtitle-guard-qual-put`, cv-proxy + demo-proxy `3.8.4-brand-ink-match`, docx-worker `1.14.175-ai-mark-props`; all = repo |

## Band E

| Leg | Result |
|---|---|
| E1 staleness | rows 34, 39a, 39, 66, 65 → verified 2026-10-26, all kept ACTIVE (below) |
| E2 Settings churn | selftest PASS; DIAG PASS, 4/4 panels at rest |
| E3 button audit | 211 buttons, 0 regressions, 0 labels gone/added, 0 page errors (`PANEL_BUTTON_AUDIT_2026-10-26.md`) |
| E4 export/preview parity | RESULTS-PREVIEW-EXPORT-PARITY OK |

## E1 rows

| Row | ID | Status | Evidence | Blocker for the rest |
|---|---|---|---|---|
| 34 | ROLE-MERGE-STORED-001 | verified | role-merge sidecars live bytes = repo; unit tests green; E4 OK | none new; parity-sweep anchor |
| 39a | AUTOSAVE-NO-DOWNGRADE-001 | verified | relay diag 5/5; relay live = repo; pointer-stale-guard live = repo | real device (row 19 two-device test) |
| 39 | GEN-MODELROLE-001 | verified | prod D1 `llm_calls` 14 d: 7 calls, 3 providers, all 10-20, all success | traffic: no writer `generate` call in window |
| 66 | LINKEDIN-CLICK-001 | verified | preflight checklist present; docx-worker live = repo | real LLM gen + owner eyeball |
| 65 | PTR-STALE-GUARD-001 | verified | `diag-cross-device-gen-leak-guard.mjs` OK | real device (A), live repro (B-D) |

## Bands A-D

Not advanced. Remaining legs are owner-session, real-device or real-LLM-gen gated; nothing drivable found that CI or prior desktop runs had not already verified at this HEAD.

## Owner-verify

- Row 39: D1 shows only 7 LLM calls in 14 days, all on 2026-10-20. Low traffic, not a fault; the writer-role split re-check waits on a real generation.

## Owner decisions

None new.

## Non-claims

- No generation run, no signed-in click-through, no worker deploy, no PWA change.
- Row 39 routing not re-observed for the writer role.
