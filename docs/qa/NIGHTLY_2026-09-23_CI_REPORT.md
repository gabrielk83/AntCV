# AntCV CI NIGHTLY — 2026-09-23 (GitHub Actions, unattended, Opus 4.8)

Substrate: GitHub Actions on `gabrielk83/AntCV`, fresh isolated clone, unattended.
Authoritative procedure: `docs/qa/CLOUD_ROUTINE_PROMPT.md` → live band plan
`docs/qa/NIGHTLY_2026-07-05_PROMPT.md` (Band A–E) + `docs/qa/OPEN_REGISTER.md` +
`docs/qa/SCHEDULED_ROUTINES.md`.

## Entry state
- `git fetch origin && git pull --rebase origin main` → already up to date. HEAD `38630d58`.
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
— CI cannot confirm the defect against code. The 08-26/27 rows are routine-owned. The 09-07→12
cohorts were advanced on 09-17→22 respectively. So the stalest ADVANCEABLE cohort is the
**2026-09-13 batch (11 rows)**. All 11 verify-first CONFIRMED on HEAD `38630d58` and advanced to
2026-09-23:

| Row | ID | Verify-first evidence | Remaining (owed) |
|---|---|---|---|
| 62 | HEADER-BANNER-DESIGN-RULES-001 | `bodyTopBorder` [3] + ✉ icon-separated contact [2] in `workers/docx-worker/src/index.js` = the 5 shipped header-banner markers | render-measure loop vs KOMBIT gold + CL `meta.subtitle` double-render + page-2 column-balance (row 61) — need a real docx-worker render |
| 74 | JD-SWAP-STALE-RATIONALE-001 | `JD-SWAP-STALE-RATIONALE`/`CL-GHOST-COMPANY` in `app.src.js` [7] + `pwa/test/unit/cl-ghost-hunt.test.mjs` green (leg B SHIPPED 1.51.216; leg A DONE) | leg C BACKGROUND-STALL (SSE throttle on backgrounded tab) + owner one-gen validation of B — live foreground gen |
| 73 | (CV REVIEW-4 line-fill) | delivered 0 runts / 2 pages / even columns; word-method + 2-full-line rules in checklist §2 | page-2 lower dead-space = float-spine (row 61), real render |
| 72 | AI-NOTICE-ANCHOR-FIX-001 | `__mt = bodyLevel ? 822 : 806` page-anchor lift intact in docx-worker | page-2+ sidebar dead-space → float-spine (row 61) + real CloudConvert render |
| 71 | AI-NOTICE-INLINE-001 | `ai_wm_side` + `mainTint` tokens [3] in docx-worker; 9 CV content rules in checklist §1/§2 | page-2 sidebar bottom slack (acceptable; float-spine row 61 would pin) |
| 70 | (CV REBUILD v2) | delivered 2pp gold-header CV; slogan both-placement/one-visible + softened-closure rules captured | worker-feature legs → rows 71 (main tint, shipped) / 66 (body hyperlinks) / 61 (page-2 slack) |
| 69 | (CL POLISH v2 + em-dash) | `__AINOTICE` footer map HYPHENATED in all langs (`"AI-assisted - author retains responsibility…"`) — no em-dash in notice/citation/doc-title path; 3 standing CL rules in checklist §3 | standing-rule anchor (kept ACTIVE) |
| 67 | CV-CORECOMP-BLANK-001 | leg B editable CL slogan SHIPPED — `antcv-cl-slogan-control.js` loaded [1] | legs A (convergence 2nd-gen) / C (preview-dance + perf) / D (regen-content) / E (unsolicited-gen) — signed-in browser + real LLM |
| 66 | LINKEDIN-CLICK-001 | prevention doc `docs/qa/DELIVERABLE_PREFLIGHT_CHECKLIST.md` present | 15 generator-baseline items (ties 57/59/61/54) — re-deliver from master kernel + real render |
| 65 | PTR-STALE-GUARD-001 | leg E CROSS-DEVICE-GEN-LEAK-GUARD SHIPPED — `CROSS-DEVICE-GEN-LEAK` [4] in `app.src.js` + `__fahA`/`__fahB` mirror [2] + `pwa/test/diag-cross-device-gen-leak-guard.mjs` present | legs A LANG-SWITCH-MOBILE / B analysis-export-gate / C market-fit+salary / D panel-upload OCR — live-mobile / live-repro |
| 68 | JD-SYNC-001 | leg A brandfit WIP PRESERVED — `origin/brandfit-per-app-scope` still at `fc2477c` (NOT merged, D1 `ALTER TABLE` NOT run) | rebase+review+`ALTER TABLE` (owner) + legs B–F (content-gen fields / coordinator watermark / PackagePicker merge / cluster-demand worker / cloud-mobile live-verify) |

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
- Row 62: docx-worker render-measure vs KOMBIT gold + CL subtitle double-render leg.
- Row 74: leg C SSE background-stall + owner one-gen validation of leg B.
- Rows 73/72/71/70: page-2 float-spine fill (row 61) + real CloudConvert render.
- Row 67: legs A/C/D/E (signed-in browser + real LLM regen).
- Row 66: re-deliver from the master kernel through the app belts (regen).
- Row 65: legs A–D live-mobile / live-repro.
- Row 68: brandfit rebase+review+`ALTER TABLE` (owner fresh-confirm) + legs B–F.
- E2/E3: live Playwright diags (need chromium).
- July-stuck 92/93/95/96/97: live regen/render.
- Band B/C app.js surgery (rows 40/41/42/43/44): still wants a PR.
- Row 109: rotate the Cloudflare API token so `deploy.yml` works again.
