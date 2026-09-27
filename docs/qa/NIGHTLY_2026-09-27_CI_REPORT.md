# AntCV CI NIGHTLY — 2026-09-27 (GitHub Actions, unattended, Opus 4.8)

Substrate: GitHub Actions on `gabrielk83/AntCV`, fresh isolated clone, unattended.
Authoritative procedure: `docs/qa/CLOUD_ROUTINE_PROMPT.md` → live band plan
`docs/qa/NIGHTLY_2026-07-05_PROMPT.md` (Band A–E) + `docs/qa/OPEN_REGISTER.md` +
`docs/qa/SCHEDULED_ROUTINES.md`.

## Entry state
- `git fetch origin && git pull --rebase origin main` → already up to date. HEAD `0537eb7b`.
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
— CI cannot confirm the defect against code. The 08-26/27 rows are routine-owned. The 09-15→16
cohorts were advanced on 09-25→26 respectively. So the stalest ADVANCEABLE cohort is the
**2026-09-17 batch (5 rows; row 17 shares that date but is STANDING → covered under E2/E3)**.
All 5 verify-first CONFIRMED on HEAD `0537eb7b` and advanced to 2026-09-27:

| Row | ID | Verify-first evidence | Remaining (owed) |
|---|---|---|---|
| 25 | TABLE-GEOMETRY-PARITY-001 | forwarding pipeline INTACT — `renderCompetencyTable`/`tableWidthPct`/`tableRatio` present across all five sites: `pwa/antcv-docx-client.js`, `pwa/antcv-table-headers-editable-341.js`, `pwa/antcv-section-align.js`, `pwa/antcv-auto-pagebreak-block-001.js`, `workers/docx-worker/src/index.js`; full suite green | the FIDELITY gap is a real-CloudConvert-PDF render diff (Carlito advance widths, 3pt/7.5pt padding, 2-vs-3 line clamp) CI cannot produce — owner/desktop real-PDF pass |
| 6 | BANNED-WORDS-MERGE-001 | code-complete — `antcv:keep-native-banned` + `antcv:no-kernel-chain` kill-switches ×2 in `pwa/antcv-data-importer.js`; island `banned_*` writer in `pwa/antcv-react-islands.js` | OWNER eyeball of merged banned-words UI + running one file of each of the 6 loader types through the unified loader |
| 8 | KERNEL-V2-READER-001 | `pwa/test/unit/kernel-v2-reader.test.mjs` RE-RUN GREEN 5/5; `antcv:ingestedKernel` staged-kernel reader intact in `pwa/antcv-kernel-import.js` (both bundles) | (a) bullets-path v2-direct migration (safe while autoSync projects v2→workHistory); (c) es/zh + lazy language_view tier — needs real models; (d) §6 P/DOCX/PDF regression parity on an uploaded docx — owner-gated |
| 12 | AI-NOTICE-LEFT-CLOUDCONVERT-001 | `pwa/test/unit/ai-notice-position.test.mjs` RE-RUN GREEN 3/3; page-relative margin-left 0pt/275pt + jc encoding in `workers/docx-worker/src/index.js` unchanged | anchor bug effectively resolved — recommend owner move to CLOSED and re-file the 3 docx-baseline gaps (cjlr-table-export, pageflow-export, spacing-linkedin-export) under their own IDs if still open |
| 21 | SETTINGS-ROLLER-RESET-001 | fix code INTACT — `pwa/antcv-settings-history-guard.js` present with kill-switch `antcv:no-settings-history-guard`; full suite green | the headless `diag-settings-history-guard.mjs` could NOT launch this run (no chromium) → the 2026-09-17 headless GREEN stands as last live confirmation; owner real roller-side hardware Back-button verify still owed |

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
- Row 25: real-CloudConvert PDF vs preview geometry/wrapping diff (Carlito advance widths, padding, line-clamp).
- Row 6: owner eyeball of the merged banned-words UI + one file of each of the 6 loader types.
- Row 8: uploaded-docx §6 regression parity pass + es/zh language_view tier on real models.
- Row 12: owner decision to CLOSE the anchor row and re-file the 3 docx-baseline gaps under own IDs.
- Row 21: real roller-side hardware Back-button live-verify (and the headless diag needs chromium).
- E2/E3: live Playwright diags (need chromium).
- July-stuck 92/93/95/96/97: live regen/render.
- Band B/C app.js surgery (rows 40/41/42/43/44): still wants a PR.
- Row 109: rotate the Cloudflare API token + set the account id so `deploy.yml` works again.
