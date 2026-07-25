# AntCV nightly — 2026-07-25 (DESKTOP dispatch, unattended, Opus 4.8)

Substrate: desktop clone, isolated worktree. Second same-date run — the earlier
2026-07-25 run was a GitHub Actions CI sweep (verify + attest + reconcile) that filed a
verified-ready fix it was **permission-blocked** from pushing. This desktop run **ships that
owed fix** and re-attests standing state.

## Preflight + sync
- `routine-preflight.mjs start` → **WORKSPACE DIRTY (exit 3)**: the owner's main clone carried an
  untracked `out/` build dir. Per STANDING RULE 0, did NOT edit/rebase that clone — worked in the
  pre-assigned isolated worktree (`.claude/worktrees/determined-cannon-8d4c64`).
- **SYNC FIRST:** the worktree branch sat at a stale tip (`97d267d`, a superseded shift-ledger
  release for versions 2921-2940). `git fetch` showed origin/main **164 commits ahead** at `9d137e5`
  (versions up to 3761). Reset the branch to `origin/main` (adopting all 164 remote commits, dropping
  the one stale local shift commit — a fast-forward sync, NOT a regression of main). Clean at
  `9d137e5` throughout.
- Diff `2df71370` (CI-sweep base) → `9d137e5` (my base) = **docs-only** (the CI report + register
  batch), no `pwa/app/worker` code — so today's CI standing-probe results apply to the identical
  production code.

## SHIPPED — CI-COVERAGE-GAP-RELAY-DEMOPROXY-001 (owed one-file fix, LANDED to main)
The `unit-tests` job in `.github/workflows/deploy.yml` ran proxy + PWA + 3 docx `.mjs` only — it never
ran the **access-relay** (128 tests) or **demo-proxy** (33 tests) unit suites. access-relay is
actively changed (auth / JD-cross-app-guard / cluster-demand / cost — `auth-36` shipped 07-24), so a
regression in its 128 tests would pass CI and deploy uncaught.

**Fix (exact patch the CI run authored):** two steps appended after the DOCX-worker step —
```yaml
      - name: Access-relay unit tests (auth / JD-guard / cluster-demand / cost)
        run: node --test --test-force-exit workers/access-relay/tests/*.test.mjs
      - name: Demo-proxy unit tests (demo enforcement / model-table / cost)
        run: node --test --test-force-exit workers/demo-proxy/test/*.test.mjs
```

**Why CI could not ship it, why desktop can:** the CI GitHub App token lacks `workflows` permission
(push rejected on branch AND direct). The desktop push uses the owner's git credentials, which have it.

**Verification (verify-first, Rule 2 + Rule 5):**
- access-relay suite re-run green on main: **128/128** (~0.83s), pure `node --test`, no browser.
- demo-proxy suite re-run green on main: **33/33** (~0.55s).
- Gap confirmed in `deploy.yml` (steps 97-104) and both test-file globs confirmed non-empty.
- YAML structurally re-validated: both new steps present, **no tab chars**, indentation matches the 3
  sibling steps exactly (6-space `- name:`, 8-space `run:`).
- Full PWA suite **1470/1470**.
- No PWA asset / `app.js` / `app.src.js` / worker touched → cache-bust quintet N/A, **no version
  number consumed**, no shift claim needed.
- Note: `.github/workflows/deploy.yml` is a trigger path, so this push re-runs CI (which now exercises
  the two new suites) and triggers a **no-op PWA redeploy of unchanged assets** (harmless — Pages
  keeps every deploy, one-click rollback; no `pwa/**` changed).

## Standing state re-attested (from today's CI sweep on identical production code + local re-run)
- **PWA suite:** 1470/1470 (re-run locally this run).
- **app.js integrity:** head `(()=>{window`, 0 `"use strict"` — minified-sacred intact.
- Cited from the 07-25 CI sweep (same code, `2df71370` == my base minus docs): boot-smoke OK
  (glDemo=function, 0 errors); row-17 settings-panels probe DIAG PASS (Personal/Account/Layout 0
  mut/6s, rootFound=true); copenhagen overflow-storm repro DIAG PASS (band ON 2 writes/30px bounded);
  button-audit **187 buttons / 0 page errors / 0 THROWS / 0 DEAD** (`PANEL_BUTTON_AUDIT_2026-07-25.md`);
  model-table freshness 10/10; all 4 workers + PWA live-attested via `*.karp-gabriel-a.workers.dev`
  with NO drift (access-relay `auth-36`, cv/demo-proxy `3.8.4`, docx-worker `1.14.171`, PWA
  `1.51.3743`). Not redundantly re-run headlessly here — byte-identical production code = no new signal.

## Band coverage this run (per the 07-05 standing plan)
- **Band A (mobile & tab isolation — P0):** BLOCKED for headless advance. A1 GEN-BACKGROUND (rows
  38/38a) needs a REAL mobile foreground gen A/B — no physical device. A2 tab isolation: legs 1+2
  shipped + attested (relay downgrade-guard live in `auth-36`; PTR-STALE-GUARD live); leg 3 (row 19)
  needs a 2nd physical device. No safe headless advance; the live downgrade-PUT curl mutates the real
  account (per memory), not run.
