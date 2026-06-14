// diag-bundle-palette-sync.mjs
// ============================================================
// EXPORT-PALETTE-PARITY (worker fallback, 2026-06-14): the DEPLOYED worker is
// the hand-maintained bundle src/index.js, which inlines a COPY of
// src/palette.js. palette.test.mjs only imports src/palette.js (the source),
// so it never caught that the bundle's inlined getPackageStyle had drifted to
// the pre-fix values (sidebarBg = base, white sidebar text/labels) — which
// makes the candidate / sidebar text invisible on the pale Copenhagen ground
// whenever the export payload omits an override token.
//
// This locks the bundle's inlined palette to the corrected ground+readableInk
// model so a future deploy can't ship the stale fallback again.
//
// Run from workers/docx-worker/:  node --test test/diag-bundle-palette-sync.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const bundle = readFileSync(path.join(HERE, '..', 'src', 'index.js'), 'utf8');

// Isolate the inlined palette block (from the "// src/palette.js" marker to
// the end of getPackageStyle) so the assertions can't accidentally match an
// unrelated occurrence elsewhere in the 1 MB bundle.
const start = bundle.indexOf('// src/palette.js');
const gpsEnd = bundle.indexOf('__name(getPackageStyle');
assert.ok(start !== -1 && gpsEnd !== -1 && gpsEnd > start, 'palette block not located in bundle');
const block = bundle.slice(start, gpsEnd);

test('bundle copenhagen-modern carries the pale `ground`', () => {
  assert.match(block, /"copenhagen-modern":\s*{[^}]*ground:\s*"C9D6EC"/s);
});

test('bundle defines readableInk + UNIVERSAL_DARK_INK', () => {
  assert.ok(block.includes('var UNIVERSAL_DARK_INK = "283556"'), 'missing UNIVERSAL_DARK_INK');
  assert.ok(/function readableInk\(hex\)/.test(block), 'missing readableInk');
  assert.ok(block.includes('0.2126 * r + 0.7152 * g + 0.0722 * b > 140'), 'missing luminance test');
});

test('getPackageStyle sidebar uses ground + readable ink (not base + white)', () => {
  assert.ok(block.includes('const ground = p.ground || p.base'), 'ground not derived');
  assert.ok(block.includes('sidebarBg: ground'), 'sidebarBg not ground');
  assert.ok(block.includes('sidebarTextColor: readableInk(ground)'), 'sidebar text not readableInk(ground)');
  assert.ok(block.includes('sidebarLabelColor: readableInk(ground)'), 'sidebar label not readableInk(ground)');
  // the stale fallbacks must be gone from getPackageStyle
  assert.ok(!block.includes('sidebarBg: p.base'), 'stale sidebarBg: p.base still present');
  assert.ok(!block.includes('sidebarTextColor: UNIVERSAL_WHITE'), 'stale white sidebar text still present');
  assert.ok(!block.includes('sidebarLabelColor: UNIVERSAL_WHITE'), 'stale white sidebar label still present');
});

test('candidate band keeps base with luminance-picked ink + tableHeaderText', () => {
  assert.ok(block.includes('headerBg: p.base'), 'header band not base');
  assert.ok(block.includes('headerNameColor: readableInk(p.base)'), 'header name not readableInk(base)');
  assert.ok(block.includes('tableHeaderText: readableInk(p.base)'), 'tableHeaderText missing');
});

// Behavioural cross-check against the canonical source: the bundle and
// src/palette.js must agree on copenhagen-modern's resolved style.
test('bundle palette ≡ src/palette.js for copenhagen-modern', async () => {
  const { getPackageStyle } = await import('../src/palette.js');
  const s = getPackageStyle('copenhagen-modern', false);
  assert.equal(s.sidebarBg, 'C9D6EC', 'source ground drifted');
  assert.equal(s.sidebarTextColor, '283556', 'pale ground must yield dark ink');
  assert.equal(s.sidebarLabelColor, '283556', 'pale ground label must be dark');
  assert.equal(s.headerNameColor, 'FFFFFF', 'navy band name must be white');
  assert.equal(s.tableHeaderText, 'FFFFFF', 'navy table header text must be white');
});
