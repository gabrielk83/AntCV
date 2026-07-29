/* ROW 74C — background SSE stall / visibility-aware abort budget.
 *
 * callClaude (app.src.js `q` / app.js `we`) used a FIXED 10-minute wall-clock
 * `setTimeout(()=>p.abort(),6e5)`. On mobile a briefly-backgrounded gen throttles
 * `reader.read()` while the wall-clock keeps burning, so a thorough 3-6 min gen
 * that is app-switched away could hit the abort wall and die even though the
 * stream would resume on foreground.
 *
 * FIX: __antcvAbortBudget wraps a pausable budget — foreground-only elapsed does
 * NOT count time while document.hidden, with an absolute wall ceiling as a
 * safety net. Kill-switch localStorage 'antcv:disable-bg-timeout-pause'==='1'
 * restores the exact old fixed setTimeout.
 *
 * This test extracts the REAL shipped pure state machine (__antcvMakeAbortBudget)
 * and the wiring (__antcvAbortBudget) from BOTH files via node:vm and asserts:
 *   1. hidden time does not count toward the foreground limit,
 *   2. foreground 10-min (6e5) triggers abort,
 *   3. the 20-min (12e5) wall ceiling triggers even while permanently hidden,
 *   4. the kill-switch restores a fixed setTimeout (no visibility pausing).
 * Plus static guards that the old fixed-abort site is gone and the clears wire
 * to the budget handle.
 *
 * Run:  node --test pwa/test/unit/sse-bg-timeout-budget.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync(new URL('../../app.src.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../../app.js', import.meta.url), 'utf8');

// ---- extract a top-level function body text by name up to a stop marker ----
function slice(s, startMarker, stopMarker) {
  const i = s.indexOf(startMarker);
  assert.ok(i >= 0, `marker present: ${startMarker}`);
  const j = s.indexOf(stopMarker, i + startMarker.length);
  assert.ok(j > i, `stop marker present: ${stopMarker}`);
  return s.slice(i, j);
}

// Evaluate the pure state-machine factory out of a file, with an injected clock.
function loadMake(s) {
  const body = slice(s, 'function __antcvMakeAbortBudget', 'function __antcvAbortBudget');
  const ctx = {};
  vm.runInNewContext(body + '\nthis.__f = __antcvMakeAbortBudget;', ctx);
  return ctx.__f;
}

// Evaluate the wiring, injecting fake localStorage/document/timers so we can
// observe WHICH scheduling path (fixed setTimeout vs pausable interval) it took.
function loadBudget(s, { disabled, hidden }) {
  const makeBody = slice(s, 'function __antcvMakeAbortBudget', 'function __antcvAbortBudget');
  // wiring runs up to the callClaude function that follows it in each file
  const stop = s.includes('async function we(') ? 'async function we(' : 'async function q(';
  const wireBody = slice(s, 'function __antcvAbortBudget', stop);
  const calls = { setTimeout: 0, setInterval: 0, addListener: 0 };
  const ctx = {
    Date,
    localStorage: { getItem: () => (disabled ? '1' : null) },
    document: {
      hidden,
      addEventListener: () => { calls.addListener++; },
      removeEventListener: () => {},
    },
    setTimeout: () => { calls.setTimeout++; return 1; },
    clearTimeout: () => {},
    setInterval: () => { calls.setInterval++; return 2; },
    clearInterval: () => {},
  };
  vm.runInNewContext(makeBody + '\n' + wireBody + '\nthis.__b = __antcvAbortBudget;', ctx);
  const handle = ctx.__b({ abort() {} });
  return { handle, calls };
}

const FG = 6e5;   // 10 min foreground-only
const WALL = 12e5; // 20 min absolute wall ceiling

for (const [name, s] of [['app.src.js', src], ['app.js', app]]) {
  test(`${name}: hidden time does NOT count toward the foreground limit`, () => {
    let t = 0;
    const make = loadMake(s);
    const b = make(FG, WALL, () => t);
    // run foreground 5 min
    t = 3e5;
    assert.equal(b.check(), false, 'not yet at fg limit');
    // go hidden and stay hidden for 30 min of wall time — fg must freeze
    b.onHidden();
    t = 3e5 + 18e5; // 30 min hidden (but under 20-min WALL? no — 35 min wall)
    // wall (35 min) exceeds ceiling so it WILL fire on wall — narrow the window:
    // re-run with a hidden gap under the wall ceiling to isolate the fg-freeze.
    let t2 = 0;
    const b2 = make(FG, WALL, () => t2);
    t2 = 3e5;            // 5 min foreground
    b2.onHidden();
    t2 = 3e5 + 6e5;      // + 10 min hidden  => wall 15 min (< 20), fg still 5 min
    assert.equal(b2.check(), false, 'fg frozen while hidden: 5 min fg, 15 min wall');
    b2.onVisible();
    t2 = 3e5 + 6e5 + 2e5; // + 2 min foreground => fg 7 min total
    assert.equal(b2.check(), false, 'fg is 7 min (< 10), still alive despite 17 min wall');
  });

  test(`${name}: foreground 10-min (6e5) triggers abort`, () => {
    let t = 0;
    const b = loadMake(s)(FG, WALL, () => t);
    t = 6e5 - 1;
    assert.equal(b.check(), false, 'just under 10 min fg');
    t = 6e5;
    assert.equal(b.check(), true, '10 min foreground fires');
  });

  test(`${name}: 20-min (12e5) wall ceiling fires even while permanently hidden`, () => {
    let t = 0;
    const b = loadMake(s)(FG, WALL, () => t);
    b.onHidden();          // hidden from the start — fg never accrues
    t = 12e5 - 1;
    assert.equal(b.check(), false, 'under wall ceiling, fg is 0');
    t = 12e5;
    assert.equal(b.check(), true, 'wall ceiling fires despite fg being frozen at 0');
  });

  test(`${name}: kill-switch restores fixed setTimeout (no pausable interval)`, () => {
    const off = loadBudget(s, { disabled: true, hidden: false });
    assert.equal(off.calls.setTimeout, 1, 'kill-switch path schedules ONE fixed setTimeout');
    assert.equal(off.calls.setInterval, 0, 'kill-switch path does NOT arm the pausable interval');
    assert.equal(off.calls.addListener, 0, 'kill-switch path adds NO visibility listener');

    const on = loadBudget(s, { disabled: false, hidden: false });
    assert.equal(on.calls.setInterval, 1, 'default path arms the pausable interval');
    assert.equal(on.calls.addListener, 1, 'default path listens for visibilitychange');
    assert.equal(on.calls.setTimeout, 0, 'default path uses no fixed setTimeout');
    assert.equal(typeof on.handle.clear, 'function', 'returns a { clear } handle');
  });

  test(`${name}: old fixed p.abort() setTimeout site is gone; clears wire to budget handle`, () => {
    assert.ok(!/setTimeout\(\s*\(\)\s*=>\s*p\.abort\(\)\s*,\s*6e5\s*\)/.test(s),
      'the fixed setTimeout(()=>p.abort(),6e5) is gone');
    assert.match(s, /=\s*__antcvAbortBudget\(p\)/, 'callClaude builds the pausable budget');
    // the callClaude cleanup path clears the handle, not a raw timeout id
    assert.ok(!/clearTimeout\(g\)/.test(s) && !/clearTimeout\(u\)/.test(s),
      'no raw clearTimeout of the abort handle remains');
  });
}
