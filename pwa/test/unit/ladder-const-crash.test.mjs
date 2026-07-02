// LADDER-CONST-CRASH-001 (owner 2026-07-03) — regression lock.
//
// The ee() provider ladder's inadequate-output branch carried a vestigial
// `s = new Error(provider + " returned inadequate output")` — but `s` in that
// scope is the CONST transient-retry delay array ([2e3,5e3,1e4]). The
// assignment threw "Assignment to constant variable", the outer catch logged
// the SAME provider a second time, and the fallback ladder was misreported
// ("All 2 LLM providers failed" — both lines mistral). Live hit: NIL
// generation, task parse_jd, mistral returned 5 chars → inadequate gate →
// TypeError instead of a clean fall-through to the next provider.
//
// Locks (both bundles):
//   1. No assignment to `s` of a "returned inadequate output" Error anywhere.
//   2. The inadequate-output branch still exists (gate not accidentally lost)
//      and still demotes + continues.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PWA = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = readFileSync(join(PWA, 'app.src.js'), 'utf8');
const app = readFileSync(join(PWA, 'app.js'), 'utf8');

for (const [name, text] of [['app.src.js', src], ['app.js', app]]) {
  test(`${name}: the const-reassigning vestigial Error is gone`, () => {
    assert.ok(
      !text.includes('returned inadequate output'),
      `${name} still assigns the vestigial "returned inadequate output" Error (const s collision)`,
    );
  });

  test(`${name}: the inadequate-output gate itself survives`, () => {
    assert.ok(
      text.includes('inadequate or truncated output ('),
      `${name} lost the 1.50.290 output-adequacy failure record`,
    );
    // The branch must still fall through to the next provider.
    const i = text.indexOf('inadequate or truncated output (');
    const window_ = text.slice(i, i + 1500);
    assert.ok(
      /continue/.test(window_),
      `${name}: inadequate-output branch no longer continues to the next provider`,
    );
  });
}
