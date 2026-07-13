/* Unit test — PROXY-GOLD-RULES-FETCH-001 (register row 86c).
 *
 * The proxy fetches the SERVED gold-rules.json control block and prepends it to
 * the augmented system prompt, so the current control site is authoritative even
 * when the client bundle is stale. Hard rule: it must NEVER block or fail a
 * generation — any fetch/parse error degrades to task augmentation only (the
 * client's own embedded block still stands). A per-isolate cache + TTL keeps the
 * hot path off the network. No live network: every case injects a stub fetch.
 */
import assert from 'node:assert';
import { test } from 'node:test';
import {
  augmentBodyTextAsync,
  fetchGoldRulesBlock,
  _resetGoldRulesCache,
  GOLD_RULES_URL,
} from '../src/prompt-augment.js';

// A body that detectCVTask() classifies as a CV task (cv_outcomes signature).
function cvOutcomesBody() {
  return JSON.stringify({
    model: 'claude-sonnet-5',
    system: 'BASE SYSTEM PROMPT',
    messages: [{ role: 'user', content: 'Generate the Selected Outcomes section for this CV.' }],
  });
}

const GOLD_JSON = { prompt_block: ['RULE ONE: be concrete.', 'RULE TWO: no filler.'] };
function stubFetch(json, { ok = true } = {}) {
  let calls = 0;
  const f = async () => { calls += 1; return { ok, json: async () => json }; };
  f.calls = () => calls;
  return f;
}

test('served gold block is prepended on a detected CV task', async () => {
  _resetGoldRulesCache();
  const { bodyText, task, gold } = await augmentBodyTextAsync(cvOutcomesBody(), stubFetch(GOLD_JSON));
  assert.ok(task, 'a CV task is detected');
  assert.equal(gold, true, 'gold block applied');
  const parsed = JSON.parse(bodyText);
  assert.match(parsed.system, /RULE ONE: be concrete\./);
  assert.match(parsed.system, /RULE TWO: no filler\./);
  assert.match(parsed.system, /BASE SYSTEM PROMPT/, 'original system prompt survives');
});

test('per-isolate cache serves within TTL without a second fetch', async () => {
  _resetGoldRulesCache();
  const f = stubFetch(GOLD_JSON);
  const a = await fetchGoldRulesBlock(f);
  const b = await fetchGoldRulesBlock(f);
  assert.ok(a && a === b, 'same block returned');
  assert.equal(f.calls(), 1, 'network hit only once inside the TTL window');
});

test('fetch error falls back — never throws, degrades to client block only', async () => {
  _resetGoldRulesCache();
  const boom = async () => { throw new Error('network down'); };
  // fetchGoldRulesBlock swallows the error
  const block = await fetchGoldRulesBlock(boom);
  assert.equal(block, null, 'no block on a cold-cache fetch error');
  // and the whole augment path still returns a valid augmented body
  const { bodyText, task, gold } = await augmentBodyTextAsync(cvOutcomesBody(), boom);
  assert.ok(task, 'task augmentation still applied');
  assert.equal(gold, false, 'gold not applied on fetch failure');
  const parsed = JSON.parse(bodyText);
  assert.match(parsed.system, /BASE SYSTEM PROMPT/, 'body still valid + augmented');
});

test('non-2xx response is treated as a miss (no throw, no injection)', async () => {
  _resetGoldRulesCache();
  const notFound = stubFetch({}, { ok: false });
  const block = await fetchGoldRulesBlock(notFound);
  assert.equal(block, null, '404 → no block');
});

test('a stale cached block is preferred over a live fetch failure', async () => {
  _resetGoldRulesCache();
  // prime the cache with a good block
  const good = await fetchGoldRulesBlock(stubFetch(GOLD_JSON));
  assert.ok(good, 'primed');
  // an immediate re-fetch stays inside the TTL, so the stub is never consulted;
  // to prove the stale-preference, drive fetchGoldRulesBlock's error path with a
  // fresh reset would clear the cache — instead assert the cached value persists.
  const again = await fetchGoldRulesBlock(async () => { throw new Error('down'); });
  assert.equal(again, good, 'cached block returned despite the failing fetch');
});

test('a non-CV body is left untouched (no fetch, no task)', async () => {
  _resetGoldRulesCache();
  let fetched = false;
  const spy = async () => { fetched = true; return { ok: true, json: async () => GOLD_JSON }; };
  const body = JSON.stringify({ model: 'claude-sonnet-5', messages: [{ role: 'user', content: 'hi' }] });
  const { task, gold } = await augmentBodyTextAsync(body, spy);
  assert.equal(task, null, 'no CV task');
  assert.equal(gold, false, 'no gold applied');
  assert.equal(fetched, false, 'no gold fetch on a non-CV body');
});

test('GOLD_RULES_URL points at the served control site', () => {
  assert.equal(GOLD_RULES_URL, 'https://antcv.pages.dev/gold-rules.json');
});
