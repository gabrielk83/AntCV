# AntCV CI NIGHTLY — 2026-09-22 (GitHub Actions, unattended, Opus 4.8)

Substrate: GitHub Actions on `gabrielk83/AntCV`, fresh isolated clone, unattended.
Authoritative procedure: `docs/qa/CLOUD_ROUTINE_PROMPT.md` → live band plan
`docs/qa/NIGHTLY_2026-07-05_PROMPT.md` (Band A–E) + `docs/qa/OPEN_REGISTER.md` +
`docs/qa/SCHEDULED_ROUTINES.md`.

## Entry state
- `git fetch origin && git pull --rebase origin main` → already up to date. HEAD `95038553`.
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
— CI cannot confirm the defect against code. The 08-26/27 rows are routine-owned. The 09-07→11
cohorts were advanced on 09-17→21 respectively. So the stalest ADVANCEABLE cohort is the
**2026-09-12 batch (12 rows)**. All 12 verify-first CONFIRMED on HEAD `95038553` and advanced to
2026-09-22:

| Row | ID | Verify-first evidence | Remaining (owed) |
|---|---|---|---|
| 39 | GEN-MODELROLE-001 | `MODEL_ROLES` in BOTH `workers/proxy/wrangler.toml:50` + `workers/demo-proxy/wrangler.toml:50` (`{"writer":"anthropic","supervisor":"mistral","coherence":"openai"}`); `roleHeadOrder` in multi-llm.js [2 refs]; `model-roles.test.mjs` present | deploy-verify + role-split telemetry (no `gh`/D1 in CI) |
| 53 | CROSS-APP-EXPORT-CONTAMINATION-001 | leg (a) SHIPPED via MIRROR-LOAD-001 marker in `app.src.js` — **2 occurrences (correcting the prior note that said 3×)**; retired `antcv-export-app-scope-guard` correctly NOT wired in index.html [0 refs] | legs b–f (CL lang leak, placeholders, diacritics, CV partial-lang residue, brand-fit) — live-gen-gated |
| 54 | GEN-JD-TAILOR-KERNEL-RECALL-001 | still NOT started — no `KERNEL-RECALL` markers in `pwa/`/`workers/`, no commits on the ID | real targeted gen (owner/live) |
| 55 | TARGETED-OUTPUT-FURNITURE-001 | still NOT started — no `TARGETED-OUTPUT-FURNITURE` markers; all 6 furniture legs hand-fixed only | real targeted gen (owner/live) |
| 56 | GEN-JD-RELEVANCE-TRIM-001 | still NOT started — no `RELEVANCE-TRIM` markers; sibling of row 54 | real targeted gen (owner/live) |
| 57 | TARGETED-CV-POLISH-RULES-001 | line-fill points partly served by LINE-DISTRIBUTION-001 (`goldDensity()` 4 refs + `__antcvRowFit` 8 refs); content/furniture rules remain generator-baseline TODOs | generator-baseline bake of the content/furniture rules |
| 58 | EXPORT-SETTLED-001 (MOBILE-BUGS-2026-07) | MOB-008 fix intact — `antcv-mobile-controls.css` `overflow-y:auto; -webkit-overflow-scrolling:touch !important` [8 refs] + `diag-mob008-panel-overflow.mjs` present | MOB-001/2/3/4/5/6/7 + MOB-GAP-OPEN (headless-repro-blocked, owner live) |
| 59 | GENERATOR-BASELINE-001 | leg A ADVANCED via LINE-DISTRIBUTION-001; leg B docx integrity FIXED in hand-edit tooling | leg A clean-cut floor + mid-unit-cut/blank-lower-sidebar (rows 27/49); leg C renderer = desktop Word-COM only |
| 60 | PANEL-CONTROLS-2026-07-07 | both control sidecars `antcv-header-rule-control.js` + `antcv-cl-slogan-control.js` on disk AND wired in index.html [2 refs]; diagnosed/code-mapped, leg d a genuine gap | all 6 legs need live-DOM capture + patch + live repro before ship (auto-deploy-to-prod) |
| 61 | LINE-DISTRIBUTION-GUIDELINES-001 | partly BAKED under LINE-DISTRIBUTION-001 (`antcv-bullet-targets.js goldDensity()` 4 refs + `window.__antcvRowFit` 8 refs) | clean-cut floor pt10 + result-line one-line budget pt5 + multi-lang render-measure (rows 27/49/59A) |
| 63 | ANALYSIS-STALE-ON-APP-LOAD-001 | mount-hydrate unsol-guard present at `app.src.js:18763`; `__antcvUnsol` 37 refs | owner live-verify (saved-app targeted→targeted switch needs the relay) |
| 64 | ANALYSIS-EXPORT-DROPS-FILLED-ANSWERS-001 | `gapStateKey`/`readGapState` in `antcv-analysis-report-pdf-360.js` [6 refs] + `diag-new2-gap-detail-export.mjs` present | owner live-verify (fill a gap detail live → confirm it exports) |

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
- Row 39: worker deploy-verify + role-split telemetry (D1 `llm_calls`).
- Row 53: legs b–f live targeted gen.
- Rows 54/55/56: real targeted gen to verify recall / furniture / relevance-trim.
- Row 60: live-DOM capture + patch for all 6 panel-control legs (auto-deploy-to-prod → live repro first).
- Rows 63/64: owner live-verify (saved-app switch / gap-detail export — both need the relay).
- Rows 57/59/61: generator-baseline / orphan-measure work (rows 27/49/59A), real render.
- E2/E3: live Playwright diags (need chromium).
- July-stuck 92/93/95/96/97: live regen/render.
- Band B/C app.js surgery (rows 40/41/42/43/44): still wants a PR.
- Row 109: rotate the Cloudflare API token so `deploy.yml` works again.
