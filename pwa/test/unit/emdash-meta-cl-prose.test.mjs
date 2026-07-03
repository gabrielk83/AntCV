// emdash-meta-cl-prose.test.mjs
// EMDASH-META-CL-PROSE-001 (1.51.118, owner 2026-07-04, NIL round-4): the CL header prose is
// sourced from localStorage['meta'] (meta.opening / meta.greeting / meta.subtitle), which the
// em-dash scrub never walked — it only touched 'sections'. LLM-generated meta prose therefore
// exported with raw em dashes ("nanooptics—where…"). This locks the extended scrub: meta AND
// sections both normalise em/en dashes → hyphen, loop-safe, disable-switch honoured.
// Loads the REAL sidecar in a vm sandbox over a localStorage shim.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-emdash-to-hyphen.js', import.meta.url), 'utf8');

function makeCtx() {
  const store = new Map();
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const sandbox = {
    window: { addEventListener() {}, dispatchEvent() { return true; }, requestAnimationFrame: (fn) => { fn(); return 0; } },
    localStorage,
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    console: { info() {}, warn() {}, log() {}, error() {} },
    JSON, Array, Object, Error, RegExp, Math, String, Number, Boolean, Date, CustomEvent: class {},
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return { sandbox, store, api: sandbox.window.AntcvEmdashHyphen };
}

const getMeta = (store) => JSON.parse(store.get('meta'));

test('meta.opening em dash is normalised to a hyphen (the NIL round-4 leak)', () => {
  const { api, store } = makeCtx();
  store.set('meta', JSON.stringify({ company: 'NIL Technology', opening: 'I work in nanooptics—where light meets fabrication.' }));
  api._apply();
  assert.equal(getMeta(store).opening, 'I work in nanooptics-where light meets fabrication.');
});

test('meta.greeting and meta.subtitle (slogan) en/em dashes normalised too', () => {
  const { api, store } = makeCtx();
  store.set('meta', JSON.stringify({ greeting: 'Dear Vladimir—', subtitle: 'Nanofabrication – Process – Cleanroom' }));
  api._apply();
  const m = getMeta(store);
  assert.equal(m.greeting, 'Dear Vladimir-');
  assert.equal(m.subtitle, 'Nanofabrication - Process - Cleanroom');
});

test('sections normalisation still works (no regression)', () => {
  const { api, store } = makeCtx();
  store.set('sections', JSON.stringify({ cv: [{ id: 'r', title: 'Optics—Photonics' }], cl: [] }));
  api._apply();
  assert.equal(JSON.parse(store.get('sections')).cv[0].title, 'Optics-Photonics');
});

test('meta AND sections normalised in one pass', () => {
  const { api, store } = makeCtx();
  store.set('meta', JSON.stringify({ opening: 'a—b' }));
  store.set('sections', JSON.stringify({ cl: [{ id: 'o', content: 'c–d' }] }));
  api._apply();
  assert.equal(getMeta(store).opening, 'a-b');
  assert.equal(JSON.parse(store.get('sections')).cl[0].content, 'c-d');
});

test('no long dash → no write (fast bail, loop-safe)', () => {
  const { api, store } = makeCtx();
  store.set('meta', JSON.stringify({ opening: 'plain hyphen - only' }));
  const before = store.get('meta');
  api._apply();
  assert.equal(store.get('meta'), before, 'untouched when nothing to normalise');
});

test('disable switch halts the scrub', () => {
  const { api, store } = makeCtx();
  store.set('antcv:disable-emdash-hyphen', '1');
  store.set('meta', JSON.stringify({ opening: 'x—y' }));
  api._apply();
  assert.equal(getMeta(store).opening, 'x—y', 'disabled → left as-is');
});

test('malformed meta JSON is ignored (no throw, no write)', () => {
  const { api, store } = makeCtx();
  store.set('meta', 'not json —');
  api._apply(); // must not throw
  assert.equal(store.get('meta'), 'not json —', 'unparseable blob left untouched');
});
