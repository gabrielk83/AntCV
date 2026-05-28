# PP-003 — regression history (read before P1-B Publications work)

The plan flags Publications & Patent as the highest-regression-risk section in the codebase. Git history can't tell us why — every file in `pwa/` was committed as a single initial dump (`cfe0a7b Initial repo structure`). The history is encoded in **two places only**: the orphan-cleanup attribute lists inside the surviving sidecars, and the comment headers of those sidecars. This doc consolidates both so P1-B doesn't repeat what's already failed.

## Files currently on disk

| File | Purpose |
|---|---|
| `pwa/antcv-publications-strict-row-layout-273.js` | Editor-panel row controls: places `[📄 page] [CJLR] [⇥⇤ Fit] [✨ Enhance]` cluster inside each publication row in the editor list. |
| `pwa/antcv-publications-section-panel-row-fix-278.js` | Bottom-sheet section/preview panel: reorders the row's canonical button cluster `[◀] [📄1] [✨] [⇥⇤] [ON] [✕]`, cloning a Fit button from a donor section if the native row didn't render one. |
| `pwa/antcv-publication-titles.js` | Unrelated — `<b>…</b>` sentinel preservation for translation. **Not in scope for PP-003.** |

The two row-control sidecars target **different surfaces** (editor vs. section panel) and use **different DOM contracts**. They are not currently coordinated. Both run on the same `MutationObserver(document.body)` cadence, so they often re-execute on each other's writes.

## Prior iterations (extinct on disk, alive in orphan-cleanup logic)

`antcv-publications-strict-row-layout-273.js:93` removes buttons matching this selector on every sweep:

```
[data-antcv-pub273-control],
[data-antcv-pub271-control],
[data-antcv-pub269-control],
[data-antcv-pub-control],
[data-antcv-pub267],
button[data-antcv-pub-injected],
button[data-antcv-pub-mini-kind]
```

Each prefix corresponds to a previous attempt at the same problem:

| Prefix | What it likely was |
|---|---|
| `data-antcv-pub267-*` | First numbered attempt (v1.40.267). Implementation unknown. |
| `data-antcv-pub269-*` | Second attempt. |
| `data-antcv-pub271-*` | Third attempt. |
| `data-antcv-pub-control` (unprefixed) | A pre-versioning generic attempt. |
| `data-antcv-pub-injected` | An attempt that injected buttons rather than adopting React's. |
| `data-antcv-pub-mini-kind` | An attempt using compact mini-buttons (probably a width-failure response). |
| `data-antcv-pub273-control` | Current (v1.40.273). |

That's **seven** iterations. Each previous one was deemed buggy enough to remove the implementation but kept the orphan-attribute cleanup because users' DOM and persisted state may still carry the marker. **If you add another, increment cleanly and add the previous prefix to this list, do not silently break the cleanup chain.**

A separate, partially-overlapping attempt is encoded in `antcv-section-panel-211.js:245` — a React-prop-stripping clone of the Fit button into the section panel. That logic predates 278's superseding approach but is **still loaded** by index.html and may still be running. See §3 verification note.

## Concrete failure modes the surviving sidecars defend against

Both files' source headers and defensive code reveal what failed before:

