# AntCV Desktop Nightly — 2026-10-15

**Outcome:** live attest PASS at `1.51.4913-demand-seed-refresh` (served `index.html` and `app.js` byte-identical to the repo; four workers `/health` 200 at repo versions, three of them re-deployed today by the cost-quality tune). Band E1-E4 PASS. E1 refreshed five stale rows (58, 62, 74, 69, 67) with the row guards run on this host; one guard (MOB-009 device parity) produced a false FAIL under Playwright contention and was hardened (MOB009-GUARD-SETTLE-001, diag-only). Relay token EXPIRED at run start, so every signed-in leg was skipped against row 110. No pwa loaded asset changed, no version consumed, no worker deployed.

## Preflight / sync
- Host Gabo-PC, Fable 5.1. Preflight exit 3 (WORKSPACE DIRTY: owner WIP in `package.json`, `workers/access-relay/src/index.js`, one relay test). Worked in `C:/Users/Karpg/antcv-worktrees/routine-antcv-nightly-mv9qjzzi` on `origin/main` `f107e458`. The shared clone was not touched.
- **TOKEN EXPIRED** 2026-10-15T11:12:36Z (0 d ago), `routine-preflight.mjs token` exit 4. **DISPATCH GAP 6.4 d** (previous start 2026-10-09T07:22Z): the host slept 10-12 -> 10-15, so the 6-day self-renewal window was missed. Recorded against row 110; no retry, no password.
- Shift claim `1.51.4933-1.51.4952` from inside the worktree (session `sh_mv9qmbet_ixvl`). No number consumed. Released at the end.
- Overlap: CI nightly 2026-10-15 ran at HEAD `035a030e` (E1 rows 59/18/117/63/64; no code). Position-discovery, job-tracker, demand-seed and cost-quality all ran on this host earlier today; none of their rows were re-touched here except 110 (token). No DESKTOP NIGHTLY entry existed for today.
- `node_modules` junction to the shared clone for the Playwright diags; removed before commit.

## Baseline (before any edit)
- `run-tests.mjs pwa` 1822/1822 (CI had 1821; +1 from the 10-15 rates mirror test). Boot smoke OK (glDemo=function, errors=0). `check-register.mjs` OK (89 ACTIVE).

## Live attest (desktop-only)
- `diag-live-guard-sidecars.mjs`: 9/9 served, executed, content-identical. 3 boot 401s (expected, no auth session).
- `browser-qa.mjs --only version-live,sidecars-live`: 2/2 PASS.
- Served constants equal the repo: `sw.js` CACHE `antcv-1.51.4913-demand-seed-refresh`, boot seed `1.51.4913-demand-seed-refresh`, `antcv-version-override.js?v=1.51.4913-demand-seed-refresh` with `TARGET_VERSION` the same, `app.js?v=1.51.4812-import-rewrap-siblings`. Served `index.html` (82306 B) and `app.js` (1125086 B) byte-identical to the repo after stripping CR.
- `/health` 200 ×4 at repo versions: antcv-access-relay `auth-38-subtitle-guard-qual-put`, cv-proxy `3.8.4-brand-ink-match`, antcv-demo-proxy `3.8.4-brand-ink-match`, docx-worker `1.14.174-appline-edit` (`pdf_via: cloudconvert`). The three workers the cost-quality tune deployed today (rates-only, no version bump) answer at the unchanged versions, as expected.
- The 1.51.4913 ship (demand-seed weekly, released 10-15) is what production serves. No deploy was pending.

## Bands
- **A1 row 38:** verified (live attest). Blocked: real device.
- **A2 rows 39a / 19:** 39a verified (live attest; relay re-deployed today at the same version). Downgrade PUT not run: no scratch application id and no token. 19 blocked: second real device.
- **B rows 40 / 41:** verified (live attest; E3 0 THROWS). 40 blocked: owner session. 41 blocked: real device.
- **C rows 42 / 43 / 44:** verified (live attest; E4 parity OK). Blocked: real LLM gen (42), owner session (43, 44).
- **D row 45:** not touched (refreshed 10-08). Blocked: owner profile of a real export.
- **D row 39 (D2):** verified, still open. `MODEL_ROLES` set in both proxy `wrangler.toml` files, both proxies re-deployed today (runs 38766174548 / 38766290667), so the [vars] are live. D1 `llm_calls` (wrangler, SELECT only, 3563 rows read) newest day still 2026-09-28. Blocked: one real LLM gen.
- **E1:** stalest set rows 58 / 62 (2026-10-05) and 74 / 69 / 67 (2026-10-06); all refreshed to 2026-10-15, none closable.
  - Row 58: MOB-008 guard run (panel scrolls, scrollH 1874 vs clientH 279). MOB-009 guard FAILED once (extra mobile `certs:{0:2}` break) while E2 ran in parallel; two clean re-runs + a geometry probe passed with identical maps, widths and heights. Guard hardened to wait for a still `antcv:autoPages` (MOB009-GUARD-SETTLE-001). Not a product regression.
  - Row 62: `diag-contact-icons.mjs` run: NON-BRIDGE and BRIDGE OK; `bodyTopBorder` 3 refs, ✉ 2 refs; docx-worker live at repo version. Still owner render-eyeball.
  - Row 74: markers 7 in `app.src.js`; `cl-ghost-hunt` in the green suite. (C) BACKGROUND-STALL open; owner foreground gen.
  - Row 69: `__AINOTICE` map em-dash free in all 7 languages; `clean()` rewrites em-dash to hyphen; the file's remaining 199 em-dashes are comments and regex classes.
  - Row 67: slogan control + element sidecars loaded by `index.html` and served identical. (A)/(C)/(D)/(E) still owner/regen-gated.
