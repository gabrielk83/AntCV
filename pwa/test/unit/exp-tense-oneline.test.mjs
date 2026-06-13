// exp-tense-oneline.test.mjs
// ============================================================
// EXP-TENSE-002 + NORDIC-ONELINE-001 (owner 2026-06-12):
//   1. Advanced-styles 3-way control sets experience tense mode
//      (styleConfig.expTense: "auto" default | "present" | "past"); legacy
//      expPastTense still read for back-compat;
//   2. all three prompt rule strings exist in the bundle — AUTO (logical
//      per-role), FORCED PRESENT, FORCED PAST — the prompt picks one at
//      draft time;
//   3. nordic-minimal carries the one-line caps in the PWA style prompt;
//   4. the worker engines carry the matching SCE caps (mirrored copies).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const bundle = readFileSync(path.join(ROOT, 'app.js'), 'utf8');

test('EXP-TENSE-002 — 3-way control key + auto default + legacy back-compat', () => {
  assert.ok(bundle.includes('expTense'));
  assert.ok(bundle.includes('data-antcv-exp-tense'));
  // legacy key still read for migration of persisted/cloud configs
  assert.ok(bundle.includes('expPastTense'));
  // the three control labels render
  assert.ok(bundle.includes('Auto'));
  assert.ok(bundle.includes('Present'));
  assert.ok(bundle.includes('Past'));
});

test('EXP-TENSE-002 — all three prompt rules present (auto logical + forced)', () => {
  assert.ok(bundle.includes('EXPERIENCE TENSE (AUTO'));
  assert.ok(bundle.includes('EXPERIENCE TENSE (FORCED PRESENT'));
  assert.ok(bundle.includes('EXPERIENCE TENSE (FORCED PAST'));
  // auto rule states the per-role logic
  assert.ok(bundle.includes('LOGICAL per-role tense'));
});

test('NORDIC-ONELINE-001 — one-line caps in the PWA style prompt (tightened 88/48)', () => {
  assert.ok(bundle.includes('ONE-LINE RULE'));
  assert.ok(bundle.includes('max ~88 characters'));
  assert.ok(bundle.includes('max ~48 characters'));
});

test('STYLE-LINE-FIT-001 — tight styles carry a proportionate LINE FIT note', () => {
  // achievement-driven / structured / credential / precision get a one-line preference
  assert.ok(bundle.includes('LINE FIT'));
});

test('NORDIC-ONELINE-001 — worker engines carry the SCE caps, mirrored (88/48)', () => {
  const proxy = readFileSync(path.join(ROOT, '..', 'workers', 'proxy', 'src', 'writing-style-engine.js'), 'utf8');
  const demo = readFileSync(path.join(ROOT, '..', 'workers', 'demo-proxy', 'src', 'writing-style-engine.js'), 'utf8');
  assert.equal(proxy, demo, 'proxy and demo-proxy engines must stay identical');
  assert.ok(proxy.includes('NORDIC_CELL_CHAR_CAP = 48'));
  assert.ok(proxy.includes('NORDIC_BULLET_CHAR_CAP = 88'));
  assert.ok(proxy.includes('findNordicOverlongBullets'));
});
