# AntCV Nightly Report — 2026-07-16

**Type:** verify + report, plus one small verified worker fix.
**Model:** Opus 4.8 (single session, desktop worktree `elastic-raman-dbeded`).
**Baseline:** PWA `1.51.1524-leadin-underline`; main in sync with origin (fetch+rebase clean, "Already up to date").
**Shipped this run:** docx-worker `1.14.160-edu-row-cjlr-export` → **`1.14.161-leadin-underline`** (LEAD-UNDERLINE-VERSION-BUMP-001).

## Gate results (all green, no regression)

| Gate | Result |
|---|---|
| PWA suite (`node scripts/run-tests.mjs pwa`) | **1313/1313 pass**, 0 fail, ~18s |
| boot-smoke (`pwa/test/boot-smoke.mjs`) | **OK** — glDemo=function, errors=0 |
| Personal-panel stability probe | **DIAG PASS** — 0 mutations/8s, 0 page errors |
| Panel button-audit pass 2 | **195 buttons / 0 throws / 0 DEAD / 0 page errors** (112 active, 56 not-visible-or-disabled, 12 skipped-dangerous, 15 ui-only) — no regression vs 07-15 |

`app.js` head confirmed `(()=>{window` (no `"use strict"`) — minified-sacred invariant intact.

## Live-verify (Browser pane — shell is 403-gated to CF workers per the standing sandbox constraint)

- **PWA live = TARGET** `1.51.1524-leadin-underline` → **no version regression**.
- `app.js?v=1.51.1524-leadin-underline` served (200), head `(()=>{window`, ~1.07 MB, contains the `antcv:disable-jd-meta-reset` guard.
- A1/A2/content guard sidecars **all live-served**: `antcv-gen-memo.js?v=1.51.134` (A1 / row 38), `antcv-pointer-stale-guard.js?v=1.51.334` (row 39a leg 2), `antcv-lang-fabrication-guard.js?v=1.51.136` (row 42), `antcv-react-islands.js?v=1.51.1425-tracker-open-claim` (row 94).
- **access-relay** `auth-33-cse-brave` (`/health` ok:true); `/api/applications/999999` GET → **401 unauthenticated** → the AUTOSAVE-NO-DOWNGRADE-001-guarded PUT route (row 39a leg 1) is live + auth-gated, confirmed **without** a mutating downgrade PUT (would touch a real account; memory `live-verify-mutates-real-account`).
- **cv-proxy** `3.8.3-gemini-flash-ramble` (unchanged since 07-15).
- **docx-worker** advanced this run `1.14.160-edu-row-cjlr-export` → `1.14.161-leadin-underline`.

## The one fix — LEAD-UNDERLINE-VERSION-BUMP-001

**Symptom (caught during live-verify):** docx-worker `/health` reported `1.14.160-edu-row-cjlr-export` — the version *before* the LEAD-UNDERLINE-001 export code was added (commit `151f129`, 2026-07-16 01:07). At first read this looked like the lead-underline export leg was never deployed.

**Investigation (GitHub Actions, no mutating calls):**
- `151f129` added the lead-underline code to `workers/docx-worker/src/index.js` (renderRichBlock `make` lead `TextRun` emitting `underline:{type:SINGLE, color:leadUlHex}`) + a test — but did **not** bump the `VERSION` constant.
- Deploy run `29463344356` (`workflow_dispatch`, TARGET/CONFIRM=`docx-worker`, 01:08:34, build `ced11789`, job success, "Uploaded docx-worker") deployed docx-worker from `151f129`'s tree → **the lead-underline export code IS live**.
- Because `VERSION` was un-bumped, `/health` (+ the `X-AntCV-Worker-Version` header + `_workerVersion` handed to `generateDocx`) all still said `1.14.160`, so the deploy could not be attested from `/health` — it forced Actions log archaeology to confirm.

**Fix:** bumped `VERSION` → `1.14.161-leadin-underline` (`workers/docx-worker/src/index.js:28758`, single-occurrence edit, verified) → committed (`3c25b2e`, pushed fast-forward to main) → redeployed via `gh workflow run deploy.yml -f target=docx-worker -f mode=deploy -f confirm=docx-worker` (run `29465290683`, unit-tests+lint+deploy-worker all success on Linux) → live `/health` now reports **`1.14.161-leadin-underline`**.

**No behavioural change** — the export code was already live; this only makes `/health` truthful and future docx-worker deploys attestable.

**Durable lesson:** a docx-worker code change MUST bump `VERSION` in the same commit. The `1.14.x` string is the only `/health`-visible attestation that a worker deploy carried a change; an un-bumped worker code change is invisible to deploy verification.

**Gate discipline:** `node --check` OK; the LEAD-UNDERLINE-001 worker test green (`4 PASS`); PWA suite 1313/1313; CI unit-tests+lint green on Linux before deploy. The version-string edit is non-behavioural.

## Side finding (not fixed — pre-existing, environmental)

