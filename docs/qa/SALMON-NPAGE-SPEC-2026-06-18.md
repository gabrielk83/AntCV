# SALMON-NPAGE-001 — multi-page salmon split indicator (DESIGN — not coded yet)

Owner spec 2026-06-18. **This is a design document only; no code has been written.**

## Requirement (owner)

- When a CV has **more than 2 pages of text**, draw an automated salmon page-split bar
  for **page 2 AND page 3** — and page 4, 5, 6, 7 as needed. No need to plan beyond 7
  pages (a CV > 7 pages is out of scope).
- The break detection must **account for page chrome**, not just raw text height:
  - **Page numbers** in the footer **when active** (the page-number footer takes vertical space).
  - **AI notice / watermark** (the "AI-assisted document" disclosure on the last page).
  - **Candidate-section inserts that repeat on multiple pages** (the candidate band / header
    and the sidebar column that re-render per page in the two-column paged layout), plus the
    "(Cont.)" continuation markers.
- The SELECTED-OUTCOMES / role spacing already shipped — this is purely the preview
  page-count + salmon-bar emission.

## Current state (why it stops at 2 pages today)

Diagnosed 2026-06-18 (agent). Two-map pagination: the **preview measurer is a 2-page model;
the worker export is N-page**.

- **Preview page count is DERIVED, not measured** — `pwa/app.src.js:~41410-41411`:
  `u = Math.max(1, ...p)` over every section/role's effective `page` number; the page-row
  render loop `for (e = 1; e <= u; e++)` (~41449) emits a `.antcv-page-row` per page; the
  salmon `▼ PAGE n ▼` draws for every page index `n > 0` (~41458). **The render is already
  N-page-capable** — it only needs page numbers ≥ 3 fed into it.
- **The measurer hard-codes `2`** — `pwa/antcv-auto-pagebreak-block-001.js`:
  - sidebar/main list/table break: `map[sid][String(br)] = 2;` (~line 497)
  - experience roles: `map[expSec.id][String(rmi)] = 2;` (~line 537)
  - and it is **STICKY**: `if (!sid || map[sid]) continue;` (~446) / `if (expSec && !map[expSec.id])`
    (~514) — once a section has ONE break it is never re-measured, so a page-2 continuation
    that ITSELF overflows can never get a page-3 break. Comment at ~508: "one break (page 2)
    per the measurer's current 2-page scope."
  - The **CL path already computes a real page number** (`__clTopPg = Math.floor(top / clLimit)`,
    `Math.min(4, __clTopPg + 2)`, ~580-585) — that is the working template to copy for the CV paths.
- **The worker is uncapped** — `workers/docx-worker/src/index.js` `splitChildrenByPage` (~24645)
  counts pages by `__antcvPB` markers; the role chunker (~25727) advances `run = pg` per distinct
  page value and emits a marker per continuation. So the EXPORT already produces 3+ pages; only
  the PREVIEW under-counts. (This is also why WATERMARK-SIDE is correct in PDF but wrong in
  preview — `chooseCorner` in `antcv-watermark-page-anchor-341.js` measures the preview's "last
  page", which is page 2 of a 3-page doc = a full middle page, so it picks the wrong corner.
  Fixing the page count fixes the watermark preview side for free — no watermark change needed.)

## Design

### 1. Replace the flat `2` + sticky cap with a real cumulative page number (cap 7)

In `antcv-auto-pagebreak-block-001.js` `compute()`, for the CV sidebar / main / experience
passes, mirror the CL path: measure each unit's bottom offset against successive A4 content
boundaries and write the **actual page** it lands on, `Math.min(7, page)`, instead of `2`.
Allow a section/role that already has a break to be **re-measured** so a still-overflowing
continuation gets the next page number. The render (`u`, the page-row loop, the role monotonic
floor ~41340, the sidebar/main flatMaps) already handles arbitrary page numbers — feed it 3..7
and the extra `.antcv-page-row`s + salmon bars appear automatically.

### 2. Account for page chrome in the per-page content budget (the owner's footer/header ask)

The measurer's usable-height-per-page constant must SUBTRACT the chrome that consumes vertical
space on each page, so a break lands before content collides with it:

