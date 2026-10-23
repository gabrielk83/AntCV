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
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// The RATES literal is module-private; read the keys off the source text for the
// presence guard below (no export added — the mirror region must stay byte-identical).
function RATES_KEYS() {
  const src = readFileSync(new URL('../src/demo-enforcement.js', import.meta.url), 'utf8');
  const out = {};
  for (const m of src.matchAll(/^\s*'([a-z0-9.\-]+)':\s*\[/gm)) out[m[1]] = true;
  return out;
}
import { PROVIDER_MODELS } from '../src/multi-llm.js';

test('claude-opus-4-8 prices at opus-tier [5,25], not the legacy claude-opus-4 [15,75]', () => {
  assert.deepEqual(rateFor('claude-opus-4-8'), [5.00, 25.00]);
});

test('gpt-5.5 prices at [5,30] — the vendor number, not the shorter gpt-5 [1.25,10]', () => {
  // GPT55-RATE-2026-09-001 (2026-09-10): this pin asserted [30,60] from 2026-07 onward, and the
  // table asserted the same, so the test could never catch it — 1a-bis(iii) exists for exactly
  // this ("verify against the vendor's page, not the neighbouring table"). The real standard rate
  // on developers.openai.com/api/docs/pricing is $5 in / $30 out (<272K context); [30,60] was a
  // 6x OVER-price on input against the demo cap.
  assert.deepEqual(rateFor('gpt-5.5'), [5.00, 30.00]);
});

test('gpt-5.4-mini (the default openai gen model) prices at [0.75,4.5]', () => {
  assert.deepEqual(rateFor('gpt-5.4-mini'), [0.75, 4.50]);
});

test('claude-sonnet-5 (preferred cascade) prices at [2,10] — the launch price became the standard price', () => {
  // ANTHROPIC-RATES-2026-09-001: the table carried [3,15] as the "standard" rate on the
  // assumption the introductory $2/$10 would end 2026-08-31. Anthropic cancelled the rise
  // (pricing page note "claude-sonnet-5-introductory-pricing"), so [3,15] was a 1.5x
  // OVER-price on the demo cap and on every cost-quality score for the cascade model.
  assert.deepEqual(rateFor('claude-sonnet-5'), [2.00, 10.00]);
});

// ------------------------------------------------------------
// ANTHROPIC-RATES-2026-09-001 (2026-09-06) — the 5-generation ids Anthropic
// shipped after the last audit. None had a key, and unlike opus-4-8 they do
// not share a prefix with any legacy entry, so they fell all the way through
// to FALLBACK_RATE [3,15] (and rateForStrict() to null in the relay):
//   - "claude-opus-5"    -> [3,15] => 1.67x UNDER-price (real: [5,25])
//   - "claude-fable-5-1" -> [3,15] => 3.3x UNDER-price  (real: [10,50])
// Verified 2026-09-06 platform.claude.com/docs/en/about-claude/pricing.

test('claude-opus-5 prices at opus-tier [5,25], not the Sonnet fallback', () => {
  assert.deepEqual(rateFor('claude-opus-5'), [5.00, 25.00]);
});

test('claude-fable-5-1 prices at the Fable tier [10,50], not the Sonnet fallback', () => {
  assert.deepEqual(rateFor('claude-fable-5-1'), [10.00, 50.00]);
});

test('claude-fable-5 keeps its own entry (longest-key-wins: 5-1 must stay the longer key)', () => {
  assert.deepEqual(rateFor('claude-fable-5'), [10.00, 50.00]);
  // Regression guard for the ordering itself: if someone drops the 5-1 key, 5.1 silently
  // inherits whatever 5 costs. Both are [10,50] today; the guard is the presence, not the value.
  assert.ok(Object.prototype.hasOwnProperty.call(RATES_KEYS(), 'claude-fable-5-1'),
    'claude-fable-5-1 needs its own key so a future price split cannot land on claude-fable-5');
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
  assert.deepEqual(rateFor('gpt-5.5'), [5.00, 30.00]);
  assert.ok(!PROVIDER_MODELS.openai.includes('gpt-5.5'),
    'gpt-5.5 must stay out of the default chain - it is reached only via an explicit opts.models override');
  assert.ok(PROVIDER_MODELS.openai.includes('gpt-5.4-mini'),
    'the cheap default gen model must be in the cascade');
});

// ------------------------------------------------------------
// 2026-09-10 (weekly cost-quality tune, desktop cross-check) — the model ids
// each vendor shipped since the 09-06 pass. Every one of them was missing, and
// because rateFor() takes the LONGEST substring match, "missing" is never inert:
//   - "claude-mythos-5"/"-5-1" -> no key at all -> FALLBACK_RATE [3,15]  (real [10,50], 3.3x UNDER)
//   - "gpt-6-astra"            -> no key at all -> FALLBACK_RATE [3,15]  (real [10,50], 3.3x UNDER)
//   - "gpt-5.6-sol"            -> the shorter "gpt-5" [1.25,10]          (real [4,20],  3.2x UNDER in)
//   - "gpt-5.6-luna"           -> the shorter "gpt-5" [1.25,10]          (real [0.20,1.20], 6.25x OVER in)
//   - "gemini-3.8-flash"       -> no key at all -> FALLBACK_RATE [3,15]  (real [0.75,3.75], 4x OVER)
// An OVER-price demotes a provider in the weekly tune and an UNDER-price hides
// demo-cap burn, so both directions steer the router (1a-bis(iv)). Verified
// 2026-09-10 against platform.claude.com, developers.openai.com and ai.google.dev.

test('claude-mythos-5-1 prices at the Mythos/Fable tier [10,50], not the Sonnet fallback', () => {
  assert.deepEqual(rateFor('claude-mythos-5-1'), [10.00, 50.00]);
});

test('claude-mythos-5 keeps its own entry (longest-key-wins: 5-1 must stay the longer key)', () => {
  assert.deepEqual(rateFor('claude-mythos-5'), [10.00, 50.00]);
  assert.ok(Object.prototype.hasOwnProperty.call(RATES_KEYS(), 'claude-mythos-5-1'),
    'claude-mythos-5-1 needs its own key so a future price split cannot land on claude-mythos-5');
});

test('gpt-6-astra prices at [10,50] instead of falling through to FALLBACK_RATE', () => {
  assert.deepEqual(rateFor('gpt-6-astra'), [10.00, 50.00]);
});

test('the gpt-5.6 line lifts off the shorter gpt-5 key in BOTH directions', () => {
  assert.deepEqual(rateFor('gpt-5.6-sol'), [4.00, 20.00]);
  assert.deepEqual(rateFor('gpt-5.6-terra'), [2.00, 12.00]);
  // luna is the one that was OVER-priced by the gpt-5 fallback, not under.
  assert.deepEqual(rateFor('gpt-5.6-luna'), [0.20, 1.20]);
  // The shorter key must still answer for plain gpt-5 — the new keys are additive.
  assert.deepEqual(rateFor('gpt-5'), [1.25, 10.00]);
});

test('the gpt-5.6 / gpt-6 ids are priced but stay OUT of the default openai cascade', () => {
  // Same rule as gpt-5.5 (1a-bis(ii)): pricing a model is not adopting it. Heading or
  // tailing the default chain with a $10/$50 model is a cost regression, not a fix.
  for (const id of ['gpt-6-astra', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna']) {
    assert.ok(!PROVIDER_MODELS.openai.includes(id),
      `${id} must stay out of the default chain — it is reached only via an explicit opts.models override`);
  }
});

test('the Gemini 3 line is priced instead of inheriting the [3,15] Sonnet fallback', () => {
  assert.deepEqual(rateFor('gemini-3.8-flash'), [0.75, 3.75]);
  assert.deepEqual(rateFor('gemini-3.5-flash'), [1.50, 9.00]);
  // The 2.5 line must be untouched by the additions.
  assert.deepEqual(rateFor('gemini-2.5-flash'), [0.30, 2.50]);
  assert.deepEqual(rateFor('gemini-2.5-flash-lite'), [0.10, 0.40]);
});

test('gemini-3.8-flash carries its promotional-expiry note (re-verify from 2027-01-01)', () => {
  // The [0.75,3.75] rate is promotional through 2026-12-31 and doubles to [1.50,7.50] on
  // 2027-01-01. A dated comment is the only thing that will make the first tune of 2027
  // re-check it, so pin the comment's presence, not just the number.
  const src = readFileSync(new URL('../src/demo-enforcement.js', import.meta.url), 'utf8');
  const i = src.indexOf("'gemini-3.8-flash'");
  assert.ok(i > 0, 'the gemini-3.8-flash RATES entry is missing');
  assert.ok(src.slice(i, i + 240).includes('2027-01-01'),
    'the gemini-3.8-flash entry must keep its 2027-01-01 price-rise note');
});

// ------------------------------------------------------------
// 2026-09-29 (weekly cost-quality tune) — ids shipped since the 09-10 pass. The
// sharp ones sit on an EXISTING key's prefix, so longest-key-wins handed them a
// sibling's rate rather than the fallback:
//   - "claude-opus-5-5"       -> "claude-opus-5" [5,25]      (real [4,20], 1.25x OVER)
//   - "gpt-5.5-pro"           -> "gpt-5.5" [5,30]            (real [30,180], 6x UNDER)
//   - "gpt-5.4-pro"           -> "gpt-5.4" [2.5,15]          (real [30,180], 12x UNDER)
//   - "gemini-3.5-flash-lite" -> "gemini-3.5-flash" [1.5,9]  (real [0.30,2.50], 5x OVER in)
//   - "gpt-6-luna"            -> FALLBACK_RATE [3,15]        (real [0.10,0.50], 30x OVER)
// Verified 2026-09-29 against platform.claude.com, developers.openai.com and ai.google.dev.

test('claude-opus-5-5 prices at [4,20], not its claude-opus-5 sibling [5,25]', () => {
  assert.deepEqual(rateFor('claude-opus-5-5'), [4.00, 20.00]);
  assert.deepEqual(rateFor('claude-opus-5'), [5.00, 25.00]);
});

test('claude-sonnet-5-5 has its own key (same rate as sonnet-5 today; a split must not drift)', () => {
  assert.deepEqual(rateFor('claude-sonnet-5-5'), [2.00, 10.00]);
  assert.ok(Object.prototype.hasOwnProperty.call(RATES_KEYS(), 'claude-sonnet-5-5'),
    'claude-sonnet-5-5 needs its own key so a future price split cannot land on claude-sonnet-5');
});

test('the -pro tiers lift off the PINNED gpt-5.5 / gpt-5.4 keys', () => {
  assert.deepEqual(rateFor('gpt-5.5-pro'), [30.00, 180.00]);
  assert.deepEqual(rateFor('gpt-5.4-pro'), [30.00, 180.00]);
  // The pins they sit above are undisturbed.
  assert.deepEqual(rateFor('gpt-5.5'), [5.00, 30.00]);
  assert.deepEqual(rateFor('gpt-5.4'), [2.50, 15.00]);
  assert.deepEqual(rateFor('gpt-5.4-mini'), [0.75, 4.50]);
});

test('the GPT-6 sol / luna ids are priced instead of inheriting the [3,15] fallback', () => {
  assert.deepEqual(rateFor('gpt-6-sol'), [2.00, 10.00]);
  assert.deepEqual(rateFor('gpt-6.1-sol'), [2.00, 10.00]);
  assert.deepEqual(rateFor('gpt-6-luna'), [0.10, 0.50]);
  assert.deepEqual(rateFor('gpt-6-astra'), [10.00, 50.00]);
});

test('Gemini 3.5 Flash-Lite lifts off the 3.5 Flash key; 3.1 Flash-Lite + 3.1 Pro are priced', () => {
  assert.deepEqual(rateFor('gemini-3.5-flash-lite'), [0.30, 2.50]);
  assert.deepEqual(rateFor('gemini-3.5-flash'), [1.50, 9.00]);
  assert.deepEqual(rateFor('gemini-3.1-flash-lite'), [0.25, 1.50]);
  assert.deepEqual(rateFor('gemini-3.1-pro-preview'), [2.00, 12.00]);
});

test('the 2026-09-29 ids are priced but stay OUT of the default cascades', () => {
  for (const id of ['gpt-6-sol', 'gpt-6.1-sol', 'gpt-6-luna', 'gpt-5.5-pro', 'gpt-5.4-pro']) {
    assert.ok(!PROVIDER_MODELS.openai.includes(id), `${id} must stay out of the default openai chain`);
  }
  // claude-opus-5-5 WAS here until the owner adopted it the same day (OPUS55-ADOPT-001) — see the cascade test below.
  for (const id of ['claude-sonnet-5-5']) {
    assert.ok(!PROVIDER_MODELS.anthropic.includes(id), `${id} adoption is an owner call, not a pricing side effect`);
  }
});

// ------------------------------------------------------------
// OPUS55-ADOPT-001 (owner 2026-09-29): claude-opus-5-5 replaces claude-opus-4-8 as the
// flagship gen pin. Opus 5.5 keeps thinking ON (thinking:disabled and budget_tokens = 400),
// so the cascade must (a) never send it thinking:disabled, (b) read the TEXT block, not
// content[0], which is the thinking block.
import { SONNET5_THINK_OFF, ALWAYS_THINKING, anthropicText } from '../src/multi-llm.js';

test('claude-opus-5-5 heads the opus tier of the anthropic cascade; opus-4-8 stays as the next fallback', () => {
  const a = PROVIDER_MODELS.anthropic;
  assert.ok(a.includes('claude-opus-5-5'));
  assert.ok(a.indexOf('claude-opus-5-5') < a.indexOf('claude-opus-4-8'));
  assert.equal(a[0], 'claude-sonnet-5', 'the cascade head is unchanged — adoption is the opus slot only');
});

test('thinking:disabled is sent to Sonnet 5.0 only — never to the always-thinking 5.5 / Fable / Mythos ids', () => {
  assert.ok(SONNET5_THINK_OFF.test('claude-sonnet-5'));
  for (const m of ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-fable-5-1', 'claude-mythos-5']) {
    assert.ok(!SONNET5_THINK_OFF.test(m), m + ' would get thinking:disabled and 400');
    assert.ok(ALWAYS_THINKING.test(m), m + ' must be treated as always-thinking');
  }
  for (const m of ['claude-opus-5', 'claude-opus-4-8', 'claude-sonnet-4-6']) assert.ok(!ALWAYS_THINKING.test(m), m);
});

test('anthropicText skips the leading thinking block', () => {
  assert.equal(anthropicText({ content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: '{"ok":1}' }] }), '{"ok":1}');
  assert.equal(anthropicText({ content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] }), 'ab');
  assert.equal(anthropicText({}), '');
});

