/* Unit test — ZOOM-FLOOR-001 (owner 2026-07-05)
 * "allow Zoom out down to 10-20 (currently it is down to 35%? than I will be
 * able to give you snapshots of 3-4 preview pages at once."
 *
 * The preview's manual "-" zoom-out button and the mobile pinch-zoom-out
 * gesture both floored at 0.35 (35%). Lowered to 0.1 (10%) so the owner can
 * zoom out far enough to fit multiple CV pages in one screenshot for
 * pagination diagnosis. Source-level check on both app.src.js and the
 * minified app.js mirror — this is deep inside a huge React tree with no
 * existing render harness, so (as with GRAB-ZONE-DISMISS-THRESHOLD-001) the
 * regression lock is a source-string assertion, not a full render test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('app.src.js: the manual zoom-out button floors at 0.1, not the old 0.35', () => {
  const src = readFileSync(path.join(ROOT, 'app.src.js'), 'utf8');
  assert.match(src, /Math\.max\(0\.1,\s*Math\.round\(100 \* \(e - 0\.1\)\) \/ 100\)/);
  assert.equal(/Math\.max\(0\.35,\s*Math\.round\(100 \* \(e - 0\.1\)\) \/ 100\)/.test(src), false, 'old 0.35 floor must be gone');
});

test('app.src.js: the pinch-zoom-out gesture floors at 0.1, matching the button', () => {
  const src = readFileSync(path.join(ROOT, 'app.src.js'), 'utf8');
  assert.match(src, /Math\.max\(0\.1,\s*Math\.min\(5\.2,\s*s \* c\)\)/);
});

test('app.js (minified mirror): both zoom-out floors match app.src.js at 0.1', () => {
  const src = readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  assert.match(src, /Math\.max\(\.1,Math\.round\(100\*\(e-\.1\)\)\/100\)/, 'button floor');
  assert.match(src, /Math\.max\(\.1,Math\.min\(5\.2,s\*c\)\)/, 'pinch floor');
  assert.equal(/Math\.max\(\.35,Math\.round\(100\*\(e-\.1\)\)\/100\)/.test(src), false, 'old 0.35 button floor must be gone from app.js');
  assert.equal(/Math\.max\(\.35,Math\.min\(5\.2,s\*c\)\)/.test(src), false, 'old 0.35 pinch floor must be gone from app.js');
});

test('the zoom-in ceiling (5.2 / 520%) is unchanged in both files', () => {
  const srcFull = readFileSync(path.join(ROOT, 'app.src.js'), 'utf8');
  const srcMin = readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  assert.match(srcFull, /Math\.min\(5\.2, Math\.round\(100 \* \(e \+ 0\.1\)\) \/ 100\)/);
  assert.match(srcMin, /Math\.min\(5\.2,Math\.round\(100\*\(e\+\.1\)\)\/100\)/);
});
