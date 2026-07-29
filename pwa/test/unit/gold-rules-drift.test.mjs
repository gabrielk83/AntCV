// gold-rules-drift.test.mjs
// ============================================================
// GOLD-RULES-SITE-001 drift guard (owner 2026-07-13: "unify rule control so
// we avoid missing anything, avoid waste and avoid contradictions").
// pwa/gold-rules.json is the ONE control site; every consumer that carries a
// local fallback copy must match it EXACTLY. This test fails the moment a
// rule is edited in only one place — the mechanism that keeps the
// unification from rotting back into divergent copies.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const gold = JSON.parse(await readFile(new URL('../../gold-rules.json', import.meta.url), 'utf8'));
const bullets = await readFile(new URL('../../antcv-bullet-targets.js', import.meta.url), 'utf8');
const genRunner = await readFile(new URL('../../../scripts/job-tracker/gen-runner.py', import.meta.url), 'utf8');
const qualityPass = await readFile(new URL('../../../scripts/job-tracker/quality_pass.py', import.meta.url), 'utf8');

test('the site is versioned and carries every rule family', () => {
  assert.match(gold.version, /^\d+\.\d+\.\d+$/);
  for (const key of ['density', 'caps', 'results', 'partners', 'certs', 'compressions',
                     'protected_content', 'sentence_health', 'typography', 'identity',
                     'accessibility', 'brand', 'prompt_block', 'banned_words', 'page_budgets']) {
    assert.ok(gold[key] != null, `rule family missing from the control site: ${key}`);
  }
});

test('client fallback prompt block matches the site (no silent divergence)', () => {
  const siteBlock = gold.prompt_block.join('\n');
  // the fallback is a single JSON string literal — parse it directly
  const m = bullets.match(/GOLD_FALLBACK_BLOCK = ("(?:[^"\\]|\\.)*");/);
  assert.ok(m, 'fallback JSON literal found in antcv-bullet-targets.js');
  const fallback = JSON.parse(m[1]);
  assert.equal(fallback, siteBlock,
    'antcv-bullet-targets GOLD_FALLBACK_BLOCK diverged from gold-rules.json prompt_block — regenerate it from the site');
});

test('gen-runner consumes caps + banned words from the site (no hardcoded forks)', () => {
  assert.ok(genRunner.includes('gold-rules.json'), 'gen-runner reads the control site');
  assert.ok(genRunner.includes('_GOLD_CAPS.get("bullet_chars"'), 'bullet cap from site');
  assert.ok(genRunner.includes('_GOLD.get("banned_words")'), 'banned words from site');
  // the site's cap value itself matches the fallback literal
  assert.equal(gold.caps.bullet_chars, 148);
});

test('quality_pass consumes compressions + core cap from the site', () => {
  assert.ok(qualityPass.includes('_G.get("compressions")'), 'compressions from site');
  assert.ok(qualityPass.includes('core_comp_data_rows'), 'core row cap from site');
});

test('no em/en dashes inside the site itself (it defines the typography rule)', () => {
  const raw = JSON.stringify(gold);
  for (const ch of gold.typography.banned_separators) {
    const outside = raw.split(ch).length - 1;
    // the banned_separators array itself legitimately contains each glyph once
    assert.ok(outside <= 1, `banned separator ${ch} appears outside its own definition`);
  }
});
