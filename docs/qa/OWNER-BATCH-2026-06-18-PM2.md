# Owner batch — 2026-06-18 (PM, after 1.50.642)

Owner-reported, high-level-generation + structure bugs. Root causes verified in
code where marked VERIFIED; others carry a best-evidenced hypothesis with
file:line anchors. NONE coded yet — owner asked to document + reset to a new
session. One deployer at a time; surgical `app.js` edits mirrored to `app.src.js`,
`node --check` both, boot-smoke after any `app.js` change.

NOTE on the "you broke the specialization line" claim: bundles 1.50.640-642 did
NOT touch subtitle render or generation. 640 = `color-scheme:light` CSS, 641 =
education editor GPA input, 642 = a prompt `r.push` inserted AFTER the subtitle
rule (line ~2734) — subtitle path untouched. SPEC-LINE-GONE-001 is logged as a
regression to investigate from live data, not assumed mine.

---

## 1. SPEC-LINE-GONE-001 — specialization/subtitle line missing
Owner: for an UNSOLICITED draft the specialization line must read
**"Processes • Products • People"**; right now it is gone.

- Render: `meta.subtitle` → `t.subtitle` (app.src.js ~11133 / ~11219), key
  `"specialisation"`, `loc` topbar/main/sidebar (~11129, ~11223).
- Prompt SPEC-CATCHY-001 (app.src.js ~2712-2740): for UNSOLICITED with a stored
  `personalInfo.specialization`, `meta.subtitle` MUST equal that standing line
  verbatim; if none stored, DERIVE one (max three concepts, `" • "` separated).
- **Hypothesis:** stored `personalInfo.specialization` is empty/blank, so an
  unsolicited generation derived an empty subtitle (or emitted none) and the
  render shows nothing. Owner's standing unsolicited line is fixed:
  `Processes • Products • People`.
- **Fix direction:** (a) store `personalInfo.specialization = "Processes • Products • People"`
  so the prompt pins it verbatim for unsolicited; (b) confirm whether live
  `sections` meta.subtitle is empty (generation gap) vs a render gate hiding a
  present value; (c) regen. Verify the loc default and the subtitle render gate
  before assuming generation.

## 2. TABLES-SAME-FOCUS-001 — CORE COMPETENCIES vs WHAT I BRING share focus areas
Owner: the two tables must NOT have the same Focus Area entries (high-level
generation role).

- Both are `table` sections (`["Focus Area","Strategic Expertise"]`). Generation
  fills both; nothing currently forbids overlap.
