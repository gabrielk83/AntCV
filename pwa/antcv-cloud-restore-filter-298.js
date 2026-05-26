/* AntCV cloud-restore filter (v1.40.298)
 * ============================================================
 *
 * Why
 * ───
 * After clicking "Disagree & Delete user" the local state is
 * wiped but the cloud copy at /api/prefs survives (the
 * cloud-put-shrink-guard correctly refuses to PUT an empty
 * personalInfo, and v296's antcv-cloud-delete sidecar fires
 * DELETE /api/prefs only if the relay worker implements DELETE).
 * Until the worker DELETE handler ships, signing back in restores
 * the OLD personalInfo plus the OLD wizardCompleted=true flag,
 * and the bundle decides the user is a returner with completed
 * onboarding → wizard never opens → user is stranded with no
 * data and no wizard.
 *
 * This sidecar intercepts the cloud-restore response BEFORE the
 * bundle sees it. If GET /api/prefs returns a personalInfo with
 * NONE of the content arrays populated (workHistory, experience,
 * education, publications, publicationsStructured, certifications,
 * skills), the user is effectively a fresh-start case regardless
 * of what wizardCompleted claims. We strip wizardCompleted (and
 * its aliases) from the response so the bundle treats the user
 * as new and opens the wizard.
 *
 * The filter is purely defensive — the rest of the response,
 * including identity fields and preferences, passes through
 * unchanged. Cloud-side data is not modified; only the response
 * body the bundle reads is.
 *
 * Once the worker-side DELETE handler ships (so deleted accounts
 * actually have a clean cloud row on re-login), this sidecar
 * becomes a no-op for that case: the response has no
 * wizardCompleted to strip. For users with real data on the
 * cloud, this sidecar also no-ops (content arrays present).
 *
 * Escape hatch
 * ────────────
 *   localStorage['antcv:disable-cloud-restore-filter'] = '1'
 *   reverts to v297 behaviour.
 */
