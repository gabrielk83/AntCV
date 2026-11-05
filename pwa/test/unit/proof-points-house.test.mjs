// proof-points-house.test.mjs
// ============================================================
// PROOF-POINTS-HOUSE-001 (owner 2026-11-05 "proof points do not match academy format and
// content"): the sidebar PROOF POINTS block takes the house margin-CV shape - a big figure
// with a small caption, five at most, DA title "Resultater i tal" - and an English document
// draws its lines from the kernel's pinned proof points instead of role-bullet fragments.
// Loads the REAL sidecar in a vm sandbox with a localStorage shim.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-proof-points-sidebar.js', import.meta.url), 'utf8');

function load(seed) {
  const m = new Map(Object.entries(seed));
  const ls = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  const events = [];
  const sb = {
    window: { addEventListener() {}, dispatchEvent: (e) => events.push(e.detail && e.detail.reason) },
    document: { body: { dataset: {} }, head: null, getElementById: () => null, createElement: () => ({ style: {} }) },
    localStorage: ls, setTimeout: () => 0, CustomEvent: function (t, o) { this.type = t; this.detail = o && o.detail; },
    JSON, Array, Object, String, Number, Math, RegExp, parseFloat, parseInt, Error,
  };
  vm.createContext(sb); vm.runInContext(src, sb);
  return { api: sb.window.AntcvProofPoints, m, events };
}

const PINNED = [
  'Co-inventor of Patent No. 241997 for reducing optical crosstalk between adjacent sensors',
  'Cut change-request cycle time from ~250 to ~10 days at Innoviz via a Change Control Board process',
  'Compared alternative LiDAR architectures and ran trade-off/supplier analysis that reduced product cost by 90% (10×).',
  'Managed 3,400 of 3,600 system requirements in the ALM tool as one of 6 system architects, through to Tier-1 customer sign-off',
  'Designed, built and shipped AntCV (Supervisor + multi-LLM consensus) solo',
  'Delivered a Smart FMEA analysis framework over an ALM system with SQL backend, simplifying reporting for 150 users',
  'Directed technical work across a 7-person electro-optics team at the Sigma-Connectivity ODM site in Sweden from prototype to production at Sirin',
  'Two peer-reviewed nanotech publications + a Eurosensors poster; 10× faster gating response benchmark',
];
const base = {
  sections: JSON.stringify({ cv: [{ id: 'profile', type: 'text', loc: 'main', on: true, content: 'x' }, { id: 'tools', type: 'labeled_list', loc: 'sidebar', on: true, items: [{ l: 'Software', v: 'Jira' }] }], cl: [] }),
  personalInfo: JSON.stringify({ name: 'Gabriel Alexander Karp-Gershon', proofPoints: PINNED }),
  stylePackage: JSON.stringify('copenhagen-modern'), language: JSON.stringify('en'),
};

test('figure(): the owner lines split into house-shaped figure + caption', () => {
  const { api } = load(base);
  const f1 = api.figure(PINNED[1]);
  assert.equal(f1.big, '250 → 10 days');
  assert.equal(f1.cap, 'cut change-request cycle time at Innoviz');
  assert.equal(api.figure(PINNED[2]).cap, 'reduced product cost', 'the result clause is the caption, not the opener');
  assert.equal(api.figure(PINNED[2]).big, '10x');
  assert.equal(api.figure(PINNED[3]).big, '3,400 of 3,600');
  assert.equal(api.figure(PINNED[5]).big, '150 users');
  assert.equal(api.figure(PINNED[6]).big, '7-person');
  assert.equal(api.figure(PINNED[7]).big, '10x');
  assert.equal(api.figure(PINNED[0]), null, 'a patent number is not a result figure');
  assert.equal(api.figure(PINNED[4]), null, 'no number, no proof point');
  for (const l of PINNED) { const f = api.figure(l); if (f) { assert.ok(f.big.length <= 16, f.big); assert.ok(f.cap.length >= 10 && f.cap.length <= 49, f.cap); assert.ok(!/[.;:,]$/.test(f.cap), 'no trailing stop: ' + f.cap); } }
});

test('run(): an English document builds a labeled_list of at most 5 pinned figures, first in the sidebar', () => {
  const { api, m, events } = load(base);
  api.run();
  const cv = JSON.parse(m.get('sections')).cv;
  const pp = cv.find((s) => s.id === 'proof_points');
  assert.ok(pp, 'block written');
  assert.equal(pp.type, 'labeled_list');
  assert.equal(pp.title, 'Proof points');
  assert.equal(pp.loc, 'sidebar');
  assert.ok(pp.items.length >= 3 && pp.items.length <= 5, 'house count: ' + pp.items.length);
  assert.ok(pp.items.every((it) => it.l && it.v), 'every item is figure + caption');
  assert.ok(pp.items.some((it) => it.l === '250 → 10 days'), 'the change-cycle figure is present');
  assert.equal(cv.findIndex((s) => s.id === 'proof_points'), cv.findIndex((s) => s.loc === 'sidebar'), 'first sidebar section');
  assert.deepEqual(events, ['proof-points-sidebar']);
  const once = m.get('sections'); api.run(); assert.equal(m.get('sections'), once, 'idempotent');
});

test('run(): a Danish document keeps the translated section fragments and the house title', () => {
  const da = Object.assign({}, base, { language: JSON.stringify('da'),
    sections: JSON.stringify({ cv: [{ id: 'experience', type: 'experience', loc: 'main', on: true, roles: [
      { title: 'Systemarkitekt', results: 'Resultat: ændringscyklus fra ~250 til ~10 dage; 3.400 af 3.600 krav verificeret' },
      { title: 'Projektleder', results: 'Resultat: 20.000 enheder/uge på én linje; 7-person team ledet i Sverige' },
      { title: 'Ingeniør', results: 'Resultat: rapportering forenklet for 150 brugere' } ] }], cl: [] }) });
  const { api, m } = load(da);
  api.run();
  const pp = JSON.parse(m.get('sections')).cv.find((s) => s.id === 'proof_points');
  assert.ok(pp, 'block written from fragments');
  assert.equal(pp.title, 'Resultater i tal');
  assert.ok(pp.items.every((it) => it.l && it.v));
});

test('a hand-edited block is left alone', () => {
  const edited = Object.assign({}, base, { sections: JSON.stringify({ cv: [
    { id: 'proof_points', type: 'labeled_list', loc: 'sidebar', on: true, title: 'Proof points', items: [{ l: 'my own', v: 'hand-written caption' }], _proofAuto: '[]' },
    { id: 'tools', type: 'labeled_list', loc: 'sidebar', on: true, items: [] } ], cl: [] }) });
  const { api, m } = load(edited);
  api.run();
  const pp = JSON.parse(m.get('sections')).cv.find((s) => s.id === 'proof_points');
  assert.deepEqual(pp.items, [{ l: 'my own', v: 'hand-written caption' }]);
});
