// PRV-004 / VF-015: antcv-stale-status.js must derive a REAL in-flight signal
// from window.__antcvProcState (the phase map app.js writes), since the four
// legacy busy flags are never assigned. Watchdog must clear a stuck 'working'.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '..', '..', 'antcv-stale-status.js'), 'utf8');

// Minimal DOM/window stubs so the IIFE can run under node.
const realNow = Date.now;
let nowMs = 1_000_000;
function loadSidecar() {
  const elStub = () => ({ appendChild() {}, style: {}, setAttribute() {}, removeAttribute() {}, dataset: {}, classList: { add() {}, remove() {} }, addEventListener() {} });
  globalThis.window = {
    __antcvProcState: undefined,
    addEventListener() {},
    dispatchEvent() {},
    requestAnimationFrame: (fn) => fn(),
  };
  globalThis.document = {
    querySelector: () => null,
    getElementById: () => null,
    createElement: elStub,
    head: { appendChild() {} },
  };
  globalThis.localStorage = { getItem: () => null, setItem() {} };
  globalThis.CustomEvent = class { constructor(t, o) { this.type = t; Object.assign(this, o || {}); } };
  globalThis.Date.now = () => nowMs;
  // eslint-disable-next-line no-eval
  (0, eval)(src);
  return globalThis.window.AntcvStaleStatus;
}

test('PRV-004: a section in an active phase reads busy', () => {
  const api = loadSidecar();
  globalThis.window.__antcvProcState = { r1: 'working', r2: 'queued' };
  assert.equal(api._procActive(), true);
  assert.equal(api._isBusy(), true);
  globalThis.Date.now = realNow;
});

test('PRV-004: all-done / empty / missing phase map reads NOT busy (dismissible)', () => {
  const api = loadSidecar();
  globalThis.window.__antcvProcState = { r1: 'done', r2: 'done' };
  assert.equal(api._procActive(), false);
  assert.equal(api._isBusy(), false);
  globalThis.window.__antcvProcState = {};
  assert.equal(api._isBusy(), false);
  globalThis.window.__antcvProcState = undefined;
  assert.equal(api._isBusy(), false);
  globalThis.Date.now = realNow;
});

test('PRV-004: watchdog clears a stuck "working" after the timeout', () => {
  nowMs = 5_000_000;
  const api = loadSidecar();
  globalThis.window.__antcvProcState = { r1: 'working' };
  assert.equal(api._procBusy(), true, 'busy at t0');
  // advance 5 minutes — still within the 10-minute watchdog
  nowMs += 5 * 60 * 1000;
  assert.equal(api._procBusy(), true, 'still busy at +5min');
  // advance past the 10-minute watchdog with no fresh activity
  nowMs += 6 * 60 * 1000;
  assert.equal(api._procBusy(), false, 'watchdog cleared the stuck state');
  globalThis.Date.now = realNow;
});

test('PRV-004: forceDismissible escape hatch wins even while busy', () => {
  const api = loadSidecar();
  globalThis.localStorage.getItem = (k) => (k === 'antcvStaleStatusForceDismissible' ? '1' : null);
  globalThis.window.__antcvProcState = { r1: 'working' };
  assert.equal(api._isBusy(), false);
  globalThis.localStorage.getItem = () => null;
  globalThis.Date.now = realNow;
});
