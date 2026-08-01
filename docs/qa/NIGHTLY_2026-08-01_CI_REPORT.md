# AntCV nightly — 2026-08-01 (CI / GitHub Actions, unattended, Opus 4.8)

Substrate: GitHub Actions on `gabrielk83/AntCV`. No in-app Browser pane. `ALLOW_DEPLOY=false`
(no worker deploys). Headless Playwright available after `npx playwright install
chromium-headless-shell`. **SYNC FIRST clean:** `git fetch && pull --rebase origin main` → already
up to date, base HEAD `49477d87`. Main in sync throughout; no shift claim (no versioned PWA change
shipped — see Headline).

## Headline

No clean node-verifiable **bug-fix** was genuinely actionable tonight — the whole CI test surface
is green and every open register row is render-gated / owner-gated / needs-live-models /
needs-2nd-device / content-density. **No `app.js`/`app.src.js`/worker/workflow code delta since the
last CI base (`988bb0e6`):** `git diff --stat 988bb0e6..HEAD` over `pwa/app.js`, `pwa/app.src.js`,
`workers/**`, `.github/` is **empty** — the only commits since the 07-31 sweep are docs/registers
(the 07-31 CI sweep, the 07-31 DESKTOP nightly, the 07-31 job-tracker nightly). Production surface
is **byte-identical to the 07-31 desktop-attested state**. This run is a **verify + attest +
reconcile** of the current main: full standing-probe sweep green, all five live surfaces
(PWA + four workers) attested and matching in-repo source, render-gated diags re-run green, and the
**doc-reconcile cleanup the 07-31 CI sweep filed** (stale detailed twins of rows 35/36/37) closed
evidence-backed. **No new finding filed. No code merged to main.**

## Standing probes — ALL GREEN on main (`49477d87`, PWA `1.51.4046-company-retry`)
- **PWA suite:** `node scripts/run-tests.mjs pwa` → **1570/1570 pass**, 0 fail (~7s).
- **app.js integrity:** head `(()=>{window`, **0** `"use strict"` — minified-sacred intact.
- **boot-smoke:** `glDemo=function, errors=0` → OK (after `npx playwright install chromium-headless-shell`).
- **Access-relay unit tests:** **128/128** (`node --test workers/access-relay/tests/*.test.mjs`).
- **Demo-proxy unit tests:** **33/33**.
- **Model-table freshness pins:** **5/5** proxy + **5/5** demo-proxy — no silent pricing drift.
- **docx-worker `.test.mjs` suite:** **32/32** (`node --test workers/docx-worker/test/*.test.mjs`).
- **docx render V&V** (`node scripts/run-docx-diags.mjs`): **50/50** — the CI-wired render gate is
  green on the current bundled worker (`1.14.174-appline-edit`).

## Render-gated diags re-run (Playwright headless) — ALL GREEN / no regression
- **Copenhagen overflow-storm** (`diag-copenhagen-overflow-storm.mjs`): band ON **2 writes / 30px
  drift (bounded)**, band OFF 1 write / 0px → **DIAG PASS**. The CPH-STORM fix holds on current main.
- **Settings-panels probe** (`diag-settings-panels-probe.mjs`, register row 17): **DIAG PASS**
  (Layout 0 mut/6s, rootFound=true, 0 page errors).
- **Sidebar hold + stability** (row 11): `diag-sidebar-stable` **OK** (width/height stable across 12
  scrolls, **0** style writes, 0 page errors); `diag-sidebar-promote-margin` **OK** (hold-under-margin
  true, holds page 3 across one-row + whole-group removal).
- **Panel button-audit** (`diag-panel-button-audit.mjs`, row 23): **208 buttons / 0 page errors /
  0 THROWS** (133 active, 14 skipped-dangerous, 16 ui-only, 45 not-visible/disabled). No DEAD
  candidates surfaced. Record: `PANEL_BUTTON_AUDIT_2026-08-01.*`.

## LIVE ATTEST — workers + PWA (all five READABLE; the 1042 hostname trap stays resolved)
The 07-31 DESKTOP nightly resolved the recurring "access-relay + demo-proxy /health 1042" deferral
as a **wrong-hostname artifact**: those two workers are NAMED `antcv-access-relay` /
`antcv-demo-proxy` (per `wrangler.toml`), so their `*.workers.dev` subdomain carries the `antcv-`
prefix; the un-prefixed host 1042s while the real worker is live. Using the correct prefixed hosts,
**all five surfaces were readable tonight and every version matches in-repo source** — no deferral
this run:

| Surface | Live `/health` (or CACHE) | In-repo source | Match |
|---|---|---|---|
| PWA (`antcv.pages.dev` `sw.js` CACHE) | `antcv-1.51.4046-company-retry` | CACHE + `ANTCV_VERSION` seed + `TARGET_VERSION` all `1.51.4046-company-retry` | ✅ |
| cv-proxy (`cv-proxy.karp-gabriel-a.workers.dev`) | `3.8.4-brand-ink-match` | `VERSION` `3.8.4-brand-ink-match` | ✅ |
| docx-worker (`docx-worker.karp-gabriel-a.workers.dev`) | `1.14.174-appline-edit` | `src/index.js` `VERSION` `1.14.174-appline-edit` | ✅ |
| access-relay (`antcv-access-relay.karp-gabriel-a.workers.dev`) | `auth-37-cap-disposable-only` | `RELAY_VERSION` `auth-37-cap-disposable-only` | ✅ |
| demo-proxy (`antcv-demo-proxy.karp-gabriel-a.workers.dev`) | `3.8.4-brand-ink-match` | `VERSION` `3.8.4-brand-ink-match` | ✅ |

