/* antcv-gen-job-client.js — GEN-BACKGROUND-001 CLIENT ENGINE (owner P0, 2026-07-04)
 * ============================================================================
 * The resumable, tab-backgrounding-survivable generation DRIVER. Server side is
 * live (workers/{proxy,demo-proxy}/src/gen-job.js: POST /job/create, POST
 * /job/step, GET /job/{id}, POST /job/cancel; every finished section is
 * KV-checkpointed the instant it returns). This module is the client half: it
 * submits a section plan once, then advances the job ONE SHORT /step at a time
 * and polls — so a backgrounded mobile tab can never lose finished work, and a
 * reload/crash resumes from the server checkpoint.
 *
 * WHY A SEPARATE MODULE (not an app.js edit): app.js is minified-sacred and the
 * generation cascade is its highest-risk region. The full state machine lives
 * HERE, unit-tested, so the eventual app.js integration is a SMALL delegation:
 *   if (!killed && window.AntcvGenJob) return window.AntcvGenJob.run(plan, cb);
 * Kill-switch (read by the integration, not this engine): antcv:disable-gen-job.
 *
 * ARCHITECTURAL PREREQUISITE (see docs/qa/GEN-BACKGROUND-001-CLIENT-SPEC.md):
 * backgrounding survival requires MANY short per-section steps. The current app
 * generation is ONE big multi-provider call, so wiring this engine to real
 * generation ALSO requires decomposing generation into a per-section plan
 * (sections[].prompt = each section's /v1/messages body). This engine is ready
 * for that plan; it does not itself decompose generation.
 *
 * PROTOCOL (server contract, gen-job.js):
 *   create({sections:[{id,title,prompt,headers?}], provider, model, meta,
 *           source_cv?, jd_text?}) -> {job_id, status, sections}
 *   step({job_id}) -> publicView; call repeatedly until status is terminal.
 *   GET /job/{id} -> publicView (resume). cancel({job_id}).
 *   publicView.status: pending|running|coherence|done|error|cancelled
 *   publicView.sections[]: {id,title,state,ui_state,result,error,coherence_revised}
 *   publicView.coherence: {state,findings[],repaired[],summary,error}
 *
 * Test hooks: every side effect is injectable — run(plan, cb, {fetchImpl,
 * storage, base, token, now, schedule}) — so the vm tests drive a deterministic
 * clock + fake fetch with zero DOM/network.
 */
