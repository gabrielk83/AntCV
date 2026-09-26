# AntCV CI NIGHTLY — 2026-09-26 (GitHub Actions, unattended, Opus 4.8)

Substrate: GitHub Actions on `gabrielk83/AntCV`, fresh isolated clone, unattended.
Authoritative procedure: `docs/qa/CLOUD_ROUTINE_PROMPT.md` → live band plan
`docs/qa/NIGHTLY_2026-07-05_PROMPT.md` (Band A–E) + `docs/qa/OPEN_REGISTER.md` +
`docs/qa/SCHEDULED_ROUTINES.md`.

## Entry state
- `git fetch origin && git pull --rebase origin main` → already up to date. HEAD `fe4b8f7f`.
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
— CI cannot confirm the defect against code. The 08-26/27 rows are routine-owned. The 09-06→15
cohorts were advanced on 09-16→25 respectively. So the stalest ADVANCEABLE cohort is the
**2026-09-16 batch (10 rows)**. All 10 verify-first CONFIRMED on HEAD `fe4b8f7f` and advanced to
2026-09-26:

| Row | ID | Verify-first evidence | Remaining (owed) |
|---|---|---|---|
| 103 | RELAY-TUNE-COVERAGE-GAP-001 | `ROLE_KEYS`/`roleHeadOrder` ×4 in `workers/proxy/src/multi-llm.js`; `scripts/relay-cost-quality-tune.mjs` present | both halves (compress client-lever + analysis addressability) owner-gated on real traffic + a same-prompt compress benchmark; no code owed |
| 45 | PERF-001 | `pwa/antcv-pdf-preview-gate.js` openModal loading-shell leg present; `pwa/test/diag-generate-click-profile.mjs` present; PARTIAL 1.51.158 intact | the setTimeout leg needs a live-model generate CPU profile CI cannot run |
| 40 | SO-003 | `pwa/antcv-outcomes-loss-guard.js` present; trigger-side `core-comp-format-preserves-outcomes.test.mjs` green in the suite; SHIPPED 1.51.138 intact | owner-verify: change the Core Competencies row count, confirm Selected Outcomes survives |
| 35 | OVERLAY-EARLY-HALT-001 | `__antcvGenCost` heartbeat gate both bundles — app.src.js ×10, app.js ×4; shipped 1.51.41 | one live 3-6min regen-confirm (owner) |
| 36 | GEN-CORECOMP-BROAD-001 | broad core_comp rule inside `__neutralCo` ×5 app.src.js; `unsolicited-corecomp-broad.test.mjs` green (both-bundle guard validates the app.js minified name); shipped 1.51.41 | one live regen-confirm (owner) |
| 37 | FOCUS-LABEL-EO-001 | `FOCUS-LABEL` rule ×2 app.src.js; `antcv-core-comp-compress.js` + `core-comp-compress-eo.test.mjs` green; shipped 1.51.42/43 | one live regen-confirm (owner) |
| 3 | FLOAT-SPINE-001 | `floatSpine`/`float_spine` gate ×6 `workers/docx-worker/src/index.js` + ×2 `pwa/antcv-docx-client.js`, default-OFF unchanged | owner visual re-export vs the reference docx — no reference docx in CI to byte-diff |
| 14 | JD-SCAN-HALLUCINATION-001 | `filename_mismatch`/`garbled_skip_llm_for_vision` ×3 in `pwa/app.src.js`; code CLOSED | live model-behaviour ingest check — owner/live-gated |
| 20 | CONTACT-TRACK-TIGHT-001 | docx-worker anchors `headlineAlign`/`fix_orphans`/`SIRIN-SEMANTICS-001`/`CONTACT-TRACK-TIGHT-001` ×4 | stays OWNER-GATED — one Hard Refresh + CL regen + CV re-export eyeballed in a real CloudConvert PDF |
| 52 | GROUP-EMPTY-HIDE-001 | `__grpHasChild` ×3 app.src.js + minified mirror `__gc` ×3 app.js (occurrence count) + `renderRichBlock` ×7 docx-worker; `group-empty-hide.test.mjs` green; shipped 1.51.194 | signed-in preview↔export parity eyeball |

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
- Row 103: real-traffic weekly tune + same-prompt compress benchmark (owner call on the client-lever flips).
- Row 45: live-model generate CPU profile of app.js's own generate path past the network gate.
- Row 40: owner row-count-change → Selected Outcomes survive check.
- Rows 35/36/37: one live 3-6min unsolicited regen to confirm each.
- Row 3: owner visual re-export vs the reference docx (float-spine flag stays default-OFF).
- Row 14: live model-behaviour ingest check.
- Row 20: Hard Refresh + CL regen + CV re-export eyeballed in a real CloudConvert PDF (esp. leg (a) round-2).
- Row 52: signed-in preview↔export parity eyeball.
- E2/E3: live Playwright diags (need chromium).
- July-stuck 92/93/95/96/97: live regen/render.
- Band B/C app.js surgery (rows 40/41/42/43/44): still wants a PR.
- Row 109: rotate the Cloudflare API token + set the account id so `deploy.yml` works again.
