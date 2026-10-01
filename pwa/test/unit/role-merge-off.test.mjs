// ROLE-MERGE-OFF-001 (owner 2026-09-27 STORED-FACTS-001 + "Innoviz is ALWAYS two roles"; live re-find 2026-09-30):
// a targeted export must keep same-company roles separate unless the owner opts in (antcv:enable-role-merge=1).
import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
globalThis.window = globalThis.window || {};
const { buildPayload } = await import('../../antcv-docx-client.js');

const roles = [
  { id: 'r1', title: 'Change Control Lead & Customer Change Request Manager', company: 'Innoviz Technologies', years: '2020 – 2025', bullets: ['a', 'b'], results: 'x' },
  { id: 'r2', title: 'System Architect, Automotive LiDAR', company: 'Innoviz Technologies', years: '2017 – 2020', bullets: ['c', 'd'], results: 'y' },
];
const build = () => {
  store.set('meta', JSON.stringify({ company: 'Veo Technologies', role: 'Staff Hardware Product Manager' }));
  const p = buildPayload({ doc: 'cv', personalInfo: { name: 'X' }, meta: { company: 'Veo Technologies' },
    sections: { cv: [{ id: 'experience', title: 'EXPERIENCE', type: 'experience', loc: 'main', roles }] }, styleConfig: {} });
  return ((p.sections || []).find((s) => s.type === 'experience') || {}).roles || [];
};

test('targeted export keeps both Innoviz roles by default', () => {
  store.delete('antcv:enable-role-merge');
  const out = build().filter((r) => r && r.on !== false);
  assert.equal(out.length, 2, JSON.stringify(out.map((r) => r.title)));
  assert.ok(!out.some((r) => / & System Architect/.test(r.title)), 'no fused title');
});

test('opt-in flag restores the old merge', () => {
  store.set('antcv:enable-role-merge', '1');
  const out = build().filter((r) => r && r.on !== false);
  assert.equal(out.length, 1);
  store.delete('antcv:enable-role-merge');
});
