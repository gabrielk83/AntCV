# Margin (academy) two-column CV layout — header inside the sidebar panel

Status: **implemented 2026-11-05 (MARGIN-LAYOUT-001, 1.51.5865).** Owner rule of record (2026-11-05):
"currently our default 2 column structure is with header text inside sidebar (academy format)".
The house generator (`Application Generator Files/housestyle_pdf_generator/course_cvs_2026-10-01/gen_margin.py`
+ `finish_margin.ps1`) is the format of record since 2026-11-01. Reference render: package 1051
(`out_1051/CV_LEGO_Senior_TPM_Advanced_Development_margin.pdf`).

## 1. House composition (what gen_margin builds)

| Region | Rule in the house PDF |
|---|---|
| Page | A4, 30 pt margins, one table row 31 % / 69 % that breaks across pages. |
| Left panel | Pale brand tint (`pal[0]`), 4 pt accent bar on its outer edge, 8 pt padding. Runs from the page top. |
| Panel head | Ringed round photo 84 × 84 px, left-aligned; name 16 pt Trebuchet bold, near-black, line 105 %; target title 10 pt bold in the accent colour (a long title breaks after its first comma, or `target_lines`); then a `CONTACT` sub-heading (8.5 pt uppercase accent, 0.75 pt accent rule) and ONE contact item per line, 10 pt, each with its glyph (⌂ ★ ☎ ✉ 🔗). |
| Panel body | Proof points, core competencies, languages, education, patent, courses: sub-headings in the same style. |
| Main column | Starts at the page top with `PROFILE: headline` (11 pt uppercase, 1 pt accent rule), then the requirement table, experience, tools, personal rows. |
| No band | There is no full-width candidate band anywhere. |

The brief said "one contact line"; the reference PDF has one contact ITEM per line under a `CONTACT` heading. The
reference wins (a 31 % panel cannot hold the whole contact on one line).

## 2. The app today (before this change)

The two-column CV (package `copenhagen-modern` and every other package) draws a full-width candidate band above both
columns: preview `[data-antcv-candidate-band="1"]` in `app.src.js` (rounded box, photo at the sidebar midline,
name/spec/contact centred; `antcv-copenhagen-v2-001.js` fits the lines), export `headerRows` + the page-anchored
`AntCVHeadBox` VML roundrect (`workers/docx-worker/src/index.js`, `buildTwoColumnDocument` / `postProcessDocx`).
The sidebar panel and `PROFILE` start under the band. `layout: "linear"` (EXEC-LINEAR) is the precedent for a
layout value carried from the Page-flow control through `antcv:cvLayout` to the export payload.

## 3. Decision

`margin` is a third **CV layout value** next to `two_column` (band) and `linear`, and it is the **default**:

| Store `antcv:cvLayout` | Preview | Export payload `layout` |
|---|---|---|
| absent (default) or `margin` | header card inside the sidebar, no band | `margin` |
| `two_column` (explicit opt-out, "Two-column (band)") | the band, as before | `two_column` |
| `linear` | single column (unchanged) | `linear` |

Kill switch: `localStorage['antcv:disable-cv-layout-margin'] = '1'` makes the default the band again (preview and
export). Letters are untouched: the CL keeps its band header (the house letter is a separate letterhead document).
The margin layout is a LAYOUT, not a palette: every package keeps its own colours; nothing in `va[...]` changes.

Why default and not opt-in: the owner names it the current default, and every application package since
2026-11-01 (1048–1057) shipped in it. Why keep `two_column`: the band is a signed-off design with its own tuning
(CPH-BAND-*); it stays one select away and is the fallback when the sidecar is killed.

## 4. Geometry (preview px at 96 dpi · export)

