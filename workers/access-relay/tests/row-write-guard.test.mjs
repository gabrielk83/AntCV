/* APP-ROW-WRITE-GUARD-001 (owner 2026-11-03, D1 application 3524).
 *
 * At 2026-11-01 16:55:11Z the ASSA ABLOY editor state was PUT into the Ambu row. The relay
 * now refuses a content write (sections / meta) whose employer AND role both differ from
 * the row's, and its matcher must agree with pwa/antcv-company-match.js.
 *
 * Run: node --test workers/access-relay/tests/row-write-guard.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import * as R from '../src/row-write-guard.js';

const require = createRequire(import.meta.url);
const P = require('../../../pwa/antcv-company-match.js');

const AMBU = { jd_company: 'Ambu', jd_role: 'Hardware Solution Architect, EndoIntelligence, Global R&D' };
const YALE_META = { company: 'ASSA ABLOY (Yale)', role: 'Product Manager - Residential Access EMEIA', subtitle: 'Processes • Products • People' };

test('the 3524 PUT (ASSA ABLOY sections + meta into the Ambu row) is refused', () => {
  const body = { cv_sections: [{ id: 'profile' }], cl_sections: [], meta: YALE_META, subtitle: YALE_META.subtitle };
  assert.deepEqual(R.rowWriteMismatch(AMBU, body), { company: 'ASSA ABLOY (Yale)', role: 'Product Manager - Residential Access EMEIA' });
  assert.ok(R.rowWriteMismatch(AMBU, { ...body, jd_company: YALE_META.company, jd_role: YALE_META.role }));
});

test('own content, renames, corrected names, unsolicited and the explicit override pass', () => {
  assert.equal(R.rowWriteMismatch(AMBU, { cv_sections: [], meta: { company: 'Ambu A/S', role: 'Hardware Solution Architect' } }), null);
  assert.equal(R.rowWriteMismatch(AMBU, { jd_company: 'ASSA ABLOY', jd_role: 'Product Manager' }), null, 'rename: no content');
  assert.equal(R.rowWriteMismatch({ jd_company: 'NKT Photonics', jd_role: 'Optical Engineer for R&D Projects' },
    { meta: { company: 'Hamamatsu Photonics A/S', role: 'Optical Engineer for R&D Projects' } }), null, 'same posting, renamed employer');
  assert.equal(R.rowWriteMismatch({ jd_company: 'Unsolicited', jd_role: 'Open Application' }, { meta: YALE_META }), null);
  assert.equal(R.rowWriteMismatch(AMBU, { meta: { company: 'Unsolicited' }, cv_sections: [] }), null);
  assert.equal(R.rowWriteMismatch(AMBU, { meta: YALE_META, cv_sections: [], allow_company_change: true }), null);
  assert.equal(R.rowWriteMismatch(AMBU, { analysis_extra: {} }), null, 'non-content partial write');
});

test('matcher parity with pwa/antcv-company-match.js (COMPANY-MATCH-001)', () => {
  const cos = ['ASSA ABLOY (Yale)', 'ASSA ABLOY', 'Ambu', 'Ambu A/S', 'Terma A/S', 'Hamamatsu Photonics A/S', 'NKT Photonics',
    'Career Opportunities: Experienced Systems Engineer, Søborg (1424)', 'Novo Nordisk', 'Unsolicited', 'Open Application', '', 'NIL Technology'];
  for (const c of cos) {
    assert.deepEqual(R.tokens(c), P.tokens(c), 'tokens(' + c + ')');
    assert.equal(R.isTargeted(c), P.isTargeted(c), 'isTargeted(' + c + ')');
    for (const d of cos) assert.equal(R.sameCompany(c, d), P.sameCompany(c, d), 'sameCompany(' + c + ', ' + d + ')');
  }
  const roles = ['Product Manager - Residential Access EMEIA', 'Product Manager, Residential Access EMEIA', 'Hardware Solution Architect, EndoIntelligence, Global R&D',
    'Optical Engineer for R&D Projects', 'Technical Project Manager Quantum Systems', 'Experienced Systems Engineer', 'Experienced Systems Engineer, Søborg (1424)', ''];
  for (const a of roles) for (const b of roles) assert.equal(R.sameRole(a, b), P.sameRole(a, b), 'sameRole(' + a + ', ' + b + ')');
});

test('index.js wires the guard into PUT /api/applications/:id before any field is written', () => {
  const src = fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  assert.ok(src.includes("import { rowWriteMismatch } from './row-write-guard.js';"));
  assert.ok(src.includes("'SELECT user_hash, cv_sections, cl_sections, jd_company, jd_role, updated_at FROM application WHERE id = ?'"));
  const g = src.indexOf('const __foreign = rowWriteMismatch(owned, body);');
  const w = src.indexOf("if (typeof body.jd_company === 'string' && !__blockDowngrade) { sets.push('jd_company = ?');");
  const rev = src.indexOf("{ error: 'conflict', updated_at: curRev }");
  assert.ok(g > 0 && rev > 0 && w > 0 && rev < g && g < w, 'after the stale-rev check, before the field whitelist');
  assert.ok(src.includes("{ error: 'company_mismatch', application_id: appId"));
});
