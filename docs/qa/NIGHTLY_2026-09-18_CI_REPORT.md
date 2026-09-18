# CI Nightly Report — 2026-09-18 (GitHub Actions, unattended, Opus 4.8)

**Substrate:** GitHub Actions, unattended. `ALLOW_DEPLOY=false`. No signed-in Browser pane, no
real LLM models, no real device, no CloudConvert PDF render, no worker deploy path
(`deploy.yml` dead since 2026-08-01 — row 109).

## Entry state
- SYNC FIRST: `git fetch origin && git pull --rebase origin main` — already up to date, HEAD `8c94775c`.
- Baseline suite `node scripts/run-tests.mjs pwa` = **1715/1715, 0 fail** — main GREEN.
- `node scripts/check-register.mjs` OK — 93 ACTIVE / 93 detail.

## Band selection
Bands A–D each blocked on a capability CI lacks (owner hard rule "an end result, not a
brickable mid-product" → no speculative app.js/worker surgery). Ran **Band E** (standing
coverage, never skipped): E1 staleness sweep + E2/E3 diags.

Staleness note: the genuinely-stalest rows by date are the July-stuck **92/93/95/96/97**
(EXPORT-PREVIEW-PAGINATION-DIVERGENCE / AUTO-ANALYSE-ON-JD-LOAD-ERROR / CV-POLISH-BATCH /
CV-HEADER-BOX / DELIVERABLES-3CO) — regen/repro-gated, CI cannot confirm the defect against
code (needs live LLM gen / real render / owner repro). The 08-26/27 rows are routine-owned
(job-tracker + demand-seed nightlies). The 2026-09-07 cohort was advanced by the 09-17 run. So
the stalest **advanceable** cohort is the 2026-09-08 batch: rows 22, 24, 26, 30, 32, 33.

## E1 — staleness sweep (verify-first, HEAD `8c94775c`); 6 rows advanced → 2026-09-18

| Row | ID | Evidence confirmed intact | Remaining (why not closed) |
|---|---|---|---|
| 22 | CL-SLOGAN-RICHCONTENT-001 | phase-1 sidecar `antcv-cl-slogan-element.js` loaded in `index.html`; kill-switch `antcv:disable-cl-slogan-element` present | phase 2 (real `sections.cl` rich_block + dedupe at 3 render sites + worker) = GENUINE OPEN WORK — spec-before-splice, owner-gated |
| 24 | ANALYTICS-BUTTONS-SESSION-TIMEOUT-001 | `pwa/test/unit/auth-401-wipe-scope.test.mjs` present + GREEN; server secret-pair fix recorded live-verified | owner three-button click-through (live, owner-gated) |
| 26 | TOOLS-SIDEBAR-COMPRESS-001 | belt `antcv-sidebar-compact-001.js` loaded; `sidebar_compact` block in `gold-rules.json`; `sidebar-compact.test.mjs` GREEN | owner visual verify of gold Instruments/Lab strings + separate SIDEBAR-PACKING token-order belt |
| 30 | LLM-IMAGE-ROUTING-001 | `filterVisionBlind`/`VISION_BLIND` in BOTH `workers/proxy/src/multi-llm.js` + `workers/demo-proxy/src/multi-llm.js`; PWA `ee()` mistral-drop mirrored both bundles; `image-routing-ee.test.mjs` GREEN | only optional adequacy-gate extension → CODE-COMPLETE, **recommend owner CLOSED** |
| 32 | CL-PLATFORM-SIGNALS-001 | `__platformRule` (src) / minified `__pr` (app.js) both-bundle mirror; `cl-platform-signals.test.mjs` GREEN | CODE-COMPLETE, **recommend owner CLOSED**; live gen tone-check on a hardware-platform JD owed (owner, non-code) |
| 33 | WHY-RULE-EXPORT-PARITY-001 | `nameLineAlign`/`headline_align`/`headlineAlign` in `antcv-docx-client.js`; `export-align-parity.test.mjs` GREEN | CODE-COMPLETE, **recommend owner CLOSED**; signed-in export eyeball owed |

## E2 — Row 17 SETTINGS-PERSONAL-STABILIZE-001 (STANDING)
`diag-personal-panel-probe.mjs` RE-RUN on HEAD — Personal panel **0 mutations / 8s**, **0 page
errors** → **DIAG PASS** (still at rest).

## E3 — Row 23 NIGHTLY-PREVIEW-BUTTON-AUDIT-001 (STANDING)
`diag-panel-button-audit.mjs` RE-RUN — **208 buttons** {skipped-dangerous:14, ui-only:16,
active:133, not-visible-or-disabled:45}, **0 page errors**, THROWS section EMPTY, **9 suspects**
(identical to 09-17). vs 2026-09-17 (208 buttons; then {ui-only:14, active:134, DEAD:1}): the
one 09-17 DEAD candidate — "Undo last change" **#1**, a disabled button with the seeded empty
edit history — reclassified **ui-only** this run (legitimately inert, `disabled:true`, no writes);
the working "Undo last change" **#2** is active in both runs. No new DEAD, THROWS empty, 0 page
errors → **NO REGRESSION**. Artifacts: `docs/qa/PANEL_BUTTON_AUDIT_2026-09-18.{json,md}`.

## What shipped
Docs / registers / audit-artifacts only. No cache-bust, no version consumed, no shift claim,
no PR (Bands A–D untouched, no app.js/worker change). No PWA change → **no post-deploy
live-verify owed**.

## Post-edit gate
`check-register.mjs` OK (93/93); full suite RE-RUN after the register edits (09-08 lesson —
never push register edits on a stale baseline) = **1715/1715, 0 fail**.

## OWED to a desktop / owner run
- Rows 30 / 32 / 33 — owner CLOSE decision (code-complete; only a live eyeball / tone-check left).
- Row 24 — owner three-button analytics click-through (no restart expected).
- Row 26 — owner visual verify of the gold Instruments/Lab sidebar strings.
- Row 22 — phase-2 spec + splice (real `sections.cl` rich_block) — genuine open work.
- July-stuck rows 92/93/95/96/97 — live LLM regen / real render / owner repro.
- Bands B/C app.js surgery (rows 40/41/42/43/44) still wants a PR for owner review.
- Row 109 (deploy.yml auth) — owner must rotate the Cloudflare token + set the account id.
