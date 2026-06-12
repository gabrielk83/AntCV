// outcomes-mode-forward.test.mjs
// ============================================================
// OUTCOMES-MODE-001 export half (1.50.393 / worker 1.14.59): in 'results'
// mode buildPayload drops the SELECTED OUTCOMES section and attaches a
// per-role `results` string to the experience roles (token-matched;
// unmatched outcomes → first visible role). Default mode forwards the
// payload unchanged.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { buildPayload } = await import('../../antcv-docx-client.js');

function payloadFor(mode) {
  store.clear();
  if (mode) store.set('outcomesMode', JSON.stringify(mode));
  return buildPayload({
    sections: { cv: [
      { id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'P.' },
      { id: 'outcomes', title: 'SELECTED OUTCOMES', loc: 'main', on: true, type: 'bullets', items: [
        { b: 'Cut', t: 'Innoviz change cycle from 250 to 10 days.' },
        { b: 'Built', t: 'an optical lab with structured acceptance tests.' },
      ]},
      { id: 'experience', title: 'PROFESSIONAL EXPERIENCE', loc: 'main', on: true, type: 'experience', roles: [
        { id: 'r0', title: 'Change Control Lead', company: 'Innoviz Technologies', years: '2020–2025', bullets: ['Owned governance.'] },
        { id: 'r1', title: 'Optics Engineer', company: 'Sirin Labs', years: '2014–2017', bullets: ['Led stack.'] },
      ]},
    ], cl: [] },
    doc: 'cv', personalInfo: { name: 'T' },
  });
}

test("results mode: outcomes section dropped, roles carry matched results", () => {
  const p = payloadFor('results');
  assert.equal(p.sections.find((s) => s.id === 'outcomes'), undefined);
  const exp = p.sections.find((s) => s.id === 'experience');
  const r0 = exp.roles.find((r) => r.id === 'r0');
  const r1 = exp.roles.find((r) => r.id === 'r1');
  assert.ok(/Innoviz change cycle/.test(r0.results));
  assert.ok(/optical lab/.test(r0.results), 'unmatched outcome attaches to the first visible role');
  assert.equal(r1.results, undefined);
});

test('default mode: payload unchanged (outcomes section present, no results keys)', () => {
  const p = payloadFor(null);
  assert.ok(p.sections.find((s) => s.id === 'outcomes'));
  const exp = p.sections.find((s) => s.id === 'experience');
  assert.ok(exp.roles.every((r) => r.results === undefined));
});

test("section mode explicitly stored: same as default", () => {
  const p = payloadFor('section');
  assert.ok(p.sections.find((s) => s.id === 'outcomes'));
});
