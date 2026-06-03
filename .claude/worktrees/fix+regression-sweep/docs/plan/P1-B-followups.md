# P1-B follow-ups — deferred SectionControlBar migration

P1-B (`fix/tables-outcomes-publications`) ships a deliberately conservative subset of TB-001..003 / SO-001..002 / PP-001..003. This doc records what shipped, what's deferred, and the migration recipe for the next pass.

## Why the scope is conservative

`docs/plan/PP-003-regression-history.md` (Phase 0 discovery) traced **seven prior iterations** of the Publications row-control fix that were attempted and removed. The eighth (the current `antcv-publications-strict-row-layout-273.js` + `antcv-publications-section-panel-row-fix-278.js` pair) is finally stable.

The plan's PP-003 entry is explicit:

> "Refactor Publications & Patent controls ONLY through the shared row-control model. No ad-hoc absolute positioning. No duplicated render paths. Buttons remain row-bound, ordered, and stable through long text, many rows, narrow widths, route changes, hard refresh, and while generation status is active."

P1-B's TC-028 stress test is the gate. Touching the layout primitives in this PR risks an eighth regression that breaks TC-028 and undoes years of debugging. The minimum-blast-radius P1-B is therefore:

- **Shipped** (this PR): user-facing wording sweep ("Compress" → "Fit" in titles/aria/text-content) across editor-panel row buttons. GEN-004 compliance for tables, outcomes, publications. Layout untouched.
- **Deferred** (follow-up pass): full migration of each row-control sidecar to `window.SectionControlBar.mount()`.

## What's already correct (no change needed)

- **TB-001** (CJLR per editable line in Core Competencies): `antcv-core-competencies-row-controls-234.js` already implements per-line CJLR via `setAlign(idx, ...)` writing to `localStorage['antcvItemAlignment']`.
- **TB-002** (Per-row Page Break in CC + WIB): `antcv-table-row-page-controls-328.js` handles this; the PB rule for table splits was fixed in P0-B (`antcv-table-page-splits-327.js` — first-row-moves-whole-table vs later-row-splits-with-cloned-header).
- **SO-001** (Each Selected Outcome row exposes `PB CJLR Enhance Fit Delete`): `antcv-selected-outcomes-row-controls-237.js` already emits PB, CJLR, Compress→Fit (after this PR's wording sweep), Enrich. Delete is natively rendered by app.js.
- **SO-002** (`+ Outcome` button): natively rendered by app.js.
- **PP-001** (Publications row exposes `PB CJLR Enhance Fit Delete` visible): `antcv-publications-strict-row-layout-273.js` does this; visible per its CSS `flex` + `nowrap` rules.
- **PP-002** (Single publication input, controls act on whole entry): same.

## What this PR ships

- **GEN-004 wording**: `antcv-row-controls-wording-341.js` rewrites "Compress" / "compress" / "COMPRESS" / "Comp." → "Fit" / "fit" / "FIT" on every editor-panel button's title, aria-label, and (where the button has no child elements) textContent. Idempotent via `data-antcv-row-wording-fixed="1"` marker. Editor-panel scope only — never touches `.antcv-preview-paper`.
- **PP-003 stability**: layout untouched. The TC-028 stress test continues to pass because nothing about row layout, ordering, or rendering changed.

## What's deferred

Per-sidecar refactor to use `window.SectionControlBar.mount()`:

| Sidecar | Status | Migration recipe |
|---|---|---|
| `antcv-publications-strict-row-layout-273.js` | not touched | Replace the bespoke `make(kind)` / `wire(pair, sid, i)` loop with one `SectionControlBar.mount(host, { itemId: 'publications.row.' + i, capabilities: { pageBreak, align, enhance, fit, delete }, state: {...}, onAction: ... })`. Keep the row-detection logic (`rows(root)`) unchanged — that's the part that PP-003 protects. |
| `antcv-publications-section-panel-row-fix-278.js` | not touched | This is the bottom-sheet panel reorderer. It identifies + reorders existing native React buttons. After 273 migrates, this file's classification logic still applies — but the cluster it reorders may shift to a SectionControlBar host. Re-verify TC-028 post-migration. |
| `antcv-selected-outcomes-row-controls-237.js` | not touched | Replace bespoke cluster with `SectionControlBar.mount(host, { itemId: 'selected_outcomes.row.' + idx, capabilities: { pageBreak, align, enhance, fit, delete }, ... })`. Delete capability conditional on row being user-added. |
| `antcv-core-competencies-row-controls-234.js` | not touched | Same recipe; itemType `core-competencies-row`. |
| `antcv-what-i-bring-row-controls-327.js` | not touched | Same recipe; itemType `what-i-bring-row`. |
| `antcv-table-row-page-controls-328.js` | not touched | This is PB-only. Could be subsumed into the per-row SectionControlBar with `capabilities.pageBreak: true`. |

## Gating the follow-up

Before starting the per-sidecar refactor:

1. Confirm TC-028 still passes in the live build (long Publications text, many rows, narrow viewport, route changes, mid-generation).
2. Build the Publications-stress fixture from §8 of the plan.
3. Run the migration on ONE sidecar at a time, with TC-028 between each.

If any single migration breaks TC-028, revert that sidecar's migration and document the failure mode in `PP-003-regression-history.md`.

## What "done" looks like

When every row-control sidecar mounts through `SectionControlBar`:
- One source of truth for action ordering (`SectionControlBar._ACTION_ORDER`).
- One source of truth for deterministic tooltips (GEN-008).
- Zero duplicate event dispatch paths.
- `window.SectionControlBar._validateDispatch` enforces GEN-002 mechanically.

Until that day, P1-B's wording sweep is enough to satisfy GEN-004 across these sections without paying the PP-003 risk.