- **Page-number footer (when active):** when the page-number footer is enabled, reduce the
  usable height per page by the footer band (~one line + margin). Read the same flag the footer
  render uses (grep the footer/page-number toggle). When inactive, no subtraction.
- **AI notice / watermark:** on the LAST page, reserve the AI-disclosure frame's height at the
  bottom so the final content doesn't overlap it. (The export anchors it as a bottom-corner VML
  frame; the preview shows `.antcv-ai-document-watermark`.) Only the last page needs this reserve.
- **Repeated candidate band / sidebar on continuation pages:** in the paged two-column layout the
  candidate band (page 1) and the sidebar column render per page. The measurer's per-page MAIN
  budget already starts below the band on page 1; for pages 2+ confirm whether the band repeats
  (it should NOT in the current design — only "(Cont.)" markers) and budget accordingly. The
  sidebar column height per page is independent (its own flatMap) — its breaks are measured
  separately, already.
- **Two-map alignment:** the goal is preview page count == worker `numPages`. Validate against the
  worker for the same payload (the worker is authoritative); tune the preview's usable-height +
  inflation so the break pages match (memory: `pagination-two-map-and-worker-test`).

### 3. Salmon bar per page (already supported)

No salmon-render change needed: the bar draws for every page index `> 0` (`app.src.js:~41458`).
Once the measurer emits page 3..7, the bars appear. (Salmon is PERMANENT — never gate/remove it;
see memory `salmon-splitter-permanent`.)

## RISK — the React #185 loop budget (why the cap exists)

The 2-page sticky cap was added to stop a **React #185 "Maximum update depth" oscillation**
(`antcv-auto-pagebreak-block-001.js` comments ~36-72, ~646-666). Un-capping MUST preserve the
existing loop guards or it can re-introduce the blue screen:
- the **source-fingerprint gate** (~738) — only re-measure when content actually changed;
- the **post-write cooldown** (~776) and the **8-writes / 4s circuit breaker** (~765);
- the **`__breakBornAt` HOLD_MS** (~380).
Approach: keep breaks STICKY once written, but allow the measurer to **ADD a higher-page break on
a continuation page-box** (measure within each page-box's own top via the existing `colTop`),
so each pass extends the chain by at most one page until it converges — bounded by `Math.min(7, …)`.
That converges in ≤6 passes for a 7-page CV without an unbounded re-measure loop.

## Layers
- **Measurer** (the fix): `pwa/antcv-auto-pagebreak-block-001.js` — sidecar (verify it's loaded in
  index.html before editing; it writes both `antcv:autoPages` and `antcv:autoPagesPreview`).
  Cache-bust its `?v=` + sw CACHE + the version-override quartet.
- **Render**: `pwa/app.src.js` + `app.js` mirror — already N-page; touch only if a page-row/footer
  tweak is needed (then mirror per CLAUDE.md).
- **Watermark**: `pwa/antcv-watermark-page-anchor-341.js` — NO change; correct once the last page
  is correct.
- **Worker**: no change (already N-page).

## Verification plan (headless, per `headless-pwa-testing`)
1. Boot the editor past the sign-in gate; inject a CV with > 2 pages of content (clone
   `docs/personas/anita/` + pad to 5+ roles × 4-5 bullets + a long sidebar).
2. Let the measurer settle (or call its run hook); assert
   `JSON.parse(localStorage['antcv:autoPagesPreview'])` contains values `3` (and up), not just `2`.
3. Assert `document.querySelectorAll('.antcv-preview-paper .antcv-page-row').length === workerNumPages`
   (drive the docx-worker on the same payload for the authoritative count).
4. Assert a salmon `▼ PAGE 3 ▼` bar renders.
5. Assert the watermark corner (`window.__antcvAiWmSide`) now matches the worker's last-page choice.
6. Footer/AI-notice budget: with the page-number footer ON, confirm the last line of a page does
   not collide with the footer / AI frame (visual + the break lands one line earlier than with it OFF).
7. **#185 guard:** scroll + edit repeatedly; confirm no runaway re-measure (the circuit breaker
   logs, write count stays bounded) and no blue screen.

## Status
DESIGN ONLY — queued. Pairs with WATERMARK-PREVIEW-SIDE (resolved for free by the page-count fix).
