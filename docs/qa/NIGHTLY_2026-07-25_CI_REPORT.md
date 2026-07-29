# AntCV nightly — 2026-07-25 (CI / GitHub Actions, unattended, Opus 4.8)

Substrate: GitHub Actions on `gabrielk83/AntCV`. No in-app Browser pane. `ALLOW_DEPLOY=false`
(no worker deploys). Headless Playwright available after `npx playwright install chromium`.
**SYNC FIRST clean:** `git fetch && pull --rebase origin main` → already up to date, base HEAD
`2df71370` (the 2026-07-24 evening register batch). Main in sync throughout; no shift claim (no
versioned PWA change shipped — see below).

## Headline

No clean node-verifiable **bug-fix** was genuinely actionable tonight — the entire CI test
surface is green and every open register row is render-gated / owner-gated / needs-live-models /
needs-2nd-device / content-density. So this is a **verify + attest + reconcile** run with **two new
test-infra findings filed**, one of them a verified-ready fix that CI is **permission-blocked** from
pushing (owed to the owner / a desktop run).

## Standing probes — ALL GREEN on main (`2df71370`)
- **PWA suite:** `node scripts/run-tests.mjs pwa` → **1470/1470 pass**, 0 fail (~6s).
- **app.js integrity:** head `(()=>{window`, **0** `"use strict"` — minified-sacred intact.
- **boot-smoke:** `glDemo=function, errors=0` → OK.
- **Row-17 settings-panels probe:** **DIAG PASS** (Personal/Account/Layout each 0 mut/6s,
  rootFound=true, 0 page errors) — confirms the CPH-STORM fix (landed to main 07-24) genuinely
  cleared the detector on current main, not just on its branch.
- **Copenhagen overflow-storm repro** (`diag-copenhagen-overflow-storm.mjs`): band ON **2 writes /
  30px drift (bounded)**, band OFF 1 write / 0px → **DIAG PASS**. The default-ON reflow storm is
  confirmed fixed on live main.
- **Panel button-audit** (`diag-panel-button-audit.mjs`): **187 buttons / 0 page errors** (113
  active, 13 skipped-dangerous, 17 ui-only, 44 not-visible/disabled); **0 THROWS, 0 DEAD** — no
  regression (register row 23). Record: `docs/qa/PANEL_BUTTON_AUDIT_2026-07-25.md`.
- **Model-table freshness pins** (proxy + demo-proxy): **10/10** — no silent pricing drift.

## LIVE ATTEST from CI — workers + PWA, NO drift, NO regression (recurring "owed" note REFUTED)

Prior CI sweeps kept marking worker `/health` attest "owed to a desktop run" (DNS-gated). That is a
**wrong-hostname error**, already flagged by the 2026-07-22 desktop dispatch; this run **proves CI
can attest** via `*.karp-gabriel-a.workers.dev`. All reachable from the Actions runner and matching
in-repo source:

| Surface | Live | In-repo source | Match |
|---|---|---|---|
| PWA (`antcv.pages.dev` `sw.js` CACHE) | `antcv-1.51.3743-spec-photo124` | `pwa/sw.js` CACHE + `ANTCV_VERSION` seed + `TARGET_VERSION` all `1.51.3743-spec-photo124` | ✅ no regression / no stale-SW mask |
| access-relay `/health` | `auth-36-jd-cross-app-guard` | `RELAY_VERSION` `auth-36-jd-cross-app-guard` | ✅ |
| cv-proxy `/health` | `3.8.4-brand-ink-match` | `VERSION` `3.8.4-brand-ink-match` | ✅ |
| demo-proxy `/health` (`antcv-demo-proxy…`) | `3.8.4-brand-ink-match` (shares codebase) | `3.8.4-brand-ink-match` | ✅ |
| docx-worker `/health` | `1.14.171-spec-photo` | `src/index.js` `VERSION` `1.14.171-spec-photo` | ✅ |

**Conclusion: no worker drift, no PWA version regression.** Future CI sweeps should attest via
`*.karp-gabriel-a.workers.dev` and stop marking `/health` as owed.

## Staleness sweep (mandated slot) — rows 35/36/37 refreshed
The three stalest register rows (verified 2026-07-07, 18 days old) are CLOSE-WITH-EVIDENCE, backed
by unit guards. Re-ran the guards green today (**27/27**: `overlay-watchdog-heartbeat.test.mjs` +
`unsolicited-corecomp-broad.test.mjs` + `unit/core-comp-compress-eo.test.mjs`) and advanced their
`verified:` date to **2026-07-25** in `OPEN_REGISTER.md`. No behaviour change; the code guards remain
present + un-regressed.

## NEW FINDINGS filed this run (both test-infra)

### 1. CI-COVERAGE-GAP-RELAY-DEMOPROXY-001 — verified-ready fix, CI-push BLOCKED (owed)
The `unit-tests` job in `.github/workflows/deploy.yml` (lines 97-104) runs proxy + PWA + 3 docx
`.mjs` files only. It **never runs** the access-relay unit tests (**128** in
`workers/access-relay/tests/*.test.mjs`) or the demo-proxy unit tests (**33** in
`workers/demo-proxy/test/*.test.mjs`). The access-relay worker is **actively changed** (auth /
JD-cross-app-guard / cluster-demand / cost-tiebreak — `auth-36` shipped 2026-07-24), so a regression
in any of its 128 tests would pass CI and deploy uncaught.

