# DAMC typography and writing style guide

| Field | Value |
|---|---|
| Document ID | DAMC-STY-001 |
| Version | 0.2 (draft). 0.2: zero orphans in every document class (owner decision 2026-11-05). |
| Date | 2026-11-05 |
| Status | Draft for review |
| Belongs to | DAMC-IG-001 v0.6 (rule DOC-06) |
| Origin | Adapted from the owner's "Typography and Writing Style Guide" (rules for CVs and cover letters, 2026-11-05). CV-only rules dropped; see Appendix B. |
| Owner (role) | QA lead |

Rules for DAMC's own outputs: reports, summaries, finding records, requests, slides and system documents. They must read cleanly in print, on screen and as PDF. The numbers are defaults measured for A4. Keep them unless a layout forces a change, and recalibrate the character budgets for any new layout by measuring (Section 2).

**The rules are global.** They apply on every platform that produces or exports a DAMC output: Word, PowerPoint, Canva, Google Docs and Slides, spreadsheets printed as reports, HTML/CSS to PDF, and any other PDF producer. Each rule is an outcome checked on the exported file. Platform settings are only the means; Appendix D maps each rule to the settings on each platform.

---

## 0. Document classes

| Class | Documents | Rules that apply |
|---|---|---|
| 1 Short output | Monthly summary, run report cover page, finding cards, request letters to Legal and IT, staff notices, slide decks and one-page visuals (PowerPoint, Canva, Google Slides) | All sections. Zero orphans. Fixed page or slide counts. |
| 2 Long reference | Implementation guidelines, the requests file as a whole, evidence packs, SOPs, system card | Sections 1, 2, 3 (Class 2 sizes), 4, 6, 7, 8 and 10. Zero orphans, as in Class 1 (owner decision 2026-11-05). No character budgets. |
| 3 Reviewed documents | Human-written project and hardware documents | Not enforced. Wording problems are reported through Guidelines 8.7–8.8. Typography findings only where a project opts in, at severity S4. |

---

## 1. Core principles

1. **Measure the final output.** A preview, editor or HTML render breaks lines differently from the exported PDF (column widths, font metrics, renderer). Run every check on the exported file. (Guidelines P6.)
2. **Fix layout before wording, and wording before content.** Never add a claim to fill space (FACT-22).
3. **Adjust locally.** Change one paragraph at a time. Never condense a whole document to save one line.
4. **Never let a fix add a line or a page.**
5. **Never deliver a file that fails a check.** Each new delivery gets a new version number. A delivered file is never overwritten; a correction is a new version (SEC-30, SEC-31).
6. **Rules are global; settings are local.** The same outcome is required on every platform (Appendix D). A platform that cannot reach an outcome through its settings reaches it through wording (fix order step 5), never by relaxing the rule.
7. **Same fonts everywhere.** A substituted font is a new layout: re-measure. Embed fonts in every exported file. Export at 100 % scale: "fit to page", "shrink text on overflow" and other autofit features change point sizes and break the size floors.

---

## 2. Orphans (short last lines)

### Definition

An **orphan** is a paragraph of two or more lines whose last line either:
- fills **less than 60 %** of the full line width, or
- holds a **single word**.

The rule covers body text, bullets, both columns of every table, finding cards and letter paragraphs. Tables need the most care, because narrow columns produce orphans most often.

**Excluded:**
- display type set on two lines by design, with a manual line break. An automatic wrap is never "by design";
- deliberate line breaks (addresses, signature and approval blocks);
- table cells that hold only codes or IDs.

### Global rule (every class, blocking)

Owner review 2026-11-05 found the title of the v0.3 and v0.4 guidelines PDFs wrapped to a one-word last line ("Control"). Three causes: the renderer's default line breaking fills each line greedily and leaves the remainder; the build checked only width overflow, so it could not see the defect; and v0.1 of this guide excused two-line display type and made long-document orphans advisory. The fix is global:

