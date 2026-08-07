# AntCV nightly — 2026-08-07 (CI / GitHub Actions, unattended, Opus 4.8)

Substrate: GitHub Actions on `gabrielk83/AntCV`. No in-app Browser pane. `ALLOW_DEPLOY=false`
(and CI-CF-TOKEN-EXPIRED-001 still stands — even with `ALLOW_DEPLOY` the CF deploy token is dead
until the owner rotates it). **SYNC FIRST clean:** `git fetch && pull --rebase origin main` →
already up to date, base HEAD `6cbcd8f2`. Working tree clean throughout. No force-push. This run is
docs-only → no shift claim needed.

## Headline

**Verify + attest + reconcile of current `main`. No code shipped, no PR, nothing owed live.**
A truly quiet night: HEAD `6cbcd8f2` **is** the 08-06 CI report commit — **zero code or docs delta
has landed since** (no desktop nightly, job-tracker, or scheduled routine pushed overnight). All
standing probes green, all five live surfaces match repo source. Went one step deeper than 08-06:
installed chromium and **re-ran the render-gated Playwright diags** (08-06 skipped them), so the
stalest register rows are genuinely date-bumped rather than carried. This run pushes only this
report, the OPEN_REGISTER edits, and today's panel-button-audit artifacts.

## Code delta since the 08-06 CI base (`6cbcd8f2` → HEAD)
`git diff --stat 6cbcd8f2..HEAD` = **empty**. HEAD is the 08-06 report commit itself. No
`pwa/app.js`, `pwa/app.src.js`, `workers/**`, or `.github/**` change — nothing at all landed since.

## Standing probes — ALL GREEN on main (`6cbcd8f2`, PWA live `1.51.4086-demand-seed-refresh`)
- **PWA suite:** `node scripts/run-tests.mjs pwa` → **1570/1570 pass**, 0 fail.
- **Full-repo suite:** `node scripts/run-tests.mjs` → **1893/1893 pass**, 0 fail. Flat vs 08-06.
- **app.js integrity:** head `(()=>{`, **0** `"use strict"`, `node --check` OK — minified-sacred intact.
- **docx-worker `test/*.test.mjs` suite:** **37/37**.
- **docx render V&V** (`node scripts/run-docx-diags.mjs`): **50/50** on bundled worker source.

## Render-gated Playwright diags — RE-RUN green (deeper than 08-06)
Chromium was not pre-installed; `npx playwright install chromium` succeeded, so the login-gated /
browser-driven diags ran headless against the demo/template boot:
- **copenhagen-overflow-storm** — PASS. ON (default) 2 writes / 0px usablePx-drift / 0 errors;
  OFF (`antcv:copenhagen-v2=0`) 1 write / 0px / 0 errors. Preview converges both ways.
- **settings-panels-probe** — DIAG PASS. Account 0 mutations/6s, Layout 0 mutations/6s,
  `rootFound=true`, 0 page errors.
- **panel-button-audit** — 212 buttons, **0 page errors**, 140 active, 14 skipped-dangerous,
  13 ui-only, 45 not-visible-or-disabled. Artifacts `docs/qa/PANEL_BUTTON_AUDIT_2026-08-07.{json,md}`.
- **sidebar-stable** — OK. width/height stable + converged after 12 scrolls, 0 style writes, 0 errors.
- **sidebar-promote-margin** — OK. hold-under-margin true (sidebar holds page 3 across one-row and
  whole-group removals).

## LIVE ATTEST — workers + PWA (all five READABLE; every version = in-repo source)

| Surface | Live `/health` (or CACHE) | In-repo source | Match |
|---|---|---|---|
| PWA (`antcv.pages.dev` `sw.js` CACHE) | `antcv-1.51.4086-demand-seed-refresh` | `sw.js` CACHE `1.51.4086-demand-seed-refresh` | ✅ |
| cv-proxy (`cv-proxy.karp-gabriel-a.workers.dev`) | `3.8.4-brand-ink-match` | `VERSION` `3.8.4-brand-ink-match` | ✅ |
| docx-worker (`docx-worker.karp-gabriel-a.workers.dev`) | `1.14.174-appline-edit` | `src/index.js` `VERSION` `1.14.174-appline-edit` | ✅ (code == deployed per 08-04 live-verify) |
| access-relay (`antcv-access-relay.karp-gabriel-a.workers.dev`) | `auth-37-cap-disposable-only` | `RELAY_VERSION` `auth-37-cap-disposable-only` | ✅ |
| demo-proxy (`antcv-demo-proxy.karp-gabriel-a.workers.dev`) | `3.8.4-brand-ink-match` | `VERSION` `3.8.4-brand-ink-match` | ✅ |

