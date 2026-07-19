# NIGHTLY REPORT — 2026-07-19 (antcv-nightly, Opus 4.8)

**Verdict:** verify + register-reconcile run. **No code shipped by this nightly.** Two shipped-but-unregistered day-session fixes reconciled into the register. Standing probes all green. Baseline moved under an **active parallel day session** (opened PWA `1.51.1557`, rebased mid-run to `1.51.1558-unsol-subtitle-slogan-gate`).

## Baseline & sync
- SYNC FIRST clean; worktree `relaxed-gates-2e5276` (branch `claude/heuristic-lichterman-6ebf9b`). The main clone has unrelated WIP from another session (`claude/silly-davinci-3562f7`) — left untouched.
- Re-synced mid-run: `git pull --rebase origin main` pulled the day session's live pushes — `965ca92` (relay HYGIENE-CATEGORY-DOWNGRADE-001), `7c61c1b`/`06b2f13` (1.51.1558 unsol-subtitle-slogan-gate), `0702792` (shift release 1556–1575).
- Final baseline: PWA TARGET = `1.51.1558-unsol-subtitle-slogan-gate`, `app.js?v=1.51.1556-pdf-panel-worker` (app.js last-touched at 1556). Cache-bust quintet consistent (415 sidecar 1557, sw.js CACHE 1558, version-override own ?v, seed + TARGET); STALE_VERSIONS invariant intact (1556 previous listed; 1557/1558 not self-listed).
- `app.js` head `(()=>{window` — no `"use strict"`, minified-sacred intact.

## Standing probes (Band E) — all green on the 1558 base
| Probe | Result |
|---|---|
| PWA suite (`node scripts/run-tests.mjs pwa`) | **1323/1323** (~40s) |
| boot-smoke (`pwa/test/boot-smoke.mjs`) | OK — glDemo=function, 0 errors |
| Personal-panel probe (`diag-personal-panel-probe.mjs`) | **DIAG PASS** — 0 mut/8s, 0 page errors |
| Button-audit (`diag-panel-button-audit.mjs`) | **197 buttons / 0 page errors / 101 active** — 56 not-visible-or-disabled, 23 ui-only, 12 skipped-dangerous |
| access-relay `category-downgrade-guard.test.mjs` (pulled test) | **7/7** |

**Button-audit "5 unclickable" is not a regression.** All 5 are `locator.click: Timeout 1500ms exceeded` on self-mutating controls (`ON` toggles ×3, `▶` disclosure, `+` add) — the documented stale-locator race (OPEN_REGISTER row 23: the control re-renders and detaches the Playwright locator mid-click). 0 throws, 0 page errors. 07-16/07-17 happened to record 0 on these inherently-racy toggles; the app did not error.

## Live-verify
- **PWA layer (curl to `pages.dev`):** live = TARGET `1.51.1558-unsol-subtitle-slogan-gate` — **no version regression / no stale-SW mask** (the day session moved TARGET + live together). Served + wired: `app.js?v=1.51.1556-pdf-panel-worker`, `antcv-sections-normalize-415.js?v=1.51.1557-role-merge-swallow`, `antcv-gen-memo.js?v=1.51.134` (A1), `antcv-pointer-stale-guard.js?v=1.51.334-unsol-pillar` (A2 leg 2), `antcv-lang-fabrication-guard.js?v=1.51.136` (C1), `antcv-react-islands.js?v=1.51.1425-tracker-open-claim` (rows 93/94).
- **Worker `/health` live-attest BLOCKED (unchanged env gate):** shell DNS-gated to `*.workers.dev` (`Could not resolve host`); the Browser pane denies the un-approved `workers.dev` origin (non-interactive = no approval card can be accepted) and a cross-origin `/health` fetch from `pages.dev` is CORS-blocked (`Failed to fetch`).
- **Worker layer verified in-repo instead:** source VERSIONs access-relay `auth-33-cse-brave`, cv-proxy/demo-proxy `3.8.3-gemini-flash-ramble`, docx-worker `1.14.161-leadin-underline` — all identical to 07-16's live-verified state. Last worker deploys were both 07-16 (`29465290683`/`29463344356`); no worker `workflow_dispatch` since → **no worker drift**. `/health` re-attest still owed with a working Browser pane / un-gated network.

## The reconcile (docs only — the meaningful increment this run)
Two **released** day-session fixes were documented **nowhere** in `docs/` (only in commit messages + test files) — a rule-7 gap. Both are live-served + suite-covered; now registered in ACTIVE_BUGS (top) + OPEN_REGISTER (2026-07-19 STATUS ADVANCE) + FEATURES_REGISTRY (increment 27):

