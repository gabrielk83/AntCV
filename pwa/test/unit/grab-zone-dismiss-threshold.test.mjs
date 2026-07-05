/* Unit test — GRAB-ZONE-DISMISS-THRESHOLD-001 (owner 2026-07-05)
 * "sliding down with finger in the analysis and section panels is not
 * working in android. contact section panel collapses the entire cand[idate]."
 *
 * Root cause: the mobile bottom panel's sticky drag handle
 * (.antcv-panel-grab-zone in app.src.js, mirrored in app.js) is only 28px
 * tall AND used the SAME 28px value as its own swipe-down-to-dismiss
 * threshold. Since it sits directly above the scrollable per-tab content
 * (Sections/Edit/Analysis), a touch that starts on or barely clips this
 * strip reads any small downward slide as "dismiss the whole panel back to
 * preview" instead of letting the gesture reach the scrollable content
 * below — which is exactly "scroll doesn't work" + "the Contact section
 * collapses the entire candidate" (dismissing returns to the "preview" tab,
 * hiding the whole candidate editor, not just one section).
 *
 * Fix: raise the dismiss threshold well past an incidental graze/scroll-start
 * (28 -> 80) so only a clear, deliberate swipe-down closes the panel.
 *
 * Two guards: (1) the inline decision logic, mirroring app.src.js exactly;
 * (2) a source-level check that BOTH app.src.js and the minified app.js
 * actually carry the new threshold — this file is too large/DOM-coupled for
 * a full render test, so the source check is the drift guard.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// Inline the guard logic matching app.src.js GRAB-ZONE-DISMISS-THRESHOLD-001 exactly.
function shouldDismiss(startY, currentY) {
  const t = Number(startY || 0);
  const n = currentY;
  return !!(t && n - t > 80);
}

test('GRAB-ZONE-DISMISS-THRESHOLD-001: the old 28px threshold no longer dismisses', () => {
  assert.equal(shouldDismiss(100, 129), false, '29px slide (just past the OLD threshold) must not dismiss');
});

test('GRAB-ZONE-DISMISS-THRESHOLD-001: a typical scroll-start graze (~40-60px) does not dismiss', () => {
  assert.equal(shouldDismiss(100, 140), false, '40px');
  assert.equal(shouldDismiss(100, 160), false, '60px');
});

test('GRAB-ZONE-DISMISS-THRESHOLD-001: a clear deliberate swipe-down (>80px) still dismisses', () => {
  assert.equal(shouldDismiss(100, 181), true, '81px slide dismisses');
  assert.equal(shouldDismiss(100, 220), true, '120px slide dismisses');
});

test('GRAB-ZONE-DISMISS-THRESHOLD-001: no start position recorded -> never dismisses', () => {
  assert.equal(shouldDismiss(0, 500), false);
});

test('source: app.src.js carries the new n - t > 80 threshold, not the old 28', () => {
  const src = readFileSync(path.join(ROOT, 'app.src.js'), 'utf8');
  const idx = src.indexOf('antcv-panel-grab-zone');
  assert.ok(idx > 0, 'grab-zone must exist');
  const nearby = src.slice(idx, idx + 2200);
  assert.match(nearby, /n\s*-\s*t\s*>\s*80/, 'threshold raised to 80 in app.src.js');
  assert.equal(/n\s*-\s*t\s*>\s*28\b/.test(nearby), false, 'old 28px threshold must be gone');
});

test('source: minified app.js mirrors the same n-t>80 threshold', () => {
  const src = readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  const idx = src.indexOf('antcv-panel-grab-zone');
  assert.ok(idx > 0, 'grab-zone must exist in the minified mirror');
  const nearby = src.slice(idx, idx + 700);
  assert.match(nearby, /n-t>80/, 'threshold raised to 80 in app.js (minified mirror)');
  assert.equal(/n-t>28\b/.test(nearby), false, 'old 28px threshold must be gone from app.js');
});
