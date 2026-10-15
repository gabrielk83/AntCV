/* LLM-COST-D1-REFERENCE-STALE-001 (nightly 2026-08-20).
 *
 * The relay's telemetry now prices a call from workers/access-relay/src/
 * model-rates.js when D1's llm_provider_costs has no row for the model — which,
 * measured over 30 days of real llm_calls, is every model actually in
 * production. That table is the THIRD hand-synced copy of the same public-price
 * list (demo-proxy and proxy already carry byte-identical copies inside
 * demo-enforcement.js). Three copies drift; this test is what stops them.
 *
 * Guards, in order: the three copies agree exactly, the models production
 * actually calls are all priced, and the strict lookup refuses to guess.
 *
 * Run:  node --test pwa/test/relay-model-rates-mirror.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MIRROR = path.join(ROOT, 'workers', 'access-relay', 'src', 'model-rates.js');
const SOURCES = [
  path.join(ROOT, 'workers', 'demo-proxy', 'src', 'demo-enforcement.js'),
  path.join(ROOT, 'workers', 'proxy', 'src', 'demo-enforcement.js'),
];

/** The shared region: the RATES literal through the end of rateFor().
 *  Line endings are normalised — these files sit in a repo worked from both
 *  Windows and Linux, and a CRLF/LF split is not drift. */
function mirroredRegion(file) {
  const src = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const start = src.indexOf('const RATES = {');
  assert.ok(start !== -1, `no RATES table in ${path.basename(file)}`);
  const end = src.indexOf('export function estimateCostUsd', start);
  const stop = src.indexOf('// ─── END OF MIRROR', start);
  const cut = end !== -1 ? end : stop;
  assert.ok(cut !== -1, `cannot find the end of the mirrored region in ${file}`);
  return src.slice(start, cut).trimEnd();
}

test('the three rate-table copies have not drifted', () => {
  const mirror = mirroredRegion(MIRROR);
  for (const src of SOURCES) {
    assert.equal(
      mirror, mirroredRegion(src),
      `workers/access-relay/src/model-rates.js has drifted from ${path.relative(ROOT, src)} — edit all three together`
    );
  }
});

test('every model production actually calls is priced', async () => {
  const { rateForStrict } = await import(pathToFileURL(MIRROR).href);
  // Observed in D1 llm_calls over the 30 days to 2026-08-20, plus the two
  // owner-pinned gen models. None of these has a row in llm_provider_costs.
  const LIVE = [
    'claude-sonnet-5', 'claude-opus-5-5', 'claude-opus-4-8',   // opus-5-5: gen pin since 1.51.4666 (OPUS55-ADOPT-001)
    'gpt-5.4-mini', 'gpt-5.5',
    'mistral-large-latest', 'gemini-2.5-flash',
  ];
  for (const model of LIVE) {
    const rate = rateForStrict(model);
    assert.ok(rate, `${model} has no rate — telemetry would log the client's number instead`);
    assert.ok(rate[0] > 0 && rate[1] > 0, `${model} priced at zero: ${JSON.stringify(rate)}`);
  }
});

test('the pins that a substring match would misprice keep their own entries', async () => {
  const { rateForStrict } = await import(pathToFileURL(MIRROR).href);
  // "claude-opus-4-8" must not fall through to the legacy "claude-opus-4"
  // key at [15,75], and "gpt-5.5" must not fall through to "gpt-5" at [1.25,10].
  assert.deepEqual(rateForStrict('claude-opus-4-8'), [5, 25]);
  assert.deepEqual(rateForStrict('gpt-5.5'), [5, 30]);   // GPT55-RATE-2026-09-001: vendor page says $5/$30, not the [30,60] this pinned since 2026-07
  assert.deepEqual(rateForStrict('claude-sonnet-5'), [2, 10]);   // ANTHROPIC-RATES-2026-09-001: launch price made standard
});

