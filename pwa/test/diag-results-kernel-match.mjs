/* Unit test — RESULTS-KERNEL-ROLE-MATCH-001 (owner 2026-06-23).
 * A generated doc role carries NO outcomes/proofPointIds (only title/company/bullets).
 * The kernel (personalInfo.workHistory[].outcomes) holds the REAL numeric outcomes,
 * keyed by role. applyOutcomesMode must MATCH the doc role to the kernel role by
 * title|company and use the kernel's numeric outcome as the Results line — not derive
 * from a bullet or a token-matched wrong outcome.
 */
import assert from 'node:assert';

const KERNEL = {
  patentNumber: '241997',
  workHistory: [
    { title: 'Change Request Lead', company: 'Innoviz Technologies', outcomes: [
      'Directed the Change Control Board, cutting the change cycle from roughly 250 days to about 10 days; ran a change-governance process that generated ~30% of FY2025 company earnings ($8M customer NRE).' ] },
    { title: 'Product / Project Expert', company: 'Kanzen Konsulenter ApS', outcomes: [
      'Delivered a Smart FMEA analysis framework over an ALM system with SQL-based backend control, simplifying reporting for 150 users.' ] },
  ],
};
const store = {
  outcomesMode: JSON.stringify('results'),
  personalInfo: JSON.stringify(KERNEL),
  stylePackage: JSON.stringify('nordic-minimal'),
};
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: () => {}, removeItem: () => {} };
globalThis.window = {};

const { applyOutcomesMode } = await import('../antcv-docx-client.js');

// Generated doc roles: NO outcomes / proofPointIds — only the LLM's title/company/bullets.
const sections = [{
  id: 'experience', title: 'PROFESSIONAL EXPERIENCE', type: 'experience', roles: [
    { id: 'r1', title: 'Product / Project Expert', company: 'Kanzen Konsulenter ApS', on: true,
      bullets: ['Build KPI and reporting structures linking engineering progress to delivery.'] },
    { id: 'r2', title: 'Change Request Lead', company: 'Innoviz Technologies', on: true,
      bullets: ['Single point of contact for OEM-driven change requests.'] },
    // a role with NO kernel match and NO numeric bullet → must get NO Results (not a duty restatement)
    { id: 'r3', title: 'Security Guard', company: 'Tel Aviv University', on: true,
      bullets: ['Handle access control and monitor activity during shifts.',
                'Maintain safety and order in a student-dormitory residential environment.'] },
  ],
},
// applyOutcomesMode only runs in 'results' mode when a SELECTED OUTCOMES section exists.
// Use outcomes that do NOT token-match Kanzen/Innoviz so the roles can only laminate via 3b.
{ id: 'selected_outcomes', title: 'SELECTED OUTCOMES', type: 'text_bullets',
  items: ['Mentored a cohort of graduate interns in laboratory methods.'] }];

const out = applyOutcomesMode(sections, 'cv');
const roles = out.find((s) => s.type === 'experience').roles;
let pass = 0; const ok = (n, c) => { assert.ok(c, n); console.log('PASS ' + n); pass++; };

ok('Kanzen role adopts its kernel numeric outcome (150 users)', /150 users/.test(roles[0].results || ''));
ok('Innoviz role adopts its kernel numeric outcome (250 days -> 10)', /250 days/.test(roles[1].results || '') && /10/.test(roles[1].results || ''));
ok('no-outcome non-numeric role gets NO Results (no duty restatement)', !roles[2].results);
ok('non-numeric role keeps its bullets as content', (roles[2].bullets || []).length >= 1);

console.log(`\nRESULTS-KERNEL-MATCH OK (${pass} checks)`);