- **Band B/C/D:** SO-003/SO-004 need a real field-commit repro; GEN-LANGFAB/CA-006/JD-ANALYSIS-PRINT
  are content-gen bound; PERF-001 is single-owner profiling; GEN-MODELROLE env attested live in the CI
  sweep. None newly headlessly-actionable.
- **Band E (standing, every run):** register staleness sweep + panel-probe + button-audit + parity all
  green today (CI sweep on identical code); the one genuinely-actionable owed item — the CI-wiring gap
  — was SHIPPED this run.

## Owed / owner actions (unchanged, carry-forward)
- Owner live-verify (optional, deployed build): CPH-STORM fix on a real multi-page CV + salmon; the
  SPEC-SHORTER / CPH-PHOTO-124 / APP-LOAD-NO-RETRANSLATE / JD-CROSS-APP-GUARD 07-24 changes.
- Owner data actions from 07-24 evening: app 2734 (KK Group) still 3Shape-contaminated (close/reload
  then re-paste/heal); delete empty 3Shape stubs 2754 + 2755 (+ decide 2656 zh).
- CV-3P-UNDER-STAGE4-001 (2730/2733 3 pages under the Stage-4 header; 2656 zh 4p) — render-gated.
- DOCX-SMOKE-SUITE-DEAD-001 — report-only debt, no action required.
- Client-side stuck-JD-scope root (per-tab scope 'kernel' on cold start) — OPEN, relay `auth-36`
  guard contains the damage.

## Continuation 2026-07-26 (owner: "keep fixes implementation") — DOCX test-infra batch (SHIPPED)
Continued the CI-coverage sweep into `workers/docx-worker`. Three linked test-infra fixes, no worker
SOURCE touched (`src/index.js` untouched → no deploy, no version bump):

1. **HTMLPDF-TEST-VERSIONPIN-STALE-001 (FIXED):** `test/html-to-pdf.test.mjs:73` locked the
   `/generate-analysis-pdf` source with a literal `/var VERSION = "1\.14\.16[2-9]/` — a floor written
   as a narrow range that broke once VERSION crossed `1.14.170` (live = `1.14.171`). Replaced with a
   numeric `>=162` floor (behaviour-preserving; the other 4 asserts already lock route/handler/CORS).
   Test 3/3; full docx `.test.mjs` suite 32/32.
2. **DOCX-SMOKE-SUITE-DEAD-001 (RESOLVED, was report-only debt):** docx `npm test`
   (`node test/smoke.js`) crashed with a SyntaxError — the 15 legacy smoke `.js` files import
   `generateDocx` from the 0-line `src/generate.js` placeholder (retired at `e2034255`). Repointed
   `package.json` "test" → `node --test --test-force-exit test/*.test.mjs` (32 green, exercises the
   live bundle); added named non-default scripts `test:diags` (the render V&V set) + `test:smoke-legacy`
   (the retired smoke suite, KEPT as history per `run-docx-diags.mjs`'s own comment — NOT deleted).
   `npm test` now exits 0.
3. **CI-COVERAGE-GAP-DOCX-TESTMJS-001 (FIXED):** the CI docx step ran only `palette.test.mjs` + 2
   diags, leaving 7 `.test.mjs` files uncovered. Now runs the full `workers/docx-worker/test/*.test.mjs`
   suite + the 2 palette/banded diags (re-verified green from repo root: 32 + 6).

**NEW finding filed, NOT fixed (render domain, honest report over a guess):**
**DOCX-DIAG-STALE-OR-REGRESSED-001** — `run-docx-diags.mjs` = 42/48 on `1.14.171`; 6 diags FAIL
(`diag-ai-notice-anchor`, `diag-cjlr-table-export`, `diag-header-navy-invisible`, `diag-pageflow-export`,
`diag-photo-bridge-export`, `diag-spacing-linkedin-export`). Likely STALE/superseded (passing newer
companions exist after the CL-NOTICE VML-frame + Stage-4 header reworks), but confirming
stale-vs-regression per-assertion is a render-domain task (blue-screen-prone per CLAUDE.md) — owed to a
render-capable session. NOT wired into CI, so no deploy gate. PRE-EXISTING on main (untouched here).

**Verification:** docx `.test.mjs` suite 32/32, palette/banded diags 6/6, `npm test` exit 0, PWA suite
1480/1480, deploy.yml YAML structurally re-validated (no tabs, both new/changed steps present). CI run
watched to success after push (see below).

## No regression to main
Sync forward-only (branch fast-forwarded to origin/main + docs/CI/test-infra commits). Never forced.
No production code changed — only a CI-harness YAML, a worker test file, a worker `package.json` test
script, and docs/registers. Report + register edits committed with each fix.
