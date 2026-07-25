// SALMON-BREAK-SITE-001 (owner 2026-07-25): the CV preview must paginate BOTH
// columns from the EXPORT map (antcv:autoPages, the Word-calibrated line) so the
// salmon shows the break site the real DOCX/PDF uses. Before this, MAIN read the
// A4-fill preview map (late breaks, or none when the entry was missing) while
// SIDEBAR preferred the force-inflated preview entries (early breaks) - the two
// columns' salmons disagreed with each other and with the export in opposite
// directions. The CL keeps its preview-first order (continuous flow, one column).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(dir, 'app.src.js'), 'utf8');
const MIN = readFileSync(join(dir, 'app.js'), 'utf8');

function autoPbBody(s, marker) {
  const i = s.indexOf(marker);
  assert.ok(i > 0, 'SALMON-BREAK-SITE-001 marker present near ' + marker.slice(0, 30));
  return s.slice(i, i + 3200);
}

test('app.src.js: CV branch reads the EXPORT map before the preview map', () => {
  const body = autoPbBody(SRC, 'SALMON-BREAK-SITE-001 (owner 2026-07-25 "fix the salmon');
  const exp = body.indexOf('antcv:autoPages"');
  const prev = body.indexOf('antcv:autoPagesPreview');
  assert.ok(exp > 0 && prev > 0 && exp < prev, 'export map consulted first in the CV branch');
  // the 1.50.318 main-column bail (no break at all) is gone
  assert.ok(!/if \(!isSidebar\) return \{\};/.test(SRC), 'CV main no-break bail removed');
});

test('app.js mirror: same order, same semantics', () => {
  const body = autoPbBody(MIN, 'SALMON-BREAK-SITE-001 (owner 2026-07-25): CV displays BOTH columns');
  const exp = body.indexOf('antcv:autoPages"');
  const prev = body.indexOf('antcv:autoPagesPreview');
  assert.ok(exp > 0 && prev > 0 && exp < prev, 'export map consulted first in the minified CV branch');
  assert.ok(!/"sidebar"===_f\.loc/.test(MIN), 'old sidebar-only fallback gone from the mirror');
});

test('page label follows the same effective bucket as the salmon (both bundles)', () => {
  assert.match(SRC, /the label must read the SAME effective bucket/i);
  assert.match(SRC, /const b = __antcvAutoPB\(sid\);/);
  const oMark = MIN.indexOf('SALMON-BREAK-SITE-001: label reads the SAME effective bucket');
  assert.ok(oMark > 0, 'minified label carries the unified logic');
});

test('CL keeps preview-first pagination (continuous flow untouched)', () => {
  const body = autoPbBody(SRC, 'SALMON-BREAK-SITE-001 (owner 2026-07-25 "fix the salmon');
  // after the CV early-return, the CL path still prefers the preview map entry
  const clPart = body.slice(body.indexOf('const prevRaw'));
  assert.ok(clPart.indexOf('antcv:autoPagesPreview') >= 0 && clPart.indexOf('antcv:autoPages"') > clPart.indexOf('antcv:autoPagesPreview'), 'CL: preview entry first, export fallback second');
});

test('salmon splitter itself is untouched (PERMANENT rule)', () => {
  assert.match(SRC, /const __antcvSalmon = \(pg, contTitle\) =>/);
  assert.ok(MIN.includes('__antcvSalmon') || MIN.includes('pb_'), 'splitter present in the bundle');
});