- **Zero orphans in every class** (owner decision 2026-11-05): the last line of every multi-line block fills at least 60 % and holds at least two words. This covers headings, paragraphs, list items and table cells.
- **No single-word last line** in any paragraph, list item, table cell or heading, in any class.
- **No heading orphan:** a wrapped heading's last line fills at least 60 %.
- **Renderer settings in the template, not per document:**
  - headings use balanced line breaking (CSS `text-wrap: balance`);
  - paragraphs, list items and table cells use orphan-avoiding line breaking (CSS `text-wrap: pretty`);
  - table cells and paragraphs of up to four lines may use balanced line breaking when the result passes. A balanced block is measured against the full column width, not against its own other lines, so balancing cannot pass a block by shortening every line;
  - in a word processor, use its equivalent setting, or a non-breaking space between the last two words (fix order step 3).
- **Tokens that never break:** requirement and document IDs (GDPR-01, DAMC-IG-001), ISO dates and legal references (Art. 5(1)(c), § 12) stay on one line. A split such as "GDPR-" / "01" is a defect even where the orphan rule does not apply.
- **Short table labels** (up to three words, for example "Document ID") stay on one line wherever the table width allows.
- **Automatic levers, in order:** table column widths tuned per table; pull back (letter spacing down to −0.5 pt, kept only if the block loses a line); fill (up to +0.2 pt, kept only if the line count stays); balanced breaking for short blocks. Fixes aim for ≥ 65 %.
- A hit that remains after the renderer settings and levers is fixed through the fix order below (in practice: reworded in the source), then re-measured. In print, line breaks can differ slightly from the on-screen layout, so the final measurement is always taken on the exported PDF.
- **The check must be able to fail.** Its tests keep a known orphan as a negative control (Guidelines P6, QA-03).

### Targets

- Pass: last line ≥ 60 % and at least two words.
- Aim for **≥ 65 %** after a fix, to leave headroom; 70–95 % is ideal.
- A completely full last line is fine.

### Fix order

Try each step in turn and stop at the first that works.

1. **Pull back.** Condense the paragraph (Section 3) only if it then loses its last line. If no line is saved, revert to the original formatting.
2. **Fill.** Widen the characters slightly (≤ 104 % width, ≤ +0.2 pt spacing). Accept the result only if the line count stays the same and the last line reaches 60 %.
3. **Bind.** For a single-word last line, join the last two words with a non-breaking space. Accept it only if no line is added.
4. **Reorder.** In lists where order carries no meaning (comma-separated tools, document lists), reorder the items so long and short ones pack the lines. Never change the items themselves.
5. **Reword.** Either:
   - shorten until the paragraph loses a line, or
   - lengthen with facts already stated in the cited sources. Never add a new number or a new claim (FACT-22).

   Measure every candidate wording in the real layout before choosing one.

### How to measure

For each paragraph in the source document:
1. Find its lines in the exported PDF. Match on letters and digits only, so bullet glyphs, spacing and substituted punctuation don't break the match.
2. Merge pieces that sit on the same baseline. Justified text often exports as separate fragments.
3. Compute:
   `fill = (last_line.right − last_line.left) / (max(right edge of the other lines) − last_line.left)`
4. Count the words on the last line.
5. Fix hint:
   - characters to add ≈ `(0.75 − fill) × characters per line`
   - characters to cut ≈ `characters on the last line + 2`

A check like this runs in under a second per document. Run it after every build. Any orphan blocks release, in every class.

Measuring in the exporting engine's own layout (same engine, exact text width, same fonts) is accepted only when its line breaks are confirmed against the text lines of the exported PDF. Record the match rate.

---

## 3. Text sizing

### Class 1 defaults (A4, single column)

| Element | Size and style |
|---|---|
| Title | 16 pt bold sans-serif, line height about 105 % |
| Document line (ID, version, status, classification) | 10 pt bold, accent colour |
| Section headings | 12 pt bold, accent rule underneath |
| Body text | 10.5 pt |
| Table text | 9.5 pt; header row bold, accent colour |
| Key figure (e.g. open S1 findings) | 15 pt bold, accent colour |
| Caption under a key figure | 8.5 pt, dark grey |
| Footer | 7.5–8 pt grey: ID · version · status · classification · AI disclosure · page x / y |

