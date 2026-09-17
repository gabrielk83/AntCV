# CI Nightly Report — 2026-09-17 (GitHub Actions, unattended, Opus 4.8)

**Substrate:** GitHub Actions, unattended. `ALLOW_DEPLOY=false`. No signed-in Browser pane, no
real LLM models, no real device, no CloudConvert PDF render, no worker deploy path
(`deploy.yml` dead since 2026-08-01 — row 109).

## Entry state
- SYNC FIRST: `git fetch origin && git pull --rebase origin main` — already up to date, HEAD `d8e041ea`.
- Baseline suite `node scripts/run-tests.mjs pwa` = **1715/1715, 0 fail** — main GREEN.
- `node scripts/check-register.mjs` OK — 93 ACTIVE / 93 detail.

## Band selection
Bands A–D each blocked on a capability CI lacks (owner hard rule "an end result, not a
brickable mid-product" → no speculative app.js/worker surgery). Ran **Band E** (standing
coverage, never skipped): E1 staleness sweep + E2/E3 diags.

Staleness note: the genuinely-stalest rows by date are the July-stuck **92/93/95/96/97**
(EXPORT-PREVIEW-PAGINATION-DIVERGENCE / AUTO-ANALYSE-ON-JD-LOAD-ERROR / CV-POLISH-BATCH /
CV-HEADER-BOX / DELIVERABLES-3CO). The 2026-09-15 run gave them fresh verify-results and they
remain **regen/repro-gated** — CI cannot confirm the defect against code (needs live LLM gen /
real render / owner repro). The 08-26/27 rows are routine-owned (job-tracker + demand-seed
nightlies). So the stalest **advanceable** cohort is the 2026-09-07 batch: rows 25, 6, 8, 12, 21.

## E1 — staleness sweep (verify-first, HEAD `d8e041ea`); 5 rows advanced → 2026-09-17

| Row | ID | Evidence confirmed intact | Remaining (why not closed) |
|---|---|---|---|
| 25 | TABLE-GEOMETRY-PARITY-001 | `renderCompetencyTable` + `tableWidthPct`/`tableRatio` across `antcv-docx-client.js`, `antcv-table-headers-editable-341.js`, `antcv-section-align.js`, `antcv-auto-pagebreak-block-001.js`, `workers/docx-worker/src/index.js` | Real-CloudConvert PDF geometry diff — no CloudConvert in CI (owner/desktop) |
| 6 | BANNED-WORDS-MERGE-001 | `antcv:keep-native-banned` + `antcv:no-kernel-chain` in `antcv-data-importer.js`; island `stylePrefs.banned_*` in `antcv-react-islands.js` | Owner eyeball of merged UI + one file of each of 6 loader types (owner-gated) |
| 8 | KERNEL-V2-READER-001 | `kernel-v2-reader.test.mjs` RE-RUN GREEN; `antcv:ingestedKernel` reader in `antcv-kernel-import.js` | bullets-path v2 migration / es/zh tier (real models) / §6 uploaded-docx parity (owner) |
| 12 | AI-NOTICE-LEFT-CLOUDCONVERT-001 | `ai-notice-position.test.mjs` RE-RUN GREEN 3/3; worker margin-left encoding (0pt/275pt + jc) intact | Anchor bug resolved; row lingers on 3 SEPARATE docx-baseline gaps → **recommend owner CLOSE + re-file** |
| 21 | SETTINGS-ROLLER-RESET-001 | `diag-settings-history-guard.mjs` RE-RUN GREEN headless (guard consumes sentinel, no reload; kill-switch control navigates away = reset reproduced); sidecar + kill-switch present | Owner roller-hardware live-verify owed |

`kernel-v2-reader` + `ai-notice-position` ran together = 8/8.

## E2 — Row 17 SETTINGS-PERSONAL-STABILIZE-001 (STANDING)
`diag-settings-panels-probe.mjs` RE-RUN on HEAD — Personal 0 mut/6s, Account 0 mut/6s,
Layout 0 mut/6s, rootFound=true, 0 page errors → **DIAG PASS**.

## E3 — Row 23 NIGHTLY-PREVIEW-BUTTON-AUDIT-001 (STANDING)
`diag-panel-button-audit.mjs` RE-RUN — **208 buttons** {skipped-dangerous:14, ui-only:14,
active:134, not-visible-or-disabled:45, DEAD:1}, **0 page errors**, THROWS section EMPTY.
The single DEAD candidate is "Undo last change" — the known explainable idempotent no-op on the
seeded empty edit history (same class as 08-17/08-19/08-26), not a defect. vs 2026-09-07
(215 buttons, 0 THROWS / 0 DEAD): enumeration varies with mount timing; the invariant (0 THROWS,
0 page errors, only explainable DEAD) holds → **NO REGRESSION**. Artifacts:
`docs/qa/PANEL_BUTTON_AUDIT_2026-09-17.{json,md}`.

## What shipped
Docs / registers / audit-artifacts only. No cache-bust, no version consumed, no shift claim,
no PR (Bands A–D untouched, no app.js/worker change). No PWA change → **no post-deploy
live-verify owed**.

## Post-edit gate
`check-register.mjs` OK (93/93); full suite RE-RUN after the register edits (09-08 lesson —
never push register edits on a stale baseline) = **1715/1715, 0 fail**.

## OWED to a desktop / owner run
- Row 25 — real CloudConvert PDF vs preview geometry diff.
- Row 6 — owner eyeball of merged banned-words UI + 6-file loader test.
- Row 8 — uploaded-docx §6 parity + es/zh regen (real models).
- Row 12 — owner CLOSE decision + re-file the 3 docx-baseline gaps under own IDs.
- Row 21 — roller-hardware live-verify.
- Bands B/C app.js surgery (rows 40/41/42/43/44) still wants a PR for owner review.
- July-stuck rows 92/93/95/96/97 — live LLM regen / real render / owner repro.
- Row 109 (deploy.yml auth) — owner must rotate the Cloudflare token + set the account id.
