// doc-stale-notice.test.mjs
// ============================================================
// OPEN-STALE-NOTICE-001 (2026-11-09): since 1.51.6445 a tab whose copy is older than the saved
// row stops saving it, with only a console line. antcv-doc-stale-notice.js shows a chip while
// antcv-app-rev-guard.js reports the tab stale (antcv:doc-stale) and hides it on antcv:doc-fresh.
// Loads the REAL sidecar into a vm with a minimal DOM (this repo has no jsdom).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SRC = readFileSync(new URL('../../antcv-doc-stale-notice.js', import.meta.url), 'utf8');
const INDEX = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const SW = readFileSync(new URL('../../sw.js', import.meta.url), 'utf8');

function element(tag) {
  return {
    tagName: tag, id: '', style: {}, attrs: {}, children: [], listeners: {}, _text: '',
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return this.attrs[k]; },
    appendChild(c) { this.children.push(c); return c; },
    addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); },
    click() { (this.listeners.click || []).forEach((f) => f({})); },
    set innerHTML(_) { this.children = []; },
    get innerHTML() { return ''; },
    set textContent(v) { this._text = String(v); },
    get textContent() { return [this._text, ...this.children.map((c) => c.textContent)].filter(Boolean).join(' '); },
  };
}
function find(root, pred) {
  if (pred(root)) return root;
  for (const c of root.children) { const f = find(c, pred); if (f) return f; }
  return null;
}

function page({ store = {}, docStale = null } = {}) {
  const ls = new Map(Object.entries(store));
  const listeners = {};
  const body = element('body');
  const reloads = [];
  const sb = {
    localStorage: { getItem: (k) => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)), removeItem: (k) => ls.delete(k) },
    document: {
      body,
      createElement: (t) => element(t),
      getElementById: (id) => find(body, (e) => e.id === id),
    },
    location: { reload: () => reloads.push(1) },
    addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
    AntcvAppRevGuard: { docStale: () => docStale },
    JSON, String, Object, Array,
  };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext(SRC, sb);
  const fire = (type, detail) => (listeners[type] || []).forEach((f) => f({ type, detail }));
  const chip = () => sb.document.getElementById('antcv-doc-stale-notice');
  const shown = () => !!chip() && chip().style.display !== 'none';
  const btn = (pred) => find(chip(), (e) => e.tagName === 'button' && pred(e));
  return { sb, fire, chip, shown, btn, reloads, api: sb.AntcvDocStaleNotice };
}

test('text: names the application, in the UI language (en/da, English otherwise)', () => {
  const { api } = page({ store: { meta: JSON.stringify({ company: 'Axis Communications' }) } });
  const t = (d, l) => JSON.parse(JSON.stringify(api.text(d, l)));
  const en = t({ reason: 'sections-changed', company: 'Elma Instruments' }, 'en');
  assert.equal(en.head, 'This tab is not saving');
  assert.equal(en.body, 'Elma Instruments was saved from another tab, device or session. Reload to load that version. Your edits in this tab go to a local backup.');
  assert.equal(en.reload, 'Reload');
  const da = t({ reason: 'sections-changed', company: 'Elma Instruments' }, 'da');
  assert.equal(da.head, 'Denne fane gemmer ikke');
  assert.match(da.body, /^Elma Instruments er gemt fra en anden fane, enhed eller session\. Genindlæs/);
  assert.equal(da.reload, 'Genindlæs');
  assert.match(t({ reason: 'sections-changed' }, 'en').body, /^Axis Communications was saved/, 'no company in the event: the tab\'s own meta');
  assert.equal(t({ reason: 'boot-not-loaded', company: 'Elma' }, 'he').head, 'This tab is not saving', 'other languages fall back to English');
  assert.match(t({ reason: 'boot-not-loaded', company: 'Elma' }, 'en').body, /^Elma: the saved version did not load\. Reload to load it\./);
  const bare = page().api;
  assert.match(bare.text({ reason: 'sections-changed' }, 'en').body, /^This application was saved/);
});

test('stale shows the chip; × hides it until the tab is fresh again; fresh hides it', () => {
  const p = page({ store: { uiLang: JSON.stringify('da') } });
  assert.equal(p.chip(), null, 'nothing on screen while saving');
  p.fire('antcv:doc-stale', { id: '3536', reason: 'sections-changed', company: 'Elma Instruments' });
  assert.ok(p.shown());
  assert.equal(p.chip().getAttribute('role'), 'alert');
  assert.equal(p.chip().style.bottom, '88px', 'above the fixed bottom toolbar (72 px)');
  assert.match(p.chip().textContent, /Denne fane gemmer ikke/);
  assert.match(p.chip().textContent, /Elma Instruments/);
  p.btn((b) => b.textContent === '×').click();
  assert.equal(p.shown(), false);
  p.fire('antcv:doc-stale', { id: '3536', reason: 'sections-changed' });
  assert.equal(p.shown(), false, 'dismissed: the repeated skips do not bring it back');
  p.fire('antcv:doc-fresh', {});
  assert.equal(p.shown(), false);
  p.fire('antcv:doc-stale', { id: '3536', reason: 'sections-changed' });
  assert.ok(p.shown(), 'a new stale episode shows it again');
  p.fire('antcv:doc-fresh', {});
  assert.equal(p.shown(), false);
});

test('Reload reloads the page (a cold boot loads the newer row)', () => {
  const p = page();
  p.fire('antcv:doc-stale', { id: '77', reason: 'sections-changed', company: 'Elma' });
  p.btn((b) => b.textContent === 'Reload').click();
  assert.equal(p.reloads.length, 1);
});

test('a tab already stale when the sidecar loads shows the chip at once; the kill switch shows nothing', () => {
  const p = page({ docStale: { id: '77', reason: 'boot-not-loaded', company: 'Elma' } });
  assert.ok(p.shown());
  assert.match(p.chip().textContent, /Elma: the saved version did not load/);
  const off = page({ store: { 'antcv:disable-doc-stale-notice': '1' } });
  off.fire('antcv:doc-stale', { id: '77', reason: 'sections-changed' });
  assert.equal(off.chip(), null);
});

test('index.html loads the notice right after the rev guard; the service worker shell lists it', () => {
  const g = INDEX.indexOf('<script src="antcv-app-rev-guard.js?v=');
  const n = INDEX.indexOf('<script src="antcv-doc-stale-notice.js?v=');
  assert.ok(g > 0 && n > g, 'loaded, after the guard');
  assert.equal(INDEX.split('antcv-doc-stale-notice.js?v=').length - 1, 1);
  assert.match(SW, /'\.\/antcv-doc-stale-notice\.js',/);
});
