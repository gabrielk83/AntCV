// cl-prose-loss-guard-reinsert.test.mjs
// CL-PROSE-LOSS-GUARD-002 (owner: "the whole HOW I WOULD CONTRIBUTE section is gone after an
// edit" — the #1 inline-edit persistence bug). The map()-heal path only fixes a guarded section
// that is still PRESENT as a placeholder. A stale cloud / me()-enforce restore can DELETE a
// guarded prose section (HWIC = `contribute`) outright — the map never sees it, so it silently
// vanishes from the export. reapply() must RE-INSERT any guarded section that has a REAL snapshot
// but is now ABSENT, at its canonical Nordic-CL position — only ever ADDING back previously-seen
// real content, never overwriting a live section, never crossing into an unsolicited application.
//
// The heal path is locked by cl-prose-loss-guard-empty-body.test.mjs (A/B/C); this file locks the
// ABSENT-section re-insertion path exclusively. Loads the REAL sidecar in a vm sandbox.

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
    performance: perf,
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    console: { warn() {}, log() {}, error() {}, info() {}, debug() {} },
    JSON, Array, Object, Error, RegExp, Math, String, Number, Boolean, Date, CustomEvent: class {},
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return { sandbox, store, api: sandbox.window.AntcvClProseGuard };
}

const meta = JSON.stringify({ company: 'NIL Technology', role: 'Nanooptics Prototyping Engineer' });

// Real, non-placeholder section builders.
const greeting = () => ({ id: 'greeting', type: 'text', content: 'Dear Vladimir Miljkovic,' });
const opening = () => ({ id: 'opening', type: 'rich_block', items: [{ b: '', t: 'Your nanoscale-optics work at NIL Technology is exactly the domain I have spent my career in.' }] });
const why = () => ({ id: 'why', type: 'rich_block', items: [{ b: 'Why NIL', t: 'NIL turns meta-optics research into manufacturable components — the leap I most want to help make.' }] });
const who = () => ({ id: 'who', type: 'rich_block', items: [{ b: 'Who I am', t: 'A systems engineer with 12 years across optics and prototyping.' }] });
const foundation = () => ({ id: 'foundation', type: 'rich_block', items: [{ b: 'Foundation', t: 'Cleanroom process work from DTU Nanolab through to volume qualification.' }] });
const bring = () => ({ id: 'bring', type: 'rich_block', items: [{ b: 'What I bring', t: 'Hands-on prototyping and the discipline to move a design into production.' }] });
const contribute = () => ({ id: 'contribute', type: 'rich_block', items: [{ b: 'How I would contribute', t: 'In the first quarter I would tighten the prototyping-to-qualification loop for your nanooptics line.' }] });
const closure = () => ({ id: 'closure', type: 'text', content: 'I would welcome the chance to discuss how I can help.' });

const setCl = (store, cl) => store.set('sections', JSON.stringify({ cv: [], cl }));
const clIds = (store) => JSON.parse(store.get('sections')).cl.map((s) => s && s.id);
const findSec = (store, id) => JSON.parse(store.get('sections')).cl.find((s) => s && s.id === id);

test('D — HWIC (contribute) DELETED outright is re-inserted from snapshot', () => {
  const { api, store } = makeCtx();
  store.set('meta', meta);
  setCl(store, [greeting(), contribute(), closure()]);
  api.snapshot();                              // capture the real HWIC
  setCl(store, [greeting(), closure()]);        // stale restore DELETES contribute entirely
  assert.equal(findSec(store, 'contribute'), undefined, 'precondition: contribute is absent');
  api.reapply();
  const back = findSec(store, 'contribute');
  assert.ok(back, 'contribute re-inserted');
  assert.match(back.items[0].t, /first quarter/, 'full HWIC content preserved');
});

// CL-V5-STRUCT-001 (2026-07-21): the canonical order is now the v5 sequence
// greeting -> opening -> why -> role_view -> bring -> contribute -> who -> closure,
// and this guard's ORDER is kept in step with antcv-nordic-cl-order-971's.
test('E — re-insertion lands at the canonical v5 CL position (between bring and who)', () => {
  const { api, store } = makeCtx();
  store.set('meta', meta);
  // full letter in the v5 order, all real
  setCl(store, [greeting(), opening(), why(), bring(), contribute(), who(), foundation(), closure()]);
  api.snapshot();
  // delete just contribute — leaves a gap between bring and who
  setCl(store, [greeting(), opening(), why(), bring(), who(), foundation(), closure()]);
  api.reapply();
  const ids = clIds(store);
  assert.deepEqual(ids, ['greeting', 'opening', 'why', 'bring', 'contribute', 'who', 'foundation', 'closure'],
    'contribute restored to its canonical v5 slot, not appended to the end');
});

test('F — no real snapshot → an absent section is NOT re-inserted (no fabrication)', () => {
  const { api, store } = makeCtx();
  store.set('meta', meta);
  // snapshot a letter that never contained contribute → bucket has no contribute entry
  setCl(store, [greeting(), who(), closure()]);
  api.snapshot();
  // a later state that also lacks contribute — with nothing real to restore from, reapply
  // must leave it absent (the guard only ever ADDS BACK previously-seen real content).
  setCl(store, [greeting(), who(), closure()]);
  api.reapply();
  assert.equal(findSec(store, 'contribute'), undefined, 'contribute never existed → never invented');
});

test('G — unsolicited application: a deleted section is NOT re-inserted (poison-safe)', () => {
  const { api, store } = makeCtx();
  // First snapshot under a real targeted company...
  store.set('meta', meta);
  setCl(store, [greeting(), contribute(), closure()]);
  api.snapshot();
  // ...then the app flips to explicit Unsolicited and the section is gone.
  store.set('meta', JSON.stringify({ company: 'Unsolicited', role: 'Open Application' }));
  setCl(store, [greeting(), closure()]);
  api.reapply();
  assert.equal(findSec(store, 'contribute'), undefined,
    'targeted-company HWIC must never be re-injected into an unsolicited letter');
});