(function () {
  'use strict';

  var VERSION = '1.40.339';
  if (window.__antcvCloudRestoreFilter298 === VERSION) return;
  window.__antcvCloudRestoreFilter298 = VERSION;

  var DISABLE_KEY = 'antcv:disable-cloud-restore-filter';
  var CONTENT_KEYS = ['workHistory', 'experience', 'education',
    'publications', 'publicationsStructured', 'certifications', 'skills'];
  var WIZARD_KEYS = ['wizardCompleted', 'wizard_completed', 'wizardComplete',
    'onboardingCompleted', 'onboarding_completed'];
  // v1.40.302 — cookie set by antcv-cloud-delete-302 when user deletes.
  // Survives localStorage.clear() + sessionStorage.clear() + reload +
  // OAuth round-trip, so after deletion the user's next sign-in is
  // treated as fresh-start even if the worker-side DELETE /api/prefs
  // never landed and the cloud still returns full personalInfo with
  // content arrays.
  var JUST_DELETED_COOKIE = 'antcv-just-deleted';

  function disabled() {
    try {
      var raw = localStorage.getItem(DISABLE_KEY);
      return raw === '1' || raw === 'true';
    } catch (_) { return false; }
  }

  function justDeletedRecent() {
    try {
      var ck = document.cookie || '';
      var m = ck.match(/(?:^|;\s*)antcv-just-deleted=([^;]+)/);
      if (!m) return false;
      var ts = parseInt(decodeURIComponent(m[1]), 10);
      if (!ts) return false;
      // Cookie's own max-age expires after 24 h. Belt-and-braces check
      // here in case of clock skew or a leftover cookie someone set
      // manually.
      return (Date.now() - ts) < (24 * 60 * 60 * 1000);
    } catch (_) { return false; }
  }

  function hasContent(pi) {
    if (!pi || typeof pi !== 'object') return false;
    for (var i = 0; i < CONTENT_KEYS.length; i++) {
      var v = pi[CONTENT_KEYS[i]];
      if (v && typeof v === 'object' && typeof v.length === 'number' && v.length > 0) {
        return true;
      }
    }
    return false;
  }

  function isPrefsGet(url, init) {
    var method = ((init && init.method) || 'GET').toUpperCase();
    if (method !== 'GET') return false;
    var u = String(url || '');
    if (u.indexOf('/api/prefs') === -1) return false;
    // Don't filter writes / sub-endpoints we don't recognise
    if (/\/api\/prefs\/[^?]/.test(u)) return false;
    return true;
  }

  function filterPayload(json) {
    if (!json || typeof json !== 'object') return { changed: false, body: json };
    var personalInfo = json.personalInfo || json.data && json.data.personalInfo;
    if (!personalInfo || typeof personalInfo !== 'object') {
      return { changed: false, body: json };
    }
    // v1.40.302 — cookie override: if the user just deleted, treat as
    // fresh-start regardless of what content arrays say. The cookie is
    // the only signal that survives localStorage.clear() + a hard
    // reload, so when the worker-side DELETE handler hasn't shipped,
    // this is what flags "the user wanted this deleted; ignore the
    // server's leftover record" on next sign-in.
    var override = justDeletedRecent();
    if (!override && hasContent(personalInfo)) {
      return { changed: false, body: json };
    }
    // No content. Strip wizard-completion flags from BOTH top-level
    // and personalInfo + personalInfo.meta locations.
    var changed = false;
    var out = {};
    var k;
    for (k in json) { if (Object.prototype.hasOwnProperty.call(json, k)) out[k] = json[k]; }
    for (var i = 0; i < WIZARD_KEYS.length; i++) {
      if (Object.prototype.hasOwnProperty.call(out, WIZARD_KEYS[i])) {
        delete out[WIZARD_KEYS[i]];
        changed = true;
      }
    }
    // personalInfo: shallow clone + strip
    var piOut = {};
    for (k in personalInfo) {
      if (Object.prototype.hasOwnProperty.call(personalInfo, k)) piOut[k] = personalInfo[k];
    }
    for (var j = 0; j < WIZARD_KEYS.length; j++) {
      if (Object.prototype.hasOwnProperty.call(piOut, WIZARD_KEYS[j])) {
        delete piOut[WIZARD_KEYS[j]];
        changed = true;
      }
    }
    // v1.40.339: also strip stale language preferences from stylePrefs so
    // the post-delete fresh-start really starts fresh (no ZH coming back
    // from a previous session via cloud-restore).
    if (piOut.stylePrefs && typeof piOut.stylePrefs === 'object') {
      var spOut = {};
      var spKey;
      for (spKey in piOut.stylePrefs) {
        if (Object.prototype.hasOwnProperty.call(piOut.stylePrefs, spKey)) spOut[spKey] = piOut.stylePrefs[spKey];
      }
      var LANG_KEYS = ['visibleLanguages', 'languageBar', 'enabledLanguages',
                       'languages', 'langBar', 'shownLanguages'];
      var langChanged = false;
      for (var lk = 0; lk < LANG_KEYS.length; lk++) {
        if (Object.prototype.hasOwnProperty.call(spOut, LANG_KEYS[lk])) {
          delete spOut[LANG_KEYS[lk]];
          langChanged = true;
        }
      }
      if (langChanged) {
        piOut.stylePrefs = spOut;
        changed = true;
        try { console.info('[antcv-cloud-restore-filter-' + VERSION + '] stripped stylePrefs.visibleLanguages and aliases (fresh-start)'); } catch (_) {}
      }
    }
    // personalInfo.meta: shallow clone + strip
    if (piOut.meta && typeof piOut.meta === 'object') {
      var metaOut = {};
      for (k in piOut.meta) {
        if (Object.prototype.hasOwnProperty.call(piOut.meta, k)) metaOut[k] = piOut.meta[k];
      }
      var metaChanged = false;
      for (var m = 0; m < WIZARD_KEYS.length; m++) {
        if (Object.prototype.hasOwnProperty.call(metaOut, WIZARD_KEYS[m])) {
          delete metaOut[WIZARD_KEYS[m]];
          metaChanged = true;
        }
      }
      if (metaChanged) {
        piOut.meta = metaOut;
        changed = true;
      }
    }
    if (changed) {
      out.personalInfo = piOut;
      try {
        var reason = override ? 'antcv-just-deleted cookie set' :
                                'no content; treating as fresh-start';
        console.info('[antcv-cloud-restore-filter-' + VERSION + '] stripped wizardCompleted from cloud-restore response (' + reason + ')');
      } catch (_) {}
      // v1.40.302 — also wipe any localStorage wizard-completion flags
      // that may have been written by an earlier code path before the
      // filter could intercept (e.g. an in-flight cloud-restore that
      // already wrote to LS, or the bundle's own gates). Without this,
      // the bundle's "after cloud-restore" check at byte ~217359 reads
      // u.get("wizardCompleted") from LS, finds it true, and closes
      // the wizard despite our filter stripping the cloud copy.
      try {
        for (var w = 0; w < WIZARD_KEYS.length; w++) {
          localStorage.removeItem(WIZARD_KEYS[w]);
          localStorage.removeItem('antcv:' + WIZARD_KEYS[w]);
        }
      } catch (_) {}
      // Clear the just-deleted cookie once acted on — one-shot signal,
      // not a permanent state.
      if (override) {
        try {
          document.cookie = 'antcv-just-deleted=; max-age=0; path=/; samesite=lax';
        } catch (_) {}
      }
    }
    return { changed: changed, body: out };
  }

  function wrapFetch() {
    if (typeof window.fetch !== 'function') return false;
    if (window.fetch.__antcvCloudRestoreFilter === VERSION) return true;
    var orig = window.fetch;
    var wrapped = function (url, init) {
      var p = orig.apply(this, arguments);
      if (disabled()) return p;
      if (!isPrefsGet(url, init)) return p;
      return p.then(function (resp) {
        if (!resp || !resp.ok) return resp;
        // Clone before reading the body so the original is still
        // available downstream.
        var clone;
        try { clone = resp.clone(); } catch (_) { return resp; }
        return clone.text().then(function (text) {
          var json;
          try { json = JSON.parse(text); } catch (_) { return resp; }
          var out = filterPayload(json);
          if (!out.changed) return resp;
          try {
            return new Response(JSON.stringify(out.body), {
              status: resp.status,
              statusText: resp.statusText,
              headers: resp.headers,
            });
          } catch (_) { return resp; }
        }).catch(function () { return resp; });
      });
    };
    wrapped.__antcvCloudRestoreFilter = VERSION;
    window.fetch = wrapped;
    try { console.info('[antcv-cloud-restore-filter-' + VERSION + '] installed; will filter GET /api/prefs responses with no content'); } catch (_) {}
    return true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wrapFetch);
  } else {
    setTimeout(wrapFetch, 0);
  }

  // Debug API
  window.AntcvCloudRestoreFilter298 = {
    version: VERSION,
    _filterPayload: filterPayload,
    _isPrefsGet: isPrefsGet,
    _hasContent: hasContent,
    _disabled: disabled,
    _wrapFetch: wrapFetch,
  };
})();
