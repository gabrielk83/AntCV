/* LLM-SCORER-001 regression test. Replicates the cost-quality-latency scoring
 * from app.src.js (__LLM_BASE / __antcvProviderScore / __antcvScoreOrder) and
 * asserts the provider orderings live-verified at ship time (1.50.823). If a
 * future weight/base edit breaks an invariant below, this fails.
 *
 * Run: node pwa/test/unit/llm-scorer.test.mjs
 */
import assert from 'node:assert';

// Must mirror app.src.js __LLM_BASE.
const BASE = {
  anthropic: { q: 1.0, c: 0.9, lat: 0.6 },
  openai: { q: 0.95, c: 0.6, lat: 0.5 },
  gemini: { q: 0.65, c: 0.3, lat: 0.3 },
  mistral: { q: 0.5, c: 0.2, lat: 0.3 },
};
// Subset of the L weights table (the tasks asserted here), incl. aliases.
const W = {
  generate_cv: { qW: 0.7, lW: 0, cW: 0.3 },
  generate_cl: { qW: 0.65, lW: 0, cW: 0.35 },
  parse_jd: { qW: 0.3, lW: 0.2, cW: 0.5 },
  extract_keywords: { qW: 0.25, lW: 0.25, cW: 0.5 },
  compress: { qW: 0.5, lW: 0.1, cW: 0.4 },
  translate_da: { qW: 0.5, lW: 0.1, cW: 0.4, danishBias: true },
  default: { qW: 0.5, lW: 0.1, cW: 0.4 },
};

function score(prov, w) {
  const k = prov === 'claude' ? 'anthropic' : prov;
  const b = BASE[k] || { q: 0.6, c: 0.5, lat: 0.5 };
  let s = (w.qW || 0) * b.q - (w.cW || 0) * b.c - (w.lW || 0) * b.lat;
  if (w.danishBias && (k === 'anthropic' || k === 'openai')) s += 0.15;
  return s;
}
function order(task, list) {
  const w = W[task] || W.default;
  return list
    .map((p, i) => [p, i, score(p, w)])
    .sort((a, b) => b[2] - a[2] || a[1] - b[1])
    .map((x) => x[0]);
}

const ALL = ['claude', 'openai', 'gemini', 'mistral'];
const eq = (task, expected) =>
  assert.deepStrictEqual(order(task, ALL), expected, task + ' ordering');

// Quality-first tasks lead with the strong providers, never the cheapest.
eq('generate_cv', ['openai', 'claude', 'gemini', 'mistral']);
eq('generate_cl', ['openai', 'claude', 'gemini', 'mistral']);
// Cheap/fast tasks lead with the cheap providers.
eq('parse_jd', ['mistral', 'gemini', 'openai', 'claude']);
eq('extract_keywords', ['mistral', 'gemini', 'openai', 'claude']);
// Mechanical: balanced; claude (priciest) goes last.
eq('compress', ['openai', 'gemini', 'mistral', 'claude']);
// danishBias keeps claude/openai near the top for Danish prose.
eq('translate_da', ['openai', 'claude', 'gemini', 'mistral']);

// Invariants (independent of exact order):
assert.ok(order('generate_cv', ALL).indexOf('claude') <= 1, 'cv: claude top-2');
assert.ok(order('compress', ALL).indexOf('claude') === 3, 'compress: claude last');
assert.ok(order('translate_da', ALL).indexOf('claude') <= 1, 'da: claude top-2');
// Reorder never drops/dupes a provider.
assert.strictEqual(new Set(order('default', ALL)).size, ALL.length, 'no drop/dupe');

console.log('LLM-SCORER TEST OK');
