# AntCV nightly — 2026-08-05 (CI / GitHub Actions, unattended, Opus 4.8)

Substrate: GitHub Actions on `gabrielk83/AntCV`. No in-app Browser pane. `ALLOW_DEPLOY=false`
(and see CI-CF-TOKEN-EXPIRED-001 below — even ALLOW_DEPLOY would fail: the CF token is dead).
Headless Playwright not exercised this run (no render-gated regression to chase — the docx surface
was covered by the 50/50 V&V harness). **SYNC FIRST clean:** `git fetch && pull --rebase origin main`
→ already up to date, base HEAD `994ace5e`. Working tree clean throughout. No force-push.

## Headline

**Verify + attest + reconcile of current `main`. No code shipped to `main`, no PR left open.**
One finding was investigated, initially mis-scoped as a worker attest false-match, then **corrected
in-run** to a verified non-issue; the draft branch was deleted. The one genuinely-open item is an
infrastructure finding carried from the 08-04 desktop note — the CI Cloudflare deploy token is
expired (`CI-CF-TOKEN-EXPIRED-001`, owner action needed). This run pushes only docs/registers.

## Standing probes — ALL GREEN on main (`994ace5e`, PWA live `1.51.4086-demand-seed-refresh`)
- **PWA suite:** `node scripts/run-tests.mjs pwa` → **1570/1570 pass**, 0 fail.
- **Full-repo suite:** `node scripts/run-tests.mjs` → **1893/1893 pass**, 0 fail (~9s). Up from the
  08-04 baseline 1888 — the +5 is the new `workers/docx-worker/test/signoff-brand-color.test.mjs`
  landed with the desktop's SIGNOFF fix.
- **app.js integrity:** head `(()=>{window`, **0** `"use strict"` — minified-sacred intact.
- **docx-worker `test/*.test.mjs` suite:** **37/37** (incl. `signoff-brand-color` **5/5**,
  `palette` 11/11).
- **docx render V&V** (`node scripts/run-docx-diags.mjs`): **50/50** on bundled worker source.

## LIVE ATTEST — workers + PWA (all five READABLE via prefixed hosts; every version = in-repo source)

| Surface | Live `/health` (or CACHE) | In-repo source | Match |
|---|---|---|---|
| PWA (`antcv.pages.dev` `sw.js` CACHE) | `antcv-1.51.4086-demand-seed-refresh` | `sw.js` CACHE `1.51.4086-demand-seed-refresh` | ✅ |
| cv-proxy (`cv-proxy.karp-gabriel-a.workers.dev`) | `3.8.4-brand-ink-match` | `VERSION` `3.8.4-brand-ink-match` | ✅ |
| docx-worker (`docx-worker.karp-gabriel-a.workers.dev`) | `1.14.174-appline-edit` | `src/index.js` `VERSION` `1.14.174-appline-edit` | ✅ (see note) |
| access-relay (`antcv-access-relay.karp-gabriel-a.workers.dev`) | `auth-37-cap-disposable-only` | `RELAY_VERSION` `auth-37-cap-disposable-only` | ✅ |
| demo-proxy (`antcv-demo-proxy.karp-gabriel-a.workers.dev`) | `3.8.4-brand-ink-match` | `VERSION` `3.8.4-brand-ink-match` | ✅ |

docx-worker note: the version STRING matches, and — after re-reading the 08-04 deploy record — so
does the CODE (the SIGNOFF fix was deployed 08-04 and live-verified; source == deployed worker). See
DOCX-WORKER-VERSION-NOT-BUMPED below. Cosmetic-unchanged: `antcv-demo-proxy` `/health` still
self-labels `"service":"cv-proxy"` (shared code; version string authoritative) — needs a worker
deploy, low value, carried.

## The finding, and the correction (documented honestly)

Since the 08-04 CI base (`f7f66a7e`), the desktop nightly landed **SIGNOFF-BRAND-COLOR-001**
(`59819201`) + its test lock (`994ace5e`): `buildLinearDocument`'s CL sign-off run now honours
optional `signoffColor` / `signoffUnderlineColor` tokens over the hardcoded Copenhagen teal `00746E`
/ cyan `01B9BD` underline; absent tokens render byte-identical.

**Initial (wrong) read.** The fix edited `docx-worker/src/index.js` but did **not** advance `VERSION`
(still `1.14.174-appline-edit`, the same string live `/health` reports). I first read this as a
`/health` attest FALSE-MATCH — the version string can't distinguish pre- from post-fix code — plus a
deploy owed, and drafted a one-line version-bump (`1.14.175-signoff-brand`) on a PR branch
(`nightly/docx-signoff-version-bump`, commit `5ce00cde`), worker suite 37/37 + diags 50/50 green.
GitHub-Actions can't open PRs in this repo (`createPullRequest` denied), so the branch was pushed
only.

