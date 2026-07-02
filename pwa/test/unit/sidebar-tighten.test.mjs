// sidebar-tighten.test.mjs
// ============================================================
// SIDEBAR-TIGHTEN-001 (owner 2026-07-03): deterministic sidebar abbreviations in
// sanitizeForExport ("University of" -> "Uni. of", "Introduction to" -> "Intro to")
// so long certificate/tool lines stop wrapping into runt tails — owner: "critical
// for keeping a 3 pages unsolicited". Export-only; stored sections and the main
// column are untouched.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { sanitizeForExport } = await import('../../antcv-docx-client.js');

test('owner abbreviations apply to sidebar list strings and labeled l/v values', () => {
  const secs = [
    { id: 'certs', type: 'list', loc: 'sidebar', items: [
      'Business Analysis / BABOK (University of Toronto, 2022)',
      'Introduction to Coaching / World Rugby Level 1 (2024)',
    ] },
    { id: 'courses', type: 'labeled_list', loc: 'sidebar', items: [
      { l: 'Courses', v: 'Introduction to Coaching plus follow-ups' },
    ] },
  ];
  const out = sanitizeForExport(secs, 'cv');
  assert.equal(out[0].items[0], 'Business Analysis / BABOK (Uni. of Toronto, 2022)');
  assert.equal(out[0].items[1], 'Intro to Coaching / World Rugby Level 1 (2024)');
  assert.equal(out[1].items[0].v, 'Intro to Coaching plus follow-ups');
});

test('main column untouched; input objects not mutated (export-only cleaning)', () => {
  const item = { l: 'Cert', v: 'University of Toronto' };
  const secs = [
    { id: 'profile', type: 'text', loc: 'main', content: 'University of Toronto graduate.' },
    { id: 'courses', type: 'labeled_list', loc: 'sidebar', items: [item] },
  ];
  const out = sanitizeForExport(secs, 'cv');
  assert.equal(out[0].content, 'University of Toronto graduate.', 'main column keeps the long form');
  assert.equal(out[1].items[0].v, 'Uni. of Toronto');
  assert.equal(item.v, 'University of Toronto', 'stored input object untouched');
});
