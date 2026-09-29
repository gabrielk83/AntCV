// cph-spec-photo-clear.test.mjs
// CPH-SPEC-PHOTO-CLEAR-001 (owner 2026-09-29): an explicit Font sizes value for the specialisation turns the
// SPEC-SHORTER shrink off, and the long centered spec line then ran under the band photo. The sidecar now caps
// the spec row at the photo-cleared width (wrap, owner size kept) whenever a band photo is present.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../antcv-copenhagen-v2-001.js'), 'utf8');

test('spec row is capped at the photo-cleared width, independent of the owner font size', () => {
  assert.ok(src.includes("__fit.specMaxW = (__img && __sane) ? Math.round(__maxW)"), 'computed from the live photo clearance');
  const rule = src.match(/if \(__fit\.specMaxW != null\) css \+= [^\n]*/);
  assert.ok(rule, 'emitted as CSS');
  assert.ok(!/__userSet\('specialisation'\)/.test(rule[0]), 'not gated on the owner size - the size is kept, the width is capped');
  assert.ok(/max-width:/.test(rule[0]) && /margin-left:auto/.test(rule[0]) && /white-space:normal/.test(rule[0]), 'centered, wrapping cap');
});
