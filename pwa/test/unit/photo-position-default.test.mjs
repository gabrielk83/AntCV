// photo-position-default.test.mjs
// ============================================================
// PHOTO-BRIDGE-DEFAULT-PARITY-001 (owner 2026-06-15): the owner saw the bridge
// in PREVIEW but DOCX/PDF exported the photo at sidebar-top ("non-float bridge
// not working differently"). Root cause: when photoPosition is unset, the
// preview defaults package-aware (copenhagen-modern → band-overlap) but the
// export's readPhotoPosition defaulted flat to sidebar-top. This locks the
// export default to mirror the preview.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { readPhotoPosition } = await import('../../antcv-docx-client.js');

function set(photoPosition, stylePackage) {
  store.clear();
  if (photoPosition !== undefined) store.set('photoPosition', JSON.stringify(photoPosition));
  if (stylePackage !== undefined) store.set('stylePackage', JSON.stringify(stylePackage));
}

test('unset photoPosition + unset package → band-overlap (copenhagen default)', () => {
  set(undefined, undefined);
  assert.equal(readPhotoPosition(), 'band-overlap');
});

test('unset photoPosition + copenhagen-modern → band-overlap', () => {
  set(undefined, 'copenhagen-modern');
  assert.equal(readPhotoPosition(), 'band-overlap');
});

test("unset photoPosition + 'scandinavian' alias → band-overlap", () => {
  set(undefined, 'scandinavian');
  assert.equal(readPhotoPosition(), 'band-overlap');
});

test('unset photoPosition + non-copenhagen package → sidebar-top', () => {
  set(undefined, 'navy-executive');
  assert.equal(readPhotoPosition(), 'sidebar-top');
});

test('explicit sidebar-top wins even on copenhagen', () => {
  set('sidebar-top', 'copenhagen-modern');
  assert.equal(readPhotoPosition(), 'sidebar-top');
});

test('explicit band-overlap is honored', () => {
  set('band-overlap', 'navy-executive');
  assert.equal(readPhotoPosition(), 'band-overlap');
});

test("'none' maps to hidden (never falls to the package default)", () => {
  set('none', 'copenhagen-modern');
  assert.equal(readPhotoPosition(), 'hidden');
});
