# AntCV CI Nightly — 2026-09-29 (GitHub Actions, unattended, Opus 4.8)

Substrate: GitHub Actions, unattended. `ALLOW_DEPLOY=false`. No signed-in browser, no chromium
(`~/.cache/ms-playwright` absent), no real LLM generation, no real device, no CloudConvert PDF
render, no worker deploy. Authoritative plan: `docs/qa/CLOUD_ROUTINE_PROMPT.md` →
`docs/qa/NIGHTLY_2026-07-05_PROMPT.md` bands + `docs/qa/OPEN_REGISTER.md`.

## Entry state
- `git fetch && git pull --rebase origin main` — already up to date, HEAD `07a07add`.
- Suite: `node scripts/run-tests.mjs pwa` → **1721 / 1721, 0 fail**.
- `node scripts/check-register.mjs` → OK, 93 ACTIVE rows / 93 detail sections.

## Band selection
Bands A–D each require a capability this CI environment lacks:
- **A** (mobile / tab-isolation live A/B) — needs a signed-in browser + real device.
- **B** (SO-003 data loss, SO-004 crash repro) — needs headless chromium (absent).
- **C** (content correctness) — measured on FRESH LLM generations (spec rule 38); no live models.
- **D** (PERF-001 profiling; GEN-MODELROLE live deploy verify) — needs a live profile / worker deploy.

Per the owner hard rule ("an end result, not a brickable mid-product") no speculative app.js or
worker surgery was attempted. Work went to **Band E — standing coverage**, which is fully
executable from a clean checkout.

## Band E — E1 register staleness sweep

Stalest-by-date rows (July 92/93/95/96/97; Aug 08-26/27 rows) are either regen/repro-gated (CI
cannot confirm the defect against code) or owned by the job-tracker / discovery / demand-seed
routines. The 09-18 cohort was advanced 2026-09-28 and the 09-20 cohort (38/76/82/94) sits at
2026-09-20. So the **stalest ADVANCEABLE cohort is the 2026-09-19 batch** — rows 34, 27, 28, 29
(row 34's same-era neighbours; no `_(STANDING)_` rows in this cohort).

All four verify-first CONFIRMED against HEAD `07a07add`, advanced to `verified: 2026-09-29`:

| Row | ID | Verify evidence (HEAD 07a07add) | Status |
|---|---|---|---|
| 34 | ROLE-MERGE-STORED-001 | `antcv-role-merge-stored.js` loaded in index.html (1 ref); `window.AntcvMergeSameCompanyRoles` exposed by `antcv-docx-client.js` (2 hits) + consumed by the sidecar; `role-merge-stored.test.mjs` + `merged-results-union.test.mjs` present + GREEN in-suite | CODE INTACT — signed-in preview==export byte eyeball on a targeted regen owed |
| 27 | MAIN-RUNT-ORPHAN-SWEEP-001 | all 4 ORPHAN-PREFLIGHT-V3 sidecars loaded (`antcv-orphan-export-preflight.js`, `-measure-bind`, `-package-orphan-apply`, `-cloud-persist-385`, 1 ref each) | v3 shipped; OPEN legs (work-style tail truncation / page-3 ghost / ~1.5pp real-PDF verify) all real-render-gated |
| 28 | NIL-GEN-ADAPTATION-001 | `antcv-profile-access-scrub.js` + `antcv-sidebar-relevance-cut.js` loaded (1 ref each) | belts intact; CV ~1.5pp gen-level target regen-gated (rides row 27) |
| 29 | NIL-TARGETED-STATE-STICK-001 | `META-DRIFT-GUARD-002` in `app.js` (1) + `app.src.js` (2); `277-SEQUENCE-GUARD-001` in sidecar `antcv-generate-cloud-sync-277.js` (5); `CL-HYDRATE-EXPORT-GATE-001` in `antcv-docx-client.js` (3) | legs A/B/em-dash closed + intact; leg C (writer-hunt setItem probe + auto-save downgrade belt) needs a live signed-in session |

## Band E — E2 / E3 (STANDING)
- **E2 (row 17):** `diag-personal-panel-probe.mjs` present but Playwright; cannot run headless (no
  chromium). Panel code unchanged since the last pass — no regression signal.
- **E3 (row 23):** `diag-panel-button-audit.mjs` present; same Playwright/headless block — no diff.

## Owner-verify carried forward
- **Row 34:** signed-in preview==export byte eyeball on a targeted regen.
- **Rows 27 / 28:** a fresh NIL-targeted generation + real CloudConvert PDF (orphan v3 real-PDF ~1.5pp
  verify; NIL gen-level 1.5pp target).
- **Row 29:** leg-C live `setItem` probe on `sections`/`meta` during one row selection, to catch the
  pre-gen auto-save that defeats the 277 staleness guard, plus the auto-save downgrade belt.
- **Standing infra blocker:** row 109 `DEPLOY-YML-CF-AUTH-BROKEN-001` — deploy.yml has failed since
  2026-08-01; every "deploy via deploy.yml" instruction silently no-ops until the owner rotates the
  Cloudflare token + account id.

## Shipped code / deploys this run
None. No PWA asset or worker changed → **no post-deploy live-verify owed**, no cache-bust, no shift
claim (docs-only). Report + register edits pushed directly to `main` per the CI safety override.

## Files touched
- `docs/qa/OPEN_REGISTER.md` — 4 `verified:` dates advanced to 2026-09-29 (rows 34/27/28/29).
- `docs/qa/REGISTER_ACTIVE_DETAIL.md` — E1 re-verify note added to rows 34/27/28/29.
- `docs/qa/REGISTER_RUNLOG.md` — run summary at top.
- `docs/qa/NIGHTLY_CI_2026-09-29_REPORT.md` — this report.
