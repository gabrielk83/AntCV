# AntCV CI NIGHTLY — 2026-09-19 (GitHub Actions, unattended, Opus 4.8)

## Summary

Band-E E1 register staleness sweep of the now-stalest **advanceable** cohort (the 2026-09-09
batch: rows **34, 27, 28, 29**) + E2/E3 standing coverage. Verify-first, docs/registers only.
No code shipped, no version consumed, no PR needed.

- **Entry state:** `git fetch && git pull --rebase origin main` → already up to date, HEAD `365c9827`.
- **Suite:** `node scripts/run-tests.mjs pwa` → **1715/1715, 0 fail** on entry; RE-RUN after register edits → **1715/1715**.
- **Register:** `check-register.mjs` OK, 93 ACTIVE.
- **`ALLOW_DEPLOY`** unset (≠ 'true') → no worker deploy attempted. `deploy.yml` remains dead (row 109 `DEPLOY-YML-CF-AUTH-BROKEN-001`).

## Why this cohort

Bands A–D each need a capability this CI env lacks (signed-in live-verify, real LLM generation,
a real second device, real CloudConvert PDF render, worker deploy). Owner hard rule — "an end
result, not a brickable mid-product" — so no speculative app.js/worker surgery here.

Staleness ranking on the `verified:` column, excluding what CI cannot advance:
- July-stuck **92/93/95/96/97** — regen/repro-gated; CI cannot confirm the defect against code.
- **08-26/27** rows — routine-owned (job-tracker / demand-seed nightlies).
- 09-07 cohort advanced 09-17; 09-08 cohort advanced 09-18.

→ The stalest **advanceable** cohort is the **2026-09-09** batch: rows 34, 27, 28, 29.

## Rows advanced — verify-first CONFIRMED intact on HEAD `365c9827`, dated 2026-09-19

| Row | ID | Evidence (code marker + test) | Remaining (owner/desktop-owed) |
|---|---|---|---|
| 34 | `ROLE-MERGE-STORED-001` | `antcv-role-merge-stored.js` loaded in `index.html`; `window.AntcvMergeSameCompanyRoles` exposed by `antcv-docx-client.js` (2 refs); `role-merge-stored.test.mjs` + `merged-results-union.test.mjs` RE-RUN GREEN **16/16** | live preview==export byte-for-byte eyeball on a targeted regen |
| 27 | `MAIN-RUNT-ORPHAN-SWEEP-001` | all four ORPHAN-PREFLIGHT-V3 sidecars still loaded (`antcv-orphan-export-preflight.js`, `-measure-bind.js`, `-package-orphan-apply.js`, `-cloud-persist-385.js`) | (a) work-style tail truncation, (b) page-3 ghost, (c) ~1.5pp real-PDF verify on a FRESH NIL-targeted export |
| 28 | `NIL-GEN-ADAPTATION-001` | `antcv-profile-access-scrub.js` + `antcv-sidebar-relevance-cut.js` both loaded | CV ~1.5pp GEN-LEVEL target (rides row 27), regen-gated |
| 29 | `NIL-TARGETED-STATE-STICK-001` | closed legs re-confirmed: `META-DRIFT-GUARD-002` in `app.js` mirror + `app.src.js`; `277-SEQUENCE-GUARD-001` in loaded sidecar `antcv-generate-cloud-sync-277.js` (5 refs) + `app.src.js`; `CL-HYDRATE-EXPORT-GATE-001` in loaded `antcv-docx-client.js` (3 refs) | leg C writer-hunt (live setItem probe on `sections`/`meta` during one row selection + auto-save downgrade belt) — needs a live signed-in session |

**Data-correction, row 29:** the 2026-09-09 sweep note said all three closed-leg guards were
"present in `app.js`". Corrected this run: only `META-DRIFT-GUARD-002` is in the minified bundle;
`277-SEQUENCE-GUARD-001` and `CL-HYDRATE-EXPORT-GATE-001` are resident in the loaded sidecars
(`antcv-generate-cloud-sync-277.js` / `antcv-docx-client.js`). All three are wired and loaded —
the fix is intact; only the file attribution was wrong.

## E2/E3 standing coverage (rows 17, 23)

The live Playwright diags (`diag-personal-panel-probe.mjs` / `diag-settings-panels-probe.mjs`,
`diag-panel-button-audit.mjs`) **cannot run in this CI env** — chromium is not installed
(`chrome-headless-shell` missing under `~/.cache/ms-playwright`), so the browsers fail to launch.
The regression ANCHORS that gate these rows run inside the green node `--test` suite
(1715/1715) → node-suite standing coverage PASS. The live Playwright legs are owed to a desktop run
(same browserless limitation flagged on prior CI runs).

## Discipline

- SYNC FIRST done; never force-pushed.
- Docs/registers only — no `pwa/` asset changed → no cache-bust quintet, no version consumed, no
  shift claim required. No app.js/worker edit → no PR.
- No PWA change shipped → **no post-deploy live-verify owed** for this run.

## Owed to a desktop / owner run

- Row 34: live preview==export byte-for-byte eyeball on a targeted regen.
- Rows 27/28: real-PDF ~1.5pp verify on a FRESH NIL-targeted export (needs real gen + render).
- Row 29: leg-C live setItem writer-probe during one row selection + the auto-save downgrade belt.
- E2/E3 live Playwright diags (need chromium installed).
- July-stuck 92/93/95/96/97: live regen/render to confirm the defect against code.
- Band B/C app.js surgery (rows 40/41/42/43/44) still wants a PR when a run can repro headlessly.
- Owner: rotate the Cloudflare token so `deploy.yml` works again (row 109).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
