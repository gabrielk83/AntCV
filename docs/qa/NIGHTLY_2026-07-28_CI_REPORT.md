# AntCV nightly — 2026-07-28 (CI / GitHub Actions, unattended, Opus 4.8)

Substrate: GitHub Actions on `gabrielk83/AntCV`. No in-app Browser pane. `ALLOW_DEPLOY=false`
(no worker deploys). Headless Playwright available after `npx playwright install chromium`.
**SYNC FIRST clean:** `git fetch && pull --rebase origin main` → already up to date, base HEAD
`65569043`. Main in sync throughout; no shift claim (no versioned PWA change shipped — see Headline).

## Headline

No clean node-verifiable **bug-fix** was genuinely actionable tonight — the whole CI test surface
is green and every open register row is render-gated / owner-gated / needs-live-models /
needs-2nd-device / content-density. Since the 2026-07-26 CI base (`961961c2`) the only commits on
main are docs/registers, the `deploy.yml` CI-wiring change, and the **docx render-diag test
fixtures** (DOCX-DIAG-STALE-OR-REGRESSED-001 → 48/48, wired into CI). **No `app.js` / `app.src.js`
/ worker-`src` change reached main** → the production surface is byte-identical to the last two CI
runs. So this is a **verify + attest + reconcile** run: full standing-probe sweep green (incl. the
CI-wired docx render V&V), live worker + PWA attestation, and the stalest genuinely-open register
row refreshed. **No new finding filed.**

## Standing probes — ALL GREEN on main (`65569043`, PWA `1.51.3803-word-sheet`)
- **PWA suite:** `node scripts/run-tests.mjs pwa` → **1482/1482 pass**, 0 fail (~6s).
- **app.js integrity:** head `(()=>{window`, **0** `"use strict"` — minified-sacred intact.
- **boot-smoke:** `glDemo=function, errors=0` → OK (after `npx playwright install chromium`).
- **Access-relay unit tests:** **128/128** (`node --test workers/access-relay/tests/*.test.mjs`).
- **Demo-proxy unit tests:** **33/33**.
- **Model-table freshness pins:** **5/5** demo-proxy + **5/5** proxy — no silent pricing drift.
- **docx-worker `.test.mjs` suite:** **32/32** (`node --test workers/docx-worker/test/*.test.mjs`).
- **docx render V&V** (`node scripts/run-docx-diags.mjs`): **48/48** — the DOCX-DIAG-STALE-OR-
  REGRESSED-001 fix (07-26 desktop) holds on live main; the CI-wired gate is green.

## Render-gated diags re-run (Playwright headless) — ALL GREEN / no regression
- **Copenhagen overflow-storm** (`diag-copenhagen-overflow-storm.mjs`): band ON **2 writes / 30px
  drift (bounded)**, band OFF 1 write / 0px → **DIAG PASS**. The CPH-STORM fix holds on live main.
- **Settings-panels probe** (`diag-settings-panels-probe.mjs`, register row 17): **DIAG PASS**
  (Personal/Account/Layout each 0 mut/6s, rootFound=true, 0 page errors).
- **Sidebar hold + stability** (row 11): `diag-sidebar-promote-margin` **OK** (hold-under-margin
  true); `diag-sidebar-stable` **OK** (width/height stable across 12 scrolls, ≤2 style writes, 0
  page errors).
- **Panel button-audit** (`diag-panel-button-audit.mjs`, row 23): **189 buttons / 0 page errors /
  0 THROWS** (117 active, 13 skipped-dangerous, 13 ui-only, 46 not-visible/disabled). No DEAD
  candidates surfaced. Record: `PANEL_BUTTON_AUDIT_2026-07-28.*`.

## LIVE ATTEST — workers + PWA
Via `*.karp-gabriel-a.workers.dev` (the correct host family; DNS-reachable from the Actions runner):

| Surface | Live `/health` (or CACHE) | In-repo source | Match |
|---|---|---|---|
| PWA (`antcv.pages.dev` `sw.js` CACHE) | `antcv-1.51.3803-word-sheet` | `pwa/sw.js` CACHE + `ANTCV_VERSION` seed + `TARGET_VERSION` all `1.51.3803-word-sheet` | ✅ |
| cv-proxy (`cv-proxy.karp-gabriel-a.workers.dev`) | `3.8.4-brand-ink-match` | `VERSION` `3.8.4-brand-ink-match` | ✅ |
| demo-proxy | `3.8.4-brand-ink-match` (shares codebase) | `3.8.4-brand-ink-match` | ✅ |
| docx-worker (`docx-worker.karp-gabriel-a.workers.dev`) | `1.14.171-spec-photo` | `src/index.js` `VERSION` `1.14.171-spec-photo` | ✅ |
| access-relay | version-string **not readable tonight** — see below | `RELAY_VERSION` `auth-36-jd-cross-app-guard` (unchanged since 07-24) | ⚠️ deferred |

