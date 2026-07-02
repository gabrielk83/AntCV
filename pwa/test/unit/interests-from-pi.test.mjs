// interests-from-pi.test.mjs
// ============================================================
// INTERESTS-FROM-PI-001 (owner 2026-07-03, Anita demo): the only interests
// injectors were Gabriel-name-guarded, so other candidates kept the template
// placeholder while their real interests sat in personalInfo.interests and an
// ADDITIONAL "Hobbies" row (preview showed the placeholder, export dropped it).
// 415 now fills INTERESTS generically from the candidate's OWN pi.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-sections-normalize-415.js', import.meta.url), 'utf8');

function run(sections, pi) {
  const store = new Map([
    ['sections', JSON.stringify(sections)],
    ['doc', JSON.stringify('cv')],
    ['personalInfo', JSON.stringify(pi || {})],
  ]);
  const sandbox = {
    window: { addEventListener() {}, dispatchEvent() { return true; } },
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    console: { info() {}, warn() {}, log() {}, error() {}, debug() {} },
    setTimeout() { return 0; }, clearTimeout() {}, setInterval() { return 0; },
    CustomEvent: function (t, o) { this.type = t; Object.assign(this, o); },
    JSON, Array, Object, Error, RegExp, Math, String, Number, Boolean, isFinite, parseInt, parseFloat, Date,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  sandbox.window.AntcvSectionsNormalize._normalize();
  return JSON.parse(store.get('sections'));
}

const REAL_EXP = { id: 'experience', type: 'experience', loc: 'main', on: true, roles: [
  { id: 'r1', title: 'Operations Planner', company: 'Hill & Colony', on: true, bullets: ['Coordinated routes.'] },
] };
const ANITA_PI = { name: 'Anita Myre-Kornfeldt', interests: [
  { l: 'Seasonal preparedness', v: 'Planning stores and routes well ahead of winter' },
  { l: 'Hiking', v: 'Trail scouting and terrain mapping' },
] };

test('placeholder INTERESTS fills from pi.interests in the section shape (labeled_list)', () => {
  const out = run({ cv: [REAL_EXP,
    { id: 'interests', title: 'INTERESTS', loc: 'sidebar', on: true, type: 'labeled_list', items: [{ l: '[Interest]', v: '[one-line detail - a few real interests...]' }] },
  ], cl: [] }, ANITA_PI);
  const ints = out.cv.find((s) => s.id === 'interests');
  assert.equal(ints.items.length, 2);
  assert.equal(ints.items[0].l, 'Seasonal preparedness');
});

test('ADDITIONAL Hobbies row moves into INTERESTS; emptied umbrella header dropped', () => {
  const out = run({ cv: [REAL_EXP,
    { id: 'interests', title: 'INTERESTS', loc: 'sidebar', on: true, type: 'labeled_list', items: [{ l: '[Interest]', v: '[detail]' }] },
    { id: 'additional', title: 'ADDITIONAL INFORMATION', loc: 'sidebar', on: true, type: 'rich_block', items: [
      { grp: true, t: 'Interests' },
      { b: 'Hobbies', t: 'Long-distance walking, weather logging, dried-grain photography' },
      { b: 'Volunteer', t: 'Mentorship programme' },
    ] },
  ], cl: [] }, ANITA_PI);
  const ints = out.cv.find((s) => s.id === 'interests');
  const addl = out.cv.find((s) => s.id === 'additional');
  assert.ok(ints.items.some((it) => /Hobbies/i.test(it.l || it.b || '')), 'Hobbies moved into INTERESTS');
  assert.ok(!addl.items.some((it) => /hobbies/i.test(String(it.b || it.l || ''))), 'Hobbies removed from ADDITIONAL');
  assert.ok(!addl.items.some((it) => it.grp && /interests/i.test(String(it.t || ''))), 'emptied Interests umbrella dropped');
  assert.ok(addl.items.some((it) => /Volunteer/.test(String(it.b || ''))), 'unrelated additional rows kept');
});

test('still-empty INTERESTS hides on a real CV (no pi interests, nothing to absorb)', () => {
  const out = run({ cv: [REAL_EXP,
    { id: 'interests', title: 'INTERESTS', loc: 'sidebar', on: true, type: 'labeled_list', items: [{ l: '[Interest]', v: '[detail]' }] },
  ], cl: [] }, { name: 'Someone Else' });
  assert.equal(out.cv.find((s) => s.id === 'interests').on, false);
});

test('real interests already present: untouched (idempotent, no pi overwrite)', () => {
  const items = [{ l: 'Reading', v: 'Operations case studies' }];
  const out = run({ cv: [REAL_EXP,
    { id: 'interests', title: 'INTERESTS', loc: 'sidebar', on: true, type: 'labeled_list', items },
  ], cl: [] }, ANITA_PI);
  const ints = out.cv.find((s) => s.id === 'interests');
  assert.equal(ints.items.length, 1);
  assert.equal(ints.items[0].l, 'Reading');
});
