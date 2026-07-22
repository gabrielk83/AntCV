/* antcv-analysis-persist.js — ANALYSIS-EXTRA-PERSIST-001 (owner 2026-07-22)
 * ===========================================================================
 * "make sure saved apps load also all analysis data." On load, app.js restores
 * only `rationale`. Two Analysis-panel stores were device-local and never
 * round-tripped, so a fresh load / another device showed them blank:
 *   - gapState_<company>_<role>_<idx>_<slug>  — per-gap AI detail + "I cover
 *     this" answer + covered flag (app.src.js ~12238).
 *   - the employer Q&A — stored per-tab at AntcvJdScope.nsKey('questions')
 *     (= antcv:app:<tabId>:questions) + 'questionsJd' (antcv-application-qa-section.js).
 *
 * This sidecar rides the new `analysis_extra` JSON column on the application row
 * (relay ANALYSIS-EXTRA-PERSIST-001): { gap_state:{<key>:<value>...}, questions,
 * questionsJd }.  It NEVER wraps window.fetch — it does its own authenticated
 * GET/PUT to /api/applications/:id (Bearer, like antcv-fit-panel.js), the same
 * standalone pattern as antcv-orphan-cloud-persist-385.js.
 *
 *   PERSIST: when a gapState_ or questions value changes for the ACTIVE app,
 *            collect this app's keys (matched by its meta company/role prefix +
 *            the tab-scoped questions value) and PUT { analysis_extra:{...} }.
 *            The relay whitelist is undefined-skip, so this partial PUT touches
 *            only analysis_extra — never sections/meta.
 *   RESTORE: when the active app changes, GET the row and write any stored key
 *            that is ABSENT/empty locally (never clobbers a fresh local edit) —
 *            gap_state keys write as-is (company/role is portable); questions
 *            write to THIS tab's nsKey (the stored key's tabId is not portable).
 *
 * Kill-switch: localStorage['antcv:disable-analysis-persist'] = '1'.
 */
