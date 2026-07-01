/* CONTRIBUTE-RICHBLOCK-EXPORT-001 — mergeHowContributeFromLocalStorage must NOT corrupt a
 * rich_block contribute whose items are objects ({b,t,mk}). Previously String(obj) produced
 * "[object Object]" and overwrote the real items, blanking HWIC in the PDF export. Tests the
 * REAL function extracted verbatim from source. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../antcv-docx-client.js');
const src = readFileSync(SRC, 'utf8');
const start = src.indexOf('function mergeHowContributeFromLocalStorage(');
assert.ok(start >= 0, 'function found in source');
let i = src.indexOf('{', start), depth = 0, end = -1;
for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } } }
const fnText = src.slice(start, end);

function build(storedSections) {
  const localStorage = { getItem: (k) => (k === 'sections' ? JSON.stringify(storedSections) : null) };
  return new Function('localStorage', 'JSON', fnText + '\nreturn mergeHowContributeFromLocalStorage;')(localStorage, JSON);
}

test('rich_block contribute (object items) is left UNTOUCHED — no [object Object]', () => {
  const richItems = [
    { b: 'How I would contribute', t: 'In the first months I would focus on the highest-leverage gaps.' },
    { b: 'Map current change', t: 'and validation flows to identify the friction.', mk: true },
  ];
  const contribute = { id: 'contribute', title: 'HOW I WOULD CONTRIBUTE', type: 'rich_block', items: richItems };
  const merge = build({ cl: [contribute] });
  const out = merge([JSON.parse(JSON.stringify(contribute))], 'cl');
  const c = out.find((s) => s.id === 'contribute');
  assert.deepEqual(c.items, richItems, 'object items preserved verbatim');
  assert.ok(!JSON.stringify(c).includes('[object Object]'), 'no stringified-object corruption');
});

test('legacy string-bullet contribute still merges its bullets', () => {
  const stored = { id: 'contribute', title: 'HOW I WOULD CONTRIBUTE', bullets: ['Map the change flows', 'Set up KPI tracking'] };
  const merge = build({ cl: [stored] });
  const out = merge([{ id: 'contribute', title: 'HOW I WOULD CONTRIBUTE', bullets: [] }], 'cl');
  const c = out.find((s) => s.id === 'contribute');
  assert.deepEqual(c.bullets, ['Map the change flows', 'Set up KPI tracking'], 'string bullets merged');
});

test('no contribute in storage -> docSections returned unchanged', () => {
  const merge = build({ cl: [{ id: 'who', title: 'WHO I AM' }] });
  const doc = [{ id: 'contribute', title: 'HOW I WOULD CONTRIBUTE', items: [{ b: 'x', t: 'y' }] }];
  assert.deepEqual(merge(doc, 'cl'), doc);
});
