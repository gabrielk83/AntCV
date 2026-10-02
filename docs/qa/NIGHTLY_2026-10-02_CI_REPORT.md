# AntCV nightly — 2026-10-02 (CI cloud run, Opus 4.8)

Unattended GitHub Actions run on `gabrielk83/AntCV`. One verified test-infra fix shipped to main
(register row 108, CLOSED). This is a cloud-appropriate end result: a self-contained change with
no browser/LLM dependency, proven green in CI.

## Environment / constraints

- `ALLOW_DEPLOY=false` → no worker deploys.
- No signed-in browser pane, no live LLM, Playwright chromium not installed in this runner.
- `app.js` / `app.src.js` / `workers/**` edits are PR-only here; none were needed (this fix is
  `scripts/` test-infra, allowed direct to main under the CI override).
- Base: synced clean, `git fetch origin && git pull --rebase origin main` → already up to date.

## Shipped — JOBTRACKER-PYTEST-UNWIRED-001 (row 108, CLOSED)

**Problem.** The 18 self-running, network-free `test_*.py` belts under `scripts/job-tracker/`
guard the belts that decide whether a model call is spent — the closed-row generation gate, the
obsolescence classifier, the board parsers. They ran **by hand only**: `scripts/run-tests.mjs`
had no python leg and no workflow invoked them, so they were green-by-nobody-looking between the
runs that happened to touch that directory.

**Why it wasn't fixed blind (the row's own caveat).** Wiring python into the node suite has a
real failure mode — a missing interpreter on a CI runner turning the whole PWA suite red. So the
row prescribed an OPTIONAL python leg that SKIPS loudly when no interpreter is present rather than
failing, plus the same treatment in the nightly. That is exactly what shipped.

**Change.**
- `scripts/lib/python-test-leg.mjs` (new) — the pure, testable core: `walkPyTests(dir)`
  (scope-aware `test_*.py` discovery, mirrors the harness's skip-dir set) and `pickPython(spawn)`
  (interpreter detection with an injectable spawn so the no-interpreter path is unit-testable;
  returns `null` — never throws — when absent).
- `scripts/run-tests.mjs` — adds a scope-respecting python leg after the node leg. If python tests
  are in scope and an interpreter exists, each runs with `cwd: ROOT`; any non-zero exit fails the
  run. If in scope but no interpreter, it prints a loud `SKIPPED … python belts are UNVERIFIED
  this run` and leaves the exit code untouched. Final exit = `nodeStatus || pyStatus`. The
  "no test files at all" error now accounts for python too.
- `scripts/tests/run-tests-python-leg.test.mjs` (new) — 7 checks, negative-controlled.

## Gates (all run in CI this run)

| Gate | Result |
|---|---|
| `node scripts/run-tests.mjs pwa` | **1782/1782 node, exit 0** — ZERO python tests collected (gate byte-for-byte unchanged) |
| `node scripts/run-tests.mjs` (full) | 307 node files = **2199 tests**, + **18 python files**, exit 0 |
| `node scripts/run-tests.mjs scripts/job-tracker` | 18 python belts run green, exit 0 |
| no-interpreter path (PATH = node-only) | prints loud `SKIPPED`, **exit 0** — can't redden the suite |
| `node scripts/tests/run-tests-python-leg.test.mjs` | 7/7 |
| `node scripts/check-register.mjs` | OK — 95 ACTIVE rows, 95 detail sections |

The critical safety invariant — the PWA suite (the pre-push + CI gate) is unchanged — is proven,
not assumed: `pwa/` carries no `test_*.py`, so `walkPyTests('pwa')` returns `[]` and the leg is a
no-op for that scope. The guard test locks both that and the skip-loudly path.

"Same treatment in the nightly" is covered without a second change: every nightly and the pre-push
hook already invoke `run-tests.mjs`, which now enforces the python belts automatically.

## Not touched / carry forward

- No PWA or worker code changed, so **no post-deploy live-verify is owed** for this run.
- The register's stalest owner/live-gated rows (47/50/51 live re-verify, 82 es/zh eyeball, 94
  live translate-persist regen) remain owed to a desktop/signed-in run — unchanged from the
  2026-10-01 CI report; nothing in CI can advance them.

## Registers updated this run

- `OPEN_REGISTER.md` — row 108 removed from the ACTIVE index (closed).
- `REGISTER_ACTIVE_DETAIL.md` — row 108 detail section removed.
- `REGISTER_CLOSED.md` — row 108 CLOSED entry added (verbatim row + evidence) at the top.
- `REGISTER_RUNLOG.md` — this run's summary at the top.
- `ACTIVE_BUGS.md` — top-block FIXED entry for JOBTRACKER-PYTEST-UNWIRED-001.
- This report.

No `FEATURES_REGISTRY.md` edit (test-infra hardening, not a user-facing feature).
