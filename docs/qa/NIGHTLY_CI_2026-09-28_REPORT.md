# AntCV CI Nightly — 2026-09-28 (GitHub Actions, unattended, Opus 4.8)

Substrate: GitHub Actions, unattended. `ALLOW_DEPLOY=false`. No signed-in browser, no chromium
(`~/.cache/ms-playwright` absent), no real LLM generation, no real device, no CloudConvert PDF
render, no worker deploy. Authoritative plan: `docs/qa/CLOUD_ROUTINE_PROMPT.md` →
`docs/qa/NIGHTLY_2026-07-05_PROMPT.md` bands + `docs/qa/OPEN_REGISTER.md`.

## Entry state
- `git fetch && git pull --rebase origin main` — already up to date, HEAD `c9c60887`.
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
routines. The 09-17 cohort was advanced 2026-09-27. So the **stalest ADVANCEABLE cohort is the
2026-09-18 batch** — rows 22, 33, 24, 26, 30, 32 (row 17 of the same era is `_(STANDING)_` → E2/E3).

All six verify-first CONFIRMED against HEAD `c9c60887`, advanced to `verified: 2026-09-28`:

| Row | ID | Verify evidence (HEAD c9c60887) | Status |
|---|---|---|---|
| 22 | CL-SLOGAN-RICHCONTENT-001 | `antcv-cl-slogan-element.js` loaded in index.html (1 ref) + kill-switch `antcv:disable-cl-slogan-element` present | phase 2 (real `sections.cl` rich_block) GENUINE OPEN WORK — spec-before-splice, owner-gated |
| 33 | WHY-RULE-EXPORT-PARITY-001 | `antcv:nameLineAlign`/`headline_align`/`headlineAlign` in `antcv-docx-client.js` (3 hits); `export-align-parity.test.mjs` GREEN | CODE-COMPLETE — **recommended CLOSED**; only signed-in export eyeball remains |
| 24 | ANALYTICS-BUTTONS-SESSION-TIMEOUT-001 | `auth-401-wipe-scope.test.mjs` GREEN; server secret-pair fix recorded live-verified | owner three-button click-through only remainder (owner-gated) |
| 26 | TOOLS-SIDEBAR-COMPRESS-001 | `antcv-sidebar-compact-001.js` loaded; `sidebar_compact` in `gold-rules.json`; `sidebar-compact.test.mjs` GREEN | owner visual verify + SIDEBAR-PACKING token-order belt remain |
| 30 | LLM-IMAGE-ROUTING-001 | `filterVisionBlind`/`VISION_BLIND` in BOTH proxy + demo-proxy `multi-llm.js` (5 hits each); `image-routing-ee.test.mjs` GREEN | CODE-COMPLETE — **recommended CLOSED**; only optional adequacy-gate extension remains |
| 32 | CL-PLATFORM-SIGNALS-001 | `__platformRule` in `app.src.js` (2 hits) / minified `__pr` in `app.js`; `cl-platform-signals.test.mjs` GREEN | CODE-COMPLETE — **recommended CLOSED**; only live gen tone-check remains |

## Band E — E2 / E3 (STANDING)
- **E2 (row 17):** `diag-personal-panel-probe.mjs` present; cannot run headless (no chromium). Panel
  code unchanged since the last pass — no regression signal.
- **E3 (row 23):** `diag-panel-button-audit.mjs` present; same headless block — no diff to report.

## Owner-decision / owner-verify carried forward
- **Recommended CLOSED pending one live eyeball each:** row 33 (signed-in export), row 30 (already
  deployed; behaviour confirmed by test), row 32 (live gen tone-check on a hardware-platform JD).
- **Owner action still required:** row 22 (phase-2 spec sign-off), row 24 (three-button
  click-through), row 26 (visual verify of the gold Instruments/Lab strings).
- **Standing infra blocker:** row 109 `DEPLOY-YML-CF-AUTH-BROKEN-001` — deploy.yml has failed since
  2026-08-01; every "deploy via deploy.yml" instruction silently no-ops until the owner rotates the
  Cloudflare token + account id.

## Shipped code / deploys this run
None. No PWA asset or worker changed → **no post-deploy live-verify owed**, no cache-bust, no shift
claim (docs-only). Report + register edits pushed directly to `main` per the CI safety override.

## Files touched
- `docs/qa/OPEN_REGISTER.md` — 6 `verified:` dates advanced to 2026-09-28.
- `docs/qa/REGISTER_ACTIVE_DETAIL.md` — E1 re-verify note added to rows 22/33/24/26/30/32.
- `docs/qa/REGISTER_RUNLOG.md` — run summary at top.
- `docs/qa/NIGHTLY_CI_2026-09-28_REPORT.md` — this report.
