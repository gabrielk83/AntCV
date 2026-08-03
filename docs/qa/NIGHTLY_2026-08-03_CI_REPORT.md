# AntCV nightly — 2026-08-03 (CI / GitHub Actions, unattended, Opus 4.8)

Substrate: GitHub Actions on `gabrielk83/AntCV`. No in-app Browser pane. `ALLOW_DEPLOY=false`
(no worker deploys). Headless Playwright available after `npx playwright install
chromium-headless-shell`. **SYNC FIRST clean:** `git fetch && pull --rebase origin main` → already
up to date, base HEAD `e3cd4a21`. Working tree clean. No shift claim (no versioned PWA change
shipped — see Headline). Main in sync throughout; no force-push.

## Headline

**Verify + attest + reconcile of current `main`. No code delta on any code surface; nothing shipped.**
`git diff --stat 206b8270..HEAD` over `pwa/app.js`, `pwa/app.src.js`, `workers/**`, `.github/` is
**empty** — the only commits since the 08-02 CI base are the 08-02 CI nightly report and the 08-02
job-tracker nightly doc (both docs-only). The full standing-probe sweep is green, all five live
surfaces attest = in-repo source, and every render-gated diag re-ran green. **No code merged to
`main`, no PR opened** (no finding surfaced). This run pushes only docs/registers.

## Standing probes — ALL GREEN on main (`e3cd4a21`, PWA live `1.51.4086-demand-seed-refresh`)
- **PWA suite:** `node scripts/run-tests.mjs pwa` → **1570/1570 pass**, 0 fail (~7s). Full-repo
  `node scripts/run-tests.mjs` → **1888/1888 pass**, 0 fail (~9s).
- **app.js integrity:** head `(()=>{window`, **0** `"use strict"` — minified-sacred intact.
- **boot-smoke:** `glDemo=function, errors=0` → OK (after `npx playwright install chromium-headless-shell`).
- **Access-relay unit tests:** **140/140**.
- **Demo-proxy unit tests:** **33/33**.
- **docx-worker `test/*.test.mjs` suite:** **32/32**.
- **Model-table freshness pins:** **10/10** (5 proxy + 5 demo-proxy) — no silent pricing drift.
- **docx render V&V** (`node scripts/run-docx-diags.mjs`): **50/50** on bundled worker
  `1.14.174-appline-edit`.

## Render-gated diags re-run (Playwright headless) — ALL GREEN / no regression
- **Copenhagen overflow-storm** (`diag-copenhagen-overflow-storm.mjs`): band ON **2 writes / 0px
  drift**, band OFF 1 write / 0px → **DIAG PASS** (CPH-STORM fix holds on current main).
- **Settings-panels probe** (`diag-settings-panels-probe.mjs`, register row 17): **DIAG PASS**
  (Layout 0 mut/6s, rootFound=true, 0 page errors).
- **Sidebar hold + stability** (row 11): `diag-sidebar-stable` **OK** (width/height stable across 12
  scrolls, ≤2 style writes, 0 page errors); `diag-sidebar-promote-margin` **OK** (hold-under-margin
  true, holds page 3 across one-row + whole-group removal).
- **Panel button-audit** (`diag-panel-button-audit.mjs`, row 23): **211 buttons / 0 page errors /
  0 THROWS / 0 DEAD** (137 active, 14 skipped-dangerous, 16 ui-only, 44 not-visible/disabled).
  Record: `PANEL_BUTTON_AUDIT_2026-08-03.{json,md}`.

## LIVE ATTEST — workers + PWA (all five READABLE via prefixed hosts; every version = in-repo source)

