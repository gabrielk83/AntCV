// cv-layout-linear-preview.test.mjs
// ============================================================
// EXEC-LINEAR step 3 (1.51.4627): antcv-cv-layout-linear.js moves every CV sidebar section to
// 'main' in the addendum order when antcv:cvLayout = 'linear', saves the two-column map, and
// restores order + loc exactly when switched back. Runs the sidecar against a minimal fake DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const SRC = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../antcv-cv-layout-linear.js'), 'utf8');

function sandbox(sections) {
  const store = new Map([['sections', JSON.stringify(sections)]]);
  const events = [];
  const styleEls = {};
  const body = { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
  const document = {
    body, head: { appendChild(el) { styleEls[el.id] = el; } },
    getElementById: (id) => styleEls[id] || null,
    createElement: () => ({ id: '', textContent: '', remove() { delete styleEls[this.id]; } }),
    querySelector: () => null, addEventListener() {},
  };
  const window = {
    addEventListener() {}, dispatchEvent: (e) => events.push(e.detail && e.detail.reason),
  };
  const ctx = {
    window, document, localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    CustomEvent: function (t, o) { this.type = t; this.detail = o && o.detail; }, MutationObserver: function () { this.observe = () => {}; }, setTimeout: () => 0,
  };
  ctx.window.localStorage = ctx.localStorage;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return { ctx, store, events, body, styleEls, cv: () => JSON.parse(store.get('sections')).cv };
}

const SECTIONS = { cl: [], cv: [
  { id: 'profile', loc: 'main' }, { id: 'work_style', loc: 'main' }, { id: 'outcomes', loc: 'main' },
  { id: 'core_comp', loc: 'main' }, { id: 'experience', loc: 'main' }, { id: 'pubs', loc: 'main' },
  { id: 'recommendations', loc: 'main' }, { id: 'tools', loc: 'sidebar' }, { id: 'certs', loc: 'sidebar' },
  { id: 'education', loc: 'sidebar' }, { id: 'languages', loc: 'sidebar' }, { id: 'interests', loc: 'sidebar' },
] };

test('linear: all sections main, addendum order, two-column map saved; back: exact restore', () => {
  const sb = sandbox(SECTIONS);
  sb.store.set('antcv:cvLayout', 'linear');
  sb.ctx.window.__antcvCvLayoutApply();
  const lin = sb.cv();
  assert.ok(lin.every((s) => s.loc === 'main'), 'no sidebar left');
  assert.deepEqual(lin.map((s) => s.id), ['profile', 'work_style', 'outcomes', 'core_comp', 'experience', 'education', 'certs', 'tools', 'pubs', 'recommendations', 'languages', 'interests']);
  assert.ok(sb.store.has('antcv:cvLayout:twoColMap'), 'map saved');
  assert.ok(sb.events.includes('cv-layout-linear'), 'app told to reload sections');
  assert.equal(sb.body.attrs['data-antcv-cv-layout'], 'linear');

  sb.store.delete('antcv:cvLayout');
  sb.ctx.window.__antcvCvLayoutApply();
  assert.deepEqual(sb.cv().map((s) => [s.id, s.loc]), SECTIONS.cv.map((s) => [s.id, s.loc]), 'order and loc restored exactly');
  assert.ok(!sb.store.has('antcv:cvLayout:twoColMap'), 'map cleared');
  assert.equal(sb.body.attrs['data-antcv-cv-layout'], 'two_column');
});

test('idempotent: applying linear twice writes once and keeps the first saved map', () => {
  const sb = sandbox(SECTIONS);
  sb.store.set('antcv:cvLayout', 'linear');
  sb.ctx.window.__antcvCvLayoutApply();
  const map1 = sb.store.get('antcv:cvLayout:twoColMap');
  sb.ctx.window.__antcvCvLayoutApply();
  assert.equal(sb.events.filter((r) => r === 'cv-layout-linear').length, 1);
  assert.equal(sb.store.get('antcv:cvLayout:twoColMap'), map1);
});

test('kill switch keeps the stored sections and the two-column look', () => {
  const sb = sandbox(SECTIONS);
  sb.store.set('antcv:cvLayout', 'linear');
  sb.store.set('antcv:disable-cv-layout-linear', '1');
  sb.ctx.window.__antcvCvLayoutApply();
  assert.deepEqual(sb.cv(), SECTIONS.cv);
  assert.equal(sb.body.attrs['data-antcv-cv-layout'], 'two_column');
});
