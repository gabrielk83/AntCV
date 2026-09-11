# AntCV nightly — CI run 2026-09-11 (GitHub Actions, unattended, Opus 4.8)

Substrate: GitHub Actions, no signed-in browser, no real LLM, no real-device, `ALLOW_DEPLOY=false`.
Authoritative plan: `docs/qa/CLOUD_ROUTINE_PROMPT.md` → `docs/qa/NIGHTLY_2026-07-05_PROMPT.md`
(Band E1) + `docs/qa/OPEN_REGISTER.md`.

## Entry state
- `git fetch origin && git pull --rebase origin main` → already up to date; main GREEN.
- `node scripts/run-tests.mjs pwa` → **1715/1715** pass.
- `node scripts/check-register.mjs` → OK on entry.

## Band selection
Bands A–D each need a capability this CI environment lacks:
- **A1/A2** (gen-memo A/B, tab/device isolation) — real mobile gen + signed-in device.
- **B1/B2** (SO-003 data-loss, SO-004 crash) — B2 has no headless repro (mobile-only reflow);
  B1 needs a real editor drive.
- **C1–C3** (langfab, CA-006, analysis-print) — code shipped; owner-verify is a fresh real gen.
- **D1/D2** (perf profile, model-role live) — real render / `ALLOW_DEPLOY=false`.

→ Worked **Band E1 — register staleness sweep**. The stalest `verified:` cohort is the twelve
`2026-07-05` rows (the owner's mobile live-session batch). Prior CI runs swept the 09-04..09-09
batches (rows 34/27/28/29 on 09-09, rows 38/76/82/94 on 09-10); the 07-05 rows were the next
stalest and had not been re-verified since they were filed.

## Verify-first — every shipped artifact confirmed intact on HEAD `3f8866bf`

| Row | ID | Artifact checked | Result |
|---|---|---|---|
| 2 | LINKIFY-EXPORT-001 | `workers/docx-worker/test/main-column-ratio-width.test.mjs` | present; content+bullets leg locked, residual → row 25 |
| 39a | AUTOSAVE-NO-DOWNGRADE-001 | `pwa/antcv-pointer-stale-guard.js` (+ loaded in index.html) | present; 2/3 legs shipped |
| 41 | SO-004 | `#185` capture probe in `pwa/antcv-debug-logger.js` | present; no headless repro |
| 42 | GEN-LANGFAB-001 | `pwa/antcv-lang-fabrication-guard.js` (+ loaded) | present |
| 43 | CA-006 | `pwa/antcv-candidate-preview-editor-341.js` + `pwa/test/unit/ca006-pathc-header-guard.test.mjs` | present |
| 44 | JD-ANALYSIS-PRINT-001 | `pwa/antcv-analysis-report-pdf-360.js` + `pwa/test/unit/analysis-print-surface.test.mjs` | present |
| 46 | MOBILE-PANEL-ZOOM-001 | `.fade` scroll box in `app.src.js` (`height:100dvh; overflowY:auto`) + `pwa/test/diag-mobile-panel-zoom.mjs` | present — **CLOSED** |
| 47 | MOBILE-TOPBAR-SAFEAREA-001 | topbar safe-area padding + FAB-skip | present; FAB-relocation live re-verify pending |
| 48 | TOPBAR-UNDO-UNIFY-001 | `antcv-mobile-export-fab.js` DELETED (0 refs) + `antcv-undo-unify-wired` marker in `antcv-sidebar-visibility-ux.js` | present — **CLOSED** |
| 49 | SIDEBAR-GROUP-PAGE-BREAK-001 | (docx-worker page-distribution) | not started, owner design guidance |
| 50 | UPLOAD-SCREEN-TOP-CLIP-001 | `pwa/test/unit/upload-screen-top-clip.test.mjs` | present |
| 51 | PREVIEW-SCROLL-JITTER-001 | `pwa/test/unit/preview-scroll-jitter.test.mjs` | present |

## Actions taken (docs/registers only — no code, no cache-bust, no version consumed)

- **CLOSED 2 rows** that were shipped + owner-LIVE-VERIFIED but still lingered in ACTIVE
  (they passed `check-register.mjs` only because the `CLOSED` marker sits past its first-400-char
  head window, so the gate never flagged them):
  - **Row 46 — MOBILE-PANEL-ZOOM-001** (shipped 1.51.140, live-verified on the owner's real
    Galaxy S24 Ultra) → moved to `REGISTER_CLOSED.md`, index + detail section removed.
  - **Row 48 — TOPBAR-UNDO-UNIFY-001** (shipped 1.51.181, live-verified via a real resize→undo
    click) → moved to `REGISTER_CLOSED.md`, index + detail section removed.
- **REFRESHED to 2026-09-11** (kept ACTIVE — code intact, remaining legs owner/live/model-gated):
  rows 2, 39a, 41, 42, 43, 44, 47, 49, 50, 51.
- `check-register.mjs` → OK, **93 ACTIVE / 93 detail** (was 95). Full suite re-run **1715/1715**.

## OWED to a desktop / owner run (CI cannot do here)
- **42/43/44** — owner-verify on a fresh real generation (langfab drop of non-kernel languages;
  CA-006 no Application-label bleed on a targeted gen; analysis PDF exports the analysis, not the CV).
- **47/50/51** — owner live phone re-verify (FAB relocation off the topbar; upload-screen header
  not clipped with/without a background gen; preview no jitter on cosmetic style change).
- **39a** — leg 3 two-real-device test (needs a real second physical device).
- **41 (SO-004)** — waiting on the next live Android crash to populate the shipped `#185` probe.
- **49** — dedicated diagnostic-first docx-worker session (core page-distribution, owner-authorized).
- No PWA change shipped, so no post-deploy live-verify is owed for this run.

## No owner decision required this run.
