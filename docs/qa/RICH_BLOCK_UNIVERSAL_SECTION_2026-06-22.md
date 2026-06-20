# RICH-BLOCK-001 — universal composite section `rich_block` (owner 2026-06-22)

Owner request: a reusable section object for the cover letter (and CV) like `foundation` but with
full controls — view/hide the **headline**, view/hide the **horizontal rule** under it, a
whole-section **CJLR**, then N **rows**; each row has a **lead-in** (the first words, e.g.
"Hands-on" — view/hide/edit) and a **body textarea** (view/hide) plus per-row **CJLR · Page ·
Enhance · Fit-it · Delete**, and a **"+ Row"** button. Built to MOVE Foundation (two such rows) and
to REPLACE Opening, Who I Am, Why This Position/Company, the CL Closure, and CV Profile / Work Style.

Owner decisions (this session): **additive + convert Foundation first**, then the other six one by
one; **full preview+export parity in one pass** per phase. Branch `feat/publications-main-rich`,
merged to `main` in one coherent piece.

## Data shape
```
{ id, title, loc, on, type:"rich_block",
  headlineOff?:bool,          // hide the section headline (title) + its rule
  ruleOff?:bool,              // hide ONLY the horizontal rule under the headline
  items:[ {b, t, bOff?, tOff?} ],   // b = bold lead-in, t = body; bOff/tOff hide each independently
  hidden?:[bool] }            // per-row hide (whole row)
```
Per-row alignment rides `antcvItemAlignment[sid]["items."+i]` (+ `.__group__` = section CJLR);
per-row page rides `antcv:itemPages[sid][i]` — the SAME stores foundation/bullets use, so preview
and the docx-worker honour them with no extra plumbing. `items[]` stays plain `{b,t}` objects.

## Status

### Phase A — the type (DONE & verified on branch, commit `797c6c2`)
- **Editor:** `pwa/antcv-rich-block-editor.js` (`window.AntcvRichBlockEditor`), rendered via a
  one-line delegation in app.js `case "rich_block"` (keeps the minified mirror tiny). Section bar
  (Headline/Rule/Section-CJLR) + rows (▲▼ · row-hide · lead-toggle+lead-input · body-toggle+body-
  textarea · Page · CJLR · Enhance · Fit · Delete) + "+ Row".
- **Preview:** app.src.js `case "rich_block"` — bold-lead paragraphs (N rows), honouring
  hidden/bOff/tOff/per-row align; the outer wrapper honours `headlineOff` (skip title+rule) and
  `ruleOff` (skip just the rule); empty-check + export-include treat it like `bullets`. Mirrored to
  minified app.js (shadow-safe; `node --check` + boot-smoke green).
- **Export client:** `antcv-docx-client.js` `case "rich_block"` — items[{b,t}] (bOff/tOff/hidden
  dropped), headlineOff/ruleOff, row_pages; item_alignment via alignFor.
- **Export worker:** `workers/docx-worker/src/index.js` — `renderRichBlock` (bold lead + inline
  body, per-row align, page breaks + CONT heading), dispatch case, `headingParagraph` gained a
  `noRule` arg (ruleOff), section heading gated on `headlineOff`, `rich_block` added to VALID_TYPES.
- Verified: `pwa/test/diag-rich-block.mjs` + `workers/docx-worker/test/diag-rich-block-export.mjs`.

### Phase B — migrate Foundation (DONE & verified on branch, commit `5d75e13`)
- `pwa/antcv-foundation-to-rich-block-758.js` converts `foundation` → `rich_block` (two rows:
  Hands-on / Professionally), CV + CL, idempotent + self-converging, carries per-part align/page.
- Verified: `pwa/test/diag-foundation-to-rich-block.mjs`.

### Phase C — REPLACE the other six (OPEN)
Convert Opening · Who I Am · Why This Company · CL Closure · CV Profile · CV Work Style to
`rich_block`. These are mostly `type:"text"` / `type:"text_inline"` (single `content`) → one row
`{b:"", t:content}` (no lead-in). Nuances to settle PER section:
- Headless ones (opening/closure/work_style are in the preview no-title list + greeting) → set
  `headlineOff:true` on conversion so they keep their current title-less look.
- `work_style` is `text_inline` (title rendered as a bold inline prefix) → decide whether to keep
  the label as a row lead-in (`b:title`) instead of a headline.
- These types are GENERATION-COUPLED (the generator emits text/text_inline/foundation), so a
  migration re-upgrades them each regen — same accepted pattern as Phase B. Phase C also wants the
  generation prompt to emit `rich_block` directly (later) so the round-trip is clean.
- Each conversion verified headlessly (convert + preview + export) like Phase B. RECOMMEND the owner
  eyeballs a live rich_block first — Phase C changes how core CV/CL sections behave.

## Discipline
Edit app.src.js, mirror to minified app.js (section render fn: section `t`, accent `h`, pkg `_`,
font `P`, sizes `M`, textColor `$`, lineHeight `B`, editable `U`, placeholder `W`, isCL `o`, breaks
`a`, color `L`, spacing `p`; editor fn `lt`: section `t`, update `c`, accent `h`, onEnrich `a`,
onCompress `o`, enrichingId `i`, compressingId `r`). Worker has NO build step — edit src/index.js.
Cache-bust quartet + manual worker deploy at MERGE time only.
