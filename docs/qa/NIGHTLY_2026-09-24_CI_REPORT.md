# AntCV CI NIGHTLY — 2026-09-24 (GitHub Actions, unattended, Opus 4.8)

Substrate: GitHub Actions on `gabrielk83/AntCV`, fresh isolated clone, unattended.
Authoritative procedure: `docs/qa/CLOUD_ROUTINE_PROMPT.md` → live band plan
`docs/qa/NIGHTLY_2026-07-05_PROMPT.md` (Band A–E) + `docs/qa/OPEN_REGISTER.md` +
`docs/qa/SCHEDULED_ROUTINES.md`.

## Entry state
- `git fetch origin && git pull --rebase origin main` → already up to date. HEAD `88f89001`.
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
— CI cannot confirm the defect against code. The 08-26/27 rows are routine-owned. The 09-07→13
cohorts were advanced on 09-17→23 respectively. So the stalest ADVANCEABLE cohort is the
**2026-09-14 batch (7 rows)**. All 7 verify-first CONFIRMED on HEAD `88f89001` and advanced to
2026-09-24:

| Row | ID | Verify-first evidence | Remaining (owed) |
|---|---|---|---|
| 75 | JOBTRACKER-AUTOFILL-ADDFLOW-VERIFY-001 | deterministic-tier + async-enrich autofill in `pwa/antcv-react-islands.js` (AUTOFILL-TOP5/tier/enrich/refine [7]); jobtracker unit set green in suite | one real URL/PDF add-test end-to-end (reject after) with the owner or a throwaway account — CI cannot drive a live LLM add without a junk row |
| 77 | JOBTRACKER-TOP5-PERIODIC-RESCORE-001 | on-add/on-change fit-ranked re-rank present + `pwa/test/unit/jobtracker-top5-rescore.test.mjs` green | owner decision — build a periodic recompute only if Top-5 should drift with cluster-demand refreshes (not code owed) |
| 81 | PHOTO-FUSE-OWNER-VERIFY-001 | PHOTO-BTN-FUSE-001 + single "＋ Add photos…" control in `pwa/antcv-photo-library.js` [4]; PW-CJLR-PHOTO-LEAK guard in `pwa/antcv-profile-workstyle-cjlr-238.js` + `pwa/test/diag-pw-cjlr-photo-leak.mjs` | one on-device visual pass after a hard refresh (legs a–e) — needs a signed-in browser |
| 83 | JD-REMOVE-OWNER-VERIFY-001 | JD-REMOVE-STICKY/tombstone in `pwa/app.src.js` [6] + `pwa/test/unit/jd-remove-tombstone.test.mjs` green (1.51.395) | one live 4-step pass (remove→refresh stays / reopen re-stages / read-cloud returns / new JD seeds) — needs live app + relay |
| 86 | GOLD-SESSION-FOLLOWUPS-001 | leg f ROW-82 UNBLOCKED — `role_canon` in `scripts/job-tracker/gold_audit.py` [3] | legs a–e (pubs-author cosmetic / results-translation / proxy-gold-rules-fetch / core-comp floor backfill / stale-locked PDFs) — content/regen/owner-gated |
| 87 | OWNER-ROUND-2-RESIDUE-001 | all 5 legs diagnosed; brandfit `origin/brandfit-per-app-scope` still at `fc2477c` NOT merged (ls-remote); ROLE-SPLIT-CONT-001 present docx-worker index.js ~26918 | a core-comp regen (owner) / b brandfit rebase+merge / c signature upload / d role-split deploy+CloudConvert test / e density frontier |
| 88 | OWNER-ROUND-3-BACKLOG | round-3 ship intact — docx-worker `VERSION = "1.14.174-appline-edit"`, ROLE-SPLIT-CONT-001 in index.js ~26918, `fit_page_flow` wired in `gen-runner.py` + `density_fit.py` | owner-deferred a 19-app rollout / b fit-page-flow y-align #49 / c table-geometry 6630→7689 #1 / d client-half bullet_pages #2 / e orphan misdetection / f rows 54/56/59A/62/22 |

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
- Row 75: one real URL/PDF add-test end-to-end (owner or throwaway account).
- Row 77: owner decision on a periodic Top-5 re-score.
- Row 81: on-device photo-panel visual pass after a hard refresh.
- Row 83: live 4-step JD-remove pass.
- Row 86: legs a–e content/regen.
- Row 87: legs a–e (brandfit rebase+merge / signature upload / role-split deploy+render / regen).
- Row 88: owner-deferred 19-app rollout + backlog #1/#2/#49.
- E2/E3: live Playwright diags (need chromium).
- July-stuck 92/93/95/96/97: live regen/render.
- Band B/C app.js surgery (rows 40/41/42/43/44): still wants a PR.
- Row 109: rotate the Cloudflare API token so `deploy.yml` works again.
