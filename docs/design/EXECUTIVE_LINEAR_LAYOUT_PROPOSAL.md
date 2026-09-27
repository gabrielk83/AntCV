# Executive Linear layout — gap analysis and proposal

Date: 2026-09-27. Source: owner's hand-edited `Gabriel_Karp_Gershon_Product_Manager_CV.docx` (2 pages, A4) vs. the current AntCV preview/export. Status: proposal, nothing implemented.

## 1. What the owner changed in the Word file

Diff of `word/document.xml` against the script-generated original.

| # | Change | Detail |
|---|--------|--------|
| 1 | Header became a photo + text block | Borderless 2-col table, 3 rows: 0.98" photo column, 6.2" text column. Circular photo 0.75" (308 px JPEG), 0.75 pt accent ring, anchored to page. Behind it a rounded-rect shape `HeaderBox`, 7.18" × 1.0", fill `#F8FAFC`, 0.75 pt accent stroke. Same shape as the Copenhagen header box, light fill instead of navy. |
| 2 | Margins tightened | Top/bottom 0.55" → 0.50"; left/right 0.65" → 0.39" (1 cm). Content width 7.0" → 7.5". All tables re-widened to 10037 twips. |
| 3 | Experience kept on page 1 | Page break moved after "Earlier Career". Page-2 running header retitled "(Technical Arsenal)". Page 2 = education, tools, patents/languages only. |
| 4 | Bullet ink unified | Body run colour Slate-700 dropped; all bullet text 10 pt `#0F172A`. |
| 5 | "(EU Citizen)" removed from the title line. | |
| 6 | Accidental | 3 of 12 bullets justified (`jc=both`), the rest left. Company run size 9 pt in one role, 9.5 pt elsewhere. Regularise before sending. |

Kept from the original: three tinted blocks (profile callout with left accent bar, 3-tile capability strip, 2×2 tool tiles), two-column education, lead-bold bullets, uppercase section heads with a thin accent rule, `title — company   (dates | location)` on one line.

## 2. Why this reads lighter than Copenhagen Modern

| Dimension | Copenhagen Modern (preview `Ce()`, `app.src.js:6007-8677`) | Owner's document |
|-----------|---------------------------------------------------------------|------------------|
| Columns | Fixed sidebar (33 %) + main. Sidebar body 10 pt, 12/11 px padding. | Single column, full 7.5" width. |
| Header | Navy band `#33446F`, min-height 200 px, centred, 3 stacked rows. | 1.0" light box, photo left, three left-aligned lines. |
| Section head | 11 pt uppercase, 1.5 pt grey rule, 14 px section gap. | 10 pt uppercase, 1 pt accent rule, 7 pt before / 3 pt after. |
| Profile | Paragraph(s) of text. | Three lead-bold rows in a tinted callout. Scannable. |
| Competencies | 2-col table, shaded header, banded rows, cells clamp at 3 lines. | Three equal tiles, title + one sentence each. |
| Role line | `title, company` left, years right, flex nowrap. No location field. | `title — company   (dates \| location)`. |
| Bullets | `▪`, justify, 1.15 lh, 1 px gap, all black. | `•`, left, 1.12 lh, 1 pt gap, bold lead + text, one ink. |
| Education | One line per degree, sidebar. | 2-col grid, 3 lines per degree (degree / school+years / focus). |
| Tools | Sidebar `labeled_list`. | 2×2 tiles with left accent bar. |
| Page 2 | `repeatHeader` slim strip (off by default). | Name — role (section scope) with rule. On by default. |

Crowding sources in AntCV: the sidebar halves the main column so 10.5 pt justified bullets wrap to 3–4 lines; sidebar and main compete for eye; the 200 px header band eats 20 % of page 1; competencies as a full-width table is a heavier object than three tiles.

"Research Formal" is a writing style, not a layout (`app.src.js:3851`, `antcv-style-page-budget.js:71`). Its crowding is the same two-column renderer plus a 3-page budget with more sections.

## 3. Proposal — `Executive Linear` layout

