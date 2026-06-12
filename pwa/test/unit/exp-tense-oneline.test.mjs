// exp-tense-oneline.test.mjs
// ============================================================
// EXP-TENSE-001 + NORDIC-ONELINE-001 (owner 2026-06-12 late):
//   1. Advanced-styles checkbox toggles experience tense; PRESENT is the
//      default (styleConfig.expPastTense, false by default);
//   2. both tense rule strings exist in the bundle (the prompt picks one
//      at draft time);
//   3. nordic-minimal carries the one-line caps in the PWA style prompt;
//   4. the worker engines carry the matching SCE caps (mirrored copies).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const bundle = readFileSync(path.join(ROOT, 'app.js'), 'utf8');

test('EXP-TENSE-001 — checkbox key + default present', () => {
  assert.ok(bundle.includes('expPastTense'));
  assert.ok(bundle.includes('data-antcv-exp-tense'));
  assert.ok(bundle.includes('Experience bullets in past tense (default: present)'));
});

test('EXP-TENSE-001 — both prompt rules present (present default wording)', () => {
  assert.ok(bundle.includes('EXPERIENCE TENSE: write EVERY experience bullet in PRESENT tense'));
  assert.ok(bundle.includes('EXPERIENCE TENSE: write EVERY experience bullet in PAST tense'));
  assert.ok(bundle.includes('this is the default'));
});

test('NORDIC-ONELINE-001 — one-line caps in the PWA style prompt', () => {
  assert.ok(bundle.includes('ONE-LINE RULE'));
  assert.ok(bundle.includes('max ~95 characters'));
  assert.ok(bundle.includes('max ~55 characters'));
});

test('NORDIC-ONELINE-001 — worker engines carry the SCE caps, mirrored', () => {
  const proxy = readFileSync(path.join(ROOT, '..', 'workers', 'proxy', 'src', 'writing-style-engine.js'), 'utf8');
  const demo = readFileSync(path.join(ROOT, '..', 'workers', 'demo-proxy', 'src', 'writing-style-engine.js'), 'utf8');
  assert.equal(proxy, demo, 'proxy and demo-proxy engines must stay identical');
  assert.ok(proxy.includes('NORDIC_CELL_CHAR_CAP = 55'));
  assert.ok(proxy.includes('NORDIC_BULLET_CHAR_CAP = 95'));
  assert.ok(proxy.includes('findNordicOverlongBullets'));
});
