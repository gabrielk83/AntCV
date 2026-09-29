# Addendum to Unified_Visual_Package_System — Executive Linear CV layout

Status: **APPROVED by the owner 2026-09-29.** Step 1 of `EXECUTIVE_LINEAR_LAYOUT_PROPOSAL.md` §4.
Scope: adds one CV **layout** and five **block primitives**. It does not change palettes, the photo system or the typography roles of the locked spec — it adds rules where the spec is silent. Code ships behind `layout: 'linear'` (no client sends it by default).

Reference renders: `Application Generator Files/housestyle_pdf_generator` packages 1030–1037 (exec generator), owner-edited 2026-09-27 and 2026-09-29.

## 1. Layout

| Item | Rule |
|---|---|
| Name | `linear` (CV). The letter already uses `linear`. |
| Columns | One. No sidebar. Every section flows in document order. |
| Page | A4. Margins 1 cm sides, ~1.27 cm top/bottom. |
| Budget | CV exactly 2 pages; experience starts on page 1 and flows. No hard page breaks — content flows; a page break is only automatic. |
| Section order (default) | Profile → Core capabilities → Experience → Education → Tools → Details. User reorder still applies. |

## 2. Block primitives

| Primitive | Section option | Render |
|---|---|---|
| `callout` | `block: 'callout'` on a `rich_block` of `{b,t}` rows | Tinted box, left accent bar, hairline frame; rows are `Lead:` bold + text. Prose — keeps its full stops. |
| `tiles` | `block: 'tiles'`, `cols: 2\|3\|4` on `table` / `labeled_list` | Equal cells, bold title + one short sentence, left accent bar, light fill. Table cell rules apply. |
| `columns` | `cols: 2` on `education` / `list` | Items flow into N equal cells, no fill, no borders. Education may carry a full-width `certsRow` below both columns. |
| `details` | `block: 'details'` on `labeled_list` / `rich_block` | Two-column label \| content table; label cell tinted with left accent bar; hairline row rules. Interests may nest a 3-column strip inside the content cell. |
| `header box` | `headerBoxMode: 'light'` | Light fill, accent frame. CV: circular photo left with accent ring; name, `TITLE \| slogan • location`, contact line. Letter: no photo, centred. |

Running header on page 2+ (`Name - Title (section scope)`) and the AI-assisted watermark on page 2+ only.

## 3. Typography and text rules (owner, 2026-09-27 / 2026-09-29)

| Rule | Detail |
|---|---|
| Font floor | **Nothing below 9.5 pt** anywhere in the document (the owner's Word default). Tiles 10 pt. Compression may never shrink a run under 9.5 pt. |
| Dashes | Em dash `—` is not used: role line `Title - Company`, running header `Name - Title`, text. En dash `–` stays for ranges and names (`2026 – present`). |
| Table cells | Tiles, tool tiles and details rows end **without** a full stop. Prose blocks (callout, bullets) keep theirs. |
| Whole lines | A paragraph is one or two full lines, never 1.5 — extend with a concrete clause or cut; compress with character spacing ≤ −0.4 pt (cells ≤ −0.9 pt) before any font step; extend ≤ +0.2 pt; never Word "Distribute". |
| One-line elements | `TITLE \| slogan • location`, the letter's application line and short details rows never wrap: shorten, then condense. |
| Role line | `Title - Company` left, `years \| location` right-tabbed; company 10 pt; dates/location ≥ 9.5 pt. |

## 4. What this addendum does not change

Palettes, brand sampling, photo shapes, the two-column layout and every existing export path. `two_column` stays the default until the owner switches.
