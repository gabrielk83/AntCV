// group-header-manual-break.test.mjs
// ============================================================
// GROUP-HEADER-MANUAL-BREAK-001 (owner 2026-06-25): a MANUAL page-break on a rich_block group's
// FIRST content row must pull the group HEADING (the preceding {grp} item) to the same page, so the
// header travels with its rows instead of being orphaned on the previous page. A break on a MIDDLE
// row of a group must NOT pull the header (it is a legitimate mid-group break).
//
// Extracts the REAL `__antcvSnapManualToGroup` helper from app.src.js (brace-matched) and evaluates
// it in a vm sandbox with a Map-backed localStorage seeded with sections, so the test tracks the
// shipped source.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../app.src.js', import.meta.url), 'utf8');

// Pull out the arrow function `(sid, manual) => { ... }` by brace-matching from its declaration.
const decl = 'const __antcvSnapManualToGroup = ';
const start = src.indexOf(decl);
if (start < 0) throw new Error('__antcvSnapManualToGroup not found in app.src.js');
const arrowStart = src.indexOf('=>', start) + 2;
const braceOpen = src.indexOf('{', arrowStart);
let depth = 0, i = braceOpen, end = -1;
for (; i < src.length; i++) {
  const ch = src[i];
  if (ch === '{') depth++;
  else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
}
const fnText = '(sid, manual) => ' + src.slice(braceOpen, end + 1);

function makeFn(sections) {
  const store = new Map([['sections', JSON.stringify(sections)]]);
  const sandbox = {
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null) },
    JSON, Object, Array, String, parseInt, Number, Boolean,
  };
  vm.createContext(sandbox);
  return vm.runInContext('(' + fnText + ')', sandbox);
}

// A regulatory-style grouped rich_block: header, two rows, header, two rows.
const grouped = {
  id: 'regulatory', type: 'rich_block', loc: 'sidebar',
  items: [
    { grp: 'Imaging', t: 'Imaging' },        // 0 header
    { b: 'EN 62471', t: 'photobiological safety' }, // 1 first content row of Imaging
    { b: 'IEC 60825', t: 'laser safety' },          // 2
    { grp: 'Environmental', t: 'Environmental' },   // 3 header
    { b: 'RoHS', t: 'restricted substances' },      // 4 first content row of Environmental
    { b: 'REACH', t: 'chemical compliance' },       // 5
  ],
};

test('manual break on a group FIRST content row pulls the group header to that page', () => {
  const fn = makeFn({ cv: [grouped], cl: [] });
  const out = fn('regulatory', { '4': 3 });            // break on Environmental's first row -> page 3
  assert.equal(out['3'], 3, 'the Environmental header (index 3) is pulled to page 3');
  assert.equal(out['4'], 3, 'the first content row keeps its manual page');
});

test('manual break on a MIDDLE row of a group does NOT pull the header', () => {
  const fn = makeFn({ cv: [grouped], cl: [] });
  const out = fn('regulatory', { '5': 3 });            // break on Environmental's SECOND row
  assert.equal(out['3'], undefined, 'header not pulled (mid-group break is legitimate)');
  assert.equal(out['5'], 3);
});

test('no manual break (>=2) returns the map unchanged (cheap no-op)', () => {
  const fn = makeFn({ cv: [grouped], cl: [] });
  const map = { '4': 1 };
  const out = fn('regulatory', map);
  assert.equal(out, map, 'same reference returned when nothing to snap');
});

test('flat rich_block (no groups) is never modified', () => {
  const flat = { id: 'certs', type: 'rich_block', items: [ { b: 'A', t: 'a' }, { b: 'B', t: 'b' }, { b: 'C', t: 'c' } ] };
  const fn = makeFn({ cv: [flat], cl: [] });
  const out = fn('certs', { '2': 2 });
  assert.equal(out['1'], undefined);
  assert.equal(out['2'], 2);
});

test('hidden row between header and first VISIBLE content row still pulls the header', () => {
  const withHidden = {
    id: 'regulatory', type: 'rich_block',
    items: [
      { grp: 'Environmental', t: 'Environmental' }, // 0 header
      { b: 'RoHS', t: 'restricted substances' },     // 1 hidden
      { b: 'REACH', t: 'chemical compliance' },       // 2 first VISIBLE content row
    ],
    hidden: { 1: true },
  };
  const fn = makeFn({ cv: [withHidden], cl: [] });
  const out = fn('regulatory', { '2': 2 });
  assert.equal(out['0'], 2, 'header pulled across the hidden row to the first visible content row page');
});
