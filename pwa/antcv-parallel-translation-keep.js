/* antcv-parallel-translation-keep.js — PARALLEL-TRANSLATION-KEEP-001 (owner 2026-07-22)
 * ============================================================================
 * Owner: "applications that are generated in multiple languages must not be
 * overwritten — keep a parallel translation." An app generated in one language and
 * then VIEWED in another (the babel-fish display translate) had its translated view
 * auto-saved over the canonical cv_sections in the cloud — so an English CV viewed
 * once in Chinese became a Chinese CV on disk (the "every CV starts in Chinese"
 * family, root-fixed selector-side by APP-SWITCH-CONTENT-LANG-DETECT-001 1.51.2012).
 *
 * The per-language translations are ALREADY kept in parallel: babel-relang snapshots
 * every non-Latin render into the `langRenders` bundle (localStorage + cloud prefs).
 * The only remaining defect is the CANONICAL `application.cv_sections` being clobbered
 * by the translated view through the auto-sync PUT. This sidecar closes exactly that
 * hole and nothing else.
 *
 * Mechanism (mirrors antcv-cloud-put-shrink-guard-289.js — a request-only fetch guard,
 * proven safe: it inspects/edits the outgoing body and delegates to the original fetch,
 * never touching the Response):
 *   - Intercept `PUT /api/applications/:id`.
 *   - If the body carries cv_sections/cl_sections whose detected SCRIPT is a non-Latin
 *     language DIFFERENT from that app's PRIMARY (generation) language, DROP those two
 *     keys from the body. The relay's PUT is a per-field whitelist merge, so an omitted
 *     key leaves the stored canonical intact (index.js:3585 — omit preserves; null/[]
 *     would clobber, so we OMIT, never null). The translation survives in langRenders.
 *   - Everything else passes through byte-for-byte.
 *
 * PRIMARY (generation) language per app is learned two ways, both fail-OPEN (an unknown
 * primary never strips — worst case is no protection, never a blocked save or data loss):
 *   - on the active application changing: one read-only GET of the cloud row -> the
 *     script its stored canonical is actually in;
 *   - on a generation completing: the just-generated content's script (a real Generate
 *     is the app's true birth language and must always save).
 *
 * Only NON-LATIN script flips are guarded — that is exactly what langRenders keeps in
 * parallel. Latin<->Latin (en/da/es) is out of scope (no parallel store exists for it)
 * and same-script edits always save. Detection reuses the ONE vetted detector,
 * window.__antcvContentScript (antcv-babel-relang.js), so this guard and the healer /
 * the language selector all agree by construction.
 *
 * Kill switch: localStorage['antcv:disable-parallel-translation-keep']='1'.
 */
