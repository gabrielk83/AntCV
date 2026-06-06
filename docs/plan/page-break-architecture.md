# AntCV Page‑Break Architecture (2026‑06‑06)

## 0. Why we keep failing today
Page breaks are drawn by **sidecars injecting DOM into the React preview** (245/284/331).
React reconciles those injected nodes away or duplicates them → the HIWC preview salmon
won't stick, foundation stacks duplicate `SECTION (CONT.)` headers, the tables merge.
**Only nodes app.js itself renders in React persist** (proof: the bring‑table segments + headers
survive). Fix: every break is rendered **inside app.js's section renderers**, from one shared
break model, and the *same* model drives the DOCX/PDF export.

## 1. Three invariants
1. **One source of truth** — `localStorage['antcv:itemPages']` (already exists). Everything
   (preview render + export payload + auto‑overflow) reads/writes this one map. Retire the
   parallel stores (`antcv.hiwc.page.v1`, `antcv.foundationControls.v1`).
2. **Rendered in React** — app.js emits the salmon splitter + `(CONT.)` header + the real CSS
   page break. Sidecars only write the *model* + the panel chips; never inject into the preview.
3. **Effective page is monotonic** — an item can never sit on a page earlier than the content
   above it (the *floor*). `eff(item) = max(ownPage, runningMaxAbove)`.

```
itemPages = {
  "who_i_am":   { "0": 2 },                 // single-content: whole section starts p2
  "contribute": { "bullet_2": 2, "closing": 2 },   // HIWC: per item
  "foundation": { "0": 2, "1": 3 },         // hands_on=p2, professionally=p3
  "bring":      { "3": 2 },                  // table row 3 -> p2 (row 0 = header)
}
+ a parallel `autoPages` map (same shape) produced by overflow detection (§6).
effective[sec][item] = max( manual, auto, runningMaxAbove )
```

## 2. Render contract in app.js
One helper, called by every section renderer in the `switch(type)`:

```
renderWithBreaks(sectionId, orderedItems, opts) -> [reactNodes...]
  // orderedItems = [{key, node}], in document order
  let run = 1
  for (i, {key,node}) of orderedItems:
     pg = effPage(sectionId, key)              // max(own, auto, floor)
     if pg > run:
        if i === 0:  emit <SectionMoveBreak pg/>       // whole section: salmon, NO (CONT.)
        else:        emit <MidBreak pg title/>          // salmon + "<TITLE> (CONT.)"
        emit <div style="break-before:page;height:0"/>  // REAL break for print/pdf
        run = pg
     emit node
```

`<SectionMoveBreak>` / `<MidBreak>` are tiny React components (salmon bar = the light
`▼ PAGE n ▼`, `no-print`; the `break-before:page` div carries the actual break). Because they
are React children of the section, reconciliation keeps them — no sidecar injection.

The editor **panel** keeps its own salmon chip (already working) by reading the same model.

## 3. Per‑object‑type

### 3a. Single‑content section — WHO I AM, WHY THIS POSITION, OPENING, CLOSURE, work_style
Item set = `["0"]` (the section is one unit). Page button lives on the **subsection level**.
Press → `itemPages[sec]["0"]=N` → whole section (heading + body) moves; cascade carries every
**following** section to ≥N.

```
 page 1                         page 2
 ┌───────────────┐    press     ┌───────────────┐
 │ WHO I AM       │   ───────►   │ ░ ▼ PAGE 2 ▼ ░ │  salmon (no (CONT.) — heading is the header)
 │   …body…       │              │ WHO I AM       │
 │ WHY THIS POS.  │              │   …body…       │
 └───────────────┘              │ WHY THIS POS.  │  ← cascaded (flows after)
                                 └───────────────┘
```

### 3b. HIWC (`text_bullets`) — array of bullets
Items = `[intro, bullet_0 … bullet_N, closing]`.
- **intro** break → whole section moves (3a behaviour, no `(CONT.)`).
- **bullet_k / closing** break → mid‑section: salmon + `HOW I WOULD CONTRIBUTE (CONT.)`
  before that item; everything after flows.

```
 HOW I WOULD CONTRIBUTE
   • one
   • two
   ░ ▼ PAGE 2 ▼ ░
   HOW I WOULD CONTRIBUTE (CONT.)
   • three           ← bullet_2 broke
   [closing]
```

### 3c. FOUNDATION — object of two text‑chunks
Items = `[hands_on(0), professionally(1)]`.
- **hands_on** break → whole FOUNDATION moves (no `(CONT.)`).
- **professionally** break → mid‑section: salmon + `FOUNDATION (CONT.)` before it; floor =
  hands_on's page (professionally can't precede hands_on).

