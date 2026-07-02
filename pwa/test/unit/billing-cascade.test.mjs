// billing-cascade.test.mjs
// ============================================================
// BILLING-CASCADE-001 (owner console 2026-07-03): anthropic returns
// OUT-OF-CREDIT as HTTP 400 ("Your credit balance is too low…"); the proxy's
// raw-passthrough cascade treated every 4xx as a caller error and STOPPED,
// so a billing failure on the SHARED server key hard-failed the call even
// though the other providers were funded (observed live: the orphan-preflight
// L3 call died on it). The fix continues the cascade when a 400/402/429
// response body carries key_source:"server" AND a billing/quota phrase.
// BYOK errors (key_source:"client") still return immediately, and
// demo_cap_reached (no key_source, no billing phrase) still stops the ladder.
// String-locks BOTH workers byte-identically + exercises the sniff regexes
// against the real observed bodies.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const proxy = await readFile(new URL('../../../workers/proxy/src/index.js', import.meta.url), 'utf8');
const demo  = await readFile(new URL('../../../workers/demo-proxy/src/index.js', import.meta.url), 'utf8');

const grab = (s) => {
  const i = s.indexOf('BILLING-CASCADE-001');
  const j = s.indexOf('if (!billingOnServerKey) return lastResp;', i);
  assert.ok(i > 0 && j > i, 'block present');
  return s.slice(i, j + 'if (!billingOnServerKey) return lastResp;'.length);
};

test('BILLING-CASCADE-001 block present and byte-identical in BOTH proxies', () => {
  assert.equal(grab(proxy), grab(demo));
});

test('sniff regexes: continue on the observed shared-key credit body', () => {
  const keyRe = /"key_source"\s*:\s*"server"/;
  const billRe = /credit balance|insufficient\s+(credit|funds?|balance|quota)|insufficient_quota|purchase credits|exceeded your current quota|OUT OF CREDIT|Plans & Billing/i;
  // the exact body observed live 2026-07-03
  const observed = JSON.stringify({
    error: 'anthropic returned 400', provider: 'anthropic', upstream_status: 400,
    upstream_error: 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.',
    key_source: 'server',
    hint: "anthropic's account is OUT OF CREDIT — the API returned 400 \"credit balance too low\".",
  });
  assert.ok(keyRe.test(observed) && billRe.test(observed), 'observed body cascades');
  // OpenAI insufficient_quota (429) on the server key cascades too
  const openai = '{"key_source":"server","upstream_error":"You exceeded your current quota, please check your plan and billing details.","error":"insufficient_quota"}';
  assert.ok(keyRe.test(openai) && billRe.test(openai));
});

test('sniff regexes: BYOK billing and demo cap do NOT cascade', () => {
  const keyRe = /"key_source"\s*:\s*"server"/;
  const billRe = /credit balance|insufficient\s+(credit|funds?|balance|quota)|insufficient_quota|purchase credits|exceeded your current quota|OUT OF CREDIT|Plans & Billing/i;
  // BYOK: billing phrase present but the key is the CALLER's — must surface
  const byok = '{"key_source":"client","upstream_error":"Your credit balance is too low to access the Anthropic API."}';
  assert.ok(!keyRe.test(byok), 'client key never matches the server-key predicate');
  assert.ok(billRe.test(byok), 'sanity: the phrase alone would match — the key predicate is the gate');
  // demo cap: no key_source, no billing phrase (cross-provider cap must stop the ladder)
  const cap = '{"error":"demo_cap_reached","message":"Demo cap reached: $0.586 of $0.50 used this month. Resets on 2026-08-01."}';
  assert.ok(!keyRe.test(cap) && !billRe.test(cap), 'cap body matches neither predicate');
});

test('preflight L3 parser reads all three fallback response shapes', async () => {
  const pf = await readFile(new URL('../../antcv-orphan-export-preflight.js', import.meta.url), 'utf8');
  assert.match(pf, /j\.content\[0\]\.text/);                       // anthropic
  assert.match(pf, /j\.choices\[0\]\.message\.content/);            // openai / mistral
  assert.match(pf, /j\.candidates\[0\]\.content\.parts\[0\]/);      // gemini
});

test('guard only re-reads 400/402/429 and never the last provider', () => {
  const block = grab(proxy);
  assert.match(block, /i < order\.length - 1/);
  assert.match(block, /status === 400 \|\| lastResp\.status === 402 \|\| lastResp\.status === 429/);
  assert.match(block, /lastResp\.clone\(\)\.text\(\)/);
});