test('the pass-through guard uses the same Sonnet-5.0-only pattern (no thinking:disabled for sonnet-5-5)', () => {
  const src = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  assert.ok(src.includes(String.raw`/claude-sonnet-5(?![-.]?\d)/.test(body.model)`), 'index.js pass-through regex drifted');
  assert.ok(!src.includes('/claude-sonnet-5/.test(body.model)'), 'the old over-broad /claude-sonnet-5/ guard is back');
});

// ------------------------------------------------------------
// 2026-10-01 (desktop cross-check of the 09-29 tune) — GEMINI36-37-RATES-2026-10-001.
// Two more Gemini 3 Flash ids on ai.google.dev, same promotional price as 3.8-flash:
//   - "gemini-3.7-flash" -> no key -> FALLBACK_RATE [3,15]  (real [0.75,3.75], 4x OVER)
//   - "gemini-3.6-flash" -> no key -> FALLBACK_RATE [3,15]  (real [0.75,3.75], 4x OVER)

test('gemini-3.7-flash / 3.6-flash are priced instead of inheriting the [3,15] fallback', () => {
  assert.deepEqual(rateFor('gemini-3.7-flash'), [0.75, 3.75]);
  assert.deepEqual(rateFor('gemini-3.6-flash'), [0.75, 3.75]);
  // Neighbours undisturbed.
  assert.deepEqual(rateFor('gemini-3.8-flash'), [0.75, 3.75]);
  assert.deepEqual(rateFor('gemini-3.5-flash'), [1.50, 9.00]);
  assert.deepEqual(rateFor('gemini-2.5-flash'), [0.30, 2.50]);
});

