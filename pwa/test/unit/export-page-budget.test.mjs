// EXPORT-PAGE-BUDGET-001 (owner 2026-10-01 "the LibreOffice/Word page budget"): the coordinator costs a block
// by its SPAN (own height + the gap above it in the same page-box column, capped), so section headings and gaps
// count; the page-1 budgets are calibrated on real Word + LibreOffice exports.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = fs.readFileSync(path.join(dir, 'antcv-auto-pagebreak-block-001.js'), 'utf8');

test('blocks record their page-box column (rows, roles, table rows)', () => {
  assert.equal(src.split('              col: c,\n').length - 1 + src.split('              col: c,\r\n').length - 1, 3);
});

test('span cost: own height + capped gap from the running bottom of the same column box', () => {
  const m = /var __runBottom = \{\};[\s\S]*?ordered\.forEach\(function \(b\) \{ var gk = __groupOf\(b\.sid, b\.key\); grpTot\[gk\] = \(grpTot\[gk\] \|\| 0\) \+ b\.__h; \}\);/.exec(src);
  assert.ok(m, 'span pre-pass feeds the keep-whole group totals');
  // replay the pre-pass on a column: heading gap counted, overlap adds only what sticks out, new box starts fresh
  const SPAN_GAP_MAX = 90;
  const ordered = [
    { col: 0, top: 20, bottom: 100 },   // first block of box 0: no gap -> 80
    { col: 0, top: 150, bottom: 180 },  // 50 px heading gap -> 80
    { col: 0, top: 160, bottom: 200 },  // overlaps (nested): only 20 sticks out
    { col: 0, top: 500, bottom: 520 },  // 300 px slack: gap capped at 90 -> 110
    { col: 1, top: 30, bottom: 60 },    // next page box: fresh -> 30
  ];
  const body = /var __runBottom = \{\};\s*(ordered\.forEach\(function \(b\) \{[\s\S]*?\}\);)/.exec(src)[1];
  new Function('ordered', 'SPAN_GAP_MAX', 'var __runBottom = {};' + body)(ordered, SPAN_GAP_MAX);
  assert.deepEqual(ordered.map((b) => b.__h), [80, 80, 20, 110, 30]);
  assert.ok(/var h = b\.__h;/.test(src), 'the greedy fill uses the span cost');
});

test('page-1 budgets: main bonus 0, sidebar band 230, gap cap 90', () => {
  assert.ok(/var MAIN_PDF_LINE_BONUS = 0;/.test(src));
  assert.ok(/var SIDEBAR_PAGE1_BAND = 230;/.test(src));
  assert.ok(/var SPAN_GAP_MAX = 90;/.test(src));
});

test('one-time re-plan per budget revision (sticky maps of the open application)', () => {
  assert.ok(/var BUDGET_REV = '2026-10-01-span';/.test(src));
  const i = src.indexOf("localStorage.getItem('antcv:autoPagesRev') !== BUDGET_REV");
  assert.ok(i > 0 && src.indexOf('localStorage.removeItem(AUTO_KEY);', i) > i && src.indexOf('localStorage.removeItem(PREVIEW_KEY);', i) > i);
  assert.ok(src.indexOf('var AUTO_KEY') < i && src.indexOf('var PREVIEW_KEY') < i, 'keys declared before use');
});
