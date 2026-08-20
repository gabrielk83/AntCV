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

// ------------------------------------------------------------
// 2026-08-20 (weekly cost-quality tune) — the models that are actually the
// bulk of live traffic were never pinned here, and both were wrong:
//   - mistral-large  was [2,6]      (Mistral Large 2 era; Large 3 is [0.5,1.5])
//   - gemini-2.5-flash was [0.1,0.4] — that is Flash-LITE's rate, not Flash's
// A wrong rate here is not merely a demo-cap error: RELAY-COST-TIEBREAK-001 and
// the weekly tune both DEMOTE a provider on price, so a stale number silently
// steers the router. See LLM-COST-MISTRAL-RATE-001 / LLM-COST-GEMINI-RECONCILE-001.

test('mistral-large prices at Large 3 [0.5,1.5], not the Large 2 era [2,6]', () => {
  assert.deepEqual(rateFor('mistral-large'), [0.50, 1.50]);
});

test('the LIVE model id mistral-large-latest resolves to the mistral-large rate', () => {
  // The id actually dispatched is `mistral-large-latest`; substring matching is
  // what makes the shorter key cover it. D1 llm_provider_costs uses EXACT
  // matching and therefore does NOT — that asymmetry is COST-SOURCE-AUDIT-GAP-001.
  assert.deepEqual(rateFor('mistral-large-latest'), [0.50, 1.50]);
});

test('gemini-2.5-flash prices at Flash [0.3,2.5], not Flash-Lite [0.1,0.4]', () => {
  assert.deepEqual(rateFor('gemini-2.5-flash'), [0.30, 2.50]);
});

test('gemini-2.5-flash-lite keeps its own cheaper rate (longest-key-wins)', () => {
  // Regression guard for the fix itself: the flash-lite key must stay LONGER
  // than the flash key, or Flash-Lite silently inherits Flash's higher rate.
  assert.deepEqual(rateFor('gemini-2.5-flash-lite'), [0.10, 0.40]);
});

// gpt-5.5 is a PIN (the thorough/flagship openai tier) but is deliberately NOT
// in the openai cascade. Step 1a of RELAY-COST-QUALITY-TUNE-001 says pins must
// be "present in the PROVIDER_MODELS cascade", which reads as a gap here - it
// is not. PROVIDER_MODELS is the DEFAULT chain: putting gpt-5.5 at its head
// would make a $30/$60 model the default for every openai cascade call (~40x
// the pinned gpt-5.4-mini), and putting it in the tail would let a cheap call
// silently land there on a fallback. gpt-5.5 is reached only by an explicit
// per-request opts.models override, which is the correct design. Pinned as an
// invariant so a future freshness pass does not "fix" the non-gap and regress
// the default cost. Audited 2026-08-20.
test('gpt-5.5 is priced but deliberately NOT in the default openai cascade', () => {
  assert.deepEqual(rateFor('gpt-5.5'), [30.00, 60.00]);
  assert.ok(!PROVIDER_MODELS.openai.includes('gpt-5.5'),
    'gpt-5.5 must stay out of the default chain - it is reached only via an explicit opts.models override');
  assert.ok(PROVIDER_MODELS.openai.includes('gpt-5.4-mini'),
    'the cheap default gen model must be in the cascade');
});
