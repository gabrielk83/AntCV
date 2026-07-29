# AntCV nightly — 2026-07-06 (verify-first run under Trackman deadline)

Follows the standing 2026-07-05 band plan (`NIGHTLY_2026-07-05_PROMPT.md`) + `OPEN_REGISTER.md`.
Model: Opus 4.8 (1M), single desktop session, no parallel worktrees this run.

## Session posture (why this was a verify/sweep run, not a ship run)

Two hard constraints set at session start, both from the uncommitted `ACTIVE_BUGS.md`
TRACKMAN-DEADLINE consolidated note (preserved through the rebase, not lost):

1. **Trackman PM-Hardware PDF is due 08:00 today (2026-07-06)** — the owner exports it from the
   live app in the morning. Nothing tonight may destabilize production before that.
2. **Brand-fit-per-app leak is NOT fixed** (per-app `style_config` work is uncommitted in the
   `AntCV-brandfit-scope` worktree; the live `ALTER TABLE application ADD COLUMN style_config`
   has NOT been run). Practical effect: **running a fresh "Generate" for any other application
   overwrites Trackman's global colour keys.**

⇒ **No fresh production generations tonight** (would clobber Trackman colours) and **no risky
app.js/worker ships under deadline**. This run = verify-first (code + live telemetry), standing
headless sweeps, register reconcile, suite-green. Nearly every band item was already SHIPPED at
1.51.192 and only awaited a verify anyway, so this posture matches the actual open surface.

Baseline: PWA **1.51.192-babel-fish** · proxy **3.7.2-billing-cascade** · access-relay
**auth-26-per-style-kernels** · **suite 1163/1163 green** · app.js sacred-bundle intact
(`startsWith("(()=>{"`, no `"use strict"`).

---

## BAND A — MOBILE & TAB ISOLATION (P0)

**A1 — GEN-BACKGROUND-001 (rows 38/38a). Status: VERIFIED-PRESENT; live A/B BLOCKED by deadline.**
`antcv-gen-memo.js` present and loaded (1 load line in index.html); Approach A shipped 1.51.133/134,
now at 1.51.192; 11 memo tests inside the green suite. The required verification is a **real-mobile
A/B with `antcv:gen-resume=1`** (start → background → foreground auto-resume; mid-run reload resume;
output matches a flag-off gen). That A/B requires a fresh generation on a real device — **blocked
tonight** because a fresh gen risks Trackman's brand colours (constraint 2). The flip-default proposal
stays gated behind that clean A/B. **No gen-core code touched** (spec rule: no gen-core change without
a fresh-gen A/B).

**A2 — TAB/DEVICE ISOLATION residuals (row 39a). Legs 1+2 VERIFIED-DEPLOYED; leg-3 owner-gated.**
- Leg 1 AUTOSAVE-NO-DOWNGRADE-001 (relay): guard present in deployed source
  (`workers/access-relay/src/index.js:2905-2965`), deployed version `auth-26-per-style-kernels`
  (matches register auth-26). **Did NOT run a live downgrade-PUT** — that mutates a real application
  row and would risk Trackman's data under deadline; verified by code + version instead.
- Leg 2 PTR-STALE-GUARD-001 (client): `antcv-pointer-stale-guard.js` present + loaded, live at
  1.51.192 (>1.51.135), suite-locked tests green. Did NOT run a live two-tab A/B (needs the owner's
  real logged-in production session; deadline risk).
- Leg 3 (row 19) two-real-device test: **owner-gated** — needs an actual second physical device,
  cannot be faked headlessly (a second tab is leg 2, already covered).

## BAND B — DATA LOSS / CRASH

**B1 — SO-003 (row 40). Status: SHIPPED 1.51.138, VERIFIED-PRESENT.** `antcv-outcomes-loss-guard.js`
present + loaded; loss-guard tests in the green suite. No regression.

**B2 — SO-004 (row 41). Status: TO DO — blocked, needs a live Android crash.** Probe shipped 1.51.160
(widened `antcv-debug-logger.js` #185 capture). No headless repro exists (diag-so004-capture.mjs maxed
4 setState/frame vs 50 threshold, 0 pageerrors) — the crash is a mobile-only reflow oscillation. Waiting
on the next real on-device crash to populate a capture. Nothing actionable headlessly tonight.

## BAND C — CONTENT CORRECTNESS

All three shipped; owner-verify on a fresh gen is **blocked by the deadline**, so verified by code +
suite presence tonight:
- **C1 GEN-LANGFAB-001 (row 42):** SHIPPED 1.51.136 — `antcv-lang-fabrication-guard.js` present +
  loaded, 9 tests green. Fresh-gen owner-verify deferred (deadline).
