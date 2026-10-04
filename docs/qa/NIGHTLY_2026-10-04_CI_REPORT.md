# AntCV CI Cloud Nightly — 2026-10-04

**Runner:** GitHub Actions (unattended), Opus 4.8. **Base:** `main` @ `c8356182`, `git fetch && pull --rebase` already up to date.

## Constraints this environment
- `ALLOW_DEPLOY=false` → no worker deploy.
- No signed-in browser, no in-app Browser pane → no live `antcv.pages.dev` verify, no live LLM generation.
- Playwright not installed → no headless-DOM diags.
- Per CI safety override: `pwa/app.js`, `pwa/app.src.js`, `workers/**` changes are PR-only; docs + registers may push direct to `main`.

## Gates
- `node scripts/run-tests.mjs pwa` → **1773/1773 green** (0 fail/skip/todo).
- `pwa/test/unit/import-rewrap-keeps-photo.test.mjs` → **7/7 green** (row-18 guard).

## Band selection
Bands A–D of `NIGHTLY_2026-07-05_PROMPT.md` are the standing plan, but every open item in them needs live mobile/device verification, a live LLM generation, or a worker deploy — none available in this CI environment. The CI-doable, high-value work is **Band E1 — register staleness sweep** (`NIGHTLY_BACKLOG_RECONCILE` slot). The prior CI run (2026-10-03, `c8356182`) swept rows 2/49/53/54/55/56; this run takes the next-stalest set.

## E1 — staleness sweep (5 stalest `verified:` rows, refreshed 2026-08-26/2026-09-22 → 2026-10-04)

| Row | ID | Verify-first result | Status |
|---|---|---|---|
| 18 | ANITA-PERSONA-NO-PHOTO-001 | Photo legs **LOCKED**: persona `personalInfo.json` carries the embedded `photo` data URL (61 KB JPEG); IMPORT-REWRAP-DROPS-PHOTO-001 guard present in BOTH bundles (`app.src.js:37725`, `app.js:165`); guard test 7/7. | ACTIVE — residual = CL foundation/bring/interests leg on a fresh Anita gen (live-models-gated). |
| 60 | PANEL-CONTROLS-2026-07-07 | Both control sidecars on disk + wired in `index.html` (`antcv-header-rule-control.js`, `antcv-cl-slogan-control.js`; 2 refs). Leg (d) `clClosingHidden`/`clSignNameHidden` the genuine gap. | ACTIVE — 6 legs need live-DOM + auto-deploy-prod live repro (no browser in CI). |
| 61 | LINE-DISTRIBUTION-GUIDELINES-001 | Partly BAKED under LINE-DISTRIBUTION-001: `antcv-bullet-targets.js goldDensity()` (4 refs) + `window.__antcvRowFit` (8 refs) present. | ACTIVE — standing guidelines anchor; remaining points feed rows 27/49/59A. |
| 57 | TARGETED-CV-POLISH-RULES-001 | Line-fill/orphan points partly served by LINE-DISTRIBUTION-001; content/furniture rules still hand-applied. | ACTIVE — generator-baseline TODOs. |
| 59 | GENERATOR-BASELINE-001 | Leg (A) advanced via LINE-DISTRIBUTION-001 (open for clean-cut floor + mid-unit-cut, rows 27/49); leg (B) docx integrity FIXED in hand-edit tooling; leg (C) renderer = Word-COM desktop-only. | ACTIVE. |

## Shipped this run
- **No code.** Nothing in the stalest set is cloud-verifiable to FIX without a browser, a live LLM generation, or a worker deploy. Owner's "one solid verified fix beats several half-verified ones / no brickable mid-product" rule bars shipping un-live-verifiable gen/export surgery.

## Discipline
- SYNC FIRST done (up to date). No shift claim taken (docs-only run; no version number consumed).
- No `pwa/`/worker asset changed → **no post-deploy live-verify owed**.

## Owed to a desktop / live run (carry forward)
- Row 18: fresh Anita generation to verify the CL foundation/bring/interests leg.
- Row 60: live-DOM capture + patch for the 6 panel-control legs, then live repro before ship.
- Rows 57/59/61: generator-baseline line-fill work needs a real export + Word-COM/CloudConvert render.
- Bands A–D items generally: mobile/second-device A/B, live LLM gen, and worker `/health` all remain desktop/owner-gated.

## Register edits in this run's push
- `OPEN_REGISTER.md` — `verified:` → 2026-10-04 for rows 18, 60, 61, 57, 59.
- `REGISTER_ACTIVE_DETAIL.md` — dated reconcile note prepended to each of the five rows.
- `REGISTER_RUNLOG.md` — this run's summary at the top.
- `NIGHTLY_2026-10-04_CI_REPORT.md` — this report.
