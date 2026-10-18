// corecomp-header-plain.test.mjs
// ============================================================
// CC-HEADERS-PLAIN-001 (REVIEW-VEO-001, 2026-10-18): the CORE COMPETENCIES /
// WHAT I BRING table header reads "The role needs" | "What I bring, with proof"
// (DA "Rollen kræver" | "Det bringer jeg, med belæg"). A saved document may
// still carry the pre-rename pair "Focus Area" | "Strategic Expertise" in
// rows[0]. Asserts:
//   - sections-normalize-415 rewrites a legacy header (EN + DA) in place, data
//     rows untouched, and is a no-op on the new pair;
//   - bring-to-rich-block-761 still recognises BOTH pairs as a header row;
//   - the app skeleton (app.src.js + the minified app.js) seeds the new pair
//     and keeps a render-time map for the legacy one.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const NEW = ['The role needs', 'What I bring, with proof'];
const OLD = ['Focus Area', 'Strategic Expertise'];

// ---- sections-normalize-415: plainCoreCompHeaders (extracted verbatim) ----
const src415 = await readFile(new URL('../../antcv-sections-normalize-415.js', import.meta.url), 'utf8');
const start = src415.indexOf('var CC_HEADER_PLAIN');
assert.ok(start >= 0, 'CC_HEADER_PLAIN found');
const fnStart = src415.indexOf('function plainCoreCompHeaders(', start);
let i = src415.indexOf('{', fnStart), depth = 0, end = -1;
for (; i < src415.length; i++) { if (src415[i] === '{') depth++; else if (src415[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } } }
const plain = new Function(src415.slice(start, end) + '\nreturn plainCoreCompHeaders;')();

const table = (id, rows) => ({ id, title: id === 'bring' ? 'WHAT I BRING' : 'CORE COMPETENCIES', loc: 'main', on: true, type: 'table', rows });

test('normalize-415: legacy EN header -> plain-words pair, data rows untouched', () => {
  const cv = [table('core_comp', [OLD, ['Change governance', 'CCB practice; cycle cut from ~250 to ~10 days']])];
  const out = plain(cv);
  assert.ok(Array.isArray(out), 'changed');
  assert.deepEqual(out[0].rows[0], NEW);
  assert.deepEqual(out[0].rows[1], ['Change governance', 'CCB practice; cycle cut from ~250 to ~10 days']);
  assert.equal(out[0].id, 'core_comp');
});

test('normalize-415: legacy DA header -> plain-words Danish pair', () => {
  const out = plain([table('core_comp', [['Fokusområde', 'Strategisk ekspertise'], ['A', 'a']])]);
  assert.deepEqual(out[0].rows[0], ['Rollen kræver', 'Det bringer jeg, med belæg']);
});

test('normalize-415: case / whitespace tolerant, CL bring table too', () => {
  const out = plain([table('bring', [[' focus area ', 'STRATEGIC EXPERTISE'], ['Validation', 'Test campaigns']])]);
  assert.deepEqual(out[0].rows[0], NEW);
});

test('normalize-415: new pair, non-table and headerless sections -> no-op (null)', () => {
  assert.equal(plain([table('core_comp', [NEW, ['A', 'a']])]), null);
  assert.equal(plain([{ id: 'profile', type: 'text', content: 'Focus Area' }]), null);
  assert.equal(plain([table('core_comp', [])]), null);
  assert.equal(plain([table('core_comp', [['Area', 'Expertise'], ['A', 'a']])]), null, 'other header words are the user\'s own');
});

// ---- bring-to-rich-block-761: both pairs are a header row ----
const src761 = await readFile(new URL('../../antcv-bring-to-rich-block-761.js', import.meta.url), 'utf8');
function load761(secs) {
  const store = new Map(Object.entries({ sections: JSON.stringify(secs), toneRegister: JSON.stringify('nordic-minimal') }));
  const sandbox = {
    window: { addEventListener() {}, dispatchEvent() { return true; } },
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    setTimeout() { return 0; },
    CustomEvent: function (t, o) { this.type = t; Object.assign(this, o); },
    JSON, Array, Object, Error, RegExp, Math, String, Number, Boolean,
  };
  vm.createContext(sandbox);
  vm.runInContext(src761, sandbox);
  return { api: sandbox.window.AntcvBringToRichBlock, store };
}
for (const [label, header] of [['new', NEW], ['legacy', OLD], ['DA', ['Rollen kræver', 'Det bringer jeg, med belæg']]]) {
  test(`bring-761: ${label} header row is dropped, not kept as a data item`, () => {
    const { api, store } = load761({ cl: [table('bring', [header, ['Sourcing & Feasibility', 'RFQ/RFI, supplier scoring']])] });
    api.run();
    const out = JSON.parse(store.get('sections')).cl[0];
    assert.equal(out.type, 'rich_block');
    const labels = out.items.map((it) => it.b);
    assert.ok(!labels.includes(header[0]), 'header label not an item: ' + JSON.stringify(labels));
    assert.ok(labels.includes('Sourcing & Feasibility'), 'data row kept');
  });
}

// ---- app skeleton + render-time map, source and minified mirror ----
for (const file of ['../../app.src.js', '../../app.js']) {
  test(`${file.replace('../../', '')}: skeleton seeds the plain-words pair; legacy pair mapped at render`, async () => {
    const s = await readFile(new URL(file, import.meta.url), 'utf8');
    const compact = s.replace(/\s+/g, '');
    assert.ok(!compact.includes('["FocusArea","StrategicExpertise"]'), 'no skeleton/receive path seeds the legacy header');
    assert.ok(compact.includes('["Theroleneeds","WhatIbring,withproof"]'), 'plain-words header seeded');
    assert.ok(/"Focus Area"\s*===\s*_h\s*\?\s*"The role needs"\s*:\s*_h/.test(s), 'render-time map for the legacy first header');
    assert.ok(/"Strategic Expertise"\s*===\s*_h\s*\?\s*"What I bring, with proof"\s*:\s*_h/.test(s), 'render-time map for the legacy second header');
    assert.ok(s.includes('"The role needs"') && s.includes('"Rollen kræver"'), 'Danish map carries the new key');
  });
}
