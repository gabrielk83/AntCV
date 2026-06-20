/* Unit test — URUGUAYAN-VARIANT-STRIP-001 (2026-06-22)
 * sanitizeForExport() (called inside buildPayload) must strip ", Uruguayan variant"
 * from Spanish language items while leaving English and Hebrew entries untouched.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
store.set('antcv:lastJdText', 'Photonic test engineer role at NVIDIA requiring laser safety.');
store.set('outcomesMode', JSON.stringify('results'));
store.set('personalInfo', JSON.stringify({}));
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.window = globalThis.window || {};

const { buildPayload } = await import('../../antcv-docx-client.js');

// buildPayload applies orphan-bind (last space → U+00A0). Normalise before asserting.
const noNbsp = (s) => String(s || '').replace(/ /g, ' ');

function payload(langItems) {
  return buildPayload({
    sections: {
      cv: [{ id: 'languages', type: 'labeled_list', title: 'LANGUAGES', loc: 'sidebar', on: true, items: langItems }],
      cl: [],
    },
    doc: 'cv',
    personalInfo: { name: 'Gabriel' },
    meta: { company: 'NVIDIA', role: 'Test Engineer' },
  });
}

function findLang(result, label) {
  const sec = result.sections.find(s => s.id === 'languages');
  return sec && sec.items && sec.items.find(i => i.l === label);
}

test('URUGUAYAN-VARIANT-STRIP-001: strips ", Uruguayan variant" from Spanish', () => {
  const r = payload([
    { l: 'English', v: 'Native / bilingual' },
    { l: 'Hebrew', v: 'Native / bilingual' },
    { l: 'Spanish', v: 'Full professional proficiency, Uruguayan variant' },
    { l: 'Danish', v: 'B1 professional working proficiency' },
  ]);
  const sp = findLang(r, 'Spanish');
  assert.ok(sp, 'Spanish entry present');
  assert.equal(noNbsp(sp.v), 'Full professional proficiency', 'comma form stripped');
  assert.equal(noNbsp(findLang(r, 'English').v), 'Native / bilingual', 'English untouched');
  assert.equal(noNbsp(findLang(r, 'Hebrew').v), 'Native / bilingual', 'Hebrew untouched');
  assert.equal(noNbsp(findLang(r, 'Danish').v), 'B1 professional working proficiency', 'Danish untouched');
});

test('URUGUAYAN-VARIANT-STRIP-001: strips parenthetical "(Uruguayan variant)"', () => {
  const r = payload([
    { l: 'Spanish', v: 'Full professional proficiency (Uruguayan variant)' },
  ]);
  const sp = findLang(r, 'Spanish');
  assert.ok(sp, 'Spanish entry present');
  assert.equal(noNbsp(sp.v), 'Full professional proficiency', 'parens form stripped');
});

test('URUGUAYAN-VARIANT-STRIP-001: case-insensitive strip', () => {
  const r = payload([
    { l: 'Spanish', v: 'Professional proficiency, uruguayan variant' },
  ]);
  const sp = findLang(r, 'Spanish');
  assert.equal(noNbsp(sp.v), 'Professional proficiency', 'case-insensitive');
});

test('URUGUAYAN-VARIANT-STRIP-001: clean entry unchanged', () => {
  const r = payload([
    { l: 'Spanish', v: 'Full professional proficiency' },
  ]);
  assert.equal(noNbsp(findLang(r, 'Spanish').v), 'Full professional proficiency', 'already-clean entry is unchanged');
});