(function () {
  'use strict';
  var VERSION = '1.51.2106-parallel-translation-keep';
  if (window.__antcvParallelTranslationKeep === VERSION) return;
  window.__antcvParallelTranslationKeep = VERSION;

  function disabled() {
    try { var v = localStorage.getItem('antcv:disable-parallel-translation-keep'); return v === '1' || v === 'true'; }
    catch (_) { return false; }
  }
  if (disabled()) return;

  var origFetch = window.fetch;                         // captured once, chained ahead of any later wrapper
  if (typeof origFetch !== 'function') return;

  var WIDE = { zh: 1, he: 1, am: 1, ar: 1 };            // the scripts langRenders parallelises
  var LATIN = 'la';                                     // marker for "Latin / no wide script"

  // primaryByAppId[id] = 'zh'|'he'|'am'|'ar'|'la' (canonical/generation script). Absent = unknown -> fail open.
  var primaryByAppId = {};

  function proxyBase() {
    try { return String(localStorage.getItem('proxyUrl') || '').replace(/^"|"$/g, '').replace(/\/+$/, ''); }
    catch (_) { return ''; }
  }
  // RELAY-AUTH-FIX-001 (2026-07-22): /api/active and /api/applications/:id live on
  // the ACCESS-RELAY and authenticate ONLY via `Authorization: Bearer <JWT>` — the
  // relay has no cookie fallback. This sidecar was calling them with
  // `credentials:'include'` and no Bearer, so every poll 401'd (console spam) AND
  // learnPrimary never populated primaryByAppId — the data-loss guard silently
  // failed open (never protected a zh/he canonical). Mirror antcv-fit-panel.js:
  // read the RELAY base + the auth token, and send Bearer. When logged out (no
  // base/token) we skip the request entirely instead of firing an anonymous 401.
  function relayBase() {
    var v = '';
    try { v = String(localStorage.getItem('relayUrl') || ''); } catch (_) {}
    if (!v) { try { if (window.ANTCV_RELAY_URL) v = String(window.ANTCV_RELAY_URL); } catch (_) {} }
    v = v.replace(/^"|"$/g, '').replace(/\/+$/, '');
    return v || proxyBase();   // fall back to proxyBase for older configs
  }
  function authToken() {
    try { return String(localStorage.getItem('antcv:auth:token') || '').replace(/^"|"$/g, ''); } catch (_) { return ''; }
  }
  function relayGet(path) {
    var base = relayBase(); var token = authToken();
    if (!base || !token) return null;   // logged out -> no anonymous 401
    return origFetch.call(window, base + path, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: 'Bearer ' + token }
    });
  }
  function safeParse(s) { try { return typeof s === 'string' ? JSON.parse(s) : s; } catch (_) { return null; } }

  // Content script of a {cv_sections, cl_sections} pair -> a wide script code, or 'la'.
  function scriptOf(cv, cl) {
    try {
      if (typeof window.__antcvContentScript !== 'function') return null;   // detector not ready -> unknown
      var s = window.__antcvContentScript(cv || [], cl || []);
      return WIDE[s] ? s : LATIN;
    } catch (_) { return null; }
  }
  // A stored jd/gen language code -> script class.
  function langToScript(code) {
    var c = String(code || '').toLowerCase().slice(0, 2);
    return WIDE[c] ? c : LATIN;
  }

  // ---- the pure decision (unit-tested) ------------------------------------
  // Given the outgoing body, the app's known primary script, and the body's detected
  // content script, decide whether to STRIP the sections. Strip only on a NON-LATIN
  // flip (cur != primary and at least one side is a wide script). Fail open on any
  // unknown (null primary or null cur).
  function decide(body, primary, cur) {
    if (!body || typeof body !== 'object') return { strip: false };
    if (body.cv_sections === undefined && body.cl_sections === undefined) return { strip: false };
    if (!primary || primary === '?' || cur == null) return { strip: false };   // unknown -> fail open
    if (cur === primary) return { strip: false };                              // same language -> save
    if (cur === LATIN && primary === LATIN) return { strip: false };           // Latin<->Latin -> out of scope
    return { strip: true, cur: cur, primary: primary };                        // a wide-script flip -> keep canonical
  }

  function stripSections(body) {
    var out = {};
    for (var k in body) {
      if (!Object.prototype.hasOwnProperty.call(body, k)) continue;
      if (k === 'cv_sections' || k === 'cl_sections') continue;
      out[k] = body[k];
    }
    return out;
  }

  // ---- learn the primary language -----------------------------------------
  function learnPrimary(id) {
    if (id == null) return;
    // Use the ORIGINAL fetch (via relayGet) so our own learning GET is never
    // re-entrantly guarded, and carries the Bearer the relay requires.
    var req = relayGet('/api/applications/' + id); if (!req) return;
    req
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j) return;
        var a = j.application || j;
        var sc = scriptOf(a.cv_sections, a.cl_sections);   // 'zh'.. | 'la' | null(detector not ready)
        if (sc == null) return;                            // try again next poll
        primaryByAppId[id] = sc;                           // Latin canonical stamps 'la' (the safe default)
      })
      .catch(function () {});
  }

  var lastActive = null;
  function pollActive() {
    if (disabled()) return;
    var req = relayGet('/api/active'); if (!req) return;   // logged out -> skip (no 401 spam)
    req
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        var id = j && (j.application_id != null ? j.application_id : (j.active && j.active.application_id));
        if (id == null) return;
        if (String(id) !== String(lastActive)) { lastActive = id; learnPrimary(id); }
      })
      .catch(function () {});
  }

  // ---- generation-complete: the new content IS the new canonical ----------
  function genInProgress() {
    try { if (window.__antcvGenRunning) return true; } catch (_) {}
    try { if (localStorage.getItem('kernelShowcaseInProgress') === 'true') return true; } catch (_) {}
    return false;
  }
  var wasGen = false;
  function pollGen() {
    if (disabled()) return;
    var g = genInProgress();
    if (wasGen && !g && lastActive != null) {
      // a generation just finished -> stamp the active app's primary from the fresh content
      try {
        var b = safeParse(localStorage.getItem('sections')) || {};
        var sc = scriptOf(b.cv || [], b.cl || []);
        if (sc != null) primaryByAppId[lastActive] = sc;
      } catch (_) {}
    }
    wasGen = g;
  }

  // ---- the request-only fetch guard ---------------------------------------
  function appIdFromPut(url, init) {
    if (!init || init.method !== 'PUT') return null;
    var u = ''; try { u = (typeof url === 'string') ? url : (url && url.url) || ''; } catch (_) {}
    var m = /\/api\/applications\/(\d+)(?:\?|$)/.exec(String(u));
    return m ? m[1] : null;
  }
  function rewriteInit(init, newBody) {
    var copy = {};
    for (var k in init) { if (Object.prototype.hasOwnProperty.call(init, k)) copy[k] = init[k]; }
    copy.body = JSON.stringify(newBody);
    return copy;
  }

  var guardedFetch = function (url, init) {
    try {
      if (!disabled() && init && init.body) {
        var id = appIdFromPut(url, init);
        if (id != null) {
          var prim = Object.prototype.hasOwnProperty.call(primaryByAppId, id) ? primaryByAppId[id] : null;
          if (prim != null) {                          // fail open when primary unknown
            var bodyStr = (typeof init.body === 'string') ? init.body : null;
            var parsed = bodyStr ? safeParse(bodyStr) : null;
            if (parsed && (parsed.cv_sections !== undefined || parsed.cl_sections !== undefined)) {
              // A body carrying an explicit primaryLang overrides the learned value.
              var pOverride = parsed.meta && parsed.meta.primaryLang ? langToScript(parsed.meta.primaryLang) : null;
              var effPrim = pOverride || prim;
              var cur = scriptOf(parsed.cv_sections, parsed.cl_sections);
              var d = decide(parsed, effPrim, cur);
              if (d.strip) {
                try {
                  console.warn('[parallel-translation-keep] kept canonical for app ' + id
                    + ' — a ' + d.cur + ' view was not written over the ' + d.primary
                    + ' canonical (the translation stays in langRenders). PARALLEL-TRANSLATION-KEEP-001');
                } catch (_) {}
                return origFetch.call(window, url, rewriteInit(init, stripSections(parsed)));
              }
            }
          }
        }
      }
    } catch (e) {
      try { console.warn('[parallel-translation-keep] guard error (passing through):', e && e.message); } catch (_) {}
    }
    return origFetch.call(window, url, init);
  };

  try { window.fetch = guardedFetch; } catch (_) {}

  // pollers — light and self-limiting
  try { setTimeout(pollActive, 800); } catch (_) {}
  try { setInterval(pollActive, 4000); } catch (_) {}
  try { setInterval(pollGen, 1500); } catch (_) {}
  // re-learn the active app's primary after any settle (covers a fresh cloud-restore)
  try { window.addEventListener('antcv:sections-updated', function () { if (lastActive != null && !Object.prototype.hasOwnProperty.call(primaryByAppId, lastActive)) learnPrimary(lastActive); }); } catch (_) {}

  window.AntcvParallelTranslationKeep = {
    version: VERSION,
    _decide: decide,
    _scriptOf: scriptOf,
    _langToScript: langToScript,
    _primary: primaryByAppId,
    _learn: learnPrimary,
  };
  try { console.debug('[parallel-translation-keep] installed v' + VERSION); } catch (_) {}
})();
