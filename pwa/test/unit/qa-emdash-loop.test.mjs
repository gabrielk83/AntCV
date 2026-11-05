// qa-emdash-loop.test.mjs
// ============================================================
// QA-EMDASH-LOOP-001 (owner 2026-11-05, "settings still blips"): on
// antcv.pages.dev 1.51.5885, application #3491 carried an application question
// with an en dash ("problem and requirements – What were you trying to ...").
// Measured in the live tab with Settings closed: 556 antcv:sections-updated
// events in 6 s, cycling coalesced -> application-qa -> emdash-hyphen.
// antcv-application-qa-section.js wrote the dash into the Q&A row,
// antcv-emdash-to-hyphen.js rewrote it to "-", and the Q&A sync compared the
// scrubbed row with the raw source, saw a change and wrote the dash back.
// The Q&A sidecar now builds rows with the scrub's rule. These tests load BOTH
// real sidecars in one vm sandbox sharing one store and one event bus.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const QA_SRC = readFileSync(new URL('../../antcv-application-qa-section.js', import.meta.url), 'utf8');
const DASH_SRC = readFileSync(new URL('../../antcv-emdash-to-hyphen.js', import.meta.url), 'utf8');

const Q = 'Describe a project from problem and requirements – What were you trying to achieve?';
const A = 'At Innoviz I took a lidar receiver from requirements — through prototypes — to production.';
const CLOSING = 'I look forward to expanding on any of these answers in a conversation.';

// One sandbox, both sidecars. dispatchEvent calls the listeners synchronously,
// like the browser; rAF and timers are queued and drained by hand so a loop
// shows up as a growing event count instead of a hang.
function load(seed) {
  const store = new Map(Object.entries(seed));
  const listeners = {};
  const queue = [];
  const events = [];
  const win = {
    addEventListener(t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
    dispatchEvent(e) {
      events.push((e.detail && (e.detail.reason || e.detail.source)) || null);
      (listeners[e.type] || []).slice().forEach((fn) => fn(e));
      return true;
    },
    requestAnimationFrame(fn) { queue.push(fn); return queue.length; },
  };
  const sb = {
    window: win,
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    setTimeout: () => 0, setInterval: () => 0, clearTimeout() {},
    CustomEvent: function (t, o) { this.type = t; this.detail = o && o.detail; },
    console: { info() {}, log() {} },
    JSON, Array, Object, String, RegExp, Error,
  };
  vm.createContext(sb);
  vm.runInContext(QA_SRC, sb);
  vm.runInContext(DASH_SRC, sb);
  // Drain queued frames; stop after `max` so a loop fails instead of spinning.
  function settle(max = 50) {
    let n = 0;
    while (queue.length && n < max) { queue.shift()(); n++; }
    return n;
  }
  return { qa: win.AntcvApplicationQa, store, events, settle, queue, dispatch: (e) => win.dispatchEvent(e) };
}

const QA_SECTION = (items) => ({
  id: 'application_qa', title: 'Responses to application questions:', loc: 'main', on: true,
  type: 'rich_block', leadBold: true, pageBreakBefore: true, items,
});
const secs = (store) => JSON.parse(store.get('sections'));
const seed = (cl) => ({
  sections: JSON.stringify({ cv: [], cl }),
  'antcv:applicationQuestions': JSON.stringify([{ question: Q, answer: A }]),
});

test('THE BUG: a dashed question converges (no write/scrub tug-of-war)', () => {
  const s = load(seed([QA_SECTION([{ b: 'old', t: 'old' }])]));
  s.qa.run();
  const frames = s.settle();
  assert.ok(frames < 50, `settled in ${frames} frames (a loop never drains the queue)`);
  assert.equal(s.queue.length, 0, 'no frame left pending');
  assert.ok(s.events.length <= 3, `at most a few events, got ${s.events.length}: ${s.events.join(', ')}`);
  const rows = secs(s.store).cl[0].items;
  assert.equal(rows[0].b, Q.replace(/[—–]/g, '-'));
  assert.equal(rows[0].t, A.replace(/[—–]/g, '-'));
  assert.equal(rows[1].t, CLOSING);
  assert.ok(!/[—–]/.test(s.store.get('sections')), 'no long dash left in sections');
});

test('a row already scrubbed by emdash-hyphen is left alone (no write, no event)', () => {
  const clean = [QA_SECTION([{ b: Q.replace(/[—–]/g, '-'), t: A.replace(/[—–]/g, '-') }, { b: '', t: CLOSING }])];
  const s = load(seed(clean));
  const before = s.store.get('sections');
  s.qa.run();
  s.settle();
  assert.equal(s.store.get('sections'), before, 'nothing rewritten');
  assert.deepEqual(s.events, [], 'no sections-updated dispatched');
});

test('an outside sections-updated after convergence wakes both sidecars once, no echo', () => {
  const s = load(seed([QA_SECTION([])]));
  s.qa.run();
  s.settle();
  assert.ok(s.events.length >= 1, 'first build wrote');
  const before = s.store.get('sections');
  s.events.length = 0;
  // the app saving the document (any other writer) dispatches once
  s.dispatch({ type: 'antcv:sections-updated', detail: { reason: 'app-save' } });
  s.settle();
  assert.equal(s.store.get('sections'), before);
  assert.deepEqual(s.events, ['app-save'], 'neither sidecar answers with a write');
});

test('a real source change still rewrites the rows, with hyphens', () => {
  const clean = [QA_SECTION([{ b: Q.replace(/[—–]/g, '-'), t: A.replace(/[—–]/g, '-') }, { b: '', t: CLOSING }])];
  const s = load(seed(clean));
  s.store.set('antcv:applicationQuestions', JSON.stringify([{ question: 'Why Kaleido – and why now?', answer: 'Optical design from requirements to manufacturing.' }]));
  s.qa.run();
  s.settle();
  const rows = secs(s.store).cl[0].items;
  assert.equal(rows[0].b, 'Why Kaleido - and why now?');
  assert.equal(rows.length, 2);
  assert.equal(s.events.filter((r) => r === 'application-qa').length, 1, 'one Q&A write');
});
