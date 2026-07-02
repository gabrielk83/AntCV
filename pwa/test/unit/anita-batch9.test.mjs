// anita-batch9.test.mjs
// ============================================================
// Owner 2026-07-03 (Anita regen review, batch 9):
// - WORK-STYLE-SENTENCE-CUT-001: the 133-char cap cut multi-sentence persona
//   notes MID-SENTENCE ("…tracking systems. Comfortable"); whole sentences pack.
// - WORKSTYLE-ADDITIONAL-DEDUP-001: the additional[] "Work style" row duplicates
//   the main section; drop it once the main is real.
// - CV-APPLICATION-LINE-001: the CV header synthesizes the Application line from
//   meta.role when the stored subtitle is the positioning triad (CL already did).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src415 = await readFile(new URL('../../antcv-sections-normalize-415.js', import.meta.url), 'utf8');

function run415(sections, pi) {
  const store = new Map([
    ['sections', JSON.stringify(sections)],
    ['doc', JSON.stringify('cv')],
    ['personalInfo', JSON.stringify(pi || {})],
  ]);
  const sandbox = {
    window: { addEventListener() {}, dispatchEvent() { return true; } },
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    console: { info() {}, warn() {}, log() {}, error() {}, debug() {} },
    setTimeout() { return 0; }, clearTimeout() {}, setInterval() { return 0; },
    CustomEvent: function (t, o) { this.type = t; Object.assign(this, o); },
    JSON, Array, Object, Error, RegExp, Math, String, Number, Boolean, isFinite, parseInt, parseFloat, Date,
  };
  vm.createContext(sandbox);
  vm.runInContext(src415, sandbox);
  sandbox.window.AntcvSectionsNormalize._normalize();
  return JSON.parse(store.get('sections'));
}

const ANITA_NOTES = 'Prefers preparing early rather than reacting late. Keeps written contingency plans and detailed tracking systems. Comfortable carrying operational work during difficult seasons without creating noise around it.';

test('work-style cap cuts at a SENTENCE boundary on multi-sentence notes', () => {
  const out = run415({ cv: [
    { id: 'work_style', title: 'Work Style', loc: 'main', on: true, type: 'text', content: '[WORK STYLE - one short line only...]' },
  ], cl: [] }, { name: 'Anita Myre-Kornfeldt', workStyle: { notes: ANITA_NOTES } });
  const ws = out.cv.find((s) => s.id === 'work_style');
  const body = ws.content || (ws.items && ws.items[0] && ws.items[0].t) || '';
  assert.ok(body.length <= 133, 'cap holds: ' + body.length);
  assert.match(body, /[.!?]$/, 'ends at a sentence boundary: "' + body.slice(-30) + '"');
  assert.ok(!/Comfortable$/.test(body), 'never the mid-sentence "Comfortable" cut');
});

test('additional "Work style" row drops once the main section is real', () => {
  const out = run415({ cv: [
    { id: 'work_style', title: 'Work Style', loc: 'main', on: true, type: 'text', content: 'Prefers preparing early rather than reacting late.' },
    { id: 'additional', title: 'ADDITIONAL INFORMATION', loc: 'sidebar', on: true, type: 'labeled_list', items: [
      { l: 'Work style', v: 'Methodical, calm under pressure, winter-ready' },
      { l: 'Volunteer', v: 'Mentorship programme' },
    ] },
  ], cl: [] }, { name: 'Anita Myre-Kornfeldt' });
  const addl = out.cv.find((s) => s.id === 'additional');
  assert.ok(!addl.items.some((it) => /work.?style/i.test(String(it.l || ''))), 'dup dropped');
  // partitionAdditional legitimately routes Volunteer to interests — assert survival anywhere
  const allRows = out.cv.flatMap((s) => Array.isArray(s.items) ? s.items : []);
  assert.ok(allRows.some((it) => /Volunteer/.test(String((it && (it.l || it.b)) || ''))), 'others survive somewhere');
});

test('additional "Work style" row KEPT while the main section is still a placeholder', () => {
  const out = run415({ cv: [
    { id: 'work_style', title: 'Work Style', loc: 'main', on: true, type: 'text', content: '[WORK STYLE - ...]' },
    { id: 'additional', title: 'ADDITIONAL INFORMATION', loc: 'sidebar', on: true, type: 'labeled_list', items: [
      { l: 'Work style', v: 'Methodical, calm' },
    ] },
  ], cl: [] }, { name: 'Nobody Nowhere' });
  const addl = out.cv.find((s) => s.id === 'additional');
  assert.ok(addl.items.some((it) => /work.?style/i.test(String(it.l || ''))), 'kept — main not real yet');
});

// ── CV Application line (docx-client buildPayload) ──────────────────────────
globalThis.window = globalThis.window || {};
globalThis.localStorage = globalThis.localStorage || { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const { buildPayload } = await import('../../antcv-docx-client.js');
function cvSubtitle(meta, language) {
  return buildPayload({ doc: 'cv', language: language || 'en', personalInfo: { name: 'X' }, meta, sections: [], styleConfig: {} }).meta.subtitle;
}

test('CV header synthesizes the Application line from meta.role (triad subtitle replaced)', () => {
  assert.equal(
    cvSubtitle({ subtitle: 'Planning • Logistics • Reliability', role: 'Senior Grain Storage Coordinator', company: '' }),
    'Application: Senior Grain Storage Coordinator — Unsolicited',
  );
});

test('CV header keeps a subtitle that already reads Application:', () => {
  assert.equal(
    cvSubtitle({ subtitle: 'Application: Product / Project Expert - Unsolicited', role: 'Product / Project Expert', company: '' }),
    'Application: Product / Project Expert - Unsolicited',
  );
});

test('CV header: real company used; Danish localization', () => {
  assert.equal(
    cvSubtitle({ subtitle: 'triad', role: 'Planner', company: 'Northfield' }),
    'Application: Planner — Northfield',
  );
  assert.equal(
    cvSubtitle({ subtitle: 'triad', role: 'Planlægger', company: '' }, 'da'),
    'Ansøgning: Planlægger — Uopfordret',
  );
});

test('CV header: no role → stored subtitle untouched', () => {
  assert.equal(cvSubtitle({ subtitle: 'Planning • Logistics • Reliability', role: '', company: '' }), 'Planning • Logistics • Reliability');
});
