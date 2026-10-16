# CI Nightly report — 2026-10-16 (GitHub Actions, unattended, Opus 4.8)

**Run type:** Band-E E1 register staleness sweep. No code shipped.
**HEAD:** `451fc004` (SYNC FIRST clean — `git fetch && git pull --rebase origin main` already up to date).
**Suite:** 1824/1824 green (`node scripts/run-tests.mjs pwa`, 0 fail); `check-register.mjs` OK (92 ACTIVE / 92 detail).
**Environment:** `ALLOW_DEPLOY=false`, no in-app Browser pane, no signed-in session, no relay token.
Bands A–D stay blocked on live/device/owner/real-model/deploy gates CI cannot clear.

## E1 — 10 stalest rows, re-verified against HEAD and refreshed to 2026-10-16

`check-register.mjs --stalest 5` ran twice (the first five dropped out after refresh, exposing the
next five). The stalest set stood at 2026-10-06/07 before this sweep. Each row's cited anchors were
re-verified against current HEAD; all intact; each kept ACTIVE on its existing gate with its
`verified:` date set to 2026-10-16 in both the index and the detail file.

| # | ID | Verdict | Evidence |
|---|---|---|---|
| 66 | LINKEDIN-CLICK-001 | CODE-INTACT; regen/deliverable-gated | prevention doc `docs/qa/DELIVERABLE_PREFLIGHT_CHECKLIST.md` present. Each item is a generator-baseline requirement closeable only by a re-deliver from the master kernel through the app belts + a real render — CI cannot regen. |
| 65 | PTR-STALE-GUARD-001 | leg E INTACT; A–D need live-mobile | `CROSS-DEVICE-GEN-LEAK` **×4** in `pwa/app.src.js` + the `__fahA`/`__fahB` app.js mirror **×2** + `pwa/test/diag-cross-device-gen-leak-guard.mjs` on disk. A (lang-switch-mobile) / B (analysis-export-unsolicited-gate) / C (market-fit/salary JD wiring) / D (panel-upload OCR) all need live-mobile repro. |
| 68 | JD-SYNC-001 | WIP preserved; B–F owner/regen-gated | `origin/brandfit-per-app-scope` still @ `fc2477c` (durable backup), NOT merged (behind main), live D1 `ALTER TABLE` NOT run (owner fresh-confirm). B content-gen fields (regen), C coordinator watermark, D PackagePicker→Layout merge, E cluster-demand worker pipeline, F cloud/mobile live-verify — all owner/desktop/regen-gated. |
| 75 | JOBTRACKER-AUTOFILL-ADDFLOW-VERIFY-001 | code-intact; owner-gated | deterministic-tier + async-enrich flow in island source `src/islands/JobTracker/JobTracker.tsx` (matches `autofill|enrich`; `api.ts`/`rank.ts` present); jobtracker unit set green in-suite. One real URL/PDF add-test end-to-end (reject after) is owner-gated — CI can't drive a live LLM add without writing a junk row. |
| 77 | JOBTRACKER-TOP5-PERIODIC-RESCORE-001 | code-intact; owner-decision | on-add/on-change fit-ranked Top-5 re-rank covered by `pwa/test/unit/jobtracker-top5-rescore.test.mjs` (green). The PERIODIC recompute is deliberately NOT built — an owner-decision gate, not code owed. |
| 81 | PHOTO-FUSE-OWNER-VERIFY-001 | code-intact; visual pass owed | single `＋ Add photos…` control in `pwa/antcv-photo-library.js` (`Add photos` **×2**) + `PW-CJLR-PHOTO-LEAK` guard **×8** in `pwa/antcv-profile-workstyle-cjlr-238.js` + `pwa/test/diag-pw-cjlr-photo-leak.mjs`. One on-device visual pass after a hard refresh (legs a–e) needs a signed-in browser. |
| 83 | JD-REMOVE-OWNER-VERIFY-001 | code-intact; 4-step live pass owed | `JD-REMOVE-STICKY`/tombstone **×6** in `pwa/app.src.js` + `pwa/test/unit/jd-remove-tombstone.test.mjs` green. The 4-step live pass (remove→refresh stays removed / reopen re-stages / read-from-cloud returns JD / different JD seeds) needs the live app + relay. |
| 88 | OWNER-ROUND-3-BACKLOG | round-3 ship INTACT; legs owner/regen/render-gated | docx-worker `VERSION = "1.14.174-appline-edit"` (past the 1.14.154 ship), `ROLE-SPLIT-CONT-001` in `workers/docx-worker/src/index.js`, `fit_page_flow` wired in `scripts/job-tracker/gen-runner.py` + `density_fit.py`. Legs a–f all owner-gated / regen / real-render. |
| 87 | OWNER-ROUND-2-RESIDUE-001 | 5 legs diagnosed-not-fixed; gates unchanged | (a) core-comp regen owner-gated; (b) brand colours = `brandfit-per-app-scope` not merged (re-confirmed); (c) signature needs a real upload (signatureB64 empty); (d) ROLE-SPLIT `(cont.)` worker marker present but needs deploy + CloudConvert test; (e) runt lines = density frontier. Each needs live/regen/deploy. |
| 86 | GOLD-SESSION-FOLLOWUPS-001 | leg (f) unblocked; rest content/regen/owner-gated | role-canon export audit wired in `scripts/job-tracker/gold_audit.py` (`role_canon` **×3**). Remaining legs: (a) pubs-authors cosmetic, (b) results-needs-translation app 792, (c) proxy-gold-rules fetch, (d) core-comp floor backfill (per-app regen), (e) stale locked PDFs (owner deletes). CI cannot regen. |

All ten CODE-INTACT / as-scoped; kept ACTIVE on their live/owner/real-model/deploy gates.
New stalest after the sweep: row 31 (2026-10-07), rows 98-101 (2026-10-08).

## Bands A–D — not advanced this run
Every remaining Band A–D item needs a signed-in browser (A2 leg 2 A/B, 63/64 live-verify),
a second physical device (row 19 / A2 leg 3), live LLM routing + D1 telemetry (A1 A/B, D2),
or a worker deploy (`ALLOW_DEPLOY=false`) — none available in this CI run (CLOUD CAVEATS).
No guessing; they are carried unchanged for the next desktop/owner run.

## Gates before push
- Suite 1824/1824; `check-register.mjs` OK before and after.
- Docs/registers only → no cache-bust quintet, no version consumed, no shift claim, no PR owed.

## Owed to a desktop / owner run
- Rows 66/86/88: re-deliver / per-app regen from the master kernel through the app belts + real render.
- Rows 65 (A–D) / 83: live-mobile + live app/relay repro.
- Row 68: brandfit branch rebase→review→D1 `ALTER TABLE` (owner fresh-confirm)→merge; B–F regen/feature.
- Rows 75/81: one live add-test (reject after) / one on-device photo visual pass.
- Row 77: owner confirm whether a periodic Top-5 re-score is wanted.
- Row 87 (d): docx-worker `(cont.)` deploy + CloudConvert test.

## Post-deploy live-verify owed
- None — no PWA/worker change shipped this run.
