# AntCV nightly — 2026-07-29 (CI / GitHub Actions, unattended, Opus 4.8)

Substrate: GitHub Actions on `gabrielk83/AntCV`. No in-app Browser pane. `ALLOW_DEPLOY=false`
(no worker deploys). Headless Playwright available after `npx playwright install chromium`.
**SYNC FIRST clean:** `git fetch && pull --rebase origin main` → already up to date, base HEAD
`783af806`. Preflight `WORKSPACE CLEAN`. Main in sync throughout; no shift claim (no versioned
PWA change shipped — see Headline).

## Headline

No clean node-verifiable **bug-fix** was genuinely actionable tonight — the whole CI test surface
is green and every open register row is render-gated / owner-gated / needs-live-models /
needs-2nd-device / content-density. Since the 2026-07-28 CI run (`783af806`) the ONLY commit on
main is that run's own report/register push — **no `app.js` / `app.src.js` / worker-`src` change
reached main**, so the production surface is byte-identical to the last three CI runs. This is a
**verify + attest + reconcile** run: full standing-probe sweep green (incl. the CI-wired docx
render V&V), live worker + PWA attestation, and the three stalest genuinely-open register rows
(35/36/37) re-verified against current code + refreshed. **No new finding filed** (the recurring
relay `/health` 1042 is an already-filed known transient — see below).

## Standing probes — ALL GREEN on main (`783af806`, PWA `1.51.3803-word-sheet`)
- **PWA suite:** `node scripts/run-tests.mjs pwa` → **1482/1482 pass**, 0 fail (~6s).
- **app.js integrity:** head `(()=>{window`, **0** `"use strict"` — minified-sacred intact.
- **boot-smoke:** `glDemo=function, errors=0` → OK (after `npx playwright install chromium`).
- **Access-relay unit tests:** **128/128** (`node --test workers/access-relay/tests/*.test.mjs`).
- **Demo-proxy unit tests:** **33/33**.
- **Model-table freshness pins:** **5/5** proxy + **5/5** demo-proxy — no silent pricing drift.
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
- **Panel button-audit** (`diag-panel-button-audit.mjs`, row 23): **191 buttons / 0 page errors /
  0 THROWS** (121 active, 13 skipped-dangerous, 13 ui-only, 44 not-visible/disabled). No DEAD
  candidates surfaced. Record: `PANEL_BUTTON_AUDIT_2026-07-29.{json,md}`.

## LIVE ATTEST — workers + PWA
Via `*.karp-gabriel-a.workers.dev` (the correct host family; DNS-reachable from the Actions runner):

| Surface | Live `/health` (or CACHE) | In-repo source | Match |
|---|---|---|---|
| PWA (`antcv.pages.dev` `sw.js` CACHE) | `antcv-1.51.3803-word-sheet` | `pwa/sw.js` CACHE + `ANTCV_VERSION` seed + `TARGET_VERSION` all `1.51.3803-word-sheet` | ✅ |
| cv-proxy (`cv-proxy.karp-gabriel-a.workers.dev`) | `3.8.4-brand-ink-match` | `VERSION` `3.8.4-brand-ink-match` | ✅ |
| demo-proxy | `3.8.4-brand-ink-match` (shares codebase) | `3.8.4-brand-ink-match` | ✅ |
| docx-worker (`docx-worker.karp-gabriel-a.workers.dev`) | `1.14.171-spec-photo` | `src/index.js` `VERSION` `1.14.171-spec-photo` | ✅ |
| access-relay | version-string **not readable tonight** — CF 1042 on `/health` (see below) | `RELAY_VERSION` `auth-36-jd-cross-app-guard` (unchanged since 07-24) | ⚠️ deferred |

**access-relay attest deferred (transient, NOT a regression) — 2nd consecutive night.** The relay
`/health` returned Cloudflare **error 1042** on retry, as it did on 07-28. The 1042 is on the
endpoint's **upstream-probe subrequest** (`/health` "probes upstream to report real provider key
state", `src/index.js:12`), not the worker itself: a `GET /` to the same host returns a clean
**404** (the worker executed and routed → it is live). Escalation threshold is NOT met — the filed
condition (RELAY-HEALTH-1042-ATTEST-DEFER-001) is *`/health` 1042 AND `GET /` no longer 404*; the
root 404 confirms the worker is up. No regression signal: the access-relay source is unchanged on
main since 07-24 (`auth-36-jd-cross-app-guard`), and no worker-`src` reached main since the 07-26
base. So the live version string is owed to a run where the relay `/health` upstream probe is
reachable; the deployed relay is up. Observation updated in `ACTIVE_BUGS.md`.

