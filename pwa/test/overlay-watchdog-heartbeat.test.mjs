/* OVERLAY-EARLY-HALT-001 regression guard (owner 2026-07-02).
 *
 * The kernel-showcase (unsolicited "1st-time") generation overlay had a FIXED 2-minute (12e4)
 * watchdog that force-cleared kernelShowcaseInProgress + called Bl(!1) — firing MID-GENERATION
 * (the app advertises "typically 3–6 min" and a single LLM call can run up to 10 min, the 6e5
 * abort), so the overlay closed while generation was still running and the owner saw blank
 * who/why/bring. The watchdog now uses the per-LLM-call cost meter (window.__antcvGenCost) as an
 * activity heartbeat: it only fires after a long IDLE with no LLM activity (past the single-call
 * cap) or a hard ceiling — never while the run is still spending.
 *
 * This guards BOTH the source (app.src.js) and the deployed mirror (app.js):
 *   1. the OVERLAY-EARLY-HALT-001 watchdog references window.__antcvGenCost (heartbeat present),
 *   2. IDLE_MS exceeds the 10-min (6e5) single-call abort so a slow-but-live run is never killed,
 *   3. the old fixed `},12e4)` watchdog timer is gone,
 * plus a simulation of the fire decision.
 *
 * Run:  node --test pwa/test/overlay-watchdog-heartbeat.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../app.src.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// isolate the watchdog effect in each file (window around the KERNEL-STUCK marker)
function watchdogBlock(s) {
  const i = s.indexOf('KERNEL-STUCK-LAST-CMD-001] showcase watchdog fired');
  assert.ok(i > 0, 'watchdog console.warn marker present');
  return s.slice(i - 1200, i + 400);
}

for (const [name, s] of [['app.src.js', src], ['app.js', app]]) {
  test(`${name}: watchdog uses the __antcvGenCost heartbeat (not a fixed short timer)`, () => {
    const blk = watchdogBlock(s);
    assert.match(blk, /window\.__antcvGenCost/, 'heartbeat cost meter referenced');
    assert.match(blk, /IDLE_MS/, 'IDLE_MS threshold present');
    assert.match(blk, /HARD_MS/, 'HARD_MS ceiling present');
  });

  test(`${name}: IDLE_MS is past the 10-min single-call abort (6e5)`, () => {
    const blk = watchdogBlock(s);
    const m = blk.match(/IDLE_MS\s*=\s*([0-9]+e?[0-9]*)/);
    assert.ok(m, 'IDLE_MS assigned a literal');
    const idle = Number(m[1]);
    assert.ok(idle > 6e5, `IDLE_MS (${idle}) must exceed the 10-min single-call cap 600000`);
  });
}

test('the old fixed 2-minute (},12e4) showcase watchdog timer is gone from both files', () => {
  // the visibility-wait timer (12e4) is unrelated and lives in __waitVisible; the watchdog one
  // ended with `},12e4);return()=>clearTimeout(e)` — assert THAT exact shape is gone.
  const gone = (s) => !/showcase in-progress watchdog fired/.test(s) && !/},12e4\);return\(\)=>clearTimeout\(e\)\},\[[a-zA-Z]+\]\),React\.useEffect/.test(s);
  assert.ok(gone(src), 'app.src.js no longer has the fixed 2-min watchdog');
  assert.ok(gone(app), 'app.js no longer has the fixed 2-min watchdog');
});

test('fire decision: alive while cost moves; fires only on long idle or hard ceiling', () => {
  const IDLE_MS = 66e4, HARD_MS = 12e5;
  const decide = (idle, total) => idle >= IDLE_MS || total >= HARD_MS;
  // still spending, 5 min in, last cost move 20s ago -> keep overlay up
  assert.equal(decide(20e3, 3e5), false, 'live run must NOT fire');
  // 4 min in, cost moved 10s ago -> keep up (the old 12e4 bug fired here)
  assert.equal(decide(10e3, 24e4), false, 'a 4-min live run must NOT fire (was the bug)');
  // genuinely stuck: 11.5 min with no cost movement -> fire
  assert.equal(decide(69e4, 8e5), true, 'idle past the single-call cap fires');
  // wedged forever but cost trickled: hit the hard ceiling -> fire
  assert.equal(decide(1e3, 12e5), true, 'hard ceiling fires');
});
