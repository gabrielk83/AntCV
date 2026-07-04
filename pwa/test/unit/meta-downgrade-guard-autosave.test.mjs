// meta-downgrade-guard-autosave.test.mjs
// ============================================================
// META-DOWNGRADE-GUARD-003 (register row 31 leg b): the AUTO-SAVE loop must NOT
// persist a DOWNGRADED meta (empty/"unsolicited" company) into the active row when
// the row's context is UNKNOWN (activeAppCompany === null — cold restore / mid-load).
// That is the exact path that poisons a targeted server row. This is the WRITE-step
// belt; the row-29 GET-step guard (001/002) lives in meta-downgrade-guard.test.mjs.
// Both-bundle lock + a pure-logic replica of the guarded payload builder.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../app.src.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');

test('app.src.js: the downgrade guard is present in the auto-save loop', () => {
  assert.match(src, /META-DOWNGRADE-GUARD-003/);
  assert.match(src, /const __dgIsDowngrade = \(__ioCo === "" \|\| __ioCo === "unsolicited"\);/);
  assert.match(src, /const __dgCtxUnknown = \(__expectedCompany === null\);/);
  assert.match(src, /if \(__dgIsDowngrade && __dgCtxUnknown\) \{/);
  assert.match(src, /oo\.update\(__activeId, __dgPayload\)/);
});

test('app.js (minified): the same guard is mirrored', () => {
  assert.ok(app.includes('META-DOWNGRADE-GUARD-003'), 'marker present');
  assert.ok(app.includes('$dgD=""===r||"unsolicited"===r'), 'downgrade test present');
  assert.ok(app.includes('$dgU=null===o'), 'context-unknown test present');
  assert.ok(app.includes('return vo.update(e,$dgP)'), 'guarded update present');
  assert.ok(!app.includes('meta:So&&"object"==typeof So?So:{},rationale:Lo,...$jdSF})'), 'old unconditional payload removed');
});

// Pure-logic replica of the guarded payload builder.
function buildPayload({ ioCompany, expectedCompany, ro, io, jdSyncField }) {
  const norm = (s) => String(s || '').trim().toLowerCase();
  const ioCo = norm(ioCompany);
  const isDowngrade = ioCo === '' || ioCo === 'unsolicited';
  const ctxUnknown = expectedCompany === null;
  const payload = { cv_sections: (ro && ro.cv) || [], cl_sections: (ro && ro.cl) || [], rationale: 'r', ...jdSyncField };
  if (isDowngrade && ctxUnknown) {
    // withhold meta/jd_company
  } else {
    payload.jd_company = (io && io.company) || '';
    payload.jd_role = (io && io.role) || '';
    payload.subtitle = (io && io.subtitle) || '';
    payload.meta = io && typeof io === 'object' ? io : {};
  }
  return payload;
}

const RO = { cv: [{ id: 'x' }], cl: [] };

test('downgrade + context UNKNOWN (null) -> meta withheld (targeted row protected)', () => {
  const p = buildPayload({ ioCompany: 'Unsolicited', expectedCompany: null, ro: RO, io: { company: 'Unsolicited' }, jdSyncField: {} });
  assert.ok(!('jd_company' in p), 'jd_company withheld');
  assert.ok(!('meta' in p), 'meta withheld');
  assert.deepEqual(p.cv_sections, RO.cv, 'sections still sync');
});

test('empty company + context UNKNOWN -> meta withheld', () => {
  const p = buildPayload({ ioCompany: '', expectedCompany: null, ro: RO, io: { company: '' }, jdSyncField: {} });
  assert.ok(!('jd_company' in p) && !('meta' in p), 'downgrade withheld');
});

test('real company + context unknown -> meta WRITTEN (never blocks a real save)', () => {
  const p = buildPayload({ ioCompany: 'Trackman A/S', expectedCompany: null, ro: RO, io: { company: 'Trackman A/S', role: 'PM' }, jdSyncField: {} });
  assert.equal(p.jd_company, 'Trackman A/S');
  assert.equal(p.meta.company, 'Trackman A/S');
});

test('downgrade but context KNOWN ("") -> meta WRITTEN (genuine unsolicited row)', () => {
  const p = buildPayload({ ioCompany: 'Unsolicited', expectedCompany: '', ro: RO, io: { company: 'Unsolicited' }, jdSyncField: {} });
  assert.ok('meta' in p, 'meta written when context is known-unsolicited');
  assert.equal(p.meta.company, 'Unsolicited');
});
