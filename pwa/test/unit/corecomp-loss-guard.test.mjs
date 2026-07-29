// corecomp-loss-guard.test.mjs
// ============================================================
// CV-CORECOMP-BLANK-001 (#2): the CV CORE COMPETENCIES table sometimes renders
// the me() skeleton placeholder rows ("[Focus area 1]" / "[Strategic expertise
// - 1 or 2 lines]") after a stale cloud/me()-enforce restore clobbers the
// freshly-laminated rows. antcv-corecomp-loss-guard.js snapshots the REAL rows
// to a local-only key and re-applies them when a later sections state is
// placeholder-only.
//
// Loads the REAL sidecar in a vm sandbox with a shimmed localStorage and
// asserts: snapshot of real rows, restore of placeholder-only / header-only
// states, no-op over real rows, no cross-application bleed, kill switch.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-corecomp-loss-guard.js', import.meta.url), 'utf8');

const HEADER = ['Focus Area', 'Strategic Expertise'];
const REAL_ROWS = [
  HEADER,
  ['Product discovery', 'Framed problems with stakeholders before committing to a build.'],
  ['Requirements engineering', 'Wrote traceable specs that survived audit and handover.'],
  ['Cross-discipline coordination', 'Kept decisions visible across hardware, firmware, and QA.'],
];
const PLACEHOLDER_ROWS = [
  HEADER,
  ['[Focus area 1]', '[Strategic expertise - 1 or 2 lines]'],
  ['[Focus area 2]', '[Strategic expertise - 1 or 2 lines]'],
  ['[Focus area 3]', '[Strategic expertise - 1 or 2 lines]'],
];
const HEADER_ONLY = [HEADER];

