// cost-tiebreak.test.mjs
// RELAY-COST-TIEBREAK-001 — scoreHealth cost-awareness (owner "make scoreHealth
// cost-aware so equal-quality providers tie-break by cost"). Locks:
//  - no costCtx  -> health_score == quality score (backward-identical);
//  - cheapest-among-equals gets NO penalty; a big cost ratio gets the full,
//    BOUNDED penalty and an adequate provider NEVER leaves 'ok' from cost alone;
//  - the penalty is status-gated (only 'ok' providers) and log-scaled monotonic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreHealth, costPenalty, COST_SENSITIVE_TASKS, COST_TIEBREAK_MAX, COST_RATIO_CAP } from '../src/telemetry.js';

const PERFECT = { success_rate: 1, p95_latency_ms: 1000, placeholder_leak_rate: 0, fabrication_rate: 0, retry_rate: 0, banned_word_rate: 0 };

test('no costCtx -> quality-only (backward identical) + cost_penalty 0', () => {
  const r = scoreHealth(PERFECT);
  assert.equal(r.health_score, 1);
  assert.equal(r.status, 'ok');
  assert.equal(r.cost_penalty, 0);
});

test('cheapest among equals (ratio 1) -> no penalty', () => {
  const r = scoreHealth(PERFECT, { costPerCall: 0.01, minCostPerCall: 0.01 });
  assert.equal(r.cost_penalty, 0);
  assert.equal(r.health_score, 1);
  assert.equal(r.status, 'ok');
});

test('big cost ratio -> FULL bounded penalty, still ok, never below 0.85', () => {
  // 1700x (compress openai vs gemini) >> COST_RATIO_CAP -> capped at MAX
  const r = scoreHealth(PERFECT, { costPerCall: 0.12395, minCostPerCall: 0.00007 });
  assert.equal(r.cost_penalty, COST_TIEBREAK_MAX);
  assert.equal(r.health_score, Number((1 - COST_TIEBREAK_MAX).toFixed(3))); // 0.85
  assert.equal(r.status, 'ok');   // pricey but adequate — never mislabeled
  assert.ok(r.health_score >= 0.85);
});

test('tie-break is SUCCESS-gated: a hard-failing provider (success<0.85) gets none', () => {
  const bad = { ...PERFECT, success_rate: 0.5 }; // -0.4 -> 0.6 -> 'warning', and <0.85 success
  const r = scoreHealth(bad, { costPerCall: 1, minCostPerCall: 0.001 });
  assert.equal(r.cost_penalty, 0);
  assert.equal(r.status, 'warning');
  assert.equal(r.health_score, 0.6);
});

test('WARNING-band (high-latency but succeeding) provider STILL tie-breaks by cost', () => {
  // the production case: compress/long_context sit at quality 0.7 (p95>30s) but
  // succeed 100% — v1 gated on status==='ok' and was inert here; now it fires.
  const slow = { ...PERFECT, p95_latency_ms: 90000 }; // -0.3 -> 0.7 'warning', success 1.0
  const cheap = scoreHealth(slow, { costPerCall: 0.00007, minCostPerCall: 0.00007 });
  assert.equal(cheap.cost_penalty, 0);          // cheapest: no penalty
  assert.equal(cheap.health_score, 0.7);
  const pricey = scoreHealth(slow, { costPerCall: 0.12395, minCostPerCall: 0.00007 });
  assert.equal(pricey.cost_penalty, COST_TIEBREAK_MAX); // ~1700x -> full penalty
  assert.equal(pricey.health_score, Number((0.7 - COST_TIEBREAK_MAX).toFixed(3))); // 0.55
  assert.equal(pricey.status, 'warning');       // status stays quality-only
  // a >0.10 gap below the cheapest -> the client seed demotes the pricey one
  assert.ok(cheap.health_score - pricey.health_score >= 0.10);
});

test('health never driven below 0.30 by cost (a pricey provider is at worst degraded, never down)', () => {
  const dinged = { ...PERFECT, p95_latency_ms: 90000, retry_rate: 0.5 }; // 1 -0.3 -0.1 = 0.6 'warning'
  const r = scoreHealth(dinged, { costPerCall: 100, minCostPerCall: 0.0001 }); // huge ratio
  assert.ok(r.health_score >= 0.30);
  assert.equal(r.health_score, Number(Math.max(0.30, 0.6 - COST_TIEBREAK_MAX).toFixed(3))); // 0.45
});

test('costPenalty pure fn: monotonic, bounded, 0 at ratio<=1', () => {
  assert.equal(costPenalty(0.01, 0.01), 0);
  assert.equal(costPenalty(0.005, 0.01), 0);          // cheaper than floor -> 0
  assert.equal(costPenalty(0, 0.01), 0);
  const p10 = costPenalty(0.1, 0.01);                 // 10x
  const p100 = costPenalty(1, 0.01);                  // 100x = cap
  assert.ok(p10 > 0 && p10 < p100);
  assert.equal(Number(p100.toFixed(3)), COST_TIEBREAK_MAX);
  assert.equal(Number(costPenalty(100, 0.01).toFixed(3)), COST_TIEBREAK_MAX); // >cap stays capped
});

test('COST_SENSITIVE_TASKS covers the mechanical passes, excludes quality-critical', () => {
  for (const t of ['compress', 'long_context', 'consensus_poll', 'apply_correction']) assert.ok(COST_SENSITIVE_TASKS.has(t), t);
  for (const t of ['generate_cv', 'generate_cl', 'parse_jd', 'analyze_fit']) assert.ok(!COST_SENSITIVE_TASKS.has(t), t);
});