| Element | Preview (`[data-antcv-sidebar-card]`, first child of the page-1 sidebar) | DOCX (first paragraphs of the page-1 sidebar cell) |
|---|---|---|
| Photo | 84 × 84, left, `__photoFrame` (shape/contour prefs), ring in `photoBorderColor` (1.5 px on copenhagen), 8 px below | inline `ImageRun` 84 × 84, left, outline 1.5 pt (`_cphCyan` on copenhagen, else `photoBorderColor`), after 120 twips |
| Name | 16 pt (21.3 px) bold, head font, `sidebarTextColor` ink, left, line 1.05; `fontSizes.nameSize` wins when set | 16 pt bold `headerFont`, `sidebarTextColor`, line 252 auto; `font_sizes.nameSize` wins |
| Title (specialisation) | 10 pt bold, `sidebarHeadColor`, left, WRAPS (no nowrap/ellipsis); `fontSizes.specialisation` wins | 10 pt bold `headerFont`, `sidebarHeadColor`; `font_sizes.specialisation` wins |
| `CONTACT` heading | same look as a sidebar section headline (head font, `sidebarHeadColor`, uppercase, sbHead size, rule in the sidebar line colour); label per language (CONTACT / KONTAKT / CONTACTO / 联系方式) | `headingParagraph(label, ctx, true)` — the same builder the sidebar sections use |
| Contact items | one per line, 10 pt (sbBody), `sidebarTextColor`, glyph + value, LinkedIn/email/phone stay click-to-edit | one `Paragraph` per item, sbBody pt, `sidebarBodyFont`, LinkedIn as a hyperlink |
| Band | not rendered (no empty strip either) | no `headerRows`, no `AntCVHeadBox`, no top-strip shading; the sidebar spine still paints the full height |
| Page 1 row | — | `CONT_BODY_MIN` (no band budget); seam borders off |
| Panel | the copenhagen inset panel as today (9 px radius, 7.4 px insets). The house 4 pt edge bar is NOT drawn: the app's sidebar runs flush to the sheet edge (SIDEBAR-SPINE), so the bar would sit on the paper edge. | same |

Photo positions: `sidebar-top`, `band-overlap`, `header-left`, `header-right` move into the card (their native
placement is gone with the band). `main-*`, `bridge-*`, `sidebar-bottom` keep their placement and the card has
no photo. `hidden`/`none`: no photo.

Paginator budgets (`antcv-auto-pagebreak-block-001.js`, applied by the sidecar via `AntcvAutoPagebreak.config`):
`PAGE1_BAND 152 -> 0` (the main column gains the band height on page 1) and `SIDEBAR_PAGE1_BAND 230 -> card
height + 78` (the 78 is the non-band residue of the tuned 230). Restored to 152 / 230 when the band is back.

## 5. Files

| Layer | File | Change |
|---|---|---|
| Layout store + apply | `pwa/antcv-cv-layout-margin.js` (new) | `window.__antcvCvLayout()` / `__antcvCvLayoutIs()`, `body[data-antcv-cv-margin]`, card CSS, paginator budgets |
| Control | `pwa/antcv-role-line-format.js` | CV layout select: Two-column (header in sidebar) · Two-column (band) · Linear |
| Preview | `pwa/app.js` + `pwa/app.src.js` | band gated off in margin mode; card (`data-antcv-sidebar-card`) rendered first in the page-1 sidebar; the sidebar-top photo gated off there |
| Export client | `pwa/antcv-docx-client.js` | `readCvLayout()` returns `margin` by default |
| Worker | `workers/docx-worker/src/index.js` | `layout: "margin"` accepted; `buildMarginSidebarCard`; no header rows / head box / seam; photo routing |
| Tests | `pwa/test/unit/cv-layout-margin.test.mjs`, `workers/docx-worker/test/margin-layout.test.mjs` | store default + kill switch + control + lockstep; band rows absent + card present in the DOCX |

## 6. Open items

- The house photo ring has a white gap between ring and photo (PHOTO-RING-001, drawn in PIL). The app draws the
  ring without the gap in both surfaces; a client-side canvas composite would close it.
- The house panel breaks a long title after its first comma; the app wraps the specialisation at the panel width.
