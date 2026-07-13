# Protected features / open items — 2026-07-14 (fold into OPEN_REGISTER.md + FEATURES_REGISTRY.md)

Filed as a standalone doc because `docs/qa/OPEN_REGISTER.md` (~230KB) and
`docs/FEATURES_REGISTRY.md` (~57KB) are full-file-rewrite-only via the tools
available this session — too large to safely reproduce whole for a 2-row add.
Per `docs/qa/SCHEDULED_ROUTINES.md` standing rule (5) END-OF-RUN REGISTER
REPORTING, the next agent-driven nightly (`antcv-nightly` /
`antcv-job-tracker-nightly`) should transcribe both entries below into their
proper homes (OPEN_REGISTER as rows **92** and **93**; FEATURES_REGISTRY
CLOSED table for the first, OPEN table for the second) and then this file can
be deleted. **Do not delete this file until both rows exist in the master
registers** — it is the only record until that fold-in happens.

---

## Row 92 — 🔒 PROTECTED — JOBLIST-FILTER-001 (SHIPPED 2026-07-14)

**Job List legend-as-filter.** The Job Tracker List-view Legend (T1 / T2 / T3
/ In progress / Archive swatches + ★ Top-5 + ✅ JD stored) is now a live row
filter, not decoration.

- **Where:** `src/islands/JobTracker/JobTracker.tsx` — `filterBands` /
  `filterTop5` / `filterJd` state, `filteredRows` memo (replaces raw `rows` as
  the List table's data source and the footer count), interactive `Legend`
  component (checkboxes, not static swatches).
- **Default on every fresh app start:** every tier CHECKED except Archive
  (`D9D9D9`); ★ Top-5 and ✅ JD stored unchecked (no extra narrowing).
- **Persistence:** `sessionStorage['antcv:jobtracker:legendFilter']` — **not**
  `localStorage**. Survives while the tab/app session stays open (reopening
  the tracker, re-renders) but resets to the default the next time the app is
  started, per explicit owner spec ("allow me to change it every time I start
  the app, keep as is during the app run").
- **DO NOT DELETE / DO NOT SILENTLY REVERT** the Legend to a display-only
  block — removing the checkboxes or the sessionStorage read/write is a
  regression, not a cleanup.
- Source: this session (2026-07-14, owner ask). Owner visual verify owed.

**FEATURES_REGISTRY fold-in target:** new row in the CLOSED table —

```
| FT-JOBLIST-LEGEND-FILTER | Job List Legend doubles as a live row filter — every swatch (T1/T2/T3/In progress/Archive) + ★ Top-5 + ✅ JD stored is a checkbox that hides/shows matching rows in the List table | `src/islands/JobTracker/JobTracker.tsx` (`filterBands`/`filterTop5`/`filterJd` state, `filteredRows` memo, interactive `Legend` component) | 2026-07-14, owner ask. Default on every fresh app start = every tier checked EXCEPT Archive; choice kept in `sessionStorage['antcv:jobtracker:legendFilter']` (not `localStorage`) so it survives the open session but resets on the next app start, per owner spec. **PROTECTED — OPEN_REGISTER row 92; do not revert the Legend to a display-only block.** |
```

---

## Row 93 — 🔒 PROTECTED — BRANDFIT-CANDIDATE-SIDEBAR-OVERRIDE-001 (OPEN, owner report)

**Owner report:** when a saved application carrying its own per-app brand-fit
`style_config` (BRAND-FIT-PER-APP-001, D1 `application.style_config`, sampled
navy/accent via `fetchBrandColors` → `headerBg` / `sidebarBg` /
`photoBorderColor` / `sidebarLineColor` / `sidebarHeadColor`, set in
`src/islands/JobTracker/JobTracker.tsx` `prepareAndOpen`) is opened/loaded,
the **candidate band** (header band) and **sidebar section** backgrounds keep
the default blue / light-grey instead of the employer's sampled colours — the
defaults "resist" the override.

**Root-cause hypothesis (code-read this session, NOT yet live-verified):**
two preview sidecars intentionally exclude exactly these two surfaces from
their recolour logic:

1. `pwa/antcv-sidebar-bg-token.js` (comment tag `PALETTE-RESET-BAND-001`)
   explicitly **skips** any element tagged `data-antcv-candidate-band` (or
   its descendants) and every `<TH>` (sidebar-section header cells) — by
   design, to protect the shipping-package reset case. But the same skip
   means a brand-fit colour landing on those elements is never re-asserted by
   the sidecar.
2. `pwa/antcv-preview-header-tokens.js` only tokenizes the header band when
   its baked colour matches one of 4 hardcoded shipping-package hex values
   (`HEADER_BG_CANDIDATES`). An arbitrary employer-sampled hex is invisible
   to it either way — so the header band's actual rendered colour is
   whatever `app.js`'s render path baked inline at generation/render time,
   which needs to be reading the **per-application** `style_config` (not
   just the account-wide `navyColor` / `styleConfig` KV prefs) for **both**
   the candidate band and the sidebar section headers specifically.

**Fix must follow the proven Item-B methodology**
(`docs/handoff/SANDBOX_STUCK_CHANGES_2026-06-13.md` §B — the last
candidate-band/sidebar colour rework): surgical `app.src.js` → `app.js`
change (terser rebuild, identity round-trip gate) so the candidate-band +
sidebar-section-header render paths read the OPEN application's
`style_config.headerBg` / `sidebarBg` ahead of the account-wide default,
**plus** `workers/docx-worker/src/palette.js` for export parity, **plus**
confirm neither sidecar's exclusion list then blocks the correctly-applied
colour.

**Related open item:** OPEN_REGISTER row 87(b) "BRAND COLORS" (export-side
`style_config=null` gap, `style_config` never populated on the headless
export path) is the **same underlying gap** seen from the worker/export side
— fix both together if practical.

**Owner-gated — needs a live browser pass** (open a brand-fitted application,
confirm candidate band + sidebar section backgrounds show the sampled
colour, not blue/light-grey) **before shipping. Do not blind-edit the
minified bundle without that verification**, per repo discipline
(`CLAUDE.md` hotfix discipline + the Item-B precedent above, which needed a
live DOM session and was explicitly deferred without one).

**DO NOT DELETE this row until both the candidate band and sidebar section
backgrounds are confirmed live to take the per-application brand colour.**

Source: owner report 2026-07-14.

**FEATURES_REGISTRY fold-in target:** new row in the OPEN table —

```
| BRANDFIT-CANDIDATE-SIDEBAR-OVERRIDE-001 | 🔒 PROTECTED — owner report. A saved application's per-app brand-fit colours (BRAND-FIT-PER-APP-001, D1 `application.style_config`, sampled via `fetchBrandColors` → `headerBg`/`sidebarBg`/`photoBorderColor`/`sidebarLineColor`/`sidebarHeadColor`) must override the default blue candidate band + light-grey sidebar section backgrounds when that application loads — currently the defaults "resist" the override a lot. | 🟡 OPEN — root-cause hypothesis filed, not yet fixed | OPEN_REGISTER row 93 (full detail). Code-read hypothesis: `pwa/antcv-sidebar-bg-token.js` (PALETTE-RESET-BAND-001) deliberately SKIPS the candidate band + every `<TH>`, and `pwa/antcv-preview-header-tokens.js` only tokenizes against 4 hardcoded shipping-package hex values — neither sidecar is where a brand-fit colour should be asserted; the render path baking the candidate-band/sidebar-header inline colour needs to read the OPEN application's `style_config` ahead of the account-wide default. Overlaps OPEN_REGISTER row 87(b) (export-side `style_config=null` gap). Fix must follow SANDBOX_STUCK_CHANGES_2026-06-13.md §B methodology + owner-gated live verify. **DO NOT DELETE until confirmed live.** |
```

---

### Nightly instructions

1. Copy the two blocks above into `docs/qa/OPEN_REGISTER.md` as rows 92/93
   (before the `## CLOSED` marker, same table format as the surrounding
   rows).
2. Copy the two fold-in-target snippets into `docs/FEATURES_REGISTRY.md`
   (CLOSED table for FT-JOBLIST-LEGEND-FILTER, OPEN table for
   BRANDFIT-CANDIDATE-SIDEBAR-OVERRIDE-001) and bump the "Last updated"
   increment line per the doc's own convention.
3. Delete this file once both rows are confirmed present in the master
   registers.
