// ANALYSIS-HEADER-EDITOR-GATE-001 — the analysis-panel header sidecar must ONLY act in
// the editor view. v1.0 ran a global document.body MutationObserver in every view and
// mutated a React-controlled panel, breaking the upload menu's event handling after an
// editor->upload switch ("JD list irresponsive until refresh"; downstream, a new Terma
// JD was never processed so generation kept the previous 3Shape app). These tests drive
// the real sidecar against a minimal DOM shim and assert it is inert outside the editor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'antcv-analysis-header.js'), 'utf8');

// Minimal DOM shim: a panel already in "analysis mode" (has the report anchor) so the
// ONLY thing keeping the card out is the editor-view gate.
function makeEnv(view) {
  const store = new Map([['meta', JSON.stringify({ role: 'Senior PM', company: '3Shape' })]]);
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const listeners = new Map();
  function el(tag) {
    return {
      tagName: tag, id: '', className: '', _children: [], parentNode: null,
      textContent: '', innerHTML: '',
      appendChild(c) { c.parentNode = this; this._children.push(c); return c; },
      insertBefore(c, ref) { c.parentNode = this; this._children.unshift(c); return c; },
      removeChild(c) { const i = this._children.indexOf(c); if (i >= 0) this._children.splice(i, 1); c.parentNode = null; if (c.id) delete byId[c.id]; return c; },
      get firstChild() { return this._children[0] || null; },
      querySelector() { return null; },
    };
  }
  const byId = {};
  const head = el('head');
  const body = el('body');
  // the analysis panel, always "in analysis mode"
  const panel = el('div');
  panel.querySelector = (sel) => (/analysis-report/.test(sel) ? el('div') : null);
  const document = {
    readyState: 'complete',
    head, body,
    getElementById: (id) => byId[id] || null,
    querySelector: (sel) => (/app-panel|side-panel|bottom-panel/.test(sel) ? panel : null),
    createElement: (tag) => { const e = el(tag); const set = () => { if (e.id) byId[e.id] = e; }; return new Proxy(e, { set(o, k, v) { o[k] = v; if (k === 'id') byId[v] = o; return true; } }); },
    addEventListener() {},
  };
  class MutationObserver { constructor(cb) { this.cb = cb; } observe() { this.observing = true; } disconnect() { this.observing = false; } }
  const window = {
    __antcvView: view,
    addEventListener: (t, fn) => { listeners.set(t, (listeners.get(t) || []).concat(fn)); },
    MutationObserver,
  };
  const noop = () => 0;
  const quiet = { log: noop, info: noop, warn: noop, error: noop, debug: noop };
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', 'localStorage', 'console', 'MutationObserver', 'setTimeout', 'clearTimeout', 'setInterval', SRC)(
    window, document, localStorage, quiet, MutationObserver, (fn) => { fn(); return 0; }, noop, noop);
  return { window, document, panel, api: window.AntcvAnalysisHeader };
}

test('editorActive() is false for upload/input/generating, true otherwise', () => {
  assert.equal(makeEnv('upload').api._editorActive(), false);
  assert.equal(makeEnv('input').api._editorActive(), false);
  assert.equal(makeEnv('generating').api._editorActive(), false);
  assert.equal(makeEnv('editor').api._editorActive(), true);
  assert.equal(makeEnv(undefined).api._editorActive(), true);   // unknown -> only the editor mounts the panel anyway
});

test('in the UPLOAD view the header card is NOT inserted (menu untouched)', () => {
  const env = makeEnv('upload');
  env.api.render();
  assert.equal(env.document.getElementById('antcv-analysis-header'), null, 'no card in the upload view');
  assert.equal(env.panel._children.length, 0, 'the panel is not mutated in the upload view');
});

test('in the EDITOR view the header card IS inserted (feature still works)', () => {
  const env = makeEnv('editor');
  env.api.render();
  const card = env.document.getElementById('antcv-analysis-header');
  assert.ok(card, 'card rendered in the editor');
  assert.equal(env.panel.firstChild, card, 'card is the panel first child');
});

test('switching editor -> upload removes the card and stops observing', () => {
  const env = makeEnv('editor');
  env.api.render();
  assert.ok(env.document.getElementById('antcv-analysis-header'), 'card present in editor');
  env.window.__antcvView = 'upload';
  env.api._syncObserver();
  assert.equal(env.document.getElementById('antcv-analysis-header'), null, 'card removed on leaving the editor');
});