### Class 2 defaults

| Element | Size and style |
|---|---|
| Title | 18 pt bold |
| Level-2 headings | 13 pt bold, rule underneath |
| Level-3 headings | 11 pt bold |
| Body text | 9.5–10.5 pt |
| Table text | ≥ 8.5 pt; header row bold |
| Code and diagrams | ≥ 8 pt monospace |
| Footer | 7.5 pt grey, same fields as Class 1 |

### Class 1 defaults for slides (16:9, projected or on screen)

Starting values `[calibrate]` on the company template; measure on the exported PDF.

| Element | Size and style |
|---|---|
| Slide title | 28–36 pt bold, balanced if it wraps |
| Body text | ≥ 18 pt |
| Table text | ≥ 14 pt |
| Footer (ID · version · AI disclosure · slide x / y) | 9–10 pt grey |
| Contrast | ≥ 4.5:1 for all text |

### Limits

Apply these per paragraph, never globally.

| Control | Limit |
|---|---|
| Point size | Never below 9.5 pt for body text in either class. Table text: Class 1 ≥ 9.5 pt, Class 2 ≥ 8.5 pt. Never shrink point size to make text fit; condense the width instead. |
| Character width, body text | ≥ 96 % |
| Character width, table cells | ≥ 94 % |
| Character width, single-line rows (document line, status, classification) | ≥ 86 %; if the row needs less than 90 %, choose a shorter wording instead |
| Letter spacing, condensed | ≥ −0.5 pt; ≥ −0.4 pt for prose in highlighted callouts |
| Character width, widened | ≤ 104 % |
| Letter spacing, widened | ≤ +0.2 pt |
| Steps | Width in 2 % steps; spacing in 0.1 pt steps |

Width and spacing controls exist on some platforms only (Appendix D). Where a platform lacks them, go to wording (fix order step 5). Platforms that set letter spacing in em units: value in em = spacing in pt ÷ font size in pt (e.g. −0.5 pt at 10.5 pt ≈ −0.048 em; in thousandths of an em, about −48).

### Line-fill rule (Class 1, multi-line paragraphs)

- Last line ≤ 55 % (or an orphan): try to condense until the line is saved. If no line is saved, revert and fall through to filling.
- Last line between 55 % and 85 %: add letter spacing in +0.1 pt steps, up to +0.2 pt, as long as no line is added.
- Never use "distributed" alignment. It spreads the letters of the last line apart and reads as broken.

---

## 4. Alignment and justification

- Justify multi-line prose in narrow columns: the evidence column of a finding table and the summary paragraphs of a Class 1 output.
- Left-align short labels, IDs and codes. A justified two-line label spreads its few words across the line.
- Right-align numbers in numeric columns, with the same number of decimals per column. Locale formats follow Guidelines 10.3 and 11.1 (decimal comma in Nordic outputs).
- If a non-final line would naturally fill less than 85 % of the column, justifying opens wide gaps (rivers): left-align instead.
- The last line of a justified paragraph stays left-aligned.
- Class 2 prose is left-aligned.

---

## 5. Line-length budgets (Class 1)

Starting values for A4, single column, 10.5 pt, 2 cm margins: about 95 characters per line (the letter measure in the original guide). The ratios come from the original guide's measured CV budgets. Measure and recalibrate before relying on them.

| Item | Budget |
|---|---|
| Finding title | One line, ≤ 90 characters |
| Finding summary | At most two lines |
| Bullet | One line (≤ 88 characters) **or** two full lines (159–183 characters). Avoid 96–152 characters, the orphan zone. |
| Table, ID column | ≤ 12 characters, one line |
| Table, evidence column | One or two full lines |
| Single-line rows | Fit at 100 % width where possible |
| Request letter paragraph | 3–5 lines |
| Monthly summary | Exactly one page |

