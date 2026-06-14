// role-founder-export.test.mjs
// ============================================================
// ROLE-FOUNDER-001 export half (owner 2026-06-14): the application role/subtitle
// band showed "Founder & Product / Project Expert". "Founder"/"Co-Founder" must
// not appear in the exported role/subtitle for unsolicited or non-consulting
// roles; a genuine independent-consultancy label is left intact.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.window = globalThis.window || {};
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { buildPayload } = await import('../../antcv-docx-client.js');

function cvMeta(meta) {
  store.clear();
  const p = buildPayload({ sections: { cv: [], cl: [] }, doc: 'cv', personalInfo: { name: 'T' }, meta });
  return p.meta;
}
function clSubtitle(meta) {
  store.clear();
  const p = buildPayload({ sections: { cv: [], cl: [] }, doc: 'cl', personalInfo: { name: 'T' }, meta });
  return p.meta.subtitle;
}

test('CV: "Founder" stripped from subtitle, leftover separator tidied', () => {
  const m = cvMeta({ subtitle: 'Founder & Product / Project Expert' });
  assert.equal(m.subtitle, 'Product / Project Expert');
  assert.ok(!/founder/i.test(m.subtitle));
});

test('CV: "Founder" stripped from meta.role', () => {
  const m = cvMeta({ role: 'Founder & Product / Project Expert' });
  assert.equal(m.role, 'Product / Project Expert');
});

test('CL: "Founder" stripped from the synthesised Application line', () => {
  const s = clSubtitle({ role: 'Founder & Product Expert', company: 'Novo Nordisk' });
  assert.ok(!/founder/i.test(s), `founder leaked: ${s}`);
  assert.ok(/Product Expert/.test(s) && /Novo Nordisk/.test(s));
});

test('Co-Founder is also stripped', () => {
  assert.equal(cvMeta({ subtitle: 'Co-Founder, Systems Architect' }).subtitle, 'Systems Architect');
});

test('a genuine independent-consultancy label is preserved', () => {
  const m = cvMeta({ subtitle: 'Independent Consultant — Kanzen konsulenter' });
  assert.ok(/Independent Consultant/.test(m.subtitle), 'consulting label must survive');
});

test('a Founder-free subtitle is untouched', () => {
  assert.equal(cvMeta({ subtitle: 'Processes • Products • People' }).subtitle, 'Processes • Products • People');
});