### 3d. Tables — WHAT I BRING (CL) and CORE COMPETENCIES (CV) — **SEPARATE renderers, no shared logic**
Items = data rows `1..N` (`row 0` = column header). Reuses the existing `e.pageBreakRows` +
`mk(start,end,seg)` (each segment is its **own `<table>`**).
- **first data cell (row 1)** → set the *section* break → heading + header + all rows move as one.
- **row i (i>1)** → close the current `<table>`, emit salmon, emit `<TITLE> (CONT.)` heading,
  then a **new `<table>` whose `<thead>` repeats the same column header** and whose `<tbody>`
  is rows `i..`.

```
 page 1                                  page 2
 WHAT I BRING                            ░ ▼ PAGE 2 ▼ ░
 ┌──────────┬──────────────┐            WHAT I BRING (CONT.)
 │ Focus    │ Expertise    │  header     ┌──────────┬──────────────┐
 ├──────────┼──────────────┤            │ Focus    │ Expertise    │  header COPY
 │ area 1   │ …            │            ├──────────┼──────────────┤
 │ area 2   │ …            │            │ area 3   │ …            │  ← row broke here
 └──────────┴──────────────┘            │ area 4   │ …            │
                                         └──────────┴──────────────┘
```
CV Core Competencies = an **independent** copy of this renderer keyed to its own section id +
its own `pageBreakRows`. The two never share state or code paths.

### 3e. Sidebar subsection groups
Each `{group:"…"}` divider starts a group; a group = one breakable unit (item key = the group
index). Same `renderWithBreaks` contract, rendered by the sidebar renderer.

## 4. Manual break → real PDF/DOCX page break
- **Preview**: the `break-before:page` div already triggers `window.print()`/PDF pagination; the
  salmon bar is `no-print`.
- **Export payload** (PWA `antcv-docx-client`): include `itemPages` (+ resolved `autoPages`) in the
  POST body so the worker sees them.
- **docx‑worker `generate.js`**: it already emits `pageBreakBefore` paragraphs and the
  EXPERIENCE `(CONT.)` continuation (lines ~769, 1410, 1711, 22481, 21237). Extend the same
  mechanism per type: before the first item that starts page ≥2, emit a `pageBreakBefore`
  paragraph; for mid‑section/table breaks also emit the `<TITLE> (CONT.)` heading / repeated
  table header row. PDF is produced from that DOCX (or the print path), so it inherits the breaks.

## 5. Auto‑overflow — "no blank pages" (the important one)
Goal: never let a big block (a section, or a large subsection) be treated as one unit so the
print engine shoves the whole thing to the next page and leaves the current one half‑empty.

**Mechanism (preview, debounced after layout settles):**
```
PAGE_H = 1123px  (A4 at preview scale)  ; USABLE = PAGE_H - top/bottom margin
walk top-level objects AND their largest breakable sub-units in document order:
   cursor = position within current page
   for unit in [candidate-header, each main section, each subsection,
                each experience role, each table row, each HIWC bullet, sidebar group]:
       h = measured height(unit)
       if cursor + h > USABLE:                      // would cross the boundary
           if h <= USABLE:                          // unit fits on a fresh page
               autoBreakBefore(unit)                // start it on the next page
               cascade everything after to next page
               cursor = h
           else:                                    // unit itself is taller than a page
               leave it (engine splits inside) ; cursor = (cursor+h) % USABLE
       else cursor += h
mark each auto break with a salmon "▼ PAGE n (auto) ▼" in the preview
```
- **Granularity rule**: always measure at the *finest* breakable unit available (role, row,
  bullet, group) before falling back to the whole section — that is what prevents the
  "page 1 = only candidate header, experience jumps wholesale to page 3" blank‑page problem.
- Auto breaks are written to a separate `autoPages` map so they never fight the user's manual
  ones; `effective = max(manual, auto, floor)`.
- **Export parity**: set `break-inside:avoid` on the *small* units (a role block, a table row, a
  bullet) — never on a whole section — so the DOCX/PDF engine also breaks at fine granularity
  and produces the same compact pagination, not blank pages.

```
 BEFORE (block-level break-inside:avoid)     AFTER (fine-grained auto-break)
 p1: [candidate header]            (blank)   p1: [candidate header][profile][outcomes]
 p2: [profile]                     (blank)       [core comp][experience r1..r3]
 p3: [EXPERIENCE — whole block]              p2: ░▼ PAGE 2 (auto) ▼░ [experience r4..r6]
```

## 6. Build order (each shipped + verified before the next)
1. `text_bullets` (HIWC) native render — makes the preview salmon real/permanent.
2. Tables (WHAT I BRING, then CORE COMPETENCIES as a separate renderer).
3. Single‑content sections (whole‑section move + cascade).
4. Foundation (two parts).
5. Sidebar groups.
6. Manual → DOCX/PDF export wiring.
7. Auto‑overflow detection + salmon "(auto)".

Each step is an `app.js`/`app.src.js` render change behind the 1.50.185 React‑DOM guard, verified
on device before moving on — never all at once.
