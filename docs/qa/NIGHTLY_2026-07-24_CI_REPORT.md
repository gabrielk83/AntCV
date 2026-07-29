# AntCV nightly — 2026-07-24 (CI / GitHub Actions, unattended, Opus 4.8)

Substrate: GitHub Actions on `gabrielk83/AntCV`. No in-app Browser pane (no live-deploy
verify). `ALLOW_DEPLOY=false` (no worker deploys). Headless Playwright available. SYNC
FIRST clean: `git fetch && pull --rebase origin main` → already up to date, base HEAD
`f6aba54c` (the 2026-07-23 CI nightly's filing commit). Shift range **claimed** for the
one versioned change: `1.51.3662-1.51.3681` (used 3662; auto-pushed the claim to main).

## Headline — one solid VERIFIED fix, shipped to a review branch (not merged)

**CPH-HEADER-BAND-OVERFLOW-STORM-001 — FIXED + headless-verified, on branch
`nightly/cph-header-band-overflow-storm-fix` (`84ecb083`), awaiting owner PR-merge +
live-verify.** This was the top open row, filed (not fixed) by the 07-23 CI nightly. It is
a default-ON, every-user reflow storm — worth a careful, verified fix.

### Root cause (confirmed directly, not inferred)
`pwa/antcv-sidebar-fill-equalize-227.js`'s LAST/single-row branch keyed its idempotency
guard on `String(mainH)` — the **stretched** box height of `.antcv-document-main`. With
the Copenhagen header band present, extending the sidebar to `mainH` grows the page-row;
`main` (`align-self:stretch`) re-stretches and reads **~15px taller every cycle**, so
`String(mainH)` is a new value each pass and the guard never holds → the sidebar chases
`main` up without bound → `antcv-main-overflow-detect-364` re-writes
`localStorage['antcv:mainOverflow']` ~4×/s → continuous preview reflow (PERF-001 class).

Instrumented the loop headlessly to prove the mechanism: **`mainContent` (children-bottom)
held steady at 429px** while the stretched `main` box climbed 1348 → 1543+ across cycles,
with `side` set to the *prior* `mainH` each time (`main = side + 15` each cycle). The
content height is the stable input; the stretched box is the drifting derived quantity.

### Fix
Gate the branch on the **main CONTENT height** (`mainContentH`) instead of the stretched
box. Content is stable under the self-feedback and only moves on a real edit, so once the
navy fill is applied for a content signature the branch skips until content changes —
converges in every case (A4-fill, overflow, pure scroll). The one-time navy fill to the
page box is unchanged. Surgical: the guard key + the recorded attribute; no other logic,
no `app.js`/`app.src.js`/worker touch.

### Verification (all headless, deterministic)
- **Dedicated repro** `pwa/test/diag-copenhagen-overflow-storm.mjs`: band ON **28 writes /
  +435px drift (runaway) → 2-3 writes / +30px one-time settle (bounded)**; band OFF stays
  1 write / 0px. Thresholds updated to encode the true invariant (bounded ≠ runaway: write
  count is the decisive anti-storm signal — 364 emits one write per distinct `usablePx`, so
  a live climb produces dozens; the drift bound sits well under the 435px runaway and above
  the fixed 30px mount-settle) with the rationale written into the file.
- **Independent corroboration:** the standing **row-17 `diag-settings-panels-probe.mjs`**
  (the probe that surfaced this bug) goes **DIAG FAIL on main → DIAG PASS on the fix
  branch** ("all standard settings panels at rest"). So the fix clears the real detector,
  not just its dedicated repro.
- **Fill preserved:** `side` settles at ~1138px (≈ A4) on BOTH a near-empty and an
  overflow single-page fixture — not collapsed to content. The residual ~15px bottom gap is
  **not new** (pre-fix the sidebar was always ~15px under the row; it just never stopped
  growing). Band-OFF has no gap.
- **Non-regression:** the non-last / multi-page branch is untouched. Suite **1464/1464**,
  boot-smoke `glDemo=function, errors=0`, `pwa/app.js` head `(()=>{`, 0 `"use strict"`.
- **Cache-bust quintet** complete → `1.51.3662-cph-storm` (227 `?v`, version-override own
  `?v`, `ANTCV_VERSION` seed, `sw.js` CACHE, `TARGET_VERSION` + `STALE_VERSIONS` += prev
  `1.51.3622-stage4-docx`). `check-cache-bust.mjs --range origin/main..HEAD`: OK.

### Why a branch, not a push to main
CLAUDE.md flags preview/pagination layout as the most blue-screen-prone area, and a
preview-layout change **cannot be live-verified from CI** (no Browser pane) against real
multi-page + salmon. Per the standing rule "one solid verified fix, never a brickable
mid-product," and matching the 07-23 nightly's caution, this ships to a review branch for
the owner rather than unattended to main. (Rule 3 mandates a PR only for
app.js/app.src.js/workers; this is a sidecar + cache-bust assets, so a direct push would
have been *permitted* — the branch is a deliberate safety choice for the layout risk.)
GitHub Actions is **blocked from auto-opening PRs** in this org, so the branch is pushed
and the owner opens the PR:
`https://github.com/gabrielk83/AntCV/compare/main...nightly/cph-header-band-overflow-storm-fix?expand=1`

## Standing probes (baseline on main / `24de1a2e`)
- **PWA suite:** `node scripts/run-tests.mjs pwa` → **1464/1464 pass**, 0 fail.
- **app.js integrity:** head `(()=>{`, **0** `"use strict"` — minified-sacred intact.
- **boot-smoke:** `glDemo=function, errors=0` → OK.
- **Personal-panel probe (E2 / row 17):** **0 mutations / 8s, 0 errors — DIAG PASS**.
- **Settings-panels probe (row 17):** **DIAG FAIL on main** (= this bug, still live on
  main until the branch merges) → **DIAG PASS on the fix branch**. The probe is behaving
  correctly; do not silence it.

## Owed (cannot be done in CI)
- **PR open + merge:** owner action (Actions can't open PRs). Branch is ready + green.
- **Post-deploy live-verify:** owed to a desktop run once merged — confirm on a real
  signed-in **multi-page CV + salmon** that the navy reaches the page bottom and the
  preview no longer churns; confirm `?v=1.51.3662-cph-storm` fetches fresh.
- **Worker deploys:** `ALLOW_DEPLOY=false` → none attempted, none owed.

## Register coverage this run
- **CPH-HEADER-BAND-OVERFLOW-STORM-001** — advanced OPEN → FIX-READY-ON-BRANCH; ACTIVE_BUGS
  top entry + OPEN_REGISTER top row updated; fix + verification recorded.
- **Row 17 (panel stability)** — personal PASS; settings FAIL-on-main / PASS-on-branch
  (the fix resolves it).
- **JOBTRACKER-EMPTY-BAND-CRASH-001** — unchanged; still out-of-repo (`build_workbook.py`
  on Google Drive), not CI-actionable.
- All other open rows are owner-gated / need a 2nd physical device / live models / a real
  foreground gen — none newly actionable from CI this run.

No code merged to `main`: this run pushed the shift claim + these register/report docs to
main, and the verified fix to a review branch. No `app.js`/`app.src.js`/worker changes to
main.
