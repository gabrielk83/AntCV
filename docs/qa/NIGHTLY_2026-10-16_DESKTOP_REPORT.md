# AntCV Desktop Nightly — 2026-10-16

**Outcome:** shipped `1.51.5013-grab-zone-scroll-target` (GRAB-ZONE-SCROLL-TARGET-002, new row 128 CLOSED): the mobile bottom panel's grab handle now scrolls the Analysis tab, not only the Sections tab. Found by exercising rows 100/101 in a real browser for the first time (new headless touch probe). Live attest PASS before the ship at `1.51.4993-medsec-cluster`. Band E1-E4 PASS. E1 refreshed rows 31, 98, 99, 100, 101 with their guards run on this host; row 99's own diag could not launch outside the cloud sandbox and was fixed (DIAG-REG-FOLD-HOST-PATH-001). Token OK. Post-push live verify: see the section at the end.

## Preflight / sync
- Host Gabo-PC, Fable 5.1. Preflight exit 3 (WORKSPACE DIRTY: owner WIP in `package.json`, `workers/access-relay/src/index.js`, one relay test). Worked in `C:/Users/Karpg/antcv-worktrees/routine-antcv-nightly-mvb791o9` on `origin/main` `f3d3e0c7`. The shared clone was not touched.
- **TOKEN OK** — expires 2026-10-22T16:22:35Z (6.0 d left); `routine-preflight.mjs token` exit 0. **DISPATCH GAP 1.0 d** (previous start 2026-10-15T16:11Z).
- Shift claim `1.51.5013-1.51.5032` from inside the worktree (session `sh_mvb79x5d_2bp`). Consumed 1.51.5013. Released at the end.
- Overlap: CI nightly 2026-10-16 ran at `451fc004` (E1 rows 66/65/68/75/77/81/83/88/87/86, no code); position-discovery cross-checked at 22:00 on 10-15. None of their rows re-touched. No DESKTOP NIGHTLY entry existed for today.
- `node_modules` junction to the shared clone for the Playwright diags; removed before the worktree was removed.

## Baseline (before any edit)
- `run-tests.mjs pwa` 1824/1824. Boot smoke OK (glDemo=function, errors=0). `check-register.mjs` OK (92 ACTIVE / 92 detail).

## Live attest (desktop-only, pre-ship)
- `diag-live-guard-sidecars.mjs`: 9/9 served, executed, content-identical. 3 boot 401s (expected, no auth session).
- `browser-qa.mjs --only version-live,sidecars-live`: 2/2 PASS.
- Served constants equal the repo: `sw.js` CACHE `antcv-1.51.4993-medsec-cluster`, boot seed `1.51.4993-medsec-cluster`, `antcv-version-override.js?v=1.51.4993-medsec-cluster` with `TARGET_VERSION` the same, `app.js?v=1.51.4812-import-rewrap-siblings`. Served `index.html` (82291 B), `sw.js` (8267 B), `antcv-version-override.js` (40809 B) and `app.js` (1125086 B) byte-identical to the repo after stripping CR.
- `/health` 200 ×4 at repo versions: antcv-access-relay `auth-38-subtitle-guard-qual-put`, cv-proxy `3.8.4-brand-ink-match`, antcv-demo-proxy `3.8.4-brand-ink-match`, docx-worker `1.14.174-appline-edit` (`pdf_via: cloudconvert`).
- Authed relay reads with the saved token (curl, read-only): `GET /api/me` 200 `authenticated:true`, `/api/applications` 200 (27.6 KB), `/api/job-tracker` 200 (1.19 MB). No write was made.

