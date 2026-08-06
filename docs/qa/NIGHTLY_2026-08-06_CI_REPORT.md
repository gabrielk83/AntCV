# AntCV nightly — 2026-08-06 (CI / GitHub Actions, unattended, Opus 4.8)

Substrate: GitHub Actions on `gabrielk83/AntCV`. No in-app Browser pane. `ALLOW_DEPLOY=false`
(and CI-CF-TOKEN-EXPIRED-001 still stands — even ALLOW_DEPLOY would fail: the CF deploy token is
dead until the owner rotates it). Headless Playwright not exercised (no render-gated regression to
chase — the docx surface is covered by the 50/50 V&V harness). **SYNC FIRST clean:**
`git fetch && pull --rebase origin main` → already up to date, base HEAD `151b9202`. Working tree
clean throughout. No force-push.

## Headline

**Verify + attest + reconcile of current `main`. No code shipped, no PR, nothing owed live.**
A quiet night: the only delta since the 08-05 CI base (`994ace5e`) is **docs-only** — the 08-05 CI
report, the weekly relay cost-quality tune (2026-08-06, **NO FLIP**, quiet week), and its shift
claim/release. Zero code changed. All standing probes green, all five live surfaces match repo
source. This run pushes only this report + the OPEN_REGISTER banner.

## Code delta since the 08-05 CI base (`994ace5e` → `151b9202`)
`git diff --stat` = docs only:
- `2a1f21b9` — 08-05 CI nightly report + register.
- `3f0ca4e1` / `4cbf31f6` / `151b9202` — weekly relay cost-quality tune 2026-08-06: **NO FLIP**
  (quiet week — no head change to `MODEL_ROLES`), plus its shift claim/release (`1.51.4106-4125`,
  released). No `wrangler.toml` / worker code touched → no proxy deploy owed.

No `pwa/app.js`, `pwa/app.src.js`, `workers/**`, or `.github/**` change since the last CI base.

## Standing probes — ALL GREEN on main (`151b9202`, PWA live `1.51.4086-demand-seed-refresh`)
- **PWA suite:** `node scripts/run-tests.mjs pwa` → **1570/1570 pass**, 0 fail.
- **Full-repo suite:** `node scripts/run-tests.mjs` → **1893/1893 pass**, 0 fail (~9s). Flat vs the
  08-05 baseline 1893 (docs-only delta since).
- **app.js integrity:** head `(()=>{window`, **0** `"use strict"`, `node --check` OK — minified-sacred intact.
- **docx-worker `test/*.test.mjs` suite:** **37/37** (incl. `signoff-brand-color` **5/5**).
- **docx render V&V** (`node scripts/run-docx-diags.mjs`): **50/50** on bundled worker source.

## LIVE ATTEST — workers + PWA (all five READABLE; every version = in-repo source)

| Surface | Live `/health` (or CACHE) | In-repo source | Match |
|---|---|---|---|
| PWA (`antcv.pages.dev` `sw.js` CACHE) | `antcv-1.51.4086-demand-seed-refresh` | `sw.js` CACHE `1.51.4086-demand-seed-refresh` | ✅ |
| cv-proxy (`cv-proxy.karp-gabriel-a.workers.dev`) | `3.8.4-brand-ink-match` | `VERSION` `3.8.4-brand-ink-match` | ✅ |
| docx-worker (`docx-worker.karp-gabriel-a.workers.dev`) | `1.14.174-appline-edit` | `src/index.js` `VERSION` `1.14.174-appline-edit` | ✅ (code == deployed per 08-04 live-verify) |
| access-relay (`antcv-access-relay.karp-gabriel-a.workers.dev`) | `auth-37-cap-disposable-only` | `RELAY_VERSION` `auth-37-cap-disposable-only` | ✅ |
| demo-proxy (`antcv-demo-proxy.karp-gabriel-a.workers.dev`) | `3.8.4-brand-ink-match` | `VERSION` `3.8.4-brand-ink-match` | ✅ |

No drift on any surface. Carried cosmetic (unchanged): `antcv-demo-proxy` `/health` still self-labels
`"service":"cv-proxy"` (shared code; version string authoritative) — low value, needs a worker
deploy, carried. docx-worker version-string-doesn't-fingerprint-signoff is a VERIFIED NON-ISSUE
(DOCX-WORKER-VERSION-NOT-BUMPED, logged 08-05) — not re-flagged.

## Register reconcile / staleness sweep (E1)
Code surface unchanged since 08-05 (docs-only delta), so the register carries no new drift. Stalest
genuinely-open rows re-checked against current code:
- **Rows 1 / 3 / 11 / 17 / 23 / 35 / 36 / 37** — no code delta touching them; the docx render
  (50/50 V&V), settings/sidebar/button behaviours (covered by the 1570 suite), and float-spine gate
  (unchanged) all hold. Held; green today, no code churn to date-bump against.
- **SEED-VS-TARGET-VERSION-NONBUG-001** — unchanged (seed `4046` == `app.js?v`, not TARGET `4086`);
  not re-flagged.
- **CI-CF-TOKEN-EXPIRED-001** — still OPEN, owner action (rotate/re-scope the GitHub-Actions
  `CLOUDFLARE_API_TOKEN` so `deploy.yml` can authenticate — CF `Authentication error [code: 10000]`,
  Actions run 30929549016). Carried, not fixable from CI. This is why `ALLOW_DEPLOY` is moot for
  workers unattended.
- **RELAY-TUNE-COVERAGE-GAP-001** — the weekly cost-quality tune ran and held (NO FLIP, quiet week);
  the coverage-gap is the known reason no head flips. No change; carried.

## Owed (cannot be done in CI)
- **Worker deploys** — blocked by CI-CF-TOKEN-EXPIRED-001 AND `ALLOW_DEPLOY=false`; all four workers
  already match source → **nothing owed functionally**, only the token rotation for FUTURE deploys.
- **Post-deploy live-verify** — this CI run shipped **no PWA/worker change** → nothing owed FROM tonight.
- **SO-004 (row 41)** crash capture + **PERF-001 (row 45)** cloud-sync profiling — need a live
  signed-in session; not actionable unattended.
- **Salmon render rows** (DIAG-SALMON-EMPTY-REGION-STALE-001 / SALMON-MAIN-LENGTH-001) — render-
  capable / desktop-only (login-gated in-app Preview); not re-picked.
- **Owner/render/live-gated open rows** (1/3/6/8/19/20/22/25/26/27/28/29 etc.) + rows 35/36/37
  regen-confirm — need a signed-in gen, a 2nd physical device, live models, or a real render/export;
  none newly actionable from CI.

## Register coverage this run
- **Live attest (PWA + all four workers)** — all readable, all match source (code + version); no drift.
- **Standing probes** — PWA 1570/1570, full-repo 1893/1893, docx-worker 37/37, render V&V 50/50,
  app.js clean.
- **Rows 1 / 3 / 11 / 17 / 23 / 35 / 36 / 37** — no drift; green today.
- **CI-CF-TOKEN-EXPIRED-001** — carried OPEN (owner action). No NEW bug/task discovered this run.
- All other open rows — owner-gated / need a 2nd physical device / live models / a real foreground
  gen → none newly actionable from CI.

No `app.js` / `app.src.js` / worker / workflow change reached `main` this run. Pushes: this report
and the OPEN_REGISTER banner entry.
