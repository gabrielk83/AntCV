// profile-disclosure-strip.test.mjs
// ============================================================
// PROFILE-NO-DISABILITY-STRIP-001 (owner 2026-06-23): the CV PROFILE must never
// carry a disability/hearing-impairment disclosure, the "...has not limited his
// career" framing, or the "worked with people from many backgrounds" filler. The
// prompt bans these but the LLM emitted them anyway; this deterministic floor
// strips them. Disclosure still lives in the Accessibility row / cover letter
// (untouched).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-profile-disclosure-strip.js', import.meta.url), 'utf8');

function load(sections) {
  const store = new Map(Object.entries({ sections: JSON.stringify(sections) }));
  const sandbox = {
    window: { addEventListener() {}, dispatchEvent() { return true; }, requestAnimationFrame: (fn) => { fn(); return 1; } },
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    console: { info() {}, warn() {}, log() {}, error() {} },
    setTimeout() { return 0; }, setInterval() { return 0; },
    CustomEvent: function (t, o) { this.type = t; Object.assign(this, o); },
    JSON, Array, Object, Error, RegExp, Math, String, Number, Boolean,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return { api: sandbox.window.AntcvProfileDisclosureStrip, store };
}
const clean = (t) => load({ cv: [], cl: [] }).api._clean(t);

test("removes the owner's exact BS sentence entirely", () => {
  const out = clean('Has worked with people from many backgrounds; hearing impaired, which has not limited his career.');
  assert.equal(out, '');
});

test('keeps the good lead, drops the disclosure clause in a mixed sentence', () => {
  const out = clean('IT and product professional with 15 years across regulated markets; hearing impaired, which has not limited his career.');
  assert.equal(out, 'IT and product professional with 15 years across regulated markets.');
});

test('keeps a clean profile untouched', () => {
  const t = 'IT and product professional with 15 years in regulated markets. Brings calm, structured decisions. Colleagues rely on his read of a room.';
  assert.equal(clean(t), t);
});

test('removes a standalone hearing-impairment sentence but keeps surrounding ones', () => {
  const out = clean('Systems architect with deep delivery experience. He is hearing impaired, which has not limited his career. Ends on a clear, calm communication style.');
  assert.equal(out, 'Systems architect with deep delivery experience. Ends on a clear, calm communication style.');
});

test('strips the rich_block PROFILE item in run()', () => {
  const sections = { cv: [{ id: 'profile', type: 'rich_block', items: [{ b: '', t: 'Product professional. Has worked with people from many backgrounds; hearing impaired, which has not limited his career. Calm under pressure.' }] }], cl: [] };
  const { api, store } = load(sections);
  api.run();
  const t = JSON.parse(store.get('sections')).cv[0].items[0].t;
  assert.ok(!/hearing/i.test(t), 'no hearing disclosure');
  assert.ok(!/many backgrounds/i.test(t), 'no filler');
  assert.ok(/Product professional\./.test(t) && /Calm under pressure\./.test(t), 'good content kept');
});

test('does NOT touch the cover letter (disclosure allowed there)', () => {
  const sections = { cv: [], cl: [{ id: 'who', type: 'rich_block', items: [{ b: 'Who I am', t: 'I am hearing impaired, which has not limited my career.' }] }] };
  const { api, store } = load(sections);
  api.run();
  const t = JSON.parse(store.get('sections')).cl[0].items[0].t;
  assert.match(t, /hearing impaired/, 'CL who untouched');
});

test('idempotent', () => {
  const sections = { cv: [{ id: 'profile', type: 'text', content: 'A. Has worked with people from many backgrounds; hearing impaired, which has not limited his career. B.' }], cl: [] };
  const a = load(sections); a.api.run();
  const once = a.store.get('sections');
  const b = load(JSON.parse(once)); b.api.run();
  assert.deepEqual(JSON.parse(b.store.get('sections')), JSON.parse(once));
});
