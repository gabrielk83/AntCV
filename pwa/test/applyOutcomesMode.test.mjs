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
// RESULTS-LAMINATION-002 (owner 2026-06-15): only roles with a GENUINE token-matched
// outcome get a Results line; the rest stay EMPTY (no random spill, no bullet copy).
// Role 1 shares "change" with the LiDAR-rework outcome → matched. Roles 0 & 2 have no
// genuine token overlap → empty (they are NOT padded from leftover outcomes).
ok('only genuinely matched roles get Results (no random spill)', withResults.length === 1 && /LiDAR rework/.test(roles[1].results || ''));
ok('unmatched roles stay EMPTY (no spill, no bullet copy)', !roles[0].results && !roles[2].results);
ok('unmatched outcomes are dropped, not spilled onto unrelated roles', !roles.some((r) => /supplier consolidation|Six Sigma|optical resolution/i.test(r.results || '')));
ok('no role echoes the duplicated bullet verbatim', !roles.some((r) => (r.results || '').includes('Led RFQ and RFI evaluation programmes with structured supplier scoring')));
ok('no role result is a verbatim copy of one of its own bullets', roles.every((r) => { const res = (r.results || '').trim(); if (!res) return true; return !(r.bullets || []).map((b) => String(typeof b === 'string' ? b : (b && (b.b || b.t)) || '').trim()).some((b) => b && res.includes(b)); }));
ok('no Results line exceeds ~2 lines (<=185 chars)', withResults.every((r) => r.results.length <= 185));
ok('patent filtered from all Results', !roles.some((r) => /241997|patent/i.test(r.results || '')));

for (const r of roles) console.log(`  [${r.title}] ${r.results || '(none)'}`);
console.log(`\nEXPORT-OUTCOMES-PARITY OK (${pass} checks)`);
