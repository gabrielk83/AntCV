// PHOTO-FLIP-001 — decision-logic tests for the Flip control (off / on / auto).
// Verifies resolveExportFlipH(), the pure rule SHARED by the preview sidecar
// (antcv-photo-ui-427 MODULE D) and the DOCX/PDF export (antcv-docx-client).
// The rule: off→never, on→always, auto→flip only when the detected facing
// points AWAY from the content (content side derived from photoPosition +
// sidebarPosition). Mode + facing live in STANDALONE keys (antcv:photoFlip /
// antcv:photoFacing) so Reset-all / cloud-restore can't wipe them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveExportFlipH } from './antcv-docx-client.js';

// Minimal localStorage shim (the fallback rule reads it directly; `window` is
// undefined in Node so window.__antcvResolvePhotoFlipH is never consulted).
function withStore(map, fn) {
  const store = new Map(Object.entries(map));
  global.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  try { return fn(); } finally { delete global.localStorage; }
}
// Build the standalone-key store for a given flip mode + detected facing.
const flip = (mode, facing) => {
  const o = {};
  if (mode != null) o['antcv:photoFlip'] = mode;
  if (facing != null) o['antcv:photoFacing'] = facing;
  return o;
};

test('off → never flips (even with a facing)', () => {
  withStore({ ...flip('off', 'left'), sidebarPosition: 'left' }, () => {
    assert.equal(resolveExportFlipH(), false);
  });
});

test('missing / default mode → no flip', () => {
  withStore({ ...flip(null, 'left') }, () => {
    assert.equal(resolveExportFlipH(), false);
  });
});

test('on → always flips regardless of facing/position', () => {
  withStore({ ...flip('on', null) }, () => {
    assert.equal(resolveExportFlipH(), true);
  });
});

test('auto + unknown facing → no flip (safe)', () => {
  withStore({ ...flip('auto', 'unknown'), sidebarPosition: 'left' }, () => {
    assert.equal(resolveExportFlipH(), false);
  });
});

test('auto + center facing → no flip', () => {
  withStore({ ...flip('auto', 'center'), sidebarPosition: 'left' }, () => {
    assert.equal(resolveExportFlipH(), false);
  });
});

test('auto, left sidebar (content on right): faces right → already faces content → no flip', () => {
  withStore({ ...flip('auto', 'right'), sidebarPosition: 'left' }, () => {
    assert.equal(resolveExportFlipH(), false);
  });
});

test('auto, left sidebar (content on right): faces left → away → FLIP', () => {
  withStore({ ...flip('auto', 'left'), sidebarPosition: 'left' }, () => {
    assert.equal(resolveExportFlipH(), true);
  });
});

test('auto, right sidebar (content on left): faces left → already faces content → no flip', () => {
  withStore({ ...flip('auto', 'left'), sidebarPosition: 'right' }, () => {
    assert.equal(resolveExportFlipH(), false);
  });
});

test('auto, right sidebar (content on left): faces right → away → FLIP', () => {
  withStore({ ...flip('auto', 'right'), sidebarPosition: 'right' }, () => {
    assert.equal(resolveExportFlipH(), true);
  });
});

test('auto, header-right position (content on left) overrides sidebar: faces right → FLIP', () => {
  withStore({ ...flip('auto', 'right'), photoPosition: 'header-right', sidebarPosition: 'left' }, () => {
    assert.equal(resolveExportFlipH(), true);
  });
});

test('auto, main-left position (content on right): faces right → no flip', () => {
  withStore({ ...flip('auto', 'right'), photoPosition: 'main-left', sidebarPosition: 'right' }, () => {
    assert.equal(resolveExportFlipH(), false);
  });
});

test('auto tolerates JSON-wrapped position/sidebar values', () => {
  withStore({ ...flip('auto', 'left'), photoPosition: JSON.stringify('sidebar-top'), sidebarPosition: JSON.stringify('left') }, () => {
    assert.equal(resolveExportFlipH(), true); // sidebar left → content right → faces left → flip
  });
});
