# AntCV CI nightly — 2026-10-05 (GitHub Actions, unattended)

**Runner:** GitHub Actions, Opus 4.8, fresh isolated clone. **HEAD at start:** 735f6d8f.
**Env:** ALLOW_DEPLOY=false, no browser pane, no signed-in relay, no second physical device.
**Sync:** `git fetch origin && git pull --rebase origin main` → already up to date.
**Baseline:** `node scripts/run-tests.mjs pwa` GREEN (exit 0, 0 fails). PWA **1.51.4792**,
CACHE `antcv-1.51.4792-demand-seed-refresh`, TARGET_VERSION matching. No versioned asset touched
this run → no cache-bust quintet, no shift claim needed (docs-only).

## What ran: Band E1 — register staleness sweep

Band A (mobile & tab isolation, owner P0) and the live legs of Bands B/C/D cannot be advanced in
CI — they need a browser, a signed-in relay, real-device A/B, or a docx-worker render, none of which
exist here. Per the authoritative plan the next full-coverage contribution is the E1 staleness slot.
The 2026-07-05 prompt's hardcoded slot list (`1,3,9,14,16,20,35-37`) is stale; the live stalest rows
are taken from the `OPEN_REGISTER.md` `verified:` column (convention: rank on that column only).

The four genuinely stalest non-STANDING rows (2026-09-22 / 2026-09-23) were re-verified against
HEAD 735f6d8f. All cited code markers are intact; all remaining work is owner-live- or render-gated,
so each stays ACTIVE with `verified:` refreshed to **2026-10-05**.

| Row | ID | Marker re-confirmed | Why still open |
|---|---|---|---|
| 63 | `ANALYSIS-STALE-ON-APP-LOAD-001` | mount-hydrate unsol-guard `pwa/app.src.js:18765` (`u.set("rationale", t.rationale)`); `__antcvUnsol` 37× | owner live-verify (targeted→targeted saved-app switch needs the relay; no headless repro) |
| 64 | `ANALYSIS-EXPORT-DROPS-FILLED-ANSWERS-001` | `gapStateKey`/`readGapState` 6 refs in `antcv-analysis-report-pdf-360.js`; `diag-new2-gap-detail-export.mjs` present | owner live-verify (fill a gap detail live → confirm it exports) |
| 58 | `EXPORT-SETTLED-001` (MOBILE-BUGS-2026-07) | MOB-008 CSS `overflow-y:auto; -webkit-overflow-scrolling:touch !important` 8 refs; `diag-mob008-panel-overflow.mjs` present | MOB-001..007 + MOB-GAP-OPEN headless-repro-blocked, owner live-gated |
| 62 | `HEADER-BANNER-DESIGN-RULES-001` | `bodyTopBorder` 3 refs + ✉ 2 refs in `workers/docx-worker/src/index.js`; `test/diag-contact-icons.mjs` present | render-measure loop vs KOMBIT gold + 2 Track-C follow-ups need a real docx-worker render |

`node scripts/check-register.mjs` → OK (97 ACTIVE rows, 97 detail sections).

## Blocked in CI (owed to a desktop / live run)

- **Band A1 `GEN-BACKGROUND-001` (row 38):** A/B of the shipped gen-memo on a real mobile gen
  (background/lock mid-run → foreground auto-resume), and the propose-flip-default decision — both
  need a real device + signed-in relay. Not touchable here.
- **Band A2 `AUTOSAVE-NO-DOWNGRADE-001` / `PTR-STALE-GUARD-001` (rows 39a/65):** curl a downgrade PUT
  against the live access-relay, and the same-device stale-pointer A/B — need live relay + signed-in
  session. Leg 3 (row 19) needs a second physical device.
- **Bands B/C/D:** SO-003/SO-004 (rows 40/41) need a headless browser repro; GEN-LANGFAB/CA-006/
  JD-ANALYSIS-PRINT (rows 42/43/44) are content/render fixes needing live models or a real export;
  PERF-001 (row 45) needs a Chrome CPU profile; GEN-MODELROLE-001 (row 39) needs a proxy deploy +
  D1 `llm_calls` read.
- **Worker deploys:** ALLOW_DEPLOY=false → no `deploy.yml`. Any worker change would be PR-only; none
  was needed this run.

## Owner items (unchanged, carried)

- **Row 110 `ANTCV-TOKEN-EXPIRED-2026-09-02-001`:** owner must re-save `~/.antcv/token` (relay-backed
  routines gate at AUTH until then). Structural warning leg shipped; uptime leg (long-lived machine
  token) still owed.
- Band A1 flip-default and Band D2 model-map remain owner-decision gated.

## Post-deploy live-verify owed

No PWA/worker code shipped this run (docs + registers only), so no new live-verify is owed from this
run. The pre-existing owner-live-verify debts on rows 58/62/63/64 above remain, now re-dated.

## Pushed to main (CI-permitted: docs + registers only)

- `docs/qa/REGISTER_ACTIVE_DETAIL.md` — 2026-10-05 verify entries on rows 58, 62, 63, 64.
- `docs/qa/OPEN_REGISTER.md` — `verified:` dates refreshed on the same four rows.
- `docs/qa/REGISTER_RUNLOG.md` — run summary at top.
- `docs/qa/NIGHTLY_2026-10-05_REPORT.md` — this report.

No `pwa/app.js`, `pwa/app.src.js`, or `workers/**` change → no PR required.
