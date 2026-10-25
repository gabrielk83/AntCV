# Panel/preview button audit — 2026-10-25 (NIGHTLY-PREVIEW-BUTTON-AUDIT-001, register row 23)

Harness: pwa/test/diag-panel-button-audit.mjs (real browser boot, network blocked, dialogs dismissed).
Bundle: 1.51.4246-era app.js; buttons enumerated: 210.

## Verdict counts
- skipped-dangerous: 13
- ui-only: 10
- active: 131
- not-visible-or-disabled: 56

## THROWS (page errors on click) — fix first

## DEAD candidates (no store write, no DOM delta) — verify each before filing

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

## Diff vs PANEL_BUTTON_AUDIT_2026-10-23.json (by label)

- buttons: 219 -> 210
- regressions (responding -> DEAD/THROWS/unclickable): 0
- recoveries (DEAD/THROWS/unclickable -> responding): 0
- visibility changes (not-visible count moved; state left by an earlier click, verify only if a label stays hidden across runs): 3
  - "Make It Fit (sidebar) — fites every sidebar section, then fixes orphan lines. Us" hidden 0 -> 1
  - "SIDEBAR headline alignment: center (click to cycle)" hidden 0 -> 1
  - "CJLR: cycle left / center / right / justify" hidden 10 -> 3
- active <-> ui-only flips: 13 (settle-window timing, not findings)
- labels gone: 3 — "SIDEBAR headline alignment: justify (click to cycle)", "SIDEBAR headline alignment: left (click to cycle)", "SIDEBAR headline alignment: right (click to cycle)"
- labels added: 1 — "⇥ Fit"

Raw JSON: PANEL_BUTTON_AUDIT_2026-10-25.json