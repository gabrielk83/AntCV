// fit-panel.test.mjs
// ============================================================
// CLUSTER-QUAL-001 stage 3 (section 6 rollout step 6, owner 2026-07-05):
// "PWA: add a fit panel (score + matched/gaps) on each application; show
// 'based on N jobs' confidence." antcv-fit-panel.js reads the new
// active_application.fit field access-relay's GET /api/prefs now surfaces
// (stage 3 server side, fetchApplicationFit — tested in
// workers/access-relay/tests/application-fit-read.test.mjs) and renders a
// "Market fit" card as a sibling right after #antcv-analysis-report.
//
// Exercised directly via a vm sandbox with a lightweight hand-rolled fake
// DOM (this repo has no jsdom dependency) + fake localStorage/fetch,
// matching the established pattern in boot-storm-sidecar-coalesce.test.mjs
// for sidecars that manipulate the DOM.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-fit-panel.js', import.meta.url), 'utf8');

// ---- minimal fake DOM: just enough for getElementById/createElement/
// appendChild/insertBefore/removeChild + id-registration + sibling links.
function makeDom() {
  const registry = new Map();
  class FakeElement {
    constructor(tag) {
      this.tagName = tag;
      this._id = '';
      this.children = [];
      this.parentNode = null;
      this._innerHTML = '';
      this.style = {};
    }
    get id() { return this._id; }
    set id(v) { this._id = v; if (v) registry.set(v, this); }
    get innerHTML() { return this._innerHTML; }
    set innerHTML(v) { this._innerHTML = v; }
    get nextSibling() {
      if (!this.parentNode) return null;
      const idx = this.parentNode.children.indexOf(this);
      return this.parentNode.children[idx + 1] || null;
    }
    get previousElementSibling() {
      if (!this.parentNode) return null;
      const idx = this.parentNode.children.indexOf(this);
      return this.parentNode.children[idx - 1] || null;
    }
    appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
    insertBefore(newNode, refNode) {
      newNode.parentNode = this;
      const idx = refNode ? this.children.indexOf(refNode) : -1;
      if (idx === -1) this.children.push(newNode); else this.children.splice(idx, 0, newNode);
      return newNode;
    }
    removeChild(child) {
      const idx = this.children.indexOf(child);
      if (idx !== -1) this.children.splice(idx, 1);
      child.parentNode = null;
      return child;
    }
  }
  const head = new FakeElement('head');
  const body = new FakeElement('body');
  const document = {
    head, body,
    readyState: 'complete',
    createElement: (tag) => new FakeElement(tag),
    getElementById: (id) => registry.get(id) || null,
    addEventListener() {},
  };
  return { document, FakeElement, registry };
}