**Conclusion: no worker drift, no PWA version regression.** (Host note for future sweeps: cv-proxy
and docx-worker attest at `cv-proxy.*` / `docx-worker.*`, NOT `antcv-cv-proxy.*` / `antcv-docx-*.*`.
The relay version attest needs its `/health` upstream probe reachable — root `/` 404 confirms the
worker is up when `/health` 1042s.)

## Code delta since the 07-28 run (`783af806`) — production surface unchanged
The only commit on main since the last CI run is that run's own docs/register push. `git diff`
over `pwa/app.js`, `pwa/app.src.js`, `workers/**`, `.github/` since the last code change (07-26)
shows no production `app.js` / `app.src.js` / worker-`src` change → production is byte-identical
to the last three CI runs.

## Register reconcile / staleness sweep (E1) — the three stalest OPEN dated rows refreshed
Rows 1/3 were refreshed 07-27 (held 07-28, 2 days old); row 52 refreshed 07-28. The stalest
genuinely-open rows carrying a `verified:` date were **35/36/37** (2026-07-25). All three are
CLOSE-WITH-EVIDENCE (code, guarded by tests); re-verified against current code tonight:
- **Row 35 — OVERLAY-EARLY-HALT-001** (shipped 1.51.41): `__antcvGenCost` heartbeat gate present
  in app.js (×4) + app.src.js (×10); `overlay-watchdog-heartbeat.test.mjs` **6/6** green. Held
  code-closed; regen-confirm still owner-gated (one live 3–6 min regen). `verified:` 07-25 → 07-29.
- **Row 36 — GEN-CORECOMP-BROAD-001** (shipped 1.51.41): `unsolicited-corecomp-broad.test.mjs`
  **7/7** green — broad rule inside the `__neutralCo` block in both bundles (src ×5; app.js under
  its minified name, validated by the both-bundle guard test). `verified:` 07-25 → 07-29.
- **Row 37 — FOCUS-LABEL-EO-001** (shipped 1.51.42/43): `_canon` EO-label canonicaliser present in
  `antcv-core-comp-compress.js` (index.html `?v=1.51.43` confirmed); `core-comp-compress-eo.test.mjs`
  **14/14** green, name-guarded + idempotent. `verified:` 07-25 → 07-29.
- **Rows 11 / 17 / 23** — re-verified green tonight via the diags above (refreshed 07-27/28; held).

## Prior-run owed items — status confirmed
- **RELAY-HEALTH-1042-ATTEST-DEFER-001** (07-28): recurred identically tonight (2nd night). Worker
  live (root 404), source pinned (`auth-36`) — still below escalation threshold. Observation
  updated, not re-filed as a new bug.
- **DOCX-DIAG-STALE-OR-REGRESSED-001** (07-26 desktop): **RESOLVED / shipped** — 48/48 here,
  `run-docx-diags.mjs` is a CI gate in the docx step of `deploy.yml`. No re-pick.
- **CI-COVERAGE-GAP-RELAY-DEMOPROXY / PWA-FULLTREE / DOCX-TEST-INFRA-BATCH / DOCX-SMOKE-SUITE-DEAD**
  (07-25/26): **DONE / shipped** — all wired into CI and green here.

## Owed (cannot be done in CI)
- **access-relay `/health` version attest** — deferred (CF 1042 on the endpoint's upstream probe;
  worker confirmed live via root 404; source unchanged since `auth-36`). Owed to a run where the
  relay `/health` upstream probe resolves (a desktop run, or a later CI run when it recovers).
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
- **Rows 35 / 36 / 37** — guard tests re-run green against current code; `verified:` → 2026-07-29.
- **Rows 1 / 3** — held (refreshed 07-27; no code change; no regression signal).
- **Row 52** — held (refreshed 07-28; no code change).
- **Rows 11 / 17 / 23** — diags re-run green; held.
- **access-relay attest** — deferred (transient 1042, 2nd night; worker live; source unchanged) —
  observation updated in `ACTIVE_BUGS.md`, not filed as a new bug.
- **Worker + PWA live attest** — recorded; no drift.
- All other open rows — owner-gated / need a 2nd physical device / live models / a real foreground
  gen → none newly actionable from CI.

No code merged to `main`: this run pushes only docs/registers (this report, the button-audit
record, the OPEN_REGISTER / ACTIVE_BUGS edits). No `app.js` / `app.src.js` / worker / workflow
change reached main (surface fully green; no new finding).