(function () {
  'use strict';
  if (window.__antcvAnalysisPersistInstalled) return;
  var VERSION = '1.0';
  window.__antcvAnalysisPersistInstalled = VERSION;

  var KILL = 'antcv:disable-analysis-persist';
  var LAST_TRY = 'antcv:analysisPersist:lastTry';
  var origFetch = window.fetch;
  if (typeof origFetch !== 'function') return;

  function killed() { try { return localStorage.getItem(KILL) === '1'; } catch (_) { return false; } }
  function rawGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function readStr(k) {
    var v = rawGet(k); if (!v) return '';
    try { if (v.charAt(0) === '"') v = JSON.parse(v); } catch (_) {}
    return String(v == null ? '' : v).replace(/^"|"$/g, '');
  }
  function relayBase() {
    var v = readStr('relayUrl') || readStr('proxyUrl');
    if (!v && typeof window.ANTCV_RELAY_URL === 'string') v = String(window.ANTCV_RELAY_URL);
    return v.replace(/\/+$/, '');
  }
  function token() { return rawGet('antcv:auth:token') ? String(rawGet('antcv:auth:token')).replace(/^"|"$/g, '') : ''; }
  function readJSON(k) { try { var r = rawGet(k); return r ? JSON.parse(r) : null; } catch (_) { return null; } }

  function relayFetch(path, init) {
    var base = relayBase(), tok = token();
    if (!base || !tok) return null;
    init = init || {};
    init.headers = Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json', Authorization: 'Bearer ' + tok }, init.headers || {});
    init.credentials = 'include';
    return origFetch.call(window, base + path, init);
  }
  function questionsKey() {
    try { if (window.AntcvJdScope && window.AntcvJdScope.nsKey) return window.AntcvJdScope.nsKey('questions'); } catch (_) {}
    return 'antcv:applicationQuestions';
  }
  function questionsJdKey() {
    try { if (window.AntcvJdScope && window.AntcvJdScope.nsKey) return window.AntcvJdScope.nsKey('questionsJd'); } catch (_) {}
    return 'antcv:applicationQuestionsJd';
  }

  // ---- collect this app's analysis stores from localStorage -----------------
  function gapPrefix() {
    var meta = readJSON('meta') || {};
    return 'gapState_' + ((meta.company || '') + '_' + (meta.role || '')) + '_';
  }
  function collectLocal() {
    var out = { gap_state: {} };
    var pfx = gapPrefix();
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(pfx) === 0) {
          var v = rawGet(k);
          if (v && v !== 'null' && v !== '{}') out.gap_state[k] = v;
        }
      }
    } catch (_) {}
    var q = rawGet(questionsKey());
    if (q && q !== 'null') out.questions = q;
    var qj = rawGet(questionsJdKey());
    if (qj && qj !== 'null') out.questionsJd = qj;
    // Nothing worth persisting?
    if (!Object.keys(out.gap_state).length && out.questions === undefined && out.questionsJd === undefined) return null;
    return out;
  }

  // ---- persist (dedicated partial PUT) --------------------------------------
  var lastPushed = '';
  var inFlight = false;
  function persist(reason) {
    if (killed() || inFlight) return;
    var id = activeId; if (id == null) return;
    var payload = collectLocal(); if (!payload) return;
    var sig = id + '|' + JSON.stringify(payload);
    if (sig === lastPushed) return;
    var last = Number(rawGet(LAST_TRY) || 0);
    if (last && Date.now() - last < 8000 && reason !== 'forced') return;
    try { localStorage.setItem(LAST_TRY, String(Date.now())); } catch (_) {}
    var req = relayFetch('/api/applications/' + id, { method: 'PUT', body: JSON.stringify({ analysis_extra: payload }) });
    if (!req) return;
    inFlight = true;
    req.then(function (r) {
      inFlight = false;
      if (r && r.ok) { lastPushed = sig; try { console.debug('[analysis-persist] pushed gap_state/questions for app ' + id); } catch (_) {} }
    }).catch(function () { inFlight = false; });
  }

  // ---- restore (absent-only, never clobbers a fresh local edit) -------------
  var restoredFor = null;
  function restore(id) {
    if (killed() || id == null || restoredFor === id) return;
    var req = relayFetch('/api/applications/' + id, { method: 'GET' });
    if (!req) return;
    req.then(function (r) { return r && r.ok ? r.json() : null; }).then(function (j) {
      if (!j) return;
      var app = j.application || j;
      var extra = app && app.analysis_extra;
      if (typeof extra === 'string') { try { extra = JSON.parse(extra); } catch (_) { extra = null; } }
      if (!extra || typeof extra !== 'object') { restoredFor = id; return; }
      var wrote = 0;
      var gs = extra.gap_state || {};
      Object.keys(gs).forEach(function (k) {
        var cur = rawGet(k);
        if (!cur || cur === 'null' || cur === '{}') { try { localStorage.setItem(k, gs[k]); wrote++; } catch (_) {} }
      });
      // questions/questionsJd -> THIS tab's namespaced key (stored tabId isn't portable).
      if (extra.questions !== undefined) {
        var qk = questionsKey(), cq = rawGet(qk);
        if (!cq || cq === 'null') { try { localStorage.setItem(qk, extra.questions); wrote++; } catch (_) {} }
      }
      if (extra.questionsJd !== undefined) {
        var qjk = questionsJdKey(), cqj = rawGet(qjk);
        if (!cqj || cqj === 'null') { try { localStorage.setItem(qjk, extra.questionsJd); wrote++; } catch (_) {} }
      }
      restoredFor = id;
      if (wrote) {
        try { console.debug('[analysis-persist] restored ' + wrote + ' analysis store(s) for app ' + id); } catch (_) {}
        try { window.dispatchEvent(new Event('antcv:sections-updated')); } catch (_) {}
      }
    }).catch(function () {});
  }

  // ---- learn the active application id --------------------------------------
  var activeId = null;
  function pollActive() {
    if (killed()) return;
    var req = relayFetch('/api/active', { method: 'GET' });
    if (!req) return;
    req.then(function (r) { return r && r.ok ? r.json() : null; }).then(function (j) {
      var id = j && (j.application_id != null ? j.application_id : (j.active && j.active.application_id));
      if (id == null) return;
      if (String(id) !== String(activeId)) {
        activeId = id;
        lastPushed = '';           // new app -> allow a fresh push
        restore(id);               // pull its stored analysis stores
      }
    }).catch(function () {});
  }

  // ---- wiring ---------------------------------------------------------------
  var debounce = null;
  window.addEventListener('storage', function (e) {
    if (!e || !e.key) return;
    if (e.key.indexOf('gapState_') === 0 || e.key === questionsKey() || e.key === questionsJdKey() ||
        e.key === 'antcv:applicationQuestions') {
      clearTimeout(debounce); debounce = setTimeout(function () { persist('storage'); }, 1200);
    }
  });
  // Local (same-tab) changes don't fire 'storage'; re-check on the app's settle nudges.
  window.addEventListener('antcv:sections-updated', function () {
    clearTimeout(debounce); debounce = setTimeout(function () { persist('settle'); }, 1500);
  });
  setTimeout(pollActive, 1500);
  setInterval(pollActive, 8000);

  window.AntcvAnalysisPersist = {
    version: VERSION,
    push: function () { persist('forced'); },
    restore: function () { restoredFor = null; restore(activeId); },
    _collect: collectLocal
  };
  try { console.debug('[analysis-persist] installed v' + VERSION); } catch (_) {}
})();
