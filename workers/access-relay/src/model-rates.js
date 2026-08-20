/* MODEL RATES — access-relay's copy of the owner-maintained public-price table.
 *
 * LLM-COST-D1-REFERENCE-STALE-001 (nightly 2026-08-20). telemetry.js recomputes
 * estimated_cost_usd server-side from the D1 llm_provider_costs table 'so a
 * stale client doesn't bias the dashboard'. Measured against 30 days of real
 * llm_calls, that lookup MISSES for every model actually in production —
 * claude-sonnet-5, gpt-5.4-mini and mistral-large-latest have no row at all —
 * so ~98% of calls silently fell back to the number the client sent, which is
 * exactly what the recompute exists to distrust. Before 1.51.4326 that number
 * was claude at the 10/30 fallback: $12.02 logged where $3.91 was true.
 *
 * The relay now prices from THIS table when D1 has no row, so the server is
 * independent of the client by default and D1 stays an override rather than a
 * prerequisite.
 *
 * MIRROR — byte-identical to the RATES block in workers/demo-proxy/src/
 * demo-enforcement.js and workers/proxy/src/demo-enforcement.js. Those two are
 * already hand-synced copies; this is the third. Edit all three together —
 * pwa/test/relay-model-rates-mirror.test.mjs fails the suite if they drift.
 */
const RATES = {
  // Anthropic — current generation
  'claude-sonnet-5':     [3.00, 15.00],   // 2026-07 (standard $3/$15; intro $2/$10 through 2026-08-31 — use standard so the demo budget is conservatively capped)
  'claude-opus-4-8':     [5.00, 25.00],   // 2026-07 flagship (AntCV gen pin since 1.51.332). Explicit entry: without it the string "claude-opus-4-8" falls through to the legacy `claude-opus-4` key at [15,75] and over-prices the cap 3x — the exact v1.40.167 bug this comment block documents.
  'claude-opus-4-7':     [5.00, 25.00],   // released 2026-04-16
  'claude-opus-4-6':     [5.00, 25.00],
  'claude-opus-4-5':     [5.00, 25.00],
  'claude-sonnet-4-6':   [3.00, 15.00],
  'claude-sonnet-4-5':   [3.00, 15.00],
  'claude-haiku-4-5':    [1.00,  5.00],
  // Anthropic — legacy (kept for older deployed models)
  'claude-3-haiku':      [0.25,  1.25],
  'claude-3-5-haiku':    [0.80,  4.00],
  'claude-haiku-4':      [1.00,  5.00],
  'claude-3-5-sonnet':   [3.00, 15.00],
  'claude-3-7-sonnet':   [3.00, 15.00],
  'claude-sonnet-4':     [3.00, 15.00],
  'claude-opus-4-1':     [15.00, 75.00],
  'claude-opus-4':       [15.00, 75.00],   // legacy Opus 4 base — superseded by 4.5+
  // OpenAI — GPT-5 family (added 2026-05-18 audit; launched 2025)
  'gpt-5.5':             [30.00, 60.00],  // 2026-07 top flagship, reserved for AntCV's thorough/max gen tier (default openai gen is gpt-5.4-mini — LLM_ROUTER_PROPOSAL_2026-07-11). Explicit entry: without it "gpt-5.5" falls through to the shorter `gpt-5` key at [1.25,10] and under-prices the cap ~24x.
  'gpt-5.4-nano':        [0.20,  1.25],
  'gpt-5.4-mini':        [0.75,  4.50],
  'gpt-5.4':             [2.50, 15.00],   // current flagship as of 2026-04
  'gpt-5-mini':          [0.25,  2.00],
  'gpt-5':               [1.25, 10.00],
  // OpenAI — GPT-4 family
  'gpt-4o-mini':         [0.15,  0.60],
  'gpt-4o':              [2.50, 10.00],
  'gpt-4.1-mini':        [0.40,  1.60],
  'gpt-4.1-nano':        [0.10,  0.40],
  'gpt-4.1':             [2.00,  8.00],
  // Mistral
  'mistral-small':       [0.20,  0.60],
  'mistral-medium':      [0.40,  2.00],
  'mistral-large':       [2.00,  6.00],
  // Gemini
  'gemini-1.5-flash':    [0.075, 0.30],
  'gemini-1.5-pro':      [1.25,  5.00],
  'gemini-2.0-flash':    [0.10,  0.40],
  'gemini-2.5-flash':    [0.10,  0.40],
  'gemini-2.5-pro':      [1.25, 10.00],
  // xAI Grok — added 2026-07-05 (BYOK-COST-AUDIT-001, owner: the byok-qualify
  // audit never priced a BYOK provider whose model id fell through to
  // FALLBACK_RATE, e.g. any grok-* model — cost silently went untracked).
  // Web-search-sourced (xAI's own pricing page returned 403 to automated
  // fetch); re-verify directly against docs.x.ai before relying on this for
  // a high-volume production decision. Re-audit alongside the quarterly pass.
  'grok-4-fast':         [0.20,  0.50],   // 2026-07 web-sourced, unverified against docs.x.ai
  'grok-4':              [3.00, 15.00],   // 2026-07 web-sourced, unverified against docs.x.ai
  'grok-3-mini':         [0.30,  0.50],   // 2026-07 web-sourced, unverified against docs.x.ai
  'grok-3':              [2.00, 10.00],   // 2026-07 web-sourced, unverified against docs.x.ai
};

// Fallback when no model match — assume Sonnet pricing so the cap
// burns faster on unknown models (safer for the demo budget).
const FALLBACK_RATE = [3.00, 15.00];

// Exported (BYOK-COST-AUDIT-001, 2026-07-05) so byok-qualify.js's custom-
// provider audit can price a BYOK endpoint's model against this SAME table
// instead of duplicating a second, driftable pricing list.
export function rateFor(modelString) {
  const m = String(modelString || '').toLowerCase();
  if (!m) return FALLBACK_RATE;
  // Match longest key first so "claude-3-5-sonnet" beats "claude-3"
  const keys = Object.keys(RATES).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (m.includes(key)) return RATES[key];
  }
  return FALLBACK_RATE;
}


// ─── END OF MIRROR ───────────────────────────────────────────────────
// Everything above this line is byte-identical to the two demo-enforcement
// copies and is compared against them by relay-model-rates-mirror.test.mjs.
// Everything below is relay-only and is not part of that comparison.

// rateFor() answers FALLBACK_RATE (Sonnet pricing) for a model it does not
// know, which is right for the demo cap — an unknown model should burn the
// budget conservatively. It is wrong for telemetry, where a guessed price
// recorded as fact is the whole defect of LLM-COST-D1-REFERENCE-STALE-001.
// This variant says "I don't know" instead, so the caller can log the gap.
export function rateForStrict(modelString) {
  const m = String(modelString || '').toLowerCase();
  if (!m) return null;
  const keys = Object.keys(RATES).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (m.includes(key)) return RATES[key];
  }
  return null;
}