Not a new palette. A new **layout** value (`layout: 'linear'` already exists for the cover letter in the worker payload, `antcv-docx-client.js:856-1280`; `buildTwoColumnDocument` at `index.js:24941` is the CV-only path). Add a CV linear path in both preview and worker. Palettes (Copenhagen, Navy, …) keep applying; only the skeleton changes.

### 3.1 Block primitives (new)

| Primitive | Reuses | Adds |
|-----------|--------|------|
| `callout` | `rich_block` rows `{b,t}` with `leadBold` (`app.src.js:6815-7093`) | Section option `block: 'callout'` → tinted box, 12 pt left accent bar, 1 px hairline. DOCX: 1-cell table, shading, `tcBorders` left sz 24. |
| `tiles` | `table` / `labeled_list` rows | Section option `block: 'tiles'`, `cols: 2\|3\|4`. Each row `{b,t}` → cell with bold title, one-sentence body, left accent bar sz 12–16, fill. DOCX: fixed-layout table, `tblBorders none`. |
| `columns` | `education`, any `list` | Section option `cols: 2` → flow items into N equal cells, no fill, no borders. |
| `details` | `labeled_list` / `rich_block` rows | Section option `block: 'details'` → 2-col label \| content table. Label cell tinted with left accent bar; content is one paragraph or nested `{b,t}` sub-rows (Interests). Hairline row rules. Used for the closing "Patents, Languages & Interests, Profile Details" block (v2, 2026-09-27). |
| running header | `styleConfig.repeatHeader` (`app.src.js:46437`, worker `makeSlimHeaderRow` 25334) | Text template: `{name} — {specialisation} ({scope})`, bottom rule. Default on in linear. DOCX: real section header with `titlePage` (no header on page 1) instead of an inline paragraph + hard page break — content must flow, a hard break pushed v2 to 3 pages. |
| role location | `role` object (`{id,title,company,years,…}`) | `role.location`. Role-line format option `titleCompanyMeta`: `title — company   (years \| location)`. |

Content rule carried from the v2 file: one employer, one role per line item. A role span above ~5 years at the same employer is split into its real successive positions (Innoviz → System Architect 2017–2020, Change Control Lead & Customer CR Manager 2020–2025). The kernel already stores them split; the writer must not merge them.

Everything else already exists: lead-bold bullets (`bullets` `{b,t}`, 7114), section reorder, per-role page breaks, `contHeadlines`, photo header-left (`photoPosition`), spacing sliders.

### 3.2 Linear skeleton defaults

