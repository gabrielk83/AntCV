// model-roles.test.mjs
// ============================================================
// GEN-MODELROLE-001 v1 (fail-soft role-specialized cascade head).
// Locks the resolver semantics:
//  - no MODEL_ROLES env / malformed JSON / unknown providers -> null map,
//    order returned untouched (byte-identical pre-feature behaviour);
//  - a valid map moves the role's provider to the cascade HEAD and keeps
//    every other provider in relative order (reorder, never remove);
//  - call sites carry the right roles (supervisor check -> supervisor,
//    auto-repair -> writer, coherence review -> coherence, writer-head
//    reorder in both index.js fallback wrappers);
//  - proxy and demo-proxy mirrors of multi-llm.js + supervisor.js stay
//    byte-identical (dual-sync invariant).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseModelRoles, roleHeadOrder, DEFAULT_ORDER } from '../src/multi-llm.js';

const MAP = '{"writer":"anthropic","supervisor":"mistral","coherence":"anthropic"}';

test('parseModelRoles: absent / malformed / junk -> null (fail-soft)', () => {
  assert.equal(parseModelRoles(undefined), null);
  assert.equal(parseModelRoles({}), null);
  assert.equal(parseModelRoles({ MODEL_ROLES: '' }), null);
  assert.equal(parseModelRoles({ MODEL_ROLES: 'not json' }), null);
  assert.equal(parseModelRoles({ MODEL_ROLES: '[1,2]' }), null);
  assert.equal(parseModelRoles({ MODEL_ROLES: '{"writer":"yolo-llm"}' }), null);
});

test('parseModelRoles: valid map keeps only known roles + providers', () => {
  assert.deepEqual(parseModelRoles({ MODEL_ROLES: MAP }), {
    writer: 'anthropic', supervisor: 'mistral', coherence: 'anthropic',
  });
  // unknown role ignored, casing normalised, object value accepted
  assert.deepEqual(
    parseModelRoles({ MODEL_ROLES: { writer: 'OpenAI', butler: 'mistral' } }),
    { writer: 'openai' },
  );
});

test('roleHeadOrder: no map / no role -> base order untouched', () => {
  const base = ['gemini', 'openai'];
  assert.deepEqual(roleHeadOrder({}, 'supervisor', base), base);
  assert.deepEqual(roleHeadOrder({ MODEL_ROLES: MAP }, null, base), base);
  assert.deepEqual(roleHeadOrder({ MODEL_ROLES: MAP }, 'butler', base), base);
});

test('roleHeadOrder: role provider moves to the head, nothing removed', () => {
  const env = { MODEL_ROLES: MAP };
  assert.deepEqual(roleHeadOrder(env, 'supervisor', DEFAULT_ORDER),
    ['mistral', 'anthropic', 'openai', 'gemini']);
  // already at the head -> identity
  assert.deepEqual(roleHeadOrder(env, 'writer', DEFAULT_ORDER), DEFAULT_ORDER);
  // custom base orders are respected
  assert.deepEqual(roleHeadOrder(env, 'supervisor', ['gemini', 'mistral']),
    ['mistral', 'gemini']);
});

test('call sites carry the designed roles', async () => {
  const sup = await readFile(new URL('../src/supervisor.js', import.meta.url), 'utf8');
  const coh = await readFile(new URL('../src/gen-coherence.js', import.meta.url), 'utf8');
  // grounding check -> supervisor; auto-repair RE-WRITES prose -> writer
  assert.match(sup, /GROUNDING_SYSTEM, userPrompt, \{[\s\S]{0,400}?role: 'supervisor'/);
  assert.match(sup, /system, repairPrompt, \{[\s\S]{0,400}?role: 'writer'/);
  assert.match(coh, /role: 'coherence'/);
});

test('writer-head reorder present in BOTH provider-fallback wrappers', async () => {
  for (const rel of ['../src/index.js', '../../demo-proxy/src/index.js']) {
    const src = await readFile(new URL(rel, import.meta.url), 'utf8');
    assert.match(src, /parseModelRoles\(env\)/, rel);
    assert.match(src, /detectCVTask\(JSON\.parse\(new TextDecoder\(\)\.decode\(bodyBuf\)\)\)/, rel);
    assert.match(src, /order = \[writer\]\.concat\(order\.filter/, rel);
  }
});

test('dual-sync: multi-llm.js + supervisor.js byte-identical across proxies', async () => {
  for (const f of ['multi-llm.js', 'supervisor.js']) {
    const a = await readFile(new URL('../src/' + f, import.meta.url), 'utf8');
    const b = await readFile(new URL('../../demo-proxy/src/' + f, import.meta.url), 'utf8');
    assert.equal(a, b, f + ' drifted between proxy and demo-proxy');
  }
});
