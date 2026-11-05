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

test('PROOF-POINTS-HOUSE-001b: a legacy auto block with foreign item keys is NOT an edit and is rebuilt (EN)', () => {
  const legacyItems = [{ t: 'Simplifying reporting for 150 users' }, { t: 'Through to Tier-1 customer sign-off' }, { t: 'Wrote pricing and decision material for 4 offers' }];
  const stored = legacyItems.map((i) => Object.assign({}, i, { bullets: [] }));          // shape belts added keys
  const seed = Object.assign({}, base, { sections: JSON.stringify({ cv: [
    { id: 'proof_points', type: 'bullets', loc: 'sidebar', on: true, title: 'Proof points', items: stored, _proofAuto: JSON.stringify(legacyItems), bullets: [] },
    { id: 'tools', type: 'labeled_list', loc: 'sidebar', on: true, items: [] } ], cl: [] }) });
  const { api, m } = load(seed);
  assert.equal(api.isEdited(JSON.parse(seed.sections).cv[0]), false);
  api.run();
  const pp = JSON.parse(m.get('sections')).cv.find((s) => s.id === 'proof_points');
  assert.equal(pp.type, 'labeled_list');
  assert.ok(pp.items.some((it) => it.l === '250 → 10 days'), 'rebuilt from the pinned lines');
});

test('PROOF-POINTS-HOUSE-001b: a pre-house bullets block in a Danish document is upgraded, a Danish labeled_list edit is kept', () => {
  const daSecs = { cv: [
    { id: 'proof_points', type: 'bullets', loc: 'sidebar', on: true, title: 'Beviser', items: [{ t: 'Forenkling af rapportering for 150 brugere' }], _proofAuto: JSON.stringify([{ t: 'Simplifying reporting for 150 users' }]) },
    { id: 'experience', type: 'experience', loc: 'main', on: true, roles: [
      { title: 'A', results: 'Resultat: ændringscyklus fra ~250 til ~10 dage' }, { title: 'B', results: 'Resultat: 20.000 enheder/uge på én linje' }, { title: 'C', results: 'Resultat: rapportering forenklet for 150 brugere' } ] } ], cl: [] };
  const { api, m } = load(Object.assign({}, base, { language: JSON.stringify('da'), sections: JSON.stringify(daSecs) }));
  assert.equal(api.isEdited(daSecs.cv[0]), false, 'translated pre-house block is an upgrade');
  api.run();
  const pp = JSON.parse(m.get('sections')).cv.find((s) => s.id === 'proof_points');
  assert.equal(pp.type, 'labeled_list'); assert.equal(pp.title, 'Resultater i tal');
  const edited = { id: 'proof_points', type: 'labeled_list', items: [{ l: '250 → 10 dage', v: 'min egen tekst' }], _proofAuto: JSON.stringify([['250 → 10 dage', 'auto tekst']]) };
  assert.equal(api.isEdited(edited), true, 'a changed caption in the house shape is the owner’s edit');
});

