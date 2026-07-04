// labeled-value-trim-guard.test.mjs
// ============================================================
// LABELED-VALUE-TRIM-GUARD-001 (owner 2026-07-05, crash during kernel generation:
// "TypeError: e.v.trim is not a function"). Two labeled-list normalizers checked
// e.l is a string but assumed e.v was a string too; a truthy non-string e.v
// (object/array) threw on .trim(). Guarded with a typeof check. Lock both bundles.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const srcSource = await readFile(new URL('../../app.src.js', import.meta.url), 'utf8');
const srcMin = await readFile(new URL('../../app.js', import.meta.url), 'utf8');

test('the unguarded !e.v || !e.v.trim() form is gone from both bundles', () => {
  assert.ok(!srcSource.includes('!e.v || !e.v.trim()'), 'source no longer has the unguarded form');
  assert.ok(!srcMin.includes('!e.v||!e.v.trim()'), 'minified no longer has the unguarded form');
});

test('both bundles use the typeof-guarded form at both sites', () => {
  assert.equal(srcSource.split('"string" != typeof e.v || !e.v.trim()').length - 1, 2, 'source has 2 guarded sites');
  assert.equal(srcMin.split('"string"!=typeof e.v||!e.v.trim()').length - 1, 2, 'minified has 2 guarded sites');
});
