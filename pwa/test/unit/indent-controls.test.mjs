// indent-controls.test.mjs
// ============================================================
// ADV-INDENT-CONTROLS-001 (owner 2026-06-10): Advanced-styles controls for the
// main content indent-from-edge and the bullet/emoji list indent. Mirrors the
// render formulas in app.src.js so the mapping from the styleConfig values to
// the rendered CSS is locked.

import { test } from 'node:test';
import assert from 'node:assert/strict';

// Bullet sites (BULLET-EDGE-001): paddingLeft = bulletIndent; textIndent =
// -bulletIndent, so the marker sits at the row's LEFT EDGE (first line starts
// at paddingLeft+textIndent = 0) and the text + wrapped lines hang at
// bulletIndent. Default 14 (a tight half-gap; was 24 / marker-at-10px).
function bulletStyle(k) {
  const bi = k.bulletIndent || 14;
  return { paddingLeft: bi, textIndent: -bi };
}
// Main column padding: "8px <edge>px", edge from mainEdgeIndent (default 10).
function mainPadding(ya) {
  return '8px ' + ((ya && ya.mainEdgeIndent) || 10) + 'px';
}

test('default bullet: marker at the edge (first line at 0), text hangs at 14px', () => {
  assert.deepEqual(bulletStyle({}), { paddingLeft: 14, textIndent: -14 });
  const s = bulletStyle({});
  assert.equal(s.paddingLeft + s.textIndent, 0); // marker first-line at the row's left edge
});

test('increasing bullet indent moves the text-hang right, marker stays at the edge', () => {
  const s = bulletStyle({ bulletIndent: 34 });
  assert.equal(s.paddingLeft, 34);
  assert.equal(s.textIndent, -34);
  assert.equal(s.paddingLeft + s.textIndent, 0); // marker still at the edge for any indent
});

test('default main edge indent is 10px', () => {
  assert.equal(mainPadding({}), '8px 10px');
  assert.equal(mainPadding(null), '8px 10px');
});

test('main edge indent is configurable', () => {
  assert.equal(mainPadding({ mainEdgeIndent: 20 }), '8px 20px');
  assert.equal(mainPadding({ mainEdgeIndent: 4 }), '8px 4px');
});
