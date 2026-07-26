# AntCV nightly — 2026-07-26 (CI / GitHub Actions, unattended, Opus 4.8)

Substrate: GitHub Actions on `gabrielk83/AntCV`. No in-app Browser pane. `ALLOW_DEPLOY=false`
(no worker deploys). Headless Playwright available after `npx playwright install chromium`.
**SYNC FIRST clean:** `git fetch && pull --rebase origin main` → already up to date, base HEAD
`961961c2` (the 2026-07-26 CI-coverage / full-pwa-tree commit). Main in sync throughout; no shift
claim (no versioned PWA change shipped — see Headline).

## Headline

No clean node-verifiable **bug-fix** was genuinely actionable tonight — the whole CI test surface
is green and every open register row is render-gated / owner-gated / needs-live-models /
needs-2nd-device / content-density. Two register-reconcile facts confirmed the surface is fresh:
the two owed CI-coverage findings from 07-25 (**CI-COVERAGE-GAP-RELAY-DEMOPROXY-001** +
**PWA-FULLTREE** + the docx test-infra batch) are all **shipped to main** already (desktop 07-25/26),
and the docx `.test.mjs`, access-relay, and demo-proxy suites are now wired into and green in CI.
So this is a **verify + attest + reconcile** run with **one new report-only finding filed**
(a stale render diag), the stalest register rows refreshed, and full live attestation.

## Standing probes — ALL GREEN on main (`961961c2`, PWA `1.51.3803-word-sheet`)
- **PWA suite:** `node scripts/run-tests.mjs pwa` → **1482/1482 pass**, 0 fail (~6s).
- **app.js integrity:** head `(()=>{window`, **0** `"use strict"` — minified-sacred intact.
- **boot-smoke:** `glDemo=function, errors=0` → OK.
- **Access-relay unit tests:** **128/128** (`node --test workers/access-relay/tests/*.test.mjs`).
- **Demo-proxy unit tests:** **33/33**.
- **Model-table freshness pins** (proxy + demo-proxy): **5 + 5** — no silent pricing drift.

## Render-gated diags re-run (Playwright headless) — ALL GREEN / no regression
- **Copenhagen overflow-storm** (`diag-copenhagen-overflow-storm.mjs`): band ON **2 writes / 30px
  drift (bounded)**, band OFF 1 write / 0px → **DIAG PASS**. The CPH-STORM fix holds on live main.
- **Settings-panels probe** (`diag-settings-panels-probe.mjs`, register row 17): **DIAG PASS**
  (Personal/Account/Layout each 0 mut/6s, rootFound=true, 0 page errors).
- **Sidebar hold + stability** (row 11): `diag-sidebar-promote-margin` **OK** (hold-under-margin
  true across one-row + whole-group removal); `diag-sidebar-stable` **OK** (width/height stable
  across 12 scrolls, ≤2 style writes, 0 page errors).
- **Panel button-audit** (`diag-panel-button-audit.mjs`, row 23): **191 buttons / 0 page errors /
  0 THROWS** (116 active, 13 skipped-dangerous, 15 ui-only, 47 not-visible/disabled). DEAD
  candidates are the known idempotent no-store-write UI keys (settingsTab/subTab/topbarOrder/
  analytics counts/probes), not export-parity gaps. Record: `PANEL_BUTTON_AUDIT_2026-07-26.md`.

## LIVE ATTEST — workers + PWA, NO drift, NO regression
Via `*.karp-gabriel-a.workers.dev` (the correct host family; DNS-reachable from the Actions runner):

| Surface | Live `/health` (or CACHE) | In-repo source | Match |
|---|---|---|---|
| PWA (`antcv.pages.dev` `sw.js` CACHE) | `antcv-1.51.3803-word-sheet` | `pwa/sw.js` CACHE + `ANTCV_VERSION` seed + `TARGET_VERSION` all `1.51.3803-word-sheet` | ✅ |
| access-relay | `auth-36-jd-cross-app-guard` | `RELAY_VERSION` `auth-36-jd-cross-app-guard` | ✅ |
| cv-proxy | `3.8.4-brand-ink-match` | `VERSION` `3.8.4-brand-ink-match` | ✅ |
| demo-proxy | `3.8.4-brand-ink-match` (shares codebase) | `3.8.4-brand-ink-match` | ✅ |
| docx-worker | `1.14.171-spec-photo` | `src/index.js` `VERSION` `1.14.171-spec-photo` | ✅ |

**Conclusion: no worker drift, no PWA version regression.**

## Prior-run owed items — status confirmed
- **CI-COVERAGE-GAP-RELAY-DEMOPROXY-001** (07-25, was owed): **RESOLVED / shipped to main.**
  `.github/workflows/deploy.yml` `unit-tests` job now runs access-relay (line 108) + demo-proxy
  (line 110) suites; both green in CI (128/128 + 33/33 re-verified here).
