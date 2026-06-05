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

- **Q1.** How does app.js paginate the main column today (the mechanism that makes
  Professional Experience visibly move to page 2)? Need to inspect it to replicate for the
  sidebar — likely the cleanest path is to drive both columns through one detector.
- **Q2.** Is the preview ever a true multi-page render, or always continuous-scroll with a
  single `.antcv-preview-paper`? (Determines whether we add real page blocks or simulate.)
- **Q3.** Sidebar marker: confirm it lives on the **editor panel** above the broken item
  (yellowish), with NO bar in the preview — the preview just moves the content.

## Notes / risk

This is the contended page-break zone with a corruption history (see CLAUDE.md). Diagnose
live before patching; the owner has Claude-for-Chrome for DOM inspection. Build the
detector as a measurement utility first (testable), then layer pagination on top.
