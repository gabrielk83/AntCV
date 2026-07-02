// gabriel-results-pin.test.mjs
// ============================================================
// GABRIEL-RESULTS-PIN-001 (owner 2026-07-02 "make preview and PDF match"): pin the 5 kernel
// role_results_exact lines onto role.results so the preview stops copycatting the bullets and
// matches the export (which pins the same 5 via antcv-docx-client _GAB_EXACT). Name-guarded,
// idempotent, resultsOverride still wins at render.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-gabriel-results-pin.js', import.meta.url), 'utf8');

function load(store0) {
  const store = new Map(Object.entries(store0 || {}));
  const sandbox = {
    window: { addEventListener() {}, dispatchEvent() { return true; } },
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    setTimeout() { return 0; },
    CustomEvent: function (t, o) { this.type = t; Object.assign(this, o); },
    JSON, Array, Object, Error, RegExp, Math, String, Number, Boolean,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return { api: sandbox.window.AntcvGabResultsPin, store };
}
const GAB = JSON.stringify({ name: 'Gabriel Karp-Gershon' });
const withRoles = (roles, pi = GAB) => ({ personalInfo: pi, sections: JSON.stringify({ cv: [{ id: 'experience', type: 'experience', roles }], cl: [] }) });

test('_pinFor matches all 5 kernel roles by title + company', () => {
  const { api } = load({ personalInfo: GAB });
  const hit = (title, company) => api._pinFor({ title, company });
  assert.match(hit('Computer Systems Administrator', 'IDF, Communication Corps'), /100 users across 150 machines/);
  assert.match(hit('Security Guard, Student Dormitories', 'Tel Aviv University'), /750-resident/);
  assert.match(hit('Research Assistant', 'Tel Aviv University'), /non-imprinted won on structure/);
  assert.match(hit('Team Operations Manager (foreningsarbejde)', 'Pan Idraet'), /25-player squad/);
  assert.match(hit('Students Council Representative', 'Tel Aviv University'), /15 outdated EE exam/);
});

test('TA pin (ROLE-RESULTS-MISSING-TA-SG-001): a SPLIT Teaching Assistant slot gets the distinct teaching result', () => {
  const { api } = load({ personalInfo: GAB });
  assert.match(api._pinFor({ title: 'Teaching Assistant', company: 'Tel Aviv University' }), /SEM, Raman, and confocal microscopy/);
  // the merged kernel title is EXCLUDED (keeps status quo — no TA pin, RA regex does not match it either)
  assert.equal(api._pinFor({ title: 'R&D and Teaching Assistant', company: 'Tel Aviv University' }), null);
  // the slashed variant still routes to the RA benchmark pin (checked first in PINS order)
  assert.match(api._pinFor({ title: 'Teaching / Research Assistant', company: 'Tel Aviv University' }), /non-imprinted won on structure/);
  // company gate: a non-TAU teaching assistant is untouched
  assert.equal(api._pinFor({ title: 'Teaching Assistant', company: 'Copenhagen Business School' }), null);
});

test('PINS sidecar and docx-client _GAB_EXACT carry identical entries (preview/export parity)', async () => {
  const client = await readFile(new URL('../../antcv-docx-client.js', import.meta.url), 'utf8');
  const grab = (t) => t.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.startsWith('{ reT: '));
  const pins = grab(src);
  const exact = grab(client);
  assert.equal(pins.length, 7, 'PINS has 7 entries');
  assert.deepEqual(pins, exact.map((l) => l.replace(/\},$/, '},')), 'entry lines byte-identical');
});

test('_pinFor pins the Sirin Result to the DISTINCT patent-work line (not the bullet restatement)', () => {
  const { api } = load({ personalInfo: GAB });
  const t = api._pinFor({ title: 'Senior Optics & Electro-Optics Engineer', company: 'Sirin Labs' });
  // RESULTS-PIN-NO-NUMBER-001: the number lives ONCE, in PUBLICATIONS & PATENTS —
  // the Result describes the work with no number at all
  assert.match(t, /Co-invented the stray-light optical window, now in commercial devices\./);
  assert.doesNotMatch(t, /241997|Patent No\./);
  // the trimmed line must NOT carry the bullet's leading clause
  assert.doesNotMatch(t, /7-person|Sigma-Connectivity|Directed technical work/);
});

