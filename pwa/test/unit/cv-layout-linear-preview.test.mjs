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

// 1.51.4628: the page model computed for one layout is wrong for the other (live-found: after a round
// trip the two-column sidebar was pinned to pages 2-3). The switch saves, clears and restores it.
test('page model: saved + cleared on the way to linear, restored exactly on the way back', () => {
  const sb = sandbox(SECTIONS);
  const AUTO = JSON.stringify({ experience: { 7: 2 }, languages: { 0: 2 } }), MAN = JSON.stringify({ education: { 1: 2 } });
  sb.store.set('antcv:autoPages', AUTO); sb.store.set('antcv:autoPagesPreview', AUTO); sb.store.set('antcv:itemPages', MAN);
  sb.store.set('antcv:cvLayout', 'linear');
  sb.ctx.window.__antcvCvLayoutApply();
  for (const k of ['antcv:autoPages', 'antcv:autoPagesPreview', 'antcv:itemPages']) assert.ok(!sb.store.has(k), k + ' cleared for the linear recompute');
  assert.ok(sb.events.includes('cv-layout'), 'paginator told to recompute');
  sb.store.set('antcv:autoPages', JSON.stringify({ education: { 0: 2 } }));   // what the linear paginator writes
  sb.store.delete('antcv:cvLayout');
  sb.ctx.window.__antcvCvLayoutApply();
  assert.equal(sb.store.get('antcv:autoPages'), AUTO, 'two-column auto pages back');
  assert.equal(sb.store.get('antcv:autoPagesPreview'), AUTO);
  assert.equal(sb.store.get('antcv:itemPages'), MAN, 'manual breaks back');
});

// 1.51.4686 LINEAR-TABLES-001: the preview draws the export's table blocks with CSS keyed by section id
// (the preview replaces section nodes about once a second - attributes on them would flicker).
test('tables: kinds match the export and the CSS targets the section ids', () => {
  const sb = sandbox({ cl: [], cv: [
    { id: 'core_comp', type: 'table', title: 'CORE COMPETENCIES', loc: 'main' },
    { id: 'tools', type: 'rich_block', title: 'TOOLS & METHODS', loc: 'sidebar' },
    { id: 'education', type: 'education', title: 'EDUCATION', loc: 'sidebar' },
    { id: 'recommendations', type: 'education', title: 'RECOMMENDATIONS', loc: 'main' },
    { id: 'languages', type: 'labeled_list', title: 'LANGUAGES', loc: 'sidebar' },
    { id: 'interests', type: 'rich_block', title: 'INTERESTS', loc: 'sidebar' },
    { id: 'certs', type: 'rich_block', title: 'CERTIFICATES & COURSES', loc: 'sidebar' },
  ] });
  const K = sb.ctx.window.__antcvCvLinearKind;
  assert.equal(K({ id: 'core_comp', type: 'table' }), 'tiles');
  assert.equal(K({ id: 'tools', type: 'rich_block', title: 'TOOLS & METHODS' }), 'tools');
  assert.equal(K({ id: 'recommendations', type: 'education' }), 'details', 'an education-typed non-degree section is a details row');
  assert.equal(K({ id: 'certs', type: 'rich_block', title: 'CERTIFICATES' }), 'certs');
  sb.store.set('antcv:cvLayout', 'linear');
  sb.store.set('styleConfig', JSON.stringify({ accent: '#ffc92b' }));
  sb.ctx.window.__antcvCvLayoutApply();
  const css = sb.styleEls['antcv-cv-layout-linear-style'].textContent;
  const M = '[data-antcv-document-main] > ';
  assert.ok(css.includes(M + '[data-sid="core_comp"] tbody{display:grid !important;grid-template-columns:repeat(3,'), '3 tiles per row');
  assert.ok(css.includes(M + '[data-sid="core_comp"] thead{display:none'), 'header row dropped');
  assert.ok(css.includes(M + '[data-sid="tools"]{display:grid !important;grid-template-columns:repeat(2,'), 'tools 2 per row');
  assert.ok(css.includes(M + '[data-sid="education"]{display:grid'), 'education in 2 columns');
  assert.ok(css.includes(M + '[data-sid="languages"],') && css.includes('grid-template-columns:127px minmax(0,1fr)'), 'details label | content');
  assert.ok(css.includes(M + '[data-sid="recommendations"]'), 'recommendations as a details row');
  assert.ok(css.includes('2pt solid #ffc92b'), 'accent bar from style.accent');
  assert.ok(!/data-antcv-lin-kind/.test(css), 'no per-node attributes');
  sb.store.delete('antcv:cvLayout');
  sb.ctx.window.__antcvCvLayoutApply();
  assert.ok(!sb.styleEls['antcv-cv-layout-linear-style'], 'two-column: the style is removed');
});
