// core-comp-dangling.test.mjs
// ============================================================
// DANGLING-CONNECTOR-001 (2026-11-06, #3527 PEAK Wind live export): the <=25
// Focus Area cap cut "Client projects & delivery" at a word boundary to
// "Client projects &" (and "Digital products &"). The cut now drops a trailing
// connector, and a label already stored that way is repaired once. Loads the real
// sidecar in a vm sandbox (same shape as core-comp-compress-eo.test.mjs).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-core-comp-compress.js', import.meta.url), 'utf8');

function load(sections) {
  const store = new Map([['sections', JSON.stringify(sections)], ['personalInfo', JSON.stringify({ name: 'Anita Example' })]]);
  let events = 0;
  const sandbox = {
    window: { addEventListener() {}, dispatchEvent() { events++; return true; } },
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    console: { warn() {}, log() {}, error() {} },
    setTimeout() { return 0; }, setInterval() { return 0; },
    CustomEvent: function (t, o) { this.type = t; Object.assign(this, o); },
    JSON, Array, Object, Error, RegExp, Math, String, Number, Boolean,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return { api: sandbox.window.AntcvCoreCompCompress, store, events: () => events };
}
const table = (rows) => ({ cv: [{ id: 'core_comp', type: 'table', title: 'CORE COMPETENCIES', rows: [['The role needs', 'What I bring, with proof']].concat(rows) }], cl: [] });

test('the 25-char cut never ends on a connector', () => {
  const { api } = load(table([]));
  assert.equal(api._cap('Client projects & delivery', 25), 'Client projects');
  assert.equal(api._cap('Digital products & services', 25), 'Digital products');
  assert.equal(api._cap('Risk, planning and reporting', 25), 'Risk, planning');
  assert.equal(api._cap('Planning and stakeholder alignment', 25), 'Planning and stakeholder', 'a cut that ends on a content word stays');
  assert.equal(api._cap('Delivery governance', 25), 'Delivery governance', 'a label that fits is untouched');
});

test('a label stored with a dangling "&" is repaired once, then left alone', () => {
  const { api, store, events } = load(table([['Client projects &', 'Own and coordinate from initial need through delivery'], ['Reqs & delivery plans', 'Translate needs into work packages']]));
  api.run();
  const rows = JSON.parse(store.get('sections')).cv[0].rows;
  assert.equal(rows[1][0], 'Client projects');
  assert.equal(rows[2][0], 'Reqs & delivery plans', 'an inner "&" stays');
  const n = events();
  api.run();
  assert.equal(events(), n, 'idempotent: the second pass writes nothing');
});