// ── RESULTS-PIN-OWNER-EDIT-001 (owner 2026-07-03): "deleting the patent number
// ... makes it jump back to previous form" — owner edits must STICK. ──
test('run() leaves an owner-edited Results line alone', () => {
  const ownerEdit = 'Co-invent a stray-light optical window, now shipping in volume.';
  const { api, store } = load(withRoles([
    { title: 'Senior Optics & Electro-Optics Engineer', company: 'Sirin Labs', bullets: ['Architect optical subsystems for quality, size and manufacturability.'], results: ownerEdit },
  ]));
  api.run();
  assert.equal(JSON.parse(store.get('sections')).cv[0].roles[0].results, ownerEdit, 'owner edit survives the pin sweep');
});

test('run() upgrades SUPERSEDED pin texts (both prior forms) to the current numberless pin', () => {
  for (const oldPin of [
    'Co-invented the stray-light optical window (Patent No. 241997), now in commercial devices.',
    'Co-invented the stray-light optical window (241997), now in commercial devices.',
  ]) {
    const { api, store } = load(withRoles([
      { title: 'Senior Optics & Electro-Optics Engineer', company: 'Sirin Labs', bullets: [], results: oldPin },
    ]));
    api.run();
    const r = JSON.parse(store.get('sections')).cv[0].roles[0].results;
    assert.match(r, /optical window, now in commercial devices\./, 'upgraded to the current pin');
    assert.doesNotMatch(r, /241997/, 'the number lives only in PUBLICATIONS & PATENTS');
  }
});

test('run() still replaces a bullet-COPYCAT result (the original reason pins exist)', () => {
  const bullet = 'Coordinate a 7-person ODM task force for a smartphone optical stack.';
  const { api, store } = load(withRoles([
    { title: 'Senior Optics & Electro-Optics Engineer', company: 'Sirin Labs', bullets: [bullet], results: bullet },
  ]));
  api.run();
  assert.match(JSON.parse(store.get('sections')).cv[0].roles[0].results, /optical window, now in commercial devices\./, 'copycat result replaced by the pin');
});

test('SIRIN gate: the Meprolight EO roles are NOT caught by the Sirin pin', () => {
  const { api } = load({ personalInfo: GAB });
  assert.equal(api._pinFor({ title: 'Electro-Optics Team Leader', company: 'Meprolight, IWI Group' }), null);
  assert.equal(api._pinFor({ title: 'R&D Electro-Optics Engineer', company: 'Meprolight, IWI Group' }), null);
});

test('_pinFor returns null for an unrelated role', () => {
  const { api } = load({ personalInfo: GAB });
  assert.equal(api._pinFor({ title: 'Product / Project Expert', company: 'Kanzen Konsulenter ApS' }), null);
});

test('run() writes the numeric result onto a role that was copycatting its bullets', () => {
  const { api, store } = load(withRoles([
    { title: 'Computer Systems Administrator', company: 'IDF, Communication Corps', bullets: ['Administer classified IT infrastructure; automated backup-and-restore procedure,'], results: '' },
  ]));
  api.run();
  const r = JSON.parse(store.get('sections')).cv[0].roles[0];
  assert.match(r.results, /Support 100 users across 150 machines/);
});

test('run() is idempotent (no rewrite once the pin is in place)', () => {
  const pinned = 'Support 100 users across 150 machines in a classified construction centre, with documented access, support, and recovery workflows.';
  const { api, store } = load(withRoles([{ title: 'Computer Systems Administrator', company: 'IDF, Communication Corps', results: pinned }]));
  const before = store.get('sections');
  api.run();
  assert.equal(store.get('sections'), before);   // unchanged -> no write
});

test('NAME-GUARD: a non-Gabriel candidate is untouched', () => {
  const { api, store } = load(withRoles([{ title: 'Computer Systems Administrator', company: 'IDF, Communication Corps', results: '' }], JSON.stringify({ name: 'Anita Example' })));
  const before = store.get('sections');
  api.run();
  assert.equal(store.get('sections'), before);
});

test('kill-switch blocks the pin', () => {
  const s = withRoles([{ title: 'Computer Systems Administrator', company: 'IDF, Communication Corps', results: '' }]);
  s['antcv:disable-gabriel-results-pin'] = '1';
  const { api, store } = load(s);
  const before = store.get('sections');
  api.run();
  assert.equal(store.get('sections'), before);
});
