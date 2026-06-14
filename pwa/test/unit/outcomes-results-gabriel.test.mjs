// outcomes-results-gabriel.test.mjs
// ============================================================
// OUTCOMES-RESULTS distribution with Gabriel's REAL role + outcome shapes
// (owner 2026-06-14: "results only visible for one position / first 2 missing").
// Root cause was messy source data (outcomes that didn't token-match the early
// roles), not the algorithm. With the corrected sections (4 distinct outcomes,
// Founder-free titles), results spread across roles INCLUDING the first two.
// This locks that distribution so a future change can't re-starve the early roles.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.window = globalThis.window || {};
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
store.set('outcomesMode', JSON.stringify('results'));

const { applyOutcomesMode } = await import('../../antcv-docx-client.js');

const SECTIONS = [
  { id: 'outcomes', title: 'SELECTED OUTCOMES', loc: 'main', on: true, type: 'bullets', items: [
    { b: 'Cut', t: 'change-request cycle time from 250 to 10 days across OEM LiDAR programmes at Innoviz.' },
    { b: 'Evaluated', t: 'component alternatives (cover window, steering hardware) enabling a 10x LiDAR cost reduction as system architect.' },
    { b: 'Secured', t: 'last-time-buy stock and qualified display/microdisplay replacements with PCB redesign at Meprolight and Sirin Labs.' },
    { b: 'Built', t: 'KPI reporting on changes and supplier performance for prioritisation, and an AI orchestration system, at Kanzen.' },
  ]},
  { id: 'experience', title: 'PROFESSIONAL EXPERIENCE', loc: 'main', on: true, type: 'experience', roles: [
    { id: 'r1', title: 'Product / Project Expert', company: 'Kanzen konsulenter ApS', years: '2022 - 2026', on: true, bullets: ['Established a consultancy bridging hardware product development and technical-commercial evaluation.'] },
    { id: 'r2', title: 'System Architect & Change Control Lead', company: 'Innoviz Technologies', years: '2020 - 2025', on: true, bullets: ['Owned change governance for the LiDAR product line under Automotive SPICE.'] },
    { id: 'r3', title: 'System Architect', company: 'Innoviz Technologies', years: '2017 - 2020', on: true, bullets: ['Defined the system architecture for automotive LiDAR.'] },
    { id: 'r4', title: 'Senior Optics & Electro-Optics Engineer', company: 'Sirin Labs', years: '2014 - 2017', on: true, bullets: ['Led a 7-person EO and optics team for a high-security smartphone.'] },
    { id: 'r5', title: 'Electro-Optics Engineer & Team Leader', company: 'Meprolight, IWI Group', years: '2010 - 2014', on: true, bullets: ['Designed low-light, thermal, SWIR systems.'] },
    { id: 'r6', title: 'R&D and Teaching Assistant', company: 'Tel Aviv University', years: '2006 - 2010', on: true, bullets: ['Nanotechnology research on carbon nanotubes.'] },
    { id: 'r7', title: 'Computer Administrator', company: 'Israel Defense Forces', years: '2001 - 2003', on: true, bullets: ['Administered classified IT infrastructure.'] },
  ]},
];

function run() {
  store.set('outcomesMode', JSON.stringify('results'));
  const out = applyOutcomesMode(SECTIONS, 'cv');
  const exp = out.find((s) => s.id === 'experience');
  const by = {};
  exp.roles.forEach((r) => { by[r.id] = r.results || ''; });
  return { out, by };
}

test('SELECTED OUTCOMES section is dropped in results mode', () => {
  const { out } = run();
  assert.equal(out.find((s) => s.id === 'outcomes'), undefined);
});

test('the FIRST TWO roles both carry results (no longer starved)', () => {
  const { by } = run();
  assert.ok(by.r1 && by.r1.trim(), 'r1 (Kanzen) must have results');
  assert.ok(by.r2 && by.r2.trim(), 'r2 (System Architect & Change Control Lead) must have results');
});

test('outcomes spread to multiple roles, not piled on one', () => {
  const { by } = run();
  const withResults = Object.values(by).filter((v) => v && v.trim()).length;
  assert.ok(withResults >= 3, `expected results on >=3 roles, got ${withResults}`);
});

test('matched outcomes land on the right role', () => {
  const { by } = run();
  assert.match(by.r1, /Kanzen/, 'the Kanzen KPI outcome lands on the Kanzen role');
  assert.match(by.r2, /cycle time/, 'the change-cycle outcome lands on the change-control role');
  assert.match(by.r4, /Sirin Labs/, 'the Sirin/Meprolight outcome lands on the Sirin role');
});

test('each role results line stays within the ~260 char budget (RESULTS-CUT-001)', () => {
  // RESULTS-CUT-001 (owner 2026-06-14): cap raised 180 -> 260 so concrete
  // results are not lopped with a trailing "…".
  const { by } = run();
  Object.values(by).forEach((v) => assert.ok(v.length <= 261, `results too long: ${v.length}`));
});