**Correction.** Re-reading `ACTIVE_BUGS.md` line 1 (the desktop's own SIGNOFF record) showed the fix
was **DEPLOYED** 08-04 via `npx wrangler deploy --env=""` (wrangler version `7a07525f…`) and
**live-verified in a real render** (sign-off `#0D64AA`, underline `#FFC92B`, PyMuPDF pixel probe;
docx valid, 28 parts), with a deliberate "no version/cache-bust" choice. So the deployed worker's
code already **equals** the current repo source (both signoff-inclusive, both labelled `1.14.174`):
attest `match ✓` is genuinely correct and nothing is undeployed. A version bump **without** a deploy
(which CI cannot do) would have made repo source `1.14.175` diverge from live `1.14.174` with no code
difference — manufacturing a phantom "undeployed fix" mismatch that every future nightly would
re-flag. So the draft branch was **deleted** (`origin` + local); nothing landed on `main`.

Logged as **DOCX-WORKER-VERSION-NOT-BUMPED — VERIFIED NON-ISSUE** (ACTIVE_BUGS top block) so no
future run re-opens it — same "looks-like-a-version-bug, is-actually-fine" family as
SEED-VS-TARGET-VERSION-NONBUG-001. Residual, owner-accepted: `/health` `1.14.174` no longer uniquely
fingerprints the signoff code (pre- and post-fix both report `1.14.174`) — a minor observability
trade-off the owner took with the no-bump call.

## GENUINE OPEN ITEM — CI-CF-TOKEN-EXPIRED-001 (owner action)

The desktop note surfaced, and this run promotes to its own tracked row: the repo
`CLOUDFLARE_API_TOKEN` GitHub-Actions secret is **expired / under-scoped**. The 08-04
`gh workflow run deploy.yml -f target=docx-worker` failed with CF `Authentication error [code:
10000]` + "Failed to automatically retrieve account IDs" (Actions run 30929549016). So **no worker
deploys from CI or the cloud routine** — they fall back to the desktop's local wrangler auth. This is
the real reason `ALLOW_DEPLOY` is moot for workers unattended. **Owner action:** rotate/re-scope the
secret (`Workers Scripts:Edit` + account read) so `deploy.yml` can authenticate. Not fixable from CI.

## Register reconcile / staleness sweep (E1)
Code surface unchanged since 08-04 apart from the already-deployed-and-attested SIGNOFF fix, so the
register carries no new drift. Stalest genuinely-open rows re-checked:
- **Rows 1 / 3 / 11 / 17 / 23 / 35 / 36 / 37** — no code delta touching them; the docx render (50/50
  V&V), settings/sidebar/button behaviours (covered by the 1570 suite), and float-spine gate
  (docx-worker `floatSpine` gate + docx-client `antcv:float-spine` gate, unchanged) all hold. Held;
  no new date churn beyond confirming green today.
- **SEED-VS-TARGET-VERSION-NONBUG-001** — unchanged (seed `4046` == `app.js?v`, not TARGET `4086`);
  not re-flagged.

## Owed (cannot be done in CI)
- **Worker deploys** — blocked by CI-CF-TOKEN-EXPIRED-001 AND `ALLOW_DEPLOY=false`; all four workers
  already match source (docx-worker signoff-inclusive per the 08-04 live-verify), so **nothing owed**
  functionally — only the token rotation for FUTURE deploys.
- **Post-deploy live-verify** — this CI run shipped **no PWA/worker change** → nothing owed FROM
  tonight.
- **SO-004 (row 41)** crash capture + **PERF-001 (row 45)** cloud-sync profiling — need a live
  signed-in session; not actionable unattended.
- **Salmon render rows** (DIAG-SALMON-EMPTY-REGION-STALE-001 / SALMON-MAIN-LENGTH-001) — render-
  capable / desktop-only (login-gated in-app Preview); not re-picked.
- **JOBTRACKER-ODM-ANONYMIZATION-GARBLE-001** + `copenhagen-infrastructur-7397` row disposition +
  demo-proxy `/health` `"service"` cosmetic label — owner/deploy-gated; carried.
- **Owner/render/live-gated open rows** (1/3/6/8/19/20/22/25/26/27/28/29 etc.): none newly actionable
  from CI — need a signed-in gen, a 2nd physical device, live models, or a real render/export.

## Register coverage this run
- **New row — CI-CF-TOKEN-EXPIRED-001** (OPEN, owner action) added to OPEN_REGISTER banner +
  ACTIVE_BUGS top block.
- **DOCX-WORKER-VERSION-NOT-BUMPED** — verified NON-ISSUE, logged to prevent re-flag.
- **Rows 1 / 3 / 11 / 17 / 23 / 35 / 36 / 37** — no drift; green today.
- **Live attest (PWA + all four workers)** — all readable, all match source (code + version); no
  drift.
- All other open rows — owner-gated / need a 2nd physical device / live models / a real foreground
  gen → none newly actionable from CI.

No `app.js` / `app.src.js` / worker / workflow change reached `main` this run. Pushes: this report,
the OPEN_REGISTER banner, and the ACTIVE_BUGS top-block entries.
