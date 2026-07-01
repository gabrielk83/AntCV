// core-comp-compress-eo.test.mjs
// ============================================================
// FOCUS-LABEL-EO-001 (owner 2026-07-01): the electro-optics / photonics CORE
// COMPETENCIES Focus Area came back as a long label ("Optics, photonics &
// semiconductor devices") that the <=25 cap truncated at a word boundary to the
// DANGLING "Optics, photonics &" ("&" is not stripped by capWords). Because the
// sidecar re-runs on every sections-updated, the truncation re-applied after every
// hard reset — the owner's inline edit reverted each time. Fix: name-guarded
// canonicalisation of the EO/photonics label to the owner-preferred "EO & Photonics
// sensors" (22 chars, fits the cap, never re-truncates). Loads the real sidecar in
// a vm sandbox (same shape as core-comp-compress-coord.test.mjs).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-core-comp-compress.js', import.meta.url), 'utf8');

function load(sections, personalInfo) {
  const seed = { sections: JSON.stringify(sections) };
  if (personalInfo !== undefined) seed.personalInfo = JSON.stringify(personalInfo);
  const store = new Map(Object.entries(seed));
  const sandbox = {
    window: { addEventListener() {}, dispatchEvent() { return true; } },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    console: { warn() {}, log() {}, error() {} },
    setTimeout() { return 0; }, setInterval() { return 0; },
    CustomEvent: function (t, o) { this.type = t; Object.assign(this, o); },
    JSON, Array, Object, Error, RegExp, Math, String, Number, Boolean,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return { api: sandbox.window.AntcvCoreCompCompress, store };
}
const H = ['Focus Area', 'Strategic Expertise'];
const GAB = { name: 'Gabriel Alexander Karp-Gershon' };
function runOn(rows, { id = 'core_comp', doc = 'cv', pi = GAB } = {}) {
  const sec = { id, type: 'table', title: id === 'bring' ? 'WHAT I BRING' : 'CORE COMPETENCIES', rows };
  const sections = doc === 'cv' ? { cv: [sec], cl: [] } : { cv: [], cl: [sec] };
  const { api, store } = load(sections, pi);
  api.run();
  const out = JSON.parse(store.get('sections'));
  return (doc === 'cv' ? out.cv : out.cl)[0].rows;
}

test('_canon maps the long optics/photonics label variants to the owner-preferred short form', () => {
  const { api } = load({ cv: [], cl: [] }, GAB);
  assert.equal(api._canon('Optics, photonics & semiconductor devices'), 'EO & Photonic sensors');
  assert.equal(api._canon('Optics, photonics &'), 'EO & Photonic sensors');       // the already-truncated form
  assert.equal(api._canon('Optics & photonics'), 'EO & Photonic sensors');
  assert.equal(api._canon('Electro-optics (EO), photonic sensing'), 'EO & Photonic sensors');
});

test('_canon is idempotent (the target label maps to itself — no growth on re-run)', () => {
  const { api } = load({ cv: [], cl: [] }, GAB);
  assert.equal(api._canon('EO & Photonic sensors'), 'EO & Photonic sensors');
});

test('_canon leaves unrelated focus labels untouched', () => {
  const { api } = load({ cv: [], cl: [] }, GAB);
  assert.equal(api._canon('Requirements Traceability'), 'Requirements Traceability');
  assert.equal(api._canon('Sourcing & Feasibility'), 'Sourcing & Feasibility');
  assert.equal(api._canon('Supplier scoring'), 'Supplier scoring');
});

test('run(): Gabriel core_comp long EO label -> "EO & Photonic sensors" (fits <=25, no dangling &)', () => {
  const rows = runOn([H, ['Optics, photonics & semiconductor devices', 'Electro-optics, photonics, semiconductor physics']]);
  assert.equal(rows[1][0], 'EO & Photonic sensors');
  assert.ok(rows[1][0].length <= 25);
  assert.ok(!/&\s*$/.test(rows[1][0]));
});

test('run(): the previously-truncated "Optics, photonics &" is healed on reload', () => {
  const rows = runOn([H, ['Optics, photonics &', 'x']]);
  assert.equal(rows[1][0], 'EO & Photonic sensors');
});

test('run(): also heals a WHAT I BRING (CL) EO focus label', () => {
  const rows = runOn([H, ['Optics, photonics & imaging', 'x']], { id: 'bring', doc: 'cl' });
  assert.equal(rows[1][0], 'EO & Photonic sensors');
});

test('run() is idempotent for the EO label (no re-truncation across reloads)', () => {
  const once = runOn([H, ['Optics, photonics & semiconductor devices', 'x']]);
  const twice = runOn(once);
  assert.deepEqual(twice, once);
});

test('NAME-GUARD: a non-Gabriel candidate is NOT relabeled to the EO canon', () => {
  const rows = runOn([H, ['Optics, photonics & semiconductor devices', 'x']], { pi: { name: 'Anita Example' } });
  assert.notEqual(rows[1][0], 'EO & Photonic sensors');
  assert.ok(/^optics/i.test(rows[1][0]));
});

test('NAME-GUARD: nested personalInfo.personalInfo.name shape is recognised', () => {
  const rows = runOn([H, ['Optics, photonics &', 'x']], { pi: { personalInfo: { name: 'Gabriel Karp' } } });
  assert.equal(rows[1][0], 'EO & Photonic sensors');
});

// FOCUS-LABEL-EO-002: pin the EO row's Strategic Expertise (heal a dropped "(EO)").
test('run(): pins the EO row expertise, healing a stripped "(EO)"', () => {
  const rows = runOn([H, ['Optics, photonics & devices', 'Electro-optics , photonics, semiconductor physics']]);
  assert.equal(rows[1][0], 'EO & Photonic sensors');
  assert.equal(rows[1][1], 'Electro-optics (EO), photonics, semiconductor physics');
});

test('run(): pins the EO expertise when the cell is empty', () => {
  const rows = runOn([H, ['Optics, photonics', '']]);
  assert.equal(rows[1][1], 'Electro-optics (EO), photonics, semiconductor physics');
});

test('run(): the EO expertise pin is idempotent', () => {
  const once = runOn([H, ['EO & Photonic sensors', 'Electro-optics (EO), photonics, semiconductor physics']]);
  const twice = runOn(once);
  assert.deepEqual(twice, once);
});

test('run(): does NOT clobber an unrelated expertise on the EO row', () => {
  const rows = runOn([H, ['EO & Photonic sensors', 'Requirements traceability and change control']]);
  assert.equal(rows[1][1], 'Requirements traceability and change control');
});

test('NAME-GUARD: a non-Gabriel EO expertise is not pinned', () => {
  const rows = runOn([H, ['Optics, photonics & devices', 'Electro-optics , photonics']], { pi: { name: 'Anita Example' } });
  assert.notEqual(rows[1][1], 'Electro-optics (EO), photonics, semiconductor physics');
});
