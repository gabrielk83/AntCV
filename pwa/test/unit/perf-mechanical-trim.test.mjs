// perf-mechanical-trim.test.mjs
// ============================================================
// PERF-003 / PERF-004 (1.50.359). Locks two behaviours into the source:
//  - PERF-003: ee()'s failover ladder is capped at 2 providers for the
//    owner-confirmed MECHANICAL tasks only (extract, extract_pdf, parse_jd,
//    compress, fix_orphans). Quality-critical tasks keep full width.
//  - PERF-004: the post-generate tightening pass is skipped when the draft is
//    already within its own budgets (profile ≤400, work style ≤200, first-page
//    bullets ≤130, continuation bullets ≤90 chars; empty fields never skip).
// The predicates are mirrored here and the source is asserted to carry the
// same constants, so a drive-by edit to app.src.js fails this test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const src = await readFile(new URL('../../app.src.js', import.meta.url), 'utf8');

// ─── PERF-003 + GEN-WIDTH-001 (per-mode fan-out width, 1.50.819) ─────
// Two layers, applied in order:
//  1. __fanWidth caps EVERY task's ladder to the per-mode width:
//     fast=2, balanced=3, thorough=4 (a quick-gen regen forces 3).
//     GEN-WIDTH-001 SUPERSEDED the old GEN-SPEED-001 fast=1 rule — fast now
//     keeps a 2-provider ladder for one-retry robustness.
//  2. PERF-003 then caps MECHANICAL tasks to 2 (unless thorough lifts it).
const MECHANICAL = /^(extract|extract_pdf|parse_jd|compress|fix_orphans)$/;
const fanWidth = (speed) => (speed === 'fast' ? 2 : speed === 'thorough' ? 4 : 3);
const cap = (task, list, speed = 'balanced') => {
  let l = list;
  const w = fanWidth(speed);                                                 // layer 1
  if (l.length > w) l = l.slice(0, w);
  if (MECHANICAL.test(task) && l.length > 2 && speed !== 'thorough') l = l.slice(0, 2); // layer 2
  return l;
};

test('PERF-003: source carries the mechanical-task cap', () => {
  assert.match(src, /PERF-003 \(1\.50\.359/);
  assert.match(src, /\^\(extract\|extract_pdf\|parse_jd\|compress\|fix_orphans\)\$\/\.test\(r\) &&\s*l\.length > 2 &&\s*"thorough" !== __genSpeed\(\)/);
  assert.match(src, /l = l\.slice\(0, 2\);/);
});

test('GEN-SPEED-001: source carries the speed preset wiring', () => {
  // helper reads the persisted preset, defaulting balanced
  assert.match(src, /antcv:genSpeed/);
  assert.match(src, /const __genSpeed = \(\) =>/);
  // GEN-WIDTH-001 superseded fast=1: the ladder width is now per-mode via __fanWidth
  assert.match(src, /const __fanWidth = \(\) =>/);
  assert.match(src, /"fast" === s \? 2 : "thorough" === s \? 4 : 3/);
  // fast still skips the consensus waves
  assert.match(src, /Wa && "fast" !== __genSpeed\(\)/);
  // the three pills render with the data hook
  assert.match(src, /data-antcv-genspeed/);
});

test('GEN-WIDTH-001: preset semantics (mirrored predicate)', () => {
  const four = ['mistral', 'openai', 'gemini', 'claude'];
  // thorough = width 4 (and lifts the mechanical cap)
  assert.deepEqual(cap('compress', four, 'thorough'), four);
  // fast = width 2 (superseded fast=1): mechanical no-ops since already 2
  assert.deepEqual(cap('compress', four, 'fast'), ['mistral', 'openai']);
  assert.deepEqual(cap('generate_cv', four, 'fast'), ['mistral', 'openai']);
  // balanced = width 3: mechanical then tightens to 2, quality keeps 3
  assert.deepEqual(cap('compress', four, 'balanced'), ['mistral', 'openai']);
  assert.deepEqual(cap('generate_cv', four, 'balanced'), ['mistral', 'openai', 'gemini']);
});

test('PERF-003: mechanical tasks capped at 2, quality tasks keep the per-mode width (balanced=3)', () => {
  const four = ['mistral', 'openai', 'gemini', 'claude'];
  for (const t of ['extract', 'extract_pdf', 'parse_jd', 'compress', 'fix_orphans']) {
    assert.deepEqual(cap(t, four), ['mistral', 'openai'], t);
  }
  // quality tasks are not mechanically capped, but balanced __fanWidth still trims to 3
  for (const t of ['generate_cv', 'consensus_poll', 'consensus_reinforce', 'fuse',
    'analyze_fit', 'long_context', 'enrich', 'apply_correction',
    'translate', 'translate_da', 'refine_da', 'refine_en', 'default']) {
    assert.deepEqual(cap(t, four), ['mistral', 'openai', 'gemini'], t);
  }
  // forced single-provider lists pass through
  assert.deepEqual(cap('compress', ['claude']), ['claude']);
});

// ─── PERF-004 ────────────────────────────────────────────────────────
const tightSkip = (n) => {
  const pc = String(n.profile_content || '').trim();
  const wc = String(n.work_style_content || '').trim();
  if (!pc || !wc) return false;
  if (pc.length > 400 || wc.length > 200) return false;
  for (const role of n.roles) {
    const capLen = role.page === 'first' ? 130 : 90;
    for (const b of role.bullets || []) if (String(b || '').length > capLen) return false;
  }
  return true;
};

const draft = (over) => ({
  profile_content: 'P'.repeat(350),
  work_style_content: 'W'.repeat(180),
  roles: [
    { id: 'r1', page: 'first', bullets: ['B'.repeat(120), 'B'.repeat(80)] },
    { id: 'r4', page: 'continuation', bullets: ['B'.repeat(85)] },
  ],
  ...over,
});

test('PERF-004: source carries the tighten-skip', () => {
  assert.match(src, /PERF-004 \(1\.50\.359\)/);
  assert.match(src, /__tightSkip/);
  assert.match(src, /skipping the tightening pass/);
});

test('PERF-004: within-budget draft skips', () => {
  assert.equal(tightSkip(draft()), true);
});

test('PERF-004: over-budget profile / work-style / bullets do NOT skip', () => {
  assert.equal(tightSkip(draft({ profile_content: 'P'.repeat(401) })), false);
  assert.equal(tightSkip(draft({ work_style_content: 'W'.repeat(201) })), false);
  assert.equal(tightSkip(draft({ roles: [{ id: 'r1', page: 'first', bullets: ['B'.repeat(131)] }] })), false);
  assert.equal(tightSkip(draft({ roles: [{ id: 'r4', page: 'continuation', bullets: ['B'.repeat(91)] }] })), false);
});

test('PERF-004: empty profile or work-style never skips (status quo pass runs)', () => {
  assert.equal(tightSkip(draft({ profile_content: '' })), false);
  assert.equal(tightSkip(draft({ work_style_content: '  ' })), false);
});
