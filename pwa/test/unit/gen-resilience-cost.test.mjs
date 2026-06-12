// gen-resilience-cost.test.mjs
// ============================================================
// Locks three 1.50.408 behaviours into the source:
//  - GEN-THROTTLE-RESIST-001: calls wait for tab visibility before firing,
//    a hidden-tab network drop retries WITHOUT burning the transient
//    ladder, and the generating screen holds a screen wake lock.
//  - GEN-COST-CEILING-001: per-generation cost meter (reset on Generate,
//    accumulated per call), over-ceiling -> single provider + consensus
//    skipped; ceiling UI input next to the Speed pills.
//  - LLM-ONBOARD-001: only audit-APPROVED custom LLMs join the ladder
//    (at the back), dispatch + pricing handle 'custom:<id>'.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const src = await readFile(new URL('../../app.src.js', import.meta.url), 'utf8');

test('THROTTLE: visibility-wait + hidden-retry + wake lock in the source', () => {
  assert.match(src, /const __waitVisible = \(\)/);
  // fire-gate: wait for visibility before every provider call
  assert.match(src, /await __waitVisible\(\);\s*if \(0 === String\(a\)\.indexOf\("custom:"\)\)/);
  // hidden-tab drop retries without burning the ladder, capped at 3
  assert.match(src, /"hidden" === document\.visibilityState && __hv < 3/);
  assert.match(src, /ladder preserved/);
  // wake lock held during the generating screen
  assert.match(src, /navigator\.wakeLock &&\s*"hidden" !== document\.visibilityState &&\s*\(e = await navigator\.wakeLock\.request\("screen"\)\)/);
});

test('COST CEILING: meter + enforcement + UI in the source', () => {
  assert.match(src, /antcv:genCostCeiling/);
  assert.match(src, /const __overCostCeil = /);
  // reset on Generate, accumulate per call
  assert.match(src, /window\.__antcvGenCost = 0;/);
  assert.match(src, /window\.__antcvGenCost = \(window\.__antcvGenCost \|\| 0\) \+ y\)/);
  // over-ceiling: single provider + consensus skipped
  assert.match(src, /if \(__overCostCeil\(\) && l\.length > 1\)/);
  assert.match(src, /Wa && "fast" !== __genSpeed\(\) && !__overCostCeil\(\)/);
  // the cap input next to the Speed pills
  assert.match(src, /data-antcv-gencostceil/);
});

test('COST CEILING: mirrored semantics', () => {
  const over = (ceil, spent) => ceil > 0 && spent >= ceil;
  assert.equal(over(0, 99), false);     // no ceiling set
  assert.equal(over(0.5, 0.49), false); // under
  assert.equal(over(0.5, 0.5), true);   // at
  assert.equal(over(0.5, 0.51), true);  // over
});

test('LLM-ONBOARD: approved-only filter, ladder join, dispatch, pricing', () => {
  // only approved entries are routing-eligible
  assert.match(src, /"approved" === e\.status && e\.baseUrl && e\.model/);
  // approved customs join the BACK of the ladder before the quality reorder
  assert.match(src, /l\.includes\(__pid\) \|\| l\.push\(__pid\);/);
  // dispatch branch + the custom caller
  assert.match(src, /n = await __callCustomLlm\(a, e, t\);/);
  assert.match(src, /const __callCustomLlm = async/);
  // custom pricing feeds the cost telemetry
  assert.match(src, /\(__customLlmById\(a\) \|\| \{\}\)\.pricing/);
});

test('LLM-ONBOARD: lab sidecar wired into index.html, approve gated on audit', async () => {
  const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
  assert.match(html, /antcv-llm-lab-408\.js\?v=/);
  const lab = await readFile(new URL('../../antcv-llm-lab-408.js', import.meta.url), 'utf8');
  // approve only when the critical battery passes
  assert.match(lab, /var ok = !!\(rec\.audit && rec\.audit\.pass\);/);
  assert.match(lab, /out\.pass = !!\(out\.probes\.instruction && out\.probes\.instruction\.pass/);
  // registry entries on audit + approval
  assert.match(lab, /registryAppend\(\{ kind: 'llm-audit'/);
  assert.match(lab, /registryAppend\(\{ kind: 'llm-approved'/);
});