function load(store0, opts) {
  const store = new Map(Object.entries(store0 || {}));
  const fetchCalls = [];
  const { document, FakeElement } = makeDom();
  class MutationObserver { constructor(cb) { this.cb = cb; } observe() {} disconnect() {} }
  const fetchImpl = (url) => {
    fetchCalls.push(url);
    const resp = (opts && opts.response) !== undefined ? opts.response : {
      ok: true,
      active_application: {
        fit: { cluster_id: 'pm_process', fit_score: 78, tier: 'T1', matched: ['Stakeholder management'], gaps: ['Six Sigma'], jd_count: 4, computed_at: 1 },
      },
    };
    if (opts && opts.httpNotOk) return Promise.resolve({ ok: false });
    if (opts && opts.rejectFetch) return Promise.reject(new Error('down'));
    return Promise.resolve({ ok: true, json: () => Promise.resolve(resp) });
  };
  const sandbox = {
    window: {
      ANTCV_RELAY_URL: (opts && 'relay' in opts) ? opts.relay : 'https://relay.example',
      addEventListener() {},
      fetch: fetchImpl,
      MutationObserver,
    },
    document,
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    MutationObserver,
    setTimeout(fn) { return 0; },
    setInterval() { return 0; },
    clearInterval() {},
    console,
    Date, Array, Object, Promise, JSON, String, Number, Boolean, Math, RegExp,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return { api: sandbox.window.AntcvFitPanel, document, FakeElement, fetchCalls, sandbox };
}

test('_findAnchor returns null when the Analysis Report panel is not in the DOM', () => {
  const { api } = load({});
  assert.equal(api._findAnchor(), null);
});

test('cardHtml shows the "no data yet" message when fit is null', () => {
  const { api } = load({});
  const html = api._cardHtml(null);
  assert.match(html, /Market fit/);
  assert.match(html, /No market-fit data yet/);
});

test('cardHtml (Danish) shows the localized empty message', () => {
  const { api } = load({ language: 'da' });
  const html = api._cardHtml(null);
  assert.match(html, /Markedstilpasning/);
  assert.match(html, /Ingen markedstilpasningsdata endnu/);
});

test('cardHtml renders score, tier label, "based on N jobs", matched and gaps', () => {
  const { api } = load({});
  const html = api._cardHtml({
    cluster_id: 'pm_process', fit_score: 82, tier: 'T1',
    matched: ['Stakeholder management', 'Six Sigma'],
    gaps: ['Quantum computing research'],
    jd_count: 5, computed_at: 1,
  });
  assert.match(html, /82%/);
  assert.match(html, /Strong/); // T1 -> Strong
  assert.match(html, /Based on 5 jobs in this category/);
  assert.match(html, /Stakeholder management/);
  assert.match(html, /Six Sigma/);
  assert.match(html, /Quantum computing research/);
});

test('cardHtml singularizes "1 job" and escapes HTML in matched/gaps text', () => {
  const { api } = load({});
  const html = api._cardHtml({ cluster_id: 'x', fit_score: 10, tier: 'T4', matched: ['<script>alert(1)</script>'], gaps: [], jd_count: 1, computed_at: 1 });
  assert.match(html, /Based on 1 job in this category/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
});

test('render() inserts the card as a sibling right after #antcv-analysis-report, once', () => {
  const { api, document } = load({});
  const anchor = document.createElement('div');
  anchor.id = 'antcv-analysis-report';
  document.body.appendChild(anchor);
  const after = document.createElement('div');
  document.body.appendChild(after);

  api.render();
  const firstCard = document.getElementById('antcv-fit-panel');
  assert.ok(firstCard, 'an anchor exists -> the card renders even with no cached fit yet (empty-state message)');
  assert.match(firstCard.innerHTML, /No market-fit data yet/);

  api.render();
  const cards = document.body.children.filter((c) => c.id === 'antcv-fit-panel');
  assert.equal(cards.length, 1, 'repeated render() calls must not duplicate the card');
  assert.equal(document.body.children.indexOf(cards[0]), document.body.children.indexOf(anchor) + 1, 'card must sit immediately after the anchor');
});

test('render() is a no-op when the Analysis Report panel is absent', () => {
  const { api, document } = load({});
  api.render();
  assert.equal(document.getElementById('antcv-fit-panel'), null);
});

test('refresh() fetches GET /api/prefs and extracts active_application.fit into the rendered card', async () => {
  const { api, document, fetchCalls } = load({});
  const anchor = document.createElement('div');
  anchor.id = 'antcv-analysis-report';
  document.body.appendChild(anchor);

  await api.refresh();
  assert.equal(fetchCalls.length, 0, 'no auth token yet -> must not call fetch');
});

test('refresh() with an auth token calls /api/prefs and renders the returned fit', async () => {
  const { api, document, fetchCalls } = load({ 'antcv:auth:token': 'jwt-abc' });
  const anchor = document.createElement('div');
  anchor.id = 'antcv-analysis-report';
  document.body.appendChild(anchor);

  await api.refresh();
  assert.equal(fetchCalls.length, 1);
  assert.match(fetchCalls[0], /\/api\/prefs$/);
  const card = document.getElementById('antcv-fit-panel');
  assert.ok(card, 'the card must be rendered after a successful refresh');
  assert.match(card.innerHTML, /78%/);
  assert.match(card.innerHTML, /Stakeholder management/);
});

test('a non-ok HTTP response or a rejected fetch resolves to null, never throws', async () => {
  const httpErr = load({ 'antcv:auth:token': 'jwt-abc' }, { httpNotOk: true });
  await assert.doesNotReject(() => httpErr.api.refresh());

  const netErr = load({ 'antcv:auth:token': 'jwt-abc' }, { rejectFetch: true });
  await assert.doesNotReject(() => netErr.api.refresh());
});

test('an active_application with no fit (e.g. unsolicited) renders the empty-state card, not an error', async () => {
  const { api, document } = load(
    { 'antcv:auth:token': 'jwt-abc' },
    { response: { ok: true, active_application: { fit: null } } }
  );
  const anchor = document.createElement('div');
  anchor.id = 'antcv-analysis-report';
  document.body.appendChild(anchor);
  await api.refresh();
  const card = document.getElementById('antcv-fit-panel');
  assert.ok(card);
  assert.match(card.innerHTML, /No market-fit data yet/);
});

test('kill switch: render() removes an existing card and refresh() never calls fetch', async () => {
  const { api, document, fetchCalls } = load({ 'antcv:auth:token': 'jwt-abc', 'antcv:disable-fit-panel': '1' });
  const anchor = document.createElement('div');
  anchor.id = 'antcv-analysis-report';
  document.body.appendChild(anchor);

  await api.refresh();
  assert.equal(fetchCalls.length, 0);
  assert.equal(document.getElementById('antcv-fit-panel'), null);
});

test('installs window.AntcvFitPanel with the expected public API', () => {
  const { api } = load({});
  assert.equal(typeof api.refresh, 'function');
  assert.equal(typeof api.render, 'function');
  assert.equal(typeof api.version, 'string');
});
