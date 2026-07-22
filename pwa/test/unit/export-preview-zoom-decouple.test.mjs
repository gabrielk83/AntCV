// export-preview-zoom-decouple.test.mjs
// ============================================================
// EXPORT-PREVIEW-ZOOM-DECOUPLE-001 (owner 2026-07-22): the export-preview modal
// (antcv-pdf-preview-gate.js) clones each live .antcv-preview-paper via
// p.outerHTML. The live editor bakes its zoom onto that paper as an INLINE
// `transform: scale(<editor-zoom>)` (app.src.js ~51102), so the clone inherited
// the editor zoom — changing the editor zoom rescaled the export preview, and it
// stacked on top of the modal's own fit zoom, desyncing the page-row layout and
// chopping pages to ~half. The fix adds a `!important` CSS override in the modal's
// srcdoc <style> that neutralises the inherited inline transform so the preview
// starts at natural 100% and does its own independent fit.
//
// Source-level regression lock (no browser needed): proves the override exists in
// the srcdoc stylesheet and targets .antcv-preview-paper with !important (which is
// what beats the inline transform in the cascade).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PWA = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const gate = readFileSync(join(PWA, 'antcv-pdf-preview-gate.js'), 'utf8');

test('the gate carries the zoom-decouple fix marker', () => {
  assert.ok(gate.includes('EXPORT-PREVIEW-ZOOM-DECOUPLE-001'), 'fix marker present');
});

test('the srcdoc neutralises the inherited paper transform with !important', () => {
  // Must override the inline transform:scale(editorZoom) the clone inherits.
  assert.match(
    gate,
    /\.antcv-preview-paper\s*\{[^}]*transform:\s*none\s*!important/,
    'a .antcv-preview-paper { transform: none !important } rule must exist so the inline editor-zoom transform loses the cascade',
  );
});

test('the fit path still scales via body zoom (--antcv-fit), not the paper transform', () => {
  // The export preview does its OWN fit via body zoom; the decouple must not
  // remove that independent mechanism.
  assert.ok(gate.includes('--antcv-fit'), 'the independent fit zoom var must remain');
  assert.match(gate, /body\.antcv-fit-width\s*\{\s*zoom:\s*var\(--antcv-fit/, 'fit is applied as body zoom, decoupled from the paper transform');
});
