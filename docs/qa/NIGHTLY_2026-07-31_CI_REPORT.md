# AntCV nightly — 2026-07-31 (CI / GitHub Actions, unattended, Opus 4.8)

Substrate: GitHub Actions on `gabrielk83/AntCV`. No in-app Browser pane. `ALLOW_DEPLOY=false`
(no worker deploys). Headless Playwright available after `npx playwright install
chromium-headless-shell`. **SYNC FIRST clean:** `git fetch && pull --rebase origin main` → already
up to date, base HEAD `5f429ca6`. Main in sync throughout; no shift claim (no versioned PWA change
shipped — see Headline).

## Headline

No clean node-verifiable **bug-fix** was genuinely actionable tonight — the whole CI test surface
is green and every open register row is render-gated / owner-gated / needs-live-models /
needs-2nd-device / content-density. **No `app.js`/`app.src.js`/worker/workflow code delta since the
last CI base (`988bb0e6`):** the only commits since the 07-30 sweep are docs/registers — the
RELAY-COST-QUALITY-TUNE 2026-07-29 report (NO FLIP; phantom-window trap caught), its shift
claim/release, and the 07-30 CI sweep doc itself. So the production surface is **byte-identical to
the 07-30 sweep**. This run is a **verify + attest + reconcile** of the current main: full
standing-probe sweep green, live worker + PWA attestation matching in-repo source, and the two
stalest genuinely-open dated register rows refreshed. **No new finding filed. No code merged to
main.**

## Standing probes — ALL GREEN on main (`5f429ca6`, PWA `1.51.4046-company-retry`)
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
  true, holds page 3 across one-row + whole-group removal).
- **Panel button-audit** (`diag-panel-button-audit.mjs`, row 23): **209 buttons / 0 page errors /
  0 THROWS** (132 active, 14 skipped-dangerous, 17 ui-only, 46 not-visible/disabled). No DEAD
  candidates surfaced. Record: `PANEL_BUTTON_AUDIT_2026-07-31.*`.

## LIVE ATTEST — workers + PWA
Via `*.karp-gabriel-a.workers.dev` (the correct host family; DNS-reachable from the Actions runner):

| Surface | Live `/health` (or CACHE) | In-repo source | Match |
|---|---|---|---|
| PWA (`antcv.pages.dev` `sw.js` CACHE) | `antcv-1.51.4046-company-retry` | `pwa/sw.js` CACHE + `ANTCV_VERSION` seed + `TARGET_VERSION` all `1.51.4046-company-retry` | ✅ |
| cv-proxy (`cv-proxy.karp-gabriel-a.workers.dev`) | `3.8.4-brand-ink-match` | `VERSION` `3.8.4-brand-ink-match` | ✅ |
| docx-worker (`docx-worker.karp-gabriel-a.workers.dev`) | `1.14.174-appline-edit` | `src/index.js` `VERSION` `1.14.174-appline-edit` | ✅ |
| demo-proxy | `/health` unreadable tonight (CF 1042); worker live (root 404) | `3.8.4-brand-ink-match` | ⚠️ deferred / live |
| access-relay | `/health` unreadable tonight (CF 1042); worker live (root 404) | marker `auth-37-cap-disposable-only` | ⚠️ deferred / live |

**access-relay + demo-proxy `/health` deferred (transient, NOT a regression).** Both `/health`
endpoints returned Cloudflare **error 1042** on the endpoint's upstream-probe subrequest (same class
as the 07-28 / 07-30 notes), not the worker itself. Both workers are demonstrably live: a `GET /` to
each host returns a clean **404** (the worker executed and routed). The version strings couldn't be
read this run, but there is no regression signal — access-relay + demo-proxy source is unchanged on
main since 07-30 (`auth-37-cap-disposable-only` / `3.8.4-brand-ink-match`) and their unit suites are
128/128 + 33/33 here. Version attest for these two is owed to a run where the `/health` upstream
probe resolves; the deployed workers are up.

