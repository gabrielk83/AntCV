# AntCV nightly — 2026-07-31 (DESKTOP, render-capable, unattended, Opus 4.8)

Substrate: desktop clone with the in-app Browser pane (render + live-fetch capable), worktree
`elated-wilbur-b386b8`. First DESKTOP nightly after six straight CI sweeps (07-26→07-31) that could
only verify headlessly and kept deferring the live-attest + render legs. **SYNC FIRST clean:**
`git fetch && pull --rebase origin main` → fast-forwarded onto `9d8f755`; main in sync throughout.
Preflight: WORKSPACE CLEAN.

## Headline

No code change tonight — the whole node-verifiable surface is green and every genuinely-open
register row is render-owed / owner-gated / needs-live-models / needs-a-2nd-physical-device, and the
unattended login gate (Google OAuth / email OTP) blocks any signed-in render of the real CV. But
this run did the two things CI structurally could **not**, and closed a recurring false-deferral:

1. **Byte-level live deployment parity** (CI never byte-compared the deployed bundle).
2. **Full live worker attest — all four match source** — resolving the 4-run "access-relay +
   demo-proxy /health 1042, deferred as transient" note as a **wrong-hostname typo**, not a
   regression and not transient.
3. **Desktop-run render-gated diags** (rows 11/17/23) independently green on the desktop.

## Standing probes — GREEN
- **PWA suite:** `node scripts/run-tests.mjs pwa` → **1570/1570**, 0 fail (~5s).
- **app.js integrity:** head `(()=>{window`, **0** `"use strict"` — minified-sacred intact.

## Live deployment parity — BYTE-LEVEL (new this run)
Fetched the live bundles from `antcv.pages.dev`, normalized CRLF→LF (`tr -d '\r'`), `cmp` vs repo:

| Asset | Live `?v=` | Live bytes (norm) | Repo bytes (norm) | `cmp` |
|---|---|---|---|---|
| `app.js` | `1.51.4046-company-retry` | 1116979 | 1116979 | **IDENTICAL** |
| `antcv-react-islands.js` | `1.51.4045-cl-opening-mandatory` | 200324 | 200324 | **IDENTICAL** |

Deploy strips CRLF→LF (repo carries 165 CR bytes; live carries 0) — benign. Marker spot-check on
the live bundle: `__antcvTrkStep`×2 (HDR-TYPE-CONTROLS), `antcv:activeAppCompany`×3 + islands
`onCommitIdentity`×2 / `onEditCell`×2 (APPLIST/JT inline-edit) all byte-present → the 07-28→30
desktop ships are genuinely deployed, not merely assumed.

## Live worker attest — ALL FOUR MATCH SOURCE (recurring 1042 deferral RESOLVED)
The 07-28/30/31 CI sweeps curled `access-relay.*` / `demo-proxy.*` and got CF **error 1042**, then
deferred it as "transient upstream probe." **It is a wrong-hostname artifact.** Those two workers
are NAMED (per `wrangler.toml`) `antcv-access-relay` / `antcv-demo-proxy`, so their `*.workers.dev`
subdomain carries the `antcv-` prefix; the un-prefixed host hits a nonexistent/stale route → 1042
while the real worker is live (a `GET /` to the un-prefixed host returns a clean 404 = the edge
answered). cv-proxy / docx-worker have no prefix (their worker names match the bare host).

| Worker | Correct host | Live `/health` | In-repo source | Match |
|---|---|---|---|---|
| access-relay | `antcv-access-relay.karp-gabriel-a.workers.dev` | `auth-37-cap-disposable-only` | `RELAY_VERSION` `auth-37-cap-disposable-only` | ✅ |
| demo-proxy | `antcv-demo-proxy.karp-gabriel-a.workers.dev` | `3.8.4-brand-ink-match` | `VERSION` `3.8.4-brand-ink-match` | ✅ |
| cv-proxy | `cv-proxy.karp-gabriel-a.workers.dev` | `3.8.4-brand-ink-match` | `VERSION` `3.8.4-brand-ink-match` | ✅ |
| docx-worker | `docx-worker.karp-gabriel-a.workers.dev` | `1.14.174-appline-edit` | `src/index.js` `VERSION` `1.14.174-appline-edit` | ✅ |
| PWA | `antcv.pages.dev` `sw.js` CACHE | `1.51.4046-company-retry` | CACHE + `ANTCV_VERSION` seed + TARGET all `1.51.4046-company-retry` | ✅ |

