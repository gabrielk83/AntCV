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
  items:[ {b, t, bOff?, tOff?, mk?} ],  // b=bold lead-in, t=body; bOff/tOff hide each; mk=bullet marker
  hidden?:[bool] }            // per-row hide (whole row)
```
`mk:true` renders the row as a bulleted list item (preview = `BM(i)` marker + bullet indent; export =
`bulletParagraphRich` numbering). Default (no `mk`) = a paragraph. This lets one rich_block mix
paragraphs and bullets (used by HWIC: intro/closure paragraphs + bullet rows).
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

### Phase C — REPLACE the named sections (FIVE DONE & verified; closure DEFERRED)
`pwa/antcv-text-sections-to-rich-block-759.js` converts **opening · who · why · profile · work_style**
to `rich_block` (one row `{b:lead, t:content}`). Headline handling (owner correction 2026-06-22):
- **opening** → `headlineOff:true`, no lead-in (it's the first paragraph).
- **who / why / work_style** → `headlineOff:true` with the LABEL as the row's bold lead-in:
  `b:"Who I am"`, `b:"Work style"`, and `why` is DYNAMIC — `b:"Why this position"` when a JD is loaded
  (`antcv:lastJdText` ≥ 30) else `b:"Why this company"`. The why lead is re-synced on each pass while
  it is still one of those two canonical values, so it flips with the JD but never clobbers a manual
  edit (WHY_CANON guard).
- **profile** → keeps its real PROFILE section headline (`headlineOff:false`).
`title` is preserved on every converted section (the heading-flip sidecar still mutates `why.title`,
now hidden). Idempotent + self-converging; the generator re-emits text → re-upgraded each regen.
Verified: `pwa/test/diag-text-sections-to-rich-block.mjs` (CV + CL, bold lead-ins render, zero errors).

**`closure` DEFERRED (intentionally excluded):** the CL `closure` is NOT a generic body section —
it is rendered as the **sign-off paragraph** by a special path that reads `closure.content` directly
(preview app.src.js:43176; export src/index.js:26378 + 27608), outside the section loop, and it
already has its own inline editor (`antcv-cl-closure-editable-341.js`, which also writes
`items[0]=string`). Converting it to `rich_block` blanks the sign-off. To include closure later:
teach those 3–4 closure-content readers to read `items[0].t` when `type==="rich_block"` (and stop
the closure-editable sidecar from coercing `items[0]` to a string), OR keep closure as-is.

### HWIC — DONE & verified on branch
Per-row **marker toggle** added to rich_block (`mk` field) across all four layers (editor button •/◦,
preview `BM(i)`, docx-client passthrough, worker `bulletParagraphRich`). `antcv-hwic-to-rich-block-760.js`
converts the CL `contribute` (text_bullets) → rich_block: intro/closing as plain rows, each bullet as
a marker row (`mk:true`), the HOW I WOULD CONTRIBUTE headline kept. Verified:
`pwa/test/diag-hwic-to-rich-block.mjs` (conversion shape + preview) and the worker export test (marker
rows export with `<w:numPr>` numbering; plain rows do not).

Remaining branch work: Publications Phase 3 (controls on the richPub 5-field editor); later, make the
generation prompt emit `rich_block` directly so the migrations become no-ops; closure dedicated handling.

## Discipline
Edit app.src.js, mirror to minified app.js (section render fn: section `t`, accent `h`, pkg `_`,
font `P`, sizes `M`, textColor `$`, lineHeight `B`, editable `U`, placeholder `W`, isCL `o`, breaks
`a`, color `L`, spacing `p`; editor fn `lt`: section `t`, update `c`, accent `h`, onEnrich `a`,
onCompress `o`, enrichingId `i`, compressingId `r`). Worker has NO build step — edit src/index.js.
Cache-bust quartet + manual worker deploy at MERGE time only.
