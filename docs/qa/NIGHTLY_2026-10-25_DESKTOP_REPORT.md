# AntCV desktop nightly — 2026-10-25 (Gabo-PC, Opus 5.5, worktree-isolated)

**Outcome:** deployed the owed docx-worker `1.14.175-ai-mark-props` (AI-ACT-MARK-001, merged 10-23, never deployed). Live attest PASS. Band E1-E4 PASS. E1 rows 58/59/63/64 re-verified, two with desktop-only Playwright guards. No PWA code changed.

## Preflight / sync

- `routine-preflight start` exit 3 (WORKSPACE DIRTY: owner WIP in `package.json` + `workers/access-relay`) → worktree `C:/Users/Karpg/antcv-worktrees/routine-antcv-nightly-mvo7yaym` on `origin/main` `e6ab506a`.
- TOKEN OK, expires 2026-10-30T07:46:30Z (4.5 d left). Re-save before then.
- **DISPATCH GAP: previous start 2026-10-23T07:51Z, 2.5 days.** The 10-24 desktop run did not fire.
- No shift claim: no loaded `pwa/` asset changed, no version consumed.
- Overlap: CI 10-25 swept rows 38/41/42/43/44 and named 59/63/64 as owed to a desktop run. This run took those plus 58. No DESKTOP entry for today existed.

## Baseline (before any edit)

- `run-tests.mjs pwa` 1850/1850. `boot-smoke` glDemo=function, errors=0. `check-register` OK, 93 ACTIVE.

## Live attest (desktop-only)

| Check | Result |
|---|---|
| `diag-live-guard-sidecars.mjs` | PASS 9/9 (3 boot 401s expected) |
| `browser-qa --only version-live,sidecars-live` | 2/2 |
| served `sw.js` CACHE | `antcv-1.51.5114-proof-points` = repo |
| served `app.js?v` | `1.51.5094-brand-ink-fit` = repo |
| `/health` ×4 | 200: antcv-access-relay `auth-38-subtitle-guard-qual-put`, cv-proxy + antcv-demo-proxy `3.8.4-brand-ink-match`, docx-worker **`1.14.174` → `1.14.175-ai-mark-props` after this run's deploy** (`pdf_via: cloudconvert`) |

## Shipped: docx-worker deploy (AI-ACT-MARK-001)

- Found: repo `VERSION = "1.14.175-ai-mark-props"` (b8a63c08, PR #385, 10-23), live `/health` `1.14.174-appline-edit`. The PR's deploy.yml run was the `pull_request` check, not a deploy. Nothing in the register tracked it.
- Pre-deploy checks: docx-worker suite 62/62. Local OPC check on all three builders (two-column CV, linear CV, CL): `docProps/custom.xml` present, content type override present, `_rels/.rels` relationship present, standard fmtid, pids 2,3. The change uses the `docx` library's own `customProperties`, so a Word "unreadable content" risk is low.
- Deploy: `gh workflow run deploy.yml -f target=docx-worker -f mode=deploy -f confirm=docx-worker` → run 40226340665, success.
- Post-deploy: `/health` `1.14.175-ai-mark-props`. Live `POST /generate` (two-column CV) returned a DOCX whose `custom.xml` carries `AIGenerated` and the Art. 50(2) disclosure.

## Band E

- **E2** `diag-settings-panel-churn` selftest PASS; 4 panels at rest.
- **E3** `diag-panel-button-audit` 219 → 210 buttons, 0 regressions, 0 recoveries, page errors 0. The 10-23 swap reversed: "⇥ Fit" is back, the three stateful "SIDEBAR headline alignment: …" labels are gone, "Make It Fit (sidebar)" hidden 0 → 1. That confirms the 10-23 reading: state-dependent labels, not a missing control. Report `PANEL_BUTTON_AUDIT_2026-10-25.md`.
- **E4** `diag-results-preview-export-parity` OK.
- **E1** rows 58/59/63/64 (stalest, 2026-10-15), all kept ACTIVE, `verified` → 2026-10-25:
  - **58 EXPORT-SETTLED-001** — verified. `diag-mob008` OK, `diag-mob009` OK first run (identical maps, scale 1 vs 0.471). MOB-001..007 real-phone gated.
  - **59 GENERATOR-BASELINE-001** — verified. `__antcvRowFit` 8, `goldDensity` 4. Clean-cut floor real-gen gated.
  - **63 ANALYSIS-STALE-ON-APP-LOAD-001** — verified by code read. Guard intact at `app.src.js:18778` (moved from 18765). Open handlers still clear via `bo(n.rationale || null)`. Not live-repro'd: a saved-app switch on the owner's account writes live state.
  - **64 ANALYSIS-EXPORT-DROPS-FILLED-ANSWERS-001** — verified. `diag-new2-gap-detail-export.mjs` OK (CI cannot run it).

## Bands A-D

Not advanced. A1/A2 need a second physical device. B1/B2 need a signed-in content repro. C/D need a real LLM generation. Row 130 still waits on the owner.

## Owner-verify

1. Open one fresh DOCX export in Word: File → Info → Properties → Advanced → Custom should list `AIGenerated` and `AIDisclosure`, and the file should open without a repair prompt.
2. Row 63: switch between two targeted saved apps; the second must not show the first's analysis.
3. Row 64: fill a gap detail on a real app, export the analysis PDF, confirm it is in.

## Owner decisions

- Row 130: unchanged since 10-20.
- Token expires 2026-10-30. Re-save `~/.antcv/token` before then.
- Dispatch gap: 10-24 desktop run skipped.

## Non-claims

- No PWA change, no app.js edit, no `npm run build:app`, no D1 read, no real LLM generation.
- The DOCX was not opened in Word or LibreOffice (neither scripted here). Validity rests on the OPC structure check.
- Row 63 verified by code read, not by a live app switch.
- Not tested on a real device.

## Evidence index

- `docs/qa/PANEL_BUTTON_AUDIT_2026-10-25.md` / `.json`.
- Deploy run https://github.com/gabrielk83/AntCV/actions/runs/40226340665.
- Live attest and diag PASS lines quoted above; `docs/qa/last-browser-qa.json` not committed.
