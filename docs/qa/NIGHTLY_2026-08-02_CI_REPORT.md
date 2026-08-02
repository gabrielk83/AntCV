# AntCV nightly — 2026-08-02 (CI / GitHub Actions, unattended, Opus 4.8)

Substrate: GitHub Actions on `gabrielk83/AntCV`. No in-app Browser pane. `ALLOW_DEPLOY=false`
(no worker deploys). Headless Playwright available after `npx playwright install
chromium-headless-shell`. **SYNC FIRST clean:** `git fetch && pull --rebase origin main` → already
up to date, base HEAD `206b8270`. Preflight `WORKSPACE CLEAN`. No shift claim (no versioned PWA
change shipped — see Headline). Main in sync throughout; no force-push.

## Headline

**Verify + attest + reconcile of current `main`, plus one investigated finding that resolved to a
VERIFIED NON-BUG.** No code delta on any code surface since the last CI base — `git diff --stat
988bb0e6..HEAD` and `49477d87..HEAD` over `pwa/app.js`, `pwa/app.src.js`, `workers/**`, `.github/`
are **empty**; the only commits since the 07-31 CI sweep are the 08-01 demand-seed weekly
(`1.51.4086-demand-seed-refresh`, a sidecar-only cluster-demand data refresh), the 08-01 desktop
nightly, the 08-01 job-tracker nightly, and two doc-merge PRs (#354/#358). The full standing-probe
sweep is green, all five live surfaces attest = in-repo source (**PWA now live at `1.51.4086`,
confirming the demand-seed auto-deployed since the 07-31/08-01-CI attest at `4046`**), and every
render-gated diag re-ran green. **No code merged to `main`. No PR opened** (the one finding was a
false positive — see below). This run pushes only docs/registers.

## Investigated finding → VERIFIED NON-BUG: ANTCV_VERSION seed vs TARGET_VERSION

At a glance the 08-01 demand-seed run looked like an incomplete cache-bust quintet: it bumped
`sw.js` CACHE + `TARGET_VERSION` + version-override's own `?v` to `1.51.4086-demand-seed-refresh`
but left `window.ANTCV_VERSION` (the index.html boot seed) at `1.51.4046-company-retry` — superficially
the "babel-fish" stale-boot-version class (fixed 1.50.775). **Verify-first proved this is correct,
not a regression.** The team-encoded invariant is `seed == app.js?v`, **not** `seed ==
TARGET_VERSION`, and it is LOCKED by `pwa/test/unit/hdr-type-controls.test.mjs:192` ("the changed
assets are cache-busted to the same version"): it asserts `window.ANTCV_VERSION` equals the
`app.js?v=` token. The demand-seed changed only a **sidecar** (`antcv-cluster-demand.js`); `app.js`
itself did not change, so `app.js?v` correctly stayed `4046` and the seed correctly stayed `4046` to
match it. `TARGET_VERSION`/CACHE `4086` is the release/display label; on a sidecar-only release the
seed (tracking the app.js bundle) and TARGET legitimately diverge. A candidate fix (align seed to
TARGET) + a `seedTargetDrift` gate hardening was drafted on a branch, but the existing suite caught
it: the change broke `hdr-type-controls.test.mjs` and the proposed gate would have wrongly blocked
**every** sidecar-only release. **Branch discarded; no change shipped.** Documented in ACTIVE_BUGS so
no future run re-flags it. (Note: CLAUDE.md's quintet wording "bump the seed to the new version"
holds only when `app.js` itself changes — which is the common full-release case; the precise
invariant is seed==app.js?v.)

## Standing probes — ALL GREEN on main (`206b8270`, PWA live `1.51.4086-demand-seed-refresh`)
- **PWA suite:** `node scripts/run-tests.mjs pwa` → **1570/1570 pass**, 0 fail (~7s). Full-repo
  `node scripts/run-tests.mjs` → **1888/1888 pass**, 0 fail (~9s).
- **app.js integrity:** head `(()=>{window`, **0** `"use strict"` — minified-sacred intact.
- **boot-smoke:** `glDemo=function, errors=0` → OK (after `npx playwright install chromium-headless-shell`).
- **Access-relay unit tests:** **128/128**.
- **Demo-proxy unit tests:** **33/33**.
- **docx-worker `.test.mjs` suite:** **32/32**.
- **Model-table freshness pins:** **10/10** (5 proxy + 5 demo-proxy) — no silent pricing drift.
- **docx render V&V** (`node scripts/run-docx-diags.mjs`): **50/50** on bundled worker
  `1.14.174-appline-edit`.

## Render-gated diags re-run (Playwright headless) — ALL GREEN / no regression
- **Copenhagen overflow-storm** (`diag-copenhagen-overflow-storm.mjs`): band ON **2 writes / 0px
  drift**, band OFF 1 write / 0px → **DIAG PASS** (drift tighter than the 07-31/08-01 30px-bounded
  reading; the CPH-STORM fix holds on current main).
- **Settings-panels probe** (`diag-settings-panels-probe.mjs`, register row 17): **DIAG PASS**
  (Layout 0 mut/6s, rootFound=true, 0 page errors).
- **Sidebar hold + stability** (row 11): `diag-sidebar-stable` **OK** (width/height stable across 12
  scrolls, ≤2 style writes, 0 page errors); `diag-sidebar-promote-margin` **OK** (hold-under-margin
  true, holds page 3 across one-row + whole-group removal).
- **Panel button-audit** (`diag-panel-button-audit.mjs`, row 23): **211 buttons / 0 page errors /
  0 THROWS** (139 active, 14 skipped-dangerous, 14 ui-only, 44 not-visible/disabled). No DEAD
  candidates surfaced. Record: `PANEL_BUTTON_AUDIT_2026-08-02.{json,md}`.

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
version regression; the demand-seed deploy propagated correctly.**

## Code delta since the last CI base — NONE on code surfaces
`git diff --stat 988bb0e6..HEAD` / `49477d87..HEAD` over `pwa/app.js`, `pwa/app.src.js`,
`workers/**`, `.github/`: **empty**. `app.js`/`app.src.js`/workers byte-identical to the 08-01
desktop-attested state. Only docs/registers + the sidecar cluster-demand data refresh landed.

## Register reconcile / staleness sweep (E1)
No code changed since 08-01, so the register carries no new drift. The 08-01 desktop + CI runs
already re-dated rows 1/3/11/17/23/35/36/37/52 to `2026-08-01`. This run re-verified the
render-gated subset green on `2026-08-02`:
- **Row 1** (page/CV convergence): render diags all green today; still open, render/owner-gated.
- **Rows 11 / 17 / 23**: sidebar-stable + settings-panels + button-audit re-run green today; held.
- **Rows 35 / 36 / 37** (regen-confirm guards): guard tests inside the 1888/1888 pwa suite pass;
  code invariant intact. Regen-confirm remains owner-gated (one live 3-6 min gen).
- **NEW note** filed in ACTIVE_BUGS: the seed==app.js?v invariant clarification (the NON-BUG above),
  so the demand-seed's seed/TARGET split isn't re-discovered as a finding.

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
- **JOBTRACKER-ODM-ANONYMIZATION-GARBLE-001** (08-01 job-tracker finding): owner-gated force-regen;
  real persisted application data, not patched here. Carried forward.

## Register coverage this run
- **Rows 1 / 11 / 17 / 23 / 35 / 36 / 37** — re-verified green today (diags + full suite); held.
- **Live attest (PWA + all four workers)** — all readable, all match source; PWA propagated to 4086.
- **ACTIVE_BUGS** — seed==app.js?v NON-BUG clarification added (top block).
- All other open rows — owner-gated / need a 2nd physical device / live models / a real foreground
  gen → none newly actionable from CI.

No `app.js` / `app.src.js` / worker / workflow change reached `main` this run (current surface fully
green; the one finding was a false positive). Pushes: this report, the button-audit record, the
ACTIVE_BUGS non-bug note, and the OPEN_REGISTER date refresh.
</content>