No drift on any surface. Carried cosmetic (unchanged): `antcv-demo-proxy` `/health` still self-labels
`"service":"cv-proxy"` (shared code; version string authoritative) — needs a worker deploy, carried.
docx-worker `/health` `1.14.174` no longer uniquely fingerprints the signoff code (DOCX-WORKER-VERSION-
NOT-BUMPED, VERIFIED NON-ISSUE, logged 08-05) — not re-flagged.

## Register reconcile / staleness sweep (E1)
Code surface byte-identical since 08-06, but chromium availability let me genuinely re-verify the
stalest render-gated rows instead of carrying them:
- **Row 1** (quick-gen / 3-page convergence) — verified: 2026-08-07; all render-gated diags green today.
- **Row 3** (floating spine) — verified: 2026-08-07; flag default-OFF re-confirmed against current
  source (docx-worker:24668 `floatSpine=payload.float_spine===true||style.floatSpine===true`,
  docx-client:1251/1253 gated on `localStorage antcv:float-spine==='1'`); gate logic intact.
- **Row 11** (sidebar page-2/3 dance, CLOSED) — re-verified: 2026-08-07; sidebar-stable +
  sidebar-promote-margin both OK.
- **Row 17** (settings sweep-army, DONE 1.51.156) — re-verified: 2026-08-07; settings-panels-probe
  Account+Layout 0 mut/6s, 0 page errors, DIAG PASS.
- **Rows 23 / 35 / 36 / 37** — no code delta touching them; held, no churn to date-bump against.
- **SEED-VS-TARGET-VERSION-NONBUG-001** — unchanged (seed == `app.js?v`, not TARGET); not re-flagged.
- **CI-CF-TOKEN-EXPIRED-001** — still OPEN, owner action (rotate/re-scope the GitHub-Actions
  `CLOUDFLARE_API_TOKEN` so `deploy.yml` can authenticate — CF `Authentication error [code: 10000]`,
  Actions run 30929549016). Carried, not fixable from CI. This is why `ALLOW_DEPLOY` is moot for
  workers unattended.
- **RELAY-TUNE-COVERAGE-GAP-001** — no weekly tune due tonight (last ran 08-06, NO FLIP); carried.

## Owed (cannot be done in CI)
- **Worker deploys** — blocked by CI-CF-TOKEN-EXPIRED-001 AND `ALLOW_DEPLOY=false`; all four workers
  already match source → **nothing owed functionally**, only the token rotation for FUTURE deploys.
- **Post-deploy live-verify** — this CI run shipped **no PWA/worker change** → nothing owed FROM tonight.
- **SO-004 (row 41)** crash capture + **PERF-001 (row 45)** cloud-sync profiling — need a live
  signed-in session; not actionable unattended.
- **Salmon render rows** (DIAG-SALMON-EMPTY-REGION-STALE-001 / SALMON-MAIN-LENGTH-001) — need a real
  signed-in generated-content session (the render diags above run the demo/template boot only);
  not re-picked.
- **Owner/render/live-gated open rows** (6/8/19/20/22/25/26/27/28/29 etc.) + rows 35/36/37
  regen-confirm — need a signed-in gen, a 2nd physical device, live models, or a real render/export;
  none newly actionable from CI.

## Register coverage this run
- **Live attest (PWA + all four workers)** — all readable, all match source; no drift.
- **Standing probes** — PWA 1570/1570, full-repo 1893/1893, docx-worker 37/37, render V&V 50/50,
  app.js clean.
- **Render-gated diags** — copenhagen-overflow-storm / settings-panels / button-audit / sidebar-stable
  / sidebar-promote-margin all green; date-bumped rows 1/3/11/17.
- **CI-CF-TOKEN-EXPIRED-001** — carried OPEN (owner action). No NEW bug/task discovered this run.
- All other open rows — owner-gated / need a 2nd physical device / live models / a real foreground
  gen → none newly actionable from CI.

No `app.js` / `app.src.js` / worker / workflow change reached `main` this run. Pushes: this report,
the OPEN_REGISTER edits, and today's panel-button-audit artifacts.