---

## 6. Page flow

- Keep every heading with the paragraph after it.
- Never split a finding card, a key-figure block, a diagram or a table row across pages.
- Repeat the table header row on every page. Keep it with the first data rows, and keep a group header with its first row.
- Keep the approval block together (reviewer role, date, signature), and the sign-off of a letter.
- To push a block to the next page, put a spacer of exact line height before its heading and grow it until the heading moves.
- Page counts (Class 1): monthly summary exactly 1 page; run report cover 1 page; request letter 1–2 pages. Page 2 starts with a heading or a whole entry, never a fragment.
- Class 2: headings kept with the next paragraph; rows, cards and diagrams not split; page counts free.
- Slides: headings stay with their content; cards and tables never run onto the next slide; the brief fixes the slide count.

---

## 7. Report layout

- **Page:** single column, A4, margins 14–20 mm.
- **Accent colour:** the company brand colour, deepened if needed so text meets a contrast of at least 4.5:1 against white in print. The ink colour is a dark neutral.
- **Colour never carries meaning alone.** Severity and verification labels are always printed as words (S1, CONTRADICTED); colour only repeats them.
- **Header block on page 1:** title, then the document line (ID, version, status, classification).
- **Footer on every page:** ID · version · status · classification · "Prepared with AI assistance" · page x / y (Guidelines DOC-01).
- **People:** no photos of people and no person names; roles only (NG-1).
- **Nothing is clipped.** Tables, code blocks and diagrams fit the text width. A line cut off at the margin is a blocking defect.
- **Monthly summary order:**
  1. sentence-case headline stating the main change
  2. key figures: open S1/S2, open conflicts, unverified count, mirror freshness
  3. top findings with evidence
  4. changes this month: rules, tools (tool watch), mirrors
  5. incidents
  6. regulatory watch
  7. approval block
- **Run report order:** scope; sources and versions (files, mirrors, rules, models); findings by severity; verification labels; UNVERIFIED appendix; approval block.
- **Finding card:** ID and severity line; one-line title; two-line summary; evidence table (span, value, document, version); advisory action; reviewer decision.

---

## 8. Writing style

- **Voice:** direct and factual. Short sentences, no filler.
- **Words to avoid:** the single list lives in Guidelines 8.7 and config M2 (one source, DOC-04). It includes the original guide's examples: leverage, synergy, passionate, dynamic, results-driven, go-getter, spearheaded, best-in-class, cutting-edge, world-class, detail-oriented, team player, "think outside the box".
- **Lead with the reader:** state the decision or need first, then the finding.
- **Findings state a difference or a change:** value A vs value B, from → to, a count or a percentage.
- **Numbers and acronyms:**
  - copy them verbatim; never round, never invent;
  - a claim keeps the same strength everywhere it appears (FACT-06, FACT-18).
- **Facts:** state what the source says, with its span. Lengthen text only with facts that are already stated.
- **Gaps:** write NOT_FOUND or UNVERIFIED; never fill (Guidelines P4).
- **People:** roles, never names or contact details (NG-1, GDPR-03).
- **Headlines:** sentence case.
- **Dates:** complete; ISO 8601 in registers and tables. Label overlapping periods so the dates don't read as an error.
- **Language:** output follows the language of the source document (LANG-05); requests use the company's working language. Locale formats follow Guidelines 10–11.

---

## 9. Requests and letters

- **A request, not a copy of the guidelines.** Point to requirement IDs and attach the guidelines PDF.
- **Length:** one to two pages per request.
- **Structure:**
  1. Subject line naming the tool and the ask.
  2. Shared context block.
  3. Numbered asks, one per item, each with a "done when".
  4. What we need back.
  5. Timing.
  6. Attachments.
  7. Sign-off with role.
- Every IT request says "implement only if not already in place".
- No promotional tone. No urgency words without a date.

---

## 10. Checklist before delivery

