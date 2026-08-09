# AntCV nightly — 2026-08-09 (CI / GitHub Actions, unattended, Opus 4.8)

Substrate: GitHub Actions on `gabrielk83/AntCV`. No in-app Browser pane. `ALLOW_DEPLOY=false`
(and CI-CF-TOKEN-EXPIRED-001 still stands — even with `ALLOW_DEPLOY` the CF deploy token is dead
until the owner rotates it). **SYNC FIRST clean:** `git fetch && pull --rebase origin main` →
already up to date, base HEAD `5d329c4a` (the 08-08 CI-nightly report commit). Working tree clean
throughout. No force-push. This run is docs-only → no shift claim needed.

## Headline

**Verify + attest + reconcile of current `main`. No code shipped, no PR, nothing owed live.**
A quiet night: **nothing has landed since the 08-08 CI report** — HEAD is that report commit itself.
All standing probes green, all five live surfaces match repo source, all render-gated Playwright
diags re-run green (chromium installed this run). This run pushes only this report, the OPEN_REGISTER
edits, and today's panel-button-audit artifacts.

## Code delta since the 08-08 CI report (`5d329c4a` → HEAD)
**Empty.** HEAD == `5d329c4a` (the 08-08 CI report). `git diff --stat 5d329c4a..HEAD -- pwa/ workers/
.github/` = **empty**. No commit of any kind has landed since last night. No PR owed.

## Standing probes — ALL GREEN on main (`5d329c4a`, PWA live `1.51.4086-demand-seed-refresh`)
- **PWA suite:** `node scripts/run-tests.mjs pwa` → **1570/1570 pass**, 0 fail.
- **Full-repo suite:** `node scripts/run-tests.mjs` → **1893/1893 pass**, 0 fail. Flat vs 08-08.
- **app.js integrity:** head `(()=>{`, **0** `"use strict"`, `node --check` OK — minified-sacred intact.
- **docx-worker `test/*.test.mjs` suite:** **37/37**.
- **docx render V&V** (`node scripts/run-docx-diags.mjs`): **50/50** on bundled worker source.

## Render-gated Playwright diags — RE-RUN green
Chromium was not pre-installed; `npx playwright install chromium` succeeded, so the login-gated /
browser-driven diags ran headless against the demo/template boot:
- **copenhagen-overflow-storm** — PASS. ON (default) 2 writes / 0px usablePx-drift / 0 errors;
  OFF (`antcv:copenhagen-v2=0`) 1 write / 0px / 0 errors. Preview converges both ways.
- **settings-panels-probe** — DIAG PASS. Layout 0 mutations/6s, `rootFound=true`, 0 page errors.
- **panel-button-audit** — 212 buttons, **0 page errors**, 136 active, 14 skipped-dangerous,
  17 ui-only, 45 not-visible-or-disabled. Artifacts `docs/qa/PANEL_BUTTON_AUDIT_2026-08-09.{json,md}`.
- **sidebar-stable** — OK. width/height stable + converged after 12 scrolls, 0 style writes, 0 errors.
- **sidebar-promote-margin** — OK. hold-under-margin true (sidebar holds page 3 across one-row and
  whole-group removals).

## LIVE ATTEST — workers + PWA (all five READABLE; every version = in-repo source)

| Surface | Live `/health` (or CACHE) | In-repo source | Match |
|---|---|---|---|
| PWA (`antcv.pages.dev` `sw.js` CACHE) | `antcv-1.51.4086-demand-seed-refresh` | `sw.js` CACHE `1.51.4086-demand-seed-refresh` | ✅ |
| cv-proxy (`cv-proxy.karp-gabriel-a.workers.dev`) | `3.8.4-brand-ink-match` | `VERSION` `3.8.4-brand-ink-match` | ✅ |
| docx-worker (`docx-worker.karp-gabriel-a.workers.dev`) | `1.14.174-appline-edit` | `src/index.js` `VERSION` `1.14.174-appline-edit` | ✅ |
| access-relay (`antcv-access-relay.karp-gabriel-a.workers.dev`) | `auth-37-cap-disposable-only` | `RELAY_VERSION` `auth-37-cap-disposable-only` | ✅ |
| demo-proxy (`antcv-demo-proxy.karp-gabriel-a.workers.dev`) | `3.8.4-brand-ink-match` | `VERSION` `3.8.4-brand-ink-match` | ✅ |

No drift on any surface. Carried cosmetic (unchanged): `antcv-demo-proxy` `/health` still self-labels
`"service":"cv-proxy"` (shared code; version string authoritative) — needs a worker deploy, carried.

