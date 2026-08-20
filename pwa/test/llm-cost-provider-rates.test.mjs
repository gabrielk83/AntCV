/* LLM-COST-CLAUDE-RATE-001 regression guard (nightly 2026-08-19).
 *
 * The client cost meter prices a call as `C[provider]` and falls back to a
 * generic { inputPer1M: 10, outputPer1M: 30 } when the provider id is missing
 * from the map. The cascade ladders and the telemetry row both spell Anthropic
 * "claude" (see Z: compress: ["mistral","gemini","claude"], and D1
 * llm_calls.provider = 'claude'), but `C` was keyed only "anthropic" — so every
 * real claude call priced at the 10/30 fallback instead of 3/15.
 *
 * Proof this was live, not theoretical (D1 `llm_calls`, 7d to 2026-08-19,
 * task=compress, model=claude-sonnet-5): 411,230 prompt + 22,964 completion
 * tokens logged $4.8012 — exactly 411230*10/1e6 + 22964*30/1e6. At the true
 * $3/$15 rate that call set costs $1.578. The 3.04x skew fed
 * RELAY-COST-TIEBREAK-001's cost penalty and the weekly cost-quality tune, both
 * of which demote a provider on price, so anthropic was being demoted on a
 * phantom number.
 *
 * The guard: EVERY provider id the dispatcher can route to must have its own key
 * in the rate map, in BOTH bundles — otherwise the silent 10/30 fallback
 * reappears the next time a ladder gains a provider.
 *
 * Run:  node --test pwa/test/llm-cost-provider-rates.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../app.src.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

/* Provider ids the task ladders dispatch on. "claude" is the live telemetry id;
 * "anthropic" is the id MODEL_ROLES and the settings panel use. Both must price. */
const REQUIRED = ['anthropic', 'claude', 'openai', 'mistral', 'gemini'];

// Public list prices, 2026-08. Keep in step with the worker demo-enforcement.js RATES tables.
const EXPECTED = {
  anthropic: [3, 15],   // claude-sonnet-5
  claude: [3, 15],      // same model, the other id
};

function rateOf(bundle, provider) {
  // matches both the pretty source (`claude: { inputPer1M: 3, outputPer1M: 15 }`)
  // and the minified bundle (`claude:{inputPer1M:3,outputPer1M:15}`)
  const re = new RegExp(provider + '\\s*:\\s*\\{\\s*inputPer1M\\s*:\\s*([0-9.]+)\\s*,\\s*outputPer1M\\s*:\\s*([0-9.]+)\\s*\\}');
  const m = bundle.match(re);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

for (const [name, bundle] of [['app.src.js', src], ['app.js', app]]) {
  for (const provider of REQUIRED) {
    test(`${name}: provider "${provider}" has its own rate entry (no 10/30 fallback)`, () => {
      const rate = rateOf(bundle, provider);
      assert.ok(rate, `${provider} missing from the cost rate map — its calls would price at the {10,30} fallback`);
      assert.ok(rate[0] > 0 && rate[1] > 0, `${provider} rate must be non-zero, got ${JSON.stringify(rate)}`);
    });
  }

  test(`${name}: claude and anthropic price identically (same model, two ids)`, () => {
    assert.deepEqual(rateOf(bundle, 'claude'), rateOf(bundle, 'anthropic'));
  });

  test(`${name}: anthropic is priced at the real $3/$15, not the 10/30 fallback`, () => {
    assert.deepEqual(rateOf(bundle, 'anthropic'), EXPECTED.anthropic);
    assert.deepEqual(rateOf(bundle, 'claude'), EXPECTED.claude);
  });

  test(`${name}: every provider named in a task ladder is priced`, () => {
    // the ladder table is `compress: ["mistral","gemini","claude"]`-shaped in both bundles
    const ladder = bundle.match(/compress\s*:\s*\[\s*"mistral"[^\]]*\]/);
    assert.ok(ladder, 'compress ladder present');
    const ids = ladder[0].match(/"([a-z_]+)"/g).map((s) => s.replace(/"/g, ''));
    for (const id of ids) {
      assert.ok(rateOf(bundle, id), `ladder provider "${id}" has no rate entry`);
    }
  });
}

test('the cost meter still falls back to 10/30 for genuinely unknown providers', () => {
  // the fallback must survive — a custom/BYOK provider with no pricing still needs a number.
  assert.equal(app.split('inputPer1M:10,outputPer1M:30').length - 1, 1, 'app.js keeps exactly one 10/30 fallback');
});

/* ------------------------------------------------------------------
 * COST-SOURCE-AUDIT-GAP-001 (2026-08-20): presence + a hardcoded anthropic
 * number was not enough. mistral sat at {3,9} against a real Mistral Large 3
 * price of $0.5/$1.5 and gemini at {0.15,0.6} against a real Gemini 2.5 Flash
 * price of $0.30/$2.50 — both wrong, both feeding RELAY-COST-TIEBREAK-001 and
 * the weekly cost-quality tune, which demote a provider on price. The claude
 * guard above could not see either, because it only checked that a key existed.
 *
 * This is the real invariant: the client meter and the worker RATES table must
 * price the SAME model at the SAME rate. The provider->model mapping is read out
 * of the bundle (`S` config, `model: "..."`), so re-pinning a provider to a new
 * model automatically forces its rate to be re-verified here instead of silently
 * carrying the old one.
 */
import { rateFor } from '../../workers/proxy/src/demo-enforcement.js';

function modelOf(bundle, provider) {
  // pretty:  anthropic: { ...comments... model: "claude-sonnet-5",
  // minified: anthropic:{model:"claude-sonnet-5",quality:9,...}
  const re = new RegExp(provider + '\\s*:\\s*\\{[\\s\\S]{0,2000}?model\\s*:\\s*"([^"]+)"');
  const m = bundle.match(re);
  return m ? m[1] : null;
}

for (const [name, bundle] of [['app.src.js', src], ['app.js', app]]) {
  for (const provider of ['anthropic', 'openai', 'mistral', 'gemini']) {
    test(`${name}: "${provider}" meter rate matches the worker RATES for its pinned model`, () => {
      const model = modelOf(bundle, provider);
      assert.ok(model, `could not read the pinned model for ${provider}`);
      const meter = rateOf(bundle, provider);
      assert.ok(meter, `${provider} missing from the cost rate map`);
      assert.deepEqual(meter, rateFor(model),
        `${provider} (${model}): client meter says ${JSON.stringify(meter)} but the worker RATES table says ${JSON.stringify(rateFor(model))} — one of them is stale, and the cost router reads the client one`);
    });
  }

  test(`${name}: "claude" prices identically to the anthropic pinned model`, () => {
    assert.deepEqual(rateOf(bundle, 'claude'), rateFor(modelOf(bundle, 'anthropic')));
  });
}
