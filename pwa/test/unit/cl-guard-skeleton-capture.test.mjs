// CL-GUARD-SKELETON-CAPTURE-001 (owner 2026-07-03, the NIL round) — the CL
// prose-loss guard captured the me() SKELETON under a targeted bucket.
//
// The skeleton's opening BODY starts with plain words — "I am applying for
// [Role title] at [Company], where I can contribute to [main JD need 1…]" —
// so the old isPlaceholder (first char '[') classified it as REAL: the owner's
// "NIL Technology|Nanooptics Prototyping Engineer" bucket held 2164 bytes of
// pure template after a failed NIL CL generation. A skeleton snapshot is
// worthless for recovery and masks the real-prose capture.
//
// Locks:
//  1. bracket-DOMINATED text (>=2 template segments) is placeholder → skeleton
//     never snapshotted under a targeted key.
//  2. real prose with ONE bracketed token still captures (no regression).
//  3. purgeSkeletonSnapshots() drops pre-existing skeleton buckets (the
//     owner's live poison) and keeps real ones.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SRC = readFileSync(new URL('../../antcv-cl-prose-loss-guard-985.js', import.meta.url), 'utf8');

function mockStorage(backing) {
  return {
    getItem: (k) => (backing.has(k) ? backing.get(k) : null),
    setItem: (k, v) => { backing.set(k, String(v)); },
    removeItem: (k) => { backing.delete(k); },
    key: (i) => { const ks = [...backing.keys()]; return i < ks.length ? ks[i] : null; },
    get length() { return backing.size; },
  };
}
function load(backing) {
  const localStorage = mockStorage(backing);
  const win = { localStorage, addEventListener() {}, dispatchEvent() {}, performance: { now: () => 0 } };
  const sandbox = {
    window: win, localStorage, JSON, console, performance: { now: () => 0 },
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0,
    CustomEvent: function () {}, Object, String, Array, RegExp,
  };
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);
  return win.AntcvClProseGuard;
}

const SKELETON_OPENING = {
  id: 'opening', type: 'rich_block', headlineOff: true,
  items: [{ b: '', t: 'I am applying for [Role title] at [Company], where I can contribute to [main JD need 1 (example: a core responsibility from the JD)], [main JD need 2 (example: a second responsibility)].' }],
};
const REAL_OPENING_ONE_BRACKET = {
  id: 'opening', type: 'rich_block', headlineOff: true,
  items: [{ b: '', t: 'NIL Technology pushes nanooptics from prototype to production [verify], and that is the work I have done for 15 years across LiDAR and smartphone optics.' }],
};

test('skeleton opening is NOT captured under a targeted key', () => {
  const backing = new Map();
  backing.set('meta', JSON.stringify({ company: 'NIL Technology', role: 'Nanooptics Prototyping Engineer' }));
  backing.set('sections', JSON.stringify({ cv: [], cl: [SKELETON_OPENING] }));
  const G = load(backing);
  G.snapshot();
  const store = JSON.parse(backing.get('antcv:clProseGuard') || '{}');
  assert.equal(store['NIL Technology|Nanooptics Prototyping Engineer'], undefined, 'skeleton must not be snapshotted');
});

test('real prose with a single bracketed token IS still captured', () => {
  const backing = new Map();
  backing.set('meta', JSON.stringify({ company: 'NIL Technology', role: 'Nanooptics Prototyping Engineer' }));
  backing.set('sections', JSON.stringify({ cv: [], cl: [REAL_OPENING_ONE_BRACKET] }));
  const G = load(backing);
  G.snapshot();
  const store = JSON.parse(backing.get('antcv:clProseGuard') || '{}');
  const bucket = store['NIL Technology|Nanooptics Prototyping Engineer'];
  assert.ok(bucket && bucket.opening, 'one bracketed token must not block a real capture');
});

test('purgeSkeletonSnapshots drops skeleton buckets, keeps real ones', () => {
  const backing = new Map();
  backing.set('meta', JSON.stringify({ company: 'Unsolicited', role: 'Open Application' }));
  backing.set('sections', JSON.stringify({ cv: [], cl: [] }));
  backing.set('antcv:clProseGuard', JSON.stringify({
    'NIL Technology|Nanooptics Prototyping Engineer': { opening: SKELETON_OPENING },
    'Terma A/S|Senior Engineer': { opening: { id: 'opening', type: 'rich_block', items: [{ b: '', t: 'Terma builds real systems and I have shipped validation for them.' }] } },
  }));
  const G = load(backing);
  G.purgeSkeletonSnapshots();
  const store = JSON.parse(backing.get('antcv:clProseGuard'));
  assert.equal(store['NIL Technology|Nanooptics Prototyping Engineer'], undefined, 'skeleton bucket purged');
  assert.ok(store['Terma A/S|Senior Engineer'], 'real bucket kept');
});

test('_isPlaceholder: skeleton body true, real prose false, bracket-led true', () => {
  const backing = new Map();
  const G = load(backing);
  assert.equal(G._isPlaceholder(SKELETON_OPENING.items[0].t), true);
  assert.equal(G._isPlaceholder(REAL_OPENING_ONE_BRACKET.items[0].t), false);
  assert.equal(G._isPlaceholder('[Opening]'), true);
  assert.equal(G._isPlaceholder(''), true);
});
