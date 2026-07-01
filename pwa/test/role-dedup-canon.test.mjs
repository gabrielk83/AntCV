/* COMPANY-VARIANT-KEY-001 + DROP-CANON-HIDDEN-DUP-001 regression guard (owner 2026-07-02).
 *
 * The canon functions (canonIDF, canonTAU, canonCopenhagenWolves) rewrite a VISIBLE role's
 * company to a short/canonical form, but repairExperienceCompleteness compared a raw
 * title|company key against personalInfo (long form) and re-added the PI copy as a HIDDEN
 * duplicate — the owner's "many positions doubled". This loads the REAL sidecar
 * (antcv-sections-normalize-415.js) in a vm with shimmed globals, seeds the owner's exact LIVE
 * roles (three visible canon roles + their three PI-longform hidden dups), runs the normaliser to
 * a fixpoint, and asserts:
 *   1. each of the three canon positions survives EXACTLY ONCE (visible),
 *   2. no HIDDEN role duplicates a VISIBLE one,
 *   3. voluntary roles (Rugby, Students Council) sort LAST, Rugby BEFORE Students Council,
 *   4. a genuinely-missing PI role is STILL restored HIDDEN (completeness net intact),
 *   5. the pipeline is idempotent (a 2nd normalize produces byte-identical sections — no storm).
 *
 * Run:  node --test pwa/test/role-dedup-canon.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SIDECAR = fs.readFileSync(new URL('../antcv-sections-normalize-415.js', import.meta.url), 'utf8');

// The owner's exact LIVE experience.roles (antcv.pages.dev, 2026-07-02), including the three
// PI-longform hidden (on:false) duplicates the old completeness check re-added.
const LIVE_ROLES = [
  { id: 'k',  title: 'Product / Project Expert', company: 'Kanzen Konsulenter ApS', years: '2022 - 2026 (present)', on: true, bullets: ['a','b','c','d','e','f'] },
  { id: 'crl',title: 'Change Request Lead', company: 'Innoviz Technologies', years: '2020 - 2025', on: true, bullets: ['a','b','c','d','e','f','g','h','i'] },
  { id: 'sa', title: 'System Architect', company: 'Innoviz Technologies', years: '2017 - 2020', on: true, bullets: ['a','b','c','d','e','f','g','h','i','j'] },
  { id: 'sir',title: 'Senior Optics & Electro-Optics Engineer', company: 'Sirin Labs', years: '2014 - 2017', on: true, bullets: ['a','b','c','d','e','f'] },
  { id: 'mtl',title: 'Electro-Optics Team Leader', company: 'Meprolight, IWI Group', years: '2013 - 2014', on: true, bullets: ['a','b','c','d'] },
  { id: 'mrd',title: 'R&D Electro-Optics Engineer', company: 'Meprolight, IWI Group', years: '2010 - 2013', on: true, bullets: ['a','b','c','d'] },
  { id: 'sg', title: 'Security Guard, Student Dormitories', company: 'Tel Aviv University', years: '2010', on: true, bullets: ['a','b','c'] },
  { id: 'ra', title: 'Research Assistant', company: 'Tel Aviv University', years: '2007 - 2010', on: true, bullets: ['a','b','c','d','e'] },
  { id: 'ta', title: 'Teaching Assistant', company: 'Tel Aviv University', years: '2006 - 2010', on: true, bullets: ['a'] },
  { id: 'csa',title: 'Computer Systems Administrator', company: 'IDF, Communication Corps', years: '2001 – 2003', on: true, bullets: ['a','b','c'] },
  { id: 'rug',title: 'Team Operations Manager (foreningsarbejde)', company: 'Pan Idræt', years: '2023 - present', on: true, bullets: ['a','b','c'] },
  { id: 'scr',title: 'Students Council Representative', company: 'Tel Aviv University', years: '2005 - 2007', on: true, bullets: ['a','b','c'] },
  // the three PI-longform hidden duplicates:
  { id: 'csa2',title: 'Computer Systems Administrator', company: 'Israel Defense Forces, Communication Corps', years: '2001 – 2003', on: false, bullets: ['a','b','c'] },
  { id: 'scr2',title: 'Students Council Representative', company: 'Tel Aviv University - Electrical Engineering', years: '2005 - 2007', on: false, bullets: ['a','b','c'] },
  { id: 'rug2',title: 'Team Operations Manager & Assistant Coach (Volunteer)', company: 'Copenhagen Wolves RFC - Pan Idræt', years: '2023 – present', on: false, bullets: ['a','b','c'] },
];

// personalInfo.experience holds the ORIGINAL long forms (the completeness source), plus one
// genuinely-missing role that must STILL be restored hidden.
const PI = {
  name: 'Gabriel Alexander Karp-Gershon',
  experience: [
    { title: 'Computer Systems Administrator', company: 'Israel Defense Forces, Communication Corps', years: '2001 – 2003', bullets: ['a','b','c'] },
    { title: 'Students Council Representative', company: 'Tel Aviv University - Electrical Engineering', years: '2005 - 2007', bullets: ['a','b','c'] },
    { title: 'Team Operations Manager & Assistant Coach (Volunteer)', company: 'Copenhagen Wolves RFC - Pan Idræt', years: '2023 – present', bullets: ['a','b','c'] },
    { title: 'Summer Intern', company: 'Old Startup Ltd', years: '1999 - 2000', bullets: ['x'] }, // genuinely missing
  ],
};

function makeLocalStorage(initial) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    _map: m,
  };
}

function runSidecar() {
  const ls = makeLocalStorage({
    sections: JSON.stringify({ cv: [
      { id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'P.' },
      { id: 'experience', title: 'PROFESSIONAL EXPERIENCE', loc: 'main', on: true, type: 'experience', roles: LIVE_ROLES },
    ], cl: [] }),
    personalInfo: JSON.stringify(PI),
  });
  const noop = () => 0;
  const win = {
    addEventListener: noop,
    dispatchEvent: noop,
    CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } },
    StorageEvent: class { constructor(t, o) { Object.assign(this, o); this.type = t; } },
  };
  const ctx = {
    window: win,
    document: { activeElement: null },
    localStorage: ls,
    console: { log: noop, debug: noop, error: noop },
    setTimeout: noop,
    setInterval: noop,
    clearTimeout: noop,
  };
  vm.createContext(ctx);
  vm.runInContext(SIDECAR, ctx);
  const normalize = win.AntcvSectionsNormalize._normalize;
  // run to a fixpoint
  for (let i = 0; i < 12; i++) normalize();
  const after1 = ls.getItem('sections');
  normalize();
  const after2 = ls.getItem('sections');
  return { roles: JSON.parse(after1).cv.find((s) => s.type === 'experience').roles, after1, after2 };
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

test('canon-variant hidden duplicates are removed; each position survives once visible', () => {
  const { roles } = runSidecar();
  const visible = roles.filter((r) => r.on !== false);
  const count = (t) => visible.filter((r) => norm(r.title).startsWith(norm(t))).length;
  assert.equal(count('Computer Systems Administrator'), 1, 'CSA visible once');
  assert.equal(count('Students Council Representative'), 1, 'Students Council visible once');
  assert.equal(count('Team Operations Manager'), 1, 'Team Operations Manager visible once');
});

test('no hidden role duplicates a visible one (year span + title core)', () => {
  const { roles } = runSidecar();
  const yr = (y) => {
    const n = (String(y || '').match(/\d{4}/g) || []).map(Number);
    const pres = /present|current|ongoing/i.test(String(y || ''));
    return (n.length ? Math.min(...n) : 0) + '-' + (pres ? 9999 : (n.length ? Math.max(...n) : 0));
  };
  const core = (t) => norm(t).split(/ and | & /)[0];
  const visible = roles.filter((r) => r.on !== false);
  for (const h of roles.filter((r) => r.on === false)) {
    for (const v of visible) {
      const dup = yr(h.years) === yr(v.years) && (core(h.title) === core(v.title));
      assert.ok(!dup, `hidden "${h.title}" (${h.company}) duplicates visible "${v.title}"`);
    }
  }
});

test('voluntary roles sort last; Rugby before Students Council', () => {
  const { roles } = runSidecar();
  const visible = roles.filter((r) => r.on !== false);
  const iRug = visible.findIndex((r) => /team operations manager/i.test(r.title));
  const iSc = visible.findIndex((r) => /students council/i.test(r.title));
  const iCsa = visible.findIndex((r) => /computer systems administrator/i.test(r.title));
  assert.ok(iRug >= 0 && iSc >= 0, 'both voluntary roles present');
  assert.ok(iRug < iSc, `Rugby (${iRug}) must precede Students Council (${iSc})`);
  // both voluntary roles are the LAST two (after every paid role incl. the military CSA)
  assert.ok(iCsa < iRug, 'paid military role precedes the voluntary block');
  assert.equal(Math.max(iRug, iSc), visible.length - 1, 'a voluntary role is the very last visible role');
});

test('a genuinely-missing PI role is still restored HIDDEN (completeness net intact)', () => {
  const { roles } = runSidecar();
  const intern = roles.find((r) => /summer intern/i.test(r.title));
  assert.ok(intern, 'the genuinely-missing Summer Intern role was restored');
  assert.equal(intern.on, false, 'restored as hidden (on:false), not visible');
});

test('pipeline is idempotent (2nd normalize is byte-identical — no storm)', () => {
  const { after1, after2 } = runSidecar();
  assert.equal(after1, after2, 'a second normalize must not change sections');
});
