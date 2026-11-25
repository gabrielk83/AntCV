// LETTER-DIAGRAM-001 storm belt. The sidecar mounts a control and reads the letter on every
// antcv:sections-updated and on every DOM change, so the danger is the usual one: a write or an event
// from the passive path, or a write that repeats. This runs the real file against a fake window with a
// small DOM and counts every sections write and every event per reason.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SRC = readFileSync(new URL('./antcv-letter-diagram.js', import.meta.url), 'utf8');
const FLOW = { b: 'Workflow: From field day to tool', t: 'Ride along (one week) → Pick (one task) → Prototype (two weeks)' };

function el(tag) {
  const n = {
    tagName: tag, nodeType: 1, children: [], parentNode: null, attrs: {}, style: {}, textContent: '', className: '', id: '', handlers: {},
    setAttribute(k, v) { n.attrs[k] = String(v); if (k === 'id') n.id = String(v); if (k === 'class') n.className = String(v); },
    getAttribute(k) { return k in n.attrs ? n.attrs[k] : null; },
    hasAttribute(k) { return k in n.attrs; },
    addEventListener(t, f) { n.handlers[t] = f; },
    appendChild(c) { c.parentNode = n; n.children.push(c); return c; },
    removeChild(c) { n.children = n.children.filter((x) => x !== c); c.parentNode = null; return c; },
    getBoundingClientRect() { return { top: 120, width: 400, height: 40 }; },
    focus() {}, closest() { return null; },
    querySelector(q) { return find(n, q)[0] || null; },
    querySelectorAll(q) { return find(n, q); },
    get isConnected() { return true; },
  };
  return n;
}
function match(n, sel) {
  const parts = sel.trim().match(/(\.[\w-]+|#[\w-]+|\[[^\]]+\]|^[a-z]\w*)/g) || [];
  return parts.length > 0 && parts.every((p) => {
    if (p[0] === '.') return n.className.split(' ').includes(p.slice(1)) || (n.attrs.class || '').split(' ').includes(p.slice(1));
    if (p[0] === '#') return n.id === p.slice(1);
    if (p[0] === '[') { const m = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(p); return !!m && m[1] in n.attrs && (m[2] === undefined || n.attrs[m[1]] === m[2]); }
    return n.tagName === p;
  });
}
function find(root, q) {
  const out = [];
  const sels = q.split(',').map((s) => s.trim().split(/\s+/));
  (function walk(n, chain) {
    for (const c of n.children) {
      const up = chain.concat(c);
      if (sels.some((s) => match(c, s[s.length - 1]) && s.slice(0, -1).every((a) => chain.some((x) => match(x, a))))) out.push(c);
      walk(c, up);
    }
  })(root, [root]);
  return out;
}
function boot(cl, { doc = 'cl', kill = false } = {}) {
  const store = new Map([['sections', JSON.stringify({ cv: [], cl })], ['doc', JSON.stringify(doc)], ['language', '"en"']]);
  if (kill) store.set('antcv:disable-letter-diagram', '1');
  const log = { writes: 0, other: 0, events: {} };
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { if (k === 'sections') log.writes++; else log.other++; store.set(k, String(v)); },
    removeItem: (k) => store.delete(k),
  };
  const body = el('body'), head = el('head'), html = el('html');
  html.appendChild(head); html.appendChild(body);
  const bar = el('div'); bar.className = 'antcv-preview-actions'; body.appendChild(bar);
  const panel = el('div'); panel.setAttribute('data-antcv-cl-format-panel', '1'); body.appendChild(panel);
  const document = { body, head, activeElement: body, createElement: el, getElementById: (id) => find(html, '#' + id)[0] || null, querySelector: (q) => find(html, q)[0] || null, querySelectorAll: (q) => find(html, q), addEventListener() {} };
  const listeners = new Map(), timers = [];
  let seen = null;
  const window = {
    document, localStorage, getComputedStyle: () => ({ color: 'rgb(0, 116, 110)' }),
    addEventListener: (t, f) => listeners.set(t, (listeners.get(t) || []).concat(f)),
    dispatchEvent: (e) => { const r = (e.detail && e.detail.reason) || '?'; log.events[r] = (log.events[r] || 0) + 1; (listeners.get(e.type) || []).forEach((f) => f(e)); return true; },
  };
  class CustomEvent { constructor(type, init) { this.type = type; this.detail = (init || {}).detail; } }
  class MutationObserver { constructor(f) { seen = f; } observe() {} }
  const setTimeout = (f) => { timers.push(f); return timers.length; };
  // eslint-disable-next-line no-new-func
  new Function('window', 'CustomEvent', 'MutationObserver', 'setTimeout', SRC)(window, CustomEvent, MutationObserver, setTimeout);
  const drain = (max = 50) => { let n = 0; while (timers.length && n < max) { timers.shift()(); n++; } return n; };
  const mutate = () => seen && seen([{ target: body, addedNodes: [el('div')] }]);
  return { window, api: window.AntcvLetterDiagram, log, store, body, bar, panel, drain, mutate, cl: () => JSON.parse(store.get('sections')).cl, CustomEvent };
}
const letter = (extra) => [
  { id: 'opening', type: 'rich_block', on: true, items: [{ b: '', t: 'Your need is real.' }] },
  { id: 'why', type: 'rich_block', on: true, items: [{ b: 'Why', t: 'The mix.' }] },
  { id: 'bring', type: 'rich_block', on: true, items: [{ b: 'What I bring', t: 'proof:' }, ...(extra || [])] },
];

test('the passive path (timers, 200 DOM changes, 200 foreign section events) never writes and never dispatches', () => {
  for (const cl of [letter(), letter([FLOW])]) {
    const b = boot(cl);
    b.drain();
    for (let i = 0; i < 200; i++) {
      b.mutate();
      b.window.dispatchEvent(new b.CustomEvent('antcv:sections-updated', { detail: { reason: 'someone-else' } }));
      b.drain();
    }
    assert.equal(b.log.writes, 0); assert.equal(b.log.other, 0);
    assert.deepEqual(b.log.events, { 'someone-else': 200 });
    assert.equal(b.bar.children.length, 1, 'one control, not one per pass');
    assert.equal(b.panel.children.length, 1, 'one button in the format panel');
    assert.equal(b.bar.children[0].getAttribute('data-missing'), cl[2].items.length === 1 ? '1' : '0');
  }
});

test('own section event re-arms one sync only: the timers drain to empty', () => {
  const b = boot(letter([FLOW]));
  b.drain();
  b.window.dispatchEvent(new b.CustomEvent('antcv:sections-updated', { detail: { reason: 'x' } }));
  assert.ok(b.drain(50) <= 1, 'no self re-arming loop');
});

test('insert writes once with one event; the same insert again writes nothing; remove writes once', () => {
  const b = boot(letter());
  b.drain();
  b.api.open();
  const panel = () => b.body.children.find((c) => c.id === 'antcv-letter-diagram-panel');
  const inputs = () => find(panel(), '[data-step]');
  const main = () => find(panel(), '[data-main="1"]')[0];
  assert.equal(inputs().length, 3);
  ['Watch', 'Build', 'Measure'].forEach((v, i) => inputs()[i].handlers.input({ target: { value: v } }));
  main().handlers.click({});
  assert.equal(b.log.writes, 1);
  assert.deepEqual(b.log.events, { 'letter-diagram': 1 });
  assert.deepEqual(b.cl()[2].items[1], { b: 'Workflow', t: 'Watch → Build → Measure', dg: 'flow' });
  main().handlers.click({});
  b.drain();
  assert.equal(b.log.writes, 1, 'nothing changed, nothing written');
  assert.deepEqual(b.log.events, { 'letter-diagram': 1 });
  find(panel(), '[data-act="remove"]')[0].handlers.click({});
  b.drain();
  assert.equal(b.log.writes, 2);
  assert.deepEqual(b.log.events, { 'letter-diagram': 2 });
  assert.equal(b.cl()[2].items.length, 1);
  assert.equal(panel(), undefined);
});

test('a CV and the kill switch show no control and write nothing', () => {
  const cv = boot(letter(), { doc: 'cv' }); cv.drain(); cv.mutate(); cv.drain();
  assert.equal(cv.bar.children.length, 0); assert.equal(cv.log.writes, 0);
  const off = boot(letter([FLOW]), { kill: true }); off.drain(); off.mutate(); off.drain();
  assert.equal(off.bar.children.length, 0); assert.equal(off.panel.children.length, 0); assert.equal(off.log.writes, 0);
});
