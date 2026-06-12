// queue-r37-strings.test.mjs
// ============================================================
// Owner queue R37 (2026-06-12 night):
//   1. PERF-002 — consensus quorum+timeout (__quorumSettle wired into BOTH
//      consensus waves; Promise.allSettled gone from the consensus block);
//   2. PERF-005 — same-input jd-analysis cache in antcv-overlay.js;
//   3. AUTO-PAGEBREAK follow-up — 📄 buttons show the effective page
//      (auto map read + "ᵃ" suffix);
//   4. EXPORT-PREVIEW-FEATURES-001(d) — legacy-ATS compare sidecar wired;
//   5. GEN-MODELROLE-001 design doc exists.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...p) => readFileSync(path.join(ROOT, ...p), 'utf8');
const src = read('app.src.js');
const bundle = read('app.js');

test('PERF-002 — quorum settle wired into both consensus waves', () => {
  assert.ok(src.includes('__quorumSettle'));
  const block = src.slice(src.indexOf('__quorumSettle'), src.indexOf('Deliberation: only'));
  assert.ok(!/await Promise\.allSettled\(/.test(block), 'consensus waves must not await allSettled');
  assert.ok((block.match(/await __quorumSettle\(/g) || []).length >= 2);
});

test('PERF-005 — jd-analysis same-input cache', () => {
  const ov = read('antcv-overlay.js');
  assert.ok(ov.includes('antcv:jdAnalysisCache'));
  assert.ok(ov.includes('86400000'));
});

test('AUTO-PAGEBREAK follow-up — effective 📄 label in the bundle', () => {
  assert.ok(bundle.includes('autoPagesPreview'));
  assert.ok(bundle.includes('ᵃ'));
});

test('ATS compare sidecar present + wired', () => {
  const s = read('antcv-ats-compare-402.js');
  assert.ok(s.includes('Legacy ATS view'));
  assert.ok(s.includes('antcv-pdf-preview-modal-pager'));
  assert.ok(read('index.html').includes('antcv-ats-compare-402.js?v=1.50.402'));
});

test('GEN-MODELROLE-001 design doc exists', () => {
  assert.ok(existsSync(path.join(ROOT, '..', 'docs', 'plan', 'GEN-MODELROLE-001_design.md')));
});
