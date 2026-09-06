// qa-empty-page.test.mjs
// ============================================================
// QA-EMPTY-PAGE-001 (owner 2026-09-06): "a call for response to application questions is
// generated even if there are no application questions". The rendered page 2 carried the
// headline "RESPONSES TO APPLICATION QUESTIONS:" and ONE row - the closing line "I look
// forward to expanding on any of these answers in a conversation." - and nothing else.
//
// Two holes in antcv-application-qa-section.js:
//  (a) the QA-SECTION-DURABLE-001 guard counted ANY non-group row over 20 chars as "real
//      Q&A". The closing line is 70 chars, so once the question rows were hidden, stripped
//      or never answered the section could never auto-hide on an empty key read.
//  (b) a detected question with an EMPTY (or bracket-placeholder) answer built a page anyway.
//
// Now a Q&A row is real only with BOTH a question and a renderable answer, unanswered
// detections are dropped, and the section is ON only while at least one such row is visible.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../../antcv-application-qa-section.js', import.meta.url), 'utf8');

const CLOSING = 'I look forward to expanding on any of these answers in a conversation.';
const QA = (extra) => Object.assign({
  id: 'application_qa', title: 'Responses to application questions:', loc: 'main', on: true,
  type: 'rich_block', leadBold: true, pageBreakBefore: true, items: [],
}, extra);
const ANSWERED = [
  { b: 'Describe a process development challenge.', t: 'At TAU I developed cleanroom fabrication flows for suspended CNT NEMS devices.' },
  { b: 'A complex multistep flow.', t: 'I ran multistep electro-optical validation flows with traceable data packages.' },
];

function load(store0) {
  const store = new Map(Object.entries(store0 || {}));
  const sandbox = {
    window: { addEventListener() {}, dispatchEvent() { return true; } },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    setTimeout: () => 0, clearTimeout: () => {},
    CustomEvent: function (t, o) { this.type = t; Object.assign(this, o); },
    Promise, JSON, Array, Object, Error, RegExp, Math, String, Number, Boolean,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return { api: sandbox.window.AntcvApplicationQa, store };
}
const secsOf = (store) => JSON.parse(store.get('sections'));
const withSections = (cl, more) => Object.assign({ sections: JSON.stringify({ cv: [], cl }) }, more || {});

// ---- THE REPORTED BUG ------------------------------------------------------
test('THE BUG: a section holding ONLY the closing line is hidden on an empty key', () => {
  const { api, store } = load(withSections([QA({ items: [{ b: '', t: CLOSING }] })]));
  api.run();
  assert.equal(secsOf(store).cl[0].on, false);
});

test('question rows with EMPTY answers + the closing line: hidden', () => {
  const items = [{ b: 'Why us?', t: '' }, { b: 'Tell us about a failure.', t: '' }, { b: '', t: CLOSING }];
  const { api, store } = load(withSections([QA({ items })]));
  api.run();
  assert.equal(secsOf(store).cl[0].on, false);
});

test('question rows with bracket-placeholder answers: hidden', () => {
  const items = [{ b: 'Why us?', t: '[verify]' }, { b: '', t: CLOSING }];
  const { api, store } = load(withSections([QA({ items })]));
  api.run();
  assert.equal(secsOf(store).cl[0].on, false);
});

test('question rows the owner hid in the editor + the closing line: hidden', () => {
  const items = ANSWERED.concat([{ b: '', t: CLOSING }]);
  const { api, store } = load(withSections([QA({ items, hidden: { 0: true, 1: true } })]));
  api.run();
  assert.equal(secsOf(store).cl[0].on, false);
});

// ---- QA-SECTION-DURABLE-001 must still hold ---------------------------------
test('a section with a real answered row still survives an empty key read', () => {
  const items = ANSWERED.concat([{ b: '', t: CLOSING }]);
  const { api, store } = load(withSections([QA({ items })]));
  api.run();
  assert.notEqual(secsOf(store).cl[0].on, false);
});

test('one answered row among hidden ones is enough to keep the page', () => {
  const items = ANSWERED.concat([{ b: '', t: CLOSING }]);
  const { api, store } = load(withSections([QA({ items, hidden: { 0: true } })]));
  api.run();
  assert.notEqual(secsOf(store).cl[0].on, false);
});

// ---- the detector side: unanswered questions never build a page -------------
test('a question set with NO answers builds no section at all', () => {
  const qs = [{ question: 'Why us?', answer: '' }, { question: 'Biggest failure?', answer: '' }];
  const { api, store } = load(withSections([{ id: 'closure', type: 'text', t: 'x' }], { 'antcv:applicationQuestions': JSON.stringify(qs) }));
  api.run();
  const cl = secsOf(store).cl;
  assert.equal(cl.some((s) => s.id === 'application_qa'), false);
});

test('only the ANSWERED questions reach the page; unanswered ones are dropped', () => {
  const qs = [{ question: 'Why us?', answer: 'Because the optics roadmap matches my validation background.' }, { question: 'Biggest failure?', answer: '' }];
  const { api, store } = load(withSections([{ id: 'closure', type: 'text', t: 'x' }], { 'antcv:applicationQuestions': JSON.stringify(qs) }));
  api.run();
  const qa = secsOf(store).cl.find((s) => s.id === 'application_qa');
  assert.ok(qa && qa.on !== false && qa.pageBreakBefore, 'page built on its own page');
  const labels = qa.items.map((r) => r.b);
  assert.equal(labels.join('|'), 'Why us?|', 'one Q&A row + the closing line');
  assert.match(qa.items[qa.items.length - 1].t, /look forward to expanding/);
});

test('an existing page whose every question row the owner hid is switched OFF on sync, not forced on', () => {
  const qs = [{ question: 'Why us?', answer: 'Because the optics roadmap matches my validation background.' }];
  const existing = QA({ items: [{ b: 'Why us?', t: qs[0].answer }, { b: '', t: CLOSING }], hidden: { 0: true } });
  const { api, store } = load(withSections([{ id: 'closure', type: 'text', t: 'x' }, existing], { 'antcv:applicationQuestions': JSON.stringify(qs) }));
  api.run();
  const qa = secsOf(store).cl.find((s) => s.id === 'application_qa');
  assert.equal(qa.on, false);
});

// ---- the helper itself ------------------------------------------------------
test('_answeredRows counts only visible rows with a question AND a renderable answer', () => {
  const { api } = load({});
  assert.equal(api._answeredRows({ items: [{ b: '', t: CLOSING }] }), 0);
  assert.equal(api._answeredRows({ items: [{ b: 'Q', t: '' }] }), 0);
  assert.equal(api._answeredRows({ items: [{ b: 'Q', t: '[verify]' }] }), 0);
  assert.equal(api._answeredRows({ items: [{ grp: true, t: 'Responses to your application questions' }] }), 0);
  assert.equal(api._answeredRows({ items: [{ b: 'Q', t: 'A real answer.' }], hidden: { 0: true } }), 0);
  assert.equal(api._answeredRows({ items: [{ b: 'Q', t: 'A real answer.' }, { b: '', t: CLOSING }] }), 1);
  assert.equal(api._answeredQuestion({ question: 'Q', answer: '' }), false);
  assert.equal(api._answeredQuestion({ question: 'Q', answer: 'A' }), true);
});
