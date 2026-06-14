// meta-founder-strip.test.mjs
// ============================================================
// ROLE-FOUNDER-001 band fix (owner 2026-06-14): the candidate band renders the
// STORED meta.role/meta.subtitle ("Application: Founder & Product / Project
// Expert - Unsolicited"), which the export strip never touches and the import
// never clears. The sections-normalize sidecar now strips Founder/Co-Founder
// from stored meta on load. This verifies the helper + the wiring.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const sidecar = readFileSync(path.join(ROOT, 'antcv-sections-normalize-415.js'), 'utf8');

test('sidecar defines + calls normalizeMeta on every normalize pass', () => {
  assert.ok(sidecar.includes('function normalizeMeta()'), 'missing normalizeMeta');
  assert.ok(sidecar.includes('function cleanFounderStr'), 'missing cleanFounderStr');
  assert.ok(/function normalize\(\)\s*\{\s*try\s*\{\s*normalizeMeta\(\)/.test(sidecar),
    'normalize() does not call normalizeMeta first');
  assert.ok(sidecar.includes("localStorage.getItem('meta')"), 'does not read stored meta');
  assert.ok(sidecar.includes("StorageEvent('storage', { key: 'meta'"), 'does not notify the app of the meta change');
});

// Re-implement the helper exactly as in the sidecar to lock its behaviour.
function cleanFounderStr(s) {
  var x = String(s || '');
  if (!/\bfounder\b/i.test(x)) return x;
  if (/\b(konsulent|consult|independent)\b/i.test(x)) return x;
  return x
    .replace(/\b(co[-\s]?)?founder\b\s*[&/,|]\s*/gi, '')
    .replace(/\s*[&/,|]\s*(co[-\s]?)?founder\b/gi, '')
    .replace(/\b(co[-\s]?)?founder\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/:\s*-\s*/, ': ')
    .trim();
}

test('the application band line loses Founder, keeps the rest', () => {
  assert.equal(cleanFounderStr('Application: Founder & Product / Project Expert - Unsolicited'),
    'Application: Product / Project Expert - Unsolicited');
  assert.equal(cleanFounderStr('Founder & Product / Project Expert'), 'Product / Project Expert');
  assert.equal(cleanFounderStr('Co-Founder, Systems Architect'), 'Systems Architect');
});

test('a genuine consultancy label and a Founder-free line are untouched', () => {
  assert.equal(cleanFounderStr('Independent Consultant - Kanzen konsulenter'),
    'Independent Consultant - Kanzen konsulenter');
  assert.equal(cleanFounderStr('Product / Project Expert'), 'Product / Project Expert');
});
