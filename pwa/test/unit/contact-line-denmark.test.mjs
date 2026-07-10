// contact-line-denmark.test.mjs
// ============================================================
// CONTACT-LINE-DENMARK-001 (owner 2026-06-14): the exported DOCX/PDF header
// contact line reads "2300, København S" — postcode + comma + district,
// NO country word — for a Copenhagen-based stored location. The preview
// (app.src.js __localForm) normalises this; the export path
// (antcv-docx-client buildPayload) mirrors it. Locks export behaviour + parity.
//
// LOCALFORM-DA-ONLY-001 (owner 2026-07-10, 1.51.243): the Danish local form is
// only correct for a DANISH-language application. For en/zh the city stays as
// written "Copenhagen" (the language layer localizes it — zh -> 哥本哈根), and
// no postcode reformat / country-word strip happens. So the "2300, København S"
// assertions now run under language:'da'; the en path is locked separately below.

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

// The Danish local form (LOCALFORM-DA-ONLY-001) applies only to a da export, so
// default the helper to 'da'; the en path is asserted explicitly below.
function exportedLocation(stored, language = 'da') {
  const payload = buildPayload({
    doc: 'cv',
    language,
    personalInfo: { name: 'X', location: stored },
    meta: {},
    sections: [],
    styleConfig: {},
  });
  return payload.personal_info.location;
}

test('da export normalises raw "2300 København S, Denmark" → "2300, København S"', () => {
  assert.equal(exportedLocation('2300 København S, Denmark'), '2300, København S');
});

test('da export normalises Danish-spelled "2300 København S, Danmark" → "2300, København S"', () => {
  assert.equal(exportedLocation('2300 København S, Danmark'), '2300, København S');
});

// LOCALFORM-NO-FABRICATION-001 (owner 2026-07-03, Anita demo): a bare Copenhagen
// location must NEVER gain an invented postcode/district — that fabricated
// Gabriel's address onto other candidates. Only a stored postcode is reformatted.
test('da bare "Copenhagen, Denmark" stays København — no invented postcode', () => {
  assert.equal(exportedLocation('Copenhagen, Denmark'), 'København');
});

test('da bare "København" stays København — no invented postcode', () => {
  assert.equal(exportedLocation('København'), 'København');
});

test('da export keeps an explicit non-default district postcode, adds the comma', () => {
  // 2200 København N must keep its own district, just gain the comma.
  assert.equal(exportedLocation('2200 København N, Denmark'), '2200, København N');
});

test('export leaves a non-Copenhagen location untouched', () => {
  assert.equal(exportedLocation('Aarhus, Denmark'), 'Aarhus, Denmark');
  assert.equal(exportedLocation('Berlin, Germany'), 'Berlin, Germany');
});

test('no country word ("denmark"/"danmark") survives a da Copenhagen location', () => {
  const out = exportedLocation('2300 København S, Denmark');
  assert.ok(!/denmark|danmark/i.test(out), `country word leaked: ${out}`);
});

// LOCALFORM-DA-ONLY-001 (owner 2026-07-10, 1.51.243): for en/zh the Danish local
// form must NOT fire — the city is left as "Copenhagen" (Danish "København" is
// anglicized so the translator has a canonical English city), and the postcode /
// country word are left intact. These lock the da-only guard against regression.
test('en export leaves the country word + postcode; only anglicizes København', () => {
  assert.equal(exportedLocation('2300 København S, Denmark', 'en'), '2300 Copenhagen S, Denmark');
});

test('en export anglicizes a bare "København" to "Copenhagen"', () => {
  assert.equal(exportedLocation('København', 'en'), 'Copenhagen');
});

test('en export does not reformat a Copenhagen postcode into the Danish comma form', () => {
  // The "2300, København S" Danish form must NOT appear on an English export.
  const out = exportedLocation('2300 København S, Denmark', 'en');
  assert.ok(!/2300,\s*København/i.test(out), `Danish local form leaked into en: ${out}`);
});

test('preview source + minified bundle both carry the comma-insertion regex (parity)', () => {
  const src = readFileSync(path.join(ROOT, 'app.src.js'), 'utf8');
  const min = readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  const re = String.raw`/^(\d{4})\s+(københavn.*)$/i`;
  assert.ok(src.includes(re), 'app.src.js missing the comma-insertion regex');
  assert.ok(min.includes(re), 'app.js (minified mirror) missing the comma-insertion regex');
});
