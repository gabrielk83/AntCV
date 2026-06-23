// core-comp-compress-coord.test.mjs
// ============================================================
// BANNED-SHORTENING (owner 2026-06-23): antcv-core-comp-compress.js abbreviated
// "Coordination" -> "Coord." in CORE COMPETENCIES / WHAT I BRING focus labels.
// The owner banned that shortening AND it caused an edit-revert bug (the sidecar
// re-abbreviated the owner's manual expansion on the next sections-updated). Fix:
// drop the Coordination->Coord. abbreviation and EXPAND any pre-existing "Coord."
// back to "Coordination". Other abbreviations (Docs/Reqs/Mgmt) and the per-doc
// expertise caps are kept. Loads the real sidecar in a vm sandbox.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-core-comp-compress.js', import.meta.url), 'utf8');

function load(sections) {
  const store = new Map(Object.entries({ sections: JSON.stringify(sections) }));
  const sandbox = {
    window: { addEventListener() {}, dispatchEvent() { return true; } },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    console: { warn() {}, log() {}, error() {} },
    setTimeout() { return 0; }, setInterval() { return 0; },
    CustomEvent: function (t, o) { this.type = t; Object.assign(this, o); },
    JSON, Array, Object, Error, RegExp, Math, String, Number, Boolean,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return { api: sandbox.window.AntcvCoreCompCompress, store };
}
const H = ['Focus Area', 'Strategic Expertise'];
function runOn(rows, id = 'core_comp', doc = 'cv') {
  const sec = { id, type: 'table', title: id === 'bring' ? 'WHAT I BRING' : 'CORE COMPETENCIES', rows };
  const sections = doc === 'cv' ? { cv: [sec], cl: [] } : { cv: [], cl: [sec] };
  const { api, store } = load(sections);
  api.run();
  const out = JSON.parse(store.get('sections'));
  return (doc === 'cv' ? out.cv : out.cl)[0].rows;
}

test('does NOT abbreviate Coordination to "Coord."', () => {
  const { api } = load({ cv: [], cl: [] });
  assert.equal(api._abbr('Technical team Coordination'), 'Technical team Coordination');
});

test('EXPANDS an existing "Coord." back to "Coordination"', () => {
  const { api } = load({ cv: [], cl: [] });
  assert.equal(api._expand('Technical team Coord.'), 'Technical team Coordination');
  assert.equal(api._expand('Cross-Discipline Coord'), 'Cross-Discipline Coordination');
});

test('expand never touches Coordinator / Coordinate / Coordinated / Coordination', () => {
  const { api } = load({ cv: [], cl: [] });
  for (const w of ['Coordinator', 'Coordinate', 'Coordinated', 'Coordinates', 'Coordination', 'Coordinating']) {
    assert.equal(api._expand('Lead ' + w), 'Lead ' + w, w);
  }
});

test('other abbreviations are KEPT (Docs/Reqs/Mgmt)', () => {
  const { api } = load({ cv: [], cl: [] });
  assert.equal(api._abbr('Documentation & Requirements Management'), 'Docs & Reqs Mgmt');
});

test('run() expands "Coord." in a CORE COMPETENCIES focus label', () => {
  const rows = runOn([H, ['Technical team Coord.', 'optics, firmware, validation']]);
  assert.equal(rows[1][0], 'Technical team Coordination');
});

test('run() expands "Coord." in a WHAT I BRING focus label too', () => {
  const rows = runOn([H, ['Cross-Discipline Coord.', 'bridging engineering and suppliers']], 'bring', 'cl');
  assert.equal(rows[1][0], 'Cross-Discipline Coordination');
});

test('idempotent: a second run makes no further change', () => {
  const once = runOn([H, ['Technical team Coord.', 'x']]);
  const twice = runOn(once);
  assert.deepEqual(twice, once);
});

test('header row 0 is never modified', () => {
  const rows = runOn([H, ['Coord.', 'y']]);
  assert.deepEqual(rows[0], H);
});
