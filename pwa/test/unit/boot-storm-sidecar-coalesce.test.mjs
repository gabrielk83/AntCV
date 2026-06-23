// boot-storm-sidecar-coalesce.test.mjs
// ============================================================
// BOOT-FREEZE / [[boot-storm-gate-freeze]]: on a big doc, pagination churns
// style/class on thousands of nodes. antcv-splitter-flip.js and
// antcv-sidebar-position.js each ran a full-tree querySelectorAll on EVERY
// observer callback, and the splitter poll (named live offender) ran every 1.5s.
// 1.50.818 coalesces the observer/poll/storage paths into a trailing debounce
// (200ms / 1000ms cap) and drops attribute observation from sidebar-position
// (its apply is dataset-guarded, so attr callbacks only ever no-op).
//
// These tests load the REAL sidecars in a vm sandbox with a virtual clock and
// assert: (a) a burst of schedule() calls collapses to a single scan,
// (b) the maxWait cap still fires under a continuous storm, (c) a direct scan
// still runs immediately (behavior preserved), (d) sidebar-position observes
// childList only while splitter-flip keeps attribute observation.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const splitterSrc = await readFile(new URL('../../antcv-splitter-flip.js', import.meta.url), 'utf8');
const sidebarSrc = await readFile(new URL('../../antcv-sidebar-position.js', import.meta.url), 'utf8');

// Virtual clock + timer queue so the debounce is fully deterministic.
function makeClock() {
  let now = 0;
  let nextId = 1;
  const timers = new Map();
  return {
    now: () => now,
    setTimeout: (fn, ms) => { const id = nextId++; timers.set(id, { fn, at: now + (ms || 0) }); return id; },
    clearTimeout: (id) => { timers.delete(id); },
    // setInterval is recorded but never auto-fires — polling isn't under test.
    setInterval: () => nextId++,
    clearInterval: () => {},
    advance(ms) {
      now += ms;
      // Fire due timers in chronological order; a fired timer may queue more.
      let guard = 0;
      for (;;) {
        let due = null;
        for (const [id, t] of timers) { if (t.at <= now && (!due || t.at < due.t.at)) due = { id, t }; }
        if (!due || guard++ > 10000) break;
        timers.delete(due.id);
        due.t.fn();
      }
    },
  };
}

function makeSandbox(src, { sidebarPosition } = {}) {
  const clock = makeClock();
  const store = new Map();
  if (sidebarPosition) store.set('sidebarPosition', JSON.stringify(sidebarPosition));
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  let splitterQsaCount = 0;
  const emptyList = []; // real array → has .forEach
  const document = {
    body: { __isBody: true },
    activeElement: null,
    querySelectorAll: (sel) => { if (sel === '.antcv-col-splitter') splitterQsaCount++; return emptyList; },
    addEventListener() {},
  };
  const observed = [];
  class MutationObserver {
    constructor(cb) { this.cb = cb; }
    observe(target, opts) { observed.push({ target, opts }); }
    disconnect() {}
  }
  const sandbox = {
    window: {
      addEventListener() {},
      dispatchEvent() { return true; },
      performance: { now: () => clock.now() },
      MutationObserver,
    },
    document,
    localStorage,
    MutationObserver,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    setInterval: clock.setInterval,
    clearInterval: clock.clearInterval,
    console: { warn() {}, debug() {}, log() {}, error() {}, info() {} },
    JSON, Array, Object, Error, RegExp, Math, String, Number, Boolean, Date, isFinite, parseFloat,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return {
    sandbox, clock, store, observed,
    getSplitterScans: () => splitterQsaCount / 2, // scan() hits the selector twice
    resetSplitterScans: () => { splitterQsaCount = 0; },
  };
}

test('splitter-flip: a burst of schedule() calls collapses to ONE scan', () => {
  const ctx = makeSandbox(splitterSrc);
  const api = ctx.sandbox.window.AntcvSplitterFlip;
  assert.equal(typeof api._scheduleScan, 'function');
  assert.equal(typeof api._scan, 'function');
  // Flush the immediate + initial-pass scans (0/200/600/1500), then reset.
  ctx.clock.advance(2000);
  ctx.resetSplitterScans();

  for (let i = 0; i < 50; i++) api._scheduleScan();
  ctx.clock.advance(199);
  assert.equal(ctx.getSplitterScans(), 0, 'no scan before the debounce window elapses');
  ctx.clock.advance(2);
  assert.equal(ctx.getSplitterScans(), 1, '50 schedule calls collapse to a single scan');
});

test('splitter-flip: maxWait cap still scans under a continuous storm', () => {
  const ctx = makeSandbox(splitterSrc);
  const api = ctx.sandbox.window.AntcvSplitterFlip;
  ctx.clock.advance(2000);
  ctx.resetSplitterScans();

  // Hammer schedule() every 100ms for 2s of virtual time (never settling).
  for (let i = 0; i < 20; i++) { api._scheduleScan(); ctx.clock.advance(100); }
  const scans = ctx.getSplitterScans();
  assert.ok(scans >= 1, 'cap forces at least one scan during a continuous storm');
  assert.ok(scans <= 5, 'but still far fewer than the 20 schedule calls (was 1:1 before)');
});

test('splitter-flip: direct _scan() runs immediately (behavior preserved)', () => {
  const ctx = makeSandbox(splitterSrc);
  ctx.clock.advance(2000);
  ctx.resetSplitterScans();
  ctx.sandbox.window.AntcvSplitterFlip._scan();
  assert.equal(ctx.getSplitterScans(), 1, 'an explicit scan is synchronous, not debounced');
});

test('splitter-flip: keeps attribute observation (needed for right-mode re-flip)', () => {
  const ctx = makeSandbox(splitterSrc);
  assert.equal(ctx.observed.length, 1);
  const opts = ctx.observed[0].opts;
  assert.equal(opts.childList, true);
  assert.equal(opts.subtree, true);
  assert.equal(opts.attributes, true, 'splitter-flip must still watch style/class');
  assert.equal(Array.from(opts.attributeFilter).join(','), 'style,class');
});

test('sidebar-position: observes childList only (attribute watching dropped)', () => {
  const ctx = makeSandbox(sidebarSrc, { sidebarPosition: 'right' });
  assert.equal(ctx.observed.length, 1);
  const opts = ctx.observed[0].opts;
  assert.equal(opts.childList, true);
  assert.equal(opts.subtree, true);
  assert.ok(!opts.attributes, 'sidebar-position no longer watches attributes');
  assert.ok(!opts.attributeFilter, 'no attributeFilter');
});

test('sidebar-position: installs without throwing and flips its install flag', () => {
  const ctx = makeSandbox(sidebarSrc, { sidebarPosition: 'right' });
  assert.equal(ctx.sandbox.window.__antcvSidebarPositionInstalled, '1.50.818');
});
