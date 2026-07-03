// cl-slogan-fresh.test.mjs
// ============================================================
// SLOGAN-FRESH-GEN-001 (owner Trackman review 2026-07-03, spec rules 23/33):
// antcv:clSlogan is a sticky GLOBAL override that shadowed every later targeted
// generation's fresh meta.subtitle (the Trackman CL exported the NIL slogan).
// The sidecar stamps ownership (antcv:clSloganCtx = {v, app}) on every value
// change and DELETES an override owned by a DIFFERENT application when the
// active targeted app carries a real fresh subtitle — including the prose-loss
// guard's key stash (antcv:clKeysGuard), which would otherwise resurrect it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-cl-slogan-fresh.js', import.meta.url), 'utf8');

function load(store0) {
  const store = new Map(Object.entries(store0 || {}));
  const events = [];
  const sandbox = {
    window: { addEventListener() {}, dispatchEvent(e) { events.push(e && e.detail && e.detail.source); return true; } },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    setTimeout() { return 0; }, setInterval() { return 0; }, clearTimeout() {},
    console: { log() {}, warn() {} },
    CustomEvent: function (t, o) { this.type = t; Object.assign(this, o); },
    JSON, Array, Object, String, RegExp, Error, Math, Number, Boolean, Date,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return { api: sandbox.window.AntcvClSloganFresh, store, events };
}

const NIL_SLOGAN = 'MAKING THE INVISIBLE MANUFACTURABLE';
const TM_SLOGAN = 'TRACKING EVERY DECISION TO THE DATA';
const tmMeta = JSON.stringify({ company: 'Trackman A/S', role: 'Project Manager, Hardware', subtitle: TM_SLOGAN });

test('Trackman repro: LEGACY sticky override (no ctx) yields to the fresh targeted subtitle', () => {
  const { api, store, events } = load({
    'antcv:clSlogan': NIL_SLOGAN,
    'antcv:clKeysGuard': JSON.stringify({ 'antcv:clSlogan': NIL_SLOGAN, 'antcv:clSignName': 'Gabriel' }),
    meta: tmMeta,
  });
  api._tick();
  assert.equal(store.get('antcv:clSlogan'), undefined, 'stale override deleted -> render falls back to meta.subtitle');
  const stash = JSON.parse(store.get('antcv:clKeysGuard'));
  assert.equal(stash['antcv:clSlogan'], undefined, 'guard stash entry cleared — no resurrection');
  assert.equal(stash['antcv:clSignName'], 'Gabriel', 'other stashed keys untouched');
  assert.ok(events.includes('slogan-fresh'));
});

test('override stamped to ANOTHER app yields; stamped to the SAME app survives regen', () => {
  const other = load({
    'antcv:clSlogan': NIL_SLOGAN,
    'antcv:clSloganCtx': JSON.stringify({ v: NIL_SLOGAN, app: 'NIL Technology|Nanooptics Prototyping Engineer' }),
    meta: tmMeta,
  });
  other.api._tick();
  assert.equal(other.store.get('antcv:clSlogan'), undefined);

  const same = load({
    'antcv:clSlogan': 'MY HAND-TUNED TRACKMAN LINE',
    'antcv:clSloganCtx': JSON.stringify({ v: 'MY HAND-TUNED TRACKMAN LINE', app: 'Trackman A/S|Project Manager, Hardware' }),
    meta: tmMeta,
  });
  same.api._tick();
  assert.equal(same.store.get('antcv:clSlogan'), 'MY HAND-TUNED TRACKMAN LINE', 'owner-edit-wins across regens of the SAME app');
});

test('a NEW value is stamped to the CURRENT app (user edit attribution)', () => {
  const { api, store } = load({
    'antcv:clSlogan': 'FRESH USER EDIT',
    'antcv:clSloganCtx': JSON.stringify({ v: 'OLD VALUE', app: 'NIL Technology|X' }),
    meta: tmMeta,
  });
  api._tick();
  assert.equal(store.get('antcv:clSlogan'), 'FRESH USER EDIT', 'new value never deleted');
  assert.deepEqual(JSON.parse(store.get('antcv:clSloganCtx')), { v: 'FRESH USER EDIT', app: 'Trackman A/S|Project Manager, Hardware' });
});

test('unsolicited meta: never touched (standing motto path)', () => {
  for (const company of ['', 'Unsolicited', 'Open Application']) {
    const { api, store } = load({
      'antcv:clSlogan': 'PROCESSES • PRODUCTS • PEOPLE',
      meta: JSON.stringify({ company, role: 'Open Application', subtitle: 'anything' }),
    });
    api._tick();
    assert.equal(store.get('antcv:clSlogan'), 'PROCESSES • PRODUCTS • PEOPLE');
  }
});

test('no real fresh subtitle: legacy override adopted by the current app, not deleted', () => {
  for (const subtitle of ['', '   ', '[Slogan - short tagline]']) {
    const { api, store } = load({
      'antcv:clSlogan': NIL_SLOGAN,
      meta: JSON.stringify({ company: 'Trackman A/S', role: 'PM', subtitle }),
    });
    api._tick();
    assert.equal(store.get('antcv:clSlogan'), NIL_SLOGAN, 'nothing better to render — keep');
    assert.equal(JSON.parse(store.get('antcv:clSloganCtx')).app, 'Trackman A/S|PM');
  }
});

test('override that MATCHES the fresh subtitle is adopted (stamped), not deleted', () => {
  const { api, store } = load({ 'antcv:clSlogan': TM_SLOGAN, meta: tmMeta });
  api._tick();
  assert.equal(store.get('antcv:clSlogan'), TM_SLOGAN);
  assert.deepEqual(JSON.parse(store.get('antcv:clSloganCtx')), { v: TM_SLOGAN, app: 'Trackman A/S|Project Manager, Hardware' });
});

test('kill switch: nothing happens', () => {
  const { api, store } = load({
    'antcv:disable-slogan-fresh': '1',
    'antcv:clSlogan': NIL_SLOGAN,
    meta: tmMeta,
  });
  api._tick();
  assert.equal(store.get('antcv:clSlogan'), NIL_SLOGAN);
});

test('empty override clears a stale ctx and stays empty', () => {
  const { api, store } = load({
    'antcv:clSloganCtx': JSON.stringify({ v: 'X', app: 'A|B' }),
    meta: tmMeta,
  });
  api._tick();
  assert.equal(store.get('antcv:clSlogan'), undefined);
  assert.equal(store.get('antcv:clSloganCtx'), undefined);
});