Both suites verified **green + deterministic** (access-relay 128/128 across 2 runs; demo-proxy 33/33),
pure `node --test`, no browser. The exact fix — two steps appended to the `unit-tests` job — was
authored, the YAML re-parsed clean, and the exact CI commands (with `--test-force-exit`) re-run green:

```yaml
      - name: Access-relay unit tests (auth / JD-guard / cluster-demand / cost)
        run: node --test --test-force-exit workers/access-relay/tests/*.test.mjs
      - name: Demo-proxy unit tests (demo enforcement / model-table / cost)
        run: node --test --test-force-exit workers/demo-proxy/test/*.test.mjs
```

**Why it did not ship:** the GitHub App token this run uses **lacks `workflows` permission** — the
push was rejected (`refusing to allow a GitHub App to create or update workflow .github/workflows/…
without workflows permission`), on a branch as well as direct. So CI cannot ship any workflow change
tonight. **Owed to the owner / a desktop run** (one-file change, apply the block above after the
DOCX-worker step in the `unit-tests` job; both suites already pass). Filed: OPEN_REGISTER row +
ACTIVE_BUGS.

### 2. DOCX-SMOKE-SUITE-DEAD-001 — report-only debt
`workers/docx-worker/src/generate.js` is a **0-line `PLACEHOLDER` stub** (reduced at `e2034255` when
the worker moved to the hand-inlined `src/index.js` bundle). All **15** smoke files
(`test/smoke.js`, `test/edges.js`, `test/smoke-*.js`) `import { generateDocx } from '../src/generate.js'`,
so the canonical `npm test` (`node test/smoke.js`) exits **1** with a `SyntaxError` (no such export).
The only module that exports `generateDocx` is the stale parent `workers/docx-worker/generate.js`
(v1.14.13, also fails its own import). This suite is **abandoned post-bundling, not in CI**, and not
cleanly repairable (reviving it would test dead code) — so it is **not a regression the nightly must
guard**. Filed report-only so future runs don't re-discover it. The LIVE worker (bundled
`src/index.js`, `1.14.171`) is covered by the palette/diag `.mjs` tests that CI does run + its live
`/health` attest above.

## Owed (cannot be done in CI)
- **CI-COVERAGE-GAP-RELAY-DEMOPROXY-001 apply + push** — owner / desktop (CI lacks `workflows`
  permission). Verified-ready one-file patch above.
- **Post-deploy live-verify** — none owed from this run: **no PWA change shipped** (verify-only run).
  Carry-forward from 07-24 evening (Fable 5) still standing for a desktop run: optional live-verify
  of the CPH-STORM fix on a real multi-page CV + salmon, and the SPEC-SHORTER / CPH-PHOTO-124 /
  APP-LOAD-NO-RETRANSLATE / JD-CROSS-APP-GUARD changes on the deployed build.
- **Worker deploys:** `ALLOW_DEPLOY=false` → none attempted, none owed.
- **Owner actions still open (from 07-24 evening batch, not CI-actionable):** app 2734 (KK Group)
  still 3Shape-contaminated (was active all evening → no write; close/reload then re-paste/heal);
  delete empty 3Shape stubs 2754 + 2755 (+ decide 2656 zh); client-side stuck-JD-scope root
  (per-tab scope 'kernel' on cold start) remains OPEN (relay `auth-36` guard contains the damage).
- **CV-3P-UNDER-STAGE4-001** (2730 + 2733 CVs render 3 pages under the taller Stage-4 header; 2656
  zh 4p) — page-budget refit, render-gated, owed to a render-capable session.

## Register coverage this run
- **Rows 35/36/37** — staleness refreshed (guards re-run green, `verified:` 07-07 → 07-25).
- **Row 17** (panel stability) — DIAG PASS on main (CPH-STORM fix confirmed effective post-merge).
- **Row 23** (button audit) — 187 / 0 errors / 0 THROWS / 0 DEAD; record written.
- **CI-COVERAGE-GAP-RELAY-DEMOPROXY-001** — NEW row (OPEN, owed) + ACTIVE_BUGS.
- **DOCX-SMOKE-SUITE-DEAD-001** — NEW row (report-only debt) + ACTIVE_BUGS.
- **Worker + PWA live attest** — recorded; recurring "owed" note refuted.
- All other open rows — owner-gated / need a 2nd physical device / live models / a real foreground
  gen — none newly actionable from CI. No implemented-but-still-open row found.

No code merged to `main`: this run pushes only docs/registers (this report, the button-audit record,
the OPEN_REGISTER / ACTIVE_BUGS edits). No `app.js` / `app.src.js` / worker / workflow change reached
main (the one verified-ready workflow change is permission-blocked from CI, filed as owed).
