# PB-007 — Two-column page-break sync + overflow-as-manual-break

> Working design doc for the multi-session PB-007 effort. Owner-specified 2026-06-04/05.
> Tracking row lives in `docs/qa/MASTER_BACKLOG.md` (§3 Page Break). This file holds the
> full design, the root-cause analysis, the build order, current state, and open questions
> so the work can be picked up cleanly.

## Goal (owner spec)

The 2-column CV (main column + navy sidebar) must paginate as a real multi-page document
in Preview *and* export, with these rules:

1. **Cross-column sync** — main and sidebar share physical pages. If a main item is on
   page N and a sidebar item is on page N, both start together on physical page N.
2. **Overflow promoted to a real break** — if a column has a manual break to page N, OR a
   column is simply longer than the page and *slides* to the next page, the slid content
   gets the full manual-break treatment:
   - the page separator appears before it,
   - its page button reflects the page it landed on,
   - the button is **forward-only**: an item that naturally lands on page 2 cycles
     2→3→4→2, never back to 1 (you can push further, never before where it falls).
3. **PB-002 (first item rule)** — a break on the FIRST item of a sub-subsection moves the
   WHOLE subsection (heading + items) and everything after it to the next page, with **no
   "(Cont.)" header** (it's the section starting fresh, not continuing). A break on a later
   item splits it and repeats the heading with "(Cont.)".
4. **Parity** — identical in Preview, DOCX, and PDF.

### Granularity (owner clarification 2026-06-05)

Breaks operate at the **sub-subsection (item) level in BOTH columns**. Sidebar items
(Standards, Context, Languages, …) are the equivalent of the main column's per-role job
lines. The overflow detector must compute the natural page **per item in the sidebar as
well as the main column**, not per section.

### Marker styling (owner)

- **Main column:** the pink "▼ PAGE N ▼" divider (Professional Experience style,
  `rgba(200,40,40,0.7)` white text) — globalized in `284` (1.50.128).
- **Sidebar:** the marker should be **yellowish (not red)** and the owner wants it on the
  **editor panel just above the broken item, NOT rendered as a bar in the preview**. The
  preview should just *move the content*. (Current `329` renders a yellowish bar in the
  preview — interim; the panel-marker relocation is open, see Q3.)
- **No redundant "(Cont.)" header** — today `329` shows both a "PAGE N — TITLE (CONT.)" bar
  AND a separate "TITLE (CONT.)" head; they look redundant while content doesn't actually
  move.

## Root cause (why the sidebar break "does nothing")

The on-screen preview is **one continuous-scroll paper** — it never re-paginates. The
page-break sidecars (`284` main, `329` sidebar) insert a print-only `break-before:page`
spacer + a visible marker, but they do **not relayout the preview into separate pages**.
Professional Experience *appears* to move because **app.js paginates the main column
natively**; the sidebar has no equivalent, so `329`'s markers show but content stays put.

**Therefore the foundation is real preview pagination, driven by an A4 overflow detector.**
Markers are cosmetic until content genuinely moves; stop blind-patching markers.

## Build order (incremental, verify each live)

1. **Overflow detector** — measure each column's rendered content height against the A4
   page box; compute, per item (both columns), the natural page it falls on. (This is the
   open `PAGEBREAK-002`.) Output: `{ col, sid, itemIdx → naturalPage }`.
2. **Real preview pagination** — use the detector + manual `itemPages` to actually split
   each column into page blocks so content visibly moves. Replicate/extend whatever app.js
   does for the main column to the sidebar.
3. **Forward-only page button** — clamp each item's minimum page to its natural page
   (2→3→4→2). Depends on (1). Owners: `247`, `359` (sidebar), main-column page buttons.
4. **Auto-marker at overflow** — render the divider (+ PB-002/003 heading rules) at every
   *natural* overflow boundary, not just manual ones. Sidebar marker per Q3.
5. **Cross-column sync** — align main/sidebar page boundaries so shared page-N content
   renders together.
6. **Export parity** — mirror the computed pagination into the docx-worker (`generate.js`)
   so DOCX/PDF match.

## Current state (shipped, as of 1.50.132)

- `284` main-column marker → global pink (1.50.128).
- `329` sidebar: renders break + bar + "(Cont.)" for any sidebar section with page≥2;
  applies PB-002 (item-0 → whole section, no Cont.) / PB-003 (later → Cont.). Bar reverted
  to yellowish; **red-bar flood fixed** (root-level clear, 1.50.132).
- `359` (new) — page control on every sidebar sub-section item, scoped to its own sid.
- `247` — Additional Information control, scope-fixed (1.50.129) so it no longer hijacks
  other sidebar sections.
- **Not yet:** the overflow detector, real pagination, forward-only, cross-column sync,
  export parity, and the panel-marker relocation. Content does NOT actually move yet.

## Open questions (need owner / live DOM)

- **Q1 — PARTIALLY ANSWERED (code, 2026-06-05).** app.js stores the break **per item** as
  `e.pageBreakBefore` and renders `break-before:page` / `page-break-before:always` on that
  item (grep app.js: `breakBefore:e.pageBreakBefore?"page":void 0`). It does NOT read
  `antcv:itemPages` (that's the sidecars' key) — so the main column and the sidebar use
  **two different page models**: app.js `e.pageBreakBefore` (main, native) vs
  `antcv:itemPages[sid][idx]` (sidebar, via `329`/`247`/`359`). Unifying these is part of
  PB-007.
- **Q2 — THE PIVOTAL UNKNOWN (needs live DOM / Claude-for-Chrome).** `break-before:page`
  is a *print-media* property. For Professional Experience to **visibly move on the screen
  preview**, the preview must be split into real page boxes (`.antcv-page-row` /
  `[data-antcv-page]` exist in selectors). Confirm live: does the screen preview actually
  render multiple `.antcv-page-row` containers (true on-screen pagination), or is the owner
  seeing the content reflow some other way? This determines the ENTIRE approach: if the
  preview paginates into page boxes, the sidebar just needs its items assigned to the right
  box; if not, we must build on-screen pagination from scratch. **Do not build the overflow
  detector / pagination until Q2 is answered** — it decides whether we place items into
  existing page boxes or create them.
- **Q3.** Sidebar marker: confirm it lives on the **editor panel** above the broken item
  (yellowish), with NO bar in the preview — the preview just moves the content.

## Notes / risk

This is the contended page-break zone with a corruption history (see CLAUDE.md). Diagnose
live before patching; the owner has Claude-for-Chrome for DOM inspection. Build the
detector as a measurement utility first (testable), then layer pagination on top.

---

## UPDATE 2026-06-05 — Q2 answered + the real mechanism (owner console + clarification)

**Q2 ANSWERED.** The screen preview DOES paginate into real `.antcv-page-row` boxes:
- ProfExp break → `page-row boxes: 1 → 2` (a second physical page box is created on screen).
- Sidebar-only break (Regulatory Context p2) → `page-row boxes: 1` (NO second box).

So app.js creates page boxes **only** from the main column's native `e.pageBreakBefore`. The
sidebar's `antcv:itemPages` model never triggers a box, so sidebar content has nowhere to go.

**Two things are required to actually move a sidebar section to page 2:**
1. **Page-box creation** — a sidebar break must cause app.js to create/extend the page-2 box
   (today only the main column does). Unify the page model or set an app.js-visible flag.
2. **Table break (owner)** — sidebar sub-sections are rendered as **tables**; a page break
   *inside* a table doesn't move it — the **table itself must break** (PB-004 logic). Both
   the page break AND the table break are needed. This ties PB-007 to PB-004.

**Perf (fixed 1.50.133):** `359` was dispatching `antcv:sections-updated` per click →
personality `forceRebuild` → rAF violation flood. Removed it (kept `item-pages-changed`);
the main-column button never did this and the forceRebuild wasn't helping (no box created).

**Still-open marker:** the editor-PANEL marker app.js shows for ProfExp —
`📄 PAGE 2 — EXPERIENCE (CONT.) header appears here ▼` (amber, in the panel, not the preview)
— is missing for sidebar sub-sections. Owner wants the same panel marker above the broken
sidebar item. Add it when building sidebar pagination.

**Next build step:** find app.js's page-box creation (how `e.pageBreakBefore` makes a new
`.antcv-page-row`) and the sidebar TABLE structure; drive both from a unified page model so a
sidebar break (a) creates the box and (b) breaks the table into it.

