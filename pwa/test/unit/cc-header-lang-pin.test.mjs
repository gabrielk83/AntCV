// cc-header-lang-pin.test.mjs
// ============================================================
// CC-HEADER-LANG-PIN-001 (owner 2026-11-05): the live DA switch on antcv.pages.dev
// left the CORE COMPETENCIES header as the LLM's free translation
// ("Rollen kræver" | "Det kan jeg, med bevis"). sections-normalize-415 pins the
// house pair per output language on the core_comp / bring tables; an English pair
// is left alone (app.js maps it at render) and other tables are never touched.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const src = await readFile(new URL('../../antcv-sections-normalize-415.js', import.meta.url), 'utf8');
const start = src.indexOf('var CC_HEADER_PLAIN');
const fnStart = src.indexOf('function plainCoreCompHeaders(', start);
let i = src.indexOf('{', fnStart), depth = 0, end = -1;
for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } } }
const plain = new Function(src.slice(start, end) + '\nreturn plainCoreCompHeaders;')();

const EN = ['The role needs', 'What I bring, with proof'];
const DA = ['Rollen kræver', 'Det bringer jeg, med belæg'];
const table = (id, rows) => ({ id, title: 'X', loc: 'main', on: true, type: 'table', rows });

test('da: a free-translated header on core_comp is pinned to the house pair, rows untouched', () => {
  const out = plain([table('core_comp', [['Rollen kræver', 'Det kan jeg, med bevis'], ['Kravanalyse', 'Sporbarhed under ASPICE']])], 'da');
  assert.deepEqual(out[0].rows[0], DA);
  assert.deepEqual(out[0].rows[1], ['Kravanalyse', 'Sporbarhed under ASPICE']);
});

test('da: the English pair is left alone (render-time map covers it); the DA pair is a no-op', () => {
  assert.equal(plain([table('core_comp', [EN, ['A', 'a']])], 'da'), null);
  assert.equal(plain([table('bring', [DA, ['A', 'a']])], 'da'), null);
});

test('da: a user-authored table with another id is never rewritten', () => {
  assert.equal(plain([table('skills_matrix', [['Område', 'Niveau'], ['A', 'a']])], 'da'), null);
});

test('en: no language pin, only the legacy map', () => {
  assert.equal(plain([table('core_comp', [['Område', 'Niveau'], ['A', 'a']])], 'en'), null);
  assert.deepEqual(plain([table('core_comp', [['Focus Area', 'Strategic Expertise'], ['A', 'a']])], 'en')[0].rows[0], EN);
});

test('es / zh pairs', () => {
  assert.deepEqual(plain([table('bring', [['Lo que pide', 'Lo que doy'], ['A', 'a']])], 'es')[0].rows[0], ['Lo que exige el puesto', 'Lo que aporto, con pruebas']);
  assert.deepEqual(plain([table('core_comp', [['职位要求', '我的能力'], ['A', 'a']])], 'zh')[0].rows[0], ['岗位要求', '我的贡献与佐证']);
});

test('legacy DA pair still maps even when the language is unknown', () => {
  assert.deepEqual(plain([table('core_comp', [['Fokusområde', 'Strategisk ekspertise'], ['A', 'a']])], 'en')[0].rows[0], DA);
});

// CC-HEADER-COMPANY-001 (owner 2026-11-08, #3536 Elma): the house heads the table with the employer's name
// (pkgs_1054 needs_heads "Elma efterspørger" | "Det bringer jeg, med belæg"); the pin keeps that wording.
test('da: "<company> efterspørger" with the house second head is kept; another company or a free second head is pinned', () => {
  const CO = 'Elma Instruments (via Compass HR)';
  assert.equal(plain([table('core_comp', [['Elma efterspørger', 'Det bringer jeg, med belæg'], ['Pris og margin', 'Prisgrundlag for 4 kunder']])], 'da', CO), null);
  assert.equal(plain([table('core_comp', [['Elma eftersøger', 'Det bringer jeg, med belæg'], ['A', 'a']])], 'da', CO), null);
  assert.deepEqual(plain([table('core_comp', [['Kaleido efterspørger', 'Det bringer jeg, med belæg'], ['A', 'a']])], 'da', CO)[0].rows[0], DA);
  assert.deepEqual(plain([table('core_comp', [['Elma efterspørger', 'Det kan jeg, med bevis'], ['A', 'a']])], 'da', CO)[0].rows[0], DA);
  assert.deepEqual(plain([table('core_comp', [['Elma efterspørger', 'Det bringer jeg, med belæg'], ['A', 'a']])], 'da', '')[0].rows[0], DA, 'no company on record: house pair');
});
