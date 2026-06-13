# AntCV — Active Bug Tracker

## SESSION REGISTRY — 2026-06-13 (continued, day 2) — 1.50.418 → 1.50.439

Body restored from blob `b7930cf` (the last known-good full version) and this
block prepended with the day-2 work — per the owner's "restore + merge". The full
historical body (2026-06-03 → 1.50.417) follows below unchanged.

**Fixed + shipped:**
- `SIDECAR-CONSOLIDATE G2/G5/G10/G6` `[SHIPPED 1.50.418/419/428/429]` — section-panel (206/207/208→211), mobile-ui (4→1), photo trio (position+pentagon+bridge→one), language prefs/filter trio merged behind ONE shared rAF scheduler + ONE MutationObserver each. 13 files → 4.
- `PERSONAL-ORDER-002` + `TENSE-STICKY-FIX-001` `[SHIPPED 1.50.427]` — Personal subtab order set to the owner figure (Background→CV Sidebar→Languages→Tense→Advanced Tone→Banned Words); the EXPERIENCE TENSE control removes itself off-Personal (no longer sticky).

[RECOVERY-IN-PROGRESS: full body restored in follow-up commit]