# PB-006 — reference primitives (read before P0-B)

PB-006 says: "preserve the Professional Experience PB UX as the reference for all non-first sub-subsection page breaks." The working pattern is **already split across three sidecars**. PB-006 doesn't live in one file; it's a contract those three files happen to share. The page-break-model work in P0-B must preserve the contract, not duplicate the implementations.

## The three primitives

| Primitive | File | What it owns |
|---|---|---|
| **Boundary insertion** (where the page actually splits) | `pwa/antcv-item-pages-render.js` (v1.40.194) | Invisible `pageBreakBefore: always` spacer, `data-antcv-page-break="1"`. Only for `labeled_list / list / education`. Reads `localStorage['antcv:itemPages'][sid][index]`. |
| **Visible boundary marker + (CONT.) heading** for all other section types | `pwa/antcv-page-breaks-everywhere-284.js` (v1.40.284) | Visible "▼ PAGE N ▼" amber divider + section-teal "(CONT.)" header. Walks every `[data-sid]`. Skips Experience (app.js handles it). Same `antcv:itemPages` storage. |
| **Heading rewrite when app.js native PB picks wrong title** | `pwa/antcv-exp-continuation-fix.js` (v1.40.195) | Detects mis-labeled continuation heading inside `[data-sid="experience"]` (e.g. shows "SELECTED OUTCOMES" instead of "PROFESSIONAL EXPERIENCE (CONT.)"). Rewrites text only. |

## Shared DOM contract — do not change

- Section root: `[data-sid="<id>"]` inside `.antcv-preview-paper` (or `[data-antcv-preview-paper]`).
- Per-item anchor: `[data-antcv-row-path^="items."]`. Outermost match wins (querySelectorAll order = document order).
- Section title source: `JSON.parse(localStorage.sections)[<doc>].find(s => s.id === sid).title`. `doc` is read from `localStorage.doc` (`'cv'|'cl'`).
- Continuation suffix: ` (CONT.)` appended to uppercased title.
- Idempotency tags (set by sidecars, also used as MutationObserver self-filter):
  - `data-antcv-page-break="1"` — the boundary spacer.
  - `data-antcv-continuation-header="1"` — the heading created legitimately by item-pages-render or 284.
  - `data-antcv-cont-fix="1"` — the heading text rewritten by exp-continuation-fix.

## Shared storage contract

- `localStorage['antcv:itemPages']` — `{ [sid]: { [index]: pageNumber } }`. Indices are stringified ints. Page numbers ≥ 2 trigger a break before that item.
- Events fired after a write:
  - `CustomEvent('antcv:item-pages-changed')`
  - `CustomEvent('antcv:sections-updated')`
  - `storage` event (cross-tab) on key `antcv:itemPages`

## Shared scheduling pattern

All three sidecars use:

1. `requestAnimationFrame`-debounced `schedule()` with a `pending` flag.
2. Initial sweep + delayed sweeps at `[150–200, 500–600, 1500, 3000]` ms after install.
3. `MutationObserver` on `document.body, { childList: true, subtree: true [, characterData: true] }` with a self-filter so the sidecar's own insertions don't loop.
4. Re-apply on `antcv:sections-updated` and (where relevant) `antcv:item-pages-changed`.
5. `beforeprint` listener so `window.print()` captures rewritten DOM.

## Heading injection — visual tokens (from item-pages-render's makeContinuationHeader)

```
color:          #00746E (section teal)
fontWeight:     700
fontSize:       12pt
marginTop:      4pt
marginBottom:   8pt
borderBottom:   1pt solid #00746E
paddingBottom:  2pt
fontFamily:     'Trebuchet MS, Calibri, sans-serif'
```

PB-003 says "continuation heading appears at 18 pt from the top of the page". That is **not** what this snippet does — the 18 pt comes from the printed page top via `pageBreakBefore: always` plus the page's top margin in print CSS. The 12 pt is the font size, not the offset. Keep them separate when implementing.

## What the PB-006 model fix in P0-B must not break

When P0-B moves the page-break flag into the document model (`item.pageBreakBefore = true`) and makes it a pure function of `(items, index)`:

- The DOM contracts above are how Preview discovers what to inject. If model→Preview projection produces a different attribute or selector, the three sidecars stop working.
- The legitimate continuation header MUST carry `data-antcv-continuation-header="1"` — `antcv-exp-continuation-fix.js` uses this exact attribute as its **skip** condition. Without it, the fix will try to "correct" the legitimately-correct heading and oscillate.
- Idempotency: the sidecars sweep their own tags every tick. Re-emitting markers on every render is acceptable; mutating them in place is not.

## Panel-side marker

The user-facing button that toggles `item.pageBreakBefore` lives in the editor panel and persists to `localStorage['antcv:itemPages']`. The owning sidecar is **not in this three-file set** — it's split across the row-control sidecars surveyed elsewhere (`antcv-item-page-marker.js` referenced in source comments but not loaded — likely retired; current marker rendering happens via `antcv-page-button-polish-327.js`, `antcv-table-row-page-controls-328.js`, and `antcv-sidebar-subsection-pagebreaks-329.js`).

For P0-B and PB-006 to converge, the panel marker rendering should go through the new `SectionControlBar`'s PB action — that is the natural place to centralise the panel-marker primitive, leaving the boundary + (CONT.) primitives in the three files documented above.
