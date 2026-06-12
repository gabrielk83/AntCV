// personality-kernel.test.mjs
// ============================================================
// PERSONALITY-KERNEL-001 (handoff T8, 2026-06-12):
//   1. canonical JSON committed + valid + carries the six traits;
//   2. the PWA bundle injects the personality kernel (default block +
//      stored-override path) and the 3-part PROFILE structure;
//   3. cv-skeleton.md documents the three sub-parts + render constraints;
//   4. relay PI_IDENTITY_KEYS documents personality + specialization;
//   5. fact corrections landed in all four example JSONs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...p) => readFileSync(path.join(ROOT, ...p), 'utf8');
const bundle = read('app.js');

test('canonical personality JSON committed + six traits', () => {
  const j = JSON.parse(read('..', 'skills', 'antcv-writer', 'assets', 'gabriel-kernel-personality-v1.json'));
  assert.equal(j.traits.length, 6);
  assert.ok(j.work_style_line.en && j.work_style_line.da);
  assert.equal(j.render_constraints.max_personality_sentences_in_profile, 1);
});

test('bundle carries the personality kernel + 3-part profile structure', () => {
  assert.ok(bundle.includes('PERSONALITY KERNEL'));
  assert.ok(bundle.includes('Calm, structured decisions from measured data'));
  assert.ok(bundle.includes('foreningsarbejde'));
  assert.ok(bundle.includes('BODY-MIND'));
  assert.ok(bundle.includes('SPECIAL CAPABILITIES'));
  assert.ok(bundle.includes('Colleagues come to me when a decision needs a calm read'));
  // stored-kernel override path
  assert.ok(bundle.includes('from the stored kernel'));
});

test('cv-skeleton.md documents the three sub-parts', () => {
  const s = read('..', 'skills', 'antcv-writer', 'references', 'cv-skeleton.md');
  assert.ok(s.includes('Three-part PROFILE structure'));
  assert.ok(s.includes('Body–mind'));
  assert.ok(s.includes('foreningsarbejde'));
  assert.ok(s.includes("people's person"));
});

test('relay documents the personality identity key', () => {
  const r = read('..', 'workers', 'access-relay', 'src', 'index.js');
  assert.ok(r.includes("'personality', 'specialization'"));
});

test('fact corrections in all four example JSONs', () => {
  for (const lang of ['en', 'da', 'es', 'zh']) {
    const t = read('..', 'skills', 'antcv-writer', 'assets', `example-output-${lang}.json`);
    JSON.parse(t);
    assert.ok(t.includes('foreningsarbejde'), `${lang} volunteer line`);
    assert.ok(t.includes('IDA Ingeniørforening'), `${lang} IDA course`);
    assert.ok(t.includes('Teknologisk Institut'), `${lang} AI-Practitioner attribution`);
  }
});