test('the Anthropic 5-generation ids are priced ahead of adoption (ANTHROPIC-RATES-2026-09-001)', async () => {
  const { rateForStrict } = await import(pathToFileURL(MIRROR).href);
  // Not in production traffic yet (2026-09-06), so the LIVE list above does not cover
  // them — but the first BYOK or override call would otherwise log the client's guess.
  assert.deepEqual(rateForStrict('claude-opus-5'), [5, 25]);
  assert.deepEqual(rateForStrict('claude-fable-5-1'), [10, 50]);
  assert.deepEqual(rateForStrict('claude-fable-5'), [10, 50]);
});

test('the ids shipped since the 09-06 pass are priced ahead of adoption (2026-09-10 tune)', async () => {
  const { rateForStrict } = await import(pathToFileURL(MIRROR).href);
  // Same argument as the block above: none of these is in AntCV's traffic, but rateForStrict()
  // answering null is what makes telemetry fall back to the client's self-reported number —
  // the exact defect LLM-COST-D1-REFERENCE-STALE-001 exists to stop. Pricing is not adoption.
  assert.deepEqual(rateForStrict('claude-mythos-5-1'), [10, 50]);  // MYTHOS-RATES-2026-09-001
  assert.deepEqual(rateForStrict('claude-mythos-5'), [10, 50]);
  assert.deepEqual(rateForStrict('gpt-6-astra'), [10, 50]);        // GPT56-ASTRA-RATES-2026-09-001
  assert.deepEqual(rateForStrict('gpt-5.6-sol'), [4, 20]);
  assert.deepEqual(rateForStrict('gpt-5.6-terra'), [2, 12]);
  assert.deepEqual(rateForStrict('gpt-5.6-luna'), [0.2, 1.2]);     // the one the 'gpt-5' key OVER-priced 6.25x
  assert.deepEqual(rateForStrict('gemini-3.8-flash'), [0.75, 3.75]); // GEMINI3-RATES-2026-09-001
  assert.deepEqual(rateForStrict('gemini-3.5-flash'), [1.5, 9]);
  // The additions must not disturb the shorter keys they sit above.
  assert.deepEqual(rateForStrict('gpt-5'), [1.25, 10]);
  assert.deepEqual(rateForStrict('gemini-2.5-flash'), [0.3, 2.5]);
});

test('the ids shipped since the 09-10 pass are priced ahead of adoption (2026-09-29 tune)', async () => {
  const { rateForStrict } = await import(pathToFileURL(MIRROR).href);
  // Four of these sit on an existing key's prefix, so before 2026-09-29 they resolved to a
  // SIBLING's rate, not to null — the strict lookup could not flag them either.
  assert.deepEqual(rateForStrict('claude-opus-5-5'), [4, 20]);        // ANTHROPIC-55-RATES-2026-09-001 (was opus-5 [5,25])
  assert.deepEqual(rateForStrict('claude-sonnet-5-5'), [2, 10]);
  assert.deepEqual(rateForStrict('gpt-6-sol'), [2, 10]);              // GPT6-SOL-LUNA-RATES-2026-09-001
  assert.deepEqual(rateForStrict('gpt-6.1-sol'), [2, 10]);
  assert.deepEqual(rateForStrict('gpt-6-luna'), [0.1, 0.5]);
  assert.deepEqual(rateForStrict('gpt-5.5-pro'), [30, 180]);          // was gpt-5.5 [5,30]
  assert.deepEqual(rateForStrict('gpt-5.4-pro'), [30, 180]);          // was gpt-5.4 [2.5,15]
  assert.deepEqual(rateForStrict('gemini-3.5-flash-lite'), [0.3, 2.5]); // GEMINI31-RATES-2026-09-001 (was 3.5-flash [1.5,9])
  assert.deepEqual(rateForStrict('gemini-3.1-flash-lite'), [0.25, 1.5]);
  assert.deepEqual(rateForStrict('gemini-3.1-pro-preview'), [2, 12]);
  // The pins they sit above are undisturbed.
  assert.deepEqual(rateForStrict('claude-opus-5'), [5, 25]);
  assert.deepEqual(rateForStrict('claude-sonnet-5'), [2, 10]);
  assert.deepEqual(rateForStrict('gpt-5.5'), [5, 30]);
  assert.deepEqual(rateForStrict('gpt-5.4-mini'), [0.75, 4.5]);
  assert.deepEqual(rateForStrict('gemini-3.5-flash'), [1.5, 9]);
});