test('figure(): a range with qualifiers and the unit on the first number', () => {
  const { api } = load(base);
  const f = api.figure('Results: cutting the change cycle from roughly 250 days to about 10 as change-board chair');
  assert.equal(f.big, '250 → 10 days');
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

test('PROOF-POINTS-HOUSE-001c: the rich_block {b, t} re-typing by the 763 belt is not an edit', () => {
  const { api } = load(base);
  const auto = JSON.stringify([['250 \u2192 10 days', 'cut change-request cycle time at Innoviz'], ['10x', 'reduced product cost']]);
  const retyped = { id: 'proof_points', type: 'rich_block', items: [{ b: '250 \u2192 10 days', t: 'cut change-request cycle time at Innoviz', bullets: [] }, { b: '10x', t: 'reduced product cost' }], _proofAuto: auto };
  assert.equal(api.isEdited(retyped), false);
  const changed = { id: 'proof_points', type: 'rich_block', items: [{ b: '250 \u2192 10 days', t: 'my own words' }, { b: '10x', t: 'reduced product cost' }], _proofAuto: auto };
  assert.equal(api.isEdited(changed), true);
});

// PROOF-POINTS-LANG-001 (owner 2026-11-05): the block follows the output language. The translate
// pass collects the lines by index and applies by index minutes later; the belt must not rebuild
// the block in between, and under a non-EN ribbon the translation owns the lines.
const DA_BLOCK = { id: 'proof_points', type: 'rich_block', loc: 'sidebar', on: true, title: 'Beviser', items: [
  { b: '3,400 of 3,600', t: 'håndterede systemkrav i ALM-værktøjet', bullets: [] },
  { b: '150 brugere', t: 'forenkling af rapportering', bullets: [] },
  { b: '250 → 10 dage', t: 'skar ændringsanmodningscyklussen hos Innoviz', bullets: [] } ] };
const DA_SECS = { cv: [
  { id: 'profile', type: 'text', loc: 'main', on: true, content: 'Profil på dansk' },
  { id: 'tools', type: 'labeled_list', loc: 'sidebar', on: true, items: [{ l: 'Software', v: 'Jira' }] },
  DA_BLOCK,
  { id: 'experience', type: 'experience', loc: 'main', on: true, roles: [
    { title: 'A', results: 'Results: simplifying reporting for 150 users' }, { title: 'B', results: 'Results: wrote pricing and decision material for 4 offers' }, { title: 'C', results: 'Resultat: 10x hurtigere gating' } ] } ], cl: [] };

test('PROOF-POINTS-LANG-001: under a non-EN ribbon the translated lines are kept, the house title is pinned, the block stays first', () => {
  const { api, m } = load(Object.assign({}, base, { language: JSON.stringify('da'), sections: JSON.stringify(DA_SECS) }));
  api.run();
  const cv = JSON.parse(m.get('sections')).cv;
  const pp = cv.find((s) => s.id === 'proof_points');
  assert.equal(pp.title, 'Resultater i tal', 'house title pinned over the LLM title');
  assert.deepEqual(pp.items.map((i) => [i.b, i.t]), DA_BLOCK.items.map((i) => [i.b, i.t]), 'the translation owns the lines - no rebuild from the English role fragments');
  assert.equal(cv.findIndex((s) => s.id === 'proof_points'), cv.findIndex((s) => s.loc === 'sidebar'), 'first sidebar section');
  const st = JSON.parse(m.get('antcv:proofPointsAuto'));
  assert.equal(st.lang, 'da', 'the language the block was last written under is stamped');
});

test('PROOF-POINTS-LANG-001: an EN ribbon over a block stamped in another language rebuilds it from the kernel lines (a translation is not an edit)', () => {
  const seed = Object.assign({}, base, { sections: JSON.stringify(DA_SECS), 'antcv:proofPointsAuto': JSON.stringify({ lang: 'da', hash: 'x' }) });
  const { api, m } = load(seed);
  assert.equal(api.isEdited(DA_BLOCK), false);
  api.run();
  const pp = JSON.parse(m.get('sections')).cv.find((s) => s.id === 'proof_points');
  assert.equal(pp.title, 'Proof points');
  assert.ok(pp.items.some((it) => it.l === '250 → 10 days'), 'kernel lines back');
  assert.equal(JSON.parse(m.get('antcv:proofPointsAuto')).lang, 'en');
});

test('PROOF-POINTS-LANG-001: with an EN stamp a changed block is the owner\'s edit even though the 763 re-typer dropped _proofAuto', () => {
  const stamped = Object.assign({}, base, { 'antcv:proofPointsAuto': JSON.stringify({ lang: 'en', hash: JSON.stringify([['250 → 10 days', 'auto caption']]) }) });
  const { api } = load(stamped);
  assert.equal(api.isEdited({ id: 'proof_points', type: 'rich_block', items: [{ b: '250 → 10 days', t: 'my own caption', bullets: [] }] }), true);
  assert.equal(api.isEdited({ id: 'proof_points', type: 'rich_block', items: [{ b: '250 → 10 days', t: 'auto caption', bullets: [] }] }), false);
});

test('PROOF-POINTS-LANG-001: while a translate pass is in flight the belt does nothing', () => {
  const mm = new Map(Object.entries(base));
  const ls = { getItem: (k) => (mm.has(k) ? mm.get(k) : null), setItem: (k, v) => mm.set(k, String(v)), removeItem: (k) => mm.delete(k) };
  // the sandbox window is the belt's window; app.js sets window.__antcvTranslateBusy to the target language around the pass
  const sb = { window: { addEventListener() {}, dispatchEvent() {}, __antcvTranslateBusy: 'en' }, document: { body: { dataset: {} }, head: null, getElementById: () => null, createElement: () => ({ style: {} }) },
    localStorage: ls, setTimeout: () => 0, CustomEvent: function () {}, JSON, Array, Object, String, Number, Math, RegExp, parseFloat, parseInt, Error };
  vm.createContext(sb); vm.runInContext(src, sb);
  sb.window.AntcvProofPoints.run();
  assert.equal(mm.get('sections'), base.sections, 'no write while window.__antcvTranslateBusy is set');
  sb.window.__antcvTranslateBusy = '';
  sb.window.AntcvProofPoints.run();
  assert.notEqual(mm.get('sections'), base.sections, 'writes once the pass is over');
  // the shared marker: a pass in another tab of the same profile
  const m3 = new Map(Object.entries(base)); m3.set('antcv:translateBusy', 'en:' + Date.now());
  const ls3 = { getItem: (k) => (m3.has(k) ? m3.get(k) : null), setItem: (k, v) => m3.set(k, String(v)), removeItem: (k) => m3.delete(k) };
  const sb3 = Object.assign({}, sb, { window: { addEventListener() {}, dispatchEvent() {} }, localStorage: ls3, Date });
  vm.createContext(sb3); vm.runInContext(src, sb3);
  sb3.window.AntcvProofPoints.run();
  assert.equal(m3.get('sections'), base.sections, 'no write while antcv:translateBusy is fresh in the store');
  m3.set('antcv:translateBusy', 'en:' + (Date.now() - 400000));
  sb3.window.AntcvProofPoints.run();
  assert.notEqual(m3.get('sections'), base.sections, 'a stale marker (crashed pass) is ignored');
});

test('PROOF-POINTS-LANG-001c: for 10 s after a pass the belt follows the pass target, not the late ribbon key', () => {
  const enBlock = { id: 'proof_points', type: 'rich_block', loc: 'sidebar', on: true, title: 'Proof points', items: [
    { b: '250 → 10 dage', t: 'skar ændringscyklussen hos Innoviz', bullets: [] }, { b: '150 brugere', t: 'forenkling af rapportering', bullets: [] }, { b: '10x', t: 'lavere produktomkostning', bullets: [] } ] };
  const seed = Object.assign({}, base, { 'antcv:proofPointsAuto': JSON.stringify({ lang: 'en', hash: 'x' }),
    sections: JSON.stringify({ cv: [{ id: 'profile', type: 'text', loc: 'main', on: true, content: 'x' }, enBlock, { id: 'tools', type: 'labeled_list', loc: 'sidebar', on: true, items: [{ l: 'Software', v: 'Jira' }] }], cl: [] }) });
  const mm = new Map(Object.entries(seed));
  const ls = { getItem: (k) => (mm.has(k) ? mm.get(k) : null), setItem: (k, v) => mm.set(k, String(v)), removeItem: (k) => mm.delete(k) };
  const sb = { window: { addEventListener() {}, dispatchEvent() {}, __antcvTranslateBusy: 'da' }, document: { body: { dataset: {} }, head: null, getElementById: () => null, createElement: () => ({ style: {} }) },
    localStorage: ls, setTimeout: () => 0, CustomEvent: function () {}, JSON, Array, Object, String, Number, Math, RegExp, parseFloat, parseInt, Error, Date, isFinite };
  vm.createContext(sb); vm.runInContext(src, sb);
  sb.window.AntcvProofPoints.run();                       // in flight: no write
  sb.window.__antcvTranslateBusy = '';                     // pass over; localStorage.language still 'en' (settles late)
  sb.window.AntcvProofPoints.run();
  const pp = JSON.parse(mm.get('sections')).cv.find((s) => s.id === 'proof_points');
  assert.equal(pp.title, 'Resultater i tal', 'DA mode: house title pinned');
  assert.deepEqual(pp.items.map((i) => [i.b, i.t]), enBlock.items.map((i) => [i.b, i.t]), 'DA mode: the translated lines are kept, not rebuilt from the EN kernel');
  assert.equal(JSON.parse(mm.get('antcv:proofPointsAuto')).lang, 'da');
});
