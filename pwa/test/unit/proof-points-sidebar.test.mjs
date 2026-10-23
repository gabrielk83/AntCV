// proof-points-sidebar.test.mjs
// PROOF-POINTS-FIRST-001 / PROOF-POINTS-ORDER-001 / EXPERIENCE-SPACING-001 (owner 2026-10-23,
// course reviewer feedback on the Veo CV v7). The sidecar builds the proof-points block from
// numbers the sections already carry, orders them by what the ad stresses, puts the block first
// in the sidebar, and sets the role-gap default once. It never invents a number.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-proof-points-sidebar.js', import.meta.url), 'utf8');
const gold = JSON.parse(await readFile(new URL('../../gold-rules.json', import.meta.url), 'utf8'));
const index = await readFile(new URL('../../index.html', import.meta.url), 'utf8');

function boot(store) {
  const window = { addEventListener() {}, dispatchEvent() {} };
  const ctx = { window, localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; }, removeItem: (k) => { delete store[k]; } },
    setTimeout() {}, CustomEvent: function () {}, JSON, document: { body: { dataset: {} } } };
  vm.runInNewContext(src, ctx);
  return { window, store, read: () => JSON.parse(store.sections) };
}

const SECTIONS = { cv: [
  { id: 'profile', type: 'text', loc: 'main', on: true, content: 'I am a hardware leader.' },
  { id: 'competencies', type: 'table', loc: 'main', on: true, title: 'CORE COMPETENCIES', rows: [
    ['The role needs', 'What I bring, with proof'],
    ['Program management', 'One plan across projects; ~3,400 requirements verified; change cycle ~250 to ~10 days'],
    ['DFM/DFA & mass production', 'Suppliers qualified in four countries, rejects cut 50%; one line at 20,000 units/week'],
  ] },
  { id: 'experience', type: 'experience', loc: 'main', on: true, roles: [
    { id: 'r1', on: true, title: 'Change Request Lead', company: 'X', bullets: ['Chair the change board.', 'Results: cycle cut from ~250 to ~10 days; $8M customer NRE programme supported.'] },
    { id: 'r2', on: true, title: 'System Architect', company: 'X', results: 'Trade-off analysis behind a 90% (10x) unit-cost reduction.' },
    { id: 'r3', on: true, title: 'Senior Engineer', company: 'Y', outcomes: [{ b: 'Shipped', t: 'a 20 MP hybrid-AF camera; rejects cut 50%' }] },
  ] },
  { id: 'tools', type: 'bullets', loc: 'sidebar', on: true, title: 'TOOLS & METHODS', items: [{ t: 'Jira' }] },
  { id: 'languages', type: 'labeled_list', loc: 'sidebar', on: true, items: [{ l: 'English', v: 'fluent' }] },
] };

test('fragments come only from numbers the sections already carry', () => {
  const a = boot({ sections: JSON.stringify(SECTIONS) });
  const frags = a.window.AntcvProofPoints.fragments(SECTIONS);
  assert.ok(frags.some((f) => /250 to ~10 days/.test(f)));
  assert.ok(frags.some((f) => /20,000 units\/week/.test(f)));
  assert.ok(frags.some((f) => /20 MP/.test(f)));
  for (const f of frags) assert.match(f, /\d/);
  assert.ok(!frags.some((f) => /^Results:/i.test(f)), 'the Results: label is stripped');
  // a value stated twice (competency row + role result) appears once
  assert.equal(frags.filter((f) => /rejects cut 50%/i.test(f)).length, 1);
});

test('a DFM / mass-production ad puts the volume number first; a cost ad puts the cost cut first', () => {
  const a = boot({ sections: JSON.stringify(SECTIONS) });
  const P = a.window.AntcvProofPoints;
  const frags = P.fragments(SECTIONS);
  const dfm = P.rank(frags, 'We stress DFM/DFA and mass production of consumer electronics; units shipped matter.');
  assert.match(dfm[0], /20,000 units\/week/);
  const cost = P.rank(frags, 'Own the BOM cost and the unit cost roadmap; cost, cost, cost.');
  assert.match(cost[0], /\$8M|unit-cost reduction/);
  // no ad: source order (newest role first keeps the change cycle ahead of the camera)
  const none = P.rank(frags, '');
  assert.ok(none.indexOf(frags[0]) === 0);
});

