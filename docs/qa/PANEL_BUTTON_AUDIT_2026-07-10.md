# Panel/preview button audit — 2026-07-10 (NIGHTLY-PREVIEW-BUTTON-AUDIT-001, register row 23)

Harness: pwa/test/diag-panel-button-audit.mjs (real browser boot, network blocked, dialogs dismissed).
Bundle: ?-era app.js; buttons enumerated: 196.

## Verdict counts
- skipped-dangerous: 12
- ui-only: 14
- active: 119
- not-visible-or-disabled: 51

## THROWS (page errors on click) — fix first

## DEAD candidates (no store write, no DOM delta) — verify each before filing

## Preview-only suspects (keys written by controls, never read by the export builder)
- antcv:coreCompGuard
- settingsTab
- settingsSubTab
- antcv:mainOverflow
- antcv.sectionHeadlineAlignment.userTouched.v1
- topbarOrder
- antcv:analytics:counts
- antcv:unifiedPaginationProbe

## Skipped (dangerous labels — audited manually only)
- "Unregister the service worker, delete all caches, and reload. Use this if you de"
- "Export — preview and save as PDF or DOCX. Drag to move."
- "↩ Restore"
- "↩ Restore"
- "Enrich this section — make content more specific, senior-toned, and concrete. Sa"
- "Enrich this section — make content more specific, senior-toned, and concrete. Sa"
- "Enrich this section — make content more specific, senior-toned, and concrete. Sa"
- "Enrich this section — make content more specific, senior-toned, and concrete. Sa"
- "Reset to defaults"
- "⬆ Upload JD"
- "Analyse JD"
- "⬇ Download analysis (PDF)"

Raw JSON: PANEL_BUTTON_AUDIT_2026-07-10.json