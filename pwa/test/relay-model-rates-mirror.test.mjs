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
    'claude-sonnet-5', 'claude-opus-4-8',
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
  assert.deepEqual(rateForStrict('gpt-5.5'), [30, 60]);
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
