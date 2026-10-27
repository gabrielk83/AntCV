# AntCV CI nightly — 2026-10-27 (GitHub Actions, unattended, Opus 4.8)

Fresh clone on `origin/main` `65ce36e0`. Unattended CI: docs/registers push direct to `main`;
any `pwa/app.js`, `pwa/app.src.js` or `workers/**` change must go through a PR (none this run).
`ALLOW_DEPLOY` not set → no worker deploys.

## Summary

Band E1 register-staleness sweep. The 8 stalest ACTIVE rows (all @ 2026-10-16) re-verified against
current HEAD, code anchors confirmed intact, dates refreshed to 2026-10-27. **Nothing shipped** —
every residual leg is owner / live / real-device / regen / deploy-gated, which unattended CI cannot
drive. No owner-gated row force-closed.

## Gates

- **SYNC FIRST:** `git fetch origin && git pull --rebase origin main` → already up to date.
- **Suite:** `node scripts/run-tests.mjs pwa` → **1850 pass / 0 fail**.
- **Register:** `node scripts/check-register.mjs` OK before + after (93 ACTIVE rows, 93 detail sections).
- No app.js/worker edit → no boot-smoke, no cache-bust quintet, no shift claim, no deploy.

## E1 — stalest-row sweep (`check-register.mjs --stalest 8`)

| # | ID | anchor re-verified at HEAD 65ce36e0 | status |
|---|---|---|---|
| 68 | `JD-SYNC-001` | `origin/brandfit-per-app-scope` still `fc2477c` (NOT merged, durable backup intact); legs B–F owner/desktop/regen-gated | refreshed, ACTIVE |
| 75 | `JOBTRACKER-AUTOFILL-ADDFLOW-VERIFY-001` | island `src/islands/JobTracker/JobTracker.tsx` autofill\|enrich (6 refs), `api.ts` + `rank.ts` present | refreshed, owner-gated |
| 77 | `JOBTRACKER-TOP5-PERIODIC-RESCORE-001` | on-add/on-change re-rank + `jobtracker-top5-rescore.test.mjs` green; PERIODIC not built (owner-decision) | refreshed, owner-gated |
| 81 | `PHOTO-FUSE-OWNER-VERIFY-001` | `antcv-photo-library.js` (2 "Add photos"), `antcv-profile-workstyle-cjlr-238.js` (8 PW-CJLR-PHOTO-LEAK), `diag-pw-cjlr-photo-leak.mjs` | refreshed, owner visual owed |
| 83 | `JD-REMOVE-OWNER-VERIFY-001` | `app.src.js` 3 JD-REMOVE-STICKY + 3 tombstone refs, `jd-remove-tombstone.test.mjs` | refreshed, owner live owed |
| 88 | OWNER-ROUND-3-BACKLOG | docx-worker `VERSION = "1.14.175-ai-mark-props"` (past 1.14.154 ship), ROLE-SPLIT-CONT-001, `fit_page_flow` in gen-runner.py + density_fit.py | refreshed, legs a–f gated |
| 87 | `OWNER-ROUND-2-RESIDUE-001` | brandfit `fc2477c` NOT merged, ROLE-SPLIT-CONT-001 present (deploy + CloudConvert test owed) | refreshed, 5 legs gated |
| 86 | `GOLD-SESSION-FOLLOWUPS-001` | leg f confirmed — `gold_audit.py` `role_canon` (3 refs) | refreshed, legs a–e gated |

All 8 code markers INTACT. Dates set to 2026-10-27 in both the index (`OPEN_REGISTER.md`) and the
detail sections (`REGISTER_ACTIVE_DETAIL.md`); prior verify text preserved inline for history.

## Bands A–D — not advanced

A1/A2 need a live mobile gen + a second physical device; B1/B2 need a signed-in headless repro with
real content; C/D need live LLM routing / a worker deploy / a real CloudConvert render. None are
available in unattended CI (CLOUD CAVEATS).

## Owed to a desktop / owner run (carry forward)

- Nothing shipped → **no post-deploy live-verify owed** this run.
- Row 75: one real URL/PDF add-test end-to-end (reject after), owner or throwaway account.
- Row 81: one on-device visual pass after a hard refresh (legs a–e).
- Row 83: one live 4-step JD-remove pass (remove→refresh / reopen→re-stage / read-from-cloud / different-JD).
- Rows 68/86/87/88: brandfit rebase+review + live `ALTER TABLE` (owner confirm); regen / deploy / CloudConvert legs.

## Owner

- No decision required this run. The owner/live/regen backlog on the swept rows is unchanged.

Run recorded in `docs/qa/REGISTER_RUNLOG.md` (top entry).