**Conclusion: no worker drift, no PWA version regression.**

## Code delta since the last CI base (`988bb0e6`) — NONE on code surfaces
`git diff --stat 988bb0e6..HEAD` over `pwa/app.js`, `pwa/app.src.js`, `workers/**`, `.github/`:
**empty**. Only docs/registers landed since the 07-30 sweep (relay cost-quality-tune 2026-07-29
report, its shift claim/release, the 07-30 CI sweep doc). Production surface byte-identical to
07-30. Current main verified fully green.

## Register reconcile / staleness sweep (E1)
Rows 1 + 3 were refreshed 2026-07-30 (last night's sweep). The next two stalest genuinely-open
dated rows tonight were **11** and **52**:
- **Row 11 — SIDEBAR-PAGE23-DANCE** (CLOSED/verified, headless-diag-backed, was 2026-07-26):
  re-verified against current code — `diag-sidebar-promote-margin` hold-under-margin true (holds
  page 3 across a one-row AND a whole-group removal); `diag-sidebar-stable` width/height stable
  across 12 scrolls, ≤2 style writes, 0 errors. No regression. `verified:` → 2026-07-31.
- **Row 52 — GROUP-EMPTY-HIDE-001** (SHIPPED 1.51.194, was 2026-07-28): invariant re-verified —
  `__grpHasChild`×3 in `app.src.js`, mirror `__gc`×1 in `app.js`, `renderRichBlock`×7 in
  docx-worker `index.js`; guard `pwa/test/unit/group-empty-hide.test.mjs` 29/29 green. Helpers
  intact both bundles + worker; no code change since. `verified:` → 2026-07-31.
- **Rows 1 / 3** — held 2026-07-30 (refreshed last night, no code change → no re-date, avoids churn).
- **Rows 17 / 23** — re-verified green tonight via the diags above (held).
- **Reconcile note:** the DETAILED rows 276-278 (rows 35/36/37 regen-confirm) still read
  "code-present 2026-07-05" while their **summary** twins at rows 195-197 carry the current
  "re-verified: 2026-07-29" — the summary is authoritative and current; the detailed twins are a
  stale second representation, not a real regression (a cleanup for a future doc-reconcile slot,
  filed here so it isn't re-discovered as a finding).

## Owed (cannot be done in CI)
- **access-relay + demo-proxy `/health` version attest** — deferred tonight (CF 1042 on the
  endpoints' upstream probe; both workers confirmed live via root 404). Owed to a run where the
  `/health` upstream probe resolves.
- **Post-deploy live-verify** — this CI run shipped **no PWA change** (nothing new owed FROM
  tonight). The 07-28→07-30 desktop ships (HDR-TYPE-CONTROLS, APPLIST/JT inline edit, CL-OPENING
  hydrate/gen, GEN-COMPANY-MISSING-RETRY) were already live-verified by their own desktop sessions
  per the register — standing CI reminder, not a new gap.
- **DIAG-SALMON-EMPTY-REGION-STALE-001 repair** — still OPEN, render-capable/desktop only (headless
  harness can't paginate; needs the in-app Preview pane). Not in CI / `run-tests.mjs` → gates
  nothing. Not re-picked.
- **Worker deploys:** `ALLOW_DEPLOY=false` → none attempted, none owed.
- **Owner/render/live-gated open rows** (rows 1/3/6/8/19/20/22/25/26/27/28/29 etc.): none newly
  actionable from CI — all need a signed-in gen, a 2nd physical device, live models, or a real
  render/export. No implemented-but-still-open row found.

## Register coverage this run
- **Rows 11 / 52** — invariants re-verified against current code; `verified:` → 2026-07-31.
- **Rows 1 / 3** — held 2026-07-30 (no code change).
- **Rows 17 / 23** — diags re-run green; held.
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
