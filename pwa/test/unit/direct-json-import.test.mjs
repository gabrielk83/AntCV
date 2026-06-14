// direct-json-import.test.mjs
// ============================================================
// DIRECT-JSON-IMPORT-001 (owner 2026-06-14): a dropped JSON profile must import
// VERBATIM - the `sections` block (cv/cl) was being dropped (not in
// ALLOWED_TOP_KEYS) and roles were re-derived from personalInfo.experience by
// the LLM parser, so merges, corrected dates, and new sidebar subsections never
// survived. Fix: allow `sections`, replace cv/cl wholesale, skip the
// experience-plumbing when sections was imported, and never import an
// Availability/notice-period line.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const importer = readFileSync(path.join(ROOT, 'antcv-data-importer.js'), 'utf8');

test("`sections` is an allowed top-level import key", () => {
  const start = importer.indexOf('const ALLOWED_TOP_KEYS');
  const block = importer.slice(start, start + 1100);
  assert.match(block, /'sections'/, 'sections not in ALLOWED_TOP_KEYS');
});

test('the experience-plumbing is skipped when a full sections block was imported', () => {
  assert.ok(importer.includes("filtered.sections ? null : Store.get('personalInfo'"),
    'plumbing does not guard against a direct sections import');
});

test('the parser never imports an Availability / notice-period line', () => {
  assert.ok(/Do NOT extract availability/i.test(importer), 'missing the availability-exclusion rule');
  assert.ok(importer.includes('Available up to 20 hours per week'), 'missing the explicit example');
});
