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
  // JD-aware visibility source (raw string, not JSON): contains FMEA + SQL.
  'antcv:lastJdText': 'This role needs FMEA risk analysis and SQL monitoring experience.',
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
  { id: 'r_jd', title: 'Change Control', company: 'JD Match Co', on: true,
    bullets: ['Ran the board.'],
    outcomes: [
      { id: 'jd1', b: 'Established', t: 'an FMEA-based monitoring and decision-support system in SQL.', defaultVisible: false,
        visibilityRule: { showWhenJDContainsAny: ['FMEA', 'SQL', 'risk analysis'] } },
    ] },
];
const OUTCOMES = [
  'Automated backup-and-restore as Computer Administrator at IDF, cutting recovery from hours to minutes',
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
ok('role with a GENUINE token-matched SELECTED OUTCOME gets it', /backup-and-restore/.test(byId.r_none.results || ''));
ok('RESULTS-LAMINATION-003: role with no real outcome DERIVES from its numeric bullet', /35%/.test(byId.r_derive.results || ''));
ok('RESULTS-LAMINATION-003: the derived source bullet is HIDDEN (removed from bullets)', (byId.r_derive.bullets || []).length === 1 && !/(35%|Cut order pick)/.test((byId.r_derive.bullets || []).join(' ')));
ok('no role result is a verbatim copy of one of its REMAINING bullets', roles.every((r) => { const res = (r.results || '').trim(); if (!res) return true; const bls = (r.bullets || []).map((b) => String(typeof b === 'string' ? b : (b && (b.b || b.t)) || '').trim()); return !bls.some((b) => b && res.includes(b)); }));
ok('role.outcomes[]: default-visible item is used', /CVD protocols/.test(byId.r_oc.results || ''));
ok('role.outcomes[]: defaultVisible:false item stays hidden', !/JD-gated detail/.test(byId.r_oc.results || ''));
ok('JD-aware: hidden outcome SHOWS when the JD matches its showWhenJDContainsAny', /FMEA-based monitoring/.test(byId.r_jd.results || ''));
ok('laminated results never exceed ~2 lines (<=262 chars)', roles.every((r) => !r.results || r.results.length <= 262));

// RESULTS-CROSSROLE-BLEED-001 + RESULTS-NUMERIC-FAVOR-001 (owner 2026-06-16).
{
  const R = [
    // laminated via its OWN proofPoint — the TRUE home of the LiDAR outcome.
    { id: 'lr', title: 'LiDAR Systems Engineer', company: 'Innoviz Technologies', on: true,
      proofPointIds: ['pp_innoviz_cycle'], bullets: ['Owned LiDAR validation.'] },
    // unrelated role, no own outcome — must NOT receive the LiDAR outcome.
    { id: 'sirin', title: 'Optics Engineer', company: 'Sirin', on: true,
      bullets: ['Set up optical characterisation labs for smartphone optical stacks.'] },
    // matches several outcomes incl. a numeric one.
    { id: 'pm', title: 'Product Manager', company: 'Acme', on: true,
      bullets: ['Ran the product backlog and roadmap for the platform.'] },
  ];
  const O = [
    'Defined acceptance test procedures for LiDAR optical stacks at Innoviz',  // home=lr (laminated) → drop, not bleed to sirin
    'Ran the product backlog and roadmap, shipping the platform on schedule',  // matches pm, no number
    'Grew the product roadmap revenue by 30% across the platform backlog',     // matches pm, numeric → must survive + lead
  ];
  const secs = [ { id: 'experience', type: 'experience', roles: R }, { id: 'selected_outcomes', type: 'text_bullets', items: O } ];
  const o2 = applyOutcomesMode(secs, 'cv');
  const b2 = Object.fromEntries(o2.find((s) => s.type === 'experience').roles.map((r) => [r.id, r]));
  ok('cross-role: a LiDAR outcome (home = laminated role) does NOT bleed onto the unrelated Sirin role', !/lidar/i.test(b2.sirin.results || ''));
  ok('numeric-favor: the 30% outcome LEADS the PM role result', /30%/.test((b2.pm.results || '').split(';')[0] || ''));
}

// OUTCOME-ROLE-SELECT-001 (owner 2026-06-16): an explicit outcome→role map
// (antcv:outcomeRoleMap) pins an outcome to the chosen position, overriding the
// token-match heuristic.
{
  store['antcv:outcomeRoleMap'] = JSON.stringify({ oc_x: 'pm2' });
  const R = [
    { id: 'pm2', title: 'Product Manager', company: 'Acme', on: true, bullets: ['Ran the roadmap.'] },
    { id: 'opt2', title: 'Optics Engineer', company: 'Beta', on: true, bullets: ['Built optical benches.'] },
  ];
  // token-match alone would send this optics outcome to opt2; the map pins it to pm2.
  const O = [ { b: 'Built', t: 'optical characterisation benches and acceptance tests', _oid: 'oc_x' } ];
  const secs = [ { id: 'experience', type: 'experience', roles: R }, { id: 'outcomes', type: 'bullets', items: O } ];
  const o3 = applyOutcomesMode(secs, 'cv');
  const b3 = Object.fromEntries(o3.find((s) => s.type === 'experience').roles.map((r) => [r.id, r]));
  ok('explicit outcome→role map pins the outcome to the chosen position (overrides token-match)',
    /optical characterisation benches/.test(b3.pm2.results || '') && !/optical characterisation benches/.test(b3.opt2.results || ''));
  delete store['antcv:outcomeRoleMap'];
}

for (const r of roles) console.log(`  [${r.title}] ${r.results || '(none)'}`);
console.log(`\nRESULTS-LAMINATION OK (${pass} checks)`);