**No worker drift, no PWA regression.** Memory `worker-health-attest-hostname` strengthened with the
per-worker prefix rule + "1042 = typo, never a regression signal." Minor cosmetic (not fixed —
worker deploy, low value): `antcv-demo-proxy` `/health` JSON self-reports `"service":"cv-proxy"`
(shared-code label; version string is authoritative).

## Render-gated diags re-run on the DESKTOP (Playwright) — ALL GREEN / no regression
- **Copenhagen overflow-storm** (`diag-copenhagen-overflow-storm.mjs`): band ON **2 writes / 30px
  (bounded)**, band OFF 1 write / 0px → **DIAG PASS**.
- **Settings-panels probe** (`diag-settings-panels-probe.mjs`, row 17): Personal/Account/Layout **0
  mut/6s**, rootFound=true, 0 page errors → **DIAG PASS**.
- **Sidebar stability** (row 11): `diag-sidebar-stable` **OK** (0 style writes across 12 scrolls,
  w/h stable); `diag-sidebar-promote-margin` **OK** (hold-under-margin true across one-row AND
  whole-group removal).
- **Panel button-audit** (`diag-panel-button-audit.mjs`, row 23): **211 buttons / 0 page errors /
  0 THROWS** (136 active, 14 skipped-dangerous, 13 ui-only, 48 not-visible/disabled). No DEAD
  candidates. Record: `PANEL_BUTTON_AUDIT_2026-07-31.*` (desktop re-run).

## Register reconcile / staleness sweep (E1)
Rows 11 + 52 were refreshed by the CI sweep earlier today (held 2026-07-31). The next stalest
genuinely-open dated rows were **1** and **3** (2026-07-30) — both re-verified against current code:
- **Row 1 — page convergence:** no page-count-convergence code change since; all desktop render
  diags green + live bundle byte-parity confirmed → no regression signal. `verified:` → 2026-07-31.
- **Row 3 — floating spine:** flag default-OFF re-confirmed — docx-worker:24668
  `floatSpine: payload.float_spine === true || …style.floatSpine === true`; docx-client:1253 gated
  on `localStorage antcv:float-spine === '1'` (line refs STABLE at 24668/1253). `verified:` →
  2026-07-31.
- Rows 17 / 23 — diags re-run green tonight (held).

## Coverage this run (every open row given a status word)
- **Live attest (all workers + PWA)** — done, all match source; recurring 1042 deferral RESOLVED.
- **Live bundle byte-parity** — done, app.js + islands identical to repo.
- **Rows 1 / 3** — invariants re-verified → advanced to 2026-07-31.
- **Rows 11 / 17 / 23 / 52** — diags/invariants green; held 2026-07-31.
- **Band B/C:** SO-003 (row 40) SHIPPED 1.51.138, GEN-LANGFAB (42) 1.51.136, CA-006 (43) 1.51.139,
  JD-ANALYSIS-PRINT (44) 1.51.137 — all shipped, no regression signal. **SO-004 (41)** still TO-DO —
  no headless repro; needs a real React #185 crash capture (live account). Not actionable unattended.
- **Band D:** GEN-MODELROLE (39) VERIFIED-LIVE; **PERF-001 (45)** PARTIAL — cloud-sync setTimeout leg
  needs an app.js profiling session (live). Not actionable unattended.
- **DIAG-SALMON-EMPTY-REGION-STALE-001 / SALMON-MAIN-LENGTH-001** — render-owed; need the in-app
  Preview pane with a loaded CV, which the unattended login gate blocks. Not re-picked.
- **Rows 6/8/19/20/22/24/25/26/27/28/29 + owner-review rows** — owner-gated / need live models / a
  2nd physical device / a real render-export. None newly actionable from an unattended desktop run.

## Owed / cannot be done unattended
- **Signed-in render verification** of the real CV/preview (salmon pagination, SO-004 crash repro) —
  blocked by the Google/OTP login gate; owed to an owner-present or credential-provisioned session.
- **PERF-001 cloud-sync profiling** and **SO-004 crash capture** — need a live signed-in session.
- **Worker deploys** — none owed (all four already match source).

No PWA / app.js / worker / workflow code merged: this run pushes only docs/registers (this report,
the button-audit record, OPEN_REGISTER + ACTIVE_BUGS edits). Surface fully green; no new bug filed.
