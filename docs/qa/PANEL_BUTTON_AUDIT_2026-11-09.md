# Panel/preview button audit — 2026-11-09 (NIGHTLY-PREVIEW-BUTTON-AUDIT-001, register row 23)

Harness: pwa/test/diag-panel-button-audit.mjs (real browser boot, network blocked, dialogs dismissed).
Bundle: 1.51.4246-era app.js; buttons enumerated: 212.

## Verdict counts
- skipped-dangerous: 13
- active: 130
- ui-only: 11
- not-visible-or-disabled: 58

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
- "Page 1. Tap to advance (1→2→3→4→1). Long-press / right-click to reset to page 1."
- "Enrich this section — make content more specific, senior-toned, and concrete. Sa"
- "Reset to defaults"
- "⬆ Upload JD"
- "Analyse JD"
- "⬇ Download analysis (PDF)"
- "Reset the rule colour to the brand / visual-style default"

## Diff vs PANEL_BUTTON_AUDIT_2026-11-05.json (by label)

- buttons: 212 -> 212
- regressions (responding -> DEAD/THROWS/unclickable): 0
- recoveries (DEAD/THROWS/unclickable -> responding): 0
- visibility changes (not-visible count moved; state left by an earlier click, verify only if a label stays hidden across runs): 1
  - "Make It Fit (sidebar) — fites every sidebar section, then fixes orphan lines. Us" hidden 0 -> 1
- active <-> ui-only flips: 5 (settle-window timing, not findings)
- labels gone: 1 — "What I Bring row 0 alignment: Left aligned. Click to cycle Center, Justify, Left"
- labels added: 1 — "⇥ Fit"

Raw JSON: PANEL_BUTTON_AUDIT_2026-11-09.json