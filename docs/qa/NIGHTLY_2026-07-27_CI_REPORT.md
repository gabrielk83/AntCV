# AntCV nightly — 2026-07-27 (CI / GitHub Actions, unattended, Opus 4.8)

Substrate: GitHub Actions on `gabrielk83/AntCV`. No in-app Browser pane. `ALLOW_DEPLOY=false`
(no worker deploys). Headless Playwright available after `npx playwright install chromium`.
**SYNC FIRST clean:** `git fetch && pull --rebase origin main` → already up to date, base HEAD
`63a68914`. Main in sync throughout; no shift claim (no versioned PWA change shipped — see Headline).

## Headline

No clean node-verifiable **bug-fix** was genuinely actionable tonight — the whole CI test surface
is green and every open register row is render-gated / owner-gated / needs-live-models /
needs-2nd-device / content-density. Since the 2026-07-26 CI base (`961961c2`) the only commits on
main are docs/registers, the CI-wiring change to `deploy.yml`, and the **docx render-diag test
fixtures** (DOCX-DIAG-STALE-OR-REGRESSED-001 fixed → 48/48, wired into CI). **No `app.js` /
`app.src.js` / worker-source change reached main** → the production surface is byte-identical to
last night's CI run. So this is a **verify + attest + reconcile** run: full standing-probe sweep
green (incl. the newly-CI-wired docx render V&V, attested green on live main), full live worker +
PWA attestation (no drift), and the two stalest genuinely-open register rows refreshed. **No new
finding filed.**

## Standing probes — ALL GREEN on main (`63a68914`, PWA `1.51.3803-word-sheet`)
- **PWA suite:** `node scripts/run-tests.mjs pwa` → **1482/1482 pass**, 0 fail (~6s).
- **app.js integrity:** head `(()=>{window`, **0** `"use strict"` — minified-sacred intact.
- **boot-smoke:** `glDemo=function, errors=0` → OK (after `npx playwright install chromium`).
- **Access-relay unit tests:** **128/128** (`node --test workers/access-relay/tests/*.test.mjs`).
- **Demo-proxy unit tests:** **33/33**.
- **Model-table freshness pins** (demo-proxy `model-table-freshness.test.mjs`): **5/5** — no silent
  pricing drift.
- **docx-worker `.test.mjs` suite:** **32/32** (`node --test workers/docx-worker/test/*.test.mjs`).
- **docx render V&V** (`node scripts/run-docx-diags.mjs`): **48/48** — the DOCX-DIAG-STALE-OR-
  REGRESSED-001 fix (07-26 desktop) holds on live main and the newly-wired CI gate is green.

## Render-gated diags re-run (Playwright headless) — ALL GREEN / no regression
- **Copenhagen overflow-storm** (`diag-copenhagen-overflow-storm.mjs`): band ON **2 writes / 30px
  drift (bounded)**, band OFF 1 write / 0px → **DIAG PASS**. The CPH-STORM fix holds on live main.
- **Settings-panels probe** (`diag-settings-panels-probe.mjs`, register row 17): **DIAG PASS**
  (Personal/Account/Layout each 0 mut/6s, rootFound=true, 0 page errors).
- **Sidebar hold + stability** (row 11): `diag-sidebar-promote-margin` **OK** (hold-under-margin
  true); `diag-sidebar-stable` **OK** (width/height stable across 12 scrolls, ≤2 style writes, 0
  page errors).
- **Panel button-audit** (`diag-panel-button-audit.mjs`, row 23): **190 buttons / 0 page errors /
  0 THROWS** (121 active, 13 skipped-dangerous, 13 ui-only, 43 not-visible/disabled). No DEAD
  candidates surfaced. Record: `PANEL_BUTTON_AUDIT_2026-07-27.*`.

## LIVE ATTEST — workers + PWA, NO drift, NO regression
Via `*.karp-gabriel-a.workers.dev` (the correct host family; DNS-reachable from the Actions runner):

| Surface | Live `/health` (or CACHE) | In-repo source | Match |
|---|---|---|---|
| PWA (`antcv.pages.dev` `sw.js` CACHE) | `antcv-1.51.3803-word-sheet` | `pwa/sw.js` CACHE + `ANTCV_VERSION` seed + `TARGET_VERSION` all `1.51.3803-word-sheet` | ✅ |
| access-relay | `auth-36-jd-cross-app-guard` | `RELAY_VERSION` `auth-36-jd-cross-app-guard` | ✅ |
| cv-proxy (`cv-proxy.karp-gabriel-a.workers.dev`) | `3.8.4-brand-ink-match` | `VERSION` `3.8.4-brand-ink-match` | ✅ |
| demo-proxy | `3.8.4-brand-ink-match` (shares codebase) | `3.8.4-brand-ink-match` | ✅ |
| docx-worker (`docx-worker.karp-gabriel-a.workers.dev`) | `1.14.171-spec-photo` | `src/index.js` `VERSION` `1.14.171-spec-photo` | ✅ |

