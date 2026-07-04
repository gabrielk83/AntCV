// export-align-parity.test.mjs
// ============================================================
// EXPORT-ALIGN-PARITY (register row 33): the Name-line alignment and the
// section-headline alignment persist in preview-only stores; buildPayload must
// forward both so the PDF/DOCX matches the preview.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.window = globalThis.window || {};

const { buildPayload } = await import('../../antcv-docx-client.js');

const base = (over = {}) => buildPayload({
  sections: { cv: [{ id: 'profile', type: 'text', title: 'PROFILE', loc: 'main', on: true, content: 'x' }], cl: [] },
  doc: 'cv',
  personalInfo: { name: 'Gabriel' },
  meta: { company: 'NIL Technology', role: 'Nanooptics Prototyping Engineer' },
  ...over,
});

test('NAME-ALIGN-EXPORT-PARITY: antcv:nameLineAlign feeds header_align.name', () => {
  store.set('antcv:nameLineAlign', 'right');
  const p = base();
  store.delete('antcv:nameLineAlign');
  assert.equal(p.header_align.name, 'right', 'stored name align reaches the payload');
});

test('NAME-ALIGN-EXPORT-PARITY: HeaderInlineEditor prop still wins over the store', () => {
  store.set('antcv:nameLineAlign', 'right');
  const p = base({ headerItemAlign: { name: 'left' } });
  store.delete('antcv:nameLineAlign');
  assert.equal(p.header_align.name, 'left', 'explicit prop overrides the sidecar store');
});

test('NAME-ALIGN default is center when neither prop nor store set', () => {
  assert.equal(base().header_align.name, 'center');
});

test('HEADLINE-ALIGN-EXPORT-PARITY: sectionHeadlineAlignment.v1 forwards as a loc map', () => {
  store.set('antcv.sectionHeadlineAlignment.v1', JSON.stringify({ topbar: 'center', sidebar: 'left', main: 'right' }));
  const p = base();
  store.delete('antcv.sectionHeadlineAlignment.v1');
  assert.deepEqual(p.headline_align, { topbar: 'center', sidebar: 'left', main: 'right' });
});

test('HEADLINE-ALIGN: bad values dropped, empty map when unset', () => {
  store.set('antcv.sectionHeadlineAlignment.v1', JSON.stringify({ main: 'diagonal', sidebar: 'center' }));
  const p = base();
  store.delete('antcv.sectionHeadlineAlignment.v1');
  assert.deepEqual(p.headline_align, { sidebar: 'center' }, 'invalid align filtered out');
  assert.deepEqual(base().headline_align, {}, 'unset -> empty map');
});

test('worker honors headline_align by loc in headingParagraph (source assertion)', () => {
  const src = readFileSync(new URL('../../../workers/docx-worker/src/index.js', import.meta.url), 'utf8');
  assert.ok(src.includes('headlineAlign: payload.headline_align'), 'ctx carries headline_align');
  assert.ok(/ctx\.headlineAlign/.test(src), 'headingParagraph reads ctx.headlineAlign');
});
