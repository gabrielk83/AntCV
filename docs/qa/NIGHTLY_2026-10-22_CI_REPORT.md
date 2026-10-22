# CI Nightly report — 2026-10-22 (GitHub Actions, unattended, Opus 4.8)

Fresh clone on `origin/main` `9f20c30a`. SYNC FIRST: `git fetch origin && git pull --rebase origin main`
— already up to date. `ALLOW_DEPLOY` not `true` → no worker deploys attempted. No `pwa/app.js`,
`app.src.js` or `workers/**` edit → no PR, no boot-smoke, no cache-bust, no shift claim.

## Baseline
- `node scripts/run-tests.mjs pwa` → **1843/1843 pass, 0 fail**.
- `node scripts/check-register.mjs` OK before and after the edits.

## Band E1 — register-staleness sweep (NIGHTLY_BACKLOG_RECONCILE slot)

`check-register.mjs --stalest 5` returned rows **95, 92, 93, 114** (verified 2026-10-11) and **94**
(2026-10-12). All five are code-anchored. Each was re-checked against HEAD `9f20c30a`, found INTACT,
kept ACTIVE on its existing gate, and date-refreshed to **2026-10-22** in both the index
(`OPEN_REGISTER.md`) and the detail file (`REGISTER_ACTIVE_DETAIL.md`).

| row | ID | re-check result | why still open |
|---|---|---|---|
| 95 | `CV-POLISH-BATCH-001` | leg (a) Strategic-Expertise cell caps still in the gen prompt (`app.src.js` ~3834 ONE-LINE RULE, ~4086 (B) TIGHT CELLS) | legs b-e render/regen-gated — need a signed-in targeted gen |
| 92 | `EXPORT-PREVIEW-PAGINATION-DIVERGENCE-001` | two-map split survives — `sidebarPages`/`mainPages` + `__antcvPB` markers (25 refs in `docx-worker/src/index.js`), numPages=max + trailing-empty trim intact | not reproducible on current content; needs owner's original overflowing REGULATORY-CONTEXT app reloaded; "do NOT guess a fix" |
| 93 | `AUTO-ANALYSE-ON-JD-LOAD-ERROR-001` | sidecar `antcv-analysis-panel-jd-block-356.js` loaded, AUTO-ANALYSE-ON-JD-LOAD-001 / OPEN-ANALYSIS-AUTORUN-001 path present (7 refs), no `__errTrap` in current code | transient — needs a re-armed trap on a signed-in device |
| 114 | `TELEMETRY-BGJOB-GAP-001` | gap confirmed — only `llm_calls` writer is `insertLlmCall` (access-relay `telemetry.js`); `workers/proxy/src` has none; `/job/*` + `antcv-gen-job-client.js` emit no telemetry | OWNER DESIGN CALL (proxy posts per-section telemetry, or job client emits events) |
| 94 | `CONTENT-LANG-STAMP-001` | `content_language` present in `pwa/app.js` (×2) + access-relay (×5), `1.51.4446-content-lang-stamp` leg intact | live generate/translate-persist regen owed (needs real models) |

No owner-gated row force-closed — every residual is an owner / live / render / design step, not a code gap.

## Bands A–D — not advanced
A1/A2 need a live mobile gen + a second physical device; B1/B2 need a signed-in headless repro with
real content; C/D need live LLM routing / a worker deploy / a real CloudConvert render. None of these
are available in unattended CI (CLOUD CAVEATS).

## New stalest after the sweep
Rows **2** `LINKIFY-EXPORT-001`, **47** `MOBILE-TOPBAR-SAFEAREA-001`, **50** `UPLOAD-SCREEN-TOP-CLIP-001`,
**51** `PREVIEW-SCROLL-JITTER-001` (all 2026-10-12). Left untouched rather than date-refreshed without a
real check — their remaining legs (SW-projects overflow, mobile top-bar reachability, upload-screen clip,
preview-scroll jitter) want a signed-in / real-device pass a desktop or live run should take next.

## Push
Docs-only to `main` (registers + this report + run-log). No `pwa/` asset, no version consumed, no
shift claim, no deploy. Nothing shipped → **no post-deploy live-verify owed this run**. The
owner-eyeball / live-gen / real-PDF / second-device / design-decision steps on rows 95/92/93/114/94
carry forward.
