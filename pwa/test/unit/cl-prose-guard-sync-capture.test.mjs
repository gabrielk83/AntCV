// cl-prose-guard-sync-capture.test.mjs
// CL-BLANK-CAPTURE-001: on a first generation the real who/why/opening prose exists only
// briefly before a stale restore reverts them to the empty Nordic skeleton. The guard now
// snapshots SYNCHRONOUSLY on antcv:sections-updated so the real prose is captured the instant
// it appears — before the clobber — giving reapply a real snapshot to restore from.
//
// This test wires a FUNCTIONAL window event system into the vm sandbox so the sidecar's real
// addEventListener('antcv:sections-updated', …) sync-snapshot listener actually fires when we
// dispatch the event (the empty-body test uses no-op listeners and drives the API directly).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-cl-prose-loss-guard-985.js', import.meta.url), 'utf8');

function makeCtx() {
  const store = new Map();
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const listeners = {};
  const perf = { now: () => 0 };
  const win = {
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    dispatchEvent(evt) { (listeners[evt && evt.type] || []).forEach((fn) => fn(evt)); return true; },
    performance: perf,
  };
  const sandbox = {
    window: win,
    document: { addEventListener() {} },
    localStorage,
    performance: perf,
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    console: { warn() {}, log() {}, error() {}, info() {}, debug() {} },
    JSON, Array, Object, Error, RegExp, Math, String, Number, Boolean, Date,
    CustomEvent: function (type, init) { this.type = type; this.detail = init && init.detail; },
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return {
    store,
    fire: () => win.dispatchEvent({ type: 'antcv:sections-updated' }),
    api: sandbox.window.AntcvClProseGuard,
    setSections: (cl) => store.set('sections', JSON.stringify({ cv: [], cl })),
    whoBody: () => JSON.parse(store.get('sections')).cl.find((s) => s.id === 'who').items[0].t,
  };
}

const meta = JSON.stringify({ company: '', role: '' }); // unsolicited -> appKey "|"
const goodWho = () => ({ id: 'who', type: 'rich_block', items: [{ b: 'Who I am', t: 'I work at the seams between disciplines, keeping decisions traceable.' }] });
const emptyWho = () => ({ id: 'who', type: 'rich_block', items: [{ b: 'Who I am', t: '' }] });

test('the sync listener snapshots real prose the instant sections-updated fires', () => {
  const ctx = makeCtx();
  ctx.store.set('meta', meta);
  ctx.setSections([goodWho()]);
  ctx.fire();                                   // generation writes real prose + fires the event
  const snap = JSON.parse(ctx.store.get('antcv:clProseGuard') || '{}');
  assert.ok(snap['|'] && snap['|'].who, 'who captured synchronously on the event');
  assert.match(snap['|'].who.items[0].t, /seams between disciplines/);
});

test('captured-early prose survives a later clobber to the empty skeleton', () => {
  const ctx = makeCtx();
  ctx.store.set('meta', meta);
  ctx.setSections([goodWho()]);
  ctx.fire();                                   // sync snapshot captures the real who
  ctx.setSections([emptyWho()]);                // stale restore clobbers who back to empty
  assert.equal(ctx.whoBody(), '', 'precondition: clobbered to empty');
  ctx.api.reapply();                            // the poll/debounced reapply restores it
  assert.match(ctx.whoBody(), /seams between disciplines/, 'real who restored from the early snapshot');
});

test('an empty-only who never produces a snapshot (nothing to capture)', () => {
  const ctx = makeCtx();
  ctx.store.set('meta', meta);
  ctx.setSections([emptyWho()]);
  ctx.fire();
  const snap = JSON.parse(ctx.store.get('antcv:clProseGuard') || '{}');
  assert.ok(!snap['|'] || !snap['|'].who, 'no snapshot for an empty who');
});
