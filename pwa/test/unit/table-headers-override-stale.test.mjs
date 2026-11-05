// table-headers-override-stale.test.mjs
// ============================================================
// TH-OVERRIDE-STALE-001 (owner 2026-11-05): antcv-table-headers-editable-341 keyed
// its canonical-store match on slugified candidates ("core-comp") while the key it
// derives from data-sid is the raw id ("core_comp"), so a header blur never
// committed, parked a fallback override in antcv.tableHeaders.v1, and restoreText
// forced that stale text over the canonical header on every sweep (the live DA
// header flickered back to English every 1-2 s). The pure helpers are extracted
// verbatim and run against a localStorage shim.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../antcv-table-headers-editable-341.js', import.meta.url), 'utf8');
function fn(name) {
  const start = src.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' found');
  let i = src.indexOf('{', start), depth = 0;
  for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); } }
  throw new Error('unbalanced ' + name);
}
function load(seed) {
  const m = new Map(Object.entries(seed));
  const localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  const body = "var STORAGE_KEY = 'antcv.tableHeaders.v1'; var SECTIONS_KEY = 'sections';\n"
    + ['clean', 'readStore', 'slugify', 'sectionMatches', 'canonicalHeaderCell', 'commitToSections', 'getOverride', 'setOverrideSilent'].map(fn).join('\n')
    + '\nreturn { sectionMatches, canonicalHeaderCell, commitToSections, getOverride, setOverrideSilent };';
  const api = new Function('localStorage', 'window', body)(localStorage, { dispatchEvent() {} });
  return { api, m };
}
const DA = ['Rollen kræver', 'Det bringer jeg, med belæg'];
const bundle = { cv: [{ id: 'core_comp', title: 'KERNERESULTATER OG KOMPETENCER', type: 'table', rows: [DA, ['A', 'a']] }], cl: [] };

test('sectionMatches: raw id from data-sid, slug of the title, and slug of the id all match', () => {
  const { api } = load({});
  const sec = bundle.cv[0];
  assert.equal(api.sectionMatches(sec, 'core_comp'), true, 'raw id');
  assert.equal(api.sectionMatches(sec, 'core-comp'), true, 'slug of id');
  assert.equal(api.sectionMatches(sec, 'kerneresultater-og-kompetencer'), true, 'slug of title');
  assert.equal(api.sectionMatches(sec, 'bring'), false);
});

test('commitToSections writes the canonical header for a data-sid key (used to fail)', () => {
  const { api, m } = load({ sections: JSON.stringify(bundle) });
  assert.equal(api.commitToSections('cv', 'core_comp', 1, 'Edited'), true);
  assert.equal(JSON.parse(m.get('sections')).cv[0].rows[0][1], 'Edited');
});

test('a stale override is dropped when the canonical store carries the cell', () => {
  const { api, m } = load({ sections: JSON.stringify(bundle), 'antcv.tableHeaders.v1': JSON.stringify({ cv: { core_comp: { 1: 'What I bring, with proof' } } }) });
  assert.equal(api.canonicalHeaderCell('cv', 'core_comp', 1), DA[1]);
  // the restore rule: canonical present and different -> clear the override, never write the cell
  const override = api.getOverride('cv', 'core_comp', 1);
  const canonical = api.canonicalHeaderCell('cv', 'core_comp', 1);
  assert.notEqual(canonical, override);
  api.setOverrideSilent('cv', 'core_comp', 1, '');
  assert.equal(api.getOverride('cv', 'core_comp', 1), null, 'override cleared');
  assert.deepEqual(JSON.parse(m.get('sections')).cv[0].rows[0], DA, 'canonical untouched');
});

test('canonicalHeaderCell is null when the section has no header, so the override still applies', () => {
  const { api } = load({ sections: JSON.stringify({ cv: [{ id: 'core_comp', type: 'table', rows: [] }], cl: [] }) });
  assert.equal(api.canonicalHeaderCell('cv', 'core_comp', 1), null);
});

test('restoreText source: canonical-first, focused cell left alone', () => {
  const body = fn('restoreText');
  assert.match(body, /canonicalHeaderCell\(doc, sectionKey, colIndex\)/);
  assert.match(body, /document\.activeElement === th/);
  assert.match(body, /setOverrideSilent\(doc, sectionKey, colIndex, ''\)/);
});
