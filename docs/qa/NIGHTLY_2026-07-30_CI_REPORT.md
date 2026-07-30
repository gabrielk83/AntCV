# AntCV nightly — 2026-07-30 (CI / GitHub Actions, unattended, Opus 4.8)

Substrate: GitHub Actions on `gabrielk83/AntCV`. No in-app Browser pane. `ALLOW_DEPLOY=false`
(no worker deploys). Headless Playwright available after `npx playwright install chromium-headless-shell`.
**SYNC FIRST clean:** `git fetch && pull --rebase origin main` → already up to date, base HEAD
`988bb0e6`. Main in sync throughout; no shift claim (no versioned PWA change shipped — see Headline).

## Headline

No clean node-verifiable **bug-fix** was genuinely actionable tonight — the whole CI test surface
is green and every open register row is render-gated / owner-gated / needs-live-models /
needs-2nd-device / content-density. **Unlike the 07-26/27/28 sweeps, the production surface DID
advance since the last CI base** (`65569043`): between 07-28 and tonight many desktop sessions
shipped real, version-bumped code — PWA `1.51.3862-hdr-type-ctrl` → `1.51.4046-company-retry`
(app.js +29 / app.src.js +1079 lines), access-relay +110, docx-worker +78 (HDR-TYPE-CONTROLS,
APPLIST + JobTracker inline company/role edit, CL-OPENING hydrate/gen, GEN-COMPANY-MISSING-RETRY,
BRANDV2-FOLLOW-APP). All of it is committed + version-bumped + desktop-verified. So this run is a
**verify + attest + reconcile** of the CURRENT main (post those changes): full standing-probe sweep
green, live worker + PWA attestation matching in-repo source, and the two stalest genuinely-open
register rows refreshed. **No new finding filed. No code merged to main.**

## Standing probes — ALL GREEN on main (`988bb0e6`, PWA `1.51.4046-company-retry`)
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
  scrolls, ≤2 style writes, 0 page errors); `diag-sidebar-promote-margin` **OK** (hold-under-margin
  true).
- **Panel button-audit** (`diag-panel-button-audit.mjs`, row 23): **211 buttons / 0 page errors /
  0 THROWS** (140 active, 14 skipped-dangerous, 13 ui-only, 44 not-visible/disabled). No DEAD
  candidates surfaced. Record: `PANEL_BUTTON_AUDIT_2026-07-30.*`.

## LIVE ATTEST — workers + PWA
Via `*.karp-gabriel-a.workers.dev` (the correct host family; DNS-reachable from the Actions runner):

| Surface | Live `/health` (or CACHE) | In-repo source | Match |
|---|---|---|---|
| PWA (`antcv.pages.dev` `sw.js` CACHE) | `antcv-1.51.4046-company-retry` | `pwa/sw.js` CACHE + `ANTCV_VERSION` seed + `TARGET_VERSION` all `1.51.4046-company-retry` | ✅ |
| cv-proxy (`cv-proxy.karp-gabriel-a.workers.dev`) | `3.8.4-brand-ink-match` | `VERSION` `3.8.4-brand-ink-match` | ✅ |
| demo-proxy | version not readable tonight (CF 1042) — worker live (root 404) | `3.8.4-brand-ink-match` | ⚠️ deferred / live |
| docx-worker (`docx-worker.karp-gabriel-a.workers.dev`) | `1.14.174-appline-edit` | `src/index.js` `VERSION` `1.14.174-appline-edit` | ✅ |
| access-relay | version not readable tonight (CF 1042) — worker live (root 404) | marker `auth-37-cap-disposable-only` | ⚠️ deferred / live |

