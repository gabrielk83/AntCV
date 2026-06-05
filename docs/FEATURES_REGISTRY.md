# AntCV — Feature Registry

A living registry of **features** (distinct from the bug tracker at
`docs/qa/ACTIVE_BUGS.md`). Each feature is **CLOSED** (shipped + live), **OPEN**
(planned or in progress), or **PARKED** (descoped / blocked).

Last updated: **2026-06-06** — PWA `1.50.166`, docx-worker `1.14.17`.

Status legend: ✅ CLOSED (shipped) · 🟡 OPEN (active/planned) · ⚪ PARKED.

---

## CLOSED — shipped & live

| ID | Feature | Where | Notes |
|----|---------|-------|-------|
| FT-DATA-EXPORT | Download all stored data + analytics to a file (optional WebCrypto AES passphrase) | `antcv-data-export-360.js` | Button in the PRIVACY zone; "Save my data locally first" checkbox in the erase card. PR #176/#181/#185. |
| FT-DELETE-SAVE | Back up before account erase | same sidecar wraps `AntcvFullErase` | PR #176. |
| FT-CONSOLE-QUIET | Central console quieter (suppress ~70 boot/status banners; `localStorage.antcvVerboseConsole=1` to restore) | `antcv-console-quiet.js` | PR #188. |
| FT-SIDEBAR-COLOR | Preview sidebar follows the visual style (`var(--package-base)`, matches DOCX) | `antcv-sidebar-bg-token.js` | PR #210. |
| FT-LOADING-GATE | "Loading…" cover on login for returning users (masks the wizard flash + palette/tone settle) + orphan tone migration | `antcv-login-loading-gate.js` | PR #220. |
| FT-PHOTO-POS | Photo placements in preview (sidebar-top/bottom, header L/R, main L/R, band-overlap) | `antcv-photo-position.js` + app.js | Finders repaired for the single-table renderer (PR #196). Alt-position *persistence* still OPEN — see bug tracker. |
| FT-DOCX-PHOTO | DOCX photo placement incl. `band-overlap` → top-of-sidebar | docx-worker `generate.js` | PR #200 (worker 1.14.17). |
| FT-VISUAL-PACKAGES | 7 visual style packages (Copenhagen Modern, Navy Executive, Warm Terracotta, Nordic Frost, Pampas Contemporary, Tokyo Precision, Delhi Technical) | registry + islands + app.js | Palette now re-derives on load (PR #226). |
| FT-WRITING-STYLES | 12 writing systems (nordic-minimal … hybrid-balanced) + banned lists + tone chips | `writingSystems/registry.json`, proxy worker | Pre-existing; tone orphan default migrated this session. |
| FT-EXPORT | DOCX + PDF export (cv-proxy / docx-worker / CloudConvert) | workers | Pre-existing. |
| FT-ANALYSIS-REPORT | Branded AI-watermarked JD-analysis PDF | `antcv-analysis-report-pdf-360.js` | Landed in parallel work (#219 family). |

## OPEN — planned / in progress

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| FEATURE-CONF-001 | Per-sentence **confidence overlay** (Application-tab toggle; red=low/yellow=medium; hover shows the issue) | 🟡 not started | NOT in the locked docs — needs a worker self-check pass returning `{text,confidence,issue}` + app.js toggle/store + a preview renderer. Spec in `docs/plan/Batch_2026-06-04_feature-and-bug-triage.md`. |
| PHOTO-SIDEBAR-BRIDGE-001 | True **sidebar-bridge** photo: split the candidate-header cell so the disc hovers on the header/sidebar seam (preview + DOCX) | 🟡 design build | Owner spec 2026-06-06. Bigger than the current top-of-sidebar approximation. |
| APPJS-ID-SCHEME-UNIFY | Unify app.js's package id scheme with the registry (`scandinavian→copenhagen-modern`, `copenhagen_executive→navy-executive`, …) + persist the selection through cloud-restore | 🟡 source work | Removes the need for the orphan-apply / loading-gate workarounds. Do in `pwa/app.src.js` (source of truth) → re-minify. |
| DATA-IMPORT-001 | **Restore** a downloaded backup file (counterpart to FT-DATA-EXPORT) | 🟡 not started | Export shipped; import is the natural follow-up. |
| WIZARD-001/002 | Step 6b scrollable; add Step 6d (default languages + settings hand-off) | 🟡 registered | app.js wizard. |
| DATA-PORTABILITY-CLOUD | Persist corrected defaults (package/tone) to the cloud/database so per-load migration isn't needed | 🟡 needs relay prefs PUT | Owner's "do the corrections in the database" idea — riskier cloud-write path, deferred. |

## PARKED / descoped

| ID | Feature | Reason |
|----|---------|--------|
| FT-LOOP-DAMPER | Global MutationObserver coalescer | ⚪ reverted 1.50.89 (broke per-row control self-cleanup). |

---

### How to keep this current

- When a feature ships: move its row to **CLOSED**, add the PR + version.
- When the app.js source cleanups (APPJS-ID-SCHEME-UNIFY) land, retire the
  orphan-apply / loading-gate workarounds and note it here + in the bug tracker.
- Bugs (regressions, defects) go in `docs/qa/ACTIVE_BUGS.md`; net-new capability
  goes here.
