// howcontribute-merge.test.mjs
// ============================================================
// HOWCONTRIBUTE-001: the export payload must carry the HOW I WOULD
// CONTRIBUTE bullets. The shape-guard sidecar stamps bullets:[] onto every
// stored section, so the docx-client merge must prefer NON-EMPTY bullets,
// fall back to items, and never let an empty stored list wipe live bullets.
// Drives the real buildPayload from antcv-docx-client.js with a localStorage
// shim.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { buildPayload } = await import('../../antcv-docx-client.js');

const REAL = ['Ship the dashboard', 'Cut suite runtime', 'Write the runbook'];
const contribute = (over) => ({
  id: 'contribute', title: 'HOW I WOULD CONTRIBUTE', loc: 'main', on: true,
  type: 'text_bullets', intro: 'Live intro.', items: REAL.slice(), closing: 'Live closing.',
  ...over,
});
const liveSections = (over) => ({ cv: [], cl: [contribute(over)] });
// ORPHAN-NBSP-EXPORT-001 (1.50.656): the export binds orphan words with a
// non-breaking space. This test verifies the shape-guard MERGE (which field wins),
// not the whitespace binding, so normalise NBSP -> space before asserting.
const _dn = (v) => (typeof v === 'string' ? v.replace(/ /g, ' ') : (Array.isArray(v) ? v.map(_dn) : v));
const _denbsp = (o) => { if (!o || typeof o !== 'object') return o; const r = {}; for (const k of Object.keys(o)) r[k] = _dn(o[k]); return r; };
const payloadFor = (live, stored) => {
  store.clear();
  if (stored) store.set('sections', JSON.stringify({ cv: [], cl: [stored] }));
  const p = buildPayload({ sections: live, doc: 'cl' });
  return _denbsp(p.sections.find((s) => s.id === 'contribute'));
};

beforeEach(() => store.clear());

test('shape-guard bullets:[] stamp does not wipe items in the export', () => {
  const s = payloadFor(liveSections(), contribute({ bullets: [] }));
  assert.deepEqual(s.items, REAL);
});

test('non-empty stored bullets override live items (sidecar edit wins)', () => {
  const edited = ['Edited bullet one', 'Edited bullet two'];
  const s = payloadFor(liveSections(), contribute({ bullets: edited }));
  assert.deepEqual(s.items, edited);
  assert.deepEqual(s.bullets, edited);
});

test('stored items used when no bullets field exists', () => {
  const storedItems = ['Stored A', 'Stored B', 'Stored C'];
  const s = payloadFor(liveSections({ items: ['stale'] }), contribute({ items: storedItems }));
  assert.deepEqual(s.items, storedItems);
});

test('fully empty stored section never wipes live bullets', () => {
  const s = payloadFor(liveSections(), contribute({ items: [], bullets: [] }));
  assert.deepEqual(s.items, REAL);
});

test('no localStorage entry leaves the live section untouched', () => {
  const s = payloadFor(liveSections(), null);
  assert.deepEqual(s.items, REAL);
  assert.equal(s.intro, 'Live intro.');
});

test('stored intro/closing edits flow into the payload', () => {
  const s = payloadFor(liveSections(), contribute({ intro: 'Edited intro.', closing: 'Edited closing.', bullets: [] }));
  assert.equal(s.intro, 'Edited intro.');
  assert.equal(s.closing, 'Edited closing.');
  assert.deepEqual(s.items, REAL);
});
