# AntCV CI NIGHTLY — 2026-09-25 (GitHub Actions, unattended, Opus 4.8)

Substrate: GitHub Actions on `gabrielk83/AntCV`, fresh isolated clone, unattended.
Authoritative procedure: `docs/qa/CLOUD_ROUTINE_PROMPT.md` → live band plan
`docs/qa/NIGHTLY_2026-07-05_PROMPT.md` (Band A–E) + `docs/qa/OPEN_REGISTER.md` +
`docs/qa/SCHEDULED_ROUTINES.md`.

## Entry state
- `git fetch origin && git pull --rebase origin main` → already up to date. HEAD `ab2a43c7`.
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
— CI cannot confirm the defect against code. The 08-26/27 rows are routine-owned. The 09-10→14
cohorts were advanced on 09-20→24 respectively. So the stalest ADVANCEABLE cohort is the
**2026-09-15 batch (8 rows)**. All 8 verify-first CONFIRMED on HEAD `ab2a43c7` and advanced to
2026-09-25:

| Row | ID | Verify-first evidence | Remaining (owed) |
|---|---|---|---|
| 89 | MODEL-TABLE-FRESHNESS-001 | deployed rate corrections still in source across THREE mirrors — `workers/access-relay/src/model-rates.js` carries `claude-sonnet-5 [2,10]`, `gpt-5.5 [5,30]`, `gpt-6-astra [10,50]`, `gemini-3.8-flash [0.75,3.75]`, longest-key ordering intact; `gpt-5.5` in both `demo-enforcement.js` mirrors; freshness + `relay-model-rates-mirror` tests green in suite | owner-gated D1 `llm_provider_costs` INSERTs (sonnet-5 [2,10] + gpt-5.5 [5,30]; SQL in the 09-06 report § B) — not fakeable in CI |
| 31 | META-STATE-CORRUPTION-002 | `META-DRIFT-GUARD-002` 2× in `app.src.js` + present in `app.js` mirror; `META-DOWNGRADE-GUARD-003` same; `meta-drift-guard-both-blocks.test.mjs` + `meta-downgrade-guard-autosave.test.mjs` green | repair an already-poisoned server row from its own display name — owner-gated, needs a live poisoned row |
| 98 | BYOK-COST-AUDIT-001 | `total_cost_usd_est` ×7 in BOTH `byok-qualify.js` copies; the two src copies still byte-identical (`diff -q` clean); `byok-cost-audit.test.mjs` green | none — SHIPPED + re-verified live 2026-07-29, unreverted (owner CLOSE candidate) |
| 99 | REG-GROUP-FOLD-NAMED-001 | `NAMED_FOLD` ×2 in `pwa/antcv-dup-group-merge.js`; `dup-group-merge.test.mjs` green; code leg unreverted | owner "sidebar dancing" investigation-thread resolution — owner-check item, not a CI-reproducible regression |
| 100 | GRAB-ZONE-DISMISS-THRESHOLD-001 | `antcv-panel-grab-zone` in both `app.src.js` + `app.js` mirror; `GRAB-ZONE-SCROLL-FORWARD-001` in `app.src.js`; both legs test-locked green in `grab-zone-dismiss-threshold.test.mjs` | one on-device (Android) grab-zone gesture pass after a hard refresh — needs a real touch device |
| 101 | ZOOM-FLOOR-001 | `0.1` floor in both bundles (button + pinch); `zoom-floor.test.mjs` green (6 assertions); zoom-in ceiling unchanged; unreverted | one live zoom-out visual (owner) |
| 19 | JD-SCOPE-OCC2-GUARD-001 | `shouldAdoptCloudPointer` present across the pwa sidecars — `antcv-jd-scope.js` ×2 + `app.src.js` ×1 (minified equivalent in `app.js`); `jd-scope-isolation.test.mjs` green, occ-2 guard behaviour string-locked. CORRECTED the earlier "4× across pwa sidecars" note to the actual 3 source occurrences | two-real-device test — owner-gated (physical devices, not fakeable headlessly) |
| 109 | DEPLOY-YML-CF-AUTH-BROKEN-001 | STILL BROKEN — `gh run list --workflow=deploy.yml` shows every `push`-to-main run failing, last at 2026-09-10 (`push`, failure); the only `success` runs since (09-14/09-21/09-23) are `pull_request` events, which the workflow gates to lint + unit-tests and NEVER deploy (deploy.yml header comment + push/dispatch gate confirm) | owner secret rotation of `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID = 17c026b6d08c3e0ba63425cb26a5a7d9`, then a `mode=dry-run` re-run to confirm green — credentials owner-only, an agent cannot rotate them |

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
- Row 89: the owner-gated D1 `llm_provider_costs` INSERTs.
- Row 31: poisoned-row repair on a live poisoned row.
- Row 98: owner CLOSE decision (code-complete, unreverted).
- Row 99: owner "sidebar dancing" recurrence check.
- Row 100: on-device Android grab-zone gesture pass.
- Row 101: live zoom-out visual.
- Row 19: two-real-device JD-scope test.
- Row 109: rotate the Cloudflare API token + set the account id so `deploy.yml` works again.
- E2/E3: live Playwright diags (need chromium).
- July-stuck 92/93/95/96/97: live regen/render.
- Band B/C app.js surgery (rows 40/41/42/43/44): still wants a PR.
