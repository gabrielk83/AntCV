/* Unit test — OUTCOMES-RESULTS-EXPORT-PARITY-001.
 * The EXPORT half (applyOutcomesMode in antcv-docx-client.js) must match the
 * fixed preview: role-specific, deduped vs bullets, capped, first role not
 * starved, patent filtered. No browser — localStorage is mocked.
 */
import assert from 'node:assert';

// minimal localStorage mock (module reads outcomesMode + personalInfo)
const store = {
  outcomesMode: JSON.stringify('results'),
  personalInfo: JSON.stringify({ patentNumber: '241997' }),
};
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: () => {}, removeItem: () => {} };
globalThis.window = {};

const { applyOutcomesMode } = await import('../antcv-docx-client.js');

const ROLES = [
  { title: 'Product / Project Expert', company: 'Konzen konsulenter i nord ApS', on: true, bullets: [
    'Founded a consultancy bridging hardware product development and technical-commercial evaluation.',
    'Led RFQ and RFI evaluation programmes with structured supplier scoring.'] },
  { title: 'System Architect & Change Control Lead', company: 'Innoviz Technologies', on: true, bullets: [
    'Owned change governance for the LiDAR product line under Automotive SPICE.',
    'Coordinated cross-team change requests from OEM customers.'] },
  { title: 'EO / Optics Engineer', company: 'Sirin Optics', on: true, bullets: [
    'Designed optical systems and validation setups.'] },
];
const OUTCOMES = [
  '90% cost reduction through supplier consolidation across the programme',
  'Cut development cycle time by 40% using Six Sigma and design of experiments',
  'Led RFQ and RFI evaluation programmes with structured supplier scoring',   // DUP of role0 bullet → dropped
  'Reduced LiDAR rework by introducing structured change governance and traceability',
  'Improved optical resolution by 2x on the machine-vision sensor line',
  'Patent 241997 cover window reducing crosstalk between optical components', // patent → filtered
];
const sections = [
  { id: 'experience', title: 'PROFESSIONAL EXPERIENCE', type: 'experience', roles: ROLES },
  { id: 'selected_outcomes', title: 'SELECTED OUTCOMES', type: 'text_bullets', items: OUTCOMES },
];

const out = applyOutcomesMode(sections, 'cv');
const exp = out.find((s) => s.type === 'experience');
const roles = exp.roles;
const withResults = roles.filter((r) => r.results);

let pass = 0; const ok = (n, c) => { assert.ok(c, n); console.log('PASS ' + n); pass++; };

ok('SELECTED OUTCOMES section dropped', !out.some((s) => /selected_outcomes/.test(s.id || '')));
ok('every role got a Results string (first role not starved)', withResults.length === 3 && !!roles[0].results);
ok('no role echoes the duplicated bullet verbatim', !roles.some((r) => (r.results || '').includes('Led RFQ and RFI evaluation programmes with structured supplier scoring')));
ok('no Results line exceeds ~2 lines (<=185 chars)', withResults.every((r) => r.results.length <= 185));
ok('patent filtered from all Results', !roles.some((r) => /241997|patent/i.test(r.results || '')));
ok('results are disjoint (no two roles identical)', new Set(withResults.map((r) => r.results)).size === withResults.length);

for (const r of roles) console.log(`  [${r.title}] ${r.results || '(none)'}`);
console.log(`\nEXPORT-OUTCOMES-PARITY OK (${pass} checks)`);
