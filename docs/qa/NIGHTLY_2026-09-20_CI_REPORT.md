# AntCV CI NIGHTLY — 2026-09-20 (GitHub Actions, unattended, Opus 4.8)

## Summary

Band-E E1 register staleness sweep of the now-stalest **advanceable** cohort (the 2026-09-10
batch: rows **38, 76, 82, 94**) + E2/E3 standing coverage. Verify-first, docs/registers only.
No code shipped, no version consumed, no PR needed.

- **Entry state:** `git fetch && git pull --rebase origin main` → already up to date, HEAD `bbc5f534`.
- **Suite:** `node scripts/run-tests.mjs pwa` → **1715/1715, 0 fail** on entry; RE-RUN after register edits → **1715/1715**.
- **Register:** `check-register.mjs` OK, 93 ACTIVE / 93 detail.
- **`ALLOW_DEPLOY`** = `false` (≠ 'true') → no worker deploy attempted. `deploy.yml` remains dead (row 109 `DEPLOY-YML-CF-AUTH-BROKEN-001`).

## Why this cohort

Bands A–D each need a capability this CI env lacks (signed-in live-verify, real LLM generation,
a real second device, real CloudConvert PDF render, worker deploy). Owner hard rule — "an end
result, not a brickable mid-product" — so no speculative app.js/worker surgery here.

Staleness ranking on the `verified:` column, excluding what CI cannot advance:
- July-stuck **92/93/95/96/97** — regen/repro-gated; CI cannot confirm the defect against code.
- **08-26/27** rows — routine-owned (job-tracker / demand-seed nightlies).
- 09-07 cohort advanced 09-17; 09-08 advanced 09-18; 09-09 advanced 09-19.

→ The stalest **advanceable** cohort is the **2026-09-10** batch: rows 38, 76, 82, 94.

## Rows advanced — verify-first CONFIRMED intact on HEAD `bbc5f534`, dated 2026-09-20

| Row | ID | Evidence (code marker + test) | Remaining (owner/desktop-owed) |
|---|---|---|---|
| 38 | `GEN-BACKGROUND-001` | `antcv-gen-memo.js` + `antcv-gen-job-client.js` both loaded in `index.html` (2 refs); `window.AntcvGenJob` / `window.AntcvGenMemo` / `window.__antcvGenTrigger` exposed across sidecars + `app.js` mirror (3 refs); `pwa/test/unit/gen-memo.test.mjs` + `gen-job-client.test.mjs` run inside the green suite | owner A/B on a real mobile gen (`antcv:gen-resume=1`) + the per-section decompose approach decision — needs a live signed-in mobile gen |
| 76 | `JOBTRACKER-LLM-REFIT-BUTTON-001` | deferred OPTIONAL enhancement by design — deterministic Top-5 fit ranking (stability); on-add async refine already upgrades a tier once. No code owed, nothing regressed | build only if the deterministic tier proves too coarse on real edge JDs (owner call) |
| 82 | `ROLE-CANON-AUDIT-LEG-001` | `role_canon_issues(cv, lang, gold)` wired into `run()` as `checks["role_canon"]` (`scripts/job-tracker/gold_audit.py:22,91-92`); `test_gold_residue.py` RE-RUN **18/18 pass** | es/zh canon-wording eyeball (owner-gated). The stale "not wired" text survives only in the verbatim OPEN-queue snapshot; the leg itself is confirmed wired + green |
| 94 | `CONTENT-LANG-STAMP-001` | `content_language` present in `pwa/app.js` (2 refs) AND the access-relay whitelist (`workers/access-relay/src/index.js:2317` read-back + `3715-3720` write-set); `1.51.4446-content-lang-stamp` leg intact | live generate/translate-persist regen confirming the stamp is written + read authoritatively (needs real models) |

## E2/E3 standing coverage (rows 17, 23)

The live Playwright diags (`diag-personal-panel-probe.mjs` / `diag-settings-panels-probe.mjs`,
`diag-panel-button-audit.mjs`) **cannot run in this CI env** — chromium is not installed
(no browsers under `~/.cache/ms-playwright`), so the browsers fail to launch. The regression
ANCHORS that gate these rows run inside the green node `--test` suite (1715/1715) → node-suite
standing coverage PASS. The live Playwright legs are owed to a desktop run (same browserless
limitation flagged on prior CI runs).

## Discipline

- SYNC FIRST done; never force-pushed.
- Docs/registers only — no `pwa/` asset changed → no cache-bust quintet, no version consumed, no
  shift claim required. No app.js/worker edit → no PR.
- No PWA change shipped → **no post-deploy live-verify owed** for this run.

## Owed to a desktop / owner run

- Row 38: owner A/B on a real mobile gen + the per-section decompose approach decision.
- Row 76: owner call on whether the optional re-judge-fit button is worth building.
- Row 82: es/zh canon-wording eyeball.
- Row 94: live generate/translate-persist regen to confirm the content-language stamp.
- E2/E3 live Playwright diags (need chromium installed).
- July-stuck 92/93/95/96/97: live regen/render to confirm the defect against code.
- Band B/C app.js surgery (rows 40/41/42/43/44) still wants a PR when a run can repro headlessly.
- Owner: rotate the Cloudflare token so `deploy.yml` works again (row 109).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
