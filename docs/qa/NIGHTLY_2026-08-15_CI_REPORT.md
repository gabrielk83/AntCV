# AntCV nightly — 2026-08-15 (CI / GitHub Actions, unattended, Opus 4.8)

Substrate: GitHub Actions on `gabrielk83/AntCV`. No in-app Browser pane. `ALLOW_DEPLOY=false`
(and CI-CF-TOKEN-EXPIRED-001 still stands — even with `ALLOW_DEPLOY` the CF deploy token is dead
until the owner rotates it). **SYNC FIRST clean:** `git fetch && pull --rebase origin main` →
already up to date, base HEAD `ab792906` (the 08-14 demand-seed register + session-log commit).
Working tree clean throughout. No force-push. This run is docs-only → no shift claim needed.

## Headline

**Verify + attest + reconcile of current `main`. No code shipped, no PR, nothing owed live.**
One real routine landed since the last CI report: the **demand-seed weekly data refresh** (PR #359),
which bumped PWA `1.51.4086` → `1.51.4126` with a complete + correct cache-bust quintet. That change
is data-only (cluster-demand model) — **no page-convergence / render / logic change**. All standing
probes green, all five live surfaces match repo source, all render-gated Playwright diags re-run
green (chromium installed this run). This run pushes only this report, the OPEN_REGISTER edits, and
today's panel-button-audit artifacts.

## Code delta since the 08-14 CI report (`470700f8` → HEAD `ab792906`)
**Demand-seed weekly data refresh only** (PR #359, merged 08-14 evening). `git diff --stat` over
`pwa/ workers/ .github/`:
- `pwa/antcv-cluster-demand.js` — 20-most-demanded-skills seed data refresh (CLUSTER-QUAL-001).
- Cache-bust quintet for that change: `pwa/index.html` (cluster-demand `?v` + version-override `?v`),
  `pwa/sw.js` CACHE, `pwa/antcv-version-override.js` TARGET_VERSION `4086→4126` + STALE_VERSIONS
  (previous `4086` appended, NOT the new one — invariant honoured).
- **Verified complete + correct:** `node scripts/check-cache-bust.mjs --range 470700f8..HEAD` →
  `OK — all 2 changed asset(s) got a ?v bump`. `app.js?v` seed correctly left at `1.51.4046`
  (app.js unchanged; SEED-VS-TARGET-VERSION-NONBUG-001 — seed tracks `app.js?v`, not TARGET).
- **No app.js / app.src.js / worker / workflow change.** No PR owed from this run.

## Standing probes — ALL GREEN on `main` (`ab792906`, PWA live `1.51.4126-demand-seed-refresh`)
- **PWA suite:** `node scripts/run-tests.mjs pwa` → **1570/1570 pass**, 0 fail.
- **Full-repo suite:** `node scripts/run-tests.mjs` → **1893/1893 pass**, 0 fail. Flat vs 08-14.
- **app.js integrity:** head `(()=>{`, **0** `"use strict"`, `node --check` OK, `startsWith("(()=>{")`
  true; `boot-smoke` `glDemo=function, errors=0` — minified-sacred intact.
- **docx-worker `test/*.test.mjs` suite:** **37/37**.
- **docx render V&V** (`node scripts/run-docx-diags.mjs`): **50/50** on bundled worker source.

## Render-gated Playwright diags — RE-RUN green
Chromium was not pre-installed; `npx playwright install chromium` + `install-deps` succeeded, so the
login-gated / browser-driven diags ran headless against the demo/template boot:
- **copenhagen-overflow-storm** — DIAG PASS. ON (default) 2 writes / 0px usablePx-drift / 0 err;
  OFF (`antcv:copenhagen-v2=0`) 1 write / 0px / 0 errors. Preview converges both ways.
- **settings-panels-probe** — DIAG PASS. Layout 0 mutations/6s, `rootFound=true`, 0 page errors.
- **panel-button-audit** — **213 buttons, 0 page errors**, 139 active, 14 skipped-dangerous,
  14 ui-only, 46 not-visible-or-disabled. Artifacts `docs/qa/PANEL_BUTTON_AUDIT_2026-08-15.{json,md}`.
  (+4 buttons / +5 active vs 08-14's 209/134 — first-paint timing variance; 0 page errors is the attest.)
- **sidebar-stable** — OK. width/height stable + height converged after 12 scrolls (0 style writes),
  0 page errors.
- **sidebar-promote-margin** — OK. hold-under-margin true (sidebar holds page 3 across a one-row
  removal AND a whole-group removal).

## LIVE ATTEST — workers + PWA (all five READABLE; every version = in-repo source)

| Surface | Live `/health` (or CACHE) | In-repo source | Match |
|---|---|---|---|
| PWA (`antcv.pages.dev` `sw.js` CACHE) | `antcv-1.51.4126-demand-seed-refresh` | `sw.js` CACHE `1.51.4126-demand-seed-refresh` | ✅ |
| cv-proxy (`cv-proxy.karp-gabriel-a.workers.dev`) | `3.8.4-brand-ink-match` | `workers/proxy` `VERSION` `3.8.4-brand-ink-match` | ✅ |
| docx-worker (`docx-worker.karp-gabriel-a.workers.dev`) | `1.14.174-appline-edit` | `src/index.js` `VERSION` `1.14.174-appline-edit` | ✅ |
| access-relay (`antcv-access-relay.karp-gabriel-a.workers.dev`) | `auth-37-cap-disposable-only` | `RELAY_VERSION` `auth-37-cap-disposable-only` | ✅ |
| demo-proxy (`antcv-demo-proxy.karp-gabriel-a.workers.dev`) | `3.8.4-brand-ink-match` | `workers/demo-proxy` `VERSION` `3.8.4-brand-ink-match` | ✅ |

**PWA live advanced `4086 → 4126`** — the demand-seed refresh deployed cleanly via PWA auto-deploy,
now serving in browsers; live CACHE == repo source. No drift on any surface. Carried cosmetic
(unchanged): `antcv-demo-proxy` `/health` still self-labels `"service":"cv-proxy"` (shared code;
version string authoritative) — needs a worker deploy, carried.

## Register reconcile / staleness sweep (E1)
Code surface byte-identical for pagination/render since 08-14 (only the demand-seed *data* refresh
landed); chromium availability let me genuinely re-verify the render-gated rows, and I re-verified
the code-checkable leg of the stalest genuinely-open isolation row:
- **Row 1** (quick-gen / 3-page convergence) — verified: 2026-08-15; all render-gated diags green;
  demand-seed delta is data-only, no page-convergence change.
- **Row 3** (floating spine) — verified: 2026-08-15; flag default-OFF re-confirmed against current
  source (docx-worker:24674 `floatSpine = payload.float_spine === true || style.floatSpine === true`;
  docx-client :1253 gated on `localStorage antcv:float-spine === '1'`); gate logic intact, no delta.
- **Row 11** (sidebar page-2/3 dance, CLOSED) — re-verified: 2026-08-15; sidebar-stable +
  sidebar-promote-margin both OK.
- **Row 17** (settings sweep-army, DONE 1.51.156) — re-verified: 2026-08-15; settings-panels-probe
  Layout 0 mut/6s, rootFound=true, 0 page errors, DIAG PASS.
- **Row 19** (JD-SCOPE-ISOLATION residuals, stalest genuinely-open row, `verified: 2026-07-03`) —
  **code leg re-verified: 2026-08-15**: `jd-scope-isolation.test.mjs` **11/11 green**,
  `shouldAdoptCloudPointer` present (4× across pwa sidecars), occ-2 guard behaviour string-locked
  (the `JD-SCOPE-OCC2-GUARD-001` comment marker lives only in `app.src.js` — stripped by
  minification in `app.js`, expected; the test locks the behaviour, not the comment). Remaining leg
  = **two-real-device test (owner)** — physical devices, not fakeable headlessly. Carried owner-gated.
- **Rows 23 / 35 / 36 / 37** — no code delta touching them; held, no churn to date-bump against.
- **CI-CF-TOKEN-EXPIRED-001** — still OPEN, owner action (rotate/re-scope the GitHub-Actions
  `CLOUDFLARE_API_TOKEN` so `deploy.yml` can authenticate — CF `Authentication error [code: 10000]`).
  Carried, not fixable from CI. This is why `ALLOW_DEPLOY` is moot for workers unattended.
- **LLM-TRAFFIC-GAP-2026-08 / RELAY-TUNE-COVERAGE-GAP-001 / ANTCV-TOKEN-EXPIRED-2026-08-14-001** —
  carried. No LLM call of any task since 2026-07-30 (now a **16-day gap**); owner must re-save
  `~/.antcv/token`. No fresh-gen content check is possible (spec rule 38) and the weekly cost-quality
  tune runs on its own dedicated routine, not this nightly.
- **SEED-VS-TARGET-VERSION-NONBUG-001** — reconfirmed live this run (seed `4046` == `app.js?v`, TARGET
  `4126`; invariant is seed == `app.js?v`, not seed == TARGET). Not a bug; not re-flagged.

## Owed (cannot be done in CI)
- **Worker deploys** — blocked by CI-CF-TOKEN-EXPIRED-001 AND `ALLOW_DEPLOY=false`; all four workers
  already match source → **nothing owed functionally**, only the token rotation for FUTURE deploys.
- **Post-deploy live-verify** — this CI run shipped **no PWA/worker change** → nothing owed FROM tonight.
  (The demand-seed refresh's own live-verify is discharged by the LIVE ATTEST above: PWA CACHE `4126`
  is live and == source.)
- **SO-003 / SO-004 (rows 40/41)** crash capture + **PERF-001 (row 45)** cloud-sync profiling +
  **GEN-LANGFAB-001** fresh-gen check — need a live signed-in generated-content session (and there is
  no fresh traffic to measure a content fix against per spec rule 38); not actionable unattended.
- **Salmon render rows** (DIAG-SALMON-EMPTY-REGION-STALE-001 / SALMON-MAIN-LENGTH-001) — need a real
  signed-in generated-content session (the render diags above run the demo/template boot only).
- **Band-A live A/B legs** (GEN-BACKGROUND real-mobile A/B + default flip, PTR-STALE-GUARD two-tab
  A/B, AUTOSAVE-NO-DOWNGRADE live PUT, two-real-device test) — need a real device / signed-in auth /
  2nd physical device; code all present+loaded+deployed (verified desktop 08-07), live legs carried.
- **Owner/render/live-gated open rows** (6/8/18/19-legC/20/22/25/26/27/28/29 etc.) + rows 35/36/37
  regen-confirm — need a signed-in gen, a 2nd physical device, live models, or a real render/export;
  none newly actionable from CI.

## Register coverage this run
- **Live attest (PWA + all four workers)** — all readable, all match source; no drift; PWA advanced
  `4086→4126` (demand-seed) and is live.
- **Standing probes** — PWA 1570/1570, full-repo 1893/1893, docx-worker 37/37, render V&V 50/50,
  app.js clean, boot-smoke OK.
- **Render-gated diags** — copenhagen-overflow-storm / settings-panels / button-audit / sidebar-stable
  / sidebar-promote-margin all green; date-bumped rows 1/3/11/17; **row 19 code leg re-verified**.
- **Demand-seed refresh cache-bust** — quintet verified complete + correct; cache-bust gate green.
- **CI-CF-TOKEN-EXPIRED-001** — carried OPEN (owner action). **LLM-TRAFFIC-GAP-2026-08** — carried
  (16-day gap, owner re-save `~/.antcv/token`). No NEW bug/task discovered this run.
- All other open rows — owner-gated / need a 2nd physical device / live models / a real foreground
  gen → none newly actionable from CI.

No `app.js` / `app.src.js` / worker / workflow change reached `main` this run. Pushes: this report,
the OPEN_REGISTER edits, and today's panel-button-audit artifacts.
</content>
</invoke>
