// slogan-meta-stamp.test.mjs
// ============================================================
// SLOGAN-META-STAMP-001 (register row: balanced-gen old-slogan): the generated
// meta.cl_slogan (a sibling of subtitle in the gen prompt schema) must be carried
// into the stamped meta object so antcv-cl-slogan-fresh.freshSmart() can adopt it.
// Before the fix the stamp built {company,role,subtitle,greeting,opening} and
// DROPPED cl_slogan, so the fresh smart slogan was never adopted (in every speed
// mode) and the stale override survived. Lock the field into BOTH bundles.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const srcSource = await readFile(new URL('../../app.src.js', import.meta.url), 'utf8');
const srcMin = await readFile(new URL('../../app.js', import.meta.url), 'utf8');

test('app.src.js meta stamp carries cl_slogan alongside subtitle/greeting/opening', () => {
  // the stamped literal: company/role/subtitle/cl_slogan/greeting/opening
  assert.ok(
    /subtitle:\s*W\.subtitle,\s*(?:\/\/[^\n]*\n\s*)*cl_slogan:\s*W\.cl_slogan\s*\|\|\s*"",\s*greeting:\s*W\.greeting/.test(srcSource),
    'source stamp must include cl_slogan: W.cl_slogan || "" between subtitle and greeting',
  );
});

test('app.js (minified) meta stamp carries cl_slogan', () => {
  assert.ok(
    srcMin.includes('subtitle:q.subtitle,cl_slogan:q.cl_slogan||"",greeting:q.greeting'),
    'minified stamp must include cl_slogan:q.cl_slogan||"" between subtitle and greeting',
  );
});

test('neither bundle still has the old cl_slogan-dropping stamp', () => {
  assert.ok(!srcMin.includes('subtitle:q.subtitle,greeting:q.greeting,opening:q.opening'),
    'the old minified stamp (no cl_slogan) must be gone');
});
