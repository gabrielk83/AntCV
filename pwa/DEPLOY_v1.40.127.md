# AntCV PWA v1.40.127 — symmetric table edges + sidebar drag fix

Two-feature fix on top of v1.40.126's CJLR sidecar:

1. **Left edge of every table is now draggable** (symmetric to the
   right edge added in v1.40.126).
2. **The sidebar/main split drag is fixed.** The existing
   implementation in `app.js` had a Safari pointer-capture bug
   (`Drag releases pointer-capture mid-drag`; the v1.40.115 sidebar
   fix didn't cover this code path — see
   `DEBT_INTRODUCED.md` issue #2). The sidecar now intercepts the
   pointerdown event in capture phase, stops propagation before
   React's delegated handler runs, and executes a clean drag with
   window-level pointermove/up listeners so the cursor leaving the
   splitter no longer strands the drag.

## Exact changes vs v1.40.126

```
~ antcv-section-align.js   (+~240 lines: makeDragHandle helper, sidebar override)
~ index.html               (cycler tag bumped to ?v=1.40.127)
~ sw.js                    (cache name bumped to antcv-1.40.127-...)
```

`app.js` untouched. Same surgical surface as v1.40.125 and v1.40.126.

## How the sidebar override works

`app.js` renders a 28-px splitter element at the sidebar/main
boundary with `onPointerDown` bound to a function (`sa`) that has
known Safari pointer-capture issues. React attaches event handlers
through delegation at the root, so the sidecar uses **capture-phase
event interception** to run BEFORE React's handler:

```js
splitterEl.addEventListener('pointerdown', myHandler, { capture: true });
// myHandler calls ev.stopPropagation() — sa never fires.
```

The clean drag implementation:
- Attaches `pointermove` + `pointerup` to the **window**, not the
  splitter element. This is the key fix: even when the cursor leaves
  the splitter (Safari's pointer-capture gives up here), the drag
  keeps tracking because the window listener still fires.
- Uses an `active` flag in closure so a stale `pointermove` after
  cleanup is a no-op.
- Cleans up both window listeners on pointerup/pointercancel.
- Writes the ratio to `localStorage.cvSidebarRatio` using the same
  key/format `app.js` uses, so on page reload the existing init
  picks up the new value cleanly.

## How symmetric resize works

Both table edges drag the SAME storage key
(`stylePrefs.tableWidthPct[sectionId]`). The wrap has `margin: auto`
so the table stays horizontally centred — growing from one side is
visually the same as growing from both. The math:

| Edge | Mouse dx | Width delta |
|---|---|---|
| Right | +dx | +dx (drag right grows) |
| Left  | +dx | −dx (drag right shrinks) |

Double-click on EITHER edge resets to the 72% default.

## Visual layout

The two table-edge handles sit at `right: -4px` and `left: -4px` of
the wrap. Their visible 2-px teal strip is anchored to the EDGE
that faces away from the table (right handle's strip is on the LEFT
of the handle, sitting flush with the table's outer right border;
left handle is mirror).

The sidebar splitter is left visually identical to how `app.js`
renders it — only the behaviour changes. No new element appears in
the sidebar/main split.

## Coexistence map (cumulative since v1.40.126)

| Handle | Location | Cursor | Trigger | z-index |
|---|---|---|---|---|
| Column splitter (existing app.js) | INSIDE table wrap, at column boundary | `col-resize` | 360-ms long-press | 3 |
| Table-edge right (sidecar) | OUTSIDE wrap, right:-4px | `ew-resize` | Plain pointerdown | 4 |
| **Table-edge left (sidecar, NEW)** | OUTSIDE wrap, left:-4px | `ew-resize` | Plain pointerdown | 4 |
| **Sidebar splitter (sidecar override, NEW)** | Existing 28×80 splitter | `ew-resize` | Capture-phase pointerdown | 100 |

## Storage namespace

The sidecar now owns three persisted prefs:

```
personalInfo.stylePrefs.sectionAlignment   { [sid]: 'L'|'C'|'R'|'J' }
personalInfo.stylePrefs.tableWidthPct      { [sid]: 30..100 }
localStorage.cvSidebarRatio                number 0.15..0.55
```

The first two are sidecar-owned; the third (`cvSidebarRatio`) is
shared with `app.js`. We write the same string format `app.js`
writes (`String(ratio)` of the raw number, no JSON wrapping).

## Tests

41 assertions across 16 test groups, all green:

1. Cycler injection on regular sections (4)
2. Skip-list sections excluded (2)
3. Per-role cyclers under experience (3)
4. Click cycle L → C → R → J → L with persistence (8)
5. Re-apply alignment after simulated React commit (1)
6. Idempotent cycler injection (1)
7. Print-media rule present (2)
8. `antcv:sections-updated` event with payload (3)
9. **Table-edge handles (left + right) injection (6)** — updated
10. Double-click resets table width to 72% (2)
11. Persisted width re-applied after simulated re-render (1)
12. **Exactly TWO handles per wrap (was 1)** (1)
13. Orphan wraps get no handle (1)
14. **Left-edge handle is functionally equivalent (2)** — NEW
15. **Sidebar splitter override attaches + suppresses `sa` (3)** — NEW
16. **Sidebar drag updates DOM + persists localStorage (2)** — NEW

Run:
```
cd /home/claude/work/sidecar-test
node test-section-align-v3.mjs
```

## Deploy

Same as previous releases:

```
wrangler pages deploy . --project-name=antcv
```

After deploy the SW activates on next page load. The user sees:

1. A second drag strip on the LEFT outer edge of every CV/CL table.
2. The sidebar/main splitter no longer "sticks" mid-drag — drags
   complete cleanly even when the cursor leaves the splitter element.

## Rollback

Re-deploy v1.40.126 to drop just the left-edge handle + sidebar
override while keeping the right-edge + cycler. Or v1.40.125 to drop
both edges. Or v1.40.124 to drop everything. The SW's activate
handler detects the older cache name and re-installs cleanly each
way.
