// QA-KERNEL-NAMESPACE-001 (owner 2026-07-04, "fix the QnA page issue") — the
// application_qa scaffold (antcv-application-qa-section.js) hid a REAL Q&A
// section whenever the questions source read empty. A fresh tab boots on the
// 'kernel' JD-scope namespace where that slot is ALWAYS empty, so the CL
// exported without its questions page (three 1-page CLs in a row).
//
// Locks: on the kernel namespace with a real Q&A section, run() is a NO-OP;
// on a real app namespace an explicitly empty source still hides; and a
// kernel tab with only a placeholder/empty section may still hide it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../../antcv-application-qa-section.js', import.meta.url), 'utf8');

const REAL_QA_SECTION = {
  id: 'application_qa', title: 'APPLICATION QUESTIONS', loc: 'main', on: true,
  type: 'rich_block', leadBold: true, pageBreakBefore: true,
  items: [
    { grp: true, t: 'Responses to your application questions' },
    { b: 'Q1: Describe a process development challenge.', t: 'At TAU I developed cleanroom fabrication flows for suspended CNT NEMS devices using SOI substrates.' },
    { b: 'Q2: A complex multistep flow.', t: 'I ran multistep electro-optical validation flows with traceable data packages.' },
  ],
};

function load(store0, appId) {
  const store = new Map(Object.entries(store0 || {}));
  const sandbox = {
    window: {
      addEventListener() {},
      dispatchEvent() { return true; },
      AntcvJdScope: { getCurrentAppId: () => appId, nsKey: (b) => 'antcv:app:' + appId + ':' + b },
    },
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

test('kernel namespace + real Q&A section: run() never hides it', () => {
  const { api, store } = load({ sections: JSON.stringify({ cv: [], cl: [REAL_QA_SECTION] }) }, 'kernel');
  api.run();
  const secs = JSON.parse(store.get('sections'));
  assert.notEqual(secs.cl[0].on, false, 'real Q&A must survive the kernel-namespace empty read');
});

test('QA-SECTION-DURABLE-001: a real Q&A section survives an empty key on ANY namespace (app id too)', () => {
  const { api, store } = load({ sections: JSON.stringify({ cv: [], cl: [REAL_QA_SECTION] }) }, '435');
  api.run();
  const secs = JSON.parse(store.get('sections'));
  assert.notEqual(secs.cl[0].on, false, 'the section is the durable source of truth once built');
});

test('kernel namespace + placeholder-only section: may hide (nothing real to protect)', () => {
  const placeholder = { ...REAL_QA_SECTION, items: [{ grp: true, t: 'Responses to your application questions' }, { b: '', t: '' }] };
  const { api, store } = load({ sections: JSON.stringify({ cv: [], cl: [placeholder] }) }, 'kernel');
  api.run();
  const secs = JSON.parse(store.get('sections'));
  assert.equal(secs.cl[0].on, false);
});

test('questions present in the app namespace: section built/kept on', () => {
  // In the real app the jd-scope redirect resolves 'antcv:applicationQuestions'
  // to the active app's namespaced slot; the sandbox has no redirect, so store
  // under the global key to simulate a populated app namespace.
  const { api, store } = load({
    sections: JSON.stringify({ cv: [], cl: [{ id: 'closure', type: 'rich_block', items: [{ b: '', t: 'Closing.' }] }] }),
    'antcv:applicationQuestions': JSON.stringify([{ question: 'Q1?', answer: 'A1 grounded in real data.' }]),
  }, '435');
  api.run();
  const secs = JSON.parse(store.get('sections'));
  const qa = secs.cl.find((s) => s.id === 'application_qa');
  assert.ok(qa && qa.on !== false && qa.pageBreakBefore, 'section created after closure with a page break');
});

// QA-STANDALONE-PAGE-001 (spec rule 24): the built page is self-contained and always LAST.
test('built section carries its own closing block (line + sign-off + name) after the answers', () => {
  const { api, store } = load({
    sections: JSON.stringify({ cv: [], cl: [{ id: 'closure', type: 'rich_block', items: [{ b: '', t: 'Closing.' }] }] }),
    'antcv:applicationQuestions': JSON.stringify([{ question: 'Q1?', answer: 'A1 grounded in real data.' }]),
    'antcv:clClosing': JSON.stringify('At your service,'),
    'antcv:clSignName': JSON.stringify('Gabriel'),
    personalInfo: JSON.stringify({ name: 'Gabriel Alexander Karp-Gershon' }),
  }, '435');
  api.run();
  const secs = JSON.parse(store.get('sections'));
  const qa = secs.cl.find((s) => s.id === 'application_qa');
  const texts = qa.items.map((it) => it.t);
  // wk 1.14.126: sign-off + name render WORKER-SIDE on the dedicated page 2
  // (alternate sign-off, never the letter's) — the section carries only the
  // closing line.
  assert.ok(texts.some((t) => /look forward to expanding/.test(t)), 'closing line present');
  assert.ok(!texts.includes('At your service,'), 'no duplicated letter sign-off in the section');
  assert.equal(secs.cl[secs.cl.length - 1].id, 'application_qa', 'Q&A page is the LAST cl element');
});

test('an existing Q&A section that is not last gets MOVED to the end on sync', () => {
  const { api, store } = load({
    sections: JSON.stringify({ cv: [], cl: [
      { id: 'application_qa', title: 'APPLICATION QUESTIONS', loc: 'main', on: true, type: 'rich_block', pageBreakBefore: true, items: [{ grp: true, t: 'Responses to your application questions' }] },
      { id: 'signoff_el', type: 'rich_block', items: [{ b: '', t: 'At your service,' }] },
    ] }),
    'antcv:applicationQuestions': JSON.stringify([{ question: 'Q1?', answer: 'A1 grounded in real data.' }]),
    personalInfo: JSON.stringify({ name: 'Gabriel Alexander Karp-Gershon' }),
  }, '435');
  api.run();
  const secs = JSON.parse(store.get('sections'));
  assert.equal(secs.cl[secs.cl.length - 1].id, 'application_qa');
});
