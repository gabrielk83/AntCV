# Universal table type redesign — spec (owner 2026-06-22)

Next-session feature. The CORE COMPETENCIES (CV) + WHAT I BRING (CL) tables currently have a row editor
(sub-subpanel) that the owner reports as **regressed for both tables**. Replace/upgrade to a universal
`table` type with the full control set below — the same way `rich_block` unified the text sections
(see [[rich-block-universal-section]]). Reuse the rich_block control patterns (CJLR / enhance / fit-it /
per-row page / up-down / delete) where they map.

## High-level (table placement in the subpanel)
- Whole-table **CJLR**, **enhance**, **fit-it**
- **Show / hide** the table
- **Editable in the live preview** (like rich_block)

## Table structure (in the editor sub-subpanel)
- **Heading** — view / hide
- **Horizontal line** (under heading) — view / hide
- **Header-row CJLR** (the "Focus Area / Strategic Expertise" header)
- **Table-heading CJLR**
- **Italic**, **Bold** (whole-table or header text style)
- **Resize column ratio** — drag the border BETWEEN the two columns
- **Resize table size** — drag the table's EXTERNAL borders
- **Space after table**
- After the last row: **+ Add** button

## Per row
- **Visible / hide**
- **Page break** — a page break on **row 1 moves the ENTIRE table** to the next page (rows 2+ break
  mid-table)
- **Textarea col 1** (Focus Area) + **Textarea col 2** (Strategic Expertise) — editable
- **Row up / down**
- **Text CJLR**
- **Enhance**
- **Fit-it**
- **Delete ✕**

## Settings-only (NOT in the table panel — edited from Settings)
- **Gap before table**, **gap after table**
- **Heading** (text/visibility)
- **2 columns** (column model)
- **Heading color**
- **Banded rows** + band **color**
- **Min / max chars per table width** (the per-doc cell caps — CV tighter than CL, see
  CORE-COMP-COMPRESS-001 / 1.50.783)

## Notes / dependencies
- Per-row page break must integrate with the existing pagination stores (`antcv:itemPages[sid]`) and
  the salmon splitter (the row-1-moves-whole-table rule mirrors the section-level move). See
  [[pagination-two-map-and-worker-test]] + [[salmon-splitter-permanent]].
- Preview editability + the column-ratio drag already exist partially (`cl/cvTableRatio` standalone
  keys, `ke` ratio handle); the drag-persist hazard applies — drive the React input via the native
  setter, store render prefs in standalone localStorage keys (see [[sidecar-prefs-clobber-hazard]]).
- Export parity: the docx-worker table renderer must honor the same per-row page / CJLR / band / cap.
- **Regression first:** before adding controls, diagnose what regressed in the current CORE COMPETENCIES
  / WHAT I BRING row editor (owner's 2026-06-22 screenshots — both tables).
