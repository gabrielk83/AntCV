// owner-batch-0612-strings.test.mjs
// ============================================================
// String-presence locks for the 2026-06-12 PM owner batch — the prompt and
// skeleton halves live inside the minified app.js, so (like the CL-GHOST
// neutrality check) we assert the built bundle carries the contracts:
//   1. EXP-HIDDEN-ROLES-001 part B: the STORED WORK HISTORY prompt demands
//      EVERY role returned (irrelevant ones on:false, never dropped);
//   2. QUICK-GEN-001: the quick-generation prompt prefix + the session-only
//      checkbox marker exist;
//   3. INTERESTS-SECTION-001: interests_items instruction + the skeleton
//      INTERESTS section;
//   4. CERTIFICATES & COURSES rename (skeleton) with the old translation
//      keys retained;
//   5. methods visible-group preference strengthened in the prompt.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const bundle = readFileSync(path.join(ROOT, 'app.js'), 'utf8');

test('EXP-HIDDEN-ROLES-001 part B — include-all prompt rule', () => {
  assert.ok(bundle.includes('INCLUDE EVERY stored role in experience_roles'));
  assert.ok(bundle.includes('NEVER dropped and NEVER returned as blank slots'));
});

test('QUICK-GEN-001 — prompt prefix + session-only checkbox', () => {
  assert.ok(bundle.includes('QUICK GENERATION MODE — LOWER-PRIORITY APPLICATION'));
  assert.ok(bundle.includes('data-antcv-quickgen'));
  assert.ok(bundle.includes('EXISTING APPLICATION (baseline'));
});

test('INTERESTS-SECTION-001 — prompt key + skeleton section', () => {
  assert.ok(bundle.includes('interests_items'));
  assert.ok(bundle.includes('"INTERESTS"') || bundle.includes("'INTERESTS'") || /title:\s*"INTERESTS"/.test(bundle));
  assert.ok(bundle.includes('INTERESSER'));   // da translation
});

test('CERTIFICATES & COURSES rename with legacy keys retained', () => {
  assert.ok(bundle.includes('CERTIFICATES & COURSES'));
  assert.ok(bundle.includes('CERTIFIKATER & KURSER'));
  // legacy translation key retained so existing user data still translates
  assert.ok(bundle.includes('CERTIFIKATER'));
});

test('methods visible-group preference strengthened', () => {
  // 1.50.777 reworded the tools-grouping rule (forbid ungrouped/floating rows):
  // the old "STRONGLY PREFER VISIBLE group labels" became a hard no-float rule.
  assert.ok(bundle.includes('every single item belongs to exactly one group'));
  assert.ok(bundle.includes('never leave a row ungrouped at the top'));
});

test('OUTCOMES-MODE-001 — mode key + Results renderer present', () => {
  assert.ok(bundle.includes('outcomesMode'));
  assert.ok(bundle.includes('Results: '));
  assert.ok(bundle.includes('data-antcv-role-results'));
});
