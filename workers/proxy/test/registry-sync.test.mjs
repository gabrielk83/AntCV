// Drift guard: the proxy worker keeps a hand-maintained subset of the
// writing-system registry inline (see the header comment in
// src/writing-style-engine.js — the worker cannot import outside its own
// directory without breaking the Cloudflare edge bundle). The canonical source
// is writingSystems/registry.json at the repo root. This test fails the moment
// the two drift apart, so a registry edit that forgets the worker copy (or the
// reverse) is caught in CI instead of in production.
//
// Run from inside workers/proxy/:  node --test test/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import WritingStyleEngine from '../src/writing-style-engine.js';

const reg = JSON.parse(
  readFileSync(new URL('../../../writingSystems/registry.json', import.meta.url), 'utf8'),
);

const eng = WritingStyleEngine;

test('style id set matches the registry', () => {
  assert.deepEqual(Object.keys(eng.STYLES).sort(), Object.keys(reg.styles).sort());
});

test('default style matches the registry', () => {
  assert.equal(eng.DEFAULT_STYLE, reg.default);
});

test('supported languages match the registry shared-base partition', () => {
  assert.deepEqual([...eng.SUPPORTED_LANGUAGES].sort(), Object.keys(reg.sharedBannedBases.words).sort());
});

test('shared banned words match the registry exactly', () => {
  assert.deepEqual(eng.SHARED_BANNED_WORDS, reg.sharedBannedBases.words);
});

test('shared banned phrases match the registry exactly', () => {
  assert.deepEqual(eng.SHARED_BANNED_PHRASES, reg.sharedBannedBases.phrases);
});

test('per-style active flag, allowed length, tone chips, and glyph density match', () => {
  for (const id of Object.keys(reg.styles)) {
    const w = eng.STYLES[id];
    const r = reg.styles[id];
    assert.ok(w, `worker is missing style ${id}`);
    assert.equal(!!w.active, !!r.active, `active flag drift on ${id}`);
    assert.deepEqual(w.allowedLength, r.allowedLength, `allowedLength drift on ${id}`);
    assert.deepEqual(w.defaultToneChips, r.defaultToneChips, `defaultToneChips drift on ${id}`);
    assert.equal(w.glyphDensity, r.glyphDensity, `glyphDensity drift on ${id}`);
  }
});

test('every registry legacy alias resolves to its canonical style in the worker', () => {
  for (const id of Object.keys(reg.styles)) {
    for (const alias of reg.styles[id].legacyAliases ?? []) {
      const got = eng.parseWritingStyleRequest({ writingStyle: alias }).writingStyle;
      assert.equal(got, id, `alias "${alias}" should resolve to "${id}", got "${got}"`);
    }
  }
});

test('the active-at-cut roster matches the styles flagged active in the worker', () => {
  const workerActive = Object.keys(eng.STYLES).filter((id) => eng.STYLES[id].active).sort();
  assert.deepEqual(workerActive, [...reg.activeAtCut].sort());
});
