# AntCV nightly report — 2026-09-30 (CI cloud run)

Runner: GitHub Actions (unattended), model Opus 4.8, repo `gabrielk83/AntCV`, branch `main`.
Authoritative plan: `docs/qa/CLOUD_ROUTINE_PROMPT.md` → `NIGHTLY_2026-07-05_PROMPT.md` bands +
`OPEN_REGISTER.md`. Style: direct, factual.

## Environment / constraints (this run)

- `ALLOW_DEPLOY=false` → no worker deploys attempted.
- No signed-in browser, no live LLM generation → Band A (mobile/tab-isolation A/B), live-regen and
  owner-eyeball verifies are not runnable here.
- Playwright is installed but **chromium is not** (`chrome-headless-shell` missing) → no headless
  diag/repro (Band B1/B2, live-guard-sidecars diag).
- Direct network works (`antcv.pages.dev` HEAD → 200).
- Per CI safety override: any `pwa/app.js` / `pwa/app.src.js` / `workers/**` change must go via PR.
  This run shipped **no code** (see below), so no PR was needed.

## Gates

- Suite: `node scripts/run-tests.mjs pwa` → **1746/1746 pass, 0 fail**.
- `node scripts/check-register.mjs` → OK (93 ACTIVE rows, 93 detail sections).
- Live-deploy sanity: `antcv.pages.dev` serves `app.js?v=1.51.4727-close-space` and
  `ANTCV_VERSION 1.51.4727-close-space` = repo HEAD. **PWA auto-deploy is healthy; production is in
  sync with `main`.**
- SYNC FIRST: `git fetch && git pull --rebase origin main` at start (already up to date). Docs-only
  run → no shift claim (desktop holds live lane 1.51.4746-4765; this run consumes no version).

## Work done — Band E1 register staleness sweep (owner standing slot)

Ranked the ACTIVE index on the `verified:` column and took the 5 stalest non-STANDING rows (all
July-dated). Each was re-checked against **current code**, then refreshed or scope-corrected.

| Row | ID | Finding this run | Result |
|---|---|---|---|
| **96** | `CV-HEADER-BOX-001` | **Materially stale.** Row said "not started (2026-07-17)". The rounded header box is in fact SHIPPED: worker `headerBox` roundRect `AntCVHeadBox` (~583.3pt×144pt, brand fill, cyan 1.5pt stroke, page-anchored) at `workers/docx-worker/src/index.js` ~23957-23964, wired at ~24759, candidate-band composition ~25296-25316, gated on `copenhagen-modern` (`_cph`). Landed 2026-07-23 in Copenhagen STAGE4 commit `eb198927` (wk 1.14.165, PWA 1.51.3622). | Scope narrowed + date refreshed. Remaining legs (photo-in-header parity, CV AI-notice→footer, `header=144` twips margins, preview↔export parity vs the gold `1017_..._v4.docx`) are live/owner-gated. Kept ACTIVE. |
| **92** | `EXPORT-PREVIEW-PAGINATION-DIVERGENCE-001` | Worker two-map split intact (`sidebarPages`/`mainPages`, `numPages=max`, PDF-BLANK-PAGE-001/002 guards). Not reproducible without the owner's ORIGINAL overflowing content. | Date refreshed. Do-not-guess guidance stands. Kept ACTIVE. |
| **93** | `AUTO-ANALYSE-ON-JD-LOAD-ERROR-001` | Auto-analyse path present + hardened (`antcv-analysis-panel-jd-block-356.js` AUTO-ANALYSE-ON-JD-LOAD-001 + slow-poll); transient `__errTrap` never caught a hit and doesn't persist. | Date refreshed. Owner-repro gated. Kept ACTIVE. |
| **95** | `CV-POLISH-BATCH-001` | Leg (a) Strategic-Expertise cell caps ARE enforced in the gen prompt (`app.src.js` ~3834/~4086, hard "never wrap" caps ~48/~28 chars) — the "cap not holding" symptom is render/regen, not a missing rule. Legs (b)-(e) render/kernel/regen-gated. | Date refreshed. All legs need a live regen. Kept ACTIVE. |
| **97** | `DELIVERABLES-3CO-001` | Pure live-regen + D1 JD-data check + owner deliverable; gated on row 95. No code leg. | Date refreshed. Kept ACTIVE — owner/live. |

Also confirmed (verify-first) the desktop 2026-09-29 finding "`browser-qa --only version-live,
sidecars-live` selects 0 checks and exits 0 (false green), BROWSER-QA-ONLY-LIST-001" is **already
fixed** in-tree — commit `15576ff2`, `scripts/qa-checks.mjs selectChecks()` now throws on unknown/
empty ids, tested by `scripts/tests/qa-checks-only.test.mjs`, registered in `ACTIVE_BUGS.md`. No
action owed; the desktop report predated the fix landing.

## Not done / owed (blocked in cloud)

- **Band A (A1 GEN-BACKGROUND-001, A2 tab/device isolation):** verify-first, live-mobile A/B — needs
  a real device/signed-in session. Owed to a desktop run.
- **Band B (B1 SO-003 data-loss, B2 SO-004 React #185):** need headless repro — chromium absent.
- **Band C (42/43/44):** all already SHIPPED + live-attested 2026-09-29; only owner click-through
  eyeball owed.
- **Band D (D1 PERF-001 profile, D2 GEN-MODELROLE live-deploy check):** need browser CPU profile /
  worker-deploy + live `llm_calls` — not available (`ALLOW_DEPLOY=false`).
- **Rows 95/96/97:** live export + regen + owner eyeball owed to a desktop run.

## For the owner

- Nothing needs a decision from this run. No code changed → **no post-deploy live-verify owed** from
  this run.
- Standing owner-eyeball backlog unchanged: rows 42/43/44 click-through; row 96 gold-docx export
  diff when convenient (the box is shipped; parity legs are what remain).

## Registers updated (this commit)

- `OPEN_REGISTER.md` — rows 96/92/93/95/97 `verified:` → 2026-09-30; row 96 scope corrected.
- `REGISTER_ACTIVE_DETAIL.md` — 2026-09-30 sweep note + `_verified_` on the same 5 rows.
- `REGISTER_RUNLOG.md` — run summary prepended.
- No `ACTIVE_BUGS.md` / `FEATURES_REGISTRY.md` change (no code fix, no feature this run).

_Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>_
