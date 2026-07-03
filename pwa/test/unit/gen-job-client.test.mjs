// gen-job-client.test.mjs
// ============================================================
// GEN-BACKGROUND-001 CLIENT ENGINE — the resumable generation driver
// (antcv-gen-job-client.js). Drives the real /job/* protocol against a fake
// server + deterministic clock in a vm sandbox: create -> step* -> coherence
// -> done; resume-from-persisted after a "reload"; cancel; transient retry.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-gen-job-client.js', import.meta.url), 'utf8');

function load() {
  const store = new Map();
  const sandbox = {
    window: {}, document: { hidden: false, addEventListener() {} },
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    setTimeout: (fn) => { fn(); return 0; }, clearTimeout() {},
    console: { log() {}, warn() {} },
    JSON, Array, Object, String, Number, Boolean, Math, Error, RegExp, Promise, encodeURIComponent, Date,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return { api: sandbox.window.AntcvGenJob, store, sandbox };
}

// A fake /job/* server: create mints a job, each step advances one section,
// after the last section it runs one coherence step, then done.
function fakeServer(sectionIds, { coherence = true, failFirstSteps = 0 } = {}) {
  const jobs = new Map();
  let stepCalls = 0;
  const fetchImpl = (url, opts) => {
    const path = url.replace(/^https?:\/\/[^/]+/, '');
    const body = opts.body ? JSON.parse(opts.body) : {};
    const json = (obj, ok = true, status = 200) => Promise.resolve({ ok, status, json: () => Promise.resolve(obj) });
    if (opts.method === 'POST' && /\/job\/create$/.test(path)) {
      const id = 'job-1';
      jobs.set(id, { status: 'pending', next: 0, sections: sectionIds.map((s) => ({ id: s, title: s, state: 'pending', result: null, ui_state: 'queued' })), coherence: { state: coherence ? 'pending' : 'skipped', findings: [], repaired: [] } });
      return json({ job_id: id, status: 'pending', sections: sectionIds.length });
    }
    if (opts.method === 'POST' && /\/job\/step$/.test(path)) {
      stepCalls++;
      if (stepCalls <= failFirstSteps) return json({ error: 'kv_blip' }, false, 503);
      const job = jobs.get(body.job_id);
      if (!job) return json({ error: 'not_found' }, false, 404);
      if (job.next < job.sections.length) {
        const sec = job.sections[job.next];
        sec.state = 'done'; sec.result = 'RESULT:' + sec.id; sec.ui_state = 'done';
        job.next++;
        job.status = job.next < job.sections.length ? 'running' : (job.coherence.state === 'pending' ? 'coherence' : 'done');
      } else if (job.status === 'coherence') {
        job.coherence.state = 'done'; job.coherence.summary = 'reconciled'; job.status = 'done';
      }
      return json(view(job));
    }
    if (opts.method === 'GET' && /\/job\/job-1$/.test(path)) {
      const job = jobs.get('job-1');
      return job ? json(view(job)) : json({ error: 'not_found' }, false, 404);
    }
    if (opts.method === 'POST' && /\/job\/cancel$/.test(path)) {
      const job = jobs.get(body.job_id); if (job) job.status = 'cancelled';
      return json({ ok: true });
    }
    return json({ error: 'unknown' }, false, 404);
  };
  function view(job) {
    return { job_id: 'job-1', status: job.status, next: job.next, sections: job.sections.map((s) => ({ id: s.id, title: s.title, state: s.state, ui_state: s.ui_state, result: s.result })), coherence: job.coherence };
  }
  return { fetchImpl, stepCalls: () => stepCalls, jobs };
}

const OPTS = (fetchImpl, store) => ({ fetchImpl, base: 'https://relay.example', token: 't', storage: mkStorage(store), schedule: (fn) => { fn(); return 0; }, now: () => 1000 });
function mkStorage(store) { return { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) }; }

const PLAN = { sections: [{ id: 'profile', title: 'PROFILE', prompt: {} }, { id: 'exp', title: 'EXPERIENCE', prompt: {} }], provider: 'anthropic', meta: { company: 'Trackman' } };

test('run: create -> step each section -> coherence -> done; results delivered', async () => {
  const { api, store } = load();
  const srv = fakeServer(['profile', 'exp']);
  const progress = []; let doneView = null;
  await new Promise((res) => {
    api.run(PLAN, {
      onProgress: (v) => progress.push(v.status),
      onDone: (v) => { doneView = v; res(); },
      onError: (e) => { throw new Error('unexpected error ' + e); },
    }, OPTS(srv.fetchImpl, store));
  });
  assert.equal(doneView.status, 'done');
  assert.deepEqual(doneView.sections.map((s) => s.result), ['RESULT:profile', 'RESULT:exp']);
  assert.ok(progress.includes('coherence'), 'went through the coherence phase');
  assert.equal(doneView.coherence.summary, 'reconciled');
  assert.equal(store.has('antcv:genJob'), false, 'persisted job cleared on done');
});

