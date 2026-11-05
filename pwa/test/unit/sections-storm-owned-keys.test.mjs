// sections-storm-owned-keys.test.mjs
// ============================================================
// SECTIONS-STORM-OWNED-KEYS-001 (owner 2026-11-05, "jumpy" app + Settings menu
// re-rendering on antcv.pages.dev 1.51.5363): profile-access-scrub compared the
// whole accessibility section by JSON and references-mode compared its rows by
// JSON. A key another writer adds to an item (the shape belts' `bullets: []`)
// read as a change, each belt rewrote its rows, dispatched antcv:sections-updated,
// the app reloaded + re-rendered, the other belt saw "its" rows changed and wrote
// again: 13 events / 6 s, 779 DOM mutations inside the open Settings panel.
// Both belts now compare and write only the fields they own and keep foreign
// keys on the row. These tests load the REAL sidecars in a vm sandbox.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SCRUB = readFileSync(new URL('../../antcv-profile-access-scrub.js', import.meta.url), 'utf8');
const REFS = readFileSync(new URL('../../antcv-references-mode.js', import.meta.url), 'utf8');

function store(seed) {
  const m = new Map(Object.entries(seed));
  return { m, ls: { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) } };
}
function loadScrub(seed) {
  const { m, ls } = store(seed); const events = [];
  const win = { localStorage: ls, addEventListener() {}, dispatchEvent: (e) => events.push(e.detail && e.detail.reason) };
  const sb = { window: win, localStorage: ls, JSON, console: { log() {} }, Object, String, Array, RegExp, setTimeout: () => 0, clearTimeout() {}, CustomEvent: function (t, o) { this.type = t; this.detail = o && o.detail; } };
  vm.createContext(sb); vm.runInContext(SCRUB, sb);
  return { run: win.AntcvProfileAccessScrub.run, m, events };
}
function loadRefs(seed) {
  const { m, ls } = store(seed); const events = [];
  const ctx = {
    window: { addEventListener() {}, dispatchEvent: (e) => events.push(e.detail && e.detail.reason) },
    document: { body: null, addEventListener() {}, querySelectorAll: () => [] },
    localStorage: ls, CustomEvent: function (t, o) { this.type = t; this.detail = o && o.detail; }, MutationObserver: function () { this.observe = () => {}; }, setTimeout: () => 0,
  };
  vm.createContext(ctx); vm.runInContext(REFS, ctx);
  return { apply: ctx.window.__antcvReferencesApply, m, events };
}
const secs = (m) => JSON.parse(m.get('sections'));

const LINE = 'I work in English and Danish and follow meetings best with live captions and written follow-ups.';
const GABRIEL = JSON.stringify({ name: 'Gabriel Alexander Karp-Gershon' });

test('scrub: a canonical COMMUNICATION row carrying a foreign bullets key is left alone (no write, no event)', () => {
  const cv = [{ id: 'accessibility', title: 'COMMUNICATION', type: 'labeled_list', loc: 'sidebar', on: true, items: [{ l: '', v: LINE, labelHidden: true, bullets: [] }] }];
  const s = loadScrub({ sections: JSON.stringify({ cv, cl: [] }), personalInfo: GABRIEL, language: JSON.stringify('en') });
  const before = s.m.get('sections');
  s.run();
  assert.equal(s.m.get('sections'), before, 'nothing rewritten');
  assert.deepEqual(s.events, [], 'no sections-updated dispatched');
});

test('scrub: a stale row is rewritten ONCE and keeps the foreign key on the item', () => {
  const cv = [{ id: 'accessibility', title: 'ACCESSIBILITY', type: 'labeled_list', loc: 'sidebar', on: true, items: [{ l: 'Accessibility', v: 'Hearing impaired; cochlear implant.', bullets: [] }] }];
  const s = loadScrub({ sections: JSON.stringify({ cv, cl: [] }), personalInfo: GABRIEL, language: JSON.stringify('en') });
  s.run();
  const a = secs(s.m).cv[0];
  assert.equal(a.title, 'COMMUNICATION');
  assert.deepEqual(a.items, [{ l: '', v: LINE, labelHidden: true, bullets: [] }], 'owned fields set, foreign key kept');
  assert.equal(s.events.length, 1);
  const after = s.m.get('sections');
  s.run();
  assert.equal(s.m.get('sections'), after, 'second pass is a no-op');
  assert.equal(s.events.length, 1);
});

test('scrub: text-shaped accessibility section converges too', () => {
  const cv = [{ id: 'accessibility', title: 'COMMUNICATION', type: 'text', loc: 'sidebar', on: true, content: LINE, bullets: [] }];
  const s = loadScrub({ sections: JSON.stringify({ cv, cl: [] }), personalInfo: GABRIEL, language: JSON.stringify('en') });
  const before = s.m.get('sections');
  s.run();
  assert.equal(s.m.get('sections'), before);
  assert.deepEqual(s.events, []);
});

const POOL = [
  { name: 'Ada Example', title: 'CBO', org: 'LidarCo', relation: 'senior leader at LidarCo', lang: 'en', tags: ['automotive'] },
  { name: 'Bo Eksempel', title: 'Head coach', org: 'City Rugby', relation: 'coach', lang: 'da', tags: ['team'] },
];
const GENERIC = [{ deg: 'References', sch: 'International and Danish recommendations provided on request' }];

test('references-mode: rows that match on owned fields but carry bullets: [] are left alone', () => {
  const r = loadRefs({
    sections: JSON.stringify({ cl: [], cv: [{ id: 'recommendations', title: 'RECOMMENDATIONS', type: 'education', loc: 'main', on: true, items: GENERIC }] }),
    personalInfo: JSON.stringify({ name: 'X', referees: POOL }),
  });
  r.apply();
  assert.equal(r.events.length, 1, 'first pass names the referees');
  const once = secs(r.m);
  const rec = once.cv.find((s) => s.id === 'recommendations');
  assert.deepEqual(rec.items.map((i) => i.deg), ['Ada Example', 'Bo Eksempel']);
  // a shape belt adds bullets: [] to every item and the app saves it back
  rec.items = rec.items.map((i) => Object.assign({}, i, { bullets: [] }));
  r.m.set('sections', JSON.stringify(once));
  const stable = r.m.get('sections');
  r.apply(); r.apply();
  assert.equal(r.m.get('sections'), stable, 'no rewrite over a foreign key');
  assert.equal(r.events.length, 1, 'no further sections-updated');
});

test('references-mode: a real row change still writes, and keeps the foreign key', () => {
  const r = loadRefs({
    sections: JSON.stringify({ cl: [], cv: [{ id: 'recommendations', title: 'RECOMMENDATIONS', type: 'education', loc: 'main', on: true,
      items: [{ deg: 'Ada Example', sch: 'stale line', bullets: [] }, { deg: 'Bo Eksempel', sch: 'stale line', bullets: [] }], _refsGeneric: GENERIC }] }),
    personalInfo: JSON.stringify({ name: 'X', referees: POOL }),
  });
  r.apply();
  const rec = secs(r.m).cv.find((s) => s.id === 'recommendations');
  assert.match(rec.items[0].sch, /contact details available upon request$/);
  assert.deepEqual(rec.items[0].bullets, [], 'foreign key survives the rewrite');
  assert.equal(r.events.length, 1);
});
