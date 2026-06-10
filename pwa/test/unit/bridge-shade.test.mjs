// bridge-shade.test.mjs
// ============================================================
// BRIDGE-SIDEBAR-PALETTE-001 (owner 2026-06-10): in bridge mode
// (photoPosition === 'band-overlap') the preview sidebar bg is shifted
// slightly BRIGHTER and the headings/text/lines slightly DARKER. Mirror of the
// __antcvShadeHex helper in app.src.js so the colour math is locked.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const shade = (hex, amt) => {
  let h = String(hex || '').trim().replace(/^#/, '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (h.length !== 6) return hex;
  const f = parseInt(h, 16);
  const t = amt < 0 ? 0 : 255;
  const p = Math.abs(amt) / 100;
  const r = (f >> 16) & 255, g = (f >> 8) & 255, b = f & 255;
  const ch = (c) => Math.round((t - c) * p) + c;
  return '#' + (0x1000000 + (ch(r) << 16) + (ch(g) << 8) + ch(b)).toString(16).slice(1);
};

test('lighten navy bg moves toward white (brighter)', () => {
  const out = shade('#283556', 12);
  // each channel should increase
  const navy = [0x28, 0x35, 0x56];
  const got = [1, 3, 5].map((i) => parseInt(out.slice(i, i + 2), 16));
  got.forEach((c, i) => assert.ok(c > navy[i], `channel ${i} ${c} > ${navy[i]}`));
});

test('darken teal accent moves toward black (deeper)', () => {
  const out = shade('#01B7BB', -18);
  const teal = [0x01, 0xB7, 0xBB];
  const got = [1, 3, 5].map((i) => parseInt(out.slice(i, i + 2), 16));
  got.forEach((c, i) => assert.ok(c <= teal[i], `channel ${i} ${c} <= ${teal[i]}`));
  assert.ok(parseInt(out.slice(3, 5), 16) < 0xB7); // green clearly darker
});

test('white text nudged slightly darker stays light-grey', () => {
  const out = shade('#FFFFFF', -8).toLowerCase();
  assert.notEqual(out, '#ffffff');
  assert.ok(parseInt(out.slice(1, 3), 16) >= 0xE0); // still near-white, just off
});

test('amount 0 is identity; invalid hex passes through', () => {
  assert.equal(shade('#283556', 0), '#283556');
  assert.equal(shade('not-a-hex', 12), 'not-a-hex');
});

test('3-digit hex is expanded', () => {
  assert.equal(shade('#fff', 0), '#ffffff');
});