test('the 2026-10-01 Gemini ids are priced but stay OUT of the default gemini cascade', () => {
  for (const id of ['gemini-3.7-flash', 'gemini-3.6-flash']) {
    assert.ok(!PROVIDER_MODELS.gemini.includes(id), `${id} adoption is an owner call, not a pricing side effect`);
  }
});

// ------------------------------------------------------------
// 2026-10-08 (weekly tune) — ANTHROPIC-HAIKU55-RATES-2026-10-001 + MISTRAL-LARGE4-RATES-2026-10-001.
//   - "claude-haiku-5-5" -> no key          -> FALLBACK_RATE [3,15] (real [0.10,0.50] at <=100k tokens: 30x OVER on input)
//   - "mistral-large-4"  -> 'mistral-large' -> [0.5,1.5]            (real SALE [0.68,2.09], list [1.36,4.18]: UNDER-priced)
// The live mistral pin is unaffected: 'mistral-large-latest' aliases 'mistral-large-2512' (Large 3) per /v1/models 2026-10-08.

test('claude-haiku-5-5 is priced at its <=100k tier instead of inheriting the [3,15] fallback', () => {
  assert.deepEqual(rateFor('claude-haiku-5-5'), [0.10, 0.50]);
  assert.ok(RATES_KEYS()['claude-haiku-5-5'], 'explicit key missing');
  // Neighbours undisturbed.
  assert.deepEqual(rateFor('claude-haiku-4-5'), [1.00, 5.00]);
  assert.deepEqual(rateFor('claude-3-5-haiku'), [0.80, 4.00]);
});

