# AntCV CI Nightly — 2026-10-23

- **Runner:** GitHub Actions, unattended (gabrielk83/AntCV), Opus 4.8, fresh clone.
- **Base:** `origin/main` `242f6635` (sync-first: `git fetch` + `pull --rebase` already up to date).
- **Suite:** `node scripts/run-tests.mjs pwa` → **1843/1843 pass / 0 fail**. `check-register.mjs` OK before + after (93 ACTIVE).
- **Env gates:** `ALLOW_DEPLOY=false` → no worker deploys attempted. No app.js/worker edit → no boot-smoke / cache-bust / shift-claim owed. Docs-only push, no `pwa/` asset, no version consumed.

## Band worked: E1 — register staleness sweep (NIGHTLY_BACKLOG_RECONCILE slot)

Took the 5 stalest rows from `check-register.mjs --stalest 8`. All five are code-anchored and verified **INTACT** at HEAD; each kept ACTIVE on its existing gate with `verified:` refreshed to 2026-10-23 (index + detail).

| row | ID | verify result | residual (gate) |
|---|---|---|---|
| 2 | `LINKIFY-EXPORT-001` | `sidebar_ratio` in `docx-worker/src/index.js` [2 refs]; lock `main-column-ratio-width.test.mjs` **1/1 PASS** | per-line font-metric fidelity → row 25 (real-PDF-gated) |
| 47 | `MOBILE-TOPBAR-SAFEAREA-001` | `.antcv-topbar` safe-area padding in BOTH bundles [1 ea]; `antcv-topbar-tools-347.js` loaded; `antcv-mobile-export-fab.js` correctly ABSENT | live phone FAB-relocation re-verify (owner/desktop, no device in CI) |
| 50 | `UPLOAD-SCREEN-TOP-CLIP-001` | upload `.fade` `justifyContent:"flex-start"` intact; dead `el.scrollTop = 0` stays removed; `upload-screen-top-clip.test.mjs` **4/4** | owner live re-verify (with/without background gen) |
| 51 | `PREVIEW-SCROLL-JITTER-001` | `preview-scroll-jitter.test.mjs` **3/3**; cosmetic deps `Ke, ya` still absent from fit-recompute dep array in both bundles | owner live re-verify |
| 49 | `SIDEBAR-GROUP-PAGE-BREAK-001` | still genuinely NOT-STARTED — `(CONT.)` is SECTION-level only (`CONT_SUFFIX` [2 refs]), no per-GROUP break | owner-authorized design work; dedicated diagnostic-first session + real long-group export + worker deploy (CI lacks) |

No owner-gated row force-closed — each residual is an owner / live / render / design step, not a code gap.

## Bands A–D — not advanced

- **A1/A2** (gen-background, tab/device isolation): need a live mobile gen + a second physical device.
- **B1/B2** (SO-003 data loss, SO-004 crash): need a signed-in headless repro with real content.
- **C/D** (content correctness, perf/model-role): need live LLM routing / a worker deploy / a real CloudConvert render.

None available in unattended CI (CLOUD CAVEATS).

## New stalest after the sweep (for the next desktop/live run)

Rows 53 `CROSS-APP-EXPORT-CONTAMINATION-001`, 54 `GEN-JD-TAILOR-KERNEL-RECALL-001`, 55 `TARGETED-OUTPUT-FURNITURE-001` (all 2026-10-13). Remaining legs are real-LLM-gen / live-export; left untouched rather than date-refreshed without a real check.

## Owed to a desktop run

Nothing shipped → no post-deploy live-verify owed this run. The live-phone / owner-eyeball / real-PDF / design-session steps on rows 2 / 47 / 50 / 51 / 49 carry forward.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
