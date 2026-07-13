// RELAY-COST-QUALITY-TUNE-001 — verify the pure scoring/proposal core:
//   • cheaper-at-equal-quality wins; a flip only happens when it beats the current head by
//     > margin (hysteresis); the adequacy floor and known-provider + min-sample guardrails hold;
//     a role with no telemetry keeps its current head.
// Run: node --test scripts/tests/relay-cost-quality-tune.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreRows, proposeRoles } from '../relay-cost-quality-tune.mjs';

// Health rows for the `writer` role (task 'gen'). health_score is the 0..1 quality composite.
const R = (provider, o) => ({ provider, task: 'gen', call_count: 100, success_rate: 0.98, success_count: 98,
  total_cost_usd: 1.0, retry_rate: 0.02, p50_latency_ms: 1000, health_score: 0.9, ...o });

test('cheaper provider at equal quality has the higher cost-quality', () => {
  const rows = [R('anthropic', { total_cost_usd: 2.0 }), R('mistral', { total_cost_usd: 0.5 })];
  const ranked = scoreRows(rows, 'writer', { floor: 0.9, minCalls: 20 });
  assert.equal(ranked[0].provider, 'mistral');           // 0.9/0.005 > 0.9/0.02
  assert.ok(ranked[0].costQuality > ranked[1].costQuality);
});

test('a clearly cheaper eligible challenger flips the head', () => {
  const current = { writer: 'anthropic' };
  const rows = [R('anthropic', { total_cost_usd: 2.0 }), R('mistral', { total_cost_usd: 0.4, health_score: 0.9 })];
  const { proposed, changed } = proposeRoles(current, rows, { floor: 0.9, margin: 0.10, minCalls: 20 });
  assert.equal(changed, true);
  assert.equal(proposed.writer, 'mistral');
});

test('hysteresis: a marginally-better challenger does NOT flip', () => {
  const current = { writer: 'anthropic' };
  // mistral only ~5% cheaper → within the 10% margin → keep anthropic.
  const rows = [R('anthropic', { total_cost_usd: 1.00 }), R('mistral', { total_cost_usd: 0.95 })];
  const { proposed, changed } = proposeRoles(current, rows, { floor: 0.9, margin: 0.10, minCalls: 20 });
  assert.equal(changed, false);
  assert.equal(proposed.writer, 'anthropic');
});

test('adequacy floor: a cheap but failing provider is NOT eligible to lead', () => {
  const current = { writer: 'anthropic' };
  const rows = [R('anthropic', { total_cost_usd: 2.0, success_rate: 0.98, success_count: 98 }),
                R('gemini', { total_cost_usd: 0.1, success_rate: 0.70, success_count: 70, health_score: 0.6 })];
  const ranked = scoreRows(rows, 'writer', { floor: 0.9, minCalls: 20 });
  assert.equal(ranked.find((r) => r.provider === 'gemini').eligible, false);
  const { proposed } = proposeRoles(current, rows, { floor: 0.9, margin: 0.10, minCalls: 20 });
  assert.equal(proposed.writer, 'anthropic');            // gemini ineligible → keep
});

test('min-sample: too few calls → not eligible', () => {
  const rows = [R('mistral', { call_count: 5, success_count: 5, total_cost_usd: 0.01 })];
  const ranked = scoreRows(rows, 'writer', { floor: 0.9, minCalls: 20 });
  assert.equal(ranked[0].eligible, false);
});

test('unknown provider never becomes a head', () => {
  const current = { writer: 'anthropic' };
  const rows = [R('anthropic', { total_cost_usd: 2.0 }), R('somerandom', { total_cost_usd: 0.01, health_score: 0.95 })];
  const { proposed } = proposeRoles(current, rows, { floor: 0.9, margin: 0.10, minCalls: 20 });
  assert.equal(proposed.writer, 'anthropic');
});

test('no telemetry for a role → keep current head', () => {
  const current = { writer: 'anthropic', supervisor: 'mistral', coherence: 'anthropic' };
  const rows = [R('mistral', { task: 'gen', total_cost_usd: 0.3 })]; // only writer/gen data
  const { proposed } = proposeRoles(current, rows, { floor: 0.9, margin: 0.10, minCalls: 20 });
  assert.equal(proposed.supervisor, 'mistral');          // no 'supervisor' rows → unchanged
  assert.equal(proposed.coherence, 'anthropic');         // no 'coherence' rows → unchanged
});

test('missing cost data ranks by quality alone (not rewarded for $0)', () => {
  const rows = [R('anthropic', { total_cost_usd: 0.5, health_score: 0.95 }),
                R('openai', { total_cost_usd: 0, health_score: 0.80 })];
  const ranked = scoreRows(rows, 'writer', { floor: 0.9, minCalls: 20 });
  // openai has cost 0 → costQuality = quality (0.80); anthropic = 0.95/0.005 = 190 → anthropic wins.
  assert.equal(ranked[0].provider, 'anthropic');
});