- Page: A4, margins 12.7 mm top/bottom, 10 mm sides (matches owner's file; current `bodyEdgePad`/`mainEdgeIndent` map onto these).
- Header: box 1.0" tall, radius 8 px, fill = package `sidebarBg` (light), stroke = accent. Photo left, circle, 0.75", ring accent. Name 20 pt, title line 10.5 pt accent bold + 10 pt muted, contact 9.5 pt. All left-aligned.
- Section order: profile (callout) → core_comp (tiles ×3) → experience (flows across the page boundary, running header on page 2) → education (cols 2) → tools (tiles 2×2) → details table (patents, languages, interests with sub-rows, accessibility).
- Reference build: `Gabriel_Karp_Gershon_Product_Manager_CV_v2.docx` (2026-09-27, 2 pages, 6 roles incl. Trackman 2026–). Generator: scratchpad `build_cv2.js` (Node `docx`), the target the AntCV export must match.
- Type: body 9.5 pt, bullets 9.5–10 pt, lh 1.12, bullet gap 1 pt, role gap 5 pt, section gap 7/3 pt.
- Copenhagen palette mapping: accent `#00746E`, bar `#01B9BD`, fill `#DCE5EA` at 40 % (`#F1F5F9`-class), ink `#283556`.

### 3.3 Preview panel — UI/UX changes needed

Controls that do not exist today and are required to drive this structure:

| Control | Where | State key | Notes |
|---------|-------|-----------|-------|
| **Layout** segmented: Two-column / Linear | Package picker card (`app.src.js:40196-40360`) | `cvLayout` | Linear hides sidebar position and sidebar width; sidebar sections move to main with `loc:'main'`. |
| **Block style** per section: Plain / Callout / Tiles | Section panel (`antcv-section-panel-211.js`) | `section.block` | Tiles exposes **Columns** 2/3/4 (`section.cols`). Show only on `rich_block`, `table`, `labeled_list`, `education`, `list`. |
| **Columns** for education / lists | Section panel | `section.cols` | 1/2. |
| **Role location** field + **role line format** | Role editor | `role.location`, `styleConfig.roleLineFormat` | Formats: `title, company · years` (current), `title — company (years \| location)`. |
| **Density** preset: Compact / Normal / Airy | Above SPACING & INDENTS (`app.src.js:15948`) | writes the 11 existing spacing keys + `fontSizes` + lh | Owner's file = Compact. Manual slider edit → "Custom". |
| **Running header** text + on/off | PAGE FLOW (`app.src.js:16028-16060`) | `styleConfig.repeatHeader`, `repeatHeaderScope` | Scope auto = section titles on that page. |
| **Header box** fill: Band (dark) / Light box / None | Header controls (`antcv-header-rule-control.js` area) | `styleConfig.headerBoxMode` | Light box = owner's file. Photo ring follows accent. |
| **Bullet alignment** Left / Justify | Bullets group in SPACING | `styleConfig.bulletAlign` | Today hard-coded justify (7636). Linear default left. |
| **Page budget** indicator | Preview paper top | read-only | Show page count and which section crosses. Owner's target is 2 pages with experience on page 1. |

UX rules:
- Block style and columns are per-section chips on the section header in the preview, not buried in a panel. One click, immediate re-render.
- Density preset must be a single control; the 11 sliders stay as "Advanced".
- Switching to Linear keeps content; it only rewrites `loc` and default `block`. Switching back restores the saved two-column map.
- Photo controls in Linear collapse to: position (header-left / header-right / none), size, shape.

### 3.4 Worker changes

- New `buildLinearCvDocument` next to `buildTwoColumnDocument` (`index.js:24941`): one column, no sidebar table; header as 2-col table (photo | text) inside a shaded rounded rectangle (reuse the Copenhagen VML box from `postProcessDocx` 23951-24055 with light fill).
- Renderers: `renderCallout`, `renderTiles(cols)`, `renderColumns(cols)` built on existing table helpers; `renderExperience` (27921) gains `location` and the `titleCompanyMeta` format.
- Fix existing preview/export drift while there: separator (`,` vs `|`), title italics, years colour `595959` vs `#777777`, `deg - sch` vs `deg: sch`.

### 3.5 Spec conflict

`docs/design/Unified_Visual_Package_System.docx` defines palettes, photo system and typography roles only. It has no callout, tile or multi-column block, and no linear CV layout. Under the "document wins" rule this proposal needs a spec addendum before code. Raise as an issue.

## 4. Suggested order

1. Spec addendum (block primitives + linear layout) — docs only. OPEN.
2. `role.location` + role-line format (small, both renderers). **DONE 1.51.4566-role-location (2026-09-27).**
   - Store: `role.location` (4th role-line segment); format in `localStorage['antcv:roleLineFormat']` = `meta` | absent (own key, no React state, no `app.js` edit).
   - Preview: `antcv-roles-richblock-adapter.js` (adapt / itemsToRoles / writeBack / rolesPathFor / renderRoleHead); editor input in `antcv-rich-block-editor.js`; control `antcv-role-line-format.js` injected under PAGE FLOW.
   - Export: `antcv-docx-client.js` forwards `location` + `style.roleLineFormat`; worker `renderExperience` + `mergeStyle` enum guard.
   - Classic + no location is byte-identical to before (tests: `pwa/test/unit/role-location.test.mjs`, `workers/docx-worker/test/role-location.test.mjs`).
   - Not covered: the flag-off legacy chimera role line in `app.js` (rollback path only) and the translate collector (`app.src.js:19659`) — location is not sent for translation.
3. `cvLayout: 'linear'` in preview with plain sections (no new blocks) — proves the page-1 experience fit.
4. `callout`, `tiles`, `cols` in preview; section chips.
5. Worker parity + density preset + running header text.
6. Fix the five preview/export drift items.

Each step is a hotfix bundle with its own shift claim; steps 3–5 touch `app.js` and go through the diagnostic-first protocol.
