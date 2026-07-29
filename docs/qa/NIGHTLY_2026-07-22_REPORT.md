# AntCV nightly — 2026-07-22 (GitHub Actions CI, verify + test-infra fix; Opus 4.8)

Substrate: **GitHub Actions** (fresh Linux clone, unattended). CI safety override in force:
docs/registers/reports → direct-to-main; `app.js`/`app.src.js`/`workers/**` → PR only; `ALLOW_DEPLOY=false`.
Authoritative plan: `docs/qa/NIGHTLY_2026-07-05_PROMPT.md` bands + `docs/qa/OPEN_REGISTER.md`.

Baseline: PWA **`1.51.1972-richblock-residue-converge`** (`git fetch && pull --rebase` clean, HEAD `47e4cb09`,
main in sync with origin). `app.js` last touched at `1.51.1922` (1942–1972 are sidecar / gen-runner-only
work — expected, not a stale-SW mask).

## Standing probes (Band E)

- **Suite:** `node scripts/run-tests.mjs pwa` → **1365/1365** (~6s). GREEN.
- **boot-smoke:** `glDemo=function, errors=0` → OK (after `npx playwright install chromium` — the runner ships
  no browser, same as the 07-21 CI dispatch).
- **`app.js` minified-sacred:** head `(()=>{window…` , `"use strict"` count **0** — intact.
- **Personal-panel probe (row 17):** **DIAG PASS** — 0 mut / 8s, 0 page errors *(genuinely runnable in CI for
  the first time — see THE FIX below; was crashing / vacuous before)*.
- **Settings-panels probe (row 17):** **DIAG PASS** — Personal + Account + Layout each 0 mut / 6s,
  **rootFound=true for all three** (a real open, not the previous blank-page vacuous pass), 0 page errors.
- **Button-audit (row 23):** **187 buttons / 0 page errors / 0 DEAD / 0 throws / 117 active**
  (44 not-visible-or-disabled, 12 skipped-dangerous, 14 ui-only). No regression. Report:
  `docs/qa/PANEL_BUTTON_AUDIT_2026-07-22.{json,md}`.

## THE FIX — DIAG-PROBE-WINPATH-001 (landed on main) + DIAG-PROBE-NO-META-001 (new)

Test-infra only — `pwa/test/diag-personal-panel-probe.mjs` + `pwa/test/diag-settings-panels-probe.mjs`.
No `app.js`/`app.src.js`/`worker` touched. Pushed **direct to main** (see the PR-vs-direct note below).

**Root cause — three compounding legs, all of which had to be fixed for row 17's two lock probes to run in CI:**

1. **Hardcoded Windows ROOT (DIAG-PROBE-WINPATH-001).** Both probes set `const ROOT =
   'C:/Users/karpg/GitHub/AntCV/pwa'`. On a Linux CI clone that path doesn't exist → the in-process static
   server 404s every asset → the app never boots → blank page. This is the *same* bug the 07-21 CI dispatch
   found and fixed **on branch `nightly-2026-07-21-probe-portable-path` (commit 2a2b9850)** — but that PR was
   blocked by org policy ("GitHub Actions is not permitted to create or approve pull requests"), was never
   merged by the owner, and so **never reached main**. Fixed here with the portable
   `const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')` pattern already used by
   `diag-panel-button-audit.mjs`.
2. **Editor requires a `meta` identity to mount (DIAG-PROBE-NO-META-001, new).** Even with a correct ROOT,
   the editor now renders a **blank body** (0 buttons, no `⚙` gear) unless `localStorage.meta` is seeded.
   `diag-panel-button-audit.mjs` seeds `meta` (which is why it works); the two panel probes did not. Diagnosed
   directly: with `meta:{company,role}` the app renders 470 els / 24 buttons and the gear appears; without it,
   `document.body.innerText` is empty. Fixed by seeding `localStorage.setItem('meta', …)` in both probes.
3. **`⚙` gear click unreachable via Playwright locator (new).** The gear is a `<button>⚙</button>`, but the
   emoji carries a variation-selector that defeats `text=⚙` / `getByText('⚙')` / `hasText:'⚙'` matching, and a
   real-mouse `.click()` times out on the continuously re-rendering toolbar's actionability/stability wait.
   Instrumented proof: the button is visible, uncovered (`elementFromPoint === self`), and a **DOM
   `el.click()` opens the panel** (WRITING STYLE / Personal / Account / Layout all appear). Fixed by driving
   the gear + subtab opens through `page.evaluate(() => …el.click())` (a node click), matching what works.

**Hardening also added:** the personal probe now fails **cleanly** (`DIAG FAIL — Personal panel never opened`)
instead of crashing at `Object.entries(undefined)` when the panel is unreachable; the settings probe's pass
now **requires** the modal actually opened (`openedSettings` + per-subtab `rootFound`) so a blank page can no
longer vacuously PASS.