**access-relay attest deferred (transient, NOT a regression).** The relay `/health` (and
`/api/health`) returned Cloudflare **error 1042** on 3 retries tonight. The 1042 is on the
endpoint's **upstream-probe subrequest** (relay `/health` "probes upstream to report real provider
key state", `src/index.js:12`), not the worker itself: **the worker is demonstrably live** — a
`GET /` to the same host returns a clean **404** (the worker executed and routed). Because
`/health` is the version-reporting endpoint, the running version string couldn't be read this run.
No regression signal: **the access-relay source is unchanged on main since 07-24** (`auth-36-jd-
cross-app-guard`), and no worker-`src` reached main since the 07-26 base. So the relay version
attest is owed to a run where its `/health` upstream probe is reachable; the deployed relay is up.

**Conclusion: no worker drift, no PWA version regression.** (Host note for future sweeps: cv-proxy
and docx-worker attest at `cv-proxy.*` / `docx-worker.*`, NOT `antcv-cv-proxy.*` / `antcv-docx-*.*`.
The relay version attest needs its `/health` upstream probe reachable — root `/` 404 confirms the
worker is up when `/health` 1042s.)

## Code delta since the 07-26 base (`961961c2`) — production surface unchanged
`git diff --stat 961961c2..HEAD` over `pwa/app.js`, `pwa/app.src.js`, `workers/**`, `.github/`:
only **docx-worker test fixtures** (the 6 render diags fixed 07-26) and **`.github/workflows/
deploy.yml`** (CI-wiring). No production `app.js` / `app.src.js` / worker-`src` changed →
production is byte-identical to the last two CI runs.

## Prior-run owed items — status confirmed
- **DOCX-DIAG-STALE-OR-REGRESSED-001** (07-26 desktop): **RESOLVED / shipped** — 48/48 here,
  `run-docx-diags.mjs` is a CI gate in the docx step of `deploy.yml`. No re-pick.
- **CI-COVERAGE-GAP-RELAY-DEMOPROXY / PWA-FULLTREE / DOCX-TEST-INFRA-BATCH / DOCX-SMOKE-SUITE-DEAD**
  (07-25/26): **DONE / shipped** — access-relay + demo-proxy suites, full `pwa/` tree, and the docx
  `.test.mjs` + render V&V all wired into CI and green here.

## Register reconcile / staleness sweep (E1)
Rows 1 + 3 (page-convergence / floating-spine) were refreshed to 2026-07-27 by last night's CI
sweep and have no code change since (all render/salmon/sidebar diags green → no regression); held.
The next stalest genuinely-open row carrying a `verified:` date was **row 52** (2026-07-07):
- **Row 52 — GROUP-EMPTY-HIDE-001** (SHIPPED `1.51.194`): invariant re-verified against current
  code — the look-ahead helpers are still present in both bundles + the export path
  (`__grpHasChild` ×3 in `app.src.js`, mirror `__gc` in `app.js`, `renderRichBlock` group look-ahead
  ×7 in `workers/docx-worker/src/index.js`) and the guard `group-empty-hide.test.mjs` is **29/29**.
  Holds. `verified:` advanced 2026-07-07 → 2026-07-28.
- **Rows 11 / 17 / 23** — re-verified green tonight via the diags above (refreshed 07-27; held).
- **Rows 35 / 36 / 37 / 47** — guards are inside the green `1482/1482` suite (no regression);
  last refreshed 07-25, not re-dated this run (only 3 days old, rotated behind row 52).

## Owed (cannot be done in CI)
- **access-relay `/health` version attest** — deferred tonight (CF 1042 on the endpoint's upstream
  probe; worker confirmed live via root 404; source unchanged since `auth-36`). Owed to a run where
  the relay `/health` upstream probe resolves (a desktop run, or a later CI run when it recovers).
- **DIAG-SALMON-EMPTY-REGION-STALE-001 repair** — still OPEN, render-capable/desktop only (07-26
  deep-diag: headless harness can't paginate; needs the in-app Preview pane). Not in CI /
  `run-tests.mjs` → gates nothing. Not re-picked.
- **Post-deploy live-verify** — none owed from this run: **no PWA change shipped** (verify-only).
  Carry-forward for a desktop run: the optional live-verify of PREVIEW-SHEET-WORD-HEIGHT-001 +
  SALMON-BREAK-SITE-001 + WHY-JOINED-SENTENCE-001 on the deployed `1.51.3803` build (owed since
  07-26; unchanged since).
- **Worker deploys:** `ALLOW_DEPLOY=false` → none attempted, none owed.
- **Owner/render/live-gated open rows** (rows 1/3/25/26/28/29/31/34/40–61/66/92–97, etc.): none
  newly actionable from CI — all need a signed-in gen, a 2nd physical device, live models, or a
  real render/export. No implemented-but-still-open row found.

## Register coverage this run
- **Row 52** — invariant re-verified against current code; `verified:` → 2026-07-28.
- **Rows 1 / 3** — held at 2026-07-27 (no code change; no regression signal).
- **Rows 11 / 17 / 23** — diags re-run green; held.
- **access-relay attest** — deferred (transient 1042; worker live; source unchanged) — noted, not
  filed as a bug.
- **Worker + PWA live attest** — recorded; no drift.
- All other open rows — owner-gated / need a 2nd physical device / live models / a real foreground
  gen → none newly actionable from CI.

No code merged to `main`: this run pushes only docs/registers (this report, the button-audit
record, the OPEN_REGISTER / ACTIVE_BUGS edits). No `app.js` / `app.src.js` / worker / workflow
change reached main (surface fully green; no new finding).
</content>