test('mistral-large-4 lifts off the Large 3 key; the live -latest alias still prices as Large 3', () => {
  assert.deepEqual(rateFor('mistral-large-4'), [1.36, 4.18]);
  assert.deepEqual(rateFor('mistral-large-4-0'), [1.36, 4.18]);
  assert.deepEqual(rateFor('mistral-large-latest'), [0.50, 1.50]);
  assert.deepEqual(rateFor('mistral-large-2512'), [0.50, 1.50]);
  assert.deepEqual(rateFor('mistral-large-2411'), [0.50, 1.50]);
});

test('the Cyber tiers lift off the PINNED gpt-5.5 key and the shorter gpt-5 key', () => {
  assert.deepEqual(rateFor('gpt-5.5-cyber'), [12.50, 75.00]);
  assert.deepEqual(rateFor('gpt-5.6-cyber'), [12.50, 75.00]);
  // The pins they sit above are undisturbed.
  assert.deepEqual(rateFor('gpt-5.5'), [5.00, 30.00]);
  assert.deepEqual(rateFor('gpt-5.5-pro'), [30.00, 180.00]);
  assert.deepEqual(rateFor('gpt-5.6-sol'), [4.00, 20.00]);
});

test('the 2026-10-08 ids are priced but stay OUT of the default cascades', () => {
  assert.ok(!PROVIDER_MODELS.anthropic.includes('claude-haiku-5-5'), 'haiku-5-5 adoption is an owner call, not a pricing side effect');
  for (const id of ['gpt-5.5-cyber', 'gpt-5.6-cyber']) {
    assert.ok(!PROVIDER_MODELS.openai.includes(id), id + ' must stay out of the default openai chain');
  }
  for (const id of ['mistral-large-4', 'mistral-large-4-0']) {
    assert.ok(!PROVIDER_MODELS.mistral.includes(id), id + ' adoption is an owner call, not a pricing side effect');
  }
});