function makeSandbox(initial) {
  const store = new Map();
  if (initial) for (const k of Object.keys(initial)) store.set(k, JSON.stringify(initial[k]));
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const clockBox = { now: 0 };
  const perf = { now: () => clockBox.now };
  const CustomEventShim = function (type, init) { this.type = type; this.detail = init && init.detail; };
  const sandbox = {
    window: { addEventListener() {}, dispatchEvent() { return true; }, performance: perf, CustomEvent: CustomEventShim },
    localStorage,
    performance: perf,          // sidecar references bare `performance.now`
    CustomEvent: CustomEventShim, // sidecar constructs bare `new CustomEvent(...)`
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    console: { warn() {}, debug() {}, log() {}, error() {}, info() {} },
    JSON, Array, Object, Error, RegExp, Math, String, Number, Boolean, Date,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return {
    sandbox, store, clockBox,
    api: sandbox.window.AntcvCoreCompGuard,
    sections: () => JSON.parse(store.get('sections') || '{}'),
    setSections: (s) => store.set('sections', JSON.stringify(s)),
    snapStore: () => JSON.parse(store.get('antcv:coreCompGuard') || '{}'),
    advanceClock: (ms) => { clockBox.now += ms; },
  };
}

function cv(rows) {
  return { cv: [{ id: 'core_comp', type: 'table', rows }], cl: [] };
}

test('snapshot: a sections blob with REAL core_comp rows is captured to the local store', () => {
  const ctx = makeSandbox({ meta: { company: 'Acme', role: 'PM' }, sections: cv(REAL_ROWS) });
  ctx.api.snapshot();
  const snap = ctx.snapStore();
  assert.ok(snap['Acme|PM|en'], 'a bucket exists for the active application (language-keyed: LANG-GUARD-KEY-001)');
  assert.deepEqual(snap['Acme|PM|en'].rows, REAL_ROWS, 'the real rows are stored verbatim');
});

test('restore: placeholder-only rows are healed back to the real snapshot', () => {
  const ctx = makeSandbox({ meta: { company: 'Acme', role: 'PM' }, sections: cv(REAL_ROWS) });
  ctx.api.snapshot();                    // capture the real rows
  ctx.setSections(cv(PLACEHOLDER_ROWS)); // stale restore clobbers them
  ctx.advanceClock(5000);                // clear the anti-loop window
  ctx.api.reapply();
  const sec = ctx.sections().cv.find((s) => s.id === 'core_comp');
  assert.deepEqual(sec.rows, REAL_ROWS, 'placeholder rows are replaced with the real snapshot');
});

test('clean: a PARTIAL table (real + placeholder rows) drops the placeholder rows in place', () => {
  const ctx = makeSandbox({ meta: { company: 'Acme', role: 'PM' }, sections: cv(REAL_ROWS) });
  const PARTIAL = [
    HEADER,
    ['[Focus area 5]', '[Strategic expertise - 1 or 2 lines]'],   // placeholder row
    ['[Focus area 6]', '[Strategic expertise - 1 or 2 lines]'],   // placeholder row
    ['Optics, photonics', 'Electro-optics, photonics, semiconductor physics'], // real
    ['Imaging', 'Camera architecture, image sensors, ISP'],        // real
  ];
  ctx.setSections(cv(PARTIAL));
  ctx.advanceClock(5000);
  ctx.api.reapply();
  const sec = ctx.sections().cv.find((s) => s.id === 'core_comp');
  assert.deepEqual(sec.rows, [HEADER, PARTIAL[3], PARTIAL[4]], 'placeholder rows dropped, real rows + header kept');
});

test('clean: an EXACT-DUPLICATE row is dropped in place (keep first)', () => {
  const ctx = makeSandbox({ meta: { company: 'Acme', role: 'PM' }, sections: cv(REAL_ROWS) });
  const DUP = [
    HEADER,
    ['Optics, photonics &', 'Electro-optics, photonics, semiconductor physics'],
    ['Imaging', 'Camera architecture, image sensors, ISP'],
    ['Optics, photonics &', 'Electro-optics, photonics, semiconductor physics'], // exact dup of row 1
    ['Materials & devices', 'Nanomaterials, carbon nanotubes, MEMS/NEMS'],
  ];
  ctx.setSections(cv(DUP));
  ctx.advanceClock(5000);
  ctx.api.reapply();
  const sec = ctx.sections().cv.find((s) => s.id === 'core_comp');
  assert.deepEqual(sec.rows, [HEADER, DUP[1], DUP[2], DUP[4]], 'duplicate Optics row removed, order preserved');
});

test('snapshot: a partial table is snapshotted CLEAN (no placeholder rows stored)', () => {
  const ctx = makeSandbox({ meta: { company: 'Acme', role: 'PM' }, sections: cv(REAL_ROWS) });
  const PARTIAL = [HEADER, ['[Focus area 5]', '[Strategic expertise - 1 or 2 lines]'], ['Imaging', 'Camera architecture']];
  ctx.setSections(cv(PARTIAL));
  ctx.api.snapshot();
  const snap = ctx.snapStore();
  assert.deepEqual(snap['Acme|PM|en'].rows, [HEADER, ['Imaging', 'Camera architecture']], 'snapshot holds only header + real rows');
});

test('restore: a header-only table (lamination emptied the data rows) is also healed', () => {
  const ctx = makeSandbox({ meta: { company: 'Acme', role: 'PM' }, sections: cv(REAL_ROWS) });
  ctx.api.snapshot();
  ctx.setSections(cv(HEADER_ONLY));
  ctx.advanceClock(5000);
  ctx.api.reapply();
  const sec = ctx.sections().cv.find((s) => s.id === 'core_comp');
  assert.deepEqual(sec.rows, REAL_ROWS, 'a header-only table restores from snapshot');
});

test('no-op: real rows are left untouched (never overwritten by an older snapshot)', () => {
  const ctx = makeSandbox({ meta: { company: 'Acme', role: 'PM' }, sections: cv(REAL_ROWS) });
  ctx.api.snapshot();
  const NEWER_REAL = [HEADER, ['Newer focus', 'A user edit made after the snapshot - must survive.']];
  ctx.setSections(cv(NEWER_REAL));       // user edited to a different REAL value
  ctx.advanceClock(5000);
  ctx.api.reapply();
  const sec = ctx.sections().cv.find((s) => s.id === 'core_comp');
  assert.deepEqual(sec.rows, NEWER_REAL, 'a real live value is never clobbered by the snapshot');
});

test('no cross-application bleed: a snapshot from another app does not heal this one', () => {
  const ctx = makeSandbox({ meta: { company: 'Acme', role: 'PM' }, sections: cv(REAL_ROWS) });
  ctx.api.snapshot();                    // snapshot stored under Acme|PM
  ctx.store.set('meta', JSON.stringify({ company: 'Globex', role: 'BA' }));
  ctx.setSections(cv(PLACEHOLDER_ROWS));
  ctx.advanceClock(5000);
  ctx.api.reapply();
  const sec = ctx.sections().cv.find((s) => s.id === 'core_comp');
  assert.deepEqual(sec.rows, PLACEHOLDER_ROWS, 'no snapshot for Globex|BA - left as-is, no Acme bleed');
});

test('kill switch: antcv:disable-corecomp-guard blocks restore', () => {
  const ctx = makeSandbox({ meta: { company: 'Acme', role: 'PM' }, sections: cv(REAL_ROWS) });
  ctx.api.snapshot();
  ctx.setSections(cv(PLACEHOLDER_ROWS));
  ctx.store.set('antcv:disable-corecomp-guard', '1');
  ctx.advanceClock(5000);
  ctx.api.run();                         // run() honors the kill switch; reapply() does not
  const sec = ctx.sections().cv.find((s) => s.id === 'core_comp');
  assert.deepEqual(sec.rows, PLACEHOLDER_ROWS, 'disabled guard does not heal');
});
