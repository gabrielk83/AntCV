// empty-optional-leak.test.mjs
// ============================================================
// EMPTY-OPTIONAL-LEAK-001 (owner 2026-07-03, Anita demo): a blank education item
// rendered a lone "[Degree]" row; empty RECOMMENDATIONS/ACCESSIBILITY printed
// placeholders on a real CV. 415 drops the empty education items and hides the
// empty optional sections — but never in the wizard/template (sparse) state.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-sections-normalize-415.js', import.meta.url), 'utf8');

function load(sections) {
  const store = new Map([['sections', JSON.stringify(sections)], ['doc', JSON.stringify('cv')]]);
  const sandbox = {
    window: { addEventListener() {}, dispatchEvent() { return true; } },
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    console: { info() {}, warn() {}, log() {}, error() {} },
    setTimeout() { return 0; }, clearTimeout() {}, setInterval() { return 0; },
    CustomEvent: function (t, o) { this.type = t; Object.assign(this, o); },
    JSON, Array, Object, Error, RegExp, Math, String, Number, Boolean, isFinite, parseInt, parseFloat, Date,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return { api: sandbox.window.AntcvSectionsNormalize, store, sandbox };
}
function run(sections) {
  const { store, sandbox } = load(sections);
  // the sidecar exposes its run on window; find a callable
  const api = sandbox.window.AntcvSectionsNormalize || {};
  const fn = api._normalize;
  if (typeof fn === 'function') fn();
  return JSON.parse(store.get('sections'));
}

const REAL_EXP = { id: 'experience', type: 'experience', loc: 'main', on: true, roles: [
  { id: 'r1', title: 'Senior Grain Storage Coordinator', company: 'Northfield Cooperative', on: true, bullets: ['Managed seasonal food storage planning.'] },
] };

test('empty education item is dropped when a real one exists', () => {
  const out = run({ cv: [REAL_EXP, { id: 'education', type: 'education', loc: 'sidebar', on: true, items: [
    { deg: '', sch: '' },
    { deg: 'MBA - Technion', sch: 'Strategy, Finance' },
  ] }], cl: [] });
  const edu = out.cv.find((s) => s.id === 'education');
  assert.equal(edu.items.length, 1);
  assert.match(edu.items[0].deg, /MBA/);
});

test('template education (all placeholders) is untouched', () => {
  const items = [{ deg: '[Degree / programme]', sch: '[Institution]' }];
  const out = run({ cv: [{ id: 'education', type: 'education', loc: 'sidebar', on: true, items }], cl: [] });
  assert.equal(out.cv.find((s) => s.id === 'education').items.length, 1);
});

test('empty RECOMMENDATIONS + ACCESSIBILITY hide on a REAL cv (hide-over-delete)', () => {
  const out = run({ cv: [
    REAL_EXP,
    { id: 'recommendations', title: 'RECOMMENDATIONS', type: 'labeled_list', loc: 'main', on: true, items: [{ l: '[References]', v: '[available on request - or list your referees here]' }] },
    { id: 'accessibility', title: 'ACCESSIBILITY', type: 'text', loc: 'sidebar', on: true, content: '[ACCESSIBILITY - optional. ...]' },
  ], cl: [] });
  assert.equal(out.cv.find((s) => s.id === 'recommendations').on, false);
  assert.equal(out.cv.find((s) => s.id === 'accessibility').on, false);
});

test('REAL recommendations/accessibility content stays visible', () => {
  const out = run({ cv: [
    REAL_EXP,
    { id: 'recommendations', title: 'RECOMMENDATIONS', type: 'labeled_list', loc: 'main', on: true, items: [{ l: 'Marta Hyllevang', v: 'Head of Storage Operations — available on request' }] },
    { id: 'accessibility', title: 'ACCESSIBILITY', type: 'text', loc: 'sidebar', on: true, content: 'Prefers asynchronous reviews over live meetings.' },
  ], cl: [] });
  assert.notEqual(out.cv.find((s) => s.id === 'recommendations').on, false);
  assert.notEqual(out.cv.find((s) => s.id === 'accessibility').on, false);
});

test('wizard/template state (no real roles): optional sections stay visible', () => {
  const out = run({ cv: [
    { id: 'experience', type: 'experience', loc: 'main', on: true, roles: [{ id: 'r1', title: '[Role title]', company: '[Company name]', on: true, bullets: [] }] },
    { id: 'recommendations', title: 'RECOMMENDATIONS', type: 'labeled_list', loc: 'main', on: true, items: [{ l: '[References]', v: '[available on request]' }] },
  ], cl: [] });
  assert.notEqual(out.cv.find((s) => s.id === 'recommendations').on, false);
});
