/* subsection-reorder.test.mjs — SUBSECTION-RENAME-REORDER-001 (item #3)
 * The pure block-move: a subsection = a {group} row + its following {l,v} rows up
 * to the next {group}. Moving a subsection up/down must move the WHOLE block and
 * preserve every other row + any preamble (rows before the first group).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = readFileSync(path.join(ROOT, 'antcv-subsection-reorder.js'), 'utf8');

globalThis.window = globalThis.window || {};
globalThis.document = { getElementById: () => null, querySelectorAll: () => [], documentElement: {}, head: { appendChild() {} }, createElement: () => ({ setAttribute() {}, appendChild() {}, addEventListener() {}, style: {} }) };
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const _st = globalThis.setTimeout; globalThis.setTimeout = () => 0;
globalThis.MutationObserver = function () { this.observe = () => {}; };
(0, eval)(SRC);
globalThis.setTimeout = _st;

const move = globalThis.window.__antcvSubsectionReorderMove || (globalThis.window.AntcvSubsectionReorder && globalThis.window.AntcvSubsectionReorder._move);
assert.ok(typeof move === 'function', 'exposed moveBlock');

const ITEMS = [
  { group: 'Systems & Safety' }, { l: 'ASPICE', v: 'Reqs' }, { l: 'ISO 26262', v: 'Safety' },
  { group: 'Electrical & EMC' }, { l: 'CISPR 25', v: 'Emissions' },
  { group: 'Optics' }, { l: 'ISO 12233', v: 'Resolution' }, { l: 'EMVA 1288', v: 'Sensor' },
];
const groups = (a) => a.filter((r) => r.group !== undefined).map((r) => r.group);

test('move a middle subsection up swaps the whole block', () => {
  const out = move(ITEMS, 1, -1); // Electrical & EMC up
  assert.deepEqual(groups(out), ['Electrical & EMC', 'Systems & Safety', 'Optics']);
  // its value row rides along
  assert.deepEqual(out.slice(0, 2), [{ group: 'Electrical & EMC' }, { l: 'CISPR 25', v: 'Emissions' }]);
  assert.equal(out.length, ITEMS.length);
});

test('move the first subsection down', () => {
  const out = move(ITEMS, 0, 1);
  assert.deepEqual(groups(out), ['Electrical & EMC', 'Systems & Safety', 'Optics']);
  // Systems block (group + 2 rows) is now second, intact
  assert.deepEqual(out.slice(2, 5), [{ group: 'Systems & Safety' }, { l: 'ASPICE', v: 'Reqs' }, { l: 'ISO 26262', v: 'Safety' }]);
});

test('move the last subsection up', () => {
  const out = move(ITEMS, 2, -1);
  assert.deepEqual(groups(out), ['Systems & Safety', 'Optics', 'Electrical & EMC']);
});

test('out-of-range / no-op moves return null', () => {
  assert.equal(move(ITEMS, 0, -1), null); // first up
  assert.equal(move(ITEMS, 2, 1), null);  // last down
  assert.equal(move(ITEMS, 5, 1), null);  // bad ordinal
});

test('preamble rows (before the first group) are preserved', () => {
  const withPre = [{ l: 'Loose', v: 'Row' }].concat(ITEMS);
  const out = move(withPre, 0, 1); // Systems down past Electrical
  assert.deepEqual(out[0], { l: 'Loose', v: 'Row' }, 'preamble stays first');
  assert.deepEqual(groups(out), ['Electrical & EMC', 'Systems & Safety', 'Optics']);
});

test('no mutation of the input array', () => {
  const snap = JSON.stringify(ITEMS);
  move(ITEMS, 1, -1);
  assert.equal(JSON.stringify(ITEMS), snap);
});
