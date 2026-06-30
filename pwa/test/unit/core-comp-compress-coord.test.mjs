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

test('other abbreviations are KEPT (Docs/Reqs); Management is NOT abbreviated', () => {
  const { api } = load({ cv: [], cl: [] });
  // Management -> Mgmt removed (owner 2026-06-30: "use the full word management").
  assert.equal(api._abbr('Documentation & Requirements Management'), 'Docs & Reqs Management');
});

test('expand: a stored "Mgmt" is restored to the full word "Management"', () => {
  const { api } = load({ cv: [], cl: [] });
  assert.equal(api._expand('Quality Mgmt'), 'Quality Management');
  assert.equal(api._expand('Project Mgmt.'), 'Project Management');
});

// FOCUS-TIGHTEN (owner 2026-06-26): expand "Coord." to the full word AND keep the label under the
// <=25 Focus-Area cap by writing it concisely — drop a redundant "team" before Coordination ("use
// better sentences, e.g. 'Project team Coordination' -> 'Project Coordination'"), not truncate.
test('tighten: drops redundant "team" before a Coordination noun', () => {
  const { api } = load({ cv: [], cl: [] });
  assert.equal(api._tighten('Project team Coordination'), 'Project Coordination');
  assert.equal(api._tighten('Technical team Coord.'), 'Technical Coord.');
});

test('tighten leaves "team" alone when not before a Coordination noun', () => {
  const { api } = load({ cv: [], cl: [] });
  assert.equal(api._tighten('Cross-functional team leadership'), 'Cross-functional team leadership');
});

test('run() expands "Coord." + tightens in a CORE COMPETENCIES focus label (fits <=25)', () => {
  const rows = runOn([H, ['Technical team Coord.', 'optics, firmware, validation']]);
  assert.equal(rows[1][0], 'Technical Coordination');
  assert.ok(rows[1][0].length <= 25);
});

test('run() expands "Coord." + tightens in a WHAT I BRING focus label too (owner example)', () => {
  const rows = runOn([H, ['Project team Coord.', 'bridging engineering and suppliers']], 'bring', 'cl');
  assert.equal(rows[1][0], 'Project Coordination');
  assert.ok(rows[1][0].length <= 25);
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