- [ ] Checked on the exported PDF, not the preview
- [ ] Zero orphans in every class: every last line ≥ 60 % and at least two words, headings and tables included
- [ ] Single-line rows sit on one line
- [ ] Nothing clipped: no table, code block or diagram wider than the text width
- [ ] Headings kept with the next paragraph; no split rows, cards or diagrams
- [ ] Page count correct (Class 1)
- [ ] Point sizes and condensing within the Section 3 limits
- [ ] Footer on every page with ID, version, status, AI disclosure and page x / y
- [ ] No invented facts; numbers and acronyms verbatim; roles, not names
- [ ] New version number; the delivered file left untouched
- [ ] Exported at 100 % scale; fonts embedded; no autofit or shrink-to-fit anywhere
- [ ] Same result on every platform used for this output (Appendix D); a platform switch or font change means re-measuring

---

## Appendix A: parameters (machine-readable)

```yaml
classes:
  short_output: [monthly_summary, run_report_cover, finding_card, request_letter, staff_notice]
  long_reference: [guidelines, requests_file, evidence_pack, sop, system_card]
  reviewed_documents: {enforced: false, opt_in_severity: S4}

orphan:
  applies_to: {short_output: blocking, long_reference: blocking}   # owner decision 2026-11-05
  last_line_min_fill: 0.60        # below this = orphan
  min_words_last_line: 2          # one word = orphan
  target_fill_after_fix: 0.65     # headroom
  ideal_fill: [0.70, 0.95]
  exclude: [display_type_with_manual_break, hard_line_breaks, id_or_code_cells]
  renderer: {headings: balance, text: pretty, short_blocks: balance_if_passes}   # CSS text-wrap
  balanced_blocks_measured_against: column_width
  levers: [table_column_widths, condense_pull_back, widen_fill, balance_short_blocks, reword]
  pdf_line_match_required: true   # in-engine measurement must be confirmed against PDF text lines
  negative_control_required: true
  fix_order: [condense_pull_back, widen_fill, nbsp_bind_last_two_words, reorder_free_lists, reword]
  reword_lengthen_only_with_existing_facts: true

condense:
  per_paragraph_only: true
  width_min_pct: {body: 96, table_cell: 94, single_line_row: 86}
  prefer_rewording_below_width_pct: 90
  letter_spacing_min_pt: {body: -0.5, callout_prose: -0.4}
  width_step_pct: 2
  spacing_step_pt: 0.1
  revert_if_no_line_saved: true

widen:
  width_max_pct: 104
  letter_spacing_max_pt: 0.2
  accept_only_if_line_count_unchanged: true

line_fill:
  condense_if_last_line_at_or_below: 0.55
  extend_if_last_line_below: 0.85
  distributed_alignment: never

font_pt:
  short_output:
    title: 16
    document_line: 10
    section_heading: 12
    body: 10.5
    table: 9.5
    key_figure: 15
    key_figure_caption: 8.5
    footer: [7.5, 8]
  long_reference:
    title: 18
    h2: 13
    h3: 11
    body: [9.5, 10.5]
    table_min: 8.5
    code_min: 8
    footer: 7.5
  slides: {title: [28, 36], body_min: 18, table_min: 14, footer: [9, 10]}   # calibrate on template
  body_floor: 9.5
  shrink_point_size_to_fit: false

platforms:                         # rules are global; Appendix D maps them to settings
  covered: [word, powerpoint, canva, google_docs, google_slides,
            spreadsheet_print, html_css_pdf, other_pdf]
  measure_on: exported_pdf
  unreachable_by_settings: reword  # never relax the rule
  letter_spacing_em: "pt / font_size_pt"

export:
  scale_pct: 100
  fonts: embedded
  autofit: never                   # shrink on overflow, fit to page, cell fit text
  font_substitution_requires_remeasure: true

justification:
  justify: [finding_evidence_column, short_output_summary_prose]
  left_align: [labels, ids_codes, long_reference_prose, paragraphs_with_natural_midline_below_0.85]
  right_align: [numeric_columns]

# short output, A4 single column, 10.5 pt, 2 cm margins; measure and recalibrate
budgets_chars:
  chars_per_line: 95
  bullet_one_line_max: 88
  bullet_two_lines: [159, 183]
  bullet_avoid: [96, 152]
  finding_title_max: 90
  finding_summary_max_lines: 2
  table_id_max: 12
  letter_paragraph_lines: [3, 5]

page_flow:
  keep_heading_with_next: true
  never_split: [finding_card, key_figure_block, diagram, table_row]
  repeat_table_header: true
  keep_approval_block_together: true
  pages: {monthly_summary: 1, run_report_cover: 1, request_letter: [1, 2]}

layout:
  page: A4
  columns: 1
  margins_mm: [14, 20]
  accent_text_contrast_min: 4.5
  colour_alone_carries_meaning: false
  footer_fields: [id, version, status, classification, ai_disclosure, page_x_of_y]
  person_names: never

delivery:
  check_exported_pdf: true
  zero_orphans_required: true
  never_overwrite_delivered_version: true
```

