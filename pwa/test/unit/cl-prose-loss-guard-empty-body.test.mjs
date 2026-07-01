// cl-prose-loss-guard-empty-body.test.mjs
// CL-BLANK-001 (#4): an empty-body-but-LABELLED CL rich_block (it.t empty, it.b="Who I am")
// previously read as "real" via proseOf's `it.t || it.b` and defeated the restore. After the
// body-only fix, the loss-guard restores a real snapshot over an empty body, and leaves good
// prose untouched. Loads the REAL sidecar in a vm sandbox over a localStorage shim.

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
  const perf = { now: () => 0 };
  const sandbox = {
    window: { addEventListener() {}, dispatchEvent() { return true; }, performance: perf },
    document: { addEventListener() {} },
    localStorage,
    performance: perf, // sidecar references bare `performance.now` — must exist as a global
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    console: { warn() {}, log() {}, error() {}, info() {}, debug() {} },
    JSON, Array, Object, Error, RegExp, Math, String, Number, Boolean, Date, CustomEvent: class {},
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return { sandbox, store, api: sandbox.window.AntcvClProseGuard };
}

const meta = JSON.stringify({ company: 'Acme', role: 'PdM' });
const goodWho = () => ({ id: 'who', type: 'rich_block', items: [{ b: 'Who I am', t: 'I am a systems engineer with 12 years across the roles on my CV.' }] });
const emptyWho = () => ({ id: 'who', type: 'rich_block', items: [{ b: 'Who I am', t: '' }] }); // label present, body empty
const setSections = (store, cl) => store.set('sections', JSON.stringify({ cv: [], cl }));
const getWhoBody = (store) => JSON.parse(store.get('sections')).cl.find((s) => s.id === 'who').items[0].t;

test('A — good prose is snapshotted', () => {
  const { api, store } = makeCtx();
  store.set('meta', meta);
  setSections(store, [goodWho()]);
  api.snapshot();
  const snap = JSON.parse(store.get('antcv:clProseGuard'));
  assert.ok(snap['Acme|PdM'] && snap['Acme|PdM'].who, 'who snapshot taken');
  assert.match(snap['Acme|PdM'].who.items[0].t, /systems engineer/);
});

test('B — empty-body rich_block (label survives) is restored from snapshot', () => {
  const { api, store } = makeCtx();
  store.set('meta', meta);
  setSections(store, [goodWho()]);
  api.snapshot();                   // capture good prose
  setSections(store, [emptyWho()]); // generation leaves it.t empty but keeps the label
  assert.equal(getWhoBody(store), '', 'precondition: body empty');
  api.reapply();
  assert.match(getWhoBody(store), /systems engineer/, 'empty body restored from snapshot');
});

test('C — good prose is left untouched (no clobber)', () => {
  const { api, store } = makeCtx();
  store.set('meta', meta);
  setSections(store, [goodWho()]);
  api.snapshot();
  const edited = { id: 'who', type: 'rich_block', items: [{ b: 'Who I am', t: 'A different real body the user typed themselves.' }] };
  setSections(store, [edited]);
  api.reapply();
  assert.equal(getWhoBody(store), 'A different real body the user typed themselves.', 'real body never overwritten');
});