| Surface | Live `/health` (or CACHE) | In-repo source | Match |
|---|---|---|---|
| PWA (`antcv.pages.dev` `sw.js` CACHE) | `antcv-1.51.4086-demand-seed-refresh` | `sw.js` CACHE `1.51.4086-demand-seed-refresh` | ✅ |
| cv-proxy (`cv-proxy.karp-gabriel-a.workers.dev`) | `3.8.4-brand-ink-match` | `VERSION` `3.8.4-brand-ink-match` | ✅ |
| docx-worker (`docx-worker.karp-gabriel-a.workers.dev`) | `1.14.174-appline-edit` | `src/index.js` `VERSION` `1.14.174-appline-edit` | ✅ |
| access-relay (`antcv-access-relay.karp-gabriel-a.workers.dev`) | `auth-37-cap-disposable-only` | `RELAY_VERSION` `auth-37-cap-disposable-only` | ✅ |
| demo-proxy (`antcv-demo-proxy.karp-gabriel-a.workers.dev`) | `3.8.4-brand-ink-match` | `VERSION` `3.8.4-brand-ink-match` | ✅ |

Cosmetic (unchanged, not fixed — needs a worker deploy): `antcv-demo-proxy` `/health` JSON
self-reports `"service":"cv-proxy"` (shared-code label; the version string is authoritative). The
1042 wrong-hostname trap stays resolved (prefixed hosts). **Conclusion: no worker drift, no PWA
version regression.**

## Code delta since the last CI base — NONE on code surfaces
`git diff --stat 206b8270..HEAD` over `pwa/app.js`, `pwa/app.src.js`, `workers/**`, `.github/`:
**empty**. `app.js`/`app.src.js`/workers byte-identical to the 08-02 CI-attested state. Only
docs/registers landed since.

## Register reconcile / staleness sweep (E1)
No code changed since 08-02, so the register carries no new drift. This run re-verified the
render-gated subset green on `2026-08-03` and re-dated the rows it touched:
- **Row 1** (page/CV convergence): render diags all green today; re-dated `verified: 2026-08-03`;
  still open, render/owner-gated.
- **Rows 11 / 17 / 23**: sidebar-stable + settings-panels + button-audit re-run green today;
  re-dated 2026-08-03 in the row chains; held.
- **Rows 35 / 36 / 37** (regen-confirm guards): guard tests inside the 1888/1888 pwa suite pass;
  code invariant intact. Regen-confirm remains owner-gated (one live 3-6 min gen).
- **SEED-VS-TARGET-VERSION-NONBUG-001** re-confirmed (not re-flagged); a 2026-08-03 verify note added
  to the ACTIVE_BUGS top block.

## Owed (cannot be done in CI)
- **Post-deploy live-verify** — this CI run shipped **no PWA change** (nothing owed FROM tonight).
- **SO-004 (row 41)** crash capture + **PERF-001 (row 45)** cloud-sync profiling — need a live
  signed-in session. Not actionable unattended.
- **DIAG-SALMON-EMPTY-REGION-STALE-001 / SALMON-MAIN-LENGTH-001** — render-capable / desktop-only
  (headless harness can't paginate the in-app Preview behind the login gate). Not re-picked.
- **Worker deploys:** `ALLOW_DEPLOY=false` → none attempted; all four workers already match source →
  none owed.
- **Owner/render/live-gated open rows** (1/3/6/8/19/20/22/25/26/27/28/29 etc.): none newly
  actionable from CI — all need a signed-in gen, a 2nd physical device, live models, or a real
  render/export.
- **JOBTRACKER-ODM-ANONYMIZATION-GARBLE-001** (08-01 job-tracker finding) + demo-proxy `/health`
  `"service"` cosmetic self-label: owner/deploy-gated; carried forward.

## Register coverage this run
- **Rows 1 / 11 / 17 / 23 / 35 / 36 / 37** — re-verified green today (diags + full suite); held.
- **Live attest (PWA + all four workers)** — all readable, all match source; no drift.
- **ACTIVE_BUGS** — 2026-08-03 verify-attest note added (top block).
- All other open rows — owner-gated / need a 2nd physical device / live models / a real foreground
  gen → none newly actionable from CI.

No `app.js` / `app.src.js` / worker / workflow change reached `main` this run (current surface fully
green; no finding). Pushes: this report, the button-audit record, the ACTIVE_BUGS verify note, and
the OPEN_REGISTER date/banner refresh.
