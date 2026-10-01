// REFERENCES-MODE-001 (owner 2026-10-01): default "References Exposed" names the two referees most relevant to the
// job ad - name, title, organisation, relationship - and NEVER their phone or e-mail. "On request" restores the
// generic line. The pool is per-user data (personalInfo.referees); these names are synthetic test fixtures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const SRC = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../antcv-references-mode.js'), 'utf8');

const POOL = [
  { name: 'Ada Example', title: 'CBO', org: 'LidarCo', relation: 'senior leader at LidarCo', lang: 'en', tags: ['automotive', 'requirements', 'aspice', 'audit'] },
  { name: 'Bo Eksempel', title: 'Head coach', org: 'City Rugby', relation: 'coach and board colleague', lang: 'da', tags: ['team', 'danish', 'communication'] },
  { name: 'Cy Sample', title: 'Professor', org: 'Uni', relation: 'thesis supervisor', lang: 'en', tags: ['research', 'photonics', 'nanotechnology'] },
];
const GENERIC = [{ deg: 'References', sch: 'International and Danish recommendations provided on request' }];
function sandbox(extra = {}) {
  const store = new Map(Object.entries({
    sections: JSON.stringify({ cl: [], cv: [{ id: 'experience', type: 'experience', roles: [] }, { id: 'recommendations', title: 'RECOMMENDATIONS', type: 'education', loc: 'main', on: true, items: GENERIC }] }),
    personalInfo: JSON.stringify({ name: 'X', referees: POOL }),
    ...extra,
  }));
  const events = [];
  const ctx = {
    window: { addEventListener() {}, dispatchEvent: (e) => events.push(e.detail && e.detail.reason) },
    document: { body: null, addEventListener() {}, querySelectorAll: () => [] },
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    CustomEvent: function (t, o) { this.type = t; this.detail = o && o.detail; }, MutationObserver: function () { this.observe = () => {}; }, setTimeout: () => 0,
  };
  vm.createContext(ctx); vm.runInContext(SRC, ctx);
  const rec = () => JSON.parse(store.get('sections')).cv.find((s) => s.id === 'recommendations');
  return { ctx, store, events, rec };
}

test('default is Exposed: two most relevant referees, no phone or e-mail', () => {
  const sb = sandbox({ 'antcv:lastJdText': 'Automotive requirements engineer, ASPICE audits, Copenhagen office, Danish team' });
  sb.ctx.window.__antcvReferencesApply();
  const items = sb.rec().items;
  assert.deepEqual(items.map((i) => i.deg), ['Ada Example', 'Bo Eksempel']);
  assert.match(items[0].sch, /^CBO, LidarCo \(senior leader at LidarCo\) - contact details available upon request$/);
  assert.ok(!items.some((i) => /@|\+?\d[\d\s]{6,}/.test(i.sch)), 'no e-mail or phone');
  assert.deepEqual(sb.rec()._refsGeneric, GENERIC, 'generic line kept for the switch back');
});

test('a research ad picks the research referee', () => {
  const sb = sandbox({ 'antcv:lastJdText': 'PhD research in photonics and nanotechnology, research group' });
  sb.ctx.window.__antcvReferencesApply();
  assert.ok(sb.rec().items.some((i) => i.deg === 'Cy Sample'), 'research referee chosen');
});

test('On request restores the generic line; switching back exposes again', () => {
  const sb = sandbox({ 'antcv:lastJdText': 'automotive' });
  sb.ctx.window.__antcvReferencesApply();
  sb.store.set('antcv:referencesMode', 'request');
  sb.ctx.window.__antcvReferencesApply();
  assert.deepEqual(sb.rec().items, GENERIC);
  sb.store.delete('antcv:referencesMode');
  sb.ctx.window.__antcvReferencesApply();
  assert.equal(sb.rec().items.length, 2);
});

test('idempotent, and no pool = untouched', () => {
  const sb = sandbox({ 'antcv:lastJdText': 'automotive' });
  sb.ctx.window.__antcvReferencesApply();
  const n = sb.events.length;
  sb.ctx.window.__antcvReferencesApply();
  assert.equal(sb.events.length, n, 'second pass writes nothing');
  const empty = sandbox({ personalInfo: JSON.stringify({ name: 'X' }) });
  empty.ctx.window.__antcvReferencesApply();
  assert.deepEqual(empty.rec().items, GENERIC);
});

test('the kernel pool is mirrored locally and used when the kernel copy disappears', () => {
  const sb = sandbox({ 'antcv:lastJdText': 'automotive' });
  sb.ctx.window.__antcvReferencesApply();
  sb.store.set('personalInfo', JSON.stringify({ name: 'X' }));   // a stale kernel save dropped referees
  sb.store.set('antcv:referencesMode', 'request'); sb.ctx.window.__antcvReferencesApply();
  sb.store.delete('antcv:referencesMode'); sb.ctx.window.__antcvReferencesApply();
  assert.equal(sb.rec().items.length, 2);
});

test('a Danish CV uses the referee Danish fields and the Danish contact phrase', () => {
  const pool = [{ name: 'Bo Eksempel', title: 'Head coach', title_da: 'Cheftræner', org: 'City Rugby', relation: 'coach', relation_da: 'træner', lang: 'da', tags: ['dansk'] }, POOL[0]];
  const sb = sandbox({ language: 'da', personalInfo: JSON.stringify({ name: 'X', referees: pool }), 'antcv:lastJdText': 'dansk' });
  sb.ctx.window.__antcvReferencesApply();
  assert.equal(sb.rec().items[0].sch, 'Cheftræner, City Rugby (træner) - kontaktoplysninger på forespørgsel');
});
