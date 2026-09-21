# AntCV CI NIGHTLY — 2026-09-21 (GitHub Actions, unattended, Opus 4.8)

Substrate: GitHub Actions on `gabrielk83/AntCV`, fresh isolated clone, unattended.
Authoritative procedure: `docs/qa/CLOUD_ROUTINE_PROMPT.md` → live band plan
`docs/qa/NIGHTLY_2026-07-05_PROMPT.md` (Band A–E) + `docs/qa/OPEN_REGISTER.md` +
`docs/qa/SCHEDULED_ROUTINES.md`.

## Entry state
- `git fetch origin && git pull --rebase origin main` → already up to date. HEAD `136fb3a8`.
- `node scripts/run-tests.mjs pwa` → **1715/1715, 0 fail**.
- `node scripts/check-register.mjs` → OK, 93 ACTIVE rows / 93 detail sections.
- `ALLOW_DEPLOY=false` (≠ `'true'`) → no worker deploys this run. `deploy.yml` remains dead
  (row 109, expired CF token — owner action owed).
- No chromium in this env (`~/.cache/ms-playwright` absent) → live Playwright diags cannot run.

## Bands A–D — not worked (blocked on capabilities CI lacks)
Each of Bands A–D needs a capability this unattended CI environment does not have — signed-in
live-verify on `antcv.pages.dev`, a real LLM generation, a real second device, a real
CloudConvert PDF render, or a worker deploy. Per the owner hard rule ("an end result, not a
brickable mid-product") no speculative `app.js`/`app.src.js`/worker surgery was attempted. Any
Band B/C app.js work (rows 40/41/42/43/44) would require a PR for owner review anyway (CI safety
override rule 3).

## Band E — E1 register staleness sweep (the work of this run)
The genuinely-stalest rows by `verified:` date (July-stuck 92/93/95/96/97) remain regen/repro-gated
— CI cannot confirm the defect against code. The 08-26/27 rows are routine-owned. The 09-07/08/09/10
cohorts were advanced on 09-17/18/19/20 respectively. So the stalest ADVANCEABLE cohort is the
**2026-09-11 batch (10 rows)**. All 10 verify-first CONFIRMED on HEAD `136fb3a8` and advanced to
2026-09-21:

| Row | ID | Verify-first evidence | Remaining (owed) |
|---|---|---|---|
| 2 | LINKIFY-EXPORT-001 | worker `sidebar_ratio` fix [2 refs] + lock `main-column-ratio-width.test.mjs` present; content/hyperlink legs locked | residual per-line font-metric fidelity folds into row 25 (real-PDF-gated) |
| 39a | AUTOSAVE-NO-DOWNGRADE-001 / PTR-STALE-GUARD-001 | `antcv-pointer-stale-guard.js` loaded + relay guard present + `jd-scope-isolation.test.mjs` green | row 19 two-real-device + live authed A/B (owner-gated) |
| 41 | SO-004 (#185) | `antcv-debug-logger.js` #185 capture probe loaded; no headless repro (React-18 #185 = max-update-depth, needs real Android reflow) | live Android crash to populate a capture |
| 42 | GEN-LANGFAB-001 | `antcv-lang-fabrication-guard.js` loaded + `lang-fabrication-guard.test.mjs` green | fresh targeted-gen owner-verify (German omitted, Danish B1) — regen-gated |
| 43 | CA-006 | `antcv-candidate-preview-editor-341.js` loaded + `ca006-pathc-header-guard.test.mjs` green; sidecar-only Path-C guard | owner click-through eyeball (live) |
| 44 | JD-ANALYSIS-PRINT-001 | `antcv-analysis-report-pdf-360.js` loaded + `analysis-print-surface.test.mjs` green; render-present offscreen iframe | owner click-through of "Download analysis (PDF)" |
| 47 | MOBILE-TOPBAR-SAFEAREA-001 | topbar `env(safe-area-inset-top)` padding in app.js mirror [1 ref] + `antcv-topbar-tools-347.js` loaded; redundant `antcv-mobile-export-fab.js` correctly ABSENT | live phone FAB-relocation re-verify (owner-gated) |
| 49 | SIDEBAR-GROUP-PAGE-BREAK-001 | docx-worker page-distribution (`cantSplit`/`sidebar_ratio`) unchanged — defect still applies | genuinely NOT-STARTED design work; needs a dedicated diagnostic session + real long-group export |
| 50 | UPLOAD-SCREEN-TOP-CLIP-001 | `justifyContent:"flex-start"` block + `upload-screen-top-clip.test.mjs` green (both bundles) | owner live re-verify (with/without active background gen) |
| 51 | PREVIEW-SCROLL-JITTER-001 | `preview-scroll-jitter.test.mjs` green — `Ke,ya` cosmetic deps removed from the fit-recompute effect in both bundles | owner live re-verify |

## Band E — E2/E3 standing coverage
- **E2 (row 17, settings-panel stability) / E3 (row 23, button-audit):** the live Playwright diags
  (`diag-*-panel-*.mjs`) cannot launch — no chromium in this env. The regression ANCHORS that gate
  these rows run inside the green node `--test` suite (1715/1715) → **node-suite standing coverage
  PASS**; the live Playwright legs are owed to a desktop run.

## Post-edit verification
- `node scripts/check-register.mjs` → OK.
- `node scripts/run-tests.mjs pwa` RE-RUN after the register edits → **1715/1715**.

## What shipped
Docs/registers only — no PWA/worker code touched. No cache-bust, no version number consumed, no
shift claim (docs-only, per SYNC-FIRST rules), no PR. No PWA change shipped → **no post-deploy
live-verify owed** for this run.

## OWED to a desktop / owner run
- Row 39a: two-real-device test + live authed downgrade-PUT / same-device stale-pointer A/B.
- Row 41: live Android #185 capture (waiting on next crash).
- Row 42: fresh targeted-gen language check.
- Rows 43/44: owner click-through eyeball.
- Row 47: live phone FAB-relocation re-verify.
- Rows 50/51: owner live re-verify.
- Row 49: dedicated docx-worker page-distribution session (real long-group export).
- E2/E3: live Playwright diags (need chromium).
- July-stuck 92/93/95/96/97: live regen/render.
- Band B/C app.js surgery (rows 40/41/42/43/44): still wants a PR.
- Row 109: rotate the Cloudflare API token so `deploy.yml` works again.
