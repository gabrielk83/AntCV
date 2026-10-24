# AntCV CI nightly — 2026-10-24 (GitHub Actions, unattended)

- **Runner:** GitHub Actions, Opus 4.8, fresh clone on `origin/main` `b8a63c08`.
- **Mode:** unattended CI. No in-app Browser pane, no signed-in session, no real LLM
  generation, no real CloudConvert PDF render, no second physical device. `ALLOW_DEPLOY`
  not set → no worker deploys. Any `pwa/app.js` / `pwa/app.src.js` / `workers/**` change
  would require a PR for owner review (CI safety override) — none made this run.
- **SYNC FIRST:** `git fetch origin && git pull --rebase origin main` → already up to date.
- **Baseline:** `node scripts/run-tests.mjs pwa` → **1850/1850 pass / 0 fail**;
  `node scripts/check-register.mjs` OK before and after the edits.
- **Context:** two commits landed since the last CI sweep (2026-10-23) — AI-ACT-MARK-001
  `b8a63c08` (docx-worker AI marking) and proof-points rules `27344d48`. Neither touches
  any of the five stalest rows' code anchors.

## Band E1 — register-staleness sweep (NIGHTLY_BACKLOG_RECONCILE slot)

`node scripts/check-register.mjs --stalest 8` → took the 5 oldest (all @ 2026-10-14).
Each verified against current HEAD, kept ACTIVE on its existing gate, `verified:` refreshed
to 2026-10-24 in both the index (`OPEN_REGISTER.md`) and the detail (`REGISTER_ACTIVE_DETAIL.md`).

| Row | ID | Verify result | Gate / why still open |
|---|---|---|---|
| 76 | `JOBTRACKER-LLM-REFIT-BUTTON-001` | Unchanged — deferred OPTIONAL enhancement, not a defect. Deterministic Top-5 fit ranking is by design. No code owed. | Optional; build only if the deterministic tier proves too coarse on real edge JDs. |
| 82 | `ROLE-CANON-AUDIT-LEG-001` | **CODE LEG DONE.** `role_canon_issues(cv, lang, gold)` wired into `run()` at `gold_audit.py:22,94-95`; `scripts/job-tracker/test_gold_residue.py` RE-RAN **18/18 pass**. | Owner-gated es/zh canon-wording eyeball only. |
| 60 | `PANEL-CONTROLS-2026-07-07` | Both control sidecars still wired in `index.html` (2 refs); leg (d) `clClosingHidden`/`clSignNameHidden` still the genuine gap (0 reads in `app.src.js` + `antcv-docx-client.js`). | 6-leg feature; needs live-DOM capture + a live repro before ship (auto-deploy prod). An app.js change would also need a PR. Out of scope for unattended CI. |
| 61 | `LINE-DISTRIBUTION-GUIDELINES-001` | Standing guidelines anchor; partly baked under LINE-DISTRIBUTION-001 — `antcv-bullet-targets.js goldDensity()` (4 refs) + `window.__antcvRowFit` (8 refs in app.src.js) re-confirmed present. | Remaining points (clean-cut floor, result one-line budget, multi-language render-measure) feed the generator orphan-measure work (rows 27/49/59A). |
| 57 | `TARGETED-CV-POLISH-RULES-001` | Same line-fill anchors present (overlaps row 61). | Content/furniture polish rules remain generator-baseline TODOs. |

No owner-gated row was force-closed — each residual is a deferred / owner-eyeball / live-repro /
standing-anchor step, not a code gap.

## Bands A–D — not advanced (blocked in unattended CI)

- **A1 `GEN-BACKGROUND-001` / A2 tab-device isolation:** need a live mobile gen A/B and a
  second physical device.
- **B1 SO-003 / B2 SO-004:** need a signed-in headless repro with real content.
- **C / D:** need live LLM routing, a worker deploy, or a real CloudConvert render.

None available here (CLOUD CAVEATS).

## New stalest after the sweep

Rows 38 `GEN-BACKGROUND-001`, 41 (SO-004 CRASH), 42 `GEN-LANGFAB-001` (all @ 2026-10-15).
Their remaining legs are live-mobile-gen / signed-in-headless-#185-repro / real-regen — a
desktop or live run should take them next. Left untouched rather than date-refreshed without
a real check.

## Push / deploy

Docs-only push to `main`. No `pwa/` asset, no version consumed, no shift claim, no deploy.

## Owed to a desktop / owner run

- Nothing shipped → **no post-deploy live-verify owed** this run.
- Row 82: owner es/zh canon-wording eyeball.
- Row 60: live-DOM capture + live repro + PR for the six panel-control legs.
- Rows 61/57: generator-baseline line-fill work (needs a renderer / generator pass).
