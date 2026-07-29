// sidebar-balance-gate.test.mjs
// ============================================================
// SIDEBAR-BALANCE-001 (GOLD-TARGET-LAYOUT-DENSITY-001 A2, owner 2026-07-12):
// the per-column greedy paginator dumps the sidebar's whole deficit on the
// LAST page (owner screenshots: page-1 sidebar full, page-2 sidebar ends a
// blank band above the main column). __balanceGate demotes a trailing whole
// unit down a page when that strictly reduces the worst per-page gap —
// whole-unit moves only (header travels with rows), fit-checked, idempotent.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-auto-pagebreak-block-001.js', import.meta.url), 'utf8');

function load() {
  const store = new Map();
  const sandbox = {
    window: { addEventListener() {}, dispatchEvent() { return true; }, requestAnimationFrame: () => 0 },
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
const gate = api._balanceGate;

// Fixture: sidebar section "tools" with 3 groups (A: 0-2, B: 3-5, C: 6-8) and an
// ungrouped section "langs" (keys 0-3). Main column runs 2 pages. Caps 800/900.
function mkPaged(pages) {
  // pages: { 'tools:0'..'tools:8': page, 'langs:0'..: page }
  const out = [];
  for (let k = 0; k <= 8; k++) out.push({ sid: 'tools', key: String(k), page: pages[`tools:${k}`] });
  for (let k = 0; k <= 3; k++) out.push({ sid: 'langs', key: String(k), page: pages[`langs:${k}`] });
  return out;
}
const GROUPS = { tools: [{ key: 'tools#a', start: 0 }, { key: 'tools#b', start: 3 }, { key: 'tools#c', start: 6 }], langs: [] };
function mkHeights(h) {
  const out = {};
  for (let k = 0; k <= 8; k++) out[`tools|${k}`] = h;
  for (let k = 0; k <= 3; k++) out[`langs|${k}`] = h;
  return out;
}
const MAIN_2PG = [{ sid: 'exp', key: '0', page: 1 }, { sid: 'exp', key: '1', page: 2 }];

test('the classic defect balances: full page 1, blank-band page 2', () => {
  // 80px blocks. Page 1: tools A+B+C (9 blocks, 720px, gap 80). Page 2: langs
  // (4 blocks, 320px, gap 580 -> the blank band). Moving group C (240px) down:
  // gaps become 320/340 -> worst 340, a 240px gain.
  const paged = mkPaged({
    'tools:0': 1, 'tools:1': 1, 'tools:2': 1, 'tools:3': 1, 'tools:4': 1, 'tools:5': 1,
    'tools:6': 1, 'tools:7': 1, 'tools:8': 1,
    'langs:0': 2, 'langs:1': 2, 'langs:2': 2, 'langs:3': 2,
  });
  const moves = gate(paged, MAIN_2PG, mkHeights(80), GROUPS, 800, 900, 160, 60);
  assert.equal(moves.length, 1);
  assert.deepEqual({ unit: moves[0].unit, from: moves[0].from, to: moves[0].to }, { unit: 'tools#c', from: 1, to: 2 });
  // whole group moved together, header row included
  for (const k of ['6', '7', '8']) {
    assert.equal(paged.find(b => b.sid === 'tools' && b.key === k).page, 2, `tools:${k} demoted`);
  }
  // groups A/B untouched
  assert.equal(paged.find(b => b.sid === 'tools' && b.key === '0').page, 1);
});

test('idempotent: re-running on balanced output is a no-op', () => {
  const paged = mkPaged({
    'tools:0': 1, 'tools:1': 1, 'tools:2': 1, 'tools:3': 1, 'tools:4': 1, 'tools:5': 1,
    'tools:6': 1, 'tools:7': 1, 'tools:8': 1,
    'langs:0': 2, 'langs:1': 2, 'langs:2': 2, 'langs:3': 2,
  });
  gate(paged, MAIN_2PG, mkHeights(80), GROUPS, 800, 900, 160, 60);
  const snapshot = JSON.stringify(paged);
  const again = gate(paged, MAIN_2PG, mkHeights(80), GROUPS, 800, 900, 160, 60);
  assert.equal(again.length, 0, 'no further moves');
  assert.equal(JSON.stringify(paged), snapshot);
});

test('no move when the unit does not fit under the destination cap', () => {
  // page 2 nearly full: langs 4x200=800 of 900 -> group C (240) cannot fit
  const paged = mkPaged({
    'tools:0': 1, 'tools:1': 1, 'tools:2': 1, 'tools:3': 1, 'tools:4': 1, 'tools:5': 1,
    'tools:6': 1, 'tools:7': 1, 'tools:8': 1,
    'langs:0': 2, 'langs:1': 2, 'langs:2': 2, 'langs:3': 2,
  });
  const heights = mkHeights(80);
  for (let k = 0; k <= 3; k++) heights[`langs|${k}`] = 200;
  const moves = gate(paged, MAIN_2PG, heights, GROUPS, 800, 900, 160, 60);
  assert.equal(moves.length, 0);
});

test('never empties a page: sole remaining unit stays put', () => {
  // page 1 sidebar holds ONLY group A; page 2 has langs and a big gap
  const paged = mkPaged({
    'tools:0': 1, 'tools:1': 1, 'tools:2': 1,
    'tools:3': 2, 'tools:4': 2, 'tools:5': 2, 'tools:6': 2, 'tools:7': 2, 'tools:8': 2,
    'langs:0': 2, 'langs:1': 2, 'langs:2': 2, 'langs:3': 2,
  });
  const moves = gate(paged, MAIN_2PG, mkHeights(30), GROUPS, 800, 900, 160, 60);
  assert.equal(moves.length, 0, 'single-unit page is never emptied');
});

test('inert on 1-page docs, when disabled, and below the gap threshold', () => {
  const mk = () => mkPaged({
    'tools:0': 1, 'tools:1': 1, 'tools:2': 1, 'tools:3': 1, 'tools:4': 1, 'tools:5': 1,
    'tools:6': 1, 'tools:7': 1, 'tools:8': 1,
    'langs:0': 2, 'langs:1': 2, 'langs:2': 2, 'langs:3': 2,
  });
  assert.equal(gate(mk(), [{ sid: 'exp', key: '0', page: 1 }], mkHeights(80), GROUPS, 800, 900, 160, 60).length, 0, '1 main page');
  assert.equal(gate(mk(), MAIN_2PG, mkHeights(80), GROUPS, 800, 900, 0, 60).length, 0, 'maxGap 0 disables');
  // gaps 80/580 but threshold 600 -> tolerated
  assert.equal(gate(mk(), MAIN_2PG, mkHeights(80), GROUPS, 800, 900, 600, 60).length, 0, 'below threshold');
});

test('LAST-PAGE RULE: sidebar targets the main bottom, not the page cap', () => {
  // gold-calibrated: main ends 400px into page 2 -> the sidebar's page-2
  // deficit is judged against 400, not nCap 900. Gaps: p1 = 800-720 = 80,
  // p2 = 400-320 = 80 -> already balanced, NO move (without the rule the
  // p2 gap would read 580 and group C would be dragged down).
  const paged = mkPaged({
    'tools:0': 1, 'tools:1': 1, 'tools:2': 1, 'tools:3': 1, 'tools:4': 1, 'tools:5': 1,
    'tools:6': 1, 'tools:7': 1, 'tools:8': 1,
    'langs:0': 2, 'langs:1': 2, 'langs:2': 2, 'langs:3': 2,
  });
  const heights = mkHeights(80);
  heights['exp|0'] = 700; heights['exp|1'] = 400;   // main column block heights
  const moves = gate(paged, MAIN_2PG, heights, GROUPS, 800, 900, 160, 60);
  assert.equal(moves.length, 0, 'balanced against the main bottom — no move');
});

test('wiring: post-process block + config knobs + export are present', () => {
  assert.equal(src.includes('SIDEBAR-BALANCE-001 post-process'), true);
  assert.equal(src.split('__balanceGate(__sPaged, __mPaged').length - 1, 1, 'invoked once');
  assert.equal(src.includes('_balanceGate: __balanceGate'), true);
  assert.equal(src.includes('o.SIDEBAR_BALANCE_MAX_GAP'), true, 'config-settable');
  const cfg = api.config();
  assert.equal(cfg.SIDEBAR_BALANCE_MAX_GAP, 160);
  assert.equal(cfg.SIDEBAR_BALANCE_MIN_GAIN, 60);
});
