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
  const nearby = src.slice(idx, idx + 5000); // SCROLL-TARGET-002 comment block sits before the forward
  assert.match(nearby, /nextElementSibling/, 'scroll-forward reads the active tab content via nextElementSibling');
  assert.match(nearby, /scrollTop\s*-=/, 'scroll-forward writes scrollTop by a delta');
});

test('source: minified app.js mirrors the scroll-forward fix', () => {
  const src = readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  const idx = src.indexOf('antcv-panel-grab-zone');
  const nearby = src.slice(idx, idx + 1200);
  assert.match(nearby, /nextElementSibling/, 'scroll-forward present in app.js (minified mirror)');
  assert.match(nearby, /scrollTop-=/, 'scroll-forward writes scrollTop in app.js (minified mirror)');
});

/* GRAB-ZONE-SCROLL-TARGET-002 (desktop nightly 2026-10-16, found by the headless touch
 * probe pwa/test/diag-mobile-grab-zone-touch.mjs): on the Analysis tab the handle's
 * nextElementSibling is the "Generate a CV first" placeholder that
 * antcv-analysis-panel-jd-block-356.js hides (display:none), and the real content is the
 * sibling AFTER it — the SCROLL-FORWARD-001 delta went to a hidden node, so the Analysis
 * panel still did not scroll from the handle (the owner's original symptom). The forward
 * now walks to the first displayed sibling that overflows, falling back to the panel. */
function pickScroller(handle) {
  let s = handle.nextElementSibling;
  while (s && (s.display === 'none' || s.scrollHeight <= s.clientHeight + 1)) s = s.nextElementSibling;
  return s || handle.parentElement;
}
const node = (o, next) => ({ display: 'block', clientHeight: 100, scrollHeight: 100, nextElementSibling: next || null, ...o });

test('GRAB-ZONE-SCROLL-TARGET-002: Sections tab — the direct overflowing sibling is still the target', () => {
  const content = node({ name: 'sections', scrollHeight: 970 });
  const handle = { nextElementSibling: content, parentElement: node({ name: 'panel' }) };
  assert.equal(pickScroller(handle).name, 'sections');
});

test('GRAB-ZONE-SCROLL-TARGET-002: Analysis tab — skips the hidden placeholder and targets the content after it', () => {
  const content = node({ name: 'analysis', clientHeight: 137, scrollHeight: 218 });
  const hidden = node({ name: 'jd-empty-hidden', display: 'none', clientHeight: 0, scrollHeight: 0 }, content);
  const handle = { nextElementSibling: hidden, parentElement: node({ name: 'panel' }) };
  assert.equal(pickScroller(handle).name, 'analysis');
});

test('GRAB-ZONE-SCROLL-TARGET-002: a displayed but non-overflowing sibling is skipped too', () => {
  const content = node({ name: 'tall', scrollHeight: 500 });
  const flat = node({ name: 'flat' }, content);
  const handle = { nextElementSibling: flat, parentElement: node({ name: 'panel' }) };
  assert.equal(pickScroller(handle).name, 'tall');
});

test('GRAB-ZONE-SCROLL-TARGET-002: nothing scrollable after the handle -> the panel itself (overflow-y:auto since MOB-008)', () => {
  const handle = { nextElementSibling: node({ name: 'flat' }), parentElement: node({ name: 'panel' }) };
  assert.equal(pickScroller(handle).name, 'panel');
});

test('source: app.src.js carries the SCROLL-TARGET-002 walk (display check + panel fallback) near the grab-zone', () => {
  const src = readFileSync(path.join(ROOT, 'app.src.js'), 'utf8');
  const idx = src.indexOf('antcv-panel-grab-zone');
  const nearby = src.slice(idx, idx + 5000);
  assert.match(nearby, /GRAB-ZONE-SCROLL-TARGET-002/, 'marker comment present');
  assert.match(nearby, /"none" === getComputedStyle\(scroller\)\.display/, 'hidden-sibling skip present in app.src.js');
  assert.match(nearby, /scroller \|\| \(scroller = e\.currentTarget\.parentElement\)/, 'panel fallback present in app.src.js');
});

test('source: minified app.js mirrors the SCROLL-TARGET-002 walk', () => {
  const src = readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  const idx = src.indexOf('antcv-panel-grab-zone');
  const nearby = src.slice(idx, idx + 1200);
  assert.match(nearby, /"none"===getComputedStyle\(scroller\)\.display/, 'hidden-sibling skip present in app.js');
  assert.match(nearby, /scroller\|\|\(scroller=e\.currentTarget\.parentElement\)/, 'panel fallback present in app.js');
  assert.equal(/const scroller=e\.currentTarget\.nextElementSibling;scroller&&ly/.test(nearby), false, 'the old direct-sibling-only forward must be gone');
});