test('the block is inserted first in the sidebar, 5 lines at most, and the role gap defaults once', () => {
  const store = { sections: JSON.stringify(SECTIONS), 'antcv:lastJdText': 'DFM/DFA, mass production, consumer electronics.' };
  const a = boot(store);
  a.window.AntcvProofPoints.run();
  const cv = a.read().cv;
  const i = cv.findIndex((s) => s.id === 'proof_points');
  const firstSidebar = cv.findIndex((s) => s.loc === 'sidebar');
  assert.equal(i, firstSidebar, 'proof points is the first sidebar section');
  assert.equal(cv[i].type, 'bullets');
  assert.equal(cv[i].title, 'Proof points');
  assert.ok(cv[i].items.length >= 3 && cv[i].items.length <= 5);
  assert.match(cv[i].items[0].t, /20,000 units\/week/);
  assert.equal(JSON.parse(store.styleConfig).roleGap, 14);
  assert.equal(store['antcv:roleGapDefaulted'], '1');
  // a second run changes nothing (idempotent); an owner slider change is kept
  store.styleConfig = JSON.stringify({ roleGap: 9 });
  const before = store.sections;
  a.window.AntcvProofPoints.run();
  assert.equal(store.sections, before);
  assert.equal(JSON.parse(store.styleConfig).roleGap, 9);
});

test('a hand-edited block is left alone; the linear layout and other packages get no block', () => {
  const store = { sections: JSON.stringify(SECTIONS) };
  const a = boot(store);
  a.window.AntcvProofPoints.run();
  const secs = a.read();
  const pp = secs.cv.find((s) => s.id === 'proof_points');
  pp.items = [{ t: 'My own line, 1 number' }];
  store.sections = JSON.stringify(secs);
  a.window.AntcvProofPoints.run();
  assert.equal(a.read().cv.find((s) => s.id === 'proof_points').items[0].t, 'My own line, 1 number');

  const lin = boot({ sections: JSON.stringify(SECTIONS), 'antcv:cvLayout': 'linear' });
  lin.window.AntcvProofPoints.run();
  assert.ok(!lin.read().cv.some((s) => s.id === 'proof_points'));

  const other = boot({ sections: JSON.stringify(SECTIONS), stylePackage: '"navy-executive"', writingStyle: '"credential-forward"' });
  other.window.AntcvProofPoints.run();
  assert.ok(!other.read().cv.some((s) => s.id === 'proof_points'));

  const cph = boot({ sections: JSON.stringify(SECTIONS), stylePackage: '"copenhagen-modern"', writingStyle: '"credential-forward"' });
  cph.window.AntcvProofPoints.run();
  assert.ok(cph.read().cv.some((s) => s.id === 'proof_points'));
});

test('too few numbers means no block, and the kill switch holds', () => {
  const thin = { cv: [{ id: 'experience', type: 'experience', loc: 'main', roles: [{ title: 'A', results: 'Rejects cut 50%.' }] },
    { id: 'tools', type: 'bullets', loc: 'sidebar', items: [] }] };
  const a = boot({ sections: JSON.stringify(thin) });
  a.window.AntcvProofPoints.run();
  assert.ok(!a.read().cv.some((s) => s.id === 'proof_points'));
  const k = boot({ sections: JSON.stringify(SECTIONS), 'antcv:disable-proof-points': '1' });
  k.window.AntcvProofPoints.run();
  assert.ok(!k.read().cv.some((s) => s.id === 'proof_points'));
});

test('gold-rules carries the rules and index.html loads the sidecar', () => {
  for (const id of ['PROOF-POINTS-FIRST-001', 'PROOF-POINTS-ORDER-001', 'BUDGET-SIZE-001', 'SHAREABLE-FIGURES-001',
    'PROFILE-LENGTH-001', 'SCALE-SEMANTIC-001', 'AI-NOTICE-FOOTER-001', 'EXPERIENCE-SPACING-001', 'REFERENCES-RELATION-001']) {
    assert.ok(gold.prompt_block.some((l) => l.includes(id)), 'prompt block carries ' + id);
  }
  assert.equal(gold.layout_defaults.proof_points_first, true);
  assert.equal(gold.layout_defaults.role_gap_px, 14);
  assert.match(index, /antcv-proof-points-sidebar\.js\?v=/);
});