**Conclusion: no worker drift, no PWA version regression.** (Host note for future sweeps: cv-proxy
and docx-worker attest at `cv-proxy.*` / `docx-worker.*`, NOT `antcv-cv-proxy.*` / `antcv-docx-*.*`
— the latter 404/1042. The relay `/health` `upstream` field lists the correct cv-proxy host.)

## Prior-run owed items — status confirmed
- **DOCX-DIAG-STALE-OR-REGRESSED-001** (07-26 desktop): **RESOLVED / shipped to main** — the 6
  stale diags are fixed (48/48 here) and `run-docx-diags.mjs` is now a CI gate in the docx step of
  `deploy.yml`. Attested green tonight. No re-pick.
- **CI-COVERAGE-GAP-RELAY-DEMOPROXY-001 / PWA-FULLTREE / DOCX-TEST-INFRA-BATCH / DOCX-SMOKE-SUITE-
  DEAD-001** (07-25/26): **DONE / shipped** — access-relay + demo-proxy suites, full `pwa/` tree,
  and the docx `.test.mjs` + render V&V all wired into CI and green here.

## Register reconcile / staleness sweep (E1) — the two stalest OPEN rows refreshed
The stalest `verified:` end of `OPEN_REGISTER.md` was 2026-07-07 (rows 1, 3, 9, 52). Rows 9 + 52 are
already CLOSED/SHIPPED. The two genuinely-open stalest rows re-verified against current code:
- **Row 1 (page/CV convergence + export pagination parity)** — no new code addresses page-count
  convergence; the copenhagen-storm + salmon-area + sidebar diags are all green (no regression
  signal). Genuinely open, render/owner-gated. `verified:` advanced 2026-07-07 → 2026-07-27.
- **Row 3 (floating spine)** — flag confirmed still default-OFF in current code: docx-worker
  `floatSpine: payload.float_spine === true` (src/index.js ~24652) and docx-client gate
  `localStorage.getItem('antcv:float-spine') === '1'` (antcv-docx-client.js ~1244). Genuinely open
  pending the owner's visual re-export. `verified:` advanced 2026-07-07 → 2026-07-27.
- **Rows 11 / 17 / 23** — re-verified green tonight via the diags above (refreshed 07-26; held).

## Owed (cannot be done in CI)
- **DIAG-SALMON-EMPTY-REGION-STALE-001 repair** — still OPEN, render-capable/desktop (deep-diag
  recipe in the 07-26 register entry: headless harness can't paginate; needs the in-app Preview
  pane). Not in CI / `run-tests.mjs` → gates nothing. Not re-picked (headless-unrepairable).
- **Post-deploy live-verify** — none owed from this run: **no PWA change shipped** (verify-only).
  Carry-forward for a desktop run: the optional live-verify of PREVIEW-SHEET-WORD-HEIGHT-001 +
  SALMON-BREAK-SITE-001 + WHY-JOINED-SENTENCE-001 on the deployed `1.51.3803` build (still owed
  from 07-26; unchanged since).
- **Worker deploys:** `ALLOW_DEPLOY=false` → none attempted, none owed.
- **Owner/render/live-gated open rows** (rows 1/3/25/26/28/29/31/34/40–61/92–97, etc.): none newly
  actionable from CI — all need a signed-in gen, a 2nd physical device, live models, or a real
  render/export. No implemented-but-still-open row found.

## Register coverage this run
- **Rows 1 / 3** — staleness refreshed (verified against current code, `verified:` → 2026-07-27).
- **Rows 11 / 17 / 23** — diags re-run green; held at 2026-07-26.
- **DOCX-DIAG-STALE-OR-REGRESSED-001** — confirmed DONE/shipped + CI-wired; attested 48/48 (no re-pick).
- **Worker + PWA live attest** — recorded; no drift.
- All other open rows — owner-gated / need a 2nd physical device / live models / a real foreground
  gen → none newly actionable from CI.

No code merged to `main`: this run pushes only docs/registers (this report, the button-audit
record, the OPEN_REGISTER / ACTIVE_BUGS edits). No `app.js` / `app.src.js` / worker / workflow
change reached main (surface fully green; no new finding).
</content>
</invoke>
