// JOBTRACKER-TOP5-PERIODIC-RESCORE-001 (OPEN_REGISTER row 77) — pure trigger
// logic so the Job Tracker Top-5 DRIFTS with the weekly cluster-demand refresh.
//
// The Top-5 already ranks on the cluster demand snapshot (rank.ts fitScore /
// orderTop5 take the cluster top-20 as an input), but JobTracker.tsx fetched that
// snapshot ONCE on mount and never refreshed it. So while the panel stayed open a
// weekly demand refresh (D1 rollup behind GET /api/cluster-top20) could not move
// the ranking. These helpers let the panel re-fetch on a LOW-frequency schedule
// (hourly background check + on window focus once >24h stale) and re-rank ONLY
// when the snapshot content actually changed — identical states must never
// reshuffle the Top-5 (ranking-stability is a hard requirement, OPEN_REGISTER
// row 76). Pure, offline, unit-testable: no React, no runtime imports.

// A cluster top-20 entry. Only the demanded-qualification text and its rank ORDER
// carry the demand signal, so the hash keys on those.
export interface ClusterQual { qual: string }

// Hourly background re-fetch of the demand snapshot. NOT a busy timer: at most one
// fetch per hour while the panel is open.
export const CLUSTER_REFRESH_MS = 60 * 60 * 1000;

// On window focus, re-fetch only once the last snapshot is older than a day, so a
// long-lived tab picks up a refresh without polling.
export const CLUSTER_FOCUS_STALE_MS = 24 * 60 * 60 * 1000;

// Order-sensitive content hash of a demand snapshot. Rank ORDER carries meaning (a
// skill rising in the top-20 changes fit weighting), so the fold runs in array
// order. Deterministic: identical snapshots hash identically, so the caller can
// skip the re-rank when nothing changed. An empty/absent snapshot hashes to '0:'.
export function clusterSnapshotHash(cluster: ClusterQual[] | null | undefined): string {
  const arr = cluster || [];
  if (!arr.length) return '0:';
  const s = arr.map((c) => (c && c.qual) || '').join('');
  // djb2-xor — small, stable, offline. Value only needs to be collision-resistant
  // enough to tell one weekly snapshot from the next.
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) ^ s.charCodeAt(i)) | 0;
  return arr.length + ':' + (h >>> 0).toString(36);
}

// Whether a focus event should trigger a re-fetch: only once the last snapshot is
// >24h stale. lastFetchedAt = 0 (never fetched) always refetches.
export function shouldRefetchOnFocus(lastFetchedAt: number, now: number): boolean {
  return (now - (lastFetchedAt || 0)) >= CLUSTER_FOCUS_STALE_MS;
}

// The re-rank decision after a re-fetch: apply (and re-rank) only when the new
// snapshot's hash differs from the last applied one. Returns the new hash to store
// and whether the caller should update state / re-rank.
export function reconcileSnapshot(
  prevHash: string,
  next: ClusterQual[] | null | undefined,
): { hash: string; changed: boolean } {
  const hash = clusterSnapshotHash(next);
  return { hash, changed: hash !== prevHash };
}