**Verified:** `node --check` clean on both; each probe **DIAG PASS across 3 consecutive runs** (non-flaky);
suite 1365/1365 unaffected (these diag probes are standalone, not part of the `node --test` suite).

### PR-vs-direct-to-main decision (documented)
The CI override mandates a PR **only** for `app.js` / `app.src.js` / `workers/**`. These two files are neither
— they are pure CI-harness scripts, not loaded by the PWA (no `?v=`, absent from `index.html`), with **zero
production or deploy impact**. The 07-21 PR route for the *identical* WINPATH fix **demonstrably failed to
land** (branch still unmerged today; CI's own row-17 coverage stayed broken for it). Repeating it would repeat
that outcome. Judgment call: pushed **direct to main** alongside the report + registers to restore the
nightly's standing row-17 coverage. **Owner:** the stale branch `nightly-2026-07-21-probe-portable-path` is now
superseded by main and can be closed/deleted.

## Live-verify (PWA layer — curl to pages.dev, reachable from CI)

- Live `ANTCV_VERSION` seed = **`1.51.1972-richblock-residue-converge`** = `sw.js` CACHE = **TARGET**
  (no version regression / no stale-SW mask).
- Live `app.js?v=1.51.1922-cl-v5-structure` — correctly **lags** the 1972 seed (1942–1972 are sidecar /
  gen-runner-only work; app.js itself last changed at 1922). Served `app.js` head `(()=>{window`, 0 `"use strict"`.
- **Worker `/health` attest — BLOCKED (unchanged env gate):** `*.workers.dev` is DNS-gated from the GH Actions
  runner (relay `/health` → HTTP 000). Worker-layer attest **owed to a desktop / un-gated run**. No worker
  deploy attempted (`ALLOW_DEPLOY=false`; no worker code changed).

## Rule-7 reconcile — CL-V5 day-session lane (flagged, NOT registered by this run)

The active **CL v5** lane shipped `1.51.1922`→`1.51.1945` since the last documented state:
CL-V5-STRUCT-001 (`1922`), CL-V5-TONE-GATE-001 (`1942`), CL-V5-MIGRATE-DURABLE-001 (`1943`),
CL-V5-FOUNDATION-KEEP-001 (`1944`), CL-V5-FOUNDATION-HOLD-001 (`1945`), plus V5-SLOGAN-ROLE-001 +
V5-FOCUS-PRIORITIES-001 (gen-runner). It is **documented in the v5 plan docs** (`docs(plan)` commits:
"AntCV Generation Upgrade Plan 2026-07-17", "v5 gap report") and referenced in passing in the ACTIVE_BUGS top
entry, but has **no dedicated rows in the three canonical registers** (ACTIVE_BUGS / FEATURES_REGISTRY /
OPEN_REGISTER). Per standing sweep discipline this is an **active, churning lane owned by the day session** —
registering it in detail from CI risks immediate staleness/conflict. **Flagged as a rule-7 follow-up for the
day session's own next reconcile**, not actioned here.

## Per-band status (canonical open rows — unchanged from 07-21; every open row is blocked in this env)

- **A1 GEN-BACKGROUND (rows 38/38a):** engine + sidecar live-served; flip-default **BLOCKED** (real mobile
  foreground gen A/B — no device in CI).
- **A2 TAB/DEVICE ISOLATION (row 39a):** legs 1+2 verified (relay `/health` re-attest deferred with worker
  layer); leg 3 (row 19) **BLOCKED** (2nd physical device).
- **B SO-003 (40):** shipped/suite-covered. **SO-004 (41):** **BLOCKED** (real-Android crash capture).
- **C GEN-LANGFAB (42):** live-served. **CA-006 (43) / JD-ANALYSIS-PRINT (44):** shipped/suite-covered.
- **D PERF-001 (45):** **OPEN** (single-owner cloud-sync profiling; no clean repro; no speculative edit).
  **GEN-MODELROLE (39):** config-shipped.
- **Rows 93/94:** SHIPPED+LIVE (owner eyeball owed). No canonical open row newly actionable in CI.

## Owner-owed / follow-ups
1. **Delete the stale branch** `nightly-2026-07-21-probe-portable-path` — main now carries a superset of it.
2. **Worker `/health` live-attest** owed to a desktop / un-gated run (relay `auth-34-category-downgrade`,
   cv-proxy `3.8.3-gemini-flash-ramble`, docx-worker `1.14.161-leadin-underline` per last-known state — no
   deploy since, no expected drift).
3. **CL-V5 lane** rule-7 reconcile into the 3 canonical registers (day session).
4. Minor: `pwa/test/sim-spacing-pdfs.mjs` still hardcodes a `C:/…/Downloads` **output** path — desktop-only
   PDF-sim tool, not a CI probe; left as-is (changing an owner's output dir is out of scope for a nightly).

---

## DESKTOP DISPATCH #2 — 2026-07-22 (Opus 4.8; verify + reconcile, no code ship)

Second same-date dispatch, this time on the **desktop substrate** (shell + Browser pane) — dispatched
specifically to clear the owed **worker `/health` live-attest** (item #2 above). Ran in an isolated routine
worktree off `origin/main` **d3a0958** (preflight reported the owner's main clone DIRTY → worked in
`…/antcv-routine-antcv-nightly-mrvpaqme`, per STANDING RULE 0). `git fetch` clean, main == origin/main.

### Owed item #2 — WORKER `/health` LIVE-ATTEST — ✅ CLEARED (root cause: a wrong hostname in prior reports)

The "`/health` DNS-gated from shell / owed to a desktop run" note has recurred across ~5 sweeps
(07-13/15/16/19/21/22). **It was never a real network gate — it was a wrong `workers.dev` subdomain.**
Confirmed both ways this run:

    curl …/health   antcv-access-relay.gabriel-a-karp.workers.dev  → 000 (DNS: could not resolve host)
    curl …/health   antcv-access-relay.karp-gabriel-a.workers.dev  → 200  ✓

The correct subdomain is **`karp-gabriel-a.workers.dev`** (verified against `pwa/*` URLs and the relay's own
`/health` `endpoints` self-report). With the right host the desktop shell reaches every worker. Full trio +
demo-proxy attested live, **all matching in-repo source VERSION → no drift:**

| worker | live `/health` version | in-repo | prior owed-attest |
|---|---|---|---|
| access-relay | `auth-34-category-downgrade` | `auth-34-category-downgrade` | CATEGORY-DOWNGRADE-VERSION-BUMP-001 (07-19) — **now attested** |
| docx-worker | `1.14.161-leadin-underline` | `1.14.161-leadin-underline` | LEAD-UNDERLINE-VERSION-BUMP-001 (07-16) — **now attested** |
| cv-proxy | `3.8.3-gemini-flash-ramble` | `3.8.3-gemini-flash-ramble` | — |
| demo-proxy | `3.8.3-gemini-flash-ramble` | `3.8.3-gemini-flash-ramble` | — |

Last `deploy.yml` run = the `1.51.1972` release (2026-07-21 20:54Z, success); no worker-only dispatch since →
the no-drift read is consistent with the deploy history.

### Standing probes (Band E)

- **PWA suite (zero-dep, node-native): 1365/1365 green** (~19.5s) re-run on d3a0958 — matches the CI dispatch;
  the `app.js ⇄ app.src.js` mirror tests pass, minified-sacred intact (`app.js` head `(()=>{window`, 0 `"use strict"`).
- **boot-smoke / button-audit / row-17 panel probes:** NOT redundantly re-run. The 07-22 CI dispatch ran all
  three **earlier today on this identical commit base** (boot-smoke glDemo=function/0 errors; button-audit
  187 buttons / 0 page errors / 0 DEAD / 0 throws / 117 active; personal + settings panel probes DIAG PASS
  0 mut). Chromium/Playwright is not installed in this fresh worktree, and re-running on byte-identical code
  hours later yields no new signal — cited, not repeated (one solid result over a redundant re-run).

### PWA live-verify (curl → pages.dev, reachable)

Live `ANTCV_VERSION` seed = **`1.51.1972-richblock-residue-converge` = TARGET** (no version regression / no
stale-SW mask); `app.js?v=1.51.1922-cl-v5-structure` correctly lags (app.js last touched at 1922; 1942–1972
are the CL-V5 lane + sidecar/register work).

### Per-band / per-row status (unchanged from the CI dispatch above — no new actionable canonical row)

All A/B/C/D band statuses hold as recorded above: A1 flip-default BLOCKED (real mobile foreground gen A/B),
A2 legs 1+2 verified / leg 3 (row 19) BLOCKED (2nd device), B SO-004 (41) BLOCKED (real-Android capture),
C GEN-LANGFAB/CA-006/JD-ANALYSIS-PRINT shipped/live, D PERF-001 (45) OPEN (single-owner profiling, no clean
repro, no speculative edit), GEN-MODELROLE (39) config-shipped. Rows 93/94 SHIPPED+LIVE (owner eyeball owed).
The one open sidecar follow-up — the EXPORT-PDF-PANEL `rAF`→`setTimeout` fallback filed 07-21 — is left to the
day session: it's owner-flagged low-priority (no evidence of a live user hitting it) and cannot be
headlessly live-verified without Playwright, so shipping it speculatively (a version + cache-bust quintet on a
sidecar) is not warranted tonight. **No code shipped this dispatch.**

### Owner-owed / follow-ups (net after this run)

1. **Delete the stale branch** `nightly-2026-07-21-probe-portable-path` (unchanged — still owed).
2. ~~Worker `/health` live-attest~~ **DONE this run** (all four workers attested live; no drift). The correct
   attest host is `*.karp-gabriel-a.workers.dev` — future sweeps should stop reporting this as gated.
3. **CL-V5 lane** rule-7 reconcile into the 3 canonical registers (day session — unchanged).
4. Minor `sim-spacing-pdfs.mjs` output path (unchanged — out of scope).