- **E2** row 17: selftest PASS; Personal / Layout / Account / Advanced 0 mutations per 8 s, 0 page errors. PASS.
- **E3** row 23: 210 buttons (210 -> 210), 0 THROWS, 0 DEAD, 0 page errors (active 132, ui-only 9, not-visible 56, skipped 13). Diff vs 10-09: 0 regressions, 0 recoveries, 0 visibility changes, 12 timing flips, 0 gone / 0 added.
- **E4** row 34: RESULTS-PREVIEW-EXPORT-PARITY OK, no page errors.

## Register rows
| Row | ID | Status |
|---|---|---|
| 58 | EXPORT-SETTLED-001 (MOBILE-BUGS-2026-07) | refreshed; guards run; diag hardened; blocked: real phone |
| 62 | HEADER-BANNER-DESIGN-RULES-001 | refreshed; blocked: owner session (render eyeball) |
| 74 | JD-SWAP-STALE-RATIONALE-001 | refreshed; blocked: owner session (foreground gen) |
| 69 | — (CL polish v2 / em-dash anchor) | refreshed; standing anchor |
| 67 | CV-CORECOMP-BLANK-001 | refreshed; blocked: owner session + real LLM regen |
| 38 | GEN-BACKGROUND-001 | verified; blocked: real device |
| 39a | AUTOSAVE-NO-DOWNGRADE-001 | verified; blocked: owner decision (scratch app id) + token |
| 40 | SO-003 | verified; blocked: owner session |
| 41 | SO-004 | verified; blocked: real device |
| 42 | GEN-LANGFAB-001 | verified; blocked: real LLM gen |
| 43 | CA-006 | verified; blocked: owner session |
| 44 | JD-ANALYSIS-PRINT-001 | verified; blocked: owner session |
| 39 | GEN-MODELROLE-001 | verified, still open; blocked: real LLM gen |
| 34 | ROLE-MERGE-STORED-001 | verified (E4 + live attest) |
| 17 | SETTINGS-PERSONAL-STABILIZE-001 | verified (E2, STANDING) |
| 23 | NIGHTLY-PREVIEW-BUTTON-AUDIT-001 | verified (E3, STANDING) |
| 110 | ANTCV-TOKEN-EXPIRED-2026-09-02-001 | re-hit (third routine today); owner re-save owed |
| 45, 35, 36, 37, 103, 115 | — | not touched; blocked: real gen / owner profile / owner call |
| 19, 63, 64 | — | not touched; blocked: second device / signed-in session |

ACTIVE 89 -> 89.

## Evidence index
- `docs/qa/PANEL_BUTTON_AUDIT_2026-10-15.md` + `.json` (diff block against `PANEL_BUTTON_AUDIT_2026-10-09.json`).
- `docs/qa/last-browser-qa.json` (this run).
- D1: `SELECT date(ts,'unixepoch') d, provider, model, task, COUNT(*) n FROM llm_calls GROUP BY d, provider, model, task ORDER BY d DESC LIMIT 12` via `wrangler d1 execute ant_memory --remote --json`; newest 2026-09-28; `changed_db:false`, `rows_written:0`.
- Live fetches: `curl -sL https://antcv.pages.dev/`, `/sw.js`, `/antcv-version-override.js`, `/app.js?v=1.51.4812-import-rewrap-siblings`, compared with `cmp` after `tr -d '\r'`; `/health` on the four `*.karp-gabriel-a.workers.dev` hosts.
- Row guards run on this host: `diag-mob008-panel-overflow.mjs` OK, `diag-mob009-autopages-device-parity.mjs` FAIL (contended) then OK ×3 (two with the original wait, one after hardening), `workers/docx-worker/test/diag-contact-icons.mjs` OK.
- Tests before push: suite 1822/1822 at baseline and after the diag edit; `check-cache-bust.mjs --range origin/main..HEAD` OK (no pwa asset); `check-register.mjs` OK after the edits.

## Owner-verify
- Row 58 MOB-009: the parity guard is now self-settling; if a future run still reports a mobile-only break, that is a real finding, file it against row 59A pagination.
- Next E3 report: "Diff vs previous" should keep showing 0 regressions.

## Owner decisions
- **Re-save the relay token** (`~/.antcv/token`, from the signed-in PWA console). Three routines 401'd today; the job-tracker nightly, position-discovery and every signed-in nightly leg stay blocked until then. Also keep the host awake across the 6-day window or the self-renewal cannot fire.
- Branch protection: make "AntCV PR gate" a required status check on `main`. Unchanged from 10-06.
- Row 39a: name a scratch application id for the downgrade PUT. Unchanged from 10-05.
- Row 115: meter by served model id, yes or no. Unchanged from 10-04.
- One real generation on the owner's key settles rows 39, 42, 35, 36, 37 and the opus-5-5 telemetry question at once. Nothing in `llm_calls` since 2026-09-28.
- Rows 3 / 20 / 25 / 62 wait on one real CloudConvert export session eyeballed by the owner.

## Non-claims
- No pwa loaded asset changed; no cache-bust; no version consumed from the lane; no worker deployed.
- Rows 38-44 are attested served-and-identical, not exercised end-to-end (no signed-in session, token expired).
- The MOB-009 first-run FAIL is attributed to contention on the evidence of three clean passes and identical geometry; it was not bisected, and the hardened guard changes only the wait, not what it asserts.
- No job-tracker, Python or relay-backed step ran.
