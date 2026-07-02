// sidebar-promote-margin.test.mjs
// ============================================================
// SIDEBAR-PROMOTE-MARGIN-001 (owner 2026-07-03): removing one line from a sidebar
// subsubsection made the PREVIEW pull the next group up a page while the PDF kept
// it down. The coordinator's pure gate __promoteMarginGate allows a group
// PROMOTION only when the destination page keeps >= margin px free; marginal
// fits stay on the settled page (matching the PDF); real slack still reclaims.
// The DOM half is smoke-checked by pwa/test/diag-sidebar-promote-margin.mjs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-auto-pagebreak-block-001.js', import.meta.url), 'utf8');

function load() {
  const store = new Map();
  const sandbox = {
    window: { addEventListener() {}, dispatchEvent() { return true; }, requestAnimationFrame: (f) => 0 },
    document: {
      readyState: 'loading',
      addEventListener() {}, querySelector: () => null, querySelectorAll: () => [],
      createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
      documentElement: {}, body: null,
    },
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    console: { info() {}, warn() {}, log() {}, error() {}, debug() {} },
    setTimeout() { return 0; }, clearTimeout() {}, setInterval() { return 0; }, clearInterval() {},
    MutationObserver: function () { this.observe = () => {}; this.disconnect = () => {}; },
    CustomEvent: function (t, o) { this.type = t; Object.assign(this, o); },
    getComputedStyle: () => ({}),
    JSON, Array, Object, Error, RegExp, Math, String, Number, Boolean, isFinite, parseInt, parseFloat, Date, Infinity, NaN,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.window.AntcvAutoPagebreak;
}
const api = load();
const gate = api._promoteMarginGate;

// A sidebar section "reg" with two groups: A (rows 1-3, header 0) and ENV
// (header 4, rows 5-7). Heights: page cap 800; page 2 currently carries 770px of
// content INCLUDING env — env "fits" by 30px, which is under the 45px margin.
function paged(envOn) {
  // keys are section item indexes; env group = keys 4..7
  return [
    { sid: 'reg', kind: 'item', key: '0', page: 2 },
    { sid: 'reg', kind: 'item', key: '1', page: 2 },
    { sid: 'reg', kind: 'item', key: '2', page: 2 },
    { sid: 'reg', kind: 'item', key: '3', page: 2 },
    { sid: 'reg', kind: 'item', key: '4', page: envOn },
    { sid: 'reg', kind: 'item', key: '5', page: envOn },
    { sid: 'reg', kind: 'item', key: '6', page: envOn },
    { sid: 'reg', kind: 'item', key: '7', page: envOn },
  ];
}
const GROUPS = { reg: [{ key: 'reg#group a', start: 0 }, { key: 'reg#environmental', start: 4 }] };
function heightsFor(fillWithEnvOnP2) {
  // group A = 4 blocks x 100 = 400; env = 4 blocks x h
  const h = (fillWithEnvOnP2 - 400) / 4;
  const out = {};
  for (let k = 0; k <= 3; k++) out['reg|' + k] = 100;
  for (let k = 4; k <= 7; k++) out['reg|' + k] = h;
  return out;
}
const P1CAP = 700, NCAP = 800, MARGIN = 45;

test('marginal promotion is BLOCKED: env settled on 3, new layout squeezes it onto page 2 with <margin free', () => {
  const p = paged(2);                                    // coordinator wants env on page 2
  const stick = { 'reg#environmental': 3 };              // last settled: page 3 (what the PDF shows)
  const next = gate(p, heightsFor(770), GROUPS, stick, P1CAP, NCAP, MARGIN);   // 800-770=30 < 45
  assert.ok(p.filter((b) => +b.key >= 4).every((b) => b.page === 3), 'env group forced back to page 3');
  assert.equal(next['reg#environmental'], 3, 'stick stays at 3');
  assert.ok(p.filter((b) => +b.key < 4).every((b) => b.page === 2), 'earlier group untouched');
});

test('promotion with REAL slack is allowed (reclaim — no SIDEBAR-SHRINK-RECLAIM regression)', () => {
  const p = paged(2);
  const stick = { 'reg#environmental': 3 };
  const next = gate(p, heightsFor(700), GROUPS, stick, P1CAP, NCAP, MARGIN);   // 800-700=100 >= 45
  assert.ok(p.filter((b) => +b.key >= 4).every((b) => b.page === 2), 'env group promoted to page 2');
  assert.equal(next['reg#environmental'], 2, 'stick settles at 2');
});

test('first run (no stick) never blocks; stick is seeded', () => {
  const p = paged(2);
  const next = gate(p, heightsFor(795), GROUPS, {}, P1CAP, NCAP, MARGIN);      // tight but no history
  assert.ok(p.filter((b) => +b.key >= 4).every((b) => b.page === 2));
  assert.equal(next['reg#environmental'], 2);
});

test('demotion (moving DOWN) is never interfered with', () => {
  const p = paged(4);                                    // coordinator pushed env DOWN to 4
  const stick = { 'reg#environmental': 3 };
  const next = gate(p, heightsFor(900), GROUPS, stick, P1CAP, NCAP, MARGIN);
  assert.ok(p.filter((b) => +b.key >= 4).every((b) => b.page === 4), 'demotion untouched');
  assert.equal(next['reg#environmental'], 4, 'stick follows the demotion');
});

test('page-1 promotions use the page-1 cap', () => {
  const p = [
    { sid: 'reg', kind: 'item', key: '0', page: 1 },
    { sid: 'reg', kind: 'item', key: '4', page: 1 },
  ];
  const stick = { 'reg#environmental': 2 };
  const heights = { 'reg|0': 400, 'reg|4': 280 };        // fill p1 = 680; 700-680=20 < 45
  gate(p, heights, { reg: GROUPS.reg }, stick, P1CAP, NCAP, MARGIN);
  assert.equal(p[1].page, 2, 'env kept off the tight page 1');
});

test('coordinator wiring: post-process present, config knob exposed', () => {
  assert.ok(src.includes('SIDEBAR-PROMOTE-MARGIN-001'));
  assert.ok(src.includes('__promoteMarginGate(__sPaged'));
  assert.ok(src.includes('SIDEBAR_PROMOTE_MARGIN: SIDEBAR_PROMOTE_MARGIN'));
  assert.equal(typeof api.config, 'function');
});