(function () {
  'use strict';
  var VERSION = '1.51.132-gen-job-client';
  if (window.__antcvGenJobClient === VERSION) return;
  window.__antcvGenJobClient = VERSION;

  var PERSIST_KEY = 'antcv:genJob';          // { job_id, base, startedAt, plan_meta }
  var TERMINAL = { done: 1, error: 1, cancelled: 1 };
  var STEP_MIN_MS = 400;                       // gap between steps when foreground
  var STEP_HIDDEN_MS = 1500;                   // gap when the tab is hidden (throttled anyway)
  var STEP_MAX_MS = 8000;                       // backoff ceiling on transient step errors
  var MAX_TRANSIENT = 40;                       // consecutive transient step failures before giving up

  function lsGet(storage, k) { try { return (storage || localStorage).getItem(k); } catch (_) { return null; } }
  function lsSet(storage, k, v) { try { (storage || localStorage).setItem(k, v); } catch (_) {} }
  function lsDel(storage, k) { try { (storage || localStorage).removeItem(k); } catch (_) {} }
  function readJson(storage, k) { try { return JSON.parse(lsGet(storage, k) || 'null'); } catch (_) { return null; } }

  function relayBase(storage) {
    function read(x) { var v = lsGet(storage, x) || ''; try { if (v && v.charAt(0) === '"') v = JSON.parse(v); } catch (_) {} return String(v || '').replace(/\/+$/, ''); }
    var b = read('proxyUrl') || read('relayUrl');
    if (!b && typeof window.ANTCV_RELAY_URL === 'string') b = String(window.ANTCV_RELAY_URL).replace(/\/+$/, '');
    return b;
  }
  function authToken(storage) { return String(lsGet(storage, 'antcv:auth:token') || ''); }

  function isHidden() {
    try { return typeof document !== 'undefined' && document.hidden === true; } catch (_) { return false; }
  }

  // ── the driver ───────────────────────────────────────────────────────────
  // opts (all optional; the app passes none, the tests inject all):
  //   fetchImpl, storage, base, token, now(), schedule(fn, ms) -> handle
  function makeDriver(opts) {
    opts = opts || {};
    var storage = opts.storage || null;
    var fetchImpl = opts.fetchImpl || (typeof window !== 'undefined' && window.fetch ? window.fetch.bind(window) : null);
    var base = opts.base || relayBase(storage);
    var token = opts.token != null ? opts.token : authToken(storage);
    var now = opts.now || function () { return Date.now(); };
    var schedule = opts.schedule || function (fn, ms) { return setTimeout(fn, ms); };

    function headers() {
      var h = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
      if (token) h.Authorization = 'Bearer ' + token;
      return h;
    }
    function post(path, body) {
      return fetchImpl(base + path, { method: 'POST', credentials: 'include', headers: headers(), body: JSON.stringify(body || {}) })
        .then(function (r) { return r.json().catch(function () { return null; }).then(function (j) { return { ok: r.ok, status: r.status, body: j }; }); });
    }
    function get(path) {
      return fetchImpl(base + path, { method: 'GET', credentials: 'include', headers: headers() })
        .then(function (r) { return r.json().catch(function () { return null; }).then(function (j) { return { ok: r.ok, status: r.status, body: j }; }); });
    }

    return { post: post, get: get, storage: storage, base: base, now: now, schedule: schedule, token: token };
  }

  // Poll/step a job to completion. cb: {onProgress(view), onDone(view),
  // onError(err, view)}. Returns a control handle { cancel() }.
  function drive(drv, jobId, cb, state) {
    cb = cb || {};
    state = state || { transient: 0, cancelled: false };
    var handle = { cancelled: false, cancel: function () { handle.cancelled = true; state.cancelled = true; } };

    function finish(kind, view, err) {
      if (handle.cancelled && kind !== 'cancelled') { /* still report terminal below */ }
      lsDel(drv.storage, PERSIST_KEY);
      if (kind === 'done' && cb.onDone) cb.onDone(view);
      else if (kind === 'error' && cb.onError) cb.onError(err || (view && view.error) || 'gen_job_error', view);
    }

    function tick() {
      if (handle.cancelled) return;
      drv.post('/job/step', { job_id: jobId }).then(function (res) {
        if (handle.cancelled) return;
        if (!res.ok || !res.body) {
          // transient (5xx / network / KV blip) -> retry with backoff; a 4xx is terminal.
          if (res.status && res.status >= 400 && res.status < 500) { finish('error', null, 'step_' + res.status); return; }
          state.transient++;
          if (state.transient > MAX_TRANSIENT) { finish('error', null, 'step_transient_exhausted'); return; }
          drv.schedule(tick, Math.min(STEP_MAX_MS, STEP_MIN_MS * Math.pow(1.6, state.transient)));
          return;
        }
        state.transient = 0;
        var view = res.body;
        if (cb.onProgress) { try { cb.onProgress(view); } catch (_) {} }
        if (TERMINAL[view.status]) { finish(view.status === 'done' ? 'done' : 'error', view); return; }
        // not terminal -> schedule the next step (slower while hidden; the tab
        // throttles timers anyway and finished sections are already checkpointed).
        drv.schedule(tick, isHidden() ? STEP_HIDDEN_MS : STEP_MIN_MS);
      }).catch(function (e) {
        if (handle.cancelled) return;
        state.transient++;
        if (state.transient > MAX_TRANSIENT) { finish('error', null, String(e && e.message || e)); return; }
        drv.schedule(tick, Math.min(STEP_MAX_MS, STEP_MIN_MS * Math.pow(1.6, state.transient)));
      });
    }
    tick();
    return handle;
  }

  var _active = null;   // the in-flight handle (one gen at a time, matching the app)

  // run(plan, cb, opts) — create a job from the section plan, persist it, drive.
  function run(plan, cb, opts) {
    var drv = makeDriver(opts);
    if (!drv.base) { if (cb && cb.onError) cb.onError('no_relay_base'); return { cancel: function () {} }; }
    if (!plan || !Array.isArray(plan.sections) || !plan.sections.length) { if (cb && cb.onError) cb.onError('no_sections'); return { cancel: function () {} }; }
    var createBody = {
      sections: plan.sections, provider: plan.provider || 'anthropic', model: plan.model || null,
      meta: plan.meta || {}, source_cv: plan.source_cv || null, jd_text: plan.jd_text || null,
    };
    var outer = { cancelled: false, cancel: function () { outer.cancelled = true; if (outer._inner) outer._inner.cancel(); } };
    drv.post('/job/create', createBody).then(function (res) {
      if (outer.cancelled) return;
      if (!res.ok || !res.body || !res.body.job_id) { if (cb && cb.onError) cb.onError('create_failed_' + (res.status || '0'), res.body); return; }
      var jobId = res.body.job_id;
      lsSet(drv.storage, PERSIST_KEY, JSON.stringify({ job_id: jobId, base: drv.base, startedAt: drv.now(), meta: plan.meta || {} }));
      if (cb && cb.onCreate) { try { cb.onCreate(jobId, res.body); } catch (_) {} }
      outer._inner = drive(drv, jobId, cb);
      _active = outer;
    }).catch(function (e) { if (cb && cb.onError) cb.onError(String(e && e.message || e)); });
    _active = outer;
    return outer;
  }

  // resume(cb, opts) — after a reload/foreground: if a persisted job exists and
  // is not terminal, GET it (render done sections) and continue stepping.
  // Returns the handle, or null if there was nothing to resume.
  function resume(cb, opts) {
    var persisted = readJson((opts && opts.storage) || null, PERSIST_KEY);
    if (!persisted || !persisted.job_id) return null;
    var drv = makeDriver(Object.assign({ base: persisted.base }, opts || {}));
    if (!drv.base) return null;
    var outer = { cancelled: false, cancel: function () { outer.cancelled = true; if (outer._inner) outer._inner.cancel(); } };
    drv.get('/job/' + encodeURIComponent(persisted.job_id)).then(function (res) {
      if (outer.cancelled) return;
      if (!res.ok || !res.body) { lsDel(drv.storage, PERSIST_KEY); if (cb && cb.onError) cb.onError('resume_get_failed_' + (res.status || '0')); return; }
      var view = res.body;
      if (cb && cb.onProgress) { try { cb.onProgress(view); } catch (_) {} }
      if (TERMINAL[view.status]) {
        lsDel(drv.storage, PERSIST_KEY);
        if (view.status === 'done' && cb && cb.onDone) cb.onDone(view);
        else if (view.status !== 'done' && cb && cb.onError) cb.onError(view.status, view);
        return;
      }
      outer._inner = drive(drv, persisted.job_id, cb);
    }).catch(function (e) { lsDel(drv.storage, PERSIST_KEY); if (cb && cb.onError) cb.onError(String(e && e.message || e)); });
    _active = outer;
    return outer;
  }

  function cancel(opts) {
    var persisted = readJson((opts && opts.storage) || null, PERSIST_KEY);
    if (_active) { try { _active.cancel(); } catch (_) {} }
    if (persisted && persisted.job_id) {
      var drv = makeDriver(Object.assign({ base: persisted.base }, opts || {}));
      if (drv.base) { drv.post('/job/cancel', { job_id: persisted.job_id }).catch(function () {}); }
    }
    lsDel((opts && opts.storage) || null, PERSIST_KEY);
  }

  function hasActive(opts) {
    var p = readJson((opts && opts.storage) || null, PERSIST_KEY);
    return !!(p && p.job_id);
  }

  // Foreground resume: when the tab returns to visible and a job is persisted,
  // the app integration should call resume(); this listener is a no-op until an
  // integration registers its callbacks via onForeground.
  var _foregroundCb = null;
  function onForeground(cb, opts) { _foregroundCb = { cb: cb, opts: opts }; }
  try {
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', function () {
        if (!isHidden() && _foregroundCb && hasActive(_foregroundCb.opts)) {
          try { resume(_foregroundCb.cb, _foregroundCb.opts); } catch (_) {}
        }
      });
    }
  } catch (_) {}

  window.AntcvGenJob = {
    version: VERSION,
    run: run,
    resume: resume,
    cancel: cancel,
    hasActive: hasActive,
    onForeground: onForeground,
    _makeDriver: makeDriver,
    _drive: drive,
    _PERSIST_KEY: PERSIST_KEY,
  };
})();
