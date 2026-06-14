// outcomes-mode-forward.test.mjs
// ============================================================
// OUTCOMES-MODE-001 export half (1.50.393 / worker 1.14.59): in 'results'
// mode buildPayload drops the SELECTED OUTCOMES section and attaches a
// per-role `results` string to the experience roles (token-matched).
// CONTRACT UPDATE (OUTCOMES-RESULTS-EXPORT-PARITY-001, 1.50.447/451): an
// outcome that doesn't token-match a role no longer piles onto the first
// role — it spills into the emptiest remaining role so the first role is no
// longer starved and the results spread across the experience. Default mode
// forwards the payload unchanged.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { buildPayload } = await import('../../antcv-docx-client.js');

function payloadFor(mode, stylePackage) {
  store.clear();
  if (mode) store.set('outcomesMode', JSON.stringify(mode));
  if (stylePackage) store.set('stylePackage', JSON.stringify(stylePackage));
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

test("results mode: outcomes section dropped, results spread across roles (not piled on r0)", () => {
  const p = payloadFor('results');
  assert.equal(p.sections.find((s) => s.id === 'outcomes'), undefined);
  const exp = p.sections.find((s) => s.id === 'experience');
  const r0 = exp.roles.find((r) => r.id === 'r0');
  const r1 = exp.roles.find((r) => r.id === 'r1');
  // matched outcome lands on its role (Innoviz → r0)
  assert.ok(/Innoviz change cycle/.test(r0.results));
  // the second outcome lands on r1 (the Optics role / emptiest role) — NOT
  // piled onto r0 as well. This is the "first role no longer starved" fix.
  assert.ok(/optical lab/.test(r1.results), 'second outcome spreads to r1, not piled on r0');
  assert.ok(!/optical lab/.test(r0.results), 'r0 must not also carry the second outcome');
});

test('OUTCOMES-MODE-PARITY-001: no explicit mode + Copenhagen default → results (matches preview)', () => {
  // The PREVIEW (__antcvOutcomesMode) defaults Copenhagen Modern to 'results'
  // when nothing is stored; the export now mirrors it. The default package
  // (empty/scandinavian) resolves to copenhagen-modern → results.
  const p = payloadFor(null);
  assert.equal(p.sections.find((s) => s.id === 'outcomes'), undefined, 'export must hide SELECTED OUTCOMES on the Copenhagen default, matching the preview');
  const exp = p.sections.find((s) => s.id === 'experience');
  assert.ok(exp.roles.some((r) => typeof r.results === 'string' && r.results), 'roles carry results on the Copenhagen default');
});

test('non-Copenhagen package + no explicit mode → section (outcomes block kept)', () => {
  const p = payloadFor(null, 'navy-executive');
  assert.ok(p.sections.find((s) => s.id === 'outcomes'), 'non-Copenhagen defaults to the SELECTED OUTCOMES block');
  const exp = p.sections.find((s) => s.id === 'experience');
  assert.ok(exp.roles.every((r) => r.results === undefined));
});

test("section mode explicitly stored: same as default", () => {
  const p = payloadFor('section');
  assert.ok(p.sections.find((s) => s.id === 'outcomes'));
});
