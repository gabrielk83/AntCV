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

test('cost penalty is STATUS-gated: an inadequate provider gets none', () => {
  const bad = { ...PERFECT, success_rate: 0.5 }; // -0.4 -> 0.6 -> 'warning'
  const r = scoreHealth(bad, { costPerCall: 1, minCostPerCall: 0.001 });
  assert.equal(r.cost_penalty, 0);
  assert.equal(r.status, 'warning');
  assert.equal(r.health_score, 0.6);
});

test('penalty clamped so a quality-dinged-but-ok provider never crosses 0.85', () => {
  // one retry ding -> quality 0.9 (still ok). A huge cost ratio would want 0.15,
  // but clamp to (0.9 - 0.85) = 0.05 so status stays ok.
  const dinged = { ...PERFECT, retry_rate: 0.5 }; // -0.1 -> 0.9
  const r = scoreHealth(dinged, { costPerCall: 10, minCostPerCall: 0.001 });
  assert.equal(r.status, 'ok');
  assert.ok(r.health_score >= 0.85);
  assert.equal(r.health_score, 0.85);
  assert.equal(r.cost_penalty, 0.05);
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
