// analysis-print-surface.test.mjs
// ============================================================
// JD-ANALYSIS-PRINT-001 (register row 44): "Download analysis (PDF)" printed the
// CV instead of the JD analysis. Root cause: the analysis report was rendered into
// a visibility:hidden / 0x0 iframe, and Chrome's iframe.contentWindow.print() on an
// unlaid-out iframe falls back to printing the TOP-LEVEL page (the CV preview). The
// fix keeps the iframe render-present but offscreen so print() targets it.
// This is a source-level regression lock (no browser needed).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const src = await readFile(new URL('../../antcv-analysis-report-pdf-360.js', import.meta.url), 'utf8');

// Isolate the print-iframe style line.
const m = src.match(/iframe\.style\.cssText\s*=\s*'([^']*)'/);
test('the print iframe style line exists', () => {
  assert.ok(m, 'iframe.style.cssText assignment must be present');
});

test('the print iframe is NOT visibility:hidden and NOT zero-sized (would print the parent CV)', () => {
  const css = (m && m[1]) || '';
  assert.ok(!/visibility\s*:\s*hidden/.test(css), 'must not use visibility:hidden');
  assert.ok(!/width\s*:\s*0(?:px|;|$)/.test(css), 'must not set width:0');
  assert.ok(!/height\s*:\s*0(?:px|;|$)/.test(css), 'must not set height:0');
});

test('the print iframe is render-present but offscreen (has a real size, moved offscreen)', () => {
  const css = (m && m[1]) || '';
  assert.ok(/width\s*:\s*\d{2,}/.test(css), 'iframe must have a real width so it lays out');
  assert.ok(/height\s*:\s*\d{2,}/.test(css), 'iframe must have a real height so it lays out');
  assert.ok(/left\s*:\s*-?\d{4,}px/.test(css), 'iframe must be pushed offscreen (large negative left)');
});
