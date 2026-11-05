/* Unit test — JT-EC-RESULTS-DERIVE-001 (register row 140, 2026-11-05).
 * The Earlier career role (id 'earlier-career') is a summary of short roles, one line
 * each with "(YYYY - YYYY)". The tier-5 derive read the years as a metric and moved the
 * longest line into "Results:". A summary has no single outcome: no Results line, every
 * line stays a bullet. Ordinary roles still derive from a numeric bullet.
 * No browser — localStorage is mocked.
 */
import assert from 'node:assert';

const store = {
  outcomesMode: JSON.stringify('results'),
  personalInfo: JSON.stringify({}),
  stylePackage: JSON.stringify('nordic-minimal'),
  'antcv:lastJdText': 'Product manager for wind turbine monitoring products.',
};
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: () => {}, removeItem: () => {} };
globalThis.window = {};

const { applyOutcomesMode } = await import('../../antcv-docx-client.js');

const EC_BULLETS = [
  'Computer Administrator, IDF (2001 - 2004) - Administered classified IT infrastructure.',
  'Students Council Representative, Tel Aviv University (2005 - 2007) - Modernised 15 outdated EE exam-preparation booklets.',
  'Security Guard, Tel Aviv University (2007 - 2009) - Access control and floor support.',
];
const ROLES = [
  { id: 'earlier-career', title: 'Earlier career', company: '', on: true, bullets: EC_BULLETS.slice() },
  { id: 'r_derive', title: 'Warehouse Lead', company: 'Acme Storage', on: true,
    bullets: ['Organised the floor and shelving layout.', 'Cut order pick time by 35% across two shifts.'] },
];
// applyOutcomesMode is a no-op without a SELECTED OUTCOMES section; one unrelated item.
const sections = [
  { id: 'experience', title: 'PROFESSIONAL EXPERIENCE', type: 'experience', roles: ROLES },
  { id: 'selected_outcomes', title: 'SELECTED OUTCOMES', type: 'text_bullets', items: ['Some unrelated outcome about optical resolution improvements'] },
];

const out = applyOutcomesMode(sections, 'cv');
const roles = out.find((s) => s.type === 'experience').roles;
const byId = Object.fromEntries(roles.map((r) => [r.id, r]));
const txt = (b) => String(typeof b === 'string' ? b : (b && (b.b || b.t)) || '');

let pass = 0; const ok = (n, c) => { assert.ok(c, n); console.log('PASS ' + n); pass++; };

ok('earlier-career gets NO derived Results line', !byId['earlier-career'].results);
ok('earlier-career keeps all three summary lines', (byId['earlier-career'].bullets || []).length === 3);
ok('the Students Council line stays a bullet', (byId['earlier-career'].bullets || []).some((b) => /Students Council/.test(txt(b))));
ok('an ordinary role still derives from its numeric bullet', /35%/.test(byId.r_derive.results || ''));
ok('the ordinary role hides the derived source bullet', (byId.r_derive.bullets || []).length === 1);

console.log(`earlier-career-no-derive: ${pass}/5 PASS`);
