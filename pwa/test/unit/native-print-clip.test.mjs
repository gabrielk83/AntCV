// native-print-clip.test.mjs
// ============================================================
// NATIVE-PRINT-CLIP-001 (owner 2026-07-04, live report): a phone's native
// "Print" / "Save as PDF" (menu-driven, not the in-app print button) showed
// only "1 of 1" pages for a multi-page CV. Root cause: the v113 mobile rule
// in antcv-mobile-controls.css pins html/body/#root to height:100dvh +
// overflow:hidden so the in-app preview starts at the paper instead of a
// huge scrollable grey field — correct on-screen, but it also clips
// content out of the native print render, which lays out the live DOM
// rather than going through the app's own iframe-clone print path
// (antcv-print-iframe-preview.js, which only intercepts script-invoked
// window.print()). This is a source-level regression lock (no browser
// needed) proving the print-media undo exists and targets the same
// selectors the v113 rule clips.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../../antcv-mobile-controls.css', import.meta.url), 'utf8');

const v113Index = css.indexOf('v113: preview viewport must start at the paper');
const printFixIndex = css.indexOf('NATIVE-PRINT-CLIP-001');

test('the v113 mobile clip rule (root cause) is present', () => {
  assert.ok(v113Index !== -1, 'v113 block must still exist (on-screen behavior is intentional)');
});

test('a NATIVE-PRINT-CLIP-001 fix block exists, after the v113 rule it undoes', () => {
  assert.ok(printFixIndex !== -1, 'print-clip fix block must be present');
  assert.ok(printFixIndex > v113Index, 'the fix must come after (and thus win the cascade over) v113');
});

test('the fix is scoped to @media print and resets html/body/#root overflow+height', () => {
  const block = css.slice(printFixIndex, printFixIndex + 1200);
  const printBlockMatch = block.match(/@media print\s*\{([\s\S]*?)\n\}/);
  assert.ok(printBlockMatch, 'must contain an @media print block');
  const body = printBlockMatch[1];
  assert.match(body, /html,\s*body,\s*#root\s*\{[^}]*overflow:\s*visible\s*!important/, 'must reset overflow to visible for print');
  assert.match(body, /html,\s*body,\s*#root\s*\{[^}]*height:\s*auto\s*!important/, 'must reset height to auto for print');
});

test('the print override also relaxes .antcv-preview-scroll (not just the root)', () => {
  const block = css.slice(printFixIndex, printFixIndex + 1200);
  assert.match(block, /\.antcv-preview-scroll\s*\{[^}]*overflow:\s*visible\s*!important/, '.antcv-preview-scroll must also be un-clipped for print');
});

test('the print override is NOT nested inside a max-width media query (must apply whenever printing)', () => {
  // The @media print block must not appear inside another @media (...) block —
  // i.e. there is no unclosed "@media (max-width" between v113's closing brace
  // and the print fix's own @media print declaration.
  const between = css.slice(v113Index, printFixIndex);
  const opens = (between.match(/@media \(max-width/g) || []).length;
  const closesAfterLastOpen = between.slice(between.lastIndexOf('@media (max-width')).match(/\n\}/g) || [];
  assert.ok(opens === 0 || closesAfterLastOpen.length >= 1, 'the max-width block containing v113 must be closed before the @media print fix begins');
});
