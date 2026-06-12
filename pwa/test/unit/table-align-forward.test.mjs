// table-align-forward.test.mjs
// ============================================================
// CJLR-TABLE-001 (1.50.383 / worker 1.14.58): the CORE COMPETENCIES per-row
// CJLR (antcv-core-competencies-row-controls-234.js) stores
// antcv.coreCompetencies.rowAlignment.v1 = { "row-<i>": align } but was
// PREVIEW-ONLY — buildPayload never forwarded it, so exports always rendered
// the table left-aligned. Locks the new forwarding: explicit row entries
// reach the TABLE section as item_alignment["rows.<i>"]; header row-0 and
// invalid values are dropped; non-table sections are untouched.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { buildPayload } = await import('../../antcv-docx-client.js');

function payloadFor(rowAlignment) {
  store.clear();
  if (rowAlignment) store.set('antcv.coreCompetencies.rowAlignment.v1', JSON.stringify(rowAlignment));
  return buildPayload({
    sections: { cv: [
      { id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'P.' },
      { id: 'core_comp', title: 'CORE COMPETENCIES', loc: 'main', on: true, type: 'table',
        rows: [['Focus', 'Expertise'], ['A', 'a-text'], ['B', 'b-text']] },
    ], cl: [] },
    doc: 'cv', personalInfo: { name: 'T' },
  });
}

test('explicit row entries forward as rows.<i> on the table section', () => {
  const p = payloadFor({ 'row-1': 'center', 'row-2': 'right' });
  const tbl = p.sections.find((s) => s.id === 'core_comp');
  assert.equal(tbl.item_alignment['rows.1'], 'center');
  assert.equal(tbl.item_alignment['rows.2'], 'right');
});

test('header row-0 and invalid values are dropped', () => {
  const p = payloadFor({ 'row-0': 'center', 'row-1': 'wavy', 'row-2': 'justify' });
  const tbl = p.sections.find((s) => s.id === 'core_comp');
  assert.equal(tbl.item_alignment['rows.0'], undefined);
  assert.equal(tbl.item_alignment['rows.1'], undefined);
  assert.equal(tbl.item_alignment['rows.2'], 'justify');
});

test('no stored map → no item_alignment added to the table', () => {
  const p = payloadFor(null);
  const tbl = p.sections.find((s) => s.id === 'core_comp');
  assert.equal(tbl.item_alignment, undefined);
});

test('non-table sections never receive the table rows', () => {
  const p = payloadFor({ 'row-1': 'center' });
  const prof = p.sections.find((s) => s.id === 'profile');
  assert.ok(!prof.item_alignment || prof.item_alignment['rows.1'] === undefined);
});