## Register reconcile / staleness sweep (E1)
Code surface byte-identical for pagination/render since 08-08 (no commit at all landed); chromium
availability let me genuinely re-verify the stalest render-gated rows instead of carrying them:
- **Row 1** (quick-gen / 3-page convergence) — verified: 2026-08-09; all render-gated diags green today.
- **Row 3** (floating spine) — verified: 2026-08-09; flag default-OFF re-confirmed against current
  source (docx-worker:24668 `floatSpine=payload.float_spine===true||style.floatSpine===true`,
  docx-client:1251/1253 gated on `localStorage antcv:float-spine==='1'`); gate logic intact.
- **Row 11** (sidebar page-2/3 dance, CLOSED) — re-verified: 2026-08-09; sidebar-stable +
  sidebar-promote-margin both OK.
- **Row 17** (settings sweep-army, DONE 1.51.156) — re-verified: 2026-08-09; settings-panels-probe
  Layout 0 mut/6s, rootFound=true, 0 page errors, DIAG PASS.
- **Rows 23 / 35 / 36 / 37** — no code delta touching them; held, no churn to date-bump against.
- **CI-CF-TOKEN-EXPIRED-001** — still OPEN, owner action (rotate/re-scope the GitHub-Actions
  `CLOUDFLARE_API_TOKEN` so `deploy.yml` can authenticate — CF `Authentication error [code: 10000]`).
  Carried, not fixable from CI. This is why `ALLOW_DEPLOY` is moot for workers unattended.
- **LLM-TRAFFIC-GAP-2026-08 / RELAY-TUNE-COVERAGE-GAP-001** — carried. The desktop 08-07 run found
  no LLM call of any task since 2026-07-30 (now a 9+ day gap); no fresh-gen content check is possible
  and no weekly tune is due (last 08-06 NO FLIP, next ~08-13).
- **SEED-VS-TARGET-VERSION-NONBUG-001** — unchanged (seed == `app.js?v`, not TARGET); not re-flagged.

## Owed (cannot be done in CI)
- **Worker deploys** — blocked by CI-CF-TOKEN-EXPIRED-001 AND `ALLOW_DEPLOY=false`; all four workers
  already match source → **nothing owed functionally**, only the token rotation for FUTURE deploys.
- **Post-deploy live-verify** — this CI run shipped **no PWA/worker change** → nothing owed FROM tonight.
- **SO-003 / SO-004 (rows 40/41)** crash capture + **PERF-001 (row 45)** cloud-sync profiling +
  **GEN-LANGFAB-001** fresh-gen check — need a live signed-in generated-content session (and there is
  no fresh traffic to measure a content fix against per spec rule 38); not actionable unattended.
- **Salmon render rows** (DIAG-SALMON-EMPTY-REGION-STALE-001 / SALMON-MAIN-LENGTH-001) — need a real
  signed-in generated-content session (the render diags above run the demo/template boot only);
  not re-picked.
- **Band-A live A/B legs** (GEN-BACKGROUND real-mobile A/B + default flip, PTR-STALE-GUARD two-tab
  A/B, AUTOSAVE-NO-DOWNGRADE live PUT, two-real-device test) — need a real device / signed-in auth /
  2nd physical device; code all present+loaded+deployed (verified desktop 08-07), live legs carried.
- **Owner/render/live-gated open rows** (6/8/19/20/22/25/26/27/28/29 etc.) + rows 35/36/37
  regen-confirm — need a signed-in gen, a 2nd physical device, live models, or a real render/export;
  none newly actionable from CI.

## Register coverage this run
- **Live attest (PWA + all four workers)** — all readable, all match source; no drift.
- **Standing probes** — PWA 1570/1570, full-repo 1893/1893, docx-worker 37/37, render V&V 50/50,
  app.js clean.
- **Render-gated diags** — copenhagen-overflow-storm / settings-panels / button-audit / sidebar-stable
  / sidebar-promote-margin all green; date-bumped rows 1/3/11/17.
- **CI-CF-TOKEN-EXPIRED-001** — carried OPEN (owner action). **LLM-TRAFFIC-GAP-2026-08 /
  RELAY-TUNE-COVERAGE-GAP-001** — carried. No NEW bug/task discovered this run.
- All other open rows — owner-gated / need a 2nd physical device / live models / a real foreground
  gen → none newly actionable from CI.

No `app.js` / `app.src.js` / worker / workflow change reached `main` this run. Pushes: this report,
the OPEN_REGISTER edits, and today's panel-button-audit artifacts.