Cosmetic (unchanged, not fixed — low value, needs a worker deploy): `antcv-demo-proxy` `/health`
JSON self-reports `"service":"cv-proxy"` (shared-code label; the version string is authoritative).
**Conclusion: no worker drift, no PWA version regression.**

## Code delta since the last CI base (`988bb0e6`) — NONE on code surfaces
`git diff --stat 988bb0e6..HEAD` over `pwa/app.js`, `pwa/app.src.js`, `workers/**`, `.github/`:
**empty**. Only docs/registers landed since the 07-30 sweep (07-31 CI sweep, 07-31 desktop nightly,
07-31 job-tracker nightly). Production surface byte-identical to the 07-31 desktop-attested state
(desktop `cmp` proved app.js + islands byte-identical to repo, CRLF-normalized). Current main
verified fully green.

## Register reconcile / staleness sweep (E1) — the flagged doc-reconcile cleanup, CLOSED
The 07-31 CI sweep explicitly filed a cleanup: the **DETAILED rows 35/36/37** (register lines
282-284) still read `code-present 2026-07-05` while their **authoritative summary twins** (lines
195-197) carried `re-verified: 2026-07-29` — a stale second representation, flagged "so it isn't
re-discovered as a finding." Tonight I closed it evidence-backed by **re-running all three guard
tests green** and reconciling both representations to `2026-08-01`:
- **Row 35 — OVERLAY-EARLY-HALT-001:** `pwa/test/overlay-watchdog-heartbeat.test.mjs` **6/6**;
  `__antcvGenCost` heartbeat gate present app.js ×4 + app.src.js ×10. Detailed twin reconciled.
- **Row 36 — GEN-CORECOMP-BROAD-001:** `pwa/test/unsolicited-corecomp-broad.test.mjs` **7/7**; broad
  rule inside `__neutralCo` in BOTH bundles (both-bundle guard validates the app.js minified name).
  Detailed twin reconciled.
- **Row 37 — FOCUS-LABEL-EO-001:** `pwa/test/unit/core-comp-compress-eo.test.mjs` **14/14**; `_canon`
  → "EO & Photonic sensors" in `antcv-core-comp-compress.js` (index.html `?v=1.51.43` present).
  Detailed twin reconciled.
- **Rows 1 / 3** — held 2026-07-31 (desktop-refreshed last night, no code change → no re-date).
- **Rows 11 / 52** — held 2026-07-31 (refreshed by both 07-31 runs, no code change).
- **Rows 17 / 23** — re-verified green tonight via the diags above (held).

Regen-confirm for rows 35/36/37 remains owner-gated (one live 3-6min gen), but the code invariant is
validated-implicitly across many clean regens and re-locked by tonight's tests.

## Owed (cannot be done in CI)
- **Post-deploy live-verify** — this CI run shipped **no PWA change** (nothing new owed FROM
  tonight). Standing CI reminder, not a new gap.
- **DIAG-SALMON-EMPTY-REGION-STALE-001 / SALMON-MAIN-LENGTH-001** — still OPEN, render-capable /
  desktop-only (headless harness can't paginate; needs the in-app Preview pane with a loaded CV,
  which the unattended login gate blocks). Not in CI / `run-tests.mjs` → gates nothing. Not re-picked.
- **SO-004 (row 41)** crash capture + **PERF-001 (row 45)** cloud-sync profiling — need a live
  signed-in session. Not actionable unattended.
- **Worker deploys:** `ALLOW_DEPLOY=false` → none attempted; all four workers already match source →
  none owed.
- **Owner/render/live-gated open rows** (rows 1/3/6/8/19/20/22/25/26/27/28/29 etc.): none newly
  actionable from CI — all need a signed-in gen, a 2nd physical device, live models, or a real
  render/export. No implemented-but-still-open row found.

## Register coverage this run
- **Rows 35 / 36 / 37** — guard tests re-run green; detailed twins reconciled to authoritative
  summary; both representations `re-verified: 2026-08-01`. (The 07-31-filed cleanup — CLOSED.)
- **Rows 11 / 52** — held 2026-07-31 (no code change).
- **Rows 1 / 3** — held 2026-07-31 (no code change).
- **Rows 17 / 23** — diags re-run green; held.
- **Live attest (PWA + all four workers)** — all readable, all match source; no drift. 1042
  hostname trap stays resolved (prefixed hosts).
- All other open rows — owner-gated / need a 2nd physical device / live models / a real foreground
  gen → none newly actionable from CI.

No code merged to `main`: this run pushes only docs/registers (this report, the button-audit
record, the OPEN_REGISTER edits). No `app.js` / `app.src.js` / worker / workflow change reached main
(current surface fully green; no new finding).
</content>
</invoke>
