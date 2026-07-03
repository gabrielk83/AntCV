// application-qa-detect.test.mjs
// ============================================================
// APPLICATION-QA-001 P2+P3 bridge (antcv-application-qa-detect.js): map
// rationale.questions_in_jd (Source A) or a one-shot /api/jd-analysis fetch
// (Source B) into localStorage['antcv:applicationQuestions'] so the P1
// scaffold (antcv-application-qa-section.js) renders the extra CL page.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-application-qa-detect.js', import.meta.url), 'utf8');
const p1src = await readFile(new URL('../../antcv-application-qa-section.js', import.meta.url), 'utf8');

const NIL_JD = `Nanooptics Prototyping Engineer - NIL Technology
Interested?
Please forward your CV and application letter incl. answers to the 2 questions below, no later than 31 May 2026.
1. Key experience #1
Describe a process development or optimization challenge you have solved in the cleanroom. What was your approach, and what was the outcome?
2. Key experience #2
Provide an example of a situation where you managed a complex multistep process flow. How did you ensure efficiency and quality throughout?`;

const TWO_QS = [
  { question: 'Describe a process development or optimization challenge you have solved in the cleanroom. What was your approach, and what was the outcome?', suggested_answer: 'At TAU I developed cleanroom processes for NEMS devices.', grounded: true },
  { question: 'Provide an example of a situation where you managed a complex multistep process flow. How did you ensure efficiency and quality throughout?', suggested_answer: 'I ran multistep EO validation flows.', grounded: false },
];

function load(store0, opts) {
  const store = new Map(Object.entries(store0 || {}));
  const fetchCalls = [];
  const dispatched = [];
  const timeouts = [];
  const sandbox = {
    window: {
      ANTCV_RELAY_URL: (opts && 'relay' in opts) ? opts.relay : 'https://relay.example',
      addEventListener() {},
      dispatchEvent(e) { dispatched.push(e && e.type); return true; },
    },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    fetch: (url, init) => {
      fetchCalls.push({ url, body: JSON.parse(init.body) });
      const resp = (opts && opts.response) || { ok: true, analysis: { questions_in_jd: TWO_QS } };
      return Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify(resp)) });
    },
    setTimeout(fn) { timeouts.push(fn); return 0; },
    CustomEvent: function (t, o) { this.type = t; Object.assign(this, o); },
    Promise, JSON, Array, Object, Error, RegExp, Math, String, Number, Boolean,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return { api: sandbox.window.AntcvApplicationQaDetect, store, fetchCalls, dispatched, sandbox };
}

test('heuristic matches the NIL question block; plain JDs do not fire', () => {
  const { api } = load({});
  assert.equal(api._heuristic(NIL_JD), true);
  assert.equal(api._heuristic('We are looking for a senior engineer. Apply via our website with a CV.'), false);
  assert.equal(api._heuristic(''), false);
});

test('Source B: fetch fires once, key gets 2 items, [verify] prefix on ungrounded, event dispatched', async () => {
  const { api, store, fetchCalls, dispatched } = load({ 'antcv:lastJdText': NIL_JD });
  api.run();
  await new Promise((r) => setImmediate(r));
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, 'https://relay.example/api/jd-analysis');
  assert.equal(fetchCalls[0].body.search_recruiter, false);
  const out = JSON.parse(store.get('antcv:applicationQuestions'));
  assert.equal(out.length, 2);
  assert.ok(out[0].answer.startsWith('At TAU'));
  assert.ok(out[1].answer.startsWith('[verify] '), 'grounded:false gets the [verify] prefix');
  assert.ok(dispatched.includes('antcv:sections-updated'));
  assert.ok(store.get('antcv:applicationQuestionsJd'), 'fingerprint sentinel set');
});

test('Source A precedence: rationale.questions_in_jd wins, no fetch', async () => {
  const { store, fetchCalls, api } = load({
    'antcv:lastJdText': NIL_JD,
    rationale: JSON.stringify({ questions_in_jd: TWO_QS }),
  });
  api.run();
  await new Promise((r) => setImmediate(r));
  assert.equal(fetchCalls.length, 0);
  assert.equal(JSON.parse(store.get('antcv:applicationQuestions')).length, 2);
});

test('fingerprint sentinel: second run with same JD does not refetch', async () => {
  const { api, fetchCalls } = load({ 'antcv:lastJdText': NIL_JD });
  api.run();
  await new Promise((r) => setImmediate(r));
  api.run();
  await new Promise((r) => setImmediate(r));
  assert.equal(fetchCalls.length, 1);
});

test('found-nothing: key becomes [] + sentinel set (P1 will hide the section)', async () => {
  const { api, store, fetchCalls } = load(
    { 'antcv:lastJdText': NIL_JD },
    { response: { ok: true, analysis: { questions_in_jd: [] } } },
  );
  api.run();
  await new Promise((r) => setImmediate(r));
  assert.equal(fetchCalls.length, 1);
  assert.equal(store.get('antcv:applicationQuestions'), '[]');
  assert.ok(store.get('antcv:applicationQuestionsJd'));
});

test('transport failure: no sentinel, retry allowed', async () => {
  const store0 = { 'antcv:lastJdText': NIL_JD };
  const { api, store, sandbox } = load(store0);
  sandbox.fetch = () => Promise.reject(new Error('offline'));
  api.run();
  await new Promise((r) => setImmediate(r));
  assert.equal(store.get('antcv:applicationQuestionsJd'), undefined);
  assert.equal(store.get('antcv:applicationQuestions'), undefined);
});