// ------------------------------------------------------------
// 2026-10-15 (weekly tune) — GEMINI4-ARGON-RATES-2026-10-001.
// Gemini 4 Argon is the new flagship on ai.google.dev at an INTRODUCTORY [2,10] (doubles to [4,20] on 2026-12-01):
//   - "gemini-4-argon" -> no key -> FALLBACK_RATE [3,15]  (real [2,10], 1.5x OVER in and out)

test('gemini-4-argon is priced at the introductory [2,10] instead of inheriting the [3,15] fallback', () => {
  assert.deepEqual(rateFor('gemini-4-argon'), [2.00, 10.00]);
  // Neighbours undisturbed.
  assert.deepEqual(rateFor('gemini-3.8-flash'), [0.75, 3.75]);
  assert.deepEqual(rateFor('gemini-2.5-flash'), [0.30, 2.50]);
  assert.deepEqual(rateFor('gemini-2.5-pro'), [1.25, 10.00]);
});

test('gemini-4-argon carries its 2026-12-01 price-doubling note (re-verify after that date)', () => {
  const src = readFileSync(new URL('../src/demo-enforcement.js', import.meta.url), 'utf8');
  const i = src.indexOf("'gemini-4-argon'");
  assert.ok(i > 0, 'the gemini-4-argon RATES entry is missing');
  assert.ok(/2026-12-01/.test(src.slice(i, i + 240)),
    'the gemini-4-argon entry must keep its 2026-12-01 price-doubling note');
});

