// kernel-v2-reader.test.mjs
// ============================================================
// KERNEL-V2-READER-001 (register row 8a/8b): the STORED WORK HISTORY builder
// reads the STAGED v2 kernel DIRECTLY (localStorage antcv:ingestedKernel —
// the store kernel-import autoSync fills from D1 kernel_v2) and appends each
// matched role's langInvariantTokens as an explicit " | DO-NOT-TRANSLATE: …"
// tag on its role line — the list the §3 language rule (LANG-CROSS-001)
// already honors. Additive: absent/invalid kernel = byte-identical lines.
// String-level assertions on BOTH bundles + an app.js parse gate.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../app.src.js', import.meta.url), 'utf8');
const app = await readFile(new URL('../../app.js', import.meta.url), 'utf8');

const count = (hay, needle) => hay.split(needle).length - 1;

test('app.js still parses (bluescreen guard)', () => {
  assert.doesNotThrow(() => new vm.Script(app));
});

test('builder reads the staged v2 kernel directly in BOTH bundles', () => {
  assert.ok(src.includes('KERNEL-V2-READER-001'), 'src carries the ID comment');
  assert.equal(count(src, 'localStorage.getItem("antcv:ingestedKernel")'), 1, 'src reads the staged kernel once');
  assert.equal(count(app, 'localStorage.getItem("antcv:ingestedKernel")'), 1, 'app.js reads the staged kernel once');
});

test('role line carries the DO-NOT-TRANSLATE tag from langInvariantTokens', () => {
  // src: helper defined and called on the role line after the CURRENT ROLE tag
  assert.match(src, /const v2Toks = \(company, title\)/);
  assert.match(src, /\(e\.isCurrent === true \? " \| CURRENT ROLE" : ""\) \+\s*v2Toks\(company, title\) \+/);
  assert.match(src, /" \| DO-NOT-TRANSLATE: " \+ toks\.join\(", "\)/);
  // app.js mirror: __v2k lookup + __v2t call spliced into the same line
  assert.equal(count(app, '__v2t'), 2, 'app.js: __v2t defined once + called once');
  assert.ok(app.includes('(!0===e.isCurrent?" | CURRENT ROLE":"")+__v2t(o,n)+'), 'app.js call site after the CURRENT ROLE tag');
  assert.ok(app.includes('" | DO-NOT-TRANSLATE: "+ts.join(", ")'), 'app.js emits the tag');
});

test('token list is bounded and filtered in BOTH bundles', () => {
  assert.match(src, /\.slice\(0, 12\)/);
  assert.ok(app.includes('.slice(0,12)'), 'app.js caps at 12 tokens');
});

test('the §3 language rule that consumes the tag is still present', () => {
  // LANG-CROSS-001 honors "DO-NOT-TRANSLATE:" per-role lists — the tag has a consumer.
  assert.ok(count(src, 'DO-NOT-TRANSLATE') >= 2, 'src: rule text + builder tag');
  assert.ok(count(app, 'DO-NOT-TRANSLATE') >= 2, 'app.js: rule text + builder tag');
});
