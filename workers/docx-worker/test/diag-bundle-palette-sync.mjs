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
  // MOCKUP LOCK 2026-07-22: ground = #DCE5EA (matches the PWA preset sidebarBg,
  // the table banding and the packages-registry --package-base — all copies sync).
  assert.match(block, /"copenhagen-modern":\s*{[^}]*ground:\s*"DCE5EA"/s);
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

test('candidate band uses the brighter `band` blue with luminance-picked ink (COPENHAGEN-BLUE-BRIGHTER-001)', () => {
  // band derives from p.band when present, else p.base (other packages unchanged)
  assert.ok(block.includes('const band = p.band || p.base'), 'band not derived');
  assert.ok(block.includes('headerBg: band'), 'header band not `band`');
  assert.ok(block.includes('headerNameColor: readableInk(band)'), 'header name not readableInk(band)');
  assert.ok(block.includes('tableHeaderBg: band'), 'tableHeaderBg not `band`');
  assert.ok(block.includes('tableHeaderText: readableInk(band)'), 'tableHeaderText missing');
  // parity guard (MAIN-HEADINGS-GREEN-001): main-column section headings use a
  // package's `head` accent when defined, else the dark base.
  assert.ok(block.includes('mainHeadColor: headColor'), 'mainHeadColor must use headColor (head||base)');
  assert.ok(block.includes('const headColor = p.head || p.base'), 'headColor derivation missing');
  // copenhagen carries the brighter band token AND the greenish head accent
  assert.match(block, /"copenhagen-modern":\s*{[^}]*band:\s*"33446F"/s);
  assert.match(block, /"copenhagen-modern":\s*{[^}]*head:\s*"00746E"/s);
  // the old "band keeps base" form must be gone
  assert.ok(!block.includes('headerBg: p.base'), 'stale headerBg: p.base still present');
});

// Behavioural cross-check against the canonical source: the bundle and
// src/palette.js must agree on copenhagen-modern's resolved style.
test('bundle palette ≡ src/palette.js for copenhagen-modern', async () => {
  const { getPackageStyle } = await import('../src/palette.js');
  const s = getPackageStyle('copenhagen-modern', false);
  assert.equal(s.sidebarBg, 'DCE5EA', 'source ground drifted');
  assert.equal(s.sidebarTextColor, '283556', 'pale ground must yield dark ink');
  assert.equal(s.sidebarLabelColor, '283556', 'pale ground label must be dark');
  assert.equal(s.headerBg, '33446F', 'candidate band must be the brighter blue');
  assert.equal(s.tableHeaderBg, '33446F', 'table header must be the brighter blue');
  assert.equal(s.mainHeadColor, '00746E', 'main-column headings use the greenish head accent (MAIN-HEADINGS-GREEN-001)');
  assert.equal(s.headerNameColor, 'FFFFFF', 'band name must stay white on the brighter blue');
  assert.equal(s.tableHeaderText, 'FFFFFF', 'table header text must stay white on the brighter blue');
});