test('gemini-4-argon is priced but stays OUT of the default gemini cascade', () => {
  assert.ok(!PROVIDER_MODELS.gemini.includes('gemini-4-argon'), 'adoption is an owner call, not a pricing side effect');
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
  ['mistral-large-4', [1.36, 4.18]], ['mistral-large-4-0', [1.36, 4.18]], ['mistral-large-latest', [0.50, 1.50]], ['mistral-large-2512', [0.50, 1.50]],
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

test('every text id on the four vendor pricing pages resolves to its vendor rate (MODEL-TABLE-SWEEP-2026-10-001)', () => {
  const bad = [];
  for (const [id, rate] of VENDOR_CATALOGUE_2026_10_15) {
    const got = rateFor(id);
    if (got[0] !== rate[0] || got[1] !== rate[1]) bad.push(`${id}: got [${got}] want [${rate}]`);
  }
  assert.deepEqual(bad, [], 'ids that still resolve to a neighbour or the fallback:\n' + bad.join('\n'));
});

test('the short o-series keys are not substrings of any other catalogued id', () => {
  for (const short of ['o1', 'o3']) {
    for (const [id] of VENDOR_CATALOGUE_2026_10_15) {
      if (id === short || id.startsWith(short + '-')) continue;
      assert.ok(!id.includes(short), `'${short}' would hijack ${id}`);
    }
  }
});

test('the 2026-10-15 sweep priced ids but adopted none into a default cascade', () => {
  const sweep = ['gpt-5.2', 'gpt-5.2-pro', 'gpt-5-pro', 'gpt-5-nano', 'gpt-5.3-codex', 'chat-latest', 'o1', 'o3', 'o4-mini',
    'ministral-14b-latest', 'magistral-medium-latest', 'zai-glm-5-3', 'codestral-latest',
    'gemini-3-flash-preview', 'gemini-omni-1.1-flash', 'gemini-3.8-live'];
  for (const id of sweep) {
    for (const [prov, list] of Object.entries(PROVIDER_MODELS)) {
      assert.ok(!list.includes(id), `${id} entered the ${prov} cascade — adoption is an owner call`);
    }
  }
});

// ------------------------------------------------------------
// 2026-10-23 (weekly tune) — MISTRAL-LARGE4-SALE-END + ZAI-GLM53-FLASH-RATES + GPT-ROSALIND-RATES (2026-10-001).
// The Large 4 sale ended (list [1.36,4.18]; the catalogue row above is corrected to the vendor rate, not trimmed).
// Two ids appeared on the vendor pages since 10-15:
//   - "zai-glm-5-3-flash"     -> 'zai-glm' [1.4,4.4]  (real [0.15,0.50]: 9x OVER)
//   - "gpt-rosalind-research" -> FALLBACK [3,15]       (real [5,25]: 1.67x UNDER)

const VENDOR_CATALOGUE_2026_10_23 = [
  ['zai-glm-5-3-flash', [0.15, 0.50]], ['gpt-rosalind-research', [5, 25]], ['gpt-rosalind-discovery', [5, 25]],
];

test('the 2026-10-23 vendor additions resolve to their vendor rate', () => {
  for (const [id, rate] of VENDOR_CATALOGUE_2026_10_23) assert.deepEqual(rateFor(id), rate, id);
  // Neighbours undisturbed.
  assert.deepEqual(rateFor('zai-glm-5-3'), [1.40, 4.40]);
  assert.deepEqual(rateFor('mistral-large-latest'), [0.50, 1.50]);
});

test('the 2026-10-23 ids are priced but stay OUT of the default cascades', () => {
  for (const [id] of VENDOR_CATALOGUE_2026_10_23) {
    for (const [prov, list] of Object.entries(PROVIDER_MODELS)) {
      assert.ok(!list.includes(id), `${id} entered the ${prov} cascade — adoption is an owner call`);
    }
  }
});
