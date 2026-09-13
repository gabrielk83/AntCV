# AntCV CI Nightly — 2026-09-13 (GitHub Actions, unattended, Opus 4.8)

**Substrate:** GitHub Actions, unattended. **Env:** `ALLOW_DEPLOY=false`, no signed-in Browser
pane, no real LLM, no real device, no CloudConvert render. **Authoritative plan:**
`docs/qa/CLOUD_ROUTINE_PROMPT.md` → `docs/qa/NIGHTLY_2026-07-05_PROMPT.md` (bands) +
`docs/qa/OPEN_REGISTER.md` (single source of open work) + `docs/qa/SCHEDULED_ROUTINES.md`.

## Entry state
- SYNC FIRST: `git fetch origin && git pull --rebase origin main` → already up to date, HEAD `b650fc8b`.
- Baseline suite `node scripts/run-tests.mjs pwa` = **1715/1715**, 0 fail — main GREEN.
- `node scripts/check-register.mjs` = OK, 93 ACTIVE / 93 detail.

## Band selection
Bands A–D each blocked on a capability CI lacks:
- **A (mobile/tab isolation):** A1/A2 shipped; remaining legs need a real mobile gen A/B + a second
  physical device.
- **B (data-loss/crash):** SO-003/SO-004 need a headless/live repro not reproducible here.
- **C (content correctness):** GEN-LANGFAB/CA-006/JD-ANALYSIS-PRINT shipped; residuals need real gen.
- **D (polish/perf):** PERF-001 needs live CPU profiling; GEN-MODELROLE needs live D1 telemetry + deploy.

Per the owner hard rule ("an end result, not a brickable mid-product") no speculative app.js/worker
surgery was attempted. Work fell to **Band E1 — register staleness sweep**.

## Band E1 — staleness sweep of the now-stalest cohort (2026-07-08/09 deliverable-review batch)
After the 09-11 (07-05 batch) and 09-12 (07-06/07 batch) runs bumped their cohorts, the oldest
`verified:` rows are the eleven 2026-07-08/09 KOMBIT/Trackman deliverable-review rows:
**62, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74.** All were swept verify-first against HEAD.

**Result: no register-vs-code lag found — every row is accurately stated.** Every shipped code leg
re-confirmed intact:

| Row | ID | Verify-first evidence at HEAD | Remaining (blocked on) |
|---|---|---|---|
| 62 | HEADER-BANNER-DESIGN-RULES-001 | `bodyTopBorder` + ✉ icon-separated contact in `workers/docx-worker/src/index.js` (5 markers) | render-measure loop vs KOMBIT gold; page-2 balance → row 61 (real render) |
| 74 | JD-SWAP-STALE-RATIONALE-001 | `JD-SWAP-STALE-RATIONALE`/`CL-GHOST-COMPANY` in `app.src.js` (7) + `cl-ghost-hunt.test.mjs` (1.51.216) | (C) backgrounded-tab SSE-stall; owner one-gen validation of (B) |
| 73 | — (CV REVIEW-4 line-fill) | delivered pass; word-method + 2-full-line rules in checklist §2 | page-2 dead-space → float-spine row 61 |
| 72 | AI-NOTICE-ANCHOR-FIX-001 | `__mt = bodyLevel ? 822 : 806` in worker (1.14.136) | page-2+ sidebar dead-space → row 61 (real CloudConvert render) |
| 71 | AI-NOTICE-INLINE-001 | `ai_wm_side`+`mainTint` in worker (1.14.135, 3 markers) | page-2 sidebar slack (float-spine row 61) |
| 70 | — (CV REBUILD v2) | delivered; slogan/closure rules captured; main-tint now shipped (row 71) | body hyperlinks → row 66; slack → row 61 |
| 69 | — (CL polish + em-dash) | `__AINOTICE` footer HYPHEN in all 7 langs (da/es/zh/he/ar/am + EN default) — no em-dash (1.14.134) | standing-rule anchor; no code owed |
| 67 | CV-CORECOMP-BLANK-001 | `antcv-cl-slogan-control.js` loaded; (A) 1.51.29 guards + 22 vm tests | (A) signed-in 2nd-gen regen; (C/D/E) live browser/regen |
| 66 | LINKEDIN-CLICK-001 | Trackman deliverable gaps; `DELIVERABLE_PREFLIGHT_CHECKLIST.md` in place | re-deliver from kernel through app belts + real render |
| 65 | PTR-STALE-GUARD-001 | `CROSS-DEVICE-GEN-LEAK` in `app.src.js` (4) + `__fahA`/`__fahB` app.js mirror (2) + diag test (1.51.201) | (A–D) live-mobile / live-repro |
| 68 | JD-SYNC-001 | `origin/brandfit-per-app-scope` still at `fc2477c` (durable backup) | rebase+review+merge; live D1 `ALTER TABLE` (owner fresh-confirm); content-gen regen |

Index dates for all 11 rows → **2026-09-13**; each detail section in `REGISTER_ACTIVE_DETAIL.md`
carries the evidence line.

## Exit state
- `node scripts/check-register.mjs` = OK, **93 ACTIVE / 93 detail**.
- Full suite re-run `node scripts/run-tests.mjs pwa` = **1715/1715**.
- Docs/registers only — no `pwa/` loaded asset changed → **no cache-bust quintet, no version
  consumed, no shift claim** needed (per SCHEDULED_ROUTINES docs-only rule).
- No `pwa/app.js`, `pwa/app.src.js`, or `workers/**` change → **no PR owed**, no worker deploy owed.
- No PWA change shipped → **no post-deploy live-verify owed**.

## OWED to a desktop/owner run
- Row 67(A): signed-in 2nd-generation convergence regen on the same application (CORE COMPETENCIES /
  CL prose / Accessibility survival).
- Row 74(B/C): owner one-foreground-gen validation of the stale-rationale clear; the backgrounded-tab
  SSE-stream throttle (the real mobile first-gen blocker) — diagnostic-first next.
- Rows 66/70/73: re-deliver from the master-profile kernel through the app belts + a real render.
- Row 65(A–D): LANG-SWITCH-MOBILE live-verify; analysis-export unsolicited-gate + market-fit/salary
  JD wiring + panel-upload OCR live-repro.
- Row 68(A): brandfit-per-app-scope branch rebase → review → live D1 `ALTER TABLE` (owner fresh
  confirm) → merge; (B–F) content-gen regen + owner/desktop legs.
- Rows 62/72/71: page-2 float-spine (row 61) + a real CloudConvert render to close the residuals.

## Bands B/C app.js surgery (rows 40/41/42/43/44)
Unchanged — still want a PR from a run that can headlessly repro (SO-003 data-loss, SO-004 #185 crash)
or drive a real gen. Not attempted in CI (owner hard rule).
