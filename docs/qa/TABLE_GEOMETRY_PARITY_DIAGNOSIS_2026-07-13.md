# TABLE-GEOMETRY-PARITY-001 — diagnosis (2026-07-13)

Task: OPEN_REGISTER row 25 / ACTIVE_BUGS 2026-07-02. Diagnostic-first, no product
code changes. Core Competencies table in the exported PDF wraps first-column
labels to two lines where the preview (at the owner's dragged splitter ratio)
shows one line. Requirement: "no squeezed table, no letters after border, in
either format."

Method: rendered a fixture CV through the **deployed** docx-worker
(`docx-worker.karp-gabriel-a.workers.dev`, v1.14.152, `/generate-pdf` → real
CloudConvert PDF) at a `tableRatio` sweep; measured actual column geometry and
label wrap with PyMuPDF. Font advance widths measured with Pillow against
`C:\Windows\Fonts`. Preview geometry computed from `app.src.js` constants +
the in-repo 100%-A4 live calibration recorded in TABLE-WRAP-PARITY-001.

## Verdict

The parity gap is **one systematic contributor: the preview cell font-size
rounding**. Everything else (ratio forwarding, font family, padding, table
width) is already matched. A second, latent bug affects the *width*-handle path.

- Preview renders the competency cell at `Math.round(1.333 × 10pt) = 13px`,
  i.e. **0.975×** the true 10pt (`13.333px`). Its first-column labels therefore
  measure **2.56% narrower** than the 10pt Carlito the PDF actually lays out.
- The owner drags the splitter until the label fits **in that 2.56%-shrunk
  preview**, landing on a ratio ~**0.005 (0.5 percentage points)** below the
  ratio the PDF needs → the PDF wraps to two lines.

## Quantified mismatch (per contributor)

| # | Contributor | Preview | Export (PDF) | Delta / wrap impact | Source |
|---|---|---|---|---|---|
| a | Column ratio → col1 width | col1 = r × table | col1 = r × 7689 twips (measured slope 385pt/unit ratio = 7700 twips) | **0** — ratio forwarded faithfully, mapping identical | MEASURED (PDF) |
| b | Font advance width | T = `Carlito,Calibri,…` | Calibri→Carlito (LibreOffice substitute) | **0.00%** — Carlito is a byte-identical Calibri metric clone | MEASURED (Pillow) |
| c | Cell L/R padding | `7px 10px` → 10px | margins 150 twips = 7.5pt = 10px@96 | **0** (matched by CORECOMP-TABLE-CELL-PAD-001) | source |
| d | **Cell font size** | **13px** = round(1.333×10) | **10pt** = 13.333px@96 | **13/13.333 = 0.975 → labels 2.56% narrower in preview → ratio-threshold gap ≈ +0.005** | source + MEASURED |
| e | Hard line-clamp | 3 lines (`-webkit-line-clamp:3`) | DOCX/CloudConvert PDF: **no clamp** (natural wrap). HTML-export path: 2 lines + max-height clip | not the cause of the observed 2-line PDF wrap; HTML-export clip is a separate "letters after border" risk | source |

### Measured wrap thresholds (real CloudConvert PDF)

Fixture labels, Carlito 10pt bold, one-line widths measured in the PDF
(≈ Pillow prediction, within 0.2%):

| Label | one-line width (PDF) | wraps at r | fits at r |
|---|---|---|---|
| Quality & process | 73.2pt (1464 tw) | ≤ 0.22 | 0.24 |
| Product & systems | 77.4pt (1548 tw) | 0.24 | 0.25 |
| Systems engineering | 85.3pt (1706 tw) | 0.26 | 0.28 |
| V&V and compliance | 86.4pt (1728 tw) | 0.26 | 0.28 |

Export threshold model (calibrated to every measured transition):
`r_export = (label_pt + 16) / 385` where 16pt = 2×7.5pt margin + ~1pt border.

Preview threshold model (100%-A4 calibration: table = 7689 tw ≈ 512.6px@96,
col1 = r×512.6, 10px padding, 13px font):
`r_preview = (em×13 + 21) / 512.6`.

| Label | r_preview (shows 1 line) | r_export (PDF fits 1 line) | gap | if preview font = 13.333px |
|---|---|---|---|---|
| Quality & process | 0.227 | 0.232 | +0.005 | 0.232 (≈0) |
| Product & systems | 0.238 | 0.243 | +0.005 | 0.243 (≈0) |
| Systems engineering | 0.258 | 0.264 | +0.006 | 0.263 (≈0) |
| V&V and compliance | 0.261 | 0.266 | +0.006 | 0.266 (≈0) |

The whole gap collapses to ~0.0004 when the preview cell font is the true
13.333px — confirming contributor **(d)** is the sole systematic cause.

## Secondary finding — stale width reference (WIDTH-handle path only)

`renderCompetencyTable` default CV table width was changed to `mainW − 288 =
7689 twips` (PREVIEW-PDF-GEOMETRY-001, left-aligned, matches the preview's
512px table). The **client width forwarder was never updated**: on a
non-default width drag it forwards `_twDxa = round(6630 × pct/100)`
(`antcv-docx-client.js:261,2568`; comment "MAIN_W − 640, ~4.6\"" =
the OLD centered geometry). At pct = 100% the drag is skipped (worker keeps
7689), but any width nudge forwards a table ~**1059 twips (~55pt, ~14%)
narrower** than both the preview and the worker default → col1 shrinks and
labels wrap harder. This does not fire on the ratio-splitter gesture the owner
described, but it is a real second fidelity gap on the width handle.

## Recommended minimal fix (with numbers)

**PRIMARY (root cause, preview side).** Render the CV competency cell at the
true 10pt instead of the rounded 13px. In `app.src.js` the size is
`$.tbl = N(_.mainTblCell)` with `N = e => Math.round(1.333*e)` (`~5590,5598`).
Give the table cell an **unrounded** size (`1.3333 × mainTblCell = 13.333px`,
+0.34px) rather than changing `N` globally. Effect: the preview one-line
threshold moves from r≈0.238 → r≈0.243 for "Product & systems", matching the
measured PDF threshold — the owner's dragged ratio now agrees with the export.
No worker change, no geometry shift; fractional font-px renders fine.

**ALTERNATIVE (worker side, if preview must stay pixel-rounded).** In
`renderCompetencyTable` widen col1 by the rounding factor 13.333/13 = **1.0256**:
`col1 = round(tableW × ratio × 1.0256)` (≈ **+42 twips at r=0.25**: 1922→1964),
clamped so col2 keeps a sane minimum. Guarantees any label that fits one line
in preview also fits the PDF. Downside: shifts the col1/col2 border ~2pt.

Prefer the PRIMARY fix — single factor, at the source of the discrepancy, zero
table-geometry movement.

**SEPARATELY**, correct the stale width reference: `antcv-docx-client.js`
CV `defaultDxa` 6630 → **7689** (and the `:42`/`:399` comments), so
width-handle drags stay faithful to the current `mainW − 288` worker default.

## What is measured vs computed

- MEASURED (deployed worker + real CloudConvert PDF, PyMuPDF): col1 width =
  ratio × 7689 twips; per-label wrap thresholds; label one-line widths.
- MEASURED (Pillow, C:\Windows\Fonts): Calibri ≡ Carlito advance widths, 0.00%.
- COMPUTED (app.src.js constants + the TABLE-WRAP-PARITY-001 in-repo
  100%-A4 live calibration of 512px table / 13px font): preview col1 px and
  preview thresholds. Preview px scale is design-intended 96 dpi; a heavier
  preview zoom (fixed 13px font, responsive paper) only *widens* the gap, so
  the font-rounding floor is the minimum, zoom-independent mismatch.
