// slogan-meta-stamp.test.mjs
// ============================================================
// SLOGAN-META-STAMP-001 (register row: balanced-gen old-slogan): the generated
// meta.cl_slogan (a sibling of subtitle in the gen prompt schema) must be carried
// into the stamped meta object so antcv-cl-slogan-fresh.freshSmart() can adopt it.
// Before the fix the stamp built {company,role,subtitle,greeting,opening} and
// DROPPED cl_slogan, so the fresh smart slogan was never adopted (in every speed
// mode) and the stale override survived. Lock the field into BOTH bundles.
// SLOGAN-UNSOL-GENERIC-001 (2026-07-15): the carried cl_slogan is now UNSOLICITED-
// GATED — a targeted app still carries W.cl_slogan; an unsolicited gen blanks it so
// the CL keeps the generic standing default. Lock the gated form into BOTH bundles.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const srcSource = await readFile(new URL('../../app.src.js', import.meta.url), 'utf8');
const srcMin = await readFile(new URL('../../app.js', import.meta.url), 'utf8');

test('app.src.js meta stamp carries cl_slogan (unsol-gated) alongside subtitle/greeting/opening', () => {
  // the stamped literal: company/role/subtitle/cl_slogan(unsol-gated)/greeting/opening
  assert.ok(
    /subtitle:\s*W\.subtitle,\s*(?:\/\/[^\n]*\n\s*)*cl_slogan:\s*\(W\.company\s*&&\s*window\.__antcvUnsol\s*&&\s*window\.__antcvUnsol\(W\.company\)\)\s*\?\s*""\s*:\s*\(W\.cl_slogan\s*\|\|\s*""\),\s*greeting:\s*W\.greeting/.test(srcSource),
    'source stamp must carry cl_slogan (unsol-gated) between subtitle and greeting',
  );
});

test('app.js (minified) meta stamp carries cl_slogan (unsol-gated)', () => {
  assert.ok(
    srcMin.includes('subtitle:q.subtitle,cl_slogan:(q.company&&window.__antcvUnsol&&window.__antcvUnsol(q.company))?"":(q.cl_slogan||""),greeting:q.greeting'),
    'minified stamp must carry cl_slogan (unsol-gated) between subtitle and greeting',
  );
});

test('neither bundle still has the old cl_slogan-dropping stamp', () => {
  assert.ok(!srcMin.includes('subtitle:q.subtitle,greeting:q.greeting,opening:q.opening'),
    'the old minified stamp (no cl_slogan) must be gone');
});
