// lang-fabrication-guard.test.mjs
// ============================================================
// GEN-LANGFAB-001 (register row 42): the generator fabricated a language absent
// from the kernel ("German") and got a level wrong (Danish). This belt reconciles
// the stored CV "languages" section against kernel personalInfo.languages
// ({lang,level}): drops non-kernel languages, corrects kept levels. Name-neutral,
// restore-safe, bidirectional-containment tolerant (no ping-pong with concise).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-lang-fabrication-guard.js', import.meta.url), 'utf8');

function load(store0) {
  const store = new Map(Object.entries(store0 || {}));
  const sandbox = {
    window: { addEventListener() {}, dispatchEvent() { return true; } },
    console: { log() {}, debug() {}, warn() {} },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    setTimeout() { return 0; },
    CustomEvent: function (t, o) { this.type = t; Object.assign(this, o); },
    JSON, Array, Object, Error, RegExp, Math, String, Number, Boolean,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return { api: sandbox.window.AntcvLangFabricationGuard, store };
}

// Kernel truth: Gabriel — EN/HE native, ES professional, DA B1, NO German.
const KERNEL = {
  personalInfo: JSON.stringify({ languages: [
    { lang: 'English', level: 'native' },
    { lang: 'Hebrew', level: 'native' },
    { lang: 'Spanish', level: 'full professional' },
    { lang: 'Danish', level: 'B1' },
  ] }),
};
const secsWith = (items) => ({ sections: JSON.stringify({ cv: [{ id: 'languages', title: 'LANGUAGES', type: 'labeled_list', items }], cl: [] }) });
const langItems = (store) => JSON.parse(store.get('sections')).cv[0].items;

test('drops a fabricated language absent from the kernel (German) and fixes wrong Danish level', () => {
  const items = [
    { l: 'English', v: 'native' },
    { l: 'Hebrew', v: 'native' },
    { l: 'Spanish', v: 'professional' },   // kernel "full professional" contains "professional" -> fixpoint
    { l: 'Danish', v: 'C1' },              // WRONG — kernel B1
    { l: 'German', v: 'A2' },              // FABRICATED — not in kernel
  ];
  const { api, store } = load(Object.assign({}, KERNEL, secsWith(items)));
  api.run();
  const out = langItems(store);
  const names = out.map((r) => r.l);
  assert.ok(!names.includes('German'), 'fabricated German must be dropped');
  const da = out.find((r) => r.l === 'Danish');
  assert.equal(da.v, 'B1', 'Danish level corrected to kernel B1');
  const es = out.find((r) => r.l === 'Spanish');
  assert.equal(es.v, 'professional', 'Spanish level left alone (contained in kernel level)');
});

test('rich_block shape {b,t} is handled the same way', () => {
  const items = [
    { b: 'English', t: 'native' },
    { b: 'Danish', t: 'fluent' },   // wrong — kernel B1
    { b: 'German', t: 'basic' },    // fabricated
  ];
  const { api, store } = load(Object.assign({}, KERNEL, secsWith(items)));
  api.run();
  const out = langItems(store);
  assert.ok(!out.some((r) => r.b === 'German'), 'German dropped in rich_block shape');
  assert.equal(out.find((r) => r.b === 'Danish').t, 'B1', 'Danish level corrected');
});

test('a level that already CONTAINS the kernel level is a fixpoint (no fight with languages-concise)', () => {
  const items = [{ l: 'Danish', v: 'intermediate (B1)' }, { l: 'English', v: 'native' }];
  const { api, store } = load(Object.assign({}, KERNEL, secsWith(items)));
  const before = store.get('sections');
  api.run();
  assert.equal(store.get('sections'), before, 'no rewrite when current level contains kernel level');
});

test('name-neutral: a different persona keeps its own kernel languages', () => {
  const anita = { personalInfo: JSON.stringify({ languages: [
    { lang: 'English', level: 'full professional' },
    { lang: 'Danish', level: 'native' },
  ] }) };
  const items = [
    { l: 'English', v: 'full professional' },
    { l: 'Danish', v: 'native' },
    { l: 'Spanish', v: 'B2' },   // fabricated for Anita
  ];
  const { api, store } = load(Object.assign({}, anita, secsWith(items)));
  api.run();
  const names = langItems(store).map((r) => r.l);
  assert.deepEqual(names, ['English', 'Danish'], 'Spanish (not in Anita kernel) dropped; no Gabriel hardcoding');
});

test('empty kernel languages -> no-op (never strip an unverifiable section)', () => {
  const items = [{ l: 'German', v: 'A2' }, { l: 'Klingon', v: 'native' }];
  const { api, store } = load(Object.assign({ personalInfo: JSON.stringify({ languages: [] }) }, secsWith(items)));
  const before = store.get('sections');
  api.run();
  assert.equal(store.get('sections'), before, 'no kernel truth -> leave section untouched');
});

test('kill-switch blocks reconciliation', () => {
  const s = Object.assign({ 'antcv:disable-lang-fabrication-guard': '1' }, KERNEL, secsWith([{ l: 'German', v: 'A2' }, { l: 'English', v: 'native' }]));
  const { api, store } = load(s);
  const before = store.get('sections');
  api.run();
  assert.equal(store.get('sections'), before);
});

test('idempotent: second run writes nothing', () => {
  const { api, store } = load(Object.assign({}, KERNEL, secsWith([
    { l: 'English', v: 'native' }, { l: 'Danish', v: 'C1' }, { l: 'German', v: 'A2' },
  ])));
  api.run();
  const after1 = store.get('sections');
  api.run();
  assert.equal(store.get('sections'), after1);
});

test('nested personalInfo.personalInfo wrap is read', () => {
  const wrapped = { personalInfo: JSON.stringify({ personalInfo: { languages: [{ lang: 'English', level: 'native' }] } }) };
  const { api, store } = load(Object.assign({}, wrapped, secsWith([{ l: 'English', v: 'native' }, { l: 'German', v: 'A2' }])));
  api.run();
  assert.ok(!langItems(store).some((r) => r.l === 'German'), 'German dropped even with nested PI wrap');
});

test('pure helpers: levelDiffers is bidirectional-containment tolerant', () => {
  const { api } = load({});
  assert.equal(api._levelDiffers('B1', 'B1'), false);
  assert.equal(api._levelDiffers('intermediate (B1)', 'B1'), false);
  assert.equal(api._levelDiffers('professional', 'full professional'), false);
  assert.equal(api._levelDiffers('C1', 'B1'), true);
  assert.equal(api._levelDiffers('anything', ''), false, 'no kernel level -> never differs');
});
