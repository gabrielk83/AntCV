# Next-session prompt — pagination completion + salmon solution

> Owner ask (2026-06-23): "a new prompt to handle pagination issues completion and good salmon solution."
> This is the kickoff prompt for the next session. Read it, then SYNC FIRST (`git fetch origin && git pull --rebase origin main`) before any edit. `app.src.js`/`app.js` changes go in a `git worktree` off `origin/main` (parallel sessions share the clone).

## Goal

Close the pagination work end to end and make the salmon page-break splitter correct and stable. Two halves: (A) the on-screen **salmon** splitter, (B) **preview↔export parity** plus the **boot storm** the pagination poll loop causes.

## Start with diagnosis, not edits

Hotfix discipline applies: reproduce → console probe → targeted patch. Do NOT speculatively touch the `fetch` wrap chain or the salmon/measurer cadence — both have prior blue-screen / churn incidents (see ACTIVE_BUGS `SALMON-CHURN-DISAPPEAR-001`, `APPJS-BLUESCREEN-001`).

Diag harnesses that already exist — run these first:
- `pwa/test/diag-boot-storm.mjs` — boot rAF / sections-updated storm.
- `node pwa/test/diag-table-split.mjs`, `diag-sidebar-cont-e2e` — per-item page splits.
- salmon measurer diags + `boot-storm-sidecar-coalesce.test.mjs` (the 1.50.818 baseline).

## The four open items (priority order)

1. **BOOT-FREEZE-LIVE-2026-06-23 — core pagination storm `[HIGHEST systemic perf]`.**
   The two NAMED polling offenders (`antcv-splitter-flip.js`, `antcv-sidebar-position.js`) were coalesced at 1.50.818. The CORE `pagination/sections-updated` storm in `app.src.js` is STILL OPEN ([[boot-storm-gate-freeze]], partial damper 1.50.772). The owner's tab went unresponsive booting the big NVIDIA doc. Needs a real **lazy / worker pagination refactor** — do not just add another debounce. Define: when does the measurer MUST run vs. when can it defer to idle? Move the heavy re-measure off the boot critical path.

   **CPU ATTRIBUTION (nightly 2026-06-24, `pwa/test/diag-boot-profile.mjs` — NEW V8-profile diag).** Profiled the owner-scale boot: the freeze is **NOT the app.js pagination measurer** (`app.js` self-time was only ~52ms). It is a **SIDECAR SWARM** — ~10 control sidecars each run `document.querySelectorAll('button'/'textarea'/all-divs)` + climb ancestors + `clean()`/`toLowerCase()` the serialised text on EVERY sweep, and they sweep on the `sections-updated` storm + a body `MutationObserver`. Top self-time on boot: `antcv-profile-workstyle-cjlr-238` `lowText` **696ms** (976ms whole file), then `antcv-language-ui-429` (289), `antcv-what-i-bring-header-cjlr-249` (227), `antcv-core-wib-strict-row-layout-274` (213), `antcv-watermark-page-anchor-341` `chooseCorner` (180), `antcv-how-contribute-controls-245` (112), `antcv-selected-outcomes-row-controls-237` (109), `antcv-embedded-controls-248` (101) … plus ~1.8s in native `querySelector`/`querySelectorAll`/`RegExp \s+` called BY those sidecars. **So the right fix for #1 is to cut the SIDECAR SWEEP cost, not refactor the measurer:** (a) gate each heavy sidecar `run()` on a cheap cross-run DOM signature (button-count + a sections hash) so a stable boot does near-zero work; and/or (b) a shared coalescer that runs the whole swarm once per settle instead of once per storm cycle per sidecar; and/or (c) scope the queries (most use `document.querySelectorAll` over the WHOLE doc — restrict to the editor panel root). Re-profile with `diag-boot-profile.mjs` after each.
   - **BOOT-CJLR-PERF-002 `[SHIPPED 1.50.845 — nightly 2026-06-24]`** — first surgical cut: `antcv-profile-workstyle-cjlr-238.js` `lowText` (the #1 consumer, 696ms) now memoises its `.toLowerCase()` per run (cleanText was already memoised; lowText was not, and it runs on the SAME big shared ancestors many times — `editorBlocks` 10-deep climb across every textarea + `findPreviewSection`'s all-element fallback ×2 sections). Pure per-run memo, behaviour-preserving. Verified: `lowText` drops OUT of the profile top list; total synthetic-boot main-thread blocking 1597ms → ~950–1318ms; suite 463/463; `diag-pw-cjlr-photo-leak.mjs` still OK. The OTHER swarm offenders above remain — apply the same memo/signature-gate pattern next.

2. **PREVIEW-EXPORT-PAGEBREAK-PARITY-001 `[parity]`.**
   In the PDF, page 2 starts with a role the PREVIEW kept on page 1 — the measurer (`autoPages`) and the docx-worker paginate differently, which also shifts which roles land on p2 (interacts with results placement). Fix: align the preview per-role page estimate with the export's actual break (the two-map pagination, [[pagination-two-map-and-worker-test]]). Likely the measurer over/under-estimates a role's height vs the worker's role spacing (worker tightened role bullets at 1.14.64). Verify with a role-boundary fixture in both the measurer and `workers/docx-worker`.

3. **Salmon completion — "good salmon solution" `[the owner's words]`.**
   The salmon splitter (the "▼ PAGE N ▼" bars) renders but has a churn/disappear history (`SALMON-CHURN-DISAPPEAR-001` fixed 1.50.337 via the 400/900/1800/3500 cadence + one-pass compute; `CL-DOUBLE-SALMON-001`, `CL-SALMON-SLOW-001` fixed via break-every-spanning-section-in-one-pass). Confirm on a real 3–4 page CV AND CL:
   - exactly one salmon bar per page boundary (no double-salmon),
   - it appears in a single compute (no multi-cycle churn),
   - the bar position matches the EXPORT break from item 2 (same boundary the worker uses).
   `SALMON-NPAGE-001` / `SALMON-3PAGE-001` are the page-count edges to cover (chip count + title == worker `numPages`).

4. **ENGINE-PAGESPLIT-001 / PB-007 residual `[owner check]`.**
   Per-item on-screen pagination is reported SHIPPED (dual-map measurer reads the EFFECTIVE bucket: manual `antcv:itemPages` ∪ auto `antcv:autoPagesPreview`; sidebar/table/HWIC all split). Residual: tap 📄→2 on ONE sidebar item + ONE table row and confirm the on-screen move uses the same bucket the verified auto path uses. If it moves, this closes.

## Definition of done

- Boot of the big NVIDIA doc no longer freezes the tab (diag-boot-storm shows no long task > ~200ms from the pagination poll).
- Preview and exported PDF break at the SAME role boundary on a 2–3 page CV fixture.
- Salmon: one bar per boundary, single-compute, position == export break, on CV and CL.
- Page-count chips == worker `numPages`.
- All existing salmon + boot + split diags still green; cache-bust quintet bumped; no `app.js` rebuild unless the identity round-trip gate passes (see `docs/deployment/app-js-source-and-rebuild.md`).

## Where the code lives

- Measurer / autoPages + salmon render: `pwa/app.src.js` (mirror surgical edits into `app.js`).
- Page-split engine notes: `docs/plan/PB-007-two-column-pagination.md`.
- Coalesced sidecars: `antcv-splitter-flip.js`, `antcv-sidebar-position.js`.
- Export pagination: `workers/docx-worker/src/index.js`.
- Two-map test wiki link: [[pagination-two-map-and-worker-test]].
