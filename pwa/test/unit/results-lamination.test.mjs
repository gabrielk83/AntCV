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

// OUTCOME-SEED-UNION-001 (owner 2026-06-16): an outcome seeded from a role's OWN
// bullet (bullet fallback, for a role with no proof points) and pinned via the
// map must NOT then show twice — the source bullet is hidden (dedup-hide).
{
  store['antcv:outcomeRoleMap'] = JSON.stringify({ oc_b: 'idf2' });
  const R = [
    { id: 'idf2', title: 'Computer Administrator', company: 'IDF', on: true,
      bullets: [
        'Built the first automated backup-and-restore, cutting recovery from hours to minutes.',
        'Administered classified IT infrastructure for a technical unit.',
      ] },
  ];
  // the outcome text IS the first bullet (seeded from it) → result must show it,
  // and that bullet must be removed so it is not duplicated.
  const O = [ { b: '', t: 'Built the first automated backup-and-restore, cutting recovery from hours to minutes.', _oid: 'oc_b', _fromBullet: true } ];
  const secs = [ { id: 'experience', type: 'experience', roles: R }, { id: 'outcomes', type: 'bullets', items: O } ];
  const o4 = applyOutcomesMode(secs, 'cv');
  const idf = o4.find((s) => s.type === 'experience').roles.find((r) => r.id === 'idf2');
  const blText = (b) => String(typeof b === 'string' ? b : (b && (b.b || b.t)) || '');
  ok('dedup-hide: bullet-seeded outcome shows in Results', /automated backup-and-restore/.test(idf.results || ''));
  ok('dedup-hide: the source bullet is REMOVED from the role bullets (not shown twice)',
    !(idf.bullets || []).some((b) => /automated backup-and-restore/.test(blText(b))));
  ok('dedup-hide: the OTHER (non-duplicate) bullet is kept', (idf.bullets || []).some((b) => /classified IT infrastructure/.test(blText(b))));
  delete store['antcv:outcomeRoleMap'];
}

// OUTCOME-SEED-QUALITY-001 (owner 2026-06-16): when a role has a REAL outcome that
// is better (numeric) AND a bullet-seeded outcome was pinned to it, the real
// outcome wins as the Results line and the bullet is EXPOSED (never hidden) — the
// bullet-derived candidate is simply not used. Nothing is deleted.
{
  store['antcv:outcomeRoleMap'] = JSON.stringify({ oc_q: 'rq' });
  const R = [
    { id: 'rq', title: 'Process Lead', company: 'Acme', on: true,
      outcomes: [ { id: 'oq', b: '', t: 'Cut cycle time from 250 to 10 days across the OEM portfolio.', defaultVisible: true } ],
      bullets: [ 'Ran cross-functional reviews and tracked rework KPIs every week.' ] },
  ];
  // a bullet-seeded outcome (non-numeric) pinned to rq — must lose to the numeric real outcome.
  const O = [ { b: '', t: 'Ran cross-functional reviews and tracked rework KPIs every week.', _oid: 'oc_q', _fromBullet: true } ];
  const secs = [ { id: 'experience', type: 'experience', roles: R }, { id: 'outcomes', type: 'bullets', items: O } ];
  const oq = applyOutcomesMode(secs, 'cv');
  const rq = oq.find((s) => s.type === 'experience').roles.find((r) => r.id === 'rq');
  const blText = (b) => String(typeof b === 'string' ? b : (b && (b.b || b.t)) || '');
  ok('quality: the numeric REAL outcome wins as the Results line', /250 to 10 days/.test(rq.results || ''));
  ok('quality: the bullet-derived candidate is NOT used as the result', !/cross-functional reviews/.test(rq.results || ''));
  ok('quality: the bullet is EXPOSED (kept) when a real outcome wins', (rq.bullets || []).some((b) => /cross-functional reviews/.test(blText(b))));
  delete store['antcv:outcomeRoleMap'];
}

// LAM-RESULTS-001 (owner 2026-06-18): the v2 kernel changed the role shape —
// outcomes are {title,result,numeric} (NOT {b,t}) and evidence is a FLAT
// role.proofPoints[] of strings (NOT proofPointIds resolved against a map). Before
// the fix, tier 2 read [o.b,o.t] (empty on v2) and tier 3 read proofPointIds (absent
// on v2), so EVERY v2 role fell through to the token-match distribution and showed
// the WRONG role's outcome. Each role must now laminate from its OWN outcome.result.
{
  const R = [
    { id: 'kanzen', title: 'Product / Project Expert', company: 'Kanzen Konsulenter ApS', on: true,
      outcomes: [{ title: 'AntCV', result: 'Built and shipped AntCV, an LLM-orchestrated job-application product, solo.', numeric: false }],
      proofPoints: ['AntCV live PWA + multi-worker Cloudflare backend.'],
      bullets: ['Bridged hardware product development and technical-commercial evaluation.'] },
    { id: 'innoviz', title: 'Change Control Lead', company: 'Innoviz Technologies', on: true,
      outcomes: [{ title: 'Cycle time', result: 'Cut the OEM LiDAR change-request cycle from 250 to 10 days.', numeric: true }],
      bullets: ['Owned change governance for the LiDAR product line.'] },
    { id: 'guard', title: 'Security Guard', company: 'Tel Aviv University', on: true,
      outcomes: [{ title: 'Coverage', result: 'Held an incident-free record across student-dormitory shifts in 2010.', numeric: false }],
      bullets: ['Access control and floor support at the student dormitories.'] },
    // outcome-less v2 role with ONLY flat proofPoints → tier-3 flat fallback.
    { id: 'council', title: 'Students Council Representative', company: 'University', on: true,
      proofPoints: ['Represented the student body in faculty governance, 2005-2007.'],
      bullets: ['Sat on the faculty board.'] },
  ];
  // SELECTED OUTCOMES pool whose token-match (the OLD wrong path) would scatter
  // these onto the wrong roles — the v2 lamination must ignore it per-role.
  const O = [
    'Security Guard, Student Dormitories — Tel Aviv University, 2010.',
    'Students Council Representative — University, 2005-2007.',
  ];
  const secs = [ { id: 'experience', type: 'experience', roles: R }, { id: 'selected_outcomes', type: 'text_bullets', items: O } ];
  const ov = applyOutcomesMode(secs, 'cv');
  const bv = Object.fromEntries(ov.find((s) => s.type === 'experience').roles.map((r) => [r.id, r]));
  ok('v2: Product/Project Expert laminates its OWN outcome (AntCV), NOT the Security Guard outcome',
    /AntCV/.test(bv.kanzen.results || '') && !/Security Guard|dormitor/i.test(bv.kanzen.results || ''));
  ok('v2: Change Control Lead laminates its OWN outcome (250 to 10 days), NOT the Students Council outcome',
    /250 to 10 days/.test(bv.innoviz.results || '') && !/Students Council/i.test(bv.innoviz.results || ''));
  ok('v2: Security Guard laminates its OWN outcome (incident-free)', /incident-free/.test(bv.guard.results || ''));
  ok('v2: outcome-less role with flat proofPoints[] laminates from its OWN proofPoint',
    /faculty governance/.test(bv.council.results || ''));
  ok('v2: no role shows another role\'s outcome (no cross-role bleed)',
    !/Security Guard|Students Council/i.test([bv.kanzen, bv.innoviz, bv.guard, bv.council].map((r) => r.results || '').join(' | ')));
}

for (const r of roles) console.log(`  [${r.title}] ${r.results || '(none)'}`);
console.log(`\nRESULTS-LAMINATION OK (${pass} checks)`);
