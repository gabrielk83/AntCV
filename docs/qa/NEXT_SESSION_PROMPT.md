# Next session — AntCV (start here)

> **NIGHT SHIFT (parallel-session safety):** before editing, `git fetch origin && git pull --rebase origin main`, then for any change that consumes a version number (a `pwa/` asset needing a cache-bust) run `node scripts/shift.mjs claim --task "<what>"` and work in the printed `git worktree`; use version numbers only inside your claimed range; `node scripts/shift.mjs release` when done. Docs-only edits skip the claim but still SYNC FIRST. See `docs/qa/NIGHT_SHIFT.md`.

**Authoritative open backlog: `docs/qa/OPEN_REGISTER.md`** (renumbered rows, staleness-swept). The living changelog is `docs/qa/ACTIVE_BUGS.md` (top block = newest). This file is a pointer, not a second source of truth.

**Current live baseline (verified 2026-07-13):** PWA `1.51.580-detection-gap`, cv-proxy `3.8.3-gemini-flash-ramble`, demo-proxy `3.8.3`, access-relay `auth-33-cse-brave`. Suite ~1257/1257. Shift high-water `1.51.598`.

**SYNC FIRST** (`git fetch origin && git pull --rebase origin main`) — the cloud routine, scheduled routines, and desktop sessions all push to `main`. `app.js` is the minified mirror of `app.src.js` (surgical edits, must start `(()=>{`, zero `"use strict"`, count-guarded replace via a node script when the file is too large for the Read tool — see `CLAUDE.md` patch protocol). Cache-bust quintet on every loaded-file change (file `?v` + `window.ANTCV_VERSION` seed + `app.js?v` in index.html + `sw.js` CACHE + version-override `TARGET_VERSION`, append the PREVIOUS target to `STALE_VERSIONS` never the new one). `node scripts/check-cache-bust.mjs --range HEAD` gates uncommitted changes.

> **Env constraints:** the SHELL sandbox is 403-gated to the CF workers in the cloud/nightly env — a Python→relay/proxy pipeline that mutates live app data runs only from a networked desktop/cloud-Routine session. The Browser pane reaches live antcv.pages.dev either way. `unpkg.com` (React/ReactDOM CDN) may be blocked in the cloud sandbox, so `pwa/test/boot-smoke.mjs` cannot pass there — verify app.js via `node --check`, the `(()=>{...}`/no-`"use strict"` invariant, and `node:vm` unit tests. Local Word render (`WINWORD.EXE` COM) + PyMuPDF + Pillow are available on the desktop box for byte-exact export verification; `POST /diag/convert-docx` (docx-worker 1.14.149+) runs a raw docx through the REAL CloudConvert pipeline.

## Done 2026-07-13 (desktop Opus/Fable session — Group 1 + owner Group-C batch)

- **Deployed cv-proxy + demo-proxy** — MODEL-TABLE-FRESHNESS-001 price-table fix (opus-4-8/gpt-5.5) went live (was committed-but-undeployed). Register row 89 CLOSE.
- **CLUSTER_RESEARCH_TOKEN provisioned** on access-relay + set as a Windows User env var for `antcv-demand-seed-weekly`; ran `cluster-demand-research-push.mjs` → D1 `application_qualification __global_market__` now holds 181 `source='research'` rows (weight ≤0.4). Register row 9 writer leg CLOSE.
- **Signature** processed to transparent background (white keyed to alpha, ink solid); the parallel general-coding session landed a transparent version in cloud `user_kernel.preferences.signatureB64` (verified RGBA, clean corners). Backup assets in `~/Downloads/Signature_GKG_transparent*`.
- **App 792 (KK Group, Danish)** — 5 English kernel Results translated to Danish in place (numbers/acronyms verbatim, freshness-gated PUT, byte-exact verified). Register row 86b CLOSE.
- **Density sweep** — `density_fit.py --apply` across the 20 saved tracker apps (CV+CL), excluding 723/670/794/796. Results table in `docs/qa/DENSITY_SWEEP_REPORT_2026-07-13.md`.
- **Pre-existing test failures** (DANISH-POSTCODE-EXPORT-001, CSE-PROXY-AUTH-TEST-001) — verified already GREEN on current main (fixed since the 2026-07-10 flag). Register rows CLOSE.
- **Backlog reconcile** — 31 June-era items re-verified against current code: 18 FIXED-with-evidence, 13 still OPEN. See `docs/qa/BACKLOG_RECONCILE_2026-07-13.md`.

## Open queue (priority order — anchored on OPEN_REGISTER)

1. **Owner-verify session (one desktop hard-refresh + ONE targeted regen + click-through)** clears the bulk of the owner-gated backlog: regen-confirm rows 35/36/37/42, JD-stale row 74B, analysis rows 63/64; click checks rows 24/44/40/21/81/83, MASTER_BACKLOG `VERIFYING` rows (Personal dedup, photo remove-last/shape, slogan language), and the row 20 six-item export eyeball.
2. **Mobile / second device (owner hands):** language switch on real phone (rows 58/65A), two-device isolation (rows 19/39a), SO-004 #185 capture (row 41 — probe armed, waiting on a live Android crash), GEN-BACKGROUND A/B (row 38 — flip default after).
3. **Row 53 CROSS-APP-EXPORT-CONTAMINATION (P0)** — cross-app CV/brand/filename leak; six legs scoped, diagnostic-first; leg (a) is the worst open correctness bug.
4. **Row 74C background SSE stall** — biggest mobile first-gen blocker (the 97.5% loop); sensitive stream code.
5. **Rows 54/56 recall + trim** — targeted gen must pull relevant kernel items forward AND cut irrelevant bullets; pairs with the density work.
6. **Row 49 sidebar group page-break** + **row 87d role-split "(cont.)"** — docx-worker page-distribution, highest-risk zone, dedicated diagnostic-first sessions.
7. **Row 59A generator baseline** (umbrella: pagination, bidirectional orphans, header/banner residue row 62) — architecture largely shipped (1.51.375-377 + worker 1.14.150); frontier is content-density (quality_pct ~73-84% → 97.5%).
8. **Row 8 Kernel v2 remainder** (bullets-path v2-direct migration + es/zh tier); **row 87a/86d core-comp 3-4 row backfill** (owner-approved regen after fixes); **row 22 CL slogan rich_content phase 2**.

## Still-open from the pre-register June backlog (reconcile 2026-07-13)

PERF-005 (partial), HIWC-RERENDER-LOOP-001, GRAMMAR-MARKER-SCROLL-LAG-001 (mobile), PDF-ASK-WHERE-TO-SAVE-001 / EXPORT-PRINT-DIALOG-001, INTERESTS-CONTENT-001, KERNEL-HOBBIES-SPLIT-001, SETTINGS-REORG-001, WIZARD-ABOUTME-CONFLICT-001, SPELL-FI-VOIKKO-001, JD-FETCH-HOST-001, CUSTOM-LLM-OVERHAUL-001 remaining legs (relay `customLlms` persist not shipped), FT-PERSTYLE-KERNELS Phase C auto-load-on-switch, AUTO-PAGEBREAK-BLOCK-001 residuals. Full evidence table in `docs/qa/BACKLOG_RECONCILE_2026-07-13.md`.
