// image-routing-ee.test.mjs
// ============================================================
// LLM-IMAGE-ROUTING-001 (register row 30): the PWA ee() ladder must drop
// vision-blind providers (mistral) when the messages carry image content blocks.
// Both-bundle lock + a pure-logic check of the detector/filter.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../app.src.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');

test('app.src.js: ee() ladder drops mistral on image messages', () => {
  assert.match(src, /LLM-IMAGE-ROUTING-001/);
  assert.match(src, /const __hasImg = Array\.isArray\(e\) && e\.some/);
  assert.match(src, /l\.filter\(\(p\) => p !== "mistral"\)/);
});

test('app.js (minified): the same filter is mirrored', () => {
  assert.ok(app.includes('const __hi=Array.isArray(e)&&e.some'), 'minified detector present');
  assert.ok(app.includes('l.filter(p=>"mistral"!==p)'), 'minified mistral drop present');
});

// Pure-logic replica of the detector + filter to prove the intended behaviour.
function hasImg(msgs) {
  return Array.isArray(msgs) && msgs.some((m) => m && Array.isArray(m.content) && m.content.some((b) => b && typeof b === 'object' && (b.type === 'image' || (b.type === 'image_url' && b.image_url))));
}
function drop(ladder, msgs) {
  if (!hasImg(msgs)) return ladder;
  const v = ladder.filter((p) => p !== 'mistral');
  return v.length ? v : ladder;
}

test('detector + filter behaviour', () => {
  const ladder = ['mistral', 'anthropic', 'openai', 'gemini'];
  assert.deepEqual(drop(ladder, [{ role: 'user', content: 'text only' }]), ladder, 'text -> unchanged');
  assert.deepEqual(drop(ladder, [{ role: 'user', content: [{ type: 'text', text: 'hi' }, { type: 'image', source: { data: 'x' } }] }]), ['anthropic', 'openai', 'gemini'], 'image (anthropic block) -> mistral dropped');
  assert.deepEqual(drop(ladder, [{ role: 'user', content: [{ type: 'image_url', image_url: { url: 'data:...' } }] }]), ['anthropic', 'openai', 'gemini'], 'image_url object -> mistral dropped');
  assert.deepEqual(drop(['mistral'], [{ role: 'user', content: [{ type: 'image', source: {} }] }]), ['mistral'], 'guard: never empty the ladder');
});