---

## Appendix B: changes from the original guide

| Original section | In this guide |
|---|---|
| 1 Core principles | Kept. Principle 5 linked to the generated-file rules. |
| 2 Orphans | Kept. Blocking in every class (owner decision 2026-11-05). Global rule for every class (no single-word last line, no heading orphan) with renderer settings and a negative control. Display-type exclusion narrowed to manual breaks. ID and code cells excluded. |
| 3 Condensing and sizing | Limits kept. Sizes reset for single-column reports (Class 1) and long references (Class 2). |
| 4 Alignment | Kept. Numeric columns added. |
| 5 Line budgets | Recalibrated starting values for a single column, derived from the original ratios; to be measured. |
| 6 Page flow | Kept. CV items replaced by finding cards, approval blocks and report page counts. |
| 7 Two-column CV layout | Dropped (photo, panel and main-column order); replaced by Section 7. Accent-colour contrast rule kept. |
| 8 Writing style | Core kept. CV-only items dropped (work conditions, references, CV gaps). People-as-roles and NOT_FOUND added. |
| 9 Cover letters | Replaced by Section 9 Requests and letters. |
| 10 Checklist | Kept, adapted. |
| Appendix parameters | Kept, adapted. |
| — | Appendix C added: locale typography, extended through the scope expansion step. |
| — | Rules made platform-neutral (principles 6–7, slide sizes, Appendix D) on owner instruction 2026-11-05. |

---

## Appendix C: locale typography (extended by the scope expansion step)

Each country or language added to DAMC's scope adds or confirms its rows here through the scope expansion step (Guidelines 11.4, dimension "Typography"). Starting values; the language reviewer confirms each row.

| Script or language | Orphan rule | Other rules |
|---|---|---|
| Latin, Greek, Cyrillic scripts (en, da, sv, nb, nn, fi, de, es, pt, …) | As written: last line ≥ 60 % and at least two words | Locale number and date formats (Guidelines 10.3, 11.1) |
| Chinese, Japanese (no spaces between words) | "Single word" becomes "fewer than 4 characters" on the last line `[calibrate]`; the 60 % fill rule is unchanged | Line-breaking prohibitions (no closing punctuation at a line start, no opening bracket at a line end); full-width punctuation |
| Korean (spaces between word units) | As written, counting space-separated units | — |
| Scripts without word spaces (e.g. Thai) | As for Chinese and Japanese | Dictionary-based line breaking |
| Right-to-left scripts (Arabic, Hebrew) | As written; fill measured from the right edge | Mirrored alignment; digit style decided per company (AntCV used Western digits) |

Quotation marks (confirm with the language reviewer):

| Language | Marks |
|---|---|
| en | “ ” |
| da | » « or „ “ |
| sv | ” ” |
| nb | « » |
| fi | ” ” |
| de | „ “ |
| fr | « » |
| ja | 「 」 |
| zh-Hans | “ ” |
| zh-Hant | 「 」 |