- **C2 CA-006 (row 43):** SHIPPED 1.51.139 — `antcv-candidate-preview-editor-341.js` present + loaded,
  Path-C header-whitelist guard; static-lock + Playwright regression in the suite.
- **C3 JD-ANALYSIS-PRINT-001 (row 44):** SHIPPED 1.51.137 — `antcv-analysis-report-pdf-360.js` present
  + loaded (render-present offscreen iframe fix); regression tests green.

## BAND D — PERF / DESIGN

**D1 — PERF-001 (row 45). Status: PARTIAL 1.51.158, unchanged.** Export-preview click handler deferred;
the cloud-sync setTimeout handler still needs app.js profiling. Not touched tonight (app.js profiling +
edit is exactly the deadline-risk class being avoided).

**D2 — GEN-MODELROLE-001 (row 39). Status: VERIFIED-LIVE ✓ (closes the verify ask).**
- `MODEL_ROLES = {"writer":"anthropic","supervisor":"mistral","coherence":"anthropic"}` present in the
  committed `[vars]` of BOTH `workers/proxy/wrangler.toml` and `workers/demo-proxy/wrangler.toml`.
- Both proxy sources parse it: `multi-llm.js:390` (`env.MODEL_ROLES`), `roleHeadOrder()` reorders the
  cascade head for roles `['writer','supervisor','coherence']`, consumed by `supervisor.js:337` and
  `gen-coherence.js:124`.
- Deployed proxy at **3.7.2-billing-cascade** — newer than the 2026-06-13 var commit; wrangler applies
  `[vars]` on every deploy ⇒ the deploy carried the var.
- D1 `llm_calls` (last 7d, through 2026-07-05 23:18) confirms the providers are live and task-split:
  **mistral** serving parse_jd (75) + consensus_poll (127); **claude/anthropic** serving analyze_fit,
  enrich, long_context. No `writer`/`supervisor`/`coherence` task rows — consistent with the
  supervisor route being advisory and deliberately NOT logging to `llm_calls` (memory
  `supervisor-role-not-live`); telemetry-absence there proves nothing and is expected.

## BAND E — STANDING COVERAGE (run every night)

- **E1 register staleness sweep:** see per-row table below. The oldest `verified:no` rows (1, 3, 20,
  35-37) are all owner-gated (need a real CloudConvert re-export / fresh regen / owner eyeball) and
  cannot be closed tonight without risking the Trackman deliverable — recorded as blocked-by-deadline.
  Rows 16/17/23 freshly re-verified on 1.51.192 (below). Row 9 stays a genuine OPEN feature gap
  (confirmed 07-05).
- **E2 settings-panel stability (row 17):** re-ran `diag-settings-panels-probe.mjs` on 1.51.192 →
  **DIAG PASS** — Personal/Account/Layout all **0 mutations/6s** at rest, 0 page errors. Holds 29
  patch versions past the 1.51.163 verification.
- **E3 button-audit pass 2 (row 23):** re-ran `diag-panel-button-audit.mjs` on 1.51.192 →
  196 buttons | 118 active, **51 not-visible** (improved from 55 on 07-05), 12 dangerous-skipped,
  14 ui-only, **0 throws, 0 page errors**. One DEAD candidate labelled `"100%"` (no store write, no
  DOM delta) — assessed as the register's known idempotent-reset false-positive class (a
  display/reset control clicked from its resting state), NOT filed as a bug; re-check next audit.
  Preview-only key list is all legit UI-state (settingsTab/subTab/analytics counts/probes/mainOverflow/
  headline userTouched), not export-parity gaps.
- **E4 export/preview parity (row 34):** ROLE-MERGE-STORED-001 done 1.51.154 —
  `antcv-role-merge-stored.js` loaded; `role-merge-stored.test.mjs` green in the suite. No regression.

---

## Per-register-row status (this run)

