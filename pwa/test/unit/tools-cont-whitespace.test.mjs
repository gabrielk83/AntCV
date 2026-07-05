// TOOLS-CONT-WHITESPACE-001 (owner 2026-07-05, "tools & methods has too much
// white space"): a sidebar section that overflows onto a later page-box (the
// reported case was TOOLS & METHODS continuing after a page break, but any
// trailing sidebar content hits the same path) left several hundred px of
// dead white space at the bottom of the FINAL page — the last row was padded
// to a full 1123px A4 sheet regardless of how little real content it held.
//
// Root cause: TWO cooperating sidecars special-cased "the LAST .antcv-page-row
// keeps the full A4 min-height" (SALMON-EMPTY-REGION-001, 1.50.753):
//   - antcv-page-fit.js set `min-height` to PAGE_HEIGHT_PX only when
//     `idx === lastIdx`, else 0 (content-sized).
//   - antcv-sidebar-fill-equalize-227.js mirrored this: non-last rows
//     equalize the navy sidebar to real CONTENT height; the last row instead
//     stretched the sidebar to match the (page-fit-forced) full A4 box.
// That was correct for a genuinely single-page CV (an otherwise short CV
// should still look like one A4 sheet) but wrong for the LAST row of a
// MULTI-page document: there is no next salmon to keep flush against, so it
// can — and per the owner's report, should — collapse to its real content
// exactly like every other row.
//
// This is a source-level regression lock (both sidecars measure/mutate a
// live DOM via getBoundingClientRect/MutationObserver; a full functional
// harness is impractical without a real browser — see the identical
// rationale in force-last-grp-groupcount-invalidate.test.mjs). It proves the
// "only when there is exactly one page-row" condition is in place in BOTH
// files, and that the old "only the last row" shape is gone.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const pageFitSrc = await readFile(new URL('../../antcv-page-fit.js', import.meta.url), 'utf8');
const equalizeSrc = await readFile(new URL('../../antcv-sidebar-fill-equalize-227.js', import.meta.url), 'utf8');

test('antcv-page-fit.js: the A4 min-height is forced only when there is a single page-row', () => {
  assert.match(
    pageFitSrc,
    /var wantMin = \(rows\.length === 1\) \? \(PAGE_HEIGHT_PX \+ 'px'\) : '0px';/,
    'a multi-page document (rows.length > 1) must NOT force PAGE_HEIGHT_PX min-height on any row, including the last'
  );
});

test('antcv-page-fit.js: the old "only the last row" A4-forcing condition is gone', () => {
  assert.equal(
    /var wantMin = \(idx === lastIdx\)/.test(pageFitSrc),
    false,
    'the stale idx===lastIdx gate must not still exist — it padded the last page-row of a multi-page CV to a full A4 sheet'
  );
});

test('antcv-sidebar-fill-equalize-227.js: the content-based equalize branch also covers the last row of a multi-page document', () => {
  assert.match(
    equalizeSrc,
    /if \(idx !== lastIdx \|\| rows\.length > 1\) \{/,
    'the content-based (non-A4-forcing) branch must run for every row once there is more than one page-row, including the last'
  );
});

test('antcv-sidebar-fill-equalize-227.js: the old "only non-last rows get content-sized" condition is gone', () => {
  assert.equal(
    /if \(idx !== lastIdx\) \{/.test(equalizeSrc),
    false,
    'the stale idx!==lastIdx-only gate must not still exist — it stretched the last row\'s sidebar to the forced A4 box height'
  );
});

test('single-page documents keep the deliberate A4 look (no regression for the trivial case)', () => {
  // rows.length === 1 implies idx === lastIdx === 0 for the only row, so both
  // files must still take their "full A4" branch in that case.
  assert.match(pageFitSrc, /rows\.length === 1/);
  assert.match(equalizeSrc, /rows\.length > 1/);
});
