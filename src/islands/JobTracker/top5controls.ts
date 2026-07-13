// JOBTRACKER-TOP5-CONTROLS-001 — pure, import-free decision helper for the Job
// Tracker Top-5 row controls. Kept in its own module with NO runtime imports so
// Node's type-stripping test runner can load it directly (the same reason
// clusterRefresh.ts is standalone); rank.ts imports fitPercent from api.ts and
// so can't be loaded under `node --test`.

// Clicking a row's rank-number cell TOGGLES Top-5 membership: a row currently IN
// the Top-5 is PARKED out (it leaves the panel but stays live in the list); a
// row currently OUT (parked, or simply below #5) is PINNED in. The caller routes
// 'pin' to the EXISTING togglePin handler and 'park' to togglePark — no new
// state is invented, the click just picks which existing mutation to run.
export function top5ClickAction(isMember: boolean): 'pin' | 'park' {
  return isMember ? 'park' : 'pin';
}