**access-relay + demo-proxy `/health` deferred (transient, NOT a regression).** Both `/health`
endpoints returned Cloudflare **error 1042** on retries tonight (same class as the 07-28 note — the
1042 is on the endpoint's **upstream-probe subrequest**, not the worker). Both workers are
demonstrably live: a `GET /` to each host returns a clean **404** (the worker executed and routed).
The version strings couldn't be read this run, but no regression signal — access-relay source is
now `auth-37-cap-disposable-only` (advanced from `auth-36` via committed desktop work) and its unit
suite is 128/128 here; demo-proxy source is `3.8.4-brand-ink-match` (unchanged). So the version
attest for these two is owed to a run where their `/health` upstream probe resolves; the deployed
workers are up.

**Conclusion: no worker drift, no PWA version regression.** (Host note for future sweeps: cv-proxy
and docx-worker attest at `cv-proxy.*` / `docx-worker.*`; access-relay + demo-proxy `/health` need
their upstream probe reachable — root `/` 404 confirms the worker is up when `/health` 1042s.)

## Code delta since the 07-28 base (`65569043`) — production surface ADVANCED (all committed/verified)
`git diff --stat 65569043..HEAD` over `pwa/app.js`, `pwa/app.src.js`, `workers/**`, `.github/`:
`pwa/app.js` +29 / `pwa/app.src.js` +1079, `workers/access-relay/src/index.js` +110,
`workers/docx-worker/src/index.js` +78 + CHANGELOG + several docx render-diag fixtures. These are
the desktop-shipped fixes landed 07-28→07-30 (HDR-TYPE-CONTROLS `1.51.3862`, APPLIST/JT inline edit
`1.51.4003`/`1.51.4025`, CL-OPENING hydrate/gen, GEN-COMPANY-MISSING-RETRY `1.51.4046`,
BRANDV2-FOLLOW-APP, plus docx-worker `1.14.174-appline-edit`). Every one is version-bumped and
covered by the green suites above. Current main verified fully green — no regression from the churn.

## Register reconcile / staleness sweep (E1)
The two stalest genuinely-open rows carrying a `verified:` date were **1** and **3** (both
2026-07-27; the 2026-07-07 at row 9 is CLOSED):
- **Row 1 — Quick-gen / CV 3-page convergence** (render/owner-gated): no code addressing
  page-count convergence has landed; copenhagen-storm + settings-panels + button-audit +
  sidebar-stable/promote-margin + docx render V&V 50/50 all green → no regression signal. Genuinely
  open. `verified:` advanced 2026-07-27 → 2026-07-30.
- **Row 3 — Floating spine** (flag default-OFF): gate re-verified against current code — docx-worker
  `index.js:24668` `floatSpine: payload.float_spine === true || style.floatSpine === true`;
  docx-client `index.js:1253` gated on `localStorage.getItem('antcv:float-spine') === '1'`. Line
  refs drifted from the prior sweep, gate logic intact, default-OFF. `verified:` → 2026-07-30.
- **Rows 11 / 17 / 23** — re-verified green tonight via the diags above (refreshed 07-26/07-28; held).
- **Row 52 (GROUP-EMPTY-HIDE-001)** — refreshed 07-28; not re-dated (2 days old, rotated behind
  rows 1/3). Its guard is in the green suite.

## Owed (cannot be done in CI)
- **access-relay + demo-proxy `/health` version attest** — deferred tonight (CF 1042 on the
  endpoints' upstream probe; both workers confirmed live via root 404). Owed to a run where the
  `/health` upstream probe resolves (a desktop run, or a later CI run when it recovers).
- **Post-deploy live-verify owed to a desktop run** — this CI run shipped **no PWA change** (so
  nothing new is owed FROM tonight), but the 07-28→07-30 desktop ships accumulate a live-verify
  carry-forward on the deployed `1.51.4046-company-retry` build: HDR-TYPE-CONTROLS panel controls
  reach preview+export, APPLIST/JT inline company/role edit persists, CL-OPENING never blank,
  GEN-COMPANY-MISSING-RETRY on an empty-company JD. (Most were already live-verified by their own
  desktop sessions per the register — this is the standing CI reminder, not a new gap.)
- **DIAG-SALMON-EMPTY-REGION-STALE-001 repair** — still OPEN, render-capable/desktop only (07-26
  deep-diag: headless harness can't paginate; needs the in-app Preview pane). Not in CI /
  `run-tests.mjs` → gates nothing. Not re-picked.
- **Worker deploys:** `ALLOW_DEPLOY=false` → none attempted, none owed.
- **Owner/render/live-gated open rows** (rows 1/3/25/26/28/29/31/34/40–61/66/92–97, etc.): none
  newly actionable from CI — all need a signed-in gen, a 2nd physical device, live models, or a
  real render/export. No implemented-but-still-open row found.

## Register coverage this run
- **Rows 1 / 3** — invariants re-verified against current code; `verified:` → 2026-07-30.
- **Rows 11 / 17 / 23** — diags re-run green; held.
- **access-relay + demo-proxy attest** — deferred (transient 1042; both workers live; sources
  covered by green suites) — noted, not filed as a bug.
- **Worker + PWA live attest** — recorded; no drift.
- All other open rows — owner-gated / need a 2nd physical device / live models / a real foreground
  gen → none newly actionable from CI.

No code merged to `main`: this run pushes only docs/registers (this report, the button-audit
record, the OPEN_REGISTER / ACTIVE_BUGS edits). No `app.js` / `app.src.js` / worker / workflow
change reached main (current surface fully green; no new finding).
</content>
</invoke>