---

## UPDATE 2026-06-05 (b) — structural confirmation: why the sidebar can't paginate

Owner: "sidebar sub-subsections must act like the main role boxes." Confirmed the actual
structure in app.js:

- **Main role boxes** = `div`s (NOT tables) that carry app.js's **native** flag
  `e.pageBreakBefore` → rendered as `breakBefore:"page"`. app.js's **own pagination engine**
  consumes that and creates a new `.antcv-page-row` box (boxes 1→2). This is why the main
  column moves.
- **Sidebar items** = `div`s (`data-antcv-row-path:"items.N"`) in the **sidebar column,
  which app.js's pagination engine does NOT process**, and they use the SEPARATE
  `antcv:itemPages` model (sidecars `329`/`247`/`359`) that app.js never reads.
- `<table>` is used only for Core Competencies / What-I-Bring grids, not the role boxes.

**So the fix is not "div → table".** It is: make the sidebar sub-subsections **participate
in app.js's native pagination** — carry the native break flag AND be processed into page
boxes the same way the main role boxes are.

### Hard constraint: app.js is an EXTERNAL build (per CLAUDE.md)

app.js is minified + built outside this repo; sidecars patch *around* it. We cannot edit
app.js's pagination engine here. Two realistic paths:

- **Path A (sidecar replicates sidebar pagination):** a sidecar measures the sidebar column,
  creates/extends the `.antcv-page-row` page box for the sidebar, and moves the broken
  sidebar sub-section (table/items) into it — i.e. build sidebar pagination to mirror what
  app.js does for the main column. Self-contained but non-trivial; must also break the table.
- **Path B (change app.js source):** if the owner has the app.js source/build pipeline, make
  the sidebar column run through the same pagination as the main column and have the sidebar
  page control set the native `e.pageBreakBefore`. Cleanest, but requires the external build.

**Decision needed (owner):** Path A (sidecar, we can do it here) or Path B (needs app.js
source access)? This decides the whole PB-007 sidebar build.

---

## UPDATE 2026-06-05 (c) — owner chose PATH B; access blocker

Owner selected **Path B (change app.js source)** so the sidebar column runs through app.js's
native pagination. BLOCKER: the app.js source is NOT in this repo — `pwa/app.js` is the
minified external-build artifact (12 long lines, no sourcemap), `vite build` only produces
the islands bundle, and the session's GitHub scope is `gabrielk83/antcv` only (no
list/add-repo tool). So Path B cannot be executed from this session as-is.

**Ways forward (owner to pick):**
1. Add/point the app.js **source repo** into the session scope → I implement Path B there.
2. I write a precise change-spec for the app.js pagination (make the sidebar column run the
   same page-box pagination as the main column + sidebar page control sets the native
   break flag) → owner applies it in their app.js build.
3. Fall back to **Path A** (sidecar replicates sidebar pagination) — fully doable here, no
   external access — if a working result is wanted before the app.js build can change.
