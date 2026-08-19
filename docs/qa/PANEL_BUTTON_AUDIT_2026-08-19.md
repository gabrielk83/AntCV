# Panel/preview button audit — 2026-08-19 (NIGHTLY-PREVIEW-BUTTON-AUDIT-001, register row 23)

Harness: pwa/test/diag-panel-button-audit.mjs (real browser boot, network blocked, dialogs dismissed).
Bundle: 1.51.4246-era app.js; buttons enumerated: 213.

## Verdict counts
- skipped-dangerous: 14
- ui-only: 15
- active: 133
- not-visible-or-disabled: 50
- DEAD: 1

## THROWS (page errors on click) — fix first

## DEAD candidates (no store write, no DOM delta) — verify each before filing
- [undefined] "Undo last change" (button, panel)

## Preview-only suspects (keys written by controls, never read by the export builder)
- antcv:coreCompGuard
- settingsTab
- settingsSubTab
- antcv:mainOverflow
- antcv.sectionHeadlineAlignment.userTouched.v1
- topbarOrder
- antcv:docWriterTab
- antcv:analytics:counts
- antcv:unifiedPaginationProbe

## Skipped (dangerous labels — audited manually only)
- "Unregister the service worker, delete all caches, and reload. Use this if you de"
- "Export — preview and save as PDF or DOCX. Drag to move."
- "Reset the name colour to the brand / visual-style default"
- "↩ Restore"
- "↩ Restore"
- "Enrich this section — make content more specific, senior-toned, and concrete. Sa"
- "Enrich this section — make content more specific, senior-toned, and concrete. Sa"
- "Page 1. Tap to advance (1→2→3→4→1). Long-press / right-click to reset to page 1."
- "Enrich this section — make content more specific, senior-toned, and concrete. Sa"
- "Reset to defaults"
- "⬆ Upload JD"
- "Analyse JD"
- "⬇ Download analysis (PDF)"
- "Reset the rule colour to the brand / visual-style default"

Raw JSON: PANEL_BUTTON_AUDIT_2026-08-19.json