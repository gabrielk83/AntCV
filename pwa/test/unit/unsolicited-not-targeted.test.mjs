// unsolicited-not-targeted.test.mjs
// ============================================================
// UNSOLICITED-NOT-TARGETED-001 (owner 2026-06-23): an UNSOLICITED CV came out of the
// EXPORT with same-company roles MERGED (Innoviz "Change Request Lead / ... / System
// Architect"), and with Publications & Patents + the low-signal roles (security guard,
// Copenhagen Wolves, student council) HIDDEN — even though the owner's rule is
// "Unsolicited keeps the full breadth." Root cause: _isTargetedExport() let a sticky
// __antcvMerged flag (or a stale activeAppCompany) left by a PRIOR targeted session
// override the explicit current 'unsolicited' marker. Fix: an explicit 'unsolicited'
// marker (meta.company OR activeAppCompany) is authoritative ⇒ NOT targeted, regardless
// of the merged flag. These assert via the exposed preview/export-parity predicates,
// which gate on the same _isTargetedExport().

import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.window = globalThis.window || {};
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

await import('../../antcv-docx-client.js');

const PUB = { id: 'pubs', title: 'PUBLICATIONS & PATENTS', type: 'list_italic', on: true, items: ['A paper'] };
const ROLES = [
  { id: 'r1', title: 'Change Request Lead', company: 'Innoviz Technologies', years: '2020 - 2025', on: true, bullets: ['Chair the CCB.'] },
  { id: 'r2', title: 'System Architect', company: 'Innoviz Technologies', years: '2017 - 2025', on: true, bullets: ['Define system architecture.'] },
  { id: 'r3', title: 'Dormitory Security Guard', company: 'Tel Aviv University', years: '2005 - 2006', on: true, bullets: ['Night security.'] },
];

// A sticky merged flag from a prior targeted session — the trap that mis-fired the gate.
function seedUnsolicitedWithStickyFlag() {
  store.clear();
  store.set('meta', JSON.stringify({ company: 'unsolicited' }));
  store.set('antcv:activeAppCompany', JSON.stringify('unsolicited'));
  store.set('sections', JSON.stringify({ cv: [{ id: 'experience', type: 'experience', __antcvMerged: true, roles: ROLES }] }));
}

test('UNSOLICITED keeps full breadth despite a sticky __antcvMerged flag', () => {
  seedUnsolicitedWithStickyFlag();
  // (E) roles are NOT merged → returns null (no consolidation)
  assert.equal(window.AntcvMergeExperienceRoles(ROLES), null, 'unsolicited must not merge same-company roles');
  // (D) Publications section is NOT hidden
  assert.equal(window.AntcvExportHiddenSection(PUB), false, 'unsolicited must not hide Publications');
  // (D) the low-signal role is NOT hidden
  assert.equal(window.AntcvExportHiddenRole(ROLES[2]), false, 'unsolicited must not hide the security-guard role');
});

test('UNSOLICITED via activeAppCompany (meta.company drifted empty) still keeps breadth', () => {
  store.clear();
  store.set('meta', JSON.stringify({ company: '' }));
  store.set('antcv:activeAppCompany', JSON.stringify('unsolicited'));
  store.set('sections', JSON.stringify({ cv: [{ id: 'experience', type: 'experience', __antcvMerged: true, roles: ROLES }] }));
  assert.equal(window.AntcvMergeExperienceRoles(ROLES), null);
  assert.equal(window.AntcvExportHiddenSection(PUB), false);
});

test('a REAL targeted company still merges + hides (no regression)', () => {
  store.clear();
  store.set('meta', JSON.stringify({ company: 'Nordea' }));
  store.set('antcv:lastJdText', 'data analyst role with sql and dashboards'); // not research, not techops
  const merged = window.AntcvMergeExperienceRoles(ROLES);
  assert.ok(Array.isArray(merged), 'targeted export must merge');
  const innoviz = merged.filter((r) => r && r.company === 'Innoviz Technologies' && r.on !== false);
  assert.equal(innoviz.length, 1, 'the two Innoviz roles consolidate to one');
  assert.ok(/\//.test(innoviz[0].title), 'merged title joins the distinct titles');
  assert.equal(window.AntcvExportHiddenSection(PUB), true, 'targeted (non-research) hides Publications');
  assert.equal(window.AntcvExportHiddenRole(ROLES[2]), true, 'targeted hides the security-guard role');
});

test('empty meta + no active company + no merged flag ⇒ not targeted', () => {
  store.clear();
  store.set('meta', JSON.stringify({}));
  assert.equal(window.AntcvMergeExperienceRoles(ROLES), null);
  assert.equal(window.AntcvExportHiddenSection(PUB), false);
});
