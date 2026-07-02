// contact-line-denmark.test.mjs
// ============================================================
// CONTACT-LINE-DENMARK-001 (owner 2026-06-14): the exported DOCX/PDF header
// contact line must read "2300, København S" — postcode + comma + district,
// NO country word — for any Copenhagen-based stored location. The preview
// (app.src.js __localForm) already normalised this; the export path
// (antcv-docx-client buildPayload) sent the raw location and is now fixed to
// mirror it. This locks the export behaviour + preview/source parity.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// buildPayload reads window.localStorage helpers; stub the minimum globals so
// the ES module imports + runs headlessly.
globalThis.window = globalThis.window || {};
globalThis.localStorage = globalThis.localStorage || {
  getItem: () => null, setItem: () => {}, removeItem: () => {},
};

const { buildPayload } = await import('../../antcv-docx-client.js');

function exportedLocation(stored) {
  const payload = buildPayload({
    doc: 'cv',
    language: 'en',
    personalInfo: { name: 'X', location: stored },
    meta: {},
    sections: [],
    styleConfig: {},
  });
  return payload.personal_info.location;
}

test('export normalises raw "2300 København S, Denmark" → "2300, København S"', () => {
  assert.equal(exportedLocation('2300 København S, Denmark'), '2300, København S');
});

test('export normalises Danish-spelled "2300 København S, Danmark" → "2300, København S"', () => {
  assert.equal(exportedLocation('2300 København S, Danmark'), '2300, København S');
});

// LOCALFORM-NO-FABRICATION-001 (owner 2026-07-03, Anita demo): a bare Copenhagen
// location must NEVER gain an invented postcode/district — that fabricated
// Gabriel's address onto other candidates. Only a stored postcode is reformatted.
test('bare "Copenhagen, Denmark" stays København — no invented postcode', () => {
  assert.equal(exportedLocation('Copenhagen, Denmark'), 'København');
});

test('bare "København" stays København — no invented postcode', () => {
  assert.equal(exportedLocation('København'), 'København');
});

test('export keeps an explicit non-default district postcode, adds the comma', () => {
  // 2200 København N must keep its own district, just gain the comma.
  assert.equal(exportedLocation('2200 København N, Denmark'), '2200, København N');
});

test('export leaves a non-Copenhagen location untouched', () => {
  assert.equal(exportedLocation('Aarhus, Denmark'), 'Aarhus, Denmark');
  assert.equal(exportedLocation('Berlin, Germany'), 'Berlin, Germany');
});

test('no country word ("denmark"/"danmark") survives a Copenhagen location', () => {
  const out = exportedLocation('2300 København S, Denmark');
  assert.ok(!/denmark|danmark/i.test(out), `country word leaked: ${out}`);
});

test('preview source + minified bundle both carry the comma-insertion regex (parity)', () => {
  const src = readFileSync(path.join(ROOT, 'app.src.js'), 'utf8');
  const min = readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  const re = String.raw`/^(\d{4})\s+(københavn.*)$/i`;
  assert.ok(src.includes(re), 'app.src.js missing the comma-insertion regex');
  assert.ok(min.includes(re), 'app.js (minified mirror) missing the comma-insertion regex');
});
