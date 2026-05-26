/* AntCV cloud-restore filter (v1.40.339-d)
 * ============================================================
 *
 * Why
 * ───
 * After clicking "Disagree & Delete user" the local state is
 * wiped but the cloud copy at /api/prefs may survive briefly
 * until the worker-side DELETE handler propagates. This sidecar
 * intercepts the cloud-restore response BEFORE the bundle sees
 * it and strips wizardCompleted (plus its aliases) so a freshly
 * deleted user re-signing in sees the wizard instead of a
 * half-restored stale state.
 *
 * v1.40.339-d (cookie-only stripping)
 * -----------------------------------
 *  Previous versions (v1.40.298 → v1.40.339-b) ALSO stripped
 *  wizardCompleted when personalInfo had no items in the array
 *  fields workHistory / experience / education / publications /
 *  publicationsStructured / certifications / skills — the
 *  assumption being "no array content => fresh-start regardless
 *  of what cloud says".
 *
 *  That assumption broke cross-device sync. A user who finishes
 *  the wizard on PC with personal info populated but where the
 *  history arrays in cloud personalInfo end up empty (because
 *  the data-importer ran on a different device, or because the
 *  PC user filled in identity fields without a CV upload) has
 *  no array content in cloud. Signing in on the second device
 *  stripped wizardCompleted, re-opened the wizard, and cascade-
 *  broke AI-notice gating, personalInfo prefill, and every other
 *  "we've done this before" check.
 *
 *  v339-d trusts the cloud unless the antcv-just-deleted cookie
 *  is set. That cookie is the explicit "user wanted this gone"
 *  signal. The relay now ships a real DELETE handler (verified
 *  in antcv-access-relay source at version
 *  "auth-23-wizard-skipped-and-ai-notice-bool"),
 *  AntcvFullErase fires a fully-typed PUT-empty as belt-and-
 *  braces, AND antcv-cloud-delete-296 sidecar also fires DELETE —
 *  so by the time a cross-device GET runs after a real deletion,
 *  the cloud is genuinely empty.
 *
 *  Cross-device delete edge case (acceptable tradeoff):
 *    If a user deletes on PC AND the relay DELETE fails AND the
 *    PUT-empty fails AND they sign into mobile before retrying,
 *    the wizard WON'T re-open on mobile (cookies are per-browser).
 *    User can sign out + delete again from the second device.
 *    This is rarer and less harmful than breaking every
 *    legitimate cross-device sync, which the prior heuristic did.
 *
 * Escape hatch
 * ────────────
 *   localStorage['antcv:disable-cloud-restore-filter'] = '1'
 *   reverts the filter to a no-op.
 */
(function () {
  'use strict';

  var VERSION = '1.40.339-d';
  if (window.__antcvCloudRestoreFilter298 === VERSION) return;
  window.__antcvCloudRestoreFilter298 = VERSION;

  var DISABLE_KEY = 'antcv:disable-cloud-restore-filter';
  var WIZARD_KEYS = ['wizardCompleted', 'wizard_completed', 'wizardComplete',
    'onboardingCompleted', 'onboarding_completed'];
  // Cookie set by antcv-cloud-delete-302 when user deletes.
  // Survives localStorage.clear() + sessionStorage.clear() + reload +
  // OAuth round-trip, so after deletion the user's next sign-in is
  // treated as fresh-start. Per-browser (does not cross devices).
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
      // Cookie's own max-age expires after 24h. Belt-and-braces check
      // here in case of clock skew or a leftover cookie someone set
      // manually.
      return (Date.now() - ts) < (24 * 60 * 60 * 1000);
    } catch (_) { return false; }
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
    // v1.40.339-d: cookie-only. If the user didn't just delete,
    // trust whatever cloud sent us — including wizardCompleted,
    // language preferences, and everything else.
    if (!justDeletedRecent()) {
      return { changed: false, body: json };
    }
    // Past this point, we know the user just deleted (cookie present).
    // The cloud row may not have been wiped yet; strip wizard-
    // completion flags so the bundle re-opens the wizard.
    var personalInfo = json.personalInfo || json.data && json.data.personalInfo;
    var changed = false;
    var out = {};
    var k;
    for (k in json) { if (Object.prototype.hasOwnProperty.call(json, k)) out[k] = json[k]; }
    // Strip top-level wizard flags
    for (var i = 0; i < WIZARD_KEYS.length; i++) {
      if (Object.prototype.hasOwnProperty.call(out, WIZARD_KEYS[i])) {
        delete out[WIZARD_KEYS[i]];
        changed = true;
      }
    }
    if (personalInfo && typeof personalInfo === 'object') {
      var piOut = {};
      for (k in personalInfo) {
        if (Object.prototype.hasOwnProperty.call(personalInfo, k)) piOut[k] = personalInfo[k];
      }
      // Strip wizard flags from personalInfo too
      for (var j = 0; j < WIZARD_KEYS.length; j++) {
        if (Object.prototype.hasOwnProperty.call(piOut, WIZARD_KEYS[j])) {
          delete piOut[WIZARD_KEYS[j]];
          changed = true;
        }
      }
      // Strip stale language preferences from stylePrefs so the
      // post-delete fresh-start really starts fresh (no ZH coming
      // back from a previous session via cloud-restore).
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
        }
      }
      // Strip wizard flags from personalInfo.meta too
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
      if (changed) out.personalInfo = piOut;
    }
    if (changed) {
      try {
        console.info('[antcv-cloud-restore-filter-' + VERSION + '] stripped wizardCompleted from cloud-restore response (antcv-just-deleted cookie set)');
      } catch (_) {}
      // Also wipe any localStorage wizard-completion flags that may
      // have been written by an earlier code path before the filter
      // could intercept.
      try {
        for (var w = 0; w < WIZARD_KEYS.length; w++) {
          localStorage.removeItem(WIZARD_KEYS[w]);
          localStorage.removeItem('antcv:' + WIZARD_KEYS[w]);
        }
      } catch (_) {}
      // Clear the just-deleted cookie once acted on — one-shot signal,
      // not a permanent state.
      try {
        document.cookie = 'antcv-just-deleted=; max-age=0; path=/; samesite=lax';
      } catch (_) {}
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
      // v1.40.339-d: short-circuit when no delete cookie — saves the
      // Response clone + body re-parse on every cross-device sign-in.
      if (!justDeletedRecent()) return p;
      return p.then(function (resp) {
        if (!resp || !resp.ok) return resp;
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
    try { console.info('[antcv-cloud-restore-filter-' + VERSION + '] installed; cookie-only stripping (was content-based in prior versions)'); } catch (_) {}
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
    _justDeletedRecent: justDeletedRecent,
    _disabled: disabled,
    _wrapFetch: wrapFetch,
  };
})();