Fonts must cover every character of the script. A missing glyph (shown as an empty box) is a blocking defect.

---

## Appendix D: platform mapping (rules are global)

The outcome is the rule; the setting is only the means. Menu paths change between versions, so confirm each path on the company's installed version `[C]`. Where a cell says "reword", the platform has no setting for that outcome: use fix order step 5.

Word, PowerPoint and Canva:

| Rule (outcome) | Word | PowerPoint | Canva |
|---|---|---|---|
| No single-word last line | Non-breaking space between the last two words; reword | Non-breaking space; reword | Non-breaking space or manual break; reword |
| Balanced headings | Manual line break at the balance point; reword | Manual line break; reword | Manual line break; reword |
| Tokens that never break (IDs, dates, references) | Non-breaking hyphen (Ctrl+Shift+Hyphen) and non-breaking space | Non-breaking hyphen (U+2011) or space, if the font has the glyph | Same as PowerPoint `[C]` |
| Character width (≥ 96 %, ≤ 104 %) | Font › Advanced › Scale | Not available: spacing or reword | Not available: spacing or reword |
| Letter spacing (−0.5 to +0.2 pt) | Font › Advanced › Spacing, in pt | Font › Character Spacing, in pt | Letter spacing, in thousandths of an em `[C]` (convert from pt) |
| Keep heading with next | Paragraph › Line and Page Breaks › Keep with next | Heading and content on one slide | Heading and content on one page |
| Never split rows, cards, blocks | Row option "Allow row to break across pages" off; Keep lines together | One card per slide region | One card per page |
| Repeat table header | Table Layout › Repeat Header Rows | Repeat the header on each slide by hand | Repeat by hand |
| No autofit, no shrinking | Cell option "Fit text" off; print at 100 %, no "scale to paper size" | Text box: Do not Autofit; print without "scale to fit paper" | Set sizes explicitly; no automatic text resizing `[C]` |
| Fonts embedded | Save option: embed fonts in the file; PDF export embeds | Save option: embed fonts | Licensed fonts only; PDF download embeds |
| Export for measuring | Save as PDF, with document structure tags for accessibility | Export to PDF | Download as PDF (print quality) |

Google Docs and Slides, and HTML/CSS to PDF:

| Rule (outcome) | Google Docs and Slides | HTML/CSS → PDF |
|---|---|---|
| No single-word last line | Non-breaking space; reword | `text-wrap: pretty`; non-breaking space |
| Balanced headings | Manual line break | `text-wrap: balance` |
| Tokens that never break (IDs, dates, references) | Same as PowerPoint | `white-space: nowrap` on the token |
| Character width (≥ 96 %, ≤ 104 %) | Not available: reword | `font-stretch` (font must have width variants) |
| Letter spacing (−0.5 to +0.2 pt) | Docs: not available, reword `[C]`; Slides: reword | `letter-spacing`, in pt or em |
| Keep heading with next | Docs: Keep with next `[C]` | `break-after: avoid` |
| Never split rows, cards, blocks | Docs: row and paragraph break options `[C]` | `break-inside: avoid` |
| Repeat table header | Docs: pin header row `[C]` | `<thead>` repeats in print |
| No autofit, no shrinking | Slides: Text fitting › Do not autofit | No `transform: scale`; print scale 100 % |
| Fonts embedded | Fonts embedded on PDF download | Licensed `@font-face` fonts; embedded on print |
| Export for measuring | Download as PDF | Print to PDF at 100 % scale |

**Spreadsheets printed as reports** (Excel, Google Sheets): print at 100 % (no "fit to page" below 100 %); set column widths so cell text wraps on word boundaries; turn on repeating header rows; apply the same orphan and size rules to wrapped cells.

**Any other platform:** before first use, record how it reaches each outcome in this table, through the scope expansion step's "Typography" dimension where the platform comes with a new scope.
