// jobtracker-top5-rescore.test.mjs
// ============================================================
// JOBTRACKER-TOP5-PERIODIC-RESCORE-001 (OPEN_REGISTER row 77): the Job Tracker
// Top-5 must DRIFT with the weekly cluster-demand refresh, not only on add/edit.
// The demand snapshot (cluster top-20) is already a ranking input; the gap was
// that JobTracker.tsx fetched it once on mount and never refreshed. These tests
// cover the pure trigger logic that decides WHEN to re-fetch and WHEN a re-fetch
// actually changes the ranking — the guardrail that keeps the Top-5 STABLE when
// the demand snapshot is unchanged (ranking-stability, OPEN_REGISTER row 76).
//
// The source is TypeScript under src/islands/; Node v24 strips the types on
// import, and clusterRefresh.ts has no runtime imports, so it loads directly.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clusterSnapshotHash,
  reconcileSnapshot,
  shouldRefetchOnFocus,
  CLUSTER_REFRESH_MS,
  CLUSTER_FOCUS_STALE_MS,
} from '../../../src/islands/JobTracker/clusterRefresh.ts';

const snap = (...quals) => quals.map((q) => ({ qual: q }));

test('clusterSnapshotHash is deterministic — identical snapshots hash identically', () => {
  const a = snap('Stakeholder management', 'Risk register', 'Six Sigma');
  const b = snap('Stakeholder management', 'Risk register', 'Six Sigma');
  assert.equal(clusterSnapshotHash(a), clusterSnapshotHash(b));
});

test('clusterSnapshotHash is order-sensitive — a re-ranked top-20 hashes differently', () => {
  const a = snap('Stakeholder management', 'Risk register', 'Six Sigma');
  const reordered = snap('Risk register', 'Stakeholder management', 'Six Sigma');
  assert.notEqual(clusterSnapshotHash(a), clusterSnapshotHash(reordered));
});

test('clusterSnapshotHash distinguishes different content and set size', () => {
  assert.notEqual(
    clusterSnapshotHash(snap('A', 'B')),
    clusterSnapshotHash(snap('A', 'B', 'C')),
  );
  assert.notEqual(
    clusterSnapshotHash(snap('A', 'B')),
    clusterSnapshotHash(snap('A', 'X')),
  );
});

test('clusterSnapshotHash handles empty / null / undefined as a stable sentinel', () => {
  assert.equal(clusterSnapshotHash([]), '0:');
  assert.equal(clusterSnapshotHash(null), '0:');
  assert.equal(clusterSnapshotHash(undefined), '0:');
});

test('reconcileSnapshot: first fetch (prevHash empty) always signals changed -> initial rank', () => {
  const r = reconcileSnapshot('', snap('A', 'B'));
  assert.equal(r.changed, true);
  assert.equal(r.hash, clusterSnapshotHash(snap('A', 'B')));
});

test('reconcileSnapshot: an unchanged snapshot does NOT re-rank (Top-5 stability)', () => {
  const first = reconcileSnapshot('', snap('A', 'B', 'C'));
  const second = reconcileSnapshot(first.hash, snap('A', 'B', 'C'));
  assert.equal(second.changed, false, 'identical demand must not trigger a re-rank');
  assert.equal(second.hash, first.hash);
});

test('reconcileSnapshot: a real demand shift re-ranks; the next identical poll then settles', () => {
  const h0 = reconcileSnapshot('', snap('A', 'B', 'C'));
  const shifted = reconcileSnapshot(h0.hash, snap('B', 'A', 'C')); // weekly re-rank
  assert.equal(shifted.changed, true, 'a changed snapshot must re-rank');
  const settled = reconcileSnapshot(shifted.hash, snap('B', 'A', 'C'));
  assert.equal(settled.changed, false, 'the next identical poll must be stable again');
});

test('reconcileSnapshot: an empty refetch after a real snapshot is treated as a change (once)', () => {
  const real = reconcileSnapshot('', snap('A', 'B'));
  const emptied = reconcileSnapshot(real.hash, []);
  assert.equal(emptied.changed, true);
  const stillEmpty = reconcileSnapshot(emptied.hash, []);
  assert.equal(stillEmpty.changed, false, 'repeated empty fetches must not thrash');
});

test('shouldRefetchOnFocus: only refetches once the snapshot is >24h stale', () => {
  const now = 1_000 * 60 * 60 * 24 * 100; // arbitrary epoch far from 0
  assert.equal(shouldRefetchOnFocus(now, now), false, 'fresh snapshot -> no refetch');
  assert.equal(shouldRefetchOnFocus(now - (CLUSTER_FOCUS_STALE_MS - 1), now), false, 'just under 24h -> no refetch');
  assert.equal(shouldRefetchOnFocus(now - CLUSTER_FOCUS_STALE_MS, now), true, 'exactly 24h -> refetch');
  assert.equal(shouldRefetchOnFocus(now - (CLUSTER_FOCUS_STALE_MS + 1), now), true, 'over 24h -> refetch');
});

test('shouldRefetchOnFocus: never-fetched (lastFetchedAt 0) always refetches', () => {
  assert.equal(shouldRefetchOnFocus(0, Date.now()), true);
});

test('refresh cadence is low-frequency by construction (hourly / daily, no busy timer)', () => {
  assert.equal(CLUSTER_REFRESH_MS, 60 * 60 * 1000, 'hourly background check');
  assert.equal(CLUSTER_FOCUS_STALE_MS, 24 * 60 * 60 * 1000, 'daily focus staleness gate');
  assert.ok(CLUSTER_REFRESH_MS >= 60 * 60 * 1000, 'must not poll more often than hourly');
});
