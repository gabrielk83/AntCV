// core-comp-format-preserves-outcomes.test.mjs
// ============================================================
// SO-003 (register row 40) TRIGGER-SIDE guard.
//
// The register's belt test (outcomes-loss-guard.test.mjs) covers RECOVERY:
// given an already-emptied outcomes section, the snapshot restores it. Nothing
// covered the other half — that the core_comp writers never empty it in the
// first place. Re-diagnosed 2026-08-21 (desktop nightly): row 40 has been
// SHIPPED since 1.51.138 and no deterministic writer drops the sibling, but
// that is a property of the current code, not a pinned invariant. A future
// refactor of applySectionFormat from an id-scoped map into a whole-array
// rebuild would silently re-open SO-003 with the belt as the only thing
// standing between the owner and the data loss.
//
// This pins the invariant at the writer the owner's original report named —
// the advanced style menu (Settings > Layout > SECTION FORMATS), which is
// AntcvFormatPrefs.setFormat and is a real, loadable sidecar. Loads it in a vm
// sandbox with a shimmed localStorage, the same pattern as the belt test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-format-prefs.js', import.meta.url), 'utf8');

const OUTCOMES_ITEMS = [
  { b: 'Cut', t: 'validation cycle from 250 to 10 days (95% reduction)' },
  { b: 'Ran', t: 'two ISO re-certifications with zero findings' },
  { b: 'Built', t: 'the optics characterization lab from scratch' },
];

// A 3-row core_comp table, the shape the owner's report started from.
const coreComp = (rows) => ({
  id: 'core_comp',
  title: 'Core Competencies',
  type: 'table',
  rows: rows.map((r, i) => [r, 'value ' + (i + 1)]),
});

const seedSections = () => ({
  cv: [
    { id: 'profile', type: 'paragraph', content: 'Electro-optics engineer and team leader.' },
    coreComp(['Strategic Expertise', 'Technical Depth', 'Delivery']),
    { id: 'outcomes', title: 'Selected Outcomes', type: 'bullets', items: OUTCOMES_ITEMS },
  ],
  cl: [],
});

function makeSandbox() {
  const store = new Map();
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const CustomEventShim = function (type, init) { this.type = type; this.detail = init && init.detail; };
  const StorageEventShim = function (type, init) { Object.assign(this, init || {}); this.type = type; };
  const events = [];
  const sandbox = {
    window: {
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent(e) { events.push(e); return true; },
      CustomEvent: CustomEventShim,
      StorageEvent: StorageEventShim,
      matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    },
    document: {
      readyState: 'complete',
      addEventListener() {},
      querySelector: () => null,
      querySelectorAll: () => [],
      createTreeWalker: () => ({ nextNode: () => null }),
      createElement: () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, appendChild() {}, setAttribute() {}, addEventListener() {} }),
      body: { appendChild() {}, contains: () => false },
      head: { appendChild() {} },
    },
    localStorage,
    CustomEvent: CustomEventShim,
    StorageEvent: StorageEventShim,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
    console: { warn() {}, debug() {}, log() {}, error() {}, info() {} },
    NodeFilter: { SHOW_TEXT: 4, SHOW_ELEMENT: 1 },
    MutationObserver: function () { this.observe = () => {}; this.disconnect = () => {}; },
    JSON, Array, Object, Error, RegExp, Math, String, Number, Boolean, Date, Set, Map,
  };
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return {
    api: sandbox.window.AntcvFormatPrefs,
    events,
    setSections: (s) => store.set('sections', JSON.stringify(s)),
    sections: () => JSON.parse(store.get('sections') || 'null'),
  };
}

const outcomesOf = (secs) => (secs.cv || []).find((s) => s && s.id === 'outcomes');

// The formats the panel can put a section into. core_comp is deliberately kept
// off the bullets/table flip switches, but setFormat is a public API and the
// invariant must hold for anything it is handed.
const FORMATS = ['paragraph', 'bullets', 'emoji_bullets', 'hybrid_1', 'hybrid_2', 'hybrid_3', 'table'];

test('AntcvFormatPrefs is loadable and exposes setFormat', () => {
  const h = makeSandbox();
  assert.equal(typeof h.api, 'object', 'sidecar defined window.AntcvFormatPrefs');
  assert.equal(typeof h.api.setFormat, 'function', 'setFormat is the applySectionFormat writer');
});

for (const fmt of FORMATS) {
  test(`setFormat('core_comp', '${fmt}') leaves Selected Outcomes byte-identical`, () => {
    const h = makeSandbox();
    h.setSections(seedSections());
    const before = JSON.stringify(outcomesOf(seedSections()));

    h.api.setFormat('core_comp', fmt);

    const after = h.sections();
    assert.ok(after, 'sections blob still present');
    const out = outcomesOf(after);
    assert.ok(out, `outcomes section survived a core_comp -> ${fmt} change`);
    assert.equal(JSON.stringify(out), before, 'outcomes section is byte-identical');
    assert.equal((out.items || []).length, OUTCOMES_ITEMS.length, 'no outcome item was dropped');
  });
}

test('setFormat on core_comp does not drop any sibling section', () => {
  const h = makeSandbox();
  h.setSections(seedSections());
  h.api.setFormat('core_comp', 'bullets');
  const ids = (h.sections().cv || []).map((s) => s.id);
  assert.deepEqual(ids, ['profile', 'core_comp', 'outcomes'], 'section list is intact and ordered');
});

test('the writer is id-scoped — a non-core_comp section is untouched by a core_comp change', () => {
  const h = makeSandbox();
  h.setSections(seedSections());
  const profileBefore = JSON.stringify(seedSections().cv[0]);
  h.api.setFormat('core_comp', 'emoji_bullets');
  assert.equal(JSON.stringify(h.sections().cv[0]), profileBefore, 'profile untouched');
});
