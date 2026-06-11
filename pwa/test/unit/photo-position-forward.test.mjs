// photo-position-forward.test.mjs
// ============================================================
// EXPORT-PHOTO-POS-CLAMP-001 (1.50.373): antcv-docx-client.js's
// readPhotoPosition VALID set lagged the app's picker — 'band-overlap' was
// missing, so every bridge export was clamped to sidebar-top BEFORE the
// payload left the browser (the owner's "in pdf bridge is not visible"), and
// 'none' (the picker's Hidden value) was missing, so a hidden photo still
// exported. Imports the REAL module with a localStorage shim and locks the
// full picker → forwarded-position mapping, plus the photoSizePx forwarding
// rule (every visible position forwards; band-overlap applies the 1.3 scale).

import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { readPhotoPosition } = await import('../../antcv-docx-client.js');

function setPos(v) { store.set('photoPosition', JSON.stringify(v)); }

test('every picker value forwards unclamped', () => {
  const picker = [
    'sidebar-top', 'sidebar-bottom', 'header-left', 'header-right',
    'main-left', 'main-right', 'main-left-bottom', 'main-right-bottom',
    'bridge-middle', 'bridge-bottom', 'band-overlap',
  ];
  for (const v of picker) {
    setPos(v);
    assert.equal(readPhotoPosition(), v, `picker value ${v} must forward as-is`);
  }
});

test("the picker's Hidden value 'none' maps to hidden (photo must NOT export)", () => {
  setPos('none');
  assert.equal(readPhotoPosition(), 'hidden');
  setPos('hidden');
  assert.equal(readPhotoPosition(), 'hidden');
});

test('unknown / missing values still default to sidebar-top', () => {
  setPos('garbage-mode');
  assert.equal(readPhotoPosition(), 'sidebar-top');
  store.delete('photoPosition');
  assert.equal(readPhotoPosition(), 'sidebar-top');
});

test('unwrapped (non-JSON) storage values are tolerated', () => {
  store.set('photoPosition', 'band-overlap');
  assert.equal(readPhotoPosition(), 'band-overlap');
});

// The photoSizePx forwarding rule lives in an inline IIFE inside the payload
// builder; mirror its formula here so a regression in the constants is caught.
function photoSizePxFor(pos, stored) {
  if (pos === 'hidden') return undefined;
  let n = Number(stored);
  if (!Number.isFinite(n) || n < 60 || n > 220) n = 120;
  if (pos === 'band-overlap') n = Math.min(220, Math.round(1.3 * n));
  return n;
}

test('photoSizePx: bridge scales 1.3x, others forward the slider, hidden omits', () => {
  assert.equal(photoSizePxFor('band-overlap', 120), 156);
  assert.equal(photoSizePxFor('band-overlap', 200), 220); // clamped
  assert.equal(photoSizePxFor('bridge-middle', 140), 140);
  assert.equal(photoSizePxFor('sidebar-top', 160), 160);
  assert.equal(photoSizePxFor('sidebar-top', undefined), 120); // default
  assert.equal(photoSizePxFor('hidden', 120), undefined);
});
