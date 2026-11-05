// cv-layout-margin.test.mjs
// ============================================================
// MARGIN-LAYOUT-001 (1.51.5865, docs/design/MARGIN_LAYOUT_SPEC.md): the house "margin" (academy) two-column CV -
// the candidate header is a card at the top of the page-1 sidebar panel and no band is drawn. It is the DEFAULT
// (antcv:cvLayout absent); 'two_column' is the explicit band opt-out; 'linear' unchanged. Kill switch
// antcv:disable-cv-layout-margin=1. One rule in three readers: the preview sidecar, the Page-flow control and the
// docx client (readCvLayout is covered in cv-layout-linear.test.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const PWA = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (f) => fs.readFileSync(path.join(PWA, f), 'utf8');
const SIDECAR = read('antcv-cv-layout-margin.js');

function sandbox(store0 = {}, dom = {}) {
  const store = new Map(Object.entries(store0));
  const events = [];
  const styleEls = {};
  const cfg = [];
  const bodyAttrs = {};
  const paper = dom.paper === false ? null : {
    querySelector: (sel) => {
      if (/sidebar-card/.test(sel)) return dom.card ? { offsetHeight: dom.cardH || 240 } : null;
      if (/candidate-band/.test(sel)) return dom.band ? {} : null;
      return null;
    },
  };
  const document = {
    body: { setAttribute: (k, v) => { bodyAttrs[k] = v; } },
    head: { appendChild(el) { styleEls[el.id] = el; } },
    documentElement: { appendChild(el) { styleEls[el.id] = el; } },
    getElementById: (id) => styleEls[id] || null,
    createElement: () => ({ id: '', textContent: '', remove() { delete styleEls[this.id]; } }),
    querySelector: (sel) => {
      if (/sidebar-card/.test(sel)) return dom.card ? { offsetHeight: dom.cardH || 240 } : null;
      if (/section-headline/.test(sel)) return null;
      if (/antcv-preview-paper/.test(sel)) return paper;
      return null;
    },
    addEventListener() {},
  };
  const window = {
    addEventListener() {},
    dispatchEvent: (e) => events.push(e.detail && e.detail.reason),
    AntcvAutoPagebreak: { config: (o) => cfg.push(o) },
  };
  const ctx = {
    window, document,
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    CustomEvent: function (t, o) { this.type = t; this.detail = o && o.detail; },
    MutationObserver: function () { this.observe = () => {}; },
    setTimeout: () => 0, getComputedStyle: () => ({}), Number,
  };
  ctx.window.localStorage = ctx.localStorage;
  vm.createContext(ctx);
  vm.runInContext(SIDECAR, ctx);
  return { ctx, store, events, styleEls, cfg, bodyAttrs, css: () => (styleEls['antcv-cv-layout-margin-style'] || {}).textContent || '' };
}

test('default (no store) is margin: body flag, card CSS, paginator budgets without the band', () => {
  const sb = sandbox({}, { card: true, cardH: 240 });
  assert.equal(sb.ctx.window.__antcvCvLayout(), 'margin');
  assert.equal(sb.ctx.window.__antcvCvLayoutIs('margin'), true);
  assert.equal(sb.bodyAttrs['data-antcv-cv-margin'], '1');
  assert.ok(sb.css().includes('[data-antcv-sidebar-card]'), 'card CSS installed');
  assert.ok(sb.css().includes('flex-direction:column'), 'one contact item per line');
  const last = sb.cfg[sb.cfg.length - 1];
  assert.equal(last.PAGE1_BAND, 0, 'main column: no band deduction on page 1');
  assert.equal(last.SIDEBAR_PAGE1_BAND, 240 + 10 + 78, 'sidebar: card height + residue');
});

test('two_column (explicit) and the kill switch keep the band: no card CSS, band budgets restored', () => {
  const a = sandbox({ 'antcv:cvLayout': 'two_column' });
  assert.equal(a.ctx.window.__antcvCvLayout(), 'two_column');
  assert.equal(a.bodyAttrs['data-antcv-cv-margin'], '0');
  assert.equal(a.css(), '');
  assert.equal(JSON.stringify(a.cfg[a.cfg.length - 1]), JSON.stringify({ PAGE1_BAND: 152, SIDEBAR_PAGE1_BAND: 230 }));   // vm realm objects: compare by value
  const k = sandbox({ 'antcv:disable-cv-layout-margin': '1' });
  assert.equal(k.ctx.window.__antcvCvLayout(), 'two_column');
  const l = sandbox({ 'antcv:cvLayout': 'linear' });
  assert.equal(l.ctx.window.__antcvCvLayout(), 'linear');
  assert.equal(l.bodyAttrs['data-antcv-cv-margin'], '0');
});