1. **EXPORT-PDF-PANEL-WORKER-001** (PWA `1.51.1556`, commit `bea9cf6`). With a side panel open (e.g. Analysis tab) the app's PDF-export button is unmounted, so the preview modal's "Save as PDF" `querySelector` returned null and fell back to the browser **printer** instead of the CloudConvert docx-worker (DOCX was unaffected — it already had the symmetric direct-worker fallback). Fix: `antcv-pdf-preview-gate.js` calls `window.exportPdfViaWorker` directly when the app button is absent, honouring the same `__antcvUseServerPdf` policy and adding the DEMO watermark to the from-storage DOCX fallback; `app.js`/`app.src.js` expose `__antcvUseServerPdf` + `__antcvDemoActive`. Test `export-pdf-panel-worker.test.mjs` (7 checks). Corroborated by auto-memory `export-toolbar-preview-tab-gated`.
2. **MERGE-COMPONENT-SWALLOW-001** (PWA `1.51.1557`, commit `8633d8e`). A regenerated CV showed BOTH a merged role ("System Architect & Change Request Lead") AND its bare component ("System Architect") — `dedupeRoles` is exact-title-only (containment removed by ROLE-DECOMP-001 for over-merging). Fix: `swallowMergedComponents` in `antcv-sections-normalize-415.js` drops the bare component when a role title is an explicit `X & Y`/`X / Y`/`X and Y` merge and another role's exact title equals X or Y (same company, overlapping years); space-aware ("R&D" survives); wired after `dedupeRoles`, before `roleCanonTitles`. Test `merge-component-swallow.test.mjs` (3 owner cases).

## New finding (parallel-session in-flight — NOT actioned)
- **relay HYGIENE-CATEGORY-DOWNGRADE-001** (commit `965ca92`, "targeted app never downgraded to unsolicited"): committed to main but the worker is **NOT deployed** (dispatch-only) AND its VERSION was **not bumped** (still `auth-33-cse-brave`). Once deployed, `/health` can't attest it — a repeat of the 07-16 LEAD-UNDERLINE version-bump-omission pattern. **Deploy + version-bump owed by the owner/day session** (their active lane; one-deployer-at-a-time rule → not touched here). `1.51.1558` itself is likewise the day session's own to register.

## Per-band / per-row status (all open rows — unchanged from 07-17 except the reconcile above)
- **A1 GEN-BACKGROUND-001 (rows 38/38a):** engine + `antcv-gen-memo.js?v=1.51.134` live-served. Flip-default **BLOCKED** — needs a real mobile foreground-gen A/B.
- **A2 TAB/DEVICE ISOLATION (row 39a):** legs 1+2 wired-verified (downgrade-guard source + `antcv-pointer-stale-guard.js` live); relay `/health` re-attest deferred with the worker layer. Leg 3 (**row 19**) **BLOCKED** — 2nd physical device.
- **B1 SO-003 (row 40):** shipped 1.51.138 + suite-covered.
- **B2 SO-004 (row 41):** **BLOCKED** — needs a real-Android React #185 crash capture (probe shipped 1.51.160, waiting on a live crash).
- **C1 GEN-LANGFAB-001 (row 42):** `antcv-lang-fabrication-guard.js?v=1.51.136` live-served.
- **C2 CA-006 (row 43) / C3 JD-ANALYSIS-PRINT-001 (row 44):** shipped + suite-covered.
- **D1 PERF-001 (row 45):** **OPEN** — single-owner cloud-sync profiling area, no clean repro, no speculative edit.
- **D2 GEN-MODELROLE-001 (row 39):** config-shipped + VERIFIED-LIVE 2026-07-06; live D1 role-split re-confirm deferred (role-labelled calls don't log by design).
- **Rows 93/94 (META-STICK / LOAD-EDITOR):** SHIPPED + LIVE (reconciled 07-15); owner eyeball still owed.
- **Rows 95/96 (job-tracker):** req-1167 resolved (07-16); row 96 SuccessFactors title-only scrape = OPEN proxy JD-fetch fix (deploy-gated).
- Content-density frontier rows (25/27 family): content-bound, not rule failures.
- No row found implemented-but-still-open. No code shipped by this nightly.

## Owner-verify / owner-decision lists
- **Owner-decision:** A1 flip-default proposal (needs a real mobile foreground gen A/B first — not runnable headlessly).
- **Owner action:** deploy + version-bump the relay HYGIENE-CATEGORY-DOWNGRADE-001 fix (day-session lane).
- **Owner eyeball owed:** rows 93/94 (JD-swap Novo-ghost gone; tracker-open→Editor restores saved cv/cl).
- **Env fix owed to unblock nightly worker-attest:** approve the `*.workers.dev` origin for the Browser pane, or un-gate `workers.dev` DNS in the shell.

## Blocked / not-done (with reason)
- Worker `/health` live-attest — env-gated (DNS + Browser-pane origin approval + CORS).
- A1 flip-default, SO-004 — need a real mobile device / live foreground gen.
- Row 19 leg 3 — needs a 2nd physical device.
- PERF-001 — no clean repro; single-owner area; no speculative edit.