## The ship — GRAB-ZONE-SCROLL-TARGET-002 (`1.51.5013-grab-zone-scroll-target`)
- **Why it was looked at:** rows 100 (GRAB-ZONE-DISMISS-THRESHOLD-001 + SCROLL-FORWARD-001) and 101 (ZOOM-FLOOR-001) were in the E1 stalest set and had only ever been locked by source greps. A new probe, `pwa/test/diag-mobile-grab-zone-touch.mjs`, boots the real app at a 380 px phone viewport, opens the bottom panel and fires native TouchEvents at `.antcv-panel-grab-zone`.
- **Finding:** Sections tab — the content is the handle's direct sibling; a 40 px drag moved it 40 px. Analysis tab — the handle's `nextElementSibling` is the "Generate a CV first" placeholder that `antcv-analysis-panel-jd-block-356.js` hides (`display:none`, `data-antcv-jd-empty-hidden`); the real content is the sibling after it. The forward wrote `scrollTop` on the hidden node and the drag moved the content 0 px. That is the owner's original Android report ("sliding down with finger in the analysis … panel is not working") surviving the 2026-07-05 fix on the Analysis tab. The 80 px dismiss threshold and the 0.1 zoom floor (46 % → 10 % after 12 clicks, + → 20 %) held in the same probe.
- **Fix:** `onTouchMove` walks from the handle to the first sibling that is displayed and overflows, and falls back to the panel element (overflow-y:auto since MOB-008). Surgical in-place edit of `pwa/app.js` (one anchor occurrence) mirrored in `pwa/app.src.js`; `app.js` still starts with `(()=>{`, no `"use strict"`, `vm.Script` parse gate clean. Sections-tab behaviour unchanged by construction.
- **Verification:** negative control with the patch stashed: A1 Sections OK, A2 Analysis FAIL (moved 0), B dismiss OK, C zoom OK. After the patch: A1 OK, A2 OK (preset 60 → 20, moved 40), B OK, C OK, 0 page errors. `grab-zone-dismiss-threshold.test.mjs` +6 (18/18). Suite 1830/1830 (baseline 1824). Boot smoke OK after the code edit and again after the cache-bust.
- **Cache-bust set:** `app.js?v=`, the 19 lane-version sidecar refs that share app.js's `?v` (incl. the `antcv-docx-client.js` module import), `antcv-version-override.js?v=`, boot seed, `sw.js` CACHE, `TARGET_VERSION`; `STALE_VERSIONS` gained the previous target `1.51.4993-medsec-cluster`. `check-cache-bust.mjs --set` OK; `--range origin/main..HEAD` run before push.

## Bands
- **A1 row 38:** verified (live attest). Blocked: real device.
- **A2 rows 39a / 19:** 39a verified (relay live at the deployed guard; token works end to end). Downgrade PUT not run: it writes to a real application row and no scratch application id is named (owner decision since 10-05). 19 blocked: second real device.
- **B rows 40 / 41:** verified (live attest; E3 0 THROWS). 40 blocked: owner session. 41 blocked: real device.
- **C rows 42 / 43 / 44:** verified (live attest; E4 parity OK). Blocked: real LLM gen (42), owner session (43, 44).
- **D row 45:** not touched (refreshed 10-08). Blocked: owner profile of a real export.
- **D row 39 (D2):** both proxies live at the MODEL_ROLES deploy (10-15). D1 `llm_calls` (wrangler, SELECT only, rows_read 3563, rows_written 0) newest day still 2026-09-28. Blocked: one real LLM gen.
- **E1:** stalest set rows 31 (2026-10-07), 98 / 99 / 100 / 101 / 19 (2026-10-08). 19 skipped (second device). The other five refreshed to 2026-10-16:
  - Row 31: `META-DRIFT-GUARD-002` / `META-DOWNGRADE-GUARD-003` ×2 in `app.src.js`, mirrored in `app.js`; both tests green. Still owner-gated (live poisoned row).
  - Row 98: `total_cost_usd_est` ×7 in both proxies, copies byte-identical, grok rates ×5; test green; proxies live at repo version.
  - Row 99: `NAMED_FOLD` ×2, sidecar loaded (`?v=1.51.173`), test green. Its diag `diag-reg-fold-dance.mjs` hard-coded `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` and could not start here; fixed to `chromium.launch()`; run: 0 post-boot writes in 15 s, one merged group, 10 standards, 0 page errors, PASS. Owner "sidebar dancing" thread still unconfirmed.
  - Row 100: see the ship. Real-device confirm still owner-owed.
  - Row 101: zoom floor confirmed in the real handler (10 %). Real-device pinch still owner-owed.
- **E2** row 17: selftest PASS; Personal / Layout / Account / Advanced 0 mutations per 8 s, 0 page errors. PASS.
- **E3** row 23: 216 buttons (210 → 216), 0 THROWS, 0 DEAD, 0 page errors (active 132, ui-only 9, not-visible 62, skipped-dangerous 13). Diff vs 10-15: 0 regressions, 0 recoveries, 1 visibility change ("CJLR: cycle left / center / right / justify" hidden 4 → 10; six more instances of the same label, labels added 0), 4 timing flips, 0 gone / 0 added.
- **E4** row 34: RESULTS-PREVIEW-EXPORT-PARITY OK, no page errors.

