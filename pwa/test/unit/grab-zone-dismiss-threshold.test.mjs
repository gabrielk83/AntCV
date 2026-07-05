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
  const nearby = src.slice(idx, idx + 3200);
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

/* GRAB-ZONE-SCROLL-FORWARD-001 (owner 2026-07-05 follow-up): raising the
 * dismiss threshold alone did not restore scrolling — touchAction:"none" on
 * the handle blocks the browser's OWN native scroll for any touch that
 * starts there, independent of the JS threshold. Fix forwards the
 * incremental per-move delta to the active tab's scrollable content (its
 * next DOM sibling) whenever the gesture hasn't crossed the dismiss
 * threshold, in either direction.
 */
function scrollForwardDelta(startY, lastY, currentY) {
  const t = Number(startY || 0);
  const ly = Number(lastY || t);
  const n = currentY;
  if (t && n - t > 80) return { dismiss: true, delta: 0 };
  return { dismiss: false, delta: t && ly ? -(n - ly) : 0 };
}

test('GRAB-ZONE-SCROLL-FORWARD-001: a downward graze forwards a negative scrollTop delta (scrolls toward top)', () => {
  const r = scrollForwardDelta(100, 100, 115);
  assert.equal(r.dismiss, false);
  assert.equal(r.delta, -15);
});

test('GRAB-ZONE-SCROLL-FORWARD-001: an upward drag forwards a positive scrollTop delta (scrolls toward bottom)', () => {
  const r = scrollForwardDelta(100, 100, 85);
  assert.equal(r.dismiss, false);
  assert.equal(r.delta, 15);
});

test('GRAB-ZONE-SCROLL-FORWARD-001: incremental moves compound correctly across multiple touchmove events', () => {
  let ly = 100;
  const start = 100;
  let total = 0;
  for (const n of [110, 125, 130]) {
    const r = scrollForwardDelta(start, ly, n);
    assert.equal(r.dismiss, false);
    total += r.delta;
    ly = n;
  }
  assert.equal(total, -30, 'three incremental moves (10+15+5=30px down) sum to -30 scrollTop delta');
});

test('GRAB-ZONE-SCROLL-FORWARD-001: crossing the dismiss threshold reports dismiss and no further scroll delta', () => {
  const r = scrollForwardDelta(100, 170, 185);
  assert.equal(r.dismiss, true);
  assert.equal(r.delta, 0);
});

test('source: app.src.js forwards scroll via nextElementSibling.scrollTop near the grab-zone', () => {
  const src = readFileSync(path.join(ROOT, 'app.src.js'), 'utf8');
  const idx = src.indexOf('antcv-panel-grab-zone');
  const nearby = src.slice(idx, idx + 3200);
  assert.match(nearby, /nextElementSibling/, 'scroll-forward reads the active tab content via nextElementSibling');
  assert.match(nearby, /scrollTop\s*-=/, 'scroll-forward writes scrollTop by a delta');
});

test('source: minified app.js mirrors the scroll-forward fix', () => {
  const src = readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  const idx = src.indexOf('antcv-panel-grab-zone');
  const nearby = src.slice(idx, idx + 700);
  assert.match(nearby, /nextElementSibling/, 'scroll-forward present in app.js (minified mirror)');
  assert.match(nearby, /scrollTop-=/, 'scroll-forward writes scrollTop in app.js (minified mirror)');
});
