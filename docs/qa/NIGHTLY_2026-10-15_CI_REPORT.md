# CI Nightly report — 2026-10-15 (GitHub Actions, unattended, Opus 4.8)

**Run type:** Band-E E1 register staleness sweep. No code shipped.
**HEAD:** `035a030e` (SYNC FIRST clean — `git fetch && git pull --rebase origin main` already up to date).
**Suite:** 1821/1821 green (`node scripts/run-tests.mjs pwa`, 0 fail); `check-register.mjs` OK.
**Environment:** `ALLOW_DEPLOY=false`, no in-app Browser pane, no signed-in session, no relay token.
Bands A–D stay blocked on live/device/owner/real-model gates CI cannot clear.

## E1 — 5 stalest rows, re-verified against HEAD and refreshed to 2026-10-15

The only commit since the last sweep was the 2026-10-14 docs refresh (`035a030e`) — **no code
landed** — so each row was re-verified against its unchanged anchors.

| # | ID | Verdict | Evidence |
|---|---|---|---|
| 59 | GENERATOR-BASELINE-001 | CODE-INTACT; open on render gates | Leg (A) generator pagination/orphan anchors intact: `window.__antcvRowFit` **8 refs** in `pwa/app.src.js`; `goldDensity` **4 refs** in `pwa/antcv-bullet-targets.js` + `pwa/test/unit/gold-density-shared.test.mjs`. Leg (B) docx integrity FIXED in hand-edit tooling (unchanged). Leg (C) renderer = desktop Word-COM only, not CI. Still open for clean-cut floor + mid-unit-cut/blank-lower-sidebar (rows 27/49). |
| 18 | ANITA-PERSONA-NO-PHOTO-001 | photo legs RE-LOCKED; CL-gen leg owed | `docs/personas/anita/personalInfo.json` carries the embedded `photo` data URL (61,059 chars, `data:image/jpeg;base64,/9j/…`). The photo-drop guard is now the stronger sibling-preserving rewrap (IMPORT-REWRAP-SIBLING-DROP-001, row 107): `app.src.js:37724` comment-marked, preserved-sibling list `["photo","language","navyColor",…]` mirrored at `pwa/app.js:165`. `import-rewrap-keeps-photo.test.mjs` green in-suite; app.js integrity OK (`node --check`, `startsWith("(()=>{")`, zero `"use strict"`). CL foundation/bring/interests leg on a fresh Anita gen still needs live models. |
| 117 | CLUSTER-GLOBAL-SINGLE-JD-DOMINANCE-001 | owner design decision owed (not a code bug) | Writer behaviour is by-design: `recomputeClusterTop20` (`workers/access-relay/src/index.js:2508`) orders `ORDER BY weight_sum DESC, frequency DESC LIMIT 20` (`:2512`); rank-scaled research weight (ceiling 0.4, `RESEARCH_WEIGHT * (21 - rank) / 20`, `:2604`) still sits below a real-JD row's `weight_sum 1`. CI has no relay token, so the live D1 split can't be re-measured — the row's read-only evidence query stands. Owner call owed (jd_count threshold / blend / exclude per-user JD). |
| 63 | ANALYSIS-STALE-ON-APP-LOAD-001 | guard INTACT; live-verify owed | Mount-hydrate unsol-guard present at `pwa/app.src.js:18765` (gated by the `!(t.meta.company && !__antcvUnsol(...))` check at `:18790`); `__antcvUnsol` referenced **37×**; app-list open handlers (`43355`/`43435`) overwrite rationale on load. Owner live-verify owed (targeted→targeted saved-app switch needs the relay — no headless repro in CI). |
| 64 | ANALYSIS-EXPORT-DROPS-FILLED-ANSWERS-001 | guard INTACT; live-verify owed | `pwa/antcv-analysis-report-pdf-360.js` carries the content-based `gapStateKey`/`readGapState` helpers (**6 refs**). `pwa/test/diag-new2-gap-detail-export.mjs` is a **Playwright** diag — chromium is absent in CI, so it runs only on desktop and is NOT part of the node `run-tests.mjs pwa` suite (which is 1821/1821 green). Owner live-verify owed (fill a gap detail live → confirm it exports). |

All five CODE-INTACT / as-scoped; kept ACTIVE on their live/owner/real-model gates.

## Gates before push
- Suite 1821/1821; `check-register.mjs` OK.
- Docs/registers only → no cache-bust quintet, no version consumed, no shift claim, no PR owed.

## Owed to a desktop / owner run
- **Row 59:** generator-baseline bake measured on a real LLM gen + render (clean-cut floor, mid-unit-cut/blank-lower-sidebar); desktop Word-COM / renderer leg (C).
- **Row 18:** fresh Anita CV+CL gen to verify the CL foundation/bring/interests leg (live models).
- **Row 117:** owner design decision + a live D1 re-measure of the `__global_market__` split.
- **Row 63:** signed-in live-verify of a targeted→targeted saved-app switch (relay-gated).
- **Row 64:** signed-in live-verify — fill a gap detail, export the analysis PDF, confirm it carries the detail + "how I cover" + ✓Covered marker.

## Post-deploy live-verify owed
- None — no PWA/worker change shipped this run.
