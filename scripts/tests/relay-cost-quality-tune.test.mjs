// RELAY-COST-QUALITY-TUNE-001 — verify the pure scoring/proposal core:
//   • cheaper-at-equal-quality wins; a flip only happens when it beats the current head by
//     > margin (hysteresis); the adequacy floor and known-provider + min-sample guardrails hold;
//     a role with no telemetry keeps its current head.
// Run: node --test scripts/tests/relay-cost-quality-tune.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreRows, proposeRoles, summarizeClientDispatch, normProvider } from '../relay-cost-quality-tune.mjs';

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

// ── RELAY-TUNE-COVERAGE-GAP-001 regression coverage ──────────────────────────

test('normProvider folds telemetry "claude" onto the router id "anthropic"', () => {
  assert.equal(normProvider('claude'), 'anthropic');
  assert.equal(normProvider('openai'), 'openai');
  // A claude health row must score AGAINST an anthropic-headed role (not read as "no data").
  const rows = [{ provider: 'claude', task: 'coherence', call_count: 100, success_rate: 0.99,
                  success_count: 99, total_cost_usd: 1.0, health_score: 0.95 }];
  const ranked = scoreRows(rows, 'coherence', { floor: 0.9, minCalls: 20 });
  assert.equal(ranked[0].provider, 'anthropic');   // was 'claude' before normalization
  const { proposed } = proposeRoles({ coherence: 'anthropic' }, rows, { floor: 0.9, margin: 0.10, minCalls: 20 });
  assert.equal(proposed.coherence, 'anthropic');   // current head is seen as best → no wrong flip
});

test('coherence role is scored from its real telemetry label apply_correction', () => {
  const rows = [{ provider: 'gemini', task: 'apply_correction', call_count: 60, success_rate: 1.0,
                  success_count: 60, total_cost_usd: 0.001, health_score: 1.0 },
                { provider: 'claude', task: 'apply_correction', call_count: 40, success_rate: 1.0,
                  success_count: 40, total_cost_usd: 4.0, health_score: 1.0 }];
  const ranked = scoreRows(rows, 'coherence', { floor: 0.9, minCalls: 20 });
  assert.equal(ranked.length, 2);                  // both seen (not 0 rows)
  assert.equal(ranked[0].provider, 'gemini');      // far cheaper at equal quality
});

test('an UNPINNED tunable role (analysis) is proposable as a new pin', () => {
  // MODEL_ROLES has no 'analysis' key, yet its parse_jd telemetry favours a cheap adequate provider.
  const current = { writer: 'anthropic', supervisor: 'mistral', coherence: 'anthropic' };
  const rows = [{ provider: 'mistral', task: 'parse_jd', call_count: 80, success_rate: 1.0,
                  success_count: 80, total_cost_usd: 10.0, health_score: 1.0 },
                { provider: 'gemini', task: 'parse_jd', call_count: 80, success_rate: 1.0,
                  success_count: 80, total_cost_usd: 0.02, health_score: 1.0 }];
  const { proposed, changed, rationale } = proposeRoles(current, rows, { floor: 0.9, margin: 0.10, minCalls: 20 });
  assert.equal(changed, true);
  assert.equal(proposed.analysis, 'gemini');       // new pin proposed for the unpinned role
  // unpinned roles with no telemetry stay ABSENT (no MODEL_ROLES noise)
  assert.equal('kernel' in proposed, false);
  assert.ok(rationale.find((r) => r.role === 'analysis' && r.decision === 'flip'));
});

test('summarizeClientDispatch surfaces the compress lever (not MODEL_ROLES-tunable) with the cheapest adequate provider', () => {
  const H = (provider, task, calls, cost) => ({ provider, task, call_count: calls, success_rate: 1.0,
    success_count: calls, total_cost_usd: cost, health_score: 1.0 });
  const rows = [
    H('openai', 'compress', 500, 62.0), H('claude', 'compress', 500, 8.7),
    H('gemini', 'compress', 550, 0.04),
    H('mistral', 'parse_jd', 80, 10.0),   // a proxy-cascade task → must NOT appear here
  ];
  const levers = summarizeClientDispatch(rows, { floor: 0.9, minCalls: 20 });
  const compress = levers.find((l) => l.task === 'compress');
  assert.ok(compress, 'compress lever present');
  assert.equal(compress.lead.provider, 'openai');       // where the money goes now
  assert.equal(compress.cheapest.provider, 'gemini');   // cheapest adequate
  assert.ok(compress.potentialSave > 60);               // ~$70 spend → ~$0 on gemini
  assert.equal(levers.find((l) => l.task === 'parse_jd'), undefined);  // cascade task excluded
});
