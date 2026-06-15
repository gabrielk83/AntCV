/* Unit test — RESULTS-LAMINATION-001 (owner 2026-06-15).
 * applyOutcomesMode must give each role its OWN result deterministically:
 *  - explicit role.results wins verbatim
 *  - else role.proofPointIds resolve against personalInfo.proofPointsByRole
 *  - only roles with NEITHER fall through to the heuristic SELECTED-OUTCOMES spread
 * No browser — localStorage is mocked.
 */
import assert from 'node:assert';

const personalInfo = {
  patentNumber: '241997',
  proofPointsByRole: [
    { id: 'pp_innoviz_cycle', roleId: 'r2', text: 'Cut OEM LiDAR change-request cycle time from 250 to 10 days.' },
    { id: 'pp_innoviz_aspice', roleId: 'r2', text: 'Passed ASPICE Capability Level 1 audit in 2025; governed processes responsible for ~30% of revenue.' },
    { id: 'pp_kanzen_antcv', roleId: 'r1', text: 'Built KPI reporting and AntCV, a GenAI orchestration product, solo.' },
  ],
};
const store = {
  outcomesMode: JSON.stringify('results'),
  personalInfo: JSON.stringify(personalInfo),
  stylePackage: JSON.stringify('copenhagen-modern'),
};
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: () => {}, removeItem: () => {} };
globalThis.window = {};

const { applyOutcomesMode } = await import('../../antcv-docx-client.js');

const ROLES = [
  { id: 'r1', title: 'Product / Project Expert', company: 'Kanzen konsulenter ApS', on: true,
    proofPointIds: ['pp_kanzen_antcv'], bullets: ['Bridged hardware product development and technical-commercial evaluation.'] },
  { id: 'r2', title: 'System Architect & Change Control Lead', company: 'Innoviz Technologies', on: true,
    proofPointIds: ['pp_innoviz_cycle', 'pp_innoviz_aspice'], bullets: ['Owned change governance for the LiDAR product line.'] },
  { id: 'r_explicit', title: 'Security Guard', company: 'Tel Aviv University', on: true,
    results: 'Kept an incident-free record across shifts; standardised the handover log.', bullets: ['Access control and floor support.'] },
  { id: 'r_none', title: 'Computer Administrator', company: 'IDF', on: true,
    bullets: ['Administered classified IT infrastructure for a technical unit.'] },
  { id: 'r_derive', title: 'Warehouse Lead', company: 'Acme Storage', on: true,
    bullets: ['Organised the floor and shelving layout.', 'Cut order pick time by 35% across two shifts.'] },
  { id: 'r_oc', title: 'R&D Assistant', company: 'Tel Aviv University', on: true,
    bullets: ['Ran the lab.'],
    outcomes: [
      { id: 'o1', b: 'Established', t: 'CVD protocols for self-assembling SWCNT-FET on a MEMS tension sensor.', defaultVisible: true },
      { id: 'o2', b: 'Hidden', t: 'JD-gated detail that must stay hidden by default.', defaultVisible: false },
    ] },
];
const OUTCOMES = [
  'Automated the backup-and-restore procedure, cutting recovery time from hours to minutes for the technical unit',
  'Some unrelated outcome about optical resolution improvements',
];
const sections = [
  { id: 'experience', title: 'PROFESSIONAL EXPERIENCE', type: 'experience', roles: ROLES },
  { id: 'selected_outcomes', title: 'SELECTED OUTCOMES', type: 'text_bullets', items: OUTCOMES },
];

const out = applyOutcomesMode(sections, 'cv');
const roles = out.find((s) => s.type === 'experience').roles;
const byId = Object.fromEntries(roles.map((r) => [r.id, r]));

let pass = 0; const ok = (n, c) => { assert.ok(c, n); console.log('PASS ' + n); pass++; };

ok('r2 laminated from its OWN proofPointIds (cycle time)', /250 to 10 days/.test(byId.r2.results || ''));
ok('r2 result is NOT a heuristic SELECTED-OUTCOMES item', !/optical resolution|backup-and-restore/.test(byId.r2.results || ''));
ok('r1 laminated from its OWN proofPointId (AntCV)', /AntCV/.test(byId.r1.results || ''));
ok('explicit role.results wins verbatim', byId.r_explicit.results === 'Kept an incident-free record across shifts; standardised the handover log.');
ok('role with NEITHER still gets a heuristic result', !!(byId.r_none.results && byId.r_none.results.trim()));
ok('tier-3: role with no result/proofPoint/match derives its NUMERIC own bullet', /35%/.test(byId.r_derive.results || ''));
ok('tier-3 never leaves a role empty', roles.every((r) => r.results && r.results.trim()));
ok('role.outcomes[]: default-visible item is used', /CVD protocols/.test(byId.r_oc.results || ''));
ok('role.outcomes[]: defaultVisible:false item stays hidden', !/JD-gated detail/.test(byId.r_oc.results || ''));
ok('laminated results never exceed ~2 lines (<=262 chars)', roles.every((r) => !r.results || r.results.length <= 262));

for (const r of roles) console.log(`  [${r.title}] ${r.results || '(none)'}`);
console.log(`\nRESULTS-LAMINATION OK (${pass} checks)`);