## Register rows
| Row | ID | Status |
|---|---|---|
| 128 (new) | GRAB-ZONE-SCROLL-TARGET-002 | shipped + CLOSED (1.51.5013); owner-verify on a real phone |
| 100 | GRAB-ZONE-DISMISS-THRESHOLD-001 | advanced (first browser exercise; Analysis leg fixed via 127); blocked: real device |
| 101 | ZOOM-FLOOR-001 | verified in-browser; blocked: real device (pinch) |
| 99 | REG-GROUP-FOLD-NAMED-001 | verified; diag fixed and run; blocked: owner session (dancing thread) |
| 31 | META-STATE-CORRUPTION-002 | verified; blocked: owner session (live poisoned row) |
| 98 | BYOK-COST-AUDIT-001 | verified |
| 38 | GEN-BACKGROUND-001 | verified; blocked: real device |
| 39a | AUTOSAVE-NO-DOWNGRADE-001 | verified; blocked: owner decision (scratch app id) |
| 40 | SO-003 | verified; blocked: owner session |
| 41 | SO-004 | verified; blocked: real device |
| 42 | GEN-LANGFAB-001 | verified; blocked: real LLM gen |
| 43 | CA-006 | verified; blocked: owner session |
| 44 | JD-ANALYSIS-PRINT-001 | verified; blocked: owner session |
| 39 | GEN-MODELROLE-001 | verified, still open; blocked: real LLM gen |
| 34 | ROLE-MERGE-STORED-001 | verified (E4 + live attest) |
| 17 | SETTINGS-PERSONAL-STABILIZE-001 | verified (E2, STANDING) |
| 23 | NIGHTLY-PREVIEW-BUTTON-AUDIT-001 | verified (E3, STANDING) |
| 110 | ANTCV-TOKEN-EXPIRED-2026-09-02-001 | token OK this run; leg (a) still owed |
| 45, 35, 36, 37, 103, 115, 124, 117, 77 | — | not touched; blocked: real gen / owner profile / owner call |
| 19, 63, 64 | — | not touched; blocked: second device / signed-in session |

ACTIVE 92 → 92 (row 128 filed; the job-tracker nightly filed 127 the same morning and closed in the same run).

## Evidence index
- `pwa/test/diag-mobile-grab-zone-touch.mjs` (new; exit 0 on HEAD, exit 1 with the patch stashed).
- `pwa/test/unit/grab-zone-dismiss-threshold.test.mjs` (+6 SCROLL-TARGET-002 checks and source locks).
- `pwa/test/diag-reg-fold-dance.mjs` (launch line fixed; DIAG PASS on this host).
- `docs/qa/PANEL_BUTTON_AUDIT_2026-10-16.md` + `.json` (diff block against `PANEL_BUTTON_AUDIT_2026-10-15.json`).
- `docs/qa/last-browser-qa.json` (this run, pre-ship).
- D1: `SELECT date(ts,'unixepoch') d, provider, model, task, COUNT(*) n FROM llm_calls GROUP BY d, provider, model, task ORDER BY d DESC LIMIT 12` via `wrangler d1 execute ant_memory --remote --json`; newest 2026-09-28; `changed_db:false`, `rows_written:0`.
- Live fetches: `curl -sL https://antcv.pages.dev/`, `/sw.js`, `/antcv-version-override.js`, `/app.js?v=…`, compared with `cmp` after `tr -d '\r'`; `/health` on the four `*.karp-gabriel-a.workers.dev` hosts; authed `GET /api/me|/api/applications|/api/job-tracker` with the saved token (status + size only).
- Tests before push: suite 1830/1830; boot smoke OK; `check-cache-bust.mjs --set` OK; `check-register.mjs` OK after the register edits.

## Owner-verify
- **Row 128 / 100 on a real Android phone:** open the editor, tap 🎯 Analysis in the bottom bar, put a finger on the grab handle (the pill at the top of the panel) and slide down slowly: the analysis content should scroll. A fast swipe longer than ~80 px should still close the panel back to Preview. Repeat on ☰ Sections (unchanged).
- Row 101: pinch-zoom-out on the preview should now reach 10 %.
- Next E3 report: "Diff vs previous" should keep showing 0 regressions; the CJLR cycle visibility count (4 → 10) is state left by an earlier click, verify only if it stays hidden across runs.

## Owner decisions
- Branch protection: make "AntCV PR gate" a required status check on `main`. Unchanged from 10-06.
- Row 39a: name a scratch application id for the downgrade PUT. Unchanged from 10-05.
- Row 115: meter by served model id, yes or no. Unchanged from 10-04.
- Row 124: replace or drop the retired cascade ids. Row 117: `jd_count` threshold or blend. Row 77: periodic Top-5 re-score wanted or not. All unchanged.
- Row 110 leg (a): a long-lived machine token or a longer relay session TTL; the token dies again at the next host gap straddling 10-22.

## Non-claims
- Headless touch emulation proves the handler logic and the DOM wiring, not Android's native scroll arbitration. No real device was used.
- No real LLM generation, no worker deploy, no signed-in browser session was driven (authed reads via curl only; nothing written through the relay).
- Row 19 (second device) was in the stalest set and was not touched.
- The 19 lane-version sidecars whose `?v` moved to 1.51.5013 are byte-unchanged; the bump follows the lock tests (`hdr-type-controls`, `role-location`) that pin them to app.js's `?v`.

## Post-push live verify
_(filled in after the Pages deploy)_