- **CI-COVERAGE-GAP-PWA-FULLTREE-001 + DOCX-TEST-INFRA-BATCH + DOCX-SMOKE-SUITE-DEAD-001**
  (07-26 desktop): **DONE / shipped** — PWA step now runs the full `pwa/` tree, docx `.test.mjs`
  suite wired + `npm test` repointed. Confirmed present in `deploy.yml` + green here.

## NEW finding filed this run (report-only, render-domain)

### DIAG-SALMON-EMPTY-REGION-STALE-001 — stale render diag, NOT a regression, NOT fixed
`pwa/test/diag-salmon-empty-region.mjs` (last touched 2026-06-20 `1.50.753`; **not in CI / not in
`run-tests.mjs`** → gates nothing) FAILS on current main `1.51.3803`. Diagnostic-first Playwright
probe root-caused it as **stale fixture + obsolete assertions, not a live pagination bug**:

1. **Squeeze, not break.** The 5-role fixture's main content measures **1304px** against the
   CURRENT usable preview page height **1275px** → `antcv:mainOverflow` verdict = **"squeeze"**
   (overshoot 29px / 1.8 lines), so the engine correctly keeps it to **ONE** page (`pageRows=1`).
   The diag was calibrated for the old ~1053px usable page (CLAUDE.md "preview line ~1053px") where
   1304px was clearly 2 pages; the usable height has grown across the pagination reworks, dropping
   the fixture into the small-overshoot single-page band → all 4 asserts fail off the single row.
2. **`last-row = 1123 A4` is obsolete twice.** `antcv-page-fit.js` collapses even the last
   multi-page row to content (`rows.length===1 ? sheetHeightPx() : '0px'`), AND
   PREVIEW-SHEET-WORD-HEIGHT-001 (`1.51.3803`, shipped today) made the single/last sheet the
   Word-equivalent height (~985px = 1123/1.14), not true A4.

**No corroborating regression signal:** in-CI salmon/storm guards green (suite 1482/1482), the
copenhagen-storm + sidebar + settings + button diags all PASS, all five surfaces attest live.

**Repair recipe (owed to a render-capable/desktop session** — salmon is the most blue-screen-prone
area per CLAUDE.md, and the diag asserts preview↔Word-export parity that a headless-only run cannot
confirm, so it was filed not fixed, matching today's DOCX-DIAG-STALE-OR-REGRESSED-001 precedent**):**
bump the fixture past the squeeze band (≈7–8 roles so content clearly > 1275px → verdict "break");
drop the obsolete last-row-A4 assert and instead assert every page-row (incl. last) collapses to
its content (the true SALMON-EMPTY-REGION invariant that survived); keep the flush-salmon-gap check;
then optionally wire into `run-tests.mjs`.

## Owed (cannot be done in CI)
- **DIAG-SALMON-EMPTY-REGION-STALE-001 repair** — render-capable/desktop (recipe above).
- **DOCX-DIAG-STALE-OR-REGRESSED-001 triage** — still owed (6 `run-docx-diags.mjs` FAILs, filed
  07-26 desktop, render-capable triage owed; pre-existing, not touched here).
- **Post-deploy live-verify** — none owed from this run: **no PWA change shipped** (verify-only).
  Carry-forward for a desktop run: optional live-verify of PREVIEW-SHEET-WORD-HEIGHT-001 +
  SALMON-BREAK-SITE-001 + WHY-JOINED-SENTENCE-001 on the deployed `1.51.3803` build.
- **Worker deploys:** `ALLOW_DEPLOY=false` → none attempted, none owed.
- **Owner/render/live-gated open rows** (rows 1/3/25/26/28/29/31/34/40–61/92–97, etc.): none newly
  actionable from CI — all need a signed-in gen, a 2nd physical device, live models, or a real
  render/export.

## Register coverage this run
- **Rows 11 / 17 / 23** — staleness refreshed (diags re-run green, `verified:` advanced to
  2026-07-26: row 11 was 2026-07-03, rows 17 + 23 were 2026-07-06).
- **DIAG-SALMON-EMPTY-REGION-STALE-001** — NEW row (OPEN, report-only) in OPEN_REGISTER + ACTIVE_BUGS.
- **CI-COVERAGE-GAP-RELAY-DEMOPROXY-001 / PWA-FULLTREE / DOCX batch** — confirmed DONE/shipped
  (no re-pick).
- **Worker + PWA live attest** — recorded; no drift.
- All other open rows — owner-gated / need a 2nd physical device / live models / a real foreground
  gen → none newly actionable from CI. No implemented-but-still-open row found.

No code merged to `main`: this run pushes only docs/registers (this report, the button-audit
record, the OPEN_REGISTER / ACTIVE_BUGS edits). No `app.js` / `app.src.js` / worker / workflow
change reached main (surface fully green; the one new finding is render-domain, filed as owed).
