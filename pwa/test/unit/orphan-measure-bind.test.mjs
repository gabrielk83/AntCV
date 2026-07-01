// orphan-measure-bind.test.mjs
// ============================================================
// ORPHAN-MEASURE-BIND-001: deterministic helpers of the L1+L2 orphan sidecar.
// The DOM measurement (Range.getClientRects / clone) needs a real browser and is
// verified on a live export; here we test the pure binding + write-back logic.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-orphan-measure-bind.js', import.meta.url), 'utf8');
const NBSP = String.fromCharCode(160);

function load(store0) {
  const store = new Map(Object.entries(store0 || {}));
  const sandbox = {
    window: { addEventListener() {}, dispatchEvent() { return true; } },
    document: { querySelectorAll() { return []; }, createRange() { return { selectNodeContents() {}, getClientRects() { return []; } }; } },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    setTimeout() { return 0; }, clearTimeout() {},
    CustomEvent: function (t, o) { this.type = t; Object.assign(this, o); },
    JSON, Array, Object, Error, RegExp, Math, String, Number, Boolean, parseInt,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return { api: sandbox.window.AntcvOrphanBind, store };
}

test('_bindLast binds the last N single-space gaps with NBSP', () => {
  const { api } = load();
  assert.equal(api._bindLast('one two three four', 1), 'one two three' + NBSP + 'four');
  assert.equal(api._bindLast('one two three four', 2), 'one two' + NBSP + 'three' + NBSP + 'four');
  assert.equal(api._bindLast('single', 2), 'single');       // no gaps to bind
});

test('_bindLast preserves trailing whitespace', () => {
  const { api } = load();
  assert.equal(api._spaceCount('a b c'), 2);
  assert.equal(api._bindLast('a b c ', 5), 'a' + NBSP + 'b' + NBSP + 'c ');
});

test('_isRunt: a last line far shorter than the widest is a runt', () => {
  const { api } = load();
  assert.equal(api._isRunt([480, 480, 60]), true);
  assert.equal(api._isRunt([480, 480, 300]), false);
  assert.equal(api._isRunt([480]), false);                  // single line, no orphan
  assert.equal(api._isRunt([]), false);
});

test('_alreadyBound detects an existing NBSP (idempotency guard)', () => {
  const { api } = load();
  assert.equal(api._alreadyBound('a' + NBSP + 'b'), true);
  assert.equal(api._alreadyBound('a b c'), false);
});

test('_bindBulletInSections binds a stored bullet by path and persists', () => {
  const sections = { cv: [{ id: 'experience', roles: [{ bullets: ['first bullet', 'owned the whole governance loop end to end'] }] }], cl: [] };
  const { api, store } = load({ sections: JSON.stringify(sections) });
  const ok = api._bindBulletInSections('experience', ['roles', '0', 'bullets', '1'], 2);
  assert.equal(ok, true);
  const bul = JSON.parse(store.get('sections')).cv[0].roles[0].bullets[1];
  assert.ok(bul.indexOf(NBSP) !== -1);
  assert.ok(bul.endsWith('to' + NBSP + 'end'), bul);
});

test('_bindBulletInSections is idempotent when already bound', () => {
  const sections = { cv: [{ id: 'experience', roles: [{ bullets: ['loop end to' + NBSP + 'end'] }] }], cl: [] };
  const { api } = load({ sections: JSON.stringify(sections) });
  assert.equal(api._bindBulletInSections('experience', ['roles', '0', 'bullets', '0'], 2), false);
});

test('_bindBulletInSections returns false for a missing path', () => {
  const sections = { cv: [{ id: 'experience', roles: [] }], cl: [] };
  const { api } = load({ sections: JSON.stringify(sections) });
  assert.equal(api._bindBulletInSections('experience', ['roles', '5', 'bullets', '0'], 2), false);
});

test('_bindResultsOverride writes the bound text into the override map', () => {
  const { api, store } = load({});
  assert.equal(api._bindResultsOverride('r|Eng|Acme|0', 'shipped the thing on time', 2), true);
  const map = JSON.parse(store.get('antcv:resultsOverride'));
  assert.ok(map['r|Eng|Acme|0'].endsWith('on' + NBSP + 'time'), map['r|Eng|Acme|0']);
});
