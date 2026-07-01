/* ACCESSIBILITY-PREVIEW-TYPE-001 — accessibilityToLabeledList converts a real-content
 * type:"text" accessibility section to a single-item labeled_list ({l:"", v:content}) so the
 * preview renders it (the sidebar preview does not render type:"text"). A placeholder is left
 * untouched. Tests the REAL function extracted verbatim from source. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../antcv-sections-normalize-415.js');
const src = readFileSync(SRC, 'utf8');
const start = src.indexOf('function accessibilityToLabeledList(');
assert.ok(start >= 0, 'function found in source');
let i = src.indexOf('{', start), depth = 0, end = -1;
for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } } }
const fnText = src.slice(start, end);
const conv = new Function('console', fnText + '\nreturn accessibilityToLabeledList;')({ log() {} });

const LINE = 'Hearing impaired; cochlear implant and hearing aid. Captions and written follow-up help.';

test('real type:text accessibility -> labeled_list with empty label', () => {
  const cv = [{ id: 'accessibility', title: 'ACCESSIBILITY', loc: 'sidebar', on: true, type: 'text', content: LINE }];
  const out = conv(cv);
  assert.ok(Array.isArray(out), 'changed');
  const a = out.find((s) => s.id === 'accessibility');
  assert.equal(a.type, 'labeled_list');
  assert.deepEqual(a.items, [{ l: '', v: LINE }], 'single empty-label item holds the content');
  assert.equal(a.content, undefined, 'text content removed');
  assert.equal(a.loc, 'sidebar');
  assert.equal(a.on, true);
});

test('placeholder content is left for the repair (no conversion)', () => {
  const cv = [{ id: 'accessibility', type: 'text', content: '[ACCESSIBILITY - optional...]' }];
  assert.equal(conv(cv), null);
});

test('already labeled_list -> no-op', () => {
  const cv = [{ id: 'accessibility', type: 'labeled_list', items: [{ l: '', v: LINE }] }];
  assert.equal(conv(cv), null);
});

test('empty content -> no-op (no broken empty item)', () => {
  const cv = [{ id: 'accessibility', type: 'text', content: '   ' }];
  assert.equal(conv(cv), null);
});
