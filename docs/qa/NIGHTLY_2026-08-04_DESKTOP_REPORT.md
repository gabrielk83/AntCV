# AntCV NIGHTLY — 2026-08-04 (DESKTOP, Opus 4.8, worktree-isolated)

**Type:** verify + attest + reconcile + one test-infra de-flake. **No product code merged to `main`** (no `app.js`/`app.src.js`/worker/workflow change). One standalone diagnostic hardened.

**Preflight:** `routine-preflight.mjs start` reported the desktop clone DIRTY (owner WIP: `PANEL_BUTTON_AUDIT_2026-07-31.*` + `_2026-08-02.*`). Per STANDING RULE 0 did NOT edit/rebase that clone — worked entirely in the pre-provisioned isolated worktree `loving-mirzakhani-13ac89` (branch `claude/loving-mirzakhani-13ac89`), which was clean at HEAD `4033291` (= the 08-04 CI report commit). `git fetch && pull --rebase origin main` → already up to date. (One slip mid-run: an Edit briefly landed on the dirty main-clone path; reverted via `git checkout --` before it did any harm — confirmed via diff it carried only my 2 lines and clobbered no owner WIP — then re-applied in the worktree.)

**Baseline:** PWA `1.51.4086-demand-seed-refresh` (TARGET/CACHE) / seed `1.51.4046-company-retry` (the documented SEED-VS-TARGET-VERSION-NONBUG-001 sidecar-only split — re-confirmed, NOT re-flagged). Code surface byte-identical to what the 08-04 CI sweep verified green earlier today (`git diff` over `pwa/app.js`/`pwa/app.src.js`/`workers/**`/`.github/` since the CI base is empty).

## Band E — STANDING PROBES (all GREEN on desktop)

| Probe | Result |
|---|---|
| PWA suite (`run-tests.mjs pwa`) | **1570 / 1570** (~13.4s) |
| boot-smoke (`boot-smoke.mjs`) | **OK** — glDemo=function, 0 errors |
| `app.js` integrity | head `(()=>{window` ✓, **0** `"use strict"` ✓ |
| docx render V&V (`run-docx-diags.mjs`) | **50 / 50** |
| copenhagen overflow-storm (row 1 storm guard) | **DIAG PASS** — ON 5 writes / 15px bounded, OFF 2 / 0px |
| settings-panels probe (row 17) | **DIAG PASS** — Personal panel 0 mutations / 8s, 0 errors |
| sidebar-promote-margin (row 11) | **OK** — hold-under-margin true (one-row + whole-group removal) |
| sidebar-stable (row 11) | **FIXED + OK ×5** — see DIAG-SIDEBAR-STABLE-HEIGHT-SETTLE-FLAKE-001 |
| panel button-audit (row 23) | **227 buttons / 0 page errors / 0 THROWS / 0 DEAD / 132 active** (20 skipped-dangerous, 20 ui-only, 47 not-visible/disabled, 8 unclickable=covered/offscreen; record `PANEL_BUTTON_AUDIT_2026-08-04.{md,json}`). 8 "preview-only suspects" are the usual benign UI-state/guard keys (settingsTab, topbarOrder, analytics counts, mainOverflow, coreCompGuard…), not document payload. Count vs CI's 211 = expected React-remount enumeration variance on identical bytes. |

## LIVE WORKER ATTEST — all four match repo source, no drift

Correct `antcv-`-prefixed hosts per `worker-health-attest-hostname` (un-prefixed = CF 1042 typo, not a regression):

| Worker | Live `/health` | Repo source | Match |
|---|---|---|---|
| antcv-access-relay | `auth-37-cap-disposable-only` | `auth-37-cap-disposable-only` | ✓ |
| antcv-demo-proxy | `3.8.4-brand-ink-match` | `3.8.4-brand-ink-match` | ✓ |
| cv-proxy (`workers/proxy`) | `3.8.4-brand-ink-match` | `3.8.4-brand-ink-match` | ✓ |
| docx-worker | `1.14.174-appline-edit` | `1.14.174-appline-edit` | ✓ |

## SHIPPED — DIAG-SIDEBAR-STABLE-HEIGHT-SETTLE-FLAKE-001 (test-infra only)

`pwa/test/diag-sidebar-stable.mjs` flaked FAIL 2-of-3 tonight — `writes=0`, width stable, 0 errors, but the height check `|h1-h0|<2` read `1000`→`985` on 2 runs, `1000`→`1000` on 1. Not a regression: the equalize sidecar sets the sidebar height asynchronously via LAYOUT (not an inline-style write — hence `writes=0` while the rect still moves), so a before/after-baseline compare races a mount-time transient (`~1000` un-equalized → `~985` settled) that swings ~15px between runs on identical bytes. Same class as DIAG-CPH-STORM-DRIFT-FLAKE-001 (08-01). **Fix:** assert height CONVERGENCE — poll the settled height (≤12×150ms) and require two consecutive reads to agree (`heightConverged`); a real storm never reaches a fixed point so detection is not weakened; the `writes<=2` bound is untouched. Verified **PASS ×5** post-fix. `node --check` clean. Diag is standalone (not in `run-tests.mjs`) so the suite is unaffected. No product code, no version, no cache-bust, no deploy.

## REGISTER — per-band / per-row status this run

- **Band A (mobile & tab isolation, P0):** A1 GEN-BACKGROUND-001 approach-A + A2 legs 1/2 remain SHIPPED and verify-first — the remaining verification (real mobile gen A/B; relay-downgrade curl; same-device stale-pointer race) needs a real device / live models, not actionable from an unattended desktop run. A2 leg 3 (row 19 two-real-device test) still owner/device-gated.
- **Band B (data loss):** SO-003 (row 40), SO-004 (row 41) — no headless repro exists; not advanced.
- **Band C (content):** GEN-LANGFAB-001 (row 42), CA-006 (row 43), JD-ANALYSIS-PRINT-001 (row 44) — need live-model fresh generations (spec rule 38); not actionable unattended.
- **Band D (perf/design):** PERF-001 (row 45) needs cloud-sync profiling; GEN-MODELROLE-001 (row 39) shipped, live-verify owed against D1 llm_calls.
- **Band E (standing):** all green above; sidebar-stable diag de-flaked.
- **E1 staleness:** rows 1 + 3 re-verified against current code (empty code delta + all render diags green + live worker attest = repo; float-spine gate default-OFF, refs stable) → advanced to 2026-08-04. Rows 11/17/23 diags re-run green tonight (held/refreshed).
- **SEED-VS-TARGET-VERSION-NONBUG-001:** re-confirmed a verified non-bug (seed tracks `app.js?v` = 4046, not TARGET 4086; sidecar-only demand-seed release). Not re-flagged.

## Owner-decision / owner-verify carry-forwards (unchanged tonight)

- Live owner-verify OWED (needs the owner's device): GEN-COMPANY-MISSING-RETRY-001 fresh-gen shows the company; the CL-load-fidelity / HDR-TYPE / inline-edit round-3 rendered result; SALMON-MAIN-LENGTH-001 diagnostic capture.
- Owner-decision OPEN: JOBTRACKER-ODM-ANONYMIZATION-GARBLE-001 (does the "never name the ODM" rule reach bullets/outcomes prose; Sirin results-line gold-rule tension); the pre-V5 batch force-regen greenlight (job-tracker rows 82/86d/87a).

**Nothing owed live-verify FROM tonight** — no PWA/worker change shipped (the diag fix is test-only).