test('the ids shipped since the 09-29 pass are priced ahead of adoption (2026-10-01 cross-check)', async () => {
  const { rateForStrict } = await import(pathToFileURL(MIRROR).href);
  assert.deepEqual(rateForStrict('gemini-3.7-flash'), [0.75, 3.75]); // GEMINI36-37-RATES-2026-10-001 (was null / fallback [3,15])
  assert.deepEqual(rateForStrict('gemini-3.6-flash'), [0.75, 3.75]);
  assert.deepEqual(rateForStrict('gemini-3.8-flash'), [0.75, 3.75]);
});

test('the ids shipped since the 10-01 pass are priced ahead of adoption (2026-10-08 tune)', async () => {
  const { rateForStrict } = await import(pathToFileURL(MIRROR).href);
  assert.deepEqual(rateForStrict('claude-haiku-5-5'), [0.1, 0.5]);    // ANTHROPIC-HAIKU55-RATES-2026-10-001 (was null / fallback [3,15])
  assert.deepEqual(rateForStrict('mistral-large-4'), [0.68, 2.09]);   // MISTRAL-LARGE4-RATES-2026-10-001 (was mistral-large [0.5,1.5])
  assert.deepEqual(rateForStrict('mistral-large-4-0'), [0.68, 2.09]);
  assert.deepEqual(rateForStrict('mistral-large-latest'), [0.5, 1.5]); // the live pin still aliases Large 3 (mistral-large-2512)
  assert.deepEqual(rateForStrict('gpt-5.5-cyber'), [12.5, 75]);     // GPT-CYBER-RATES-2026-10-001 (was gpt-5.5 [5,30])
  assert.deepEqual(rateForStrict('gpt-5.6-cyber'), [12.5, 75]);     // (was gpt-5 [1.25,10])
  assert.deepEqual(rateForStrict('gpt-5.5'), [5, 30]);
});

test('the ids shipped since the 10-08 pass are priced ahead of adoption (2026-10-15 tune)', async () => {
  const { rateForStrict } = await import(pathToFileURL(MIRROR).href);
  assert.deepEqual(rateForStrict('gemini-4-argon'), [2, 10]);         // GEMINI4-ARGON-RATES-2026-10-001 (was null / fallback [3,15]); doubles to [4,20] on 2026-12-01
  assert.deepEqual(rateForStrict('gemini-3.8-flash'), [0.75, 3.75]);
  assert.deepEqual(rateForStrict('gemini-2.5-flash'), [0.3, 2.5]);
});

test('the strict lookup refuses to guess an unknown model', async () => {
  const { rateForStrict, rateFor } = await import(pathToFileURL(MIRROR).href);
  assert.equal(rateForStrict('some-model-nobody-has-shipped'), null);
  assert.equal(rateForStrict(''), null);
  assert.equal(rateForStrict(null), null);
  // rateFor keeps guessing Sonnet — right for the demo cap, wrong for telemetry.
  assert.deepEqual(rateFor('some-model-nobody-has-shipped'), [3, 15]);
});

test('telemetry prices from the table before it trusts the client', () => {
  const src = readFileSync(path.join(ROOT, 'workers', 'access-relay', 'src', 'telemetry.js'), 'utf8');
  assert.match(src, /import \{ rateForStrict \} from '\.\/model-rates\.js'/,
    'telemetry.js no longer imports the rate table');
  const fn = src.slice(src.indexOf('async function estimateCostUsd'),
                       src.indexOf('export async function insertLlmCall'));
  assert.ok(fn.indexOf('rateForStrict(model)') !== -1, 'the local rate table is not consulted');
  assert.ok(fn.indexOf('rateForStrict(model)') < fn.lastIndexOf('asFloat(fallbackUsd)'),
    'the client-reported cost must be the LAST resort, after the rate table');
  assert.match(fn, /console\.warn/,
    'falling back to the client-reported cost must be logged, not silent');
});

