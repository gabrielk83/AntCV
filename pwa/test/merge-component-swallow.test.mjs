/* MERGE-COMPONENT-SWALLOW-001 regression guard (owner 2026-07-18).
 *
 * Owner on a regenerated CV: "I see both 'System Architect & Change Request Lead' and
 * 'System Architect'" (and the same doubling for Research/Teaching Assistant and the
 * R&D Electro-Optics roles). The kernel stores ATOMIC roles and merging is the app's
 * job at generation; the rule is NEVER both a merged role AND one of its components.
 * dedupeRoles is exact-title-only (ROLE-DECOMP-001), so swallowMergedComponents was
 * added to drop a bare component that an explicit "X & Y" merged title already covers.
 *
 * Loads the REAL sidecar in a vm, seeds merged+component pairs (generic companies so no
 * Gabriel-specific canon interferes), normalises to a fixpoint, and asserts the bare
 * components are gone, the merged titles survive, and non-component same-company roles
 * are untouched.
 *
 * Run:  node --test pwa/test/merge-component-swallow.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SIDECAR = fs.readFileSync(new URL('../antcv-sections-normalize-415.js', import.meta.url), 'utf8');

// Merged roles + their bare atomic components (the doubling), plus two negatives.
const ROLES = [
  { id: 'm1', title: 'Alpha Lead & Beta Lead', company: 'Acme Corp', years: '2017 - 2020', on: true, bullets: ['a', 'b', 'c'] },
  { id: 'c1', title: 'Alpha Lead', company: 'Acme Corp', years: '2017 - 2020', on: true, bullets: ['a', 'b'] },            // component -> dropped
  { id: 'm2', title: 'Research Assistant & Teaching Assistant', company: 'Beta University', years: '2006 - 2010', on: true, bullets: ['a', 'b'] },
  { id: 'c2', title: 'Teaching Assistant', company: 'Beta University', years: '2006 - 2010', on: true, bullets: ['a'] },   // 2nd-component -> dropped
  { id: 'm3', title: 'R&D Widget Engineer & Team Leader', company: 'Gamma Ltd', years: '2010 - 2014', on: true, bullets: ['a', 'b'] },
  { id: 'c3', title: 'R&D Widget Engineer', company: 'Gamma Ltd', years: '2010 - 2013', on: true, bullets: ['a'] },       // R&D intact -> dropped
  // NEGATIVE 1: not a component of the merge -> both kept
  { id: 'n1', title: 'Product Manager', company: 'Delta Inc', years: '2015 - 2016', on: true, bullets: ['a'] },
  { id: 'n2', title: 'Project Manager & Team Lead', company: 'Delta Inc', years: '2015 - 2016', on: true, bullets: ['a'] },
  // NEGATIVE 2: same title as a merged component but DIFFERENT company -> kept
  { id: 'n3', title: 'Alpha Lead', company: 'Other Co', years: '2017 - 2020', on: true, bullets: ['a'] },
];

function makeLocalStorage(initial) {
  const m = new Map(Object.entries(initial));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _map: m };
}

function runSidecar(roles) {
  const ls = makeLocalStorage({
    sections: JSON.stringify({ cv: [
      { id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'P.' },
      { id: 'experience', title: 'PROFESSIONAL EXPERIENCE', loc: 'main', on: true, type: 'experience', roles },
    ], cl: [] }),
    personalInfo: JSON.stringify({ name: 'Test Candidate', experience: [] }),
  });
  const noop = () => 0;
  const win = {
    addEventListener: noop, dispatchEvent: noop,
    CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } },
    StorageEvent: class { constructor(t, o) { Object.assign(this, o); this.type = t; } },
  };
  const ctx = { window: win, document: { activeElement: null }, localStorage: ls, console: { log: noop, debug: noop, error: noop }, setTimeout: noop, setInterval: noop, clearTimeout: noop };
  vm.createContext(ctx);
  vm.runInContext(SIDECAR, ctx);
  const normalize = win.AntcvSectionsNormalize._normalize;
  for (let i = 0; i < 12; i++) normalize();
  const after1 = ls.getItem('sections');
  normalize();
  const after2 = ls.getItem('sections');
  return { roles: JSON.parse(after1).cv.find((s) => s.type === 'experience').roles, after1, after2 };
}

const nm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

test('bare components of an explicit "X & Y" merge are dropped; the merged role survives', () => {
  const { roles } = runSidecar(ROLES);
  const titles = roles.map((r) => nm(r.title));
  // merged survivors present
  assert.ok(titles.some((t) => t.includes('alpha lead') && t.includes('beta lead')), 'merged Alpha & Beta Lead kept');
  assert.ok(titles.some((t) => t.includes('research assistant') && t.includes('teaching assistant')), 'merged Research & Teaching kept');
  assert.ok(titles.some((t) => t.includes('r d widget engineer') && t.includes('team leader')), 'merged R&D & Team Leader kept');
  // bare components gone at Acme/Beta/Gamma (a component == exactly one merged part, same company)
  const at = (co) => roles.filter((r) => nm(r.company) === nm(co));
  assert.equal(at('Acme Corp').filter((r) => nm(r.title) === 'alpha lead').length, 0, 'bare Alpha Lead @Acme dropped');
  assert.equal(at('Beta University').filter((r) => nm(r.title) === 'teaching assistant').length, 0, 'bare Teaching Assistant @Beta dropped (2nd component)');
  assert.equal(at('Gamma Ltd').filter((r) => nm(r.title) === 'r d widget engineer').length, 0, 'bare R&D Widget Engineer @Gamma dropped');
});

test('non-component same-company roles and same-title-different-company roles are untouched', () => {
  const { roles } = runSidecar(ROLES);
  const titles = roles.map((r) => nm(r.title));
  assert.ok(titles.includes('product manager'), 'Product Manager kept (not a component of "Project Manager & Team Lead")');
  assert.ok(titles.some((t) => t.includes('project manager') && t.includes('team lead')), 'Project Manager & Team Lead kept');
  // same title as a merged component but a DIFFERENT company must survive
  assert.ok(roles.some((r) => nm(r.title) === 'alpha lead' && nm(r.company) === 'other co'), 'Alpha Lead @Other Co kept (different company)');
});

test('idempotent: a second normalize is byte-identical (no re-add storm)', () => {
  const { after1, after2 } = runSidecar(ROLES);
  assert.equal(after1, after2, 'second normalize produced identical sections');
});