test('persistence: a job_id is persisted after create (survives reload)', async () => {
  const { api, store } = load();
  const srv = fakeServer(['a', 'b'], { coherence: false });
  let created = null;
  await new Promise((res) => api.run(PLAN, { onCreate: (id) => { created = id; }, onDone: () => res(), onError: () => res() }, OPTS(srv.fetchImpl, store)));
  assert.equal(created, 'job-1');
});

test('resume: after a "reload", resume() reads the persisted job and finishes it', async () => {
  const { api, store } = load();
  const srv = fakeServer(['a', 'b', 'c']);
  // Simulate a job persisted mid-run (as run() would have left it), server at section 1.
  store.set('antcv:genJob', JSON.stringify({ job_id: 'job-1', base: 'https://relay.example', startedAt: 1 }));
  srv.jobs.set('job-1', { status: 'running', next: 1, sections: [
    { id: 'a', state: 'done', result: 'RESULT:a', ui_state: 'done' },
    { id: 'b', state: 'pending', result: null, ui_state: 'queued' },
    { id: 'c', state: 'pending', result: null, ui_state: 'queued' },
  ], coherence: { state: 'pending', findings: [], repaired: [] } });
  let doneView = null;
  await new Promise((res) => api.resume({ onProgress() {}, onDone: (v) => { doneView = v; res(); }, onError: () => res() }, OPTS(srv.fetchImpl, store)));
  assert.equal(doneView.status, 'done');
  assert.deepEqual(doneView.sections.map((s) => s.result), ['RESULT:a', 'RESULT:b', 'RESULT:c'], 'finished sections + resumed the rest');
  assert.equal(store.has('antcv:genJob'), false);
});

test('resume: nothing persisted -> null (no-op)', () => {
  const { api, store } = load();
  const srv = fakeServer(['a']);
  assert.equal(api.resume({}, OPTS(srv.fetchImpl, store)), null);
});

test('transient step failures (503) retry with backoff, then succeed', async () => {
  const { api, store } = load();
  const srv = fakeServer(['a', 'b'], { failFirstSteps: 2 });
  let doneView = null;
  await new Promise((res) => api.run(PLAN, { onProgress() {}, onDone: (v) => { doneView = v; res(); }, onError: (e) => { throw new Error('should have retried, got ' + e); } }, OPTS(srv.fetchImpl, store)));
  assert.equal(doneView.status, 'done', 'recovered after 2 transient 503s');
});

test('a 4xx step is terminal (no infinite retry)', async () => {
  const { api, store } = load();
  const fetchImpl = (url, opts) => {
    const path = url.replace(/^https?:\/\/[^/]+/, '');
    if (/\/job\/create$/.test(path)) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ job_id: 'job-1', status: 'pending' }) });
    if (/\/job\/step$/.test(path)) return Promise.resolve({ ok: false, status: 403, json: () => Promise.resolve({ error: 'forbidden' }) });
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
  };
  let err = null;
  await new Promise((res) => api.run(PLAN, { onProgress() {}, onDone: () => res(), onError: (e) => { err = e; res(); } }, OPTS(fetchImpl, store)));
  assert.match(String(err), /step_403/);
  assert.equal(store.has('antcv:genJob'), false, 'terminal error clears the persisted job');
});

test('hasActive + cancel: cancel clears the persisted job and POSTs /job/cancel', async () => {
  const { api, store } = load();
  const srv = fakeServer(['a', 'b', 'c']);
  store.set('antcv:genJob', JSON.stringify({ job_id: 'job-1', base: 'https://relay.example' }));
  srv.jobs.set('job-1', { status: 'running', next: 1, sections: [], coherence: { state: 'pending' } });
  assert.equal(api.hasActive(OPTS(srv.fetchImpl, store)), true);
  api.cancel(OPTS(srv.fetchImpl, store));
  assert.equal(store.has('antcv:genJob'), false);
  assert.equal(srv.jobs.get('job-1').status, 'cancelled');
});

test('no relay base / no sections -> onError, no crash', () => {
  const { api, store } = load();
  let e1 = null; api.run(PLAN, { onError: (e) => { e1 = e; } }, { fetchImpl: () => {}, base: '', token: 't', storage: mkStorage(store), schedule: (f) => f() });
  assert.equal(e1, 'no_relay_base');
  let e2 = null; api.run({ sections: [] }, { onError: (e) => { e2 = e; } }, OPTS(() => {}, store));
  assert.equal(e2, 'no_sections');
});
