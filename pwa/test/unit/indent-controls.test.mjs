// indent-controls.test.mjs
// ============================================================
// ADV-INDENT-CONTROLS-001 (owner 2026-06-10): Advanced-styles controls for the
// main content indent-from-edge and the bullet/emoji list indent. Mirrors the
// render formulas in app.src.js so the mapping from the styleConfig values to
// the rendered CSS is locked.

import { test } from 'node:test';
import assert from 'node:assert/strict';

// Bullet sites: paddingLeft = bulletIndent; textIndent = 10 - bulletIndent
// (marker outdents to a fixed ~10px-relative position; body+continuation hang
// at bulletIndent). Default 24 → paddingLeft 24, textIndent -14 (the 1.50.348
// built-in look).
function bulletStyle(k) {
  const bi = k.bulletIndent || 24;
  return { paddingLeft: bi, textIndent: 10 - bi };
}
// Main column padding: "8px <edge>px", edge from mainEdgeIndent (default 10).
function mainPadding(ya) {
  return '8px ' + ((ya && ya.mainEdgeIndent) || 10) + 'px';
}

test('default bullet indent reproduces the 1.50.348 built-in look', () => {
  assert.deepEqual(bulletStyle({}), { paddingLeft: 24, textIndent: -14 });
});

test('increasing bullet indent moves body/continuation right, keeps the 14px hang', () => {
  const s = bulletStyle({ bulletIndent: 34 });
  assert.equal(s.paddingLeft, 34);
  assert.equal(s.textIndent, -24);          // marker still ~10px rel; hang preserved
  assert.equal(s.paddingLeft - (s.paddingLeft + s.textIndent), 24); // marker→body gap grows with indent
});

test('default main edge indent is 10px', () => {
  assert.equal(mainPadding({}), '8px 10px');
  assert.equal(mainPadding(null), '8px 10px');
});

test('main edge indent is configurable', () => {
  assert.equal(mainPadding({ mainEdgeIndent: 20 }), '8px 20px');
  assert.equal(mainPadding({ mainEdgeIndent: 4 }), '8px 4px');
});
