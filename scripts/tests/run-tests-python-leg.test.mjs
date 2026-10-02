// Guard for the optional python test leg (JOBTRACKER-PYTEST-UNWIRED-001).
//
// Protects the two invariants that keep wiring python into the suite safe:
//   1. The PWA scope collects ZERO python tests, so `run-tests.mjs pwa` — the
//      scope the pre-push hook + CI gate on — is byte-for-byte unchanged.
//   2. A missing interpreter resolves to null (the skip-loudly path), never a
//      throw, so a runner with no python can't redden the whole suite.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { walkPyTests, pickPython } from '../lib/python-test-leg.mjs';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');

test('walkPyTests finds the job-tracker belts, all matching test_*.py', () => {
  const found = walkPyTests(join(ROOT, 'scripts', 'job-tracker'));
  assert.ok(found.length >= 14, `expected >=14 python belts, got ${found.length}`);
  for (const f of found) assert.match(f, /[\\/]test_[^\\/]*\.py$/);
  // The closed-row gate is the canonical belt the row calls out by name.
  assert.ok(found.some((f) => /test_closed_row_gate\.py$/.test(f)));
});

test('walkPyTests on the pwa scope collects nothing (PWA suite unchanged)', () => {
  assert.deepEqual(walkPyTests(join(ROOT, 'pwa')), []);
});

test('walkPyTests ignores a missing directory without throwing', () => {
  assert.deepEqual(walkPyTests(join(ROOT, 'no', 'such', 'dir')), []);
});

test('pickPython returns the first interpreter whose --version exits 0', () => {
  const calls = [];
  const fakeSpawn = (cmd) => {
    calls.push(cmd);
    return { status: cmd === 'python3' ? 0 : 1 };
  };
  assert.equal(pickPython(fakeSpawn), 'python3');
  assert.deepEqual(calls, ['python3']);
});

test('pickPython falls back to python when python3 is absent', () => {
  const fakeSpawn = (cmd) => ({ status: cmd === 'python' ? 0 : 127 });
  assert.equal(pickPython(fakeSpawn), 'python');
});

test('pickPython returns null when no interpreter is present (skip-loudly path)', () => {
  assert.equal(pickPython(() => ({ status: 127 })), null);
});

test('pickPython treats a spawn error as absent, never throws', () => {
  assert.equal(pickPython(() => ({ error: new Error('ENOENT') })), null);
  assert.equal(pickPython(() => { throw new Error('boom'); }), null);
});
