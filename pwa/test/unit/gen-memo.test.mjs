// gen-memo.test.mjs
// ============================================================
// GEN-BACKGROUND-001 checkpoint-memo (antcv-gen-memo.js): during a gen run,
// completed ee() calls are memoized and replayed on a re-run so an interrupted
// generation resumes near-instantly. Opt-in (antcv:gen-resume=1), output-neutral,
// cleared on a successful gen, reload-resume via window.__antcvGenRunSig.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-gen-memo.js', import.meta.url), 'utf8');

function load(ls0) {
  const store = new Map(Object.entries(ls0 || {}));
  const sandbox = {
    window: {},
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    JSON, Object, String, Array, Number, Boolean, Math,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return { api: sandbox.window.AntcvGenMemo, win: sandbox.window, store };
}

// Simulate the ee() wrapper: memo hit -> replay; miss -> call inner, memoize.
function wrappedEe(api, win, inner) {
  return async (messages, system, opts) => {
    const memo = (win.__antcvGenRunning && api.active()) ? api : null;
    const k = memo ? memo.key(messages, system, opts) : null;
    if (memo && k) { const hit = memo.get(k); if (hit !== undefined) return hit; }
    const res = await inner(messages, system, opts);
    if (memo && k && typeof res === 'string' && res) memo.set(k, res);
    return res;
  };
}

test('opt-in gate: default OFF -> ee() never memoizes (byte-identical to today)', async () => {
  const { api, win } = load();               // no antcv:gen-resume
  win.__antcvGenRunning = true;
  let calls = 0;
  const ee = wrappedEe(api, win, async () => { calls++; return 'R' + calls; });
  await ee([{ role: 'user', content: 'x' }], 'sys', { task: 'generate_cv' });
  await ee([{ role: 'user', content: 'x' }], 'sys', { task: 'generate_cv' });
  assert.equal(calls, 2, 'no memo when not opted in — both calls hit the provider');
});

test('opted-in run: a completed call replays on re-run (interrupt-resume is free)', async () => {
  const { api, win } = load({ 'antcv:gen-resume': '1' });
  win.__antcvGenRunning = true;
  let calls = 0;
  const ee = wrappedEe(api, win, async (m) => { calls++; return 'RESULT:' + m[0].content; });
  // first run: two distinct stage calls
  const a1 = await ee([{ role: 'user', content: 'stage-A' }], 's', { task: 'generate_cv' });
  const b1 = await ee([{ role: 'user', content: 'stage-B' }], 's', { task: 'enrich' });
  assert.equal(calls, 2);
  // the tab backgrounded mid stage-C and the run threw; the user re-clicks Generate:
  // stage-A and stage-B replay from cache, only stage-C actually calls.
  const a2 = await ee([{ role: 'user', content: 'stage-A' }], 's', { task: 'generate_cv' });
  const b2 = await ee([{ role: 'user', content: 'stage-B' }], 's', { task: 'enrich' });
  const c2 = await ee([{ role: 'user', content: 'stage-C' }], 's', { task: 'compress' });
  assert.equal(a2, a1, 'stage-A replayed identically (output-neutral)');
  assert.equal(b2, b1, 'stage-B replayed');
  assert.equal(calls, 3, 'only the new stage-C actually called the provider');
});

test('clear() on successful gen -> a deliberate re-gen of the same inputs is NOT cached', async () => {
  const { api, win } = load({ 'antcv:gen-resume': '1' });
  win.__antcvGenRunning = true;
  let calls = 0;
  const ee = wrappedEe(api, win, async () => { calls++; return 'R' + calls; });
  await ee([{ role: 'user', content: 'p' }], 's', { task: 'generate_cv' });
  assert.equal(calls, 1);
  api.clear();                               // gen succeeded
  await ee([{ role: 'user', content: 'p' }], 's', { task: 'generate_cv' });
  assert.equal(calls, 2, 'fresh regen re-calls (no stale cached document)');
});

test('reload-resume: with a run signature, the cache persists to localStorage and re-adopts', async () => {
  const { api, win, store } = load({ 'antcv:gen-resume': '1' });
  win.__antcvGenRunning = true;
  win.__antcvGenRunSig = 'sig-trackman';
  let calls = 0;
  const ee = wrappedEe(api, win, async (m) => { calls++; return 'RESULT:' + m[0].content; });
  await ee([{ role: 'user', content: 'stage-A' }], 's', { task: 'generate_cv' });
  assert.equal(calls, 1);
  assert.ok(store.get('antcv:genMemo'), 'persisted under the run signature');
  // "reload": fresh module instance, same localStorage + same sig
  const fresh = load(Object.fromEntries(store));
  fresh.win.__antcvGenRunning = true;
  fresh.win.__antcvGenRunSig = 'sig-trackman';
  let calls2 = 0;
  const ee2 = wrappedEe(fresh.api, fresh.win, async (m) => { calls2++; return 'RESULT:' + m[0].content; });
  const a = await ee2([{ role: 'user', content: 'stage-A' }], 's', { task: 'generate_cv' });
  assert.equal(a, 'RESULT:stage-A', 'stage-A adopted from the persisted checkpoint');
  assert.equal(calls2, 0, 'no re-call after a reload — resumed from the checkpoint');
});

test('different inputs (sig change) reset the cache (no cross-application leak)', async () => {
  const { api, win } = load({ 'antcv:gen-resume': '1' });
  win.__antcvGenRunning = true;
  win.__antcvGenRunSig = 'sig-A';
  let calls = 0;
  const ee = wrappedEe(api, win, async () => { calls++; return 'R' + calls; });
  await ee([{ role: 'user', content: 'x' }], 's', { task: 'generate_cv' });
  win.__antcvGenRunSig = 'sig-B';            // a different application
  await ee([{ role: 'user', content: 'x' }], 's', { task: 'generate_cv' });
  assert.equal(calls, 2, 'the same payload under a new signature re-calls');
});

test('kill switch disables memoization even when opted in', async () => {
  const { api, win } = load({ 'antcv:gen-resume': '1', 'antcv:disable-gen-memo': '1' });
  win.__antcvGenRunning = true;
  let calls = 0;
  const ee = wrappedEe(api, win, async () => { calls++; return 'R' + calls; });
  await ee([{ role: 'user', content: 'x' }], 's', { task: 'generate_cv' });
  await ee([{ role: 'user', content: 'x' }], 's', { task: 'generate_cv' });
  assert.equal(calls, 2);
});

test('never memoizes outside a gen run (__antcvGenRunning false)', async () => {
  const { api, win } = load({ 'antcv:gen-resume': '1' });
  win.__antcvGenRunning = false;             // e.g. a chatbot / enrich call outside gen
  let calls = 0;
  const ee = wrappedEe(api, win, async () => { calls++; return 'R' + calls; });
  await ee([{ role: 'user', content: 'x' }], 's', { task: 'enrich' });
  await ee([{ role: 'user', content: 'x' }], 's', { task: 'enrich' });
  assert.equal(calls, 2, 'non-gen ee() calls are never memoized');
});

// Both-bundle integration lock: the ee() memo wrapper + gen-done clear must be
// present and identical-in-intent in app.src.js AND the minified app.js.
test('BOTH bundles carry the ee()-memo wrapper + gen-done clear (mirror lock)', async () => {
  const appSrc = await readFile(new URL('../../app.src.js', import.meta.url), 'utf8');
  const appMin = await readFile(new URL('../../app.js', import.meta.url), 'utf8');
  // wrapper: __eeInner (src) / __LeInner (min) each defined once + called once = 2
  assert.equal(appSrc.split('__eeInner').length - 1, 2, 'app.src.js: ee wrapper + inner');
  assert.equal(appMin.split('__LeInner').length - 1, 2, 'app.js: Le wrapper + inner');
  // the memo read/write is on the gen chokepoint in both
  assert.ok(appSrc.includes('window.AntcvGenMemo.active()') && appSrc.includes('__gm.set(__gk'), 'src memo hook');
  assert.ok(appMin.includes('window.AntcvGenMemo.active()') && appMin.includes('__gm.set(__gk'), 'min memo hook');
  // gen-done clears the memo in both (correctness: fresh regen not cached)
  assert.ok(appSrc.includes('window.AntcvGenMemo && window.AntcvGenMemo.clear()'), 'src gen-done clear');
  assert.ok(appMin.includes('window.AntcvGenMemo&&window.AntcvGenMemo.clear()'), 'min gen-done clear');
  // app.js integrity preserved
  assert.ok(appMin.startsWith('(()=>{'), 'app.js IIFE head intact');
  assert.equal(appMin.split('"use strict"').length - 1, 0, 'app.js has no use strict');
});
