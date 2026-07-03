// sidebar-relevance-cut.test.mjs
// ============================================================
// SIDEBAR-RELEVANCE-CUT-001 (owner Trackman review 2026-07-03, spec rules
// 11/15/19/25/27/32 + rule 38 "enforcement beats prompts"): deterministic
// JD-relevance cut over tools / certificates / regulatory in STORED sections —
// hidden, never deleted; exempt list untouched; one-shot per app+JD stamp.
// Fixtures mirror the owner's Trackman export (the sidebar that dragged
// RECOMMENDATIONS to page 3).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-sidebar-relevance-cut.js', import.meta.url), 'utf8');

function load(store0) {
  const store = new Map(Object.entries(store0 || {}));
  const events = [];
  const sandbox = {
    window: { addEventListener() {}, dispatchEvent(e) { events.push(e && e.detail && e.detail.source); return true; } },
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    setTimeout() { return 0; }, setInterval() { return 0; }, clearTimeout() {},
    console: { log() {}, warn() {} },
    CustomEvent: function (t, o) { this.type = t; Object.assign(this, o); },
    JSON, Array, Object, String, RegExp, Error, Math, Number, Boolean, Date,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return { api: sandbox.window.AntcvSidebarRelevanceCut, store, events };
}

// Condensed from the real Trackman JD (vision+radar sports tracking, CE/FCC/UL).
const TRACKMAN_JD = 'Lead the hardware project team in developing a modular platform for advanced vision and radar '
  + 'tracking technologies across multiple sports applications. Translate customer and business needs into clear '
  + 'product requirements. Representing R&D in interactions with technical suppliers incl specifications and quality '
  + 'issues. Coordinate international product certifications (e.g. CE, FCC, UL). Identify, assess, and mitigate '
  + 'hardware-related risks throughout the development project. Production and into the field. Project management '
  + 'methodologies and Agile principles. Optics, electronics, and certification teams.';

const richTools = () => ({
  id: 'tools', title: 'TOOLS & METHODS', loc: 'sidebar', on: true, type: 'rich_block', items: [
    { grp: true, t: 'Expertise' },
    { b: 'Optics, photonics & sensing', t: 'Electro-optics, photonics, optical metrology, machine vision' },
    { b: 'Materials & devices', t: 'Nanomaterials, carbon nanotubes (CNT), MEMS/NEMS' },
    { grp: true, t: 'Methods' },
    { b: 'Quality & process', t: 'Six Sigma Black Belt quality methods, FMEA risk analysis, catalyst chemistry' },
  ],
});

const certsSection = () => ({
  id: 'certs', title: 'CERTIFICATES & COURSES', loc: 'sidebar', on: true, type: 'list', items: [
    'Six Sigma Black Belt (CSSC)',
    'Automotive SPICE / ASPICE VDA (Intecs, 2018)',
    'Prøve i dansk 2 (Studieskolen)',
    'Intro to Coaching / World Rugby Level 1 (2024)',
    'Concussion Management (2024)',
    'Agile project management certification (2021)',
  ],
});

const regulatorySection = () => ({
  id: 'regulatory', title: 'REGULATORY CONTEXT', loc: 'sidebar', on: true, type: 'labeled_list', items: [
    { group: 'Systems, Safety & Cybersecurity' },
    { l: 'ASPICE', v: 'Requirements, traceability, audit readiness' },
    { l: 'ISO 26262', v: 'Functional safety' },
    { group: 'Imaging & Electro-Optical' },
    { l: 'ISO 12233', v: 'Resolution' },
    { l: 'EMVA 1288', v: 'Machine-vision sensor characterization' },
    { l: 'IEC 60825-1', v: 'Laser safety' },
    { group: 'Environmental, Durability & Compliance' },
    { l: 'STANAG 4694', v: 'Weapon-mounted sight interface context' },
    { l: 'STANAG 4355', v: 'Ballistics / fire-control context' },
    { l: 'MIL-STD-810G', v: 'Environmental qualification, including Method 514 vibration' },
    { l: 'RoHS', v: 'Restricted substances' },
  ],
});

const interestsSection = () => ({
  id: 'interests', title: 'INTERESTS', loc: 'sidebar', on: true, type: 'labeled_list', items: [
    { l: 'Rugby & inclusive sport', v: 'Team operations, coach assist' },
    { l: 'Supervision', v: 'Handling three feline strategic napping experts (cats)' },
  ],
});

const baseStore = (extraSections = []) => ({
  meta: JSON.stringify({ company: 'Trackman A/S', role: 'Project Manager, Hardware' }),
  'antcv:lastJdText': TRACKMAN_JD,
  sections: JSON.stringify({ cv: [richTools(), certsSection(), regulatorySection(), interestsSection(), ...extraSections], cl: [] }),
});

test('tools: JD-matched tokens survive, misses trim to the Hidden residue row, zero-survivor row hides whole', () => {
  const { api, store, events } = load(baseStore());
  api._apply();
  const secs = JSON.parse(store.get('sections'));
  const tools = secs.cv[0];
  // Optics row: "optics" + "machine vision" hit the JD; nanotech row: zero hits.
  const optics = tools.items[1];
  assert.match(optics.t, /Electro-optics/);
  assert.match(optics.t, /machine vision/);
  assert.doesNotMatch(optics.t, /metrology/, 'JD-miss token trimmed');
  // trimmed tokens recoverable in the per-category Hidden row
  const residues = tools.items.filter((it) => /^Hidden - /.test(String(it.b || it.l || '')));
  assert.ok(residues.some((r) => /metrology/.test(String(r.t || r.v))), 'trimmed token in the residue row');
  // zero-survivor rich row hidden via the SECTION map, value intact
  const nanoIdx = tools.items.findIndex((it) => /Nanomaterials/.test(String(it.t || '')));
  assert.ok(nanoIdx >= 0, 'row still present (hidden, never deleted)');
  assert.equal(tools.hidden[nanoIdx], true, 'hidden via section-level map (RICHBLOCK shape)');
  assert.match(tools.items[nanoIdx].t, /carbon nanotubes/, 'value untouched for restore');
  assert.ok(events.includes('sidebar-relevance-cut'));
});

test('certs: language/sport always cut; automotive cut; quality + agile survive (bridge/overlap)', () => {
  const { api, store } = load(baseStore());
  api._apply();
  const certs = JSON.parse(store.get('sections')).cv[1];
  const hidden = certs.hidden || {};
  const vis = certs.items.filter((_, i) => !hidden[i]);
  assert.ok(vis.includes('Six Sigma Black Belt (CSSC)'), 'quality bridge: JD says "quality issues"');
  assert.ok(vis.includes('Agile project management certification (2021)'), 'direct overlap: agile/project management');
  assert.ok(!vis.some((t) => /ASPICE/.test(t)), 'automotive cert cut — no automotive in a sports JD');
  assert.ok(!vis.some((t) => /dansk|Rugby|Concussion/.test(t)), 'language + sport certs never survive a targeted cut');
  assert.equal(certs.items.length, 6, 'nothing deleted');
});

test('regulatory: weapons/automotive/military rows hidden, imaging + unknown-domain kept; rule 19 flattens sub-headers', () => {
  const { api, store } = load(baseStore());
  api._apply();
  const reg = JSON.parse(store.get('sections')).cv[2];
  const vis = reg.items.filter((it) => it.hidden !== true);
  const visLabels = vis.filter((it) => !it.group).map((it) => it.l);
  assert.ok(visLabels.includes('ISO 12233'), 'imaging survives (JD: vision)');
  assert.ok(visLabels.includes('EMVA 1288'), 'machine-vision survives');
  assert.ok(visLabels.includes('RoHS'), 'chemical survives (JD: certifications)');
  assert.ok(!visLabels.includes('STANAG 4694'), 'weapon-sight row hidden for a sports JD (rule 27)');
  assert.ok(!visLabels.includes('STANAG 4355'), 'ballistics row hidden');
  assert.ok(!visLabels.includes('ISO 26262'), 'automotive functional safety hidden');
  assert.ok(!visLabels.includes('IEC 60825-1'), 'laser safety hidden — no laser in the JD');
  const visContent = vis.filter((it) => !it.group).length;
  assert.ok(visContent <= 6, 'few survivors');
  assert.equal(vis.filter((it) => it.group).length, 0, 'rule 19: sub-headers flattened when few rows survive');
  assert.equal(reg.items.length, 12, 'nothing deleted');
});

test('exempt sections (interests) are never touched', () => {
  const { api, store } = load(baseStore());
  const before = JSON.stringify(JSON.parse(store.get('sections')).cv[3]);
  api._apply();
  assert.equal(JSON.stringify(JSON.parse(store.get('sections')).cv[3]), before);
});

test('one-shot stamp: a second pass never re-fights a user un-hide', () => {
  const { api, store } = load(baseStore());
  api._apply();
  const secs = JSON.parse(store.get('sections'));
  // user restores the STANAG row via the eye
  const reg = secs.cv[2];
  const idx = reg.items.findIndex((it) => it.l === 'STANAG 4694');
  reg.items[idx] = { ...reg.items[idx], hidden: false };
  store.set('sections', JSON.stringify(secs));
  api._apply();
  const after = JSON.parse(store.get('sections')).cv[2];
  assert.equal(after.items[idx].hidden, false, 'user decision sticks — same app+JD stamp');
});

test('a NEW JD re-arms the pass', () => {
  const { api, store } = load(baseStore());
  api._apply();
  assert.ok(store.get('antcv:sidebarCutStamp'));
  const s1 = store.get('antcv:sidebarCutStamp');
  store.set('antcv:lastJdText', TRACKMAN_JD + ' Additional laser rangefinder requirement.');
  api._apply();
  assert.notEqual(store.get('antcv:sidebarCutStamp'), s1, 'new JD -> new stamp');
});

test('unsolicited / missing JD / kill switch: untouched', () => {
  for (const patch of [
    { meta: JSON.stringify({ company: 'Unsolicited', role: 'Open Application' }) },
    { 'antcv:lastJdText': '' },
    { 'antcv:disable-sidebar-relevance-cut': '1' },
  ]) {
    const s = { ...baseStore(), ...patch };
    const { api, store } = load(s);
    const before = store.get('sections');
    api._apply();
    assert.equal(store.get('sections'), before);
  }
});

test('labeled_list tools shape ({l,v}) is handled too (pre-RICHBLOCK apps)', () => {
  const s = baseStore();
  const secs = JSON.parse(s.sections);
  secs.cv[0] = {
    id: 'tools', title: 'TOOLS & METHODS', loc: 'sidebar', on: true, type: 'labeled_list', items: [
      { l: 'Software', v: 'Jira, Confluence, LabVIEW automation' },
      { l: 'Niche', v: 'Catalyst chemistry, nanoparticle preparation' },
    ],
  };
  s.sections = JSON.stringify(secs);
  const { api, store } = load(s);
  api._apply();
  const tools = JSON.parse(store.get('sections')).cv[0];
  const niche = tools.items.find((it) => it.l === 'Niche');
  assert.equal(niche.hidden, true, 'zero-survivor labeled row hides via it.hidden');
  assert.match(niche.v, /Catalyst chemistry/, 'value intact');
});