1. **Buttons floating outside their parent row.** 273 sets `position:static; float:none; flex:0 0 auto` on every classified button and on the host span. Earlier versions clearly leaked because of inherited `position: absolute` or `float`.
2. **Cluster overflowing the editor width.** 273 caps the row at `max-width: calc(100% - 54px)` and the row's flex layout uses `nowrap`. Earlier attempts let the cluster push past the scrollbar.
3. **Wrong row width allocation between Name and Detail.** 273 hard-codes `name: 48–58px / Detail: 138–150px`. Earlier attempts likely shared width equally, hiding the detail field.
4. **Compress + Enhance acting on the wrong field.** 273 only edits the second field (Detail), never the Name. The cited bug: editing publication titles by accident.
5. **Native eye/delete/up/down disconnected by overlay overwrites.** 273 detects these via `btext()` (text content + title + aria-label) and assigns CSS `order` rather than recreating them.
6. **Section-panel row showing wrong button order.** 278's whole point: native React row outputs `[◀] [📄1] [ON] [✕] [✨]` — Enhance lands at the end, no Fit button. 278 reorders via `style.order` and clones a Fit button from a donor section because the native row doesn't render one.
7. **Duplicate Fit buttons after re-render.** 278 uses `data-antcv-pubrow-comp-injected-278` and skips inject if the row already has one.
8. **Donor Fit button carrying React event handlers.** 278 strips `__react*` and `onclick` keys after cloning to ensure only its own click listener fires.
9. **localStorage compress shape uncertainty.** 278's `compressViaStorage()` accepts both `sections[doc]` and direct array shapes, scans an enumerated list of item-key candidates (`detail|body|description|value|content|journal|year`), and is a defensive no-op if nothing matches.
10. **MutationObserver feedback loops.** Both files mark their own injections (`data-antcv-pub273-*`, `data-antcv-pubrow-*-278`) and CSS uses `!important`. The observer is broad (`{childList, subtree, attributes}`) but writes are idempotent — clearing then re-adding the host every tick is cheap and avoids drift.

## Things that have provably broken Publications historically

Compiled from defensive code + header comments + the seven-attempt history:

- **Touching the row layout without setting `flex:0 0 auto` on every button.** Buttons fly to the right margin.
- **Touching the section-panel row without strict button classification.** Enhance ends up wherever React put it; no Fit; ON/Delete get out of order.
- **Adding new prefixed attributes without updating 273's orphan-cleanup list.** Old stamps persist in users' DOM after a soft reload.
- **Using `style.left / style.right` or absolute positioning on row buttons.** The plan explicitly bans this for PP-003: "No ad-hoc absolute positioning."
- **Running the cluster reorder without first ensuring the cluster's parent uses `display: flex`.** 278 forces `display: flex` if `getComputedStyle` shows otherwise.
- **Hooking onto button text alone.** Multiple sidecars use the COMBINED `textContent + title + aria-label` string. Title and aria-label can be empty in some React renders.
- **Cloning a donor button without stripping React internals.** Causes parallel click handlers, double-fires.
- **Inserting in the wrong DOM position relative to ON/DEL.** 278 has a three-tier insertion strategy: before ON if present, else before DEL, else append.
- **Long Publications text causing line wrap that pushes the cluster down.** 273 hard-caps `white-space: nowrap` + `overflow: visible` + a fixed `maxWidth`.
- **TC-028 (Publications stress) was added in v2 of the plan specifically because all of the above can sneak past a happy-path test.** The plan says: "Do not test only the simplest row state."

## Implications for P1-B

The plan's PP-003 acceptance criterion is:

> Buttons remain row-bound, ordered, and stable through long text, many rows, narrow widths, route changes, hard refresh, and while generation status is active.

Translated into mechanical constraints:

1. **Refactor Publications row controls only through the shared row-control model** (the new `SectionControlBar` from P0-A). No row-specific layout primitives.
2. **Preserve the two-surface architecture.** Editor panel and section panel use different DOM. The SectionControlBar's mount API must support both, parameterised by `capabilities` and `host`.
3. **Adopt the existing classification logic for buttons rendered by app.js** (`btext()` combining textContent + title + aria-label). Many sections have buttons whose `textContent` alone is empty.
4. **Carry forward the orphan-cleanup chain.** Add `data-antcv-pub273-*` and `data-antcv-pubrow-*-278` to the new bar's "previous prefixes" list. Don't delete 273 / 278 from disk until users have cycled through one production version with the new bar (their persisted DOM may still have prefixed stamps).
5. **Run TC-028 stress before declaring done.** The fixture `Publications-stress` from §8 of the plan is the gate, not a smoke test.
6. **Do not introduce a new `data-antcv-pub*` prefix family.** The new bar should use a single shared `data-antcv-control-*` namespace so all sections share an attribute family.
7. **`antcv-section-panel-211.js`'s Fit-button injection logic may still be active.** Before refactoring, decide whether 211 still does useful work or whether 278 fully supersedes it. If superseded, retire it (drop the script tag from index.html) in the same PR as the new bar's Publications wiring — but document the removal in the PR description so anyone tracking 211's behaviour can find it.
