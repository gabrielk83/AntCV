// SCROLL-DISPATCH-DAMPER-001 (owner 2026-09-30 "notice how jumpy we are now"): the sidebar equalizer's
// synthetic scroll re-rendered the preview, which re-ran the equalizer - the page cycled through 3 heights
// ~5x/s. A synthetic scroll now fires only for a new scrollHeight, at most once per 400 ms, with a breaker.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../antcv-sidebar-fill-equalize-227.js'), 'utf8').replace(/\r\n/g, '\n');
const body = src.slice(src.indexOf('  var __scrollSeen = []'), src.indexOf('\n  }\n', src.indexOf('function scrollDispatchAllowed')) + 4);

function make(clock) {
  // eslint-disable-next-line no-new-func
  return new Function('Date', body + '\nreturn scrollDispatchAllowed;')({ now: () => clock.t });
}

test('a repeating 3-height cycle dispatches each height once, then stops', () => {
  const clock = { t: 0 }, allow = make(clock);
  const hs = [3297, 2997, 3029];
  let fired = 0;
  for (let i = 0; i < 30; i++) { clock.t += 500; if (allow({ scrollHeight: hs[i % 3], clientHeight: 800 })) fired++; }
  assert.equal(fired, 3);
});

test('rate limit and breaker', () => {
  const clock = { t: 0 }, allow = make(clock);
  assert.equal(allow({ scrollHeight: 100, clientHeight: 1 }), true);
  clock.t += 100;
  assert.equal(allow({ scrollHeight: 200, clientHeight: 1 }), false, 'inside 400 ms');
  let fired = 0;
  for (let i = 0; i < 12; i++) { clock.t += 450; if (allow({ scrollHeight: 1000 + i, clientHeight: 1 })) fired++; }
  assert.ok(fired <= 6, 'breaker caps a runaway growth: ' + fired);
});

test('both dispatch paths are gated', () => {
  assert.equal(src.split("typeof Event === 'function' && scrollDispatchAllowed(scrollContainer)").length - 1, 2);
});
