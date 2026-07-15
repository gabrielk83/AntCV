# AntCV Nightly Report — 2026-07-15

**Type:** verify + report (one register-reconcile; no code ship).
**Model:** Opus 4.8 (single session, desktop worktree `relaxed-gates-2e5276`).
**Baseline:** PWA `1.51.1504-slogan-unsol-generic`; main in sync with origin (fetch+rebase clean, "Already up to date").

## Gate results (all green, no regression)

| Gate | Result |
|---|---|
| PWA suite (`node scripts/run-tests.mjs pwa`) | **1313/1313 pass**, 0 fail, ~20s |
| boot-smoke (`pwa/test/boot-smoke.mjs`) | **OK** — glDemo=function, errors=0 |
| Personal-panel stability probe | **DIAG PASS** — 0 mutations/8s, 0 page errors |
| Panel button-audit pass 2 | **195 buttons / 0 throws / 0 DEAD / 0 page errors** (no regression; count varies by panel state, was 206 on 07-13) |

`app.js` head confirmed `(()=>{` (no `"use strict"`) — minified-sacred invariant intact.

## Live-verify (Browser pane — shell is 403-gated to CF workers per the sandbox constraint)

- **PWA live = TARGET** `1.51.1504-slogan-unsol-generic` → **no version regression**.
- `app.js?v=1.51.1504-slogan-dangle-cap` served (200) — not a stale-SW mask.
- A2 / content guard sidecars **all live-served**: `antcv-pointer-stale-guard.js?v=1.51.334-unsol-pillar` (row 39a leg 2), `antcv-lang-fabrication-guard.js?v=1.51.136` (row 42), `antcv-gen-memo.js?v=1.51.134` (A1 / row 38).
- **access-relay live** `auth-33-cse-brave` (`/health` 200; advanced past the 07-11/07-13 `auth-30`). `/api/applications/:id` returns **405 on GET** → the AUTOSAVE-NO-DOWNGRADE-001-guarded PUT route (row 39a leg 1, source line 3366) is live and method-gated — confirmed **without** a mutating downgrade PUT (would touch a real account; memory `live-verify-mutates-real-account`).
- **cv-proxy live** `3.8.3-gemini-flash-ramble` (advanced past the 3.7.2 noted 07-11/07-13).

## Register reconcile (the one substantive change this run)

**Rows 93 (META-STICK-001) + 94 (LOAD-EDITOR-UNSOLICITED-001)** were stale in `OPEN_REGISTER.md` — still marked "deferred to a live repro" / P1-open, while `ACTIVE_BUGS.md` (top entry, commit `8a11957`, PWA 1.51.1344) and auto-memory already record both as SHIPPED. Verified against current code + live serve, then advanced both to **SHIPPED + LIVE-VERIFIED**:

- **Row 93** — the meta-reset carve-out (kill switch `antcv:disable-jd-meta-reset`, default-ON) is in BOTH bundles. The `META-STICK` *comment* is not in the minified `app.js` (normal for surgical minified mirrors — the comment isn't carried), but the functional guard `getItem("antcv:disable-jd-meta-reset")` + the `lo({company:"",role:"",subtitle:"",greeting:"",opening:""})` reset ARE (3 call sites). Live app.js (`?v=1.51.1504`, fetched 200) contains the guard + 7 meta-reset call sites.
- **Row 94** — fixed via the island `claimTabAppId` path; live-served as `antcv-react-islands.js?v=1.51.1425-tracker-open-claim` (200). The identifier is Vite-mangled in the minified bundle, so the cache-bust version tag (also at index.html:1168) is the reliable evidence.

This is the register-staleness sweep (Band E standing obligation) doing its job: a shipped-but-mis-marked pair caught and corrected. Owner-owed on both: one live repro pass to eyeball behaviour (code + live-serve are confirmed).

## Per-band coverage

**Band A — MOBILE & TAB ISOLATION (P0)**
- **A1 GEN-BACKGROUND-001 (rows 38/38a):** engine + Approach A shipped (gen-memo sidecar live-served). Verify-first A/B and the flip-default proposal both need a **real mobile foreground gen** — cannot be produced headlessly. **BLOCKED (owner + real-device).** No flip-default proposal pushed (owner-gated, requires the A/B evidence first).
- **A2 TAB/DEVICE ISOLATION (row 39a):** legs 1+2 re-verified live this run (downgrade route 405-gated + guard in source; pointer-stale-guard sidecar live-served). **VERIFIED-LIVE.** Leg 3 (row 19, two real physical devices) **BLOCKED (needs a 2nd device).**

**Band B — DATA LOSS / CRASH**
- **SO-003 (row 40):** loss-guard belt shipped 1.51.138 — **VERIFIED (shipped, suite-covered).**
- **SO-004 (row 41):** React #185 — no headless repro (documented in row 41). On-device capture probe shipped 1.51.160, awaiting a live crash. **BLOCKED (needs real Android).**

**Band C — CONTENT**
- **GEN-LANGFAB-001 (row 42):** guard sidecar live-served — **VERIFIED-LIVE (shipped 1.51.136).** Owner-verify on a fresh gen still owed.
- **CA-006 (row 43):** shipped 1.51.139 — **VERIFIED (shipped, suite-covered).**
- **JD-ANALYSIS-PRINT-001 (row 44):** shipped 1.51.137 — **VERIFIED (shipped, suite-covered).**

**Band D — PERF / DESIGN**
- **PERF-001 (row 45):** partial (export-preview handler deferred 1.51.158); cloud-sync setTimeout leg needs app.js profiling — **OPEN, not attempted this run** (single-owner app.js area; no clean repro tonight, no speculative edit).
- **GEN-MODELROLE-001 (row 39 / D2):** **VERIFIED-LIVE** (proxy parses `env.MODEL_ROLES`; cv-proxy 3.8.3 live; unchanged since 07-06 close).

**Band E — STANDING:** all four probes run and green (table above); register staleness sweep executed (rows 93/94 reconciled + this report). Export/preview role-merge parity unchanged since its 1.51.154 close — no new regression surfaced by the button/panel probes.

## Owner-verify list (owed, cannot be done headlessly)
- Row 93: live JD-swap repro — confirm the Novo-ghost company no longer sticks after a fresh JD upload.
- Row 94: tracker-open → Editor — confirm saved cv/cl sections restore (no unsolicited-template fallback).
- Row 42 (GEN-LANGFAB): eyeball one fresh gen for correct languages.
- A1: real mobile gen A/B (start → background/lock → foreground auto-resume; mid-run reload resume; output matches a flag-off gen) before any flip-default.

## Owner-decision list
- **A1 flip-default** (opt-in `antcv:gen-resume=1` → default-on): still gated on the mobile A/B above. Not proposed tonight — no evidence to back the flip yet.

## Rows blocked by environment (unchanged, for the record)
- **19 / 39a-leg3:** two physical devices.
- **41 (SO-004):** real Android crash capture.
- **38/74C-C:** real mobile foreground long-gen (SSE background-stall).
- Density-frontier rows (27/57/59/62/86/88): content-bound, need the networked density-sweep pipeline (relay/proxy mutation of real saved apps) — sandbox shell can't reach CF workers; belongs to a networked desktop/cloud-Routine session.

## Files changed
- `docs/qa/OPEN_REGISTER.md` — rows 93/94 advanced to SHIPPED+LIVE; 2026-07-15 staleness-sweep preamble block added.
- `docs/qa/NIGHTLY_2026-07-15_REPORT.md` — this report.

No code/asset/worker change → no cache-bust, no deploy, no shift claim (docs-only, synced first).