| Row | Item | Status this run |
|-----|------|-----------------|
| 1 | Quick-gen / CV 3-page convergence | BLOCKED-tonight (owner-gated, needs real export) |
| 2 | SW-projects line-end overflow | DIAGNOSED+LOCKED (unchanged); residual → row 25 |
| 3 | Floating spine flag-on | BLOCKED-tonight (owner re-export gated) |
| 6 | Wizard/Settings UX owner gate | owner-gated (unchanged) |
| 8 | Kernel v2 remainder | owner/model-gated (unchanged) |
| 9 | Cluster demand model | OPEN feature gap (confirmed 07-05; unbuilt server pipeline) |
| 16 | Sidebar justify↔left flap | VERIFY-LIVE-only (automated repro clean 07-05; unchanged) |
| 17 | Settings sweep cost | RE-VERIFIED tonight on 1.51.192 — 0 mut/6s all 3 panels, DIAG PASS |
| 18 | Anita demo residuals | session-state-gated (unchanged) |
| 19 | JD-scope two-real-device | owner-gated (needs 2nd physical device) |
| 20 | Owner verify list (6 items) | BLOCKED-tonight (owner hard-refresh + regen) |
| 22 | CL slogan rich_block ph2 | spec-first, owner-gated (unchanged) |
| 23 | Button audit pass 2 | RE-RAN tonight on 1.51.192 — 0 throws/0 errors; not-visible 55→51; 1 benign DEAD false-pos |
| 24 | Analytics buttons | owner-verify (server+client fixed; unchanged) |
| 25 | Table geometry parity | BLOCKED-tonight (real CloudConvert PDF gated) |
| 26 | Tools sidebar compress | partial (owner gold-text rule remainder; needs fresh gen) |
| 27 | Orphan sweep v3 | partial (real-PDF verify gated; needs fresh export) |
| 28 | NIL gen adaptation | partial (needs fresh NIL gen — BLOCKED by Trackman) |
| 29 | NIL state-stick leg C | partial (leg C = saved-content revert; needs live setItem probe on a gen) |
| 30 | LLM image routing | DONE (both proxies deployed; unchanged) |
| 31 | Poisoned NIL row repair | write-half done 1.51.155; row-repair owner-gated |
| 32 | CL platform-signals | DONE (unchanged) |
| 33 | Export align parity | DONE (unchanged) |
| 34 | Export/preview parity | DONE 1.51.154 — E4 re-confirmed present + suite-green |
| 35-37 | Regen-confirm trio | BLOCKED-tonight (need a fresh regen to confirm-and-close) |
| 38/38a | GEN-BACKGROUND-001 | VERIFIED-PRESENT; live mobile A/B BLOCKED by deadline |
| 39 | GEN-MODELROLE-001 | **VERIFIED-LIVE ✓** (var deployed + source parses + D1 split live) |
| 39a | Tab/device isolation | legs 1+2 VERIFIED-DEPLOYED (code+version); leg 3 owner-gated |
| 40 | SO-003 | SHIPPED 1.51.138 — VERIFIED-PRESENT (loaded + suite) |
| 41 | SO-004 | TO DO — blocked, needs live Android crash to populate probe |
| 42 | GEN-LANGFAB-001 | SHIPPED 1.51.136 — VERIFIED-PRESENT; fresh-gen owner-verify deferred |
| 43 | CA-006 | SHIPPED 1.51.139 — VERIFIED-PRESENT (loaded + suite) |
| 44 | JD-ANALYSIS-PRINT-001 | SHIPPED 1.51.137 — VERIFIED-PRESENT (loaded + suite) |
| 45 | PERF-001 | PARTIAL 1.51.158 (unchanged; app.js profiling deferred past deadline) |
| 46-48 | Mobile panel/topbar | CLOSED (unchanged) |
| 49 | Sidebar group page-break | not started (dedicated docx-worker session) |

## Owner-decision list (morning)
- **A1 flip-default:** propose making `antcv:gen-resume` default-on once a clean real-mobile A/B is
  done. Needs the owner to run one A/B on a phone (start gen → lock → unlock → confirm auto-resume +
  output matches flag-off). Held pending that.
- **Brand-fit-per-app:** the `AntCV-brandfit-scope` worktree fix + the live `ALTER TABLE ... ADD
  COLUMN style_config` remain uncommitted/unrun by design. Pick up + rebase onto current main AFTER
  the Trackman PDF is exported (running a fresh Generate for another app before then clobbers
  Trackman colours). Do not run the live ALTER without fresh confirmation.

## Owner-verify list (deferred by deadline — safe to run after the Trackman export)
- C1 GEN-LANGFAB / C2 CA-006 / C3 analysis-PDF: confirm on the next fresh targeted gen/export.
- Rows 20 (6 sub-items), 25 (table geometry), 27/28 (NIL ~1.5pp export) — all fresh-export gated.
- Rows 35-37 regen-confirm trio: confirm on the next clean regen, then close.

## What did NOT change
No code, no app.js/app.src.js, no worker, no wrangler, no cache-bust, no push of app assets.
Doc-only updates: this report + `OPEN_REGISTER.md` refresh dates + `ACTIVE_BUGS.md` nightly entry.
Suite still 1163/1163.