test('owner-edited answers with the same question set are never overwritten', async () => {
  const edited = TWO_QS.map((q) => ({ question: q.question, answer: 'OWNER EDITED ANSWER' }));
  const { api, store } = load({
    'antcv:lastJdText': NIL_JD,
    rationale: JSON.stringify({ questions_in_jd: TWO_QS }),
    'antcv:applicationQuestions': JSON.stringify(edited),
  });
  api.run();
  await new Promise((r) => setImmediate(r));
  const out = JSON.parse(store.get('antcv:applicationQuestions'));
  assert.equal(out[0].answer, 'OWNER EDITED ANSWER');
});

test('legacy jd_questions CL section is hidden (never deleted) on a non-empty write', async () => {
  const secs = { cv: [], cl: [{ id: 'jd_questions', type: 'labeled_list', on: true, items: [] }] };
  const { api, store } = load({
    'antcv:lastJdText': NIL_JD,
    rationale: JSON.stringify({ questions_in_jd: TWO_QS }),
    sections: JSON.stringify(secs),
  });
  api.run();
  await new Promise((r) => setImmediate(r));
  const cl = JSON.parse(store.get('sections')).cl;
  assert.equal(cl.length, 1, 'section not deleted');
  assert.equal(cl[0].on, false, 'section hidden');
});

// ---- GEN-UNSOL-STALE-JD-001: unsolicited context gate ----------------------

test('unsolicited via meta: stale questions emptied, sentinel deleted, no fetch', async () => {
  const { api, store, fetchCalls, dispatched } = load({
    'antcv:lastJdText': NIL_JD,
    meta: JSON.stringify({ company: 'Unsolicited' }),
    rationale: JSON.stringify({ questions_in_jd: TWO_QS }),
    'antcv:applicationQuestions': JSON.stringify(TWO_QS.map((q) => ({ question: q.question, answer: 'stale' }))),
    'antcv:applicationQuestionsJd': 'stale-fp',
  });
  api.run();
  await new Promise((r) => setImmediate(r));
  assert.equal(fetchCalls.length, 0, 'Source B suppressed');
  assert.equal(store.get('antcv:applicationQuestions'), '[]', 'stale set emptied so P1 hides the page');
  assert.equal(store.get('antcv:applicationQuestionsJd'), undefined, 'sentinel deleted');
  assert.ok(dispatched.includes('antcv:sections-updated'));
});

test('unsolicited via activeAppCompany (JSON-quoted): same gate', async () => {
  const { api, store, fetchCalls } = load({
    'antcv:lastJdText': NIL_JD,
    'antcv:activeAppCompany': '"Unsolicited"',
    'antcv:applicationQuestions': JSON.stringify([{ question: 'q', answer: 'a' }]),
  });
  api.run();
  await new Promise((r) => setImmediate(r));
  assert.equal(fetchCalls.length, 0);
  assert.equal(store.get('antcv:applicationQuestions'), '[]');
});

test('unsolicited with already-empty key: no write, no dispatch, no fetch', async () => {
  const { api, store, fetchCalls, dispatched } = load({
    'antcv:lastJdText': NIL_JD,
    meta: JSON.stringify({ company: 'Unsolicited' }),
  });
  api.run();
  await new Promise((r) => setImmediate(r));
  assert.equal(fetchCalls.length, 0);
  assert.equal(store.get('antcv:applicationQuestions'), undefined);
  assert.equal(dispatched.length, 0);
});

test('targeted control: meta.company=NIL keeps Source A working (gate does not regress)', async () => {
  const { api, store, fetchCalls } = load({
    'antcv:lastJdText': NIL_JD,
    meta: JSON.stringify({ company: 'NIL Technology' }),
    rationale: JSON.stringify({ questions_in_jd: TWO_QS }),
  });
  api.run();
  await new Promise((r) => setImmediate(r));
  assert.equal(fetchCalls.length, 0);
  assert.equal(JSON.parse(store.get('antcv:applicationQuestions')).length, 2);
});

test('kill switch blocks everything', async () => {
  const { api, store, fetchCalls } = load({
    'antcv:lastJdText': NIL_JD,
    'antcv:disable-application-qa': '1',
  });
  api.run();
  await new Promise((r) => setImmediate(r));
  assert.equal(fetchCalls.length, 0);
  assert.equal(store.get('antcv:applicationQuestions'), undefined);
});

test('end-to-end with P1: after the bridge writes, the scaffold builds application_qa after closure', async () => {
  const secs = { cv: [], cl: [{ id: 'closure', type: 'text', on: true }] };
  const { api, store, sandbox } = load({
    'antcv:lastJdText': NIL_JD,
    rationale: JSON.stringify({ questions_in_jd: TWO_QS }),
    sections: JSON.stringify(secs),
    personalInfo: JSON.stringify({ name: 'Gabriel Karp-Gershon', headline: 'Product Expert' }),
  });
  api.run();
  await new Promise((r) => setImmediate(r));
  vm.runInContext(p1src, sandbox); // load P1 into the same sandbox; boot sweeps are captured setTimeouts
  sandbox.window.AntcvApplicationQa.run();
  const cl = JSON.parse(store.get('sections')).cl;
  const qa = cl.find((s) => s.id === 'application_qa');
  assert.ok(qa, 'application_qa created');
  // QA-STANDALONE-PAGE-001 (1.51.107): the page now splices at the very END of
  // the CL (after sign-off/signature elements) and carries its own closing
  // block (closing line + sign-off + name) after the answers.
  assert.equal(cl.indexOf(qa), cl.length - 1, 'placed LAST');
  assert.equal(qa.pageBreakBefore, true);
  assert.equal(qa.items.length, 4); // header + 2 Q&A rows + closing line (sign-off+name render worker-side, wk 1.14.126)
  assert.match(qa.items[0].t, /Responses to your application questions:/);
  assert.equal(qa.items[1].b, TWO_QS[0].question);
});
