// export-pdf-panel-worker.test.mjs
// ============================================================
// EXPORT-PDF-PANEL-WORKER-001 (owner 2026-07-18, live report): with a side
// panel open (e.g. the Analysis tab), "Save as PDF" gave the browser PRINTER
// export instead of the Cloudflare docx-worker (/generate-pdf).
//
// Root cause: the app's PDF export button (`button[title^="Export as PDF"]`)
// only mounts inside the `"preview" === ei` action bar (app.src.js). On the
// Analysis / Sections / Edit tab that bar is unmounted, so the preview modal's
// Save-as-PDF `document.querySelector('button[title^="Export as PDF"]')`
// returned null and dropped straight to iframe/browser print — even though the
// CloudConvert worker was fully available. DOCX never had this bug because
// triggerDocxExport() already calls the worker directly when the app button is
// missing. The fix mirrors that for PDF: call window.exportPdfViaWorker directly
// (payload rebuilt from storage), honouring the app's server-PDF policy
// (window.__antcvUseServerPdf, exposed from app.js/app.src.js), and only fall
// back to browser print when server PDF is genuinely unavailable/fails.
//
// Source-level regression lock (no browser needed): proves the direct-worker
// PDF fallback exists in the preview gate and that the policy hooks are exposed
// from BOTH app.js and its de-minified source.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PWA = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const gate = readFileSync(join(PWA, 'antcv-pdf-preview-gate.js'), 'utf8');
const app = readFileSync(join(PWA, 'app.js'), 'utf8');
const src = readFileSync(join(PWA, 'app.src.js'), 'utf8');

test('preview gate carries the EXPORT-PDF-PANEL-WORKER-001 fix', () => {
  assert.ok(gate.includes('EXPORT-PDF-PANEL-WORKER-001'), 'fix marker must be present in the gate');
});

test('the PDF fallback calls exportPdfViaWorker directly (not only browser print)', () => {
  // The Save-as-PDF handler must reach the worker when the app button is absent.
  assert.ok(gate.includes('window.exportPdfViaWorker'), 'gate must invoke window.exportPdfViaWorker');
  assert.ok(gate.includes('buildExportPayloadFromStorage'), 'gate must rebuild the export payload from storage for the direct call');
});

test('the direct PDF path is ordered BEFORE the browser-print fallback', () => {
  // exportPdfViaWorker (the worker route) must be attempted before iframePrint()
  // is reached as the last resort, so an available worker always wins.
  const idxWorker = gate.indexOf('window.exportPdfViaWorker(payload)');
  const idxIframeFallback = gate.lastIndexOf('iframePrint()');
  assert.ok(idxWorker !== -1, 'the direct worker call must exist');
  assert.ok(idxIframeFallback !== -1, 'the browser-print fallback must still exist');
  assert.ok(idxWorker < idxIframeFallback, 'worker route must be tried before the final browser-print fallback');
});

test('the direct PDF path honours the app server-PDF policy', () => {
  assert.ok(gate.includes('window.__antcvUseServerPdf'), 'gate must consult window.__antcvUseServerPdf so BYOK-on-shared-demo stays on browser print');
});

test('the from-storage payload carries the DEMO watermark for demo users', () => {
  assert.ok(gate.includes('window.__antcvDemoActive'), 'payload builder must read demo state');
  assert.match(gate, /watermark:\s*demo\s*\?\s*'DEMO'\s*:\s*''/, 'payload must set the DEMO watermark when demo is active');
});

test('app.js exposes the policy + demo hooks on window (minified mirror)', () => {
  assert.ok(app.includes('window.__antcvUseServerPdf=he'), 'app.js must expose __antcvUseServerPdf (he)');
  assert.ok(app.includes('window.__antcvDemoActive=me'), 'app.js must expose __antcvDemoActive (me)');
});

test('app.src.js mirrors the window exposure (source in sync)', () => {
  assert.ok(src.includes('window.__antcvUseServerPdf = __antcvUseServerPdf'), 'app.src.js must expose __antcvUseServerPdf');
  assert.ok(src.includes('window.__antcvDemoActive = __antcvDemoActive'), 'app.src.js must expose __antcvDemoActive');
});
