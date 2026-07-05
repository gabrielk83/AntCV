// force-last-grp-groupcount-invalidate.test.mjs
// ============================================================
// FORCE-LAST-GRP-GRPCOUNT-INVALIDATE-001 (owner 2026-07-05, "page-3 ghost"):
// a real CV export stranded ONE REGULATORY CONTEXT group ("Environmental &
// Durability") alone on an otherwise near-empty page, with a SECOND
// "Environmental, Durability & Compliance" group landing on yet another page
// after it — the owner's own manually-repaginated reference packed both
// groups together on one page instead.
//
// Root cause: antcv-auto-pagebreak-block-001.js's FORCE-LAST-GRP sticky cache
// (__forceLastGrpStick) reapplied a cached "isolate the last group" decision
// "while the block count is unchanged OR GREW" (FORCE-LAST-GRP-SETTLE-001,
// 2026-06-29) — but REGULATORY CONTEXT grew from 4 groups to 5 (a new group
// added after the original last one). Every new group's rows make
// blkCount >= cached.blkCount trivially true, so the cache kept reapplying
// the OLD lastGrp index (pointing at what used to be the final group, now
// the 4th of 5) forever, stranding it alone; the coordinator's normal
// per-group pass then placed the genuinely-new 5th group on a further page.
//
// This is a source-level regression lock (the coordinator's heavy closures
// over live DOM measurement make a full functional harness impractical) —
// it proves the cache now keys on GROUP COUNT too, not just block count, at
// every site that reads or writes __forceLastGrpStick.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const src = await readFile(new URL('../../antcv-auto-pagebreak-block-001.js', import.meta.url), 'utf8');

test('the cache-validity check requires cached.grpCount to match the CURRENT group count', () => {
  assert.match(
    src,
    /if \(cached && blkCount >= cached\.blkCount && cached\.startPage === beforePage && cached\.grpCount === starts\.length\)/,
    'blkCount/startPage agreement alone must no longer be sufficient to reuse a stale decision — grpCount must also match'
  );
});

test('the cache write stores grpCount (starts.length) alongside lastGrp/startPage/blkCount', () => {
  assert.match(
    src,
    /__forceLastGrpStick\[sid\] = \{ lastGrp: lastGrp, startPage: beforePage, blkCount: blkCount, grpCount: starts\.length \};/,
    'every write to the sticky cache must record the group count it was computed against'
  );
});

test('the debug log surfaces the cached group count for future diagnosis', () => {
  assert.match(src, /cached:\s*cached\s*&&\s*\{\s*sp:\s*cached\.startPage,\s*bc:\s*cached\.blkCount,\s*gc:\s*cached\.grpCount\s*\}/, 'antcv:flg-debug output should show grpCount, not just blkCount/startPage');
});

test('there is exactly one cache-validity check site (no second stale copy of the old blkCount-only condition)', () => {
  const staleShape = /if \(cached && blkCount >= cached\.blkCount && cached\.startPage === beforePage\)\s*\{/;
  assert.equal(staleShape.test(src), false, 'the OLD (grpCount-less) condition must not still exist anywhere in the file');
});
