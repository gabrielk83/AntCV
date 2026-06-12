// spacing-forward.test.mjs
// ============================================================
// ADV-SPACING-CONTROLS-001 (1.50.394 / worker 1.14.60): the Advanced
// spacing sliders forward to the worker ONLY when moved off their PWA
// defaults; untouched defaults forward nothing (export byte-identical).

import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { buildPayload } = await import('../../antcv-docx-client.js');

const payloadFor = (styleConfig) =>
  buildPayload({
    sections: { cv: [
      { id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'P.' },
    ], cl: [] },
    doc: 'cv', personalInfo: { name: 'T' }, styleConfig,
  });

test('off-default spacing values forward on the style object', () => {
  const p = payloadFor({
    bodyEdgePad: 12, sidebarEdgePad: 4, seamGap: 16,
    mainSectionGap: 14, sidebarSectionGap: 2, bodySectionGap: 11,
    candidateGap: 6,
  });
  assert.equal(p.style.bodyEdgePad, 12);
  assert.equal(p.style.sidebarEdgePad, 4);
  assert.equal(p.style.seamGap, 16);
  assert.equal(p.style.mainSectionGap, 14);
  assert.equal(p.style.sidebarSectionGap, 2);
  assert.equal(p.style.bodySectionGap, 11);
  assert.equal(p.style.candidateGap, 6);
});

test('defaults are NOT forwarded (untouched users see no change)', () => {
  const p = payloadFor({
    bodyEdgePad: 8, sidebarEdgePad: 8, seamGap: 0,
    mainSectionGap: 8, sidebarSectionGap: 8, bodySectionGap: 8,
    candidateGap: 3,
  });
  for (const k of ['bodyEdgePad', 'sidebarEdgePad', 'seamGap', 'mainSectionGap', 'sidebarSectionGap', 'bodySectionGap', 'candidateGap']) {
    assert.equal(p.style[k], undefined, `${k} must not forward at default`);
  }
});

test('garbage and out-of-range values are dropped', () => {
  const p = payloadFor({ seamGap: 'lots', candidateGap: -4, bodyEdgePad: 900 });
  assert.equal(p.style.seamGap, undefined);
  assert.equal(p.style.candidateGap, undefined);
  assert.equal(p.style.bodyEdgePad, undefined);
});

test('zero is a valid off-default value (mainSectionGap 0 forwards)', () => {
  const p = payloadFor({ mainSectionGap: 0 });
  assert.equal(p.style.mainSectionGap, 0);
});
