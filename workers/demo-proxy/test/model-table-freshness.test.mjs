// model-table-freshness.test.mjs
// ============================================================
// MODEL-TABLE-FRESHNESS-001 (owner 2026-07-13): when AntCV's gen pins moved
// to claude-opus-4-8 (flagship, 1.51.332), gpt-5.4-mini (default) + gpt-5.5
// (thorough tier), and claude-sonnet-5 (cascade), the two demo-proxy tables
// were left stale. Because demo-enforcement.js prices by LONGEST-substring
// match, a missing explicit key silently resolves to a SHORTER neighbour:
//   - "claude-opus-4-8" -> legacy "claude-opus-4" [15,75]  => 3x OVER-price
//   - "gpt-5.5"         -> "gpt-5"                [1.25,10] => ~24x UNDER-price
// Both mis-meter the demo spending cap. This test pins the current-pin models
// to their correct rate + presence so a future rename can't silently regress
// the meter again. Keep in lockstep with demo-proxy/test/ (identical table).
//
// Run from inside workers/proxy/:  node --test test/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rateFor } from '../src/demo-enforcement.js';
import { PROVIDER_MODELS } from '../src/multi-llm.js';

test('claude-opus-4-8 prices at opus-tier [5,25], not the legacy claude-opus-4 [15,75]', () => {
  assert.deepEqual(rateFor('claude-opus-4-8'), [5.00, 25.00]);
});

test('gpt-5.5 prices at flagship [30,60], not the shorter gpt-5 [1.25,10]', () => {
  assert.deepEqual(rateFor('gpt-5.5'), [30.00, 60.00]);
});

test('gpt-5.4-mini (the default openai gen model) prices at [0.75,4.5]', () => {
  assert.deepEqual(rateFor('gpt-5.4-mini'), [0.75, 4.50]);
});

test('claude-sonnet-5 (preferred cascade) prices at [3,15]', () => {
  assert.deepEqual(rateFor('claude-sonnet-5'), [3.00, 15.00]);
});

test('claude-opus-4-8 is present in the anthropic fallback cascade', () => {
  assert.ok(PROVIDER_MODELS.anthropic.includes('claude-opus-4-8'),
    'the current flagship gen model must appear in its own provider cascade');
});