- **Fix direction (prompt):** add a DISTINCTNESS constraint — WHAT I BRING =
  the JD-fit, role-specific strategic expertise (4 rows max); CORE COMPETENCIES =
  the broader standing competency areas; the two tables' Focus Area columns must
  be DISJOINT (no repeated focus area across the two). Find the WHAT I BRING /
  CORE COMPETENCIES table rules in the prompt (grep "WHAT I BRING" / "CORE
  COMPETENCIES" / "Focus Area" in app.src.js) and add the no-overlap rule.

## 3. TOOLS-METHODS-FIXIT-LOOP-001 — Fix-It endless loop + mangling  [VERIFIED]
Owner: a "Fit-It" (Fix-It / compress) on Tools & Methods got stuck in an endless
processing loop and compressed headlines/content "in a funny way." Understand the
structure first (DONE), then fix.

- **Structure:** Tools & Methods is a `labeled_list` — items `{l,v}` (bold label
  + value) with optional `{group}` subheading rows. Group rows are filtered out
  before the compress LLM call and re-skipped on apply.
- **VERIFIED root cause** — the per-item compress applier `Pe()` references an
  UNDEFINED `items` instead of the local copy `n`, so it returns the UNCHANGED
  section:
  - `labeled_list_item` (app.src.js **9850-9858**):
    ```
    const n = [...(e.items || [])];
    return ( n[l] && !items[l].group && (items[l] = {...items[l], v: t.v || items[l].v || ""}),
             { ...e, items: n } );   // n never written → no-op
    ```
    Fix → `!n[l].group && (n[l] = { ...n[l], v: t.v || n[l].v || "" })`.
  - `education_item` (app.src.js **9863-9868**): same `items` bug + a throwaway
    spread index. Fix → `const n=[...(e.items||[])]; n[l] && (n[l]={...n[l], sch: t.sch||n[l].sch||""}); return {...e, items:n};`
- Because compress is a no-op, the iterate-compress orphan-retry pass (~19202-
  19241, ~7-cap) keeps seeing the un-compressed row and retries → the endless
  spinner. Confirm the "compressing" flag clears on a no-op result too.
- The whole-section `labeled_list` applier (**9902-9910**) is CORRECT (skips
  group rows, pulls sequential from the group-less LLM result) — do NOT change it.
- **Mangling:** follows from the no-op + retry; verify after the `Pe()` fix that
  labels (`l`) stay frozen and only `v` is tightened. Mirror to app.js, node
  --check, boot-smoke, and re-test a real Fix-It on a grouped tools section.

## 4. PROFILE-REWRITE-001 — replace the unsolicited PROFILE text
Owner rejects the current generated unsolicited profile as "ridiculous." Canonical
replacement (owner-provided, verbatim — note: it has NO em dashes, keep it that way):

> Product and project professional with 15+ years in automotive, defence, and
> deep-tech, building hardware-software products from requirements and change
> control to validation and supplier coordination. Work spans LiDAR, smartphone
> optics, defence electro-optics, nanotechnology research, GenAI product
> development, and AI-assisted engineering workflows. Adds Power BI KPI reporting,
> RFQ/RFI supplier scoring, and clear decision records, shaped in part by
> experience as a hearing-impaired professional.

- Replaces the canonical unsolicited PROFILE block in the prompt (app.src.js
  ~2783, the "IT professional with 15+ years in consumer and regulated markets…"
  string). Keep the PROFILE-STRUCTURE 3-part rules (WHO-I-AM / BODY-MIND /
  SPECIAL-CAPABILITIES) around it, but make the WHO-I-AM opener this text.
- Mirror to app.js; regen to verify. (Also check if a `personalInfo.profile`
  field should hold it as the stored default.)

## 5. PUBLICATIONS-DUP-001 — duplicate publication/patent rows  (core problem)
Owner (screenshot): the Publications & Patents list shows each entry twice. "Fix
this and you resolve most of its problems."

- Section id `publications`, type `list_italic`, loc sidebar, source
  `personalInfo.publications[]` (string array). Patent appended via
  `patentNumber` + `patentDescription`, wrapped in `<b>…</b>` (~24233-24236).
- Sidecars (`antcv-pub-injected-reaper-352.js`,
  `antcv-publications-strict-row-layout-273.js` / PUB-CONTROL-DEDUP-001) dedup
  only the rendered CONTROLS/glyphs, NOT the row DATA.
- **Hypothesis:** the stored↔generated merge `l()` (app.src.js ~23758-23783)
  builds its dedup key with `trim().toLowerCase()` only. When one copy is
  `<b>`-wrapped (patent) and the other is plain, or whitespace/punctuation
  differs, the key mismatches → both survive → duplicate row.
- **Fix direction:** strip HTML tags + collapse whitespace in the dedup key,
  applied to BOTH stored and generated, before the `o.has(n(t))` compare. Verify
  the exact `l()` body + the `<b>` wrap site first.

## 6. WHO-I-AM-LABEL-DUP-001 — label shown as heading AND inside the paragraph
Owner (screenshot): "WHO I AM" appears as the section heading AND the paragraph
starts "WHO I AM: I am an IT professional…"; same for "WHY YOUR COMPANY". Keep ONE
headline above; do not repeat it inside the paragraph. (Explicitly UNLIKE working
style, which is a `text_inline` with the label inline and no separate heading.)

- These are `text` sections with a separate heading: title "WHO I AM" (~3203),
  "WHY YOUR COMPANY" (~3605 DA map). The generated content embeds the label as a
  `LABEL:` prefix, duplicating the heading.
- **Fix direction:** (a) prompt rule — for heading-bearing `text` sections, the
  content must NOT begin with the section label; PLUS (b) a defensive
  render/sidecar strip of a leading `"<TITLE>:"` (case-insensitive) that equals
  the section title, so existing generated data also reads clean. Do NOT strip
  for `text_inline` (working-style) sections.

## 7. PHOTO-SHAPE-SQUARE-001 — square upload renders as a circle
Owner: the photo "is not a square" though the uploaded image had corners.

- Preview render: `radius = "square"===sp.photoShape ? 0 : "rounded"===sp.photoShape ? "12px" : "50%"`
  (app.src.js ~41016; mirrors ~41643, ~41897). Default (unset) = `"50%"` → circle,
  which crops the corners off a square upload.
- Shape selector writes `stylePrefs.photoShape` (~12849 / ~12861 / ~35399). The
  select → "square" either isn't persisting or isn't reaching the preview read.
- Related: PREVIEW-STYLE-FIDELITY (A) (square button doesn't apply in preview)
  and (B) (per-package shape is export-only; preview `__photoFrame` has no package
  fallback, rounded-square/hexagon unhandled).
- **Fix direction:** confirm the selector write reaches `stylePrefs.photoShape`
  and the preview re-reads it after a change; honor "square" → radius 0 in
  preview. Decide the default: keep circle as default but make the owner's
  explicit "square" stick, OR default to the uploaded image's own aspect.

## 8. EMDASH render-separator half (already mapped)
See `emdash-hyphen-three-layers` memory + the SESSION_HANDOFF addendum: the
writer↔reader separator pairs to convert atomically. Prompt + content-sidecar
halves shipped (642 / 636).

---

## NEXT-SESSION PROMPT

> Continue the AntCV owner-directed batch. Read `docs/qa/OWNER-BATCH-2026-06-18-PM2.md`,
> `docs/qa/SESSION_HANDOFF_2026-06-18-pm.md`, and the memories
> `emdash-hyphen-three-layers` + `outcomes-verbs-and-unsolicited-spec` first.
> Confirm the tree is clean and no parallel session is running before any
> `app.src.js` edit (ONE deployer at a time; surgical minified `app.js` edits
> mirrored to `app.src.js`, `node --check` both, then `node pwa/test/boot-smoke.mjs`).
>
> Do, in this order (each a tight named bundle: bump `?v` + sw CACHE +
> version-override TARGET (+prev to STALE, never the current), boot-smoke, commit,
> push):
> 1. **TOOLS-METHODS-FIXIT-LOOP-001** (VERIFIED, lowest-risk win) — fix the
>    `items`→`n` bug in `Pe()` at app.src.js 9850-9858 (labeled_list_item) and
>    9863-9868 (education_item); mirror to app.js; re-test a real Fix-It on a
>    grouped tools section + confirm the spinner ends.
> 2. **WHO-I-AM-LABEL-DUP-001** — prompt rule (no label prefix for heading-bearing
>    text sections) + a defensive leading-"TITLE:" strip in render/sidecar (skip
>    text_inline). 
> 3. **PUBLICATIONS-DUP-001** — strip HTML + collapse whitespace in the `l()`
>    dedup key (~23758) for both stored and generated; verify no row survives
>    twice on regen.
> 4. **PHOTO-SHAPE-SQUARE-001** — make the "square" selection persist + apply in
>    preview (radius 0); verify selector→render path.
> 5. **PROFILE-REWRITE-001** + **SPEC-LINE-GONE-001** + **TABLES-SAME-FOCUS-001**
>    (prompt + data bundle, regen-gated) — swap the canonical unsolicited PROFILE
>    text (~2783), store `personalInfo.specialization = "Processes • Products • People"`,
>    add the CORE-COMPETENCIES↔WHAT-I-BRING no-overlap rule; then regen to verify.
> 6. **EMDASH render-separator half** — the mapped writer↔reader pairs.
>
> Don't rush minified mirrors — they bluescreen; boot-smoke every one. The owner
> is testing real generations, so flag which items need a regen to verify.
