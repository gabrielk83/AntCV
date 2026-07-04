// sidebar-abbr-paren.test.mjs
// ============================================================
// Owner 2026-07-05 (Trackman review): deterministic sidebar cleanups in
// antcv-docx-client.js —
//   * SIDEBAR_ABBR: "Machine-vision sensor characterization" -> "Machine-vision
//     characterization"; "Opto-electronic conversion function" -> "EO conversion
//     function".
//   * SIDEBAR-PAREN-BALANCE-001: a value cut mid-parenthesis (e.g.
//     "…evaluation (RFQ/RFI") gets its missing ")" appended.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
store.set('personalInfo', JSON.stringify({}));
store.set('meta', JSON.stringify({ company: 'Trackman A/S', role: 'Project Manager Hardware' }));
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.window = globalThis.window || {};

const { buildPayload } = await import('../../antcv-docx-client.js');

let _seq = 0;
function sidebarPayload(items, type = 'labeled_list') {
  const id = 'standards' + (++_seq); // unique per call — buildPayload memoises by section id
  const p = buildPayload({
    sections: {
      cv: [
        { id: 'experience', type: 'experience', title: 'PROFESSIONAL EXPERIENCE', loc: 'main', on: true, roles: [{ id: 'r1', title: 'X', company: 'Y', years: '2022 - 2026', on: true, bullets: ['a b c d e f g h'] }] },
        { id, type, title: 'STANDARDS', loc: 'sidebar', on: true, items },
      ],
      cl: [],
    },
    doc: 'cv',
    personalInfo: { name: 'Gabriel' },
    meta: { company: 'Trackman A/S', role: 'Project Manager Hardware' },
  });
  const s = p.sections.find((x) => String(x.id).startsWith('standards'));
  // docx-client glues words with NBSP ( ) on export (accepted behavior);
  // normalize to regular spaces so the assertions read the words, not the glue.
  return JSON.stringify(s).replace(/ /g, ' ');
}

test('EMVA 1288 description is trimmed (drops "sensor")', () => {
  const t = sidebarPayload([{ l: 'EMVA 1288', v: 'Machine-vision sensor characterization' }]);
  assert.match(t, /Machine-vision characterization/);
  assert.doesNotMatch(t, /sensor characterization/);
});

test('ISO 14524 description is trimmed (Opto-electronic -> EO)', () => {
  const t = sidebarPayload([{ l: 'ISO 14524', v: 'Opto-electronic conversion function' }]);
  assert.match(t, /EO conversion function/);
  assert.doesNotMatch(t, /Opto-electronic conversion function/);
});

test('a value cut mid-parenthesis gets its ")" closed', () => {
  const t = sidebarPayload([{ l: 'Product & systems', v: 'Systems architecture, change governance, technical-commercial evaluation (RFQ/RFI' }]);
  assert.match(t, /\(RFQ\/RFI\)/, 'the open parenthesis is balanced with a closing one');
});

test('a balanced value is left unchanged', () => {
  const t = sidebarPayload([{ l: 'Product & systems', v: 'change control (CCB), planning' }]);
  assert.match(t, /change control \(CCB\), planning/);
  assert.doesNotMatch(t, /\(CCB\), planning\)/, 'no spurious extra ")" appended to already-balanced text');
});

test('SIDEBAR-GROUP-MERGE-001: Imaging folds into Optics, photonics & sensing ({l,v})', () => {
  const t = sidebarPayload([
    { l: 'Optics, photonics & sensing', v: 'Electro-optics, LiDAR' },
    { l: 'Imaging', v: 'Camera architecture, image sensors' },
  ]);
  assert.match(t, /Electro-optics, LiDAR, Camera architecture, image sensors/, 'values merged onto the Optics line');
  const parsed = JSON.parse(t);
  assert.equal(parsed.items.length, 1, 'the Imaging item is dropped after merge');
  assert.equal(parsed.items[0].l, 'Optics, photonics & sensing');
});

test('SIDEBAR-GROUP-MERGE-001: same in rich_block {b,t} shape', () => {
  const t = sidebarPayload([
    { b: 'Optics, photonics & sensing', t: 'Electro-optics, LiDAR' },
    { b: 'Imaging', t: 'Camera architecture, image sensors' },
  ], 'rich_block');
  assert.match(t, /Electro-optics, LiDAR, Camera architecture, image sensors/);
  assert.equal(JSON.parse(t).items.length, 1);
});

test('SIDEBAR-GROUP-MERGE-001: no-op when only one of the pair is present', () => {
  const t = sidebarPayload([{ l: 'Imaging', v: 'Camera architecture, image sensors' }]);
  assert.equal(JSON.parse(t).items.length, 1, 'nothing to merge into -> untouched');
  assert.match(t, /Imaging/);
});
