/* WORK-STYLE-REPAIR-001 — repairWorkStyleFromPI fills an empty work_style body from
 * personalInfo.work_style (work_style_line_en / notes). Tests the REAL function extracted
 * verbatim from source. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../antcv-sections-normalize-415.js');
const src = readFileSync(SRC, 'utf8');
const start = src.indexOf('function repairWorkStyleFromPI(');
assert.ok(start >= 0, 'function found');
let i = src.indexOf('{', start), depth = 0, end = -1;
for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } } }
const fnText = src.slice(start, end);
function makeRepair(pi) {
  const localStorage = { getItem: (k) => (k === 'personalInfo' ? JSON.stringify(pi || {}) : null) };
  return new Function('localStorage', 'console', fnText + '\nreturn repairWorkStyleFromPI;')(localStorage, { log() {} });
}

const LINE = 'Calm, structured decisions from measured data; clear written outcomes.';

test('empty rich_block work_style -> filled from work_style_line_en', () => {
  const repair = makeRepair({ work_style: { work_style_line_en: LINE, notes: 'longer notes' } });
  const cv = [{ id: 'work_style', type: 'rich_block', headlineOff: true, items: [{ b: 'Work style', t: '' }] }];
  const out = repair(cv);
  assert.ok(Array.isArray(out));
  assert.equal(out[0].items[0].t, LINE);
  assert.equal(out[0].items[0].b, 'Work style', 'lead label preserved');
});

test('falls back to notes when no line', () => {
  const repair = makeRepair({ work_style: { notes: 'Note-based style line' } });
  const cv = [{ id: 'work_style', type: 'rich_block', items: [{ b: 'Work style', t: '' }] }];
  assert.equal(repair(cv)[0].items[0].t, 'Note-based style line');
});

test('type:text work_style -> content filled', () => {
  const repair = makeRepair({ work_style: { work_style_line_en: LINE } });
  const cv = [{ id: 'work_style', type: 'text', content: '' }];
  assert.equal(repair(cv)[0].content, LINE);
});

test('already-real body -> no-op', () => {
  const repair = makeRepair({ work_style: { work_style_line_en: LINE } });
  const cv = [{ id: 'work_style', type: 'rich_block', items: [{ b: 'Work style', t: 'User wrote this.' }] }];
  assert.equal(repair(cv), null);
});

test('no PI work_style -> no-op (no fabricated content)', () => {
  const repair = makeRepair({});
  const cv = [{ id: 'work_style', type: 'rich_block', items: [{ b: 'Work style', t: '' }] }];
  assert.equal(repair(cv), null);
});