test('a paper that rendered the band before the sidecar loaded gets one re-render; a flip re-renders too', () => {
  const sb = sandbox({}, { band: true, card: false });
  assert.ok(sb.events.includes('cv-layout-margin-boot'), 'boot re-render requested');
  const n = sb.events.length;
  sb.store.set('antcv:cvLayout', 'two_column');
  sb.ctx.window.__antcvCvLayoutMarginApply();
  assert.equal(sb.events.length, n + 1, 'flip to band re-renders once');
  assert.equal(sb.bodyAttrs['data-antcv-cv-margin'], '0');
});

test('CL tab: the margin budgets are not pushed into the paginator', () => {
  const sb = sandbox({ doc: '"cl"' }, { card: false });
  assert.equal(JSON.stringify(sb.cfg[sb.cfg.length - 1]), JSON.stringify({ PAGE1_BAND: 152, SIDEBAR_PAGE1_BAND: 230 }));
});

test('app.js + app.src.js: the band is gated off and the card renders first in the page-1 sidebar (mirror)', () => {
  for (const f of ['app.js', 'app.src.js']) {
    const s = read(f);
    assert.ok(s.includes('window.__antcvCvLayoutIs("margin")'), f + ' reads the layout from the sidecar');
    assert.ok(s.includes('"data-antcv-sidebar-card"'), f + ' renders the card');
    assert.ok(s.includes('"data-antcv-card-head"'), f + ' renders the CONTACT heading');
    assert.ok(s.includes('"data-antcv-card-photo"'), f + ' renders the card photo');
    // the card photo covers exactly the four header-adjacent positions
    assert.ok(/"sidebar-top" === er \|\| "band-overlap" === er \|\| "header-left" === er \|\| "header-right" === er|"sidebar-top"===fr\|\|"band-overlap"===fr\|\|"header-left"===fr\|\|"header-right"===fr/.test(s), f + ' card photo positions');
  }
  const app = read('app.js');
  assert.ok(app.includes('R&&!__antcvMarginOn?React.createElement("div",{"data-antcv-candidate-band":"1"'), 'band gated');
  assert.ok(app.includes('__antcvMarginOn?null:React.createElement("div",{style:{background:`var(--header-bg, ${We})`,height:8'), 'no empty strip either');
  assert.ok(app.includes('0===n&&!__antcvMarginOn&&no&&("sidebar-top"===fr||"band-overlap"===fr)'), 'sidebar-top photo gated (it lives in the card)');
  assert.ok(app.includes('a=!__antcvMarginOn&&"band-overlap"===fr'), 'bridge off in margin mode');
});

test('Page-flow control: three layouts, margin default, writes two_column explicitly, tells the margin sidecar', () => {
  const s = read('antcv-role-line-format.js');
  assert.ok(s.includes("['margin', 'Two-column (header in sidebar)'], ['two_column', 'Two-column (band)'], ['linear', 'Linear']"), 'options');
  assert.ok(s.includes("if (v === 'linear' || v === 'two_column') localStorage.setItem(LKEY, v); else localStorage.removeItem(LKEY);"), 'store rule');
  assert.ok(s.includes("window.__antcvCvLayoutMarginApply()"), 'margin sidecar notified');
  assert.ok(s.includes("antcv:disable-cv-layout-margin"), 'kill switch honoured by the control');
});

test('index.html loads the margin sidecar after the linear one, busted to the app.js version', () => {
  const index = read('index.html');
  const v = index.match(/app\.src = 'app\.js\?v=([^']+)'/)[1];
  assert.ok(index.includes('antcv-cv-layout-margin.js?v=' + v), 'margin sidecar busted to ' + v);
  assert.ok(index.indexOf('antcv-cv-layout-linear.js?v=') < index.indexOf('antcv-cv-layout-margin.js?v='), 'linear first, margin after');
  assert.ok(index.indexOf('antcv-auto-pagebreak-block-001.js?v=') < index.indexOf('antcv-cv-layout-margin.js?v='), 'paginator before the budgets writer');
});