3 docx-worker diag tests are RED **locally on Windows**: `diag-pageflow-export.mjs` ("repeatHeader: cont row min shrunk"), `diag-photo-bridge-export.mjs`, `diag-spacing-linkedin-export.mjs`. Proven pre-existing: `git stash` of my change → the same tests fail identically on the unmodified base `65c089b`. CI unit-tests passed on Linux for both the 1.51.1524 deploy and tonight's redeploy. This is the known Windows-CRLF-fragile export-geometry diag class (memory `eol-fragile-tests-desktop-vs-cloud`), **not** a regression and unrelated to the version bump. Left as-is (would need CRLF normalization in those diag harnesses — a separate low-priority cleanup, not tonight's lane).

## Per-band coverage (full register status)

**Band A — MOBILE & TAB ISOLATION (P0)**
- **A1 GEN-BACKGROUND-001 (rows 38/38a):** engine + Approach A shipped, gen-memo sidecar live-served. Verify-first A/B + flip-default proposal need a **real mobile foreground gen** — cannot be produced headlessly. **BLOCKED (owner + real device).** No flip-default proposal (owner-gated, needs the A/B evidence).
- **A2 TAB/DEVICE ISOLATION (row 39a):** legs 1+2 re-verified live (downgrade route 401-auth-gated + guard in source; pointer-stale-guard sidecar live-served). **VERIFIED-LIVE.** Leg 3 (row 19, two physical devices) **BLOCKED (needs a 2nd device).**

**Band B — DATA LOSS / CRASH**
- **SO-003 (row 40):** loss-guard belt shipped 1.51.138 — **VERIFIED (suite-covered).**
- **SO-004 (row 41):** React #185 — no headless repro; on-device capture probe shipped 1.51.160 awaiting a live crash. **BLOCKED (needs real Android).**

**Band C — CONTENT**
- **GEN-LANGFAB-001 (row 42):** guard sidecar live-served — **VERIFIED-LIVE (1.51.136).** Owner-verify on a fresh gen still owed.
- **CA-006 (row 43):** shipped 1.51.139 — **VERIFIED (suite-covered).**
- **JD-ANALYSIS-PRINT-001 (row 44):** shipped 1.51.137 — **VERIFIED (suite-covered).**

**Band D — PERF / DESIGN**
- **PERF-001 (row 45):** **OPEN, not attempted** — cloud-sync setTimeout leg needs app.js profiling (single-owner area; no clean repro tonight, no speculative edit).
- **GEN-MODELROLE-001 (row 39 / D2):** **VERIFIED-LIVE** (proxy parses `env.MODEL_ROLES`; cv-proxy 3.8.3 live).

**Band E — STANDING:** all four probes run + green (table above). Register staleness sweep executed (this report + the OPEN_REGISTER 2026-07-16 block + the docx-worker fix). Export/preview role-merge parity unchanged since its 1.51.154 close — no new regression surfaced by the probes.

**Rows 93/94 (META-STICK / LOAD-EDITOR):** remain **SHIPPED + LIVE-VERIFIED** (reconciled 07-15); owner-eyeball repro still owed on both.

## Owner-verify list (owed, cannot be done headlessly)
- Row 93: live JD-swap repro — confirm the Novo-ghost company no longer sticks after a fresh JD upload.
- Row 94: tracker-open → Editor — confirm saved cv/cl sections restore (no unsolicited fallback).
- Row 42 (GEN-LANGFAB): eyeball one fresh gen for correct languages.
- A1: real mobile gen A/B (start → background/lock → foreground auto-resume; mid-run reload resume; output matches a flag-off gen) before any flip-default.
- LEAD-UNDERLINE-001: eyeball one real DOCX export with a lead-in underline to confirm the `w:u` renders (code+deploy now attested via `/health` 1.14.161).

## Owner-decision list
- **A1 flip-default** (opt-in `antcv:gen-resume=1` → default-on): still gated on the mobile A/B. Not proposed tonight — no evidence to back the flip yet.

## Rows blocked by environment (unchanged, for the record)
- **19 / 39a-leg3:** two physical devices.
- **41 (SO-004):** real Android crash capture.
- **38 / A1 flip-default:** real mobile foreground long-gen.
- Density-frontier rows (27/57/59/62/86/88): content-bound; need the networked density-sweep pipeline (relay/proxy mutation of real saved apps) — sandbox shell can't reach CF workers; belongs to a networked desktop/cloud-Routine session.

## Files changed
- `workers/docx-worker/src/index.js` — `VERSION` 1.14.160 → 1.14.161-leadin-underline (commit `3c25b2e`, deployed run 29465290683).
- `docs/qa/ACTIVE_BUGS.md` — LEAD-UNDERLINE-VERSION-BUMP-001 top entry.
- `docs/qa/OPEN_REGISTER.md` — 2026-07-16 staleness-sweep block + per-band status.
- `docs/FEATURES_REGISTRY.md` — increment (25).
- `docs/qa/NIGHTLY_2026-07-16_REPORT.md` — this report.

Worker-only code change (1.14.x namespace, independent of the PWA 1.51.x cache-bust quintet) → no PWA cache-bust, no shift-claim (no active session on docx-worker; the shift ranges are all stale PWA 1.51.x claims). Synced first; pushed fast-forward, no force.
