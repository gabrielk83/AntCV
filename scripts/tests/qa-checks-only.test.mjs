// BROWSER-QA-ONLY-LIST-001: `browser-qa.mjs --only a,b` matched the whole string
// as one id, selected 0 checks and exited 0 (false green). selectChecks must
// accept a comma list and throw on any unknown id.
//
// Run: node --test scripts/tests/qa-checks-only.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { CHECKS, selectChecks } from '../qa-checks.mjs';

test('no --only selects every check', () => {
  assert.equal(selectChecks(null).length, CHECKS.length);
  assert.equal(selectChecks(true).length, CHECKS.length);
});

test('a single id selects exactly that check', () => {
  assert.deepEqual(selectChecks('version-live').map((c) => c.id), ['version-live']);
});

test('a comma list selects every listed check (the nightly prompt form)', () => {
  const ids = selectChecks('version-live,sidecars-live').map((c) => c.id).sort();
  assert.deepEqual(ids, ['sidecars-live', 'version-live']);
  assert.equal(selectChecks(' version-live , sidecars-live ').length, 2);
});

test('an unknown id throws instead of selecting nothing', () => {
  assert.throws(() => selectChecks('no-such-check'), /unknown check id/);
  assert.throws(() => selectChecks('version-live,typo-live'), /typo-live/);
  assert.throws(() => selectChecks(','), /unknown check id/);
});
