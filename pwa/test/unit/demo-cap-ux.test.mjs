// demo-cap-ux.test.mjs
// ============================================================
// DEMO-CAP-UX-001 (owner 2026-07-03): when the demo-proxy returns
// demo_cap_reached (the per-user MONTHLY budget shared by ALL demo
// providers — see workers/*/src/demo-enforcement.js), the client cascade
// used to classify it as a plain rate_limit, retry all four providers
// (each one 429s on the same shared budget), and end with "every provider
// is rate-limited right now. Wait a minute and retry." — wrong advice for
// a monthly cap. The fix: detect demo_cap_reached in the callLLM catch,
// stop the ladder with a clear DEMO BUDGET USED UP error + credit banner,
// and fail fast on later tasks via a session flag. BYOK bypasses the cap
// server-side (keySource === 'client'), so users with their own keys are
// never blocked by the gate.
// String-level assertions on BOTH app.src.js and the deployed app.js.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const src = await readFile(new URL('../../app.src.js', import.meta.url), 'utf8');
const app = await readFile(new URL('../../app.js', import.meta.url), 'utf8');

const count = (hay, needle) => hay.split(needle).length - 1;

test('demo_cap_reached is detected and stops the ladder in BOTH files', () => {
  for (const [marker, want] of [
    // set once in the catch block, checked once in the fail-fast gate
    ['__antcvDemoCapReached', 2],
    // the ladder-stop error + the fail-fast error
    ['DEMO BUDGET USED UP', 2],
    ['switching providers cannot help', 1],
    // banner text through __antcvCreditBannerSet
    ['All demo providers share this budget.', 1],
  ]) {
    assert.equal(count(src, marker), want, `src "${marker}" x${count(src, marker)} (want ${want})`);
    assert.equal(count(app, marker), want, `app.js "${marker}" x${count(app, marker)} (want ${want})`);
  }
});

test('the fail-fast gate only blocks users WITHOUT their own keys (BYOK bypasses the cap)', () => {
  // the gate must consult all four own-key slots before throwing
  const gateIdxSrc = src.indexOf('if (window.__antcvDemoCapReached)');
  const gateIdxApp = app.indexOf('if(window.__antcvDemoCapReached)');
  assert.equal(gateIdxSrc > 0, true, 'src gate present');
  assert.equal(gateIdxApp > 0, true, 'app.js gate present');
  for (const key of ['"apiKey"', '"openaiKey"', '"mistralKey"', '"geminiKey"']) {
    assert.equal(src.slice(gateIdxSrc, gateIdxSrc + 900).includes(key), true, 'src gate reads ' + key);
    assert.equal(app.slice(gateIdxApp, gateIdxApp + 600).includes(key), true, 'app.js gate reads ' + key);
  }
});

test('the worker-side cap contract the client relies on is intact', async () => {
  // demo-enforcement pair byte-identical; cap is per-user (email+month), not
  // per-provider — the reason the client must NOT cascade on demo_cap_reached.
  const eng = await readFile(new URL('../../../workers/proxy/src/demo-enforcement.js', import.meta.url), 'utf8');
  const demo = await readFile(new URL('../../../workers/demo-proxy/src/demo-enforcement.js', import.meta.url), 'utf8');
  assert.equal(eng === demo, true, 'proxy/demo-proxy demo-enforcement drifted');
  assert.equal(eng.includes("error: 'demo_cap_reached'"), true, 'cap error token');
  assert.equal(eng.includes('demo_usage:${hash}:${currentMonthKey()}'), true, 'per-user monthly KV key (no provider dimension)');
});

test('no "use strict" was introduced into the deployed bundle (APPJS-BLUESCREEN-001 guard)', () => {
  assert.equal(app.startsWith('(()=>{'), true, 'bundle head intact');
  assert.equal(/^\s*['"]use strict['"]/.test(app), false);
});