// ------------------------------------------------------------
// 2026-10-15 (weekly tune, owner follow-up) — MODEL-TABLE-SWEEP-2026-10-001.
// The owner noticed the vendors had shipped more ids than the tune priced; earlier passes
// deferred anything that was 'not a pin'. This block pins EVERY text id on the four vendor
// pricing pages (as read 2026-10-15, plus the Mistral /v1/models alias list) to its vendor
// rate, so a missing key can no longer hide behind a shorter neighbour or the fallback.
// Re-verify the whole list at every tune; add a row for every id a vendor adds.

const VENDOR_CATALOGUE_2026_10_15 = [
  // Anthropic — platform.claude.com/docs/en/about-claude/pricing (nothing unpriced this pass)
  ['claude-fable-5-1', [10, 50]], ['claude-mythos-5-1', [10, 50]], ['claude-fable-5', [10, 50]], ['claude-mythos-5', [10, 50]],
  ['claude-opus-5-5', [4, 20]], ['claude-opus-5', [5, 25]], ['claude-opus-4-8', [5, 25]], ['claude-opus-4-7', [5, 25]],
  ['claude-opus-4-6', [5, 25]], ['claude-opus-4-5', [5, 25]], ['claude-opus-4-1', [15, 75]], ['claude-opus-4', [15, 75]],
  ['claude-sonnet-5-5', [2, 10]], ['claude-sonnet-5', [2, 10]], ['claude-sonnet-4-6', [3, 15]], ['claude-sonnet-4-5', [3, 15]],
  ['claude-sonnet-4', [3, 15]], ['claude-haiku-5-5', [0.10, 0.50]], ['claude-haiku-4-5', [1, 5]], ['claude-3-5-haiku', [0.80, 4]],
  // OpenAI — developers.openai.com/api/docs/pricing (standard tier, short context)
  ['gpt-6-astra', [10, 50]], ['gpt-6.1-sol', [2, 10]], ['gpt-6-luna', [0.10, 0.50]], ['gpt-6-sol', [2, 10]],
  ['gpt-5.6-sol', [4, 20]], ['gpt-5.6-terra', [2, 12]], ['gpt-5.6-luna', [0.20, 1.20]],
  ['gpt-5.5', [5, 30]], ['gpt-5.5-pro', [30, 180]], ['gpt-5.4', [2.50, 15]], ['gpt-5.4-mini', [0.75, 4.50]],
  ['gpt-5.4-nano', [0.20, 1.25]], ['gpt-5.4-pro', [30, 180]], ['gpt-5.2', [1.75, 14]], ['gpt-5.2-pro', [21, 168]],
  ['gpt-5.1', [1.25, 10]], ['gpt-5', [1.25, 10]], ['gpt-5-mini', [0.25, 2]], ['gpt-5-nano', [0.05, 0.40]], ['gpt-5-pro', [15, 120]],
  ['gpt-4.1', [2, 8]], ['gpt-4.1-mini', [0.40, 1.60]], ['gpt-4.1-nano', [0.10, 0.40]],
  ['gpt-4o', [2.50, 10]], ['gpt-4o-2024-05-13', [5, 15]], ['gpt-4o-2024-11-20', [2.50, 10]], ['gpt-4o-mini', [0.15, 0.60]],
  ['o1', [15, 60]], ['o1-pro', [150, 600]], ['o3-pro', [20, 80]], ['o3', [2, 8]], ['o4-mini', [1.10, 4.40]], ['o3-mini', [1.10, 4.40]],
  ['gpt-4-turbo-2024-04-09', [10, 30]], ['gpt-4-0613', [30, 60]], ['gpt-3.5-turbo', [0.50, 1.50]], ['gpt-3.5-turbo-0125', [0.50, 1.50]],
  ['gpt-3.5-turbo-1106', [1, 2]], ['gpt-3.5-turbo-instruct', [1.50, 2]], ['davinci-002', [2, 2]], ['babbage-002', [0.40, 0.40]],
  ['chat-latest', [5, 30]], ['gpt-5.3-codex', [1.75, 14]], ['gpt-5-search-api', [1.25, 10]],
  ['gpt-5.6-cyber', [12.50, 75]], ['gpt-5.5-cyber', [12.50, 75]],
  // Mistral — docs.mistral.ai/inference/pricing, ids from GET /v1/models 2026-10-15
  ['mistral-large-4', [0.68, 2.09]], ['mistral-large-4-0', [0.68, 2.09]], ['mistral-large-latest', [0.50, 1.50]], ['mistral-large-2512', [0.50, 1.50]],
  ['mistral-medium-latest', [1.50, 7.50]], ['mistral-medium-2604', [1.50, 7.50]], ['magistral-medium-latest', [1.50, 7.50]],
  ['mistral-vibe-cli-latest', [1.50, 7.50]], ['mistral-vibe-cli-with-tools', [1.50, 7.50]], ['mistral-vibe-cli-fast', [0.15, 0.60]],
  ['mistral-small-latest', [0.15, 0.60]], ['mistral-small-2603', [0.15, 0.60]], ['magistral-small-latest', [0.15, 0.60]],
  ['ministral-14b-2512', [0.20, 0.20]], ['ministral-14b-latest', [0.20, 0.20]], ['ministral-8b-2512', [0.15, 0.15]],
  ['ministral-8b-latest', [0.15, 0.15]], ['ministral-3b-2512', [0.10, 0.10]], ['ministral-3b-latest', [0.10, 0.10]],
  ['codestral-2508', [0.30, 0.90]], ['codestral-latest', [0.30, 0.90]], ['mistral-code-latest', [0.30, 0.90]],
  ['mistral-code-fim-latest', [0.30, 0.90]], ['codestral-embed', [0.15, 0]], ['codestral-embed-2505', [0.15, 0]],
  ['zai-glm-5-3', [1.40, 4.40]], ['zai-glm-5', [1.40, 4.40]], ['zai-glm-latest', [1.40, 4.40]], ['zai-glm-5-2', [1.40, 4.40]], ['glm-5-2', [1.40, 4.40]],
  // Gemini — ai.google.dev/gemini-api/docs/pricing (paid tier, base text rate; promo prices as in effect 2026-10-15)
  ['gemini-4-argon', [2, 10]], ['gemini-3.8-flash', [0.75, 3.75]], ['gemini-3.7-flash', [0.75, 3.75]], ['gemini-3.6-flash', [0.75, 3.75]],
  ['gemini-3.8-live', [0.75, 4.50]], ['gemini-3.8-live-extended-thinking', [0.75, 4.50]], ['gemini-3.1-flash-live-preview', [0.75, 4.50]],
  ['gemini-3.5-flash', [1.50, 9]], ['gemini-3.5-flash-lite', [0.30, 2.50]], ['gemini-3.1-flash-lite', [0.25, 1.50]],
  ['gemini-omni-1.1-flash', [1.50, 9]], ['gemini-omni-flash-preview', [1.50, 9]],
  ['gemini-3.1-pro-preview', [2, 12]], ['gemini-3.1-pro-preview-customtools', [2, 12]], ['gemini-3-flash-preview', [0.50, 3]],
  ['gemini-2.5-pro', [1.25, 10]], ['gemini-2.5-flash', [0.30, 2.50]], ['gemini-2.5-flash-lite', [0.10, 0.40]],
];

test('every text id on the four vendor pricing pages has a strict rate (MODEL-TABLE-SWEEP-2026-10-001)', async () => {
  const { rateForStrict } = await import(pathToFileURL(MIRROR).href);
  const bad = [];
  for (const [id, rate] of VENDOR_CATALOGUE_2026_10_15) {
    const got = rateForStrict(id);
    if (!got || got[0] !== rate[0] || got[1] !== rate[1]) bad.push(`${id}: got ${JSON.stringify(got)} want [${rate}]`);
  }
  assert.deepEqual(bad, [], 'ids the relay would still mis-meter or hand to the client-cost fallback:\n' + bad.join('\n'));
});
