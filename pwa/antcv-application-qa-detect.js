/* antcv-application-qa-detect.js — APPLICATION-QA-001 P2+P3 (bridge)
 * ============================================================================
 * P1 (antcv-application-qa-section.js) renders the extra CL page from
 * localStorage['antcv:applicationQuestions'] — but nothing populated that key.
 * Detection + grounded answers ALREADY exist in two shipped layers:
 *   A. the generation output: rationale.questions_in_jd (RECRUITER-QUESTIONS-001,
 *      persisted to localStorage 'rationale' after a targeted gen), and
 *   B. the jd-analysis worker: POST /api/jd-analysis returns
 *      analysis.questions_in_jd = [{ question, suggested_answer, grounded }].
 * This sidecar is the missing BRIDGE: map either source into
 * antcv:applicationQuestions ([{question, answer}]) and dispatch
 * antcv:sections-updated so P1 builds the page.
 *
 * Rules:
 *  - Source A (free) wins; Source B only when A is empty AND a cheap heuristic
 *    says the JD plausibly contains applicant questions AND the JD fingerprint
 *    sentinel differs (one fetch per JD, incl. the found-nothing case).
 *  - grounded:false answers get a '[verify] ' prefix (overlay convention).
 *  - NEVER overwrite owner-edited answers: same question set with non-empty
 *    answers already stored → no write.
 *  - When writing a non-empty set, hide (on:false, never delete) the legacy
 *    overlay 'jd_questions' section so the CL doesn't carry two Q&A pages.
 *  - Kill switch: localStorage['antcv:disable-application-qa'].
 *  - Self-disabling on error; transport failure does NOT set the sentinel.
 */
