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

// ─── PERF-003 (+ GEN-SPEED-001 preset interaction, 1.50.406) ─────────
// Balanced (default): mechanical cap at 2. Thorough: cap lifted (full
// ladder). Fast: every task sliced to 1 provider.
const MECHANICAL = /^(extract|extract_pdf|parse_jd|compress|fix_orphans)$/;
const cap = (task, list, speed = 'balanced') => {
  let l = list;
  if (MECHANICAL.test(task) && l.length > 2 && speed !== 'thorough') l = l.slice(0, 2);
  if (speed === 'fast' && l.length > 1) l = l.slice(0, 1);
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
  // fast slices the ladder to one provider
  assert.match(src, /"fast" === __genSpeed\(\) && l\.length > 1/);
  // fast skips the consensus waves
  assert.match(src, /Wa && "fast" !== __genSpeed\(\)/);
  // the three pills render with the data hook
  assert.match(src, /data-antcv-genspeed/);
});

test('GEN-SPEED-001: preset semantics (mirrored predicate)', () => {
  const four = ['mistral', 'openai', 'gemini', 'claude'];
  // thorough lifts the mechanical cap
  assert.deepEqual(cap('compress', four, 'thorough'), four);
  // fast slices everything to one
  assert.deepEqual(cap('compress', four, 'fast'), ['mistral']);
  assert.deepEqual(cap('generate_cv', four, 'fast'), ['mistral']);
  // balanced keeps PERF-003 behaviour
  assert.deepEqual(cap('compress', four, 'balanced'), ['mistral', 'openai']);
  assert.deepEqual(cap('generate_cv', four, 'balanced'), four);
});

test('PERF-003: mechanical tasks capped at 2, quality tasks untouched', () => {
  const four = ['mistral', 'openai', 'gemini', 'claude'];
  for (const t of ['extract', 'extract_pdf', 'parse_jd', 'compress', 'fix_orphans']) {
    assert.deepEqual(cap(t, four), ['mistral', 'openai'], t);
  }
  for (const t of ['generate_cv', 'consensus_poll', 'consensus_reinforce', 'fuse',
    'analyze_fit', 'long_context', 'enrich', 'apply_correction',
    'translate', 'translate_da', 'refine_da', 'refine_en', 'default']) {
    assert.deepEqual(cap(t, four), four, t);
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
