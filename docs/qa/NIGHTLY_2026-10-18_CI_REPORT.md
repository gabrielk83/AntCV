# AntCV CI nightly — 2026-10-18 (GitHub Actions, unattended, Opus 4.8)

Fresh clone on `origin/main` `fe67552f`. SYNC FIRST clean (`git fetch` + `pull --rebase origin main`
already up to date). `ALLOW_DEPLOY` not `true` → no worker deploys attempted. No in-app Browser pane
in CI → no live signed-in verification.

## Baseline

- `node scripts/run-tests.mjs pwa` → **1830 pass / 0 fail** (0 skipped).
- `node scripts/check-register.mjs` → OK, **92 ACTIVE** rows / 92 detail sections, both before and after.
- No `pwa/app.js` / `pwa/app.src.js` / `workers/**` edit → no boot-smoke, no cache-bust quintet, no
  shift claim owed; docs-only push direct to `main` (permitted by the CI safety override).

## Band E1 — register staleness sweep (NIGHTLY_BACKLOG_RECONCILE slot)

`check-register.mjs --stalest 8` → took the **5 oldest** rows. All are code-anchored and were
re-verified against HEAD `fe67552f`; all markers INTACT; each kept ACTIVE on its existing gate with
`verified:` set to **2026-10-18** in both the index (`OPEN_REGISTER.md`) and the detail
(`REGISTER_ACTIVE_DETAIL.md`).

| Row | ID | was | Verify evidence (HEAD `fe67552f`) | Residual gate |
|---|---|---|---|---|
| 105 | JOBSRC-FETCH-001 | 2026-10-08 | `scripts/job-tracker/job_sources.py` + `test_job_sources.py` present; prompt-routing leg CLOSED (owner 2026-08-26) | Live 4-source board audit owned by the position-discovery routine — not reproducible in unattended CI |
| 25 | TABLE-GEOMETRY-PARITY-001 | 2026-10-09 | Forwarding pipeline intact at all five sites: markers 11 / 1 / 7 / 1 / 9 (docx-client / table-headers / section-align / auto-pagebreak / worker), unchanged | FIDELITY gap needs a real CloudConvert PDF diff — no credits spent in CI; owner session |
| 6 | BANNED-WORDS-MERGE-001 | 2026-10-09 | Kill-switches `antcv:keep-native-banned`+`antcv:no-kernel-chain` ×2 (`antcv-data-importer.js`); island `banned_*` writer ×1 (`antcv-react-islands.js`) | Owner UI eyeball + 6-file loader test — owner-gated |
| 8 | KERNEL-V2-READER-001 | 2026-10-09 | `kernel-v2-reader.test.mjs` GREEN 5/5; `antcv:ingestedKernel` reader ×2 (`antcv-kernel-import.js`, both bundles) | bullets-path v2 migration / es-zh tier / §6 docx regression — need real models or an owner docx |
| 12 | AI-NOTICE-LEFT-CLOUDCONVERT-001 | 2026-10-09 | `ai-notice-position.test.mjs` GREEN 3/3; page-relative margin-left `0pt/275pt + jc` intact (`workers/docx-worker/src/index.js`) | Anchor bug effectively resolved — **5th sweep recommending owner CLOSE** + re-file the 3 docx-baseline gaps (cjlr-table-export, pageflow-export, spacing-linkedin-export) under their own IDs |

New stalest after the sweep: row 21 `SETTINGS-ROLLER-RESET-001`, row 22 `CL-SLOGAN-RICHCONTENT-001`,
row 3 `FLOAT-SPINE-001` (all 2026-10-09) — next cohort for the following nightly.

## Bands A–D — not advanced (all blocked in CI)

- **A1 GEN-BACKGROUND-001 / A2 tab-device isolation:** need a live mobile generation + a second
  physical device for the A/B legs; code shipped and verified in prior runs. Not reproducible here.
- **B1 SO-003 / B2 SO-004:** need a signed-in headless repro driving real content; no new finding this run.
- **C (GEN-LANGFAB / CA-006 / JD-ANALYSIS-PRINT) + D (PERF-001 / GEN-MODELROLE):** need live LLM
  routing, D1 telemetry, a worker deploy, or a real CloudConvert render — none available in unattended CI.

No owner-gated row was force-closed.

## Owner items

- **Row 12** recommended for CLOSED (5th consecutive sweep saying so); re-file the 3 docx-baseline
  gaps under their own IDs if still open.
- All other residual legs (rows 105 / 25 / 6 / 8 and Bands A–D) carry the live / regen / real-device /
  CloudConvert verifies already tracked on their rows — they stand for the next desktop run.

## Owed to a desktop run

Nothing shipped → **no post-deploy live-verify owed** this run.

## Overlap check

Prior CI nightly `70ae056a` (2026-10-17) swept rows 19/103/45/35/36/37; this run swept 105/25/6/8/12 —
no re-touch collision. Register edits only; no version number consumed.
