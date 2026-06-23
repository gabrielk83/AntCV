// unsolicited-identity-guard.test.mjs
// ============================================================
// UNSOLICITED-SHOWS-NVIDIA-001: an unsolicited gen re-injects a prior targeted
// company (e.g. NVIDIA) from the kernel showcase cloud slot. The guard forces the
// identity back to Unsolicited/Open Application when the context is unsolicited
// (no real JD in antcv:lastJdText) but meta wears a real company. Loads the real
// sidecar in a vm sandbox.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-unsolicited-identity-guard.js', import.meta.url), 'utf8');

function makeSandbox(initial) {
  const store = new Map(Object.entries(initial || {}));
  const dispatched = [];
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  function StorageEvent(type, init) { this.type = type; Object.assign(this, init || {}); }
  const sandbox = {
    window: {
      addEventListener() {},
      dispatchEvent(e) { dispatched.push(e); return true; },
      StorageEvent,
      // no requestAnimationFrame → tick() falls back to setTimeout (noop below)
    },
    document: { activeElement: null },
    localStorage,
    StorageEvent,
    console: { warn() {}, debug() {}, log() {}, error() {}, info() {} },
    setTimeout() { return 0; },   // suppress the IIFE's scheduled ticks; we call _apply directly
    setInterval() { return 0; },
    JSON, Array, Object, Error, RegExp, Math, String, Number, Boolean,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return { sandbox, store, dispatched };
}

const UNSOL_TEXTS = { greeting: 'Dear Hiring Manager,', opening: 'I am writing to introduce myself and express my interest in future opportunities at your organisation.' };
const CONTAMINATED_META = JSON.stringify({ company: 'NVIDIA', role: 'Test Engineer - Photonic', subtitle: 'Processes • Products • People', ...UNSOL_TEXTS });
const LONG_JD = 'JOB DESCRIPTION: NVIDIA seeks a Test Engineer - Photonic to validate silicon photonics modules.';

let ctx;
function api() { return ctx.sandbox.window.AntcvUnsolicitedIdentityGuard; }

test('sidecar installs and exposes the guard API', () => {
  ctx = makeSandbox({});
  assert.equal(typeof api()._apply, 'function');
  assert.equal(typeof api()._isUnsolicitedLabel, 'function');
});

test('_isUnsolicitedLabel: canonical labels and empty are NOT real companies', () => {
  ctx = makeSandbox({});
  for (const v of ['Unsolicited', 'Open Application', 'n/a', 'N/A', '', '  ']) assert.equal(api()._isUnsolicitedLabel(v), true, v);
  for (const v of ['NVIDIA', 'Kvadrat Acoustics', 'Nordea']) assert.equal(api()._isUnsolicitedLabel(v), false, v);
});

test('unsolicited context + targeted company → identity forced to Unsolicited', () => {
  ctx = makeSandbox({
    'antcv:lastJdText': '',
    'meta': CONTAMINATED_META,
    'antcv:activeAppCompany': 'NVIDIA',
    'rationale': '{"fit_summary":"aligns with NVIDIA"}',
  });
  api()._apply();
  const meta = JSON.parse(ctx.store.get('meta'));
  assert.equal(meta.company, 'Unsolicited');
  assert.equal(meta.role, 'Open Application');
  // candidate-owned fields preserved
  assert.equal(meta.subtitle, 'Processes • Products • People');
  assert.equal(meta.greeting, UNSOL_TEXTS.greeting);
  assert.equal(meta.opening, UNSOL_TEXTS.opening);
  // sidecar keys scrubbed
  assert.equal(ctx.store.get('antcv:activeAppCompany'), 'Unsolicited');
  assert.equal(ctx.store.has('rationale'), false);
  // React state nudged via a meta StorageEvent
  assert.equal(ctx.dispatched.some((e) => e.key === 'meta'), true);
});

test('specific job (real JD present) → targeted identity left untouched', () => {
  ctx = makeSandbox({
    'antcv:lastJdText': LONG_JD,
    'meta': CONTAMINATED_META,
    'antcv:activeAppCompany': 'NVIDIA',
  });
  api()._apply();
  const meta = JSON.parse(ctx.store.get('meta'));
  assert.equal(meta.company, 'NVIDIA');           // not touched
  assert.equal(meta.role, 'Test Engineer - Photonic');
  assert.equal(ctx.store.get('antcv:activeAppCompany'), 'NVIDIA');
  assert.equal(ctx.dispatched.length, 0);
});

test('already-clean unsolicited meta → no meta rewrite, but stray keys scrubbed', () => {
  ctx = makeSandbox({
    'antcv:lastJdText': '',
    'meta': JSON.stringify({ company: 'Unsolicited', role: 'Open Application', subtitle: 'X' }),
    'antcv:activeAppCompany': 'NVIDIA',   // stray leftover
    'rationale': '{"x":1}',
  });
  api()._apply();
  const meta = JSON.parse(ctx.store.get('meta'));
  assert.equal(meta.company, 'Unsolicited');
  assert.equal(ctx.dispatched.length, 0);          // no meta change → no nudge
  assert.equal(ctx.store.get('antcv:activeAppCompany'), 'Unsolicited'); // scrubbed
  assert.equal(ctx.store.has('rationale'), false);
});

test('idempotent: a second apply after normalize does nothing', () => {
  ctx = makeSandbox({ 'antcv:lastJdText': '', 'meta': CONTAMINATED_META });
  api()._apply();
  const after1 = ctx.dispatched.length;
  api()._apply();
  assert.equal(ctx.dispatched.length, after1);      // no further nudge (same-meta bail)
});

test('disable flag turns the guard off', () => {
  ctx = makeSandbox({ 'antcv:lastJdText': '', 'meta': CONTAMINATED_META, 'antcv:disable-unsolicited-identity-guard': '1' });
  api()._apply();
  assert.equal(JSON.parse(ctx.store.get('meta')).company, 'NVIDIA');  // untouched
});
