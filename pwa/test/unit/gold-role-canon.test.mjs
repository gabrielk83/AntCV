// ROLE-CANON-LANG-001 gate (owner 2026-07-13 "make sure your work fits in the
// golden gating matrix role control ... I want also danish spanish and chinese
// canon"). Three invariants:
//   1. gold-rules.json carries roles.canon_titles with a NON-EMPTY en/da/es/zh
//      title for every canonical role id (the golden gating matrix role control).
//   2. The enforcement sidecar's embedded fallback table is an EXACT mirror of
//      the gold JSON — the JSON is the ONE control site; a drifted fallback
//      would silently enforce stale canon when the fetch fails.
//   3. Canon titles obey the matrix's own typography rules (ASCII hyphen only —
//      no en/em/unicode dashes) and the CW zh title keeps the owner pin.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const gold = JSON.parse(fs.readFileSync(path.join(root, 'gold-rules.json'), 'utf8'));
const sidecar = fs.readFileSync(path.join(root, 'antcv-sections-normalize-415.js'), 'utf8');

const LANGS = ['en', 'da', 'es', 'zh'];
const CANONICAL_IDS = [
  'kanzen', 'innoviz-ccr', 'innoviz-sa', 'sirin', 'mepro-tl', 'mepro-eng',
  'tau-security', 'tau-research', 'tau-teaching', 'tau-council', 'idf',
  'volunteer-wolves', 'earlier-career',
];

test('gold-rules roles.canon_titles: every canonical id has all four languages', () => {
  const roles = gold.roles;
  assert.ok(roles && typeof roles === 'object', 'gold-rules.json must carry a roles section');
  const canon = roles.canon_titles;
  assert.ok(canon && typeof canon === 'object', 'roles.canon_titles missing');
  for (const id of CANONICAL_IDS) {
    assert.ok(canon[id], `canon_titles missing id ${id}`);
    for (const L of LANGS) {
      const v = canon[id][L];
      assert.ok(typeof v === 'string' && v.trim().length >= 2, `canon_titles.${id}.${L} empty`);
    }
  }
});

test('normalize-415 fallback table mirrors gold-rules.json exactly', () => {
  const m = sidecar.match(/GOLD-ROLES-MIRROR-BEGIN \*\/\s*([\s\S]*?)\s*\/\* GOLD-ROLES-MIRROR-END/);
  assert.ok(m, 'GOLD-ROLES-MIRROR markers not found in antcv-sections-normalize-415.js');
  const fallback = JSON.parse(m[1]);
  assert.deepEqual(fallback, gold.roles.canon_titles,
    'the sidecar ROLE_CANON_FALLBACK drifted from gold-rules.json roles.canon_titles — update BOTH');
});

test('canon titles obey the matrix typography (ASCII hyphen only) + owner pins', () => {
  const banned = /[‐‑‒–—―−]/;
  const canon = gold.roles.canon_titles;
  for (const id of Object.keys(canon)) {
    for (const L of LANGS) {
      assert.ok(!banned.test(canon[id][L]), `canon_titles.${id}.${L} carries a banned dash`);
    }
  }
  // Owner pins that must never drift silently:
  assert.equal(canon['volunteer-wolves'].zh, '球队运营经理（协会志愿工作）', 'CW zh pin');
  assert.equal(canon['innoviz-ccr'].zh, '变更请求负责人', 'CCR zh pin');
  assert.equal(canon['innoviz-sa'].zh, '系统架构师', 'SA zh pin');
  assert.ok(canon['volunteer-wolves'].en.includes('(foreningsarbejde)'), 'CW en keeps the protected phrase');
  assert.ok(canon['volunteer-wolves'].da.includes('(foreningsarbejde)'), 'CW da keeps the protected phrase');
});

test('enforcement is wired: roleCanonTitles exists and runs after dedupeRoles', () => {
  assert.ok(/function roleCanonTitles\(/.test(sidecar), 'roleCanonTitles missing');
  const dedupeAt = sidecar.indexOf('var d = dedupeRoles(cv);');
  const canonAt = sidecar.indexOf('var rct = roleCanonTitles(cv);');
  assert.ok(dedupeAt > 0 && canonAt > dedupeAt, 'roleCanonTitles must run in the pipeline AFTER dedupeRoles');
  // he/am/ar keep the translate output — the language gate must exist.
  assert.ok(sidecar.includes("if (L !== 'en' && L !== 'da' && L !== 'es' && L !== 'zh') return null;"),
    'roleCanonTitles language gate missing');
});