(function () {
  'use strict';
  var VERSION = '1.51.55';
  if (window.__antcvApplicationQaDetect === VERSION) return;
  window.__antcvApplicationQaDetect = VERSION;

  var SENTINEL_KEY = 'antcv:applicationQuestionsJd';
  var OUT_KEY = 'antcv:applicationQuestions';
  var busy = false;

  function disabled() {
    try {
      var v = localStorage.getItem('antcv:disable-application-qa');
      return v === '1' || v === 'true';
    } catch (_) { return true; }
  }

  function readProxyUrl() {
    try {
      var raw = localStorage.getItem('proxyUrl');
      var v = '';
      if (raw) { try { v = String(JSON.parse(raw)); } catch (_) { v = String(raw); } }
      v = v.trim().replace(/\/+$/, '');
      if (v) return v;
      if (typeof window.ANTCV_RELAY_URL === 'string') {
        var rel = window.ANTCV_RELAY_URL.trim().replace(/\/+$/, '');
        if (rel) return rel;
      }
    } catch (_) {}
    return null;
  }

  function readJson(key, fallback) {
    try {
      var v = JSON.parse(localStorage.getItem(key) || 'null');
      return v == null ? fallback : v;
    } catch (_) { return fallback; }
  }

  function jdText() {
    try { return String(localStorage.getItem('antcv:lastJdText') || ''); } catch (_) { return ''; }
  }

  function fingerprint(jd) { return jd.length + ':' + jd.slice(0, 64); }

  // Cheap gate so the LLM only runs when the JD plausibly asks the candidate
  // questions. The NIL posting hits three of these.
  function heuristic(jd) {
    if (!jd || jd.length < 80) return false;
    if (/(answers?|besvar|svar)\s+(to|på)?\s*(the\s*)?\d*\s*questions?/i.test(jd)) return true;
    if (/key experience\s*#?\d/i.test(jd)) return true;
    if (/skill assessment\s*#?\d/i.test(jd)) return true;
    if (/\?/.test(jd) && /^\s*(\d+[.)]|Q\d+[:.)])\s+.{10,}/m.test(jd) &&
        /(describe|tell us|explain|share an example|provide an example)\b/i.test(jd)) return true;
    return false;
  }

  // Map a questions_in_jd-shaped array ({question, suggested_answer|answer,
  // grounded}) to the P1 contract [{question, answer}].
  function mapQuestions(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.map(function (it) {
      if (!it || typeof it !== 'object') return null;
      var q = String(it.question != null ? it.question : (it.q || '')).trim();
      if (!q) return null;
      var a = String(it.suggested_answer != null ? it.suggested_answer : (it.answer != null ? it.answer : (it.a || ''))).trim();
      if (a && it.grounded === false && a.indexOf('[verify]') !== 0) a = '[verify] ' + a;
      return { question: q, answer: a };
    }).filter(Boolean);
  }

  function sameQuestionSet(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    var norm = function (q) { return String(q || '').trim().toLowerCase(); };
    var as = a.map(function (x) { return norm(x && x.question); }).sort();
    var bs = b.map(function (x) { return norm(x && x.question); }).sort();
    return as.every(function (q, i) { return q === bs[i]; });
  }

  function writeQuestions(qs) {
    try {
      var existing = readJson(OUT_KEY, null);
      if (Array.isArray(existing) && existing.length && sameQuestionSet(existing, qs) &&
          existing.every(function (x) { return x && String(x.answer || x.a || '').trim(); })) {
        return false; // owner-edited (or already-populated) answers — keep them.
      }
      localStorage.setItem(OUT_KEY, JSON.stringify(qs));
      if (qs.length) hideLegacyJdQuestions();
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'application-qa-detect' } })); } catch (_) {}
      return true;
    } catch (_) { return false; }
  }

  // The pre-P1 overlay button appended a 'jd_questions' labeled_list to the CL.
  // With application_qa live it would double-render — hide it (never delete).
  function hideLegacyJdQuestions() {
    try {
      var secs = readJson('sections', {});
      if (!Array.isArray(secs.cl)) return;
      var idx = secs.cl.findIndex(function (s) { return s && s.id === 'jd_questions'; });
      if (idx < 0 || secs.cl[idx].on === false) return;
      secs.cl[idx] = Object.assign({}, secs.cl[idx], { on: false });
      localStorage.setItem('sections', JSON.stringify(secs));
    } catch (_) {}
  }

  // Grounding context for the worker's suggested_answer generation.
  function candidateSummary() {
    var parts = [];
    try {
      var secs = readJson('sections', {});
      if (secs && secs.cv) parts.push(JSON.stringify(secs.cv).slice(0, 8000));
    } catch (_) {}
    try {
      var pi = readJson('personalInfo', {});
      var extra = [];
      if (pi.background) extra.push(String(pi.background));
      var pp = pi.proofPointsByRole || pi.proofPointsByPosition;
      if (pp) extra.push(JSON.stringify(pp));
      if (pi.kernel && pi.kernel.role_results_exact) extra.push(JSON.stringify(pi.kernel.role_results_exact));
      if (extra.length) parts.push(extra.join('\n'));
    } catch (_) {}
    return parts.join('\n\n').slice(0, 15000);
  }

  // GEN-UNSOL-STALE-JD-001: application questions only exist for a real JD.
  // Detect an unsolicited context the same way the identity guard does.
  function unsolicitedContext() {
    try {
      var m = JSON.parse(localStorage.getItem('meta') || 'null');
      if (m && typeof m === 'object' &&
          (window.__ANTCV_UNSOL_RE || /^(unsolicited|open\s+application)$/i).test(String(m.company || '').trim())) return true; // UNSOL-PILLAR-LANG-001: any language variant
    } catch (_) {}
    try {
      var ac = String(localStorage.getItem('antcv:activeAppCompany') || '').replace(/"/g, '').trim();
      if ((window.__ANTCV_UNSOL_RE || /^unsolicited$/i).test(ac)) return true; // UNSOL-PILLAR-LANG-001
    } catch (_) {}
    return false;
  }

  // Source A: rationale.questions_in_jd from the last targeted generation.
  function fromRationale() {
    var rat = readJson('rationale', null);
    if (!rat || typeof rat !== 'object') return [];
    return mapQuestions(rat.questions_in_jd);
  }

  // Source B: one /api/jd-analysis fetch per JD fingerprint.
  function fetchDetect(jd) {
    var proxyUrl = readProxyUrl();
    if (!proxyUrl) return Promise.resolve(false);
    return fetch(proxyUrl + '/api/jd-analysis', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jd_text: jd, candidate_summary: candidateSummary(), search_recruiter: false }),
    }).then(function (r) {
      return r.text().then(function (raw) {
        var parsed = null;
        try { parsed = raw ? JSON.parse(raw) : null; } catch (_) {}
        if (!r.ok || !parsed || parsed.ok === false || !parsed.analysis) return false; // transport/API failure: no sentinel, retry later
        var qs = mapQuestions(parsed.analysis.questions_in_jd);
        try { localStorage.setItem(SENTINEL_KEY, fingerprint(jd)); } catch (_) {}
        writeQuestions(qs); // '[]' on found-nothing is correct: P1 hides the section
        return true;
      });
    }).catch(function () { return false; });
  }

  function run() {
    try {
      if (disabled() || busy) return;
      // GEN-UNSOL-STALE-JD-001: in an unsolicited context never build the
      // page, and empty a stale set so P1 hides it (the NIL-questions-on-an-
      // unsolicited-CL leak).
      if (unsolicitedContext()) {
        var cur0 = readJson(OUT_KEY, null);
        if (Array.isArray(cur0) && cur0.length) writeQuestions([]);
        try { localStorage.removeItem(SENTINEL_KEY); } catch (_) {}
        return;
      }
      // Source A first — free, and authoritative after a targeted gen.
      var fromA = fromRationale();
      if (fromA.length) { writeQuestions(fromA); return; }
      // Source B — on-demand detection for "JD ingested but not regenerated".
      var jd = jdText();
      if (!heuristic(jd)) return;
      var existing = readJson(OUT_KEY, null);
      var sentinel = null;
      try { sentinel = localStorage.getItem(SENTINEL_KEY); } catch (_) {}
      if (sentinel === fingerprint(jd)) return;               // this JD already detected
      if (Array.isArray(existing) && existing.length) return; // populated (possibly owner-edited) — leave it
      busy = true;
      fetchDetect(jd).then(function () { busy = false; }, function () { busy = false; });
    } catch (_) { /* self-disable */ }
  }

  window.addEventListener('antcv:sections-updated', function (e) {
    // Avoid reacting to our own dispatch (and P1's) — only gen/restore matter.
    var reason = e && e.detail && e.detail.reason;
    if (reason === 'application-qa-detect' || reason === 'application-qa') return;
    run();
  });
  // JD-SCOPE-ISOLATION-001: the redirected JD write lands on THIS tab's NAMESPACED
  // key (antcv:app:{id}:jdText), so a foreign app's write (different namespace) is
  // ignored. Fallback to the base key when the scope sidecar is absent (unit tests).
  window.addEventListener('storage', function (e) {
    if (!e) return;
    var jk = (window.AntcvJdScope && window.AntcvJdScope.nsKey) ? window.AntcvJdScope.nsKey('jdText') : 'antcv:lastJdText';
    if (e.key === jk) run();
  });
  [0, 500, 1500, 3000, 6000].forEach(function (ms) { setTimeout(run, ms); });
  window.AntcvApplicationQaDetect = { version: VERSION, run: run, _heuristic: heuristic, _map: mapQuestions };
})();
