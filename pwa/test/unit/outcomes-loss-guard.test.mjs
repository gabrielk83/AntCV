// outcomes-loss-guard.test.mjs
// ============================================================
// SO-003 (register row 40, DATA LOSS): changing the CORE COMPETENCIES row count
// wipes SELECTED OUTCOMES (cloud-persisted, round-trips). antcv-outcomes-loss-
// guard.js snapshots the REAL outcomes items to a local-only key and re-applies
// them when a later sections state shows the outcomes section empty or
// placeholder-only.
//
// Loads the REAL sidecar in a vm sandbox with a shimmed localStorage and asserts:
// snapshot of real items, restore of an emptied (items:[]) / placeholder-only
// section, no-op over real items, no cross-application bleed, kill switch.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-outcomes-loss-guard.js', import.meta.url), 'utf8');

const REAL_ITEMS = [
  { b: 'Cut', t: 'validation cycle from 250 to 10 days (95% reduction)' },
  { b: 'Ran', t: 'two ISO re-certifications with zero findings' },
  { b: 'Built', t: 'the optics characterization lab from scratch' },
];
const PLACEHOLDER_ITEMS = [
  { b: '[Verb]', t: '[concrete, measurable outcome — name a result with a number or scope]' },
  { b: '[Verb]', t: '[concrete outcome 2]' },
];

function makeSandbox(initial) {
  const store = new Map();
  if (initial) for (const k of Object.keys(initial)) store.set(k, JSON.stringify(initial[k]));
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const clockBox = { now: 0 };
  const perf = { now: () => clockBox.now };
  const CustomEventShim = function (type, init) { this.type = type; this.detail = init && init.detail; };
  const sandbox = {
    window: { addEventListener() {}, dispatchEvent() { return true; }, performance: perf, CustomEvent: CustomEventShim },
    localStorage,
    performance: perf,
    CustomEvent: CustomEventShim,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    console: { warn() {}, debug() {}, log() {}, error() {}, info() {} },
    JSON, Array, Object, Error, RegExp, Math, String, Number, Boolean, Date,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return {
    sandbox, store, clockBox,
    api: sandbox.window.AntcvOutcomesGuard,
    sections: () => JSON.parse(store.get('sections') || '{}'),
    setSections: (s) => store.set('sections', JSON.stringify(s)),
    snapStore: () => JSON.parse(store.get('antcv:outcomesGuard') || '{}'),
    advanceClock: (ms) => { clockBox.now += ms; },
  };
}

function cv(items) {
  return { cv: [{ id: 'outcomes', type: 'bullets', title: 'SELECTED OUTCOMES', items }], cl: [] };
}

test('snapshot: a sections blob with REAL outcomes items is captured to the local store', () => {
  const ctx = makeSandbox({ meta: { company: 'Acme', role: 'PM' }, sections: cv(REAL_ITEMS) });
  ctx.api.snapshot();
  const snap = ctx.snapStore();
  assert.ok(snap['Acme|PM|en'], 'a bucket exists for the active application (language-keyed: LANG-GUARD-KEY-001)');
  assert.deepEqual(snap['Acme|PM|en'].items, REAL_ITEMS, 'the real items are stored verbatim');
});

test('restore: an emptied (items:[]) outcomes section is healed back to the real snapshot (the SO-003 wipe)', () => {
  const ctx = makeSandbox({ meta: { company: 'Acme', role: 'PM' }, sections: cv(REAL_ITEMS) });
  ctx.api.snapshot();          // capture the real items
  ctx.setSections(cv([]));     // core_comp resize race commits items:[]
  ctx.advanceClock(5000);      // clear the anti-loop window
  ctx.api.reapply();
  const out = ctx.sections().cv.find((s) => s.id === 'outcomes');
  assert.deepEqual(out.items, REAL_ITEMS, 'the emptied section is restored');
});

test('restore: a placeholder-only (skeleton) outcomes section is healed', () => {
  const ctx = makeSandbox({ meta: { company: 'Acme', role: 'PM' }, sections: cv(REAL_ITEMS) });
  ctx.api.snapshot();
  ctx.setSections(cv(PLACEHOLDER_ITEMS));
  ctx.advanceClock(5000);
  ctx.api.reapply();
  const out = ctx.sections().cv.find((s) => s.id === 'outcomes');
  assert.deepEqual(out.items, REAL_ITEMS, 'placeholder-only section restored to real items');
});

test('no-op: a section that still has real items is never clobbered by an older snapshot', () => {
  const ctx = makeSandbox({ meta: { company: 'Acme', role: 'PM' }, sections: cv(REAL_ITEMS) });
  ctx.api.snapshot();
  const NEWER = [{ b: 'Shipped', t: 'a new flagship result' }];
  ctx.setSections(cv(NEWER));
  ctx.advanceClock(5000);
  ctx.api.reapply();
  const out = ctx.sections().cv.find((s) => s.id === 'outcomes');
  assert.deepEqual(out.items, NEWER, 'real items left untouched');
});

test('no cross-application bleed: a Globex wipe is not healed from an Acme snapshot', () => {
  const ctx = makeSandbox({ meta: { company: 'Acme', role: 'PM' }, sections: cv(REAL_ITEMS) });
  ctx.api.snapshot();                                   // snapshot under Acme|PM
  ctx.store.set('meta', JSON.stringify({ company: 'Globex', role: 'BA' }));
  ctx.setSections(cv([]));                              // Globex outcomes emptied
  ctx.advanceClock(5000);
  ctx.api.reapply();
  const out = ctx.sections().cv.find((s) => s.id === 'outcomes');
  assert.deepEqual(out.items, [], 'no snapshot for Globex|BA -> stays empty (no bleed)');
});

test('kill switch blocks restore', () => {
  const ctx = makeSandbox({ meta: { company: 'Acme', role: 'PM' }, sections: cv(REAL_ITEMS) });
  ctx.api.snapshot();
  ctx.store.set('antcv:disable-outcomes-guard', '1'); // raw string as real localStorage stores it
  ctx.setSections(cv([]));
  ctx.advanceClock(5000);
  ctx.api.run();               // run() honours the kill switch (reapply() is called directly by tests, run() is the live entry)
  const out = ctx.sections().cv.find((s) => s.id === 'outcomes');
  assert.deepEqual(out.items, [], 'disabled -> no restore');
});

test('snapshot only stores REAL items (skeleton never captured)', () => {
  const ctx = makeSandbox({ meta: { company: 'Acme', role: 'PM' }, sections: cv(PLACEHOLDER_ITEMS) });
  ctx.api.snapshot();
  assert.deepEqual(ctx.snapStore(), {}, 'a placeholder-only section is not real -> nothing snapshotted');
});

test('pure helpers: isPlaceholderItem / isReal classify skeleton vs real', () => {
  const ctx = makeSandbox({});
  assert.equal(ctx.api._isPlaceholderItem({ b: '[Verb]', t: '[concrete outcome 2]' }), true);
  assert.equal(ctx.api._isPlaceholderItem({ b: 'Cut', t: 'cycle time by 95%' }), false);
  assert.equal(ctx.api._isPlaceholderItem(''), true);
  assert.equal(ctx.api._isReal({ items: REAL_ITEMS }), true);
  assert.equal(ctx.api._isReal({ items: PLACEHOLDER_ITEMS }), false);
  assert.equal(ctx.api._isReal({ items: [] }), false);
});
