/* AntCV personalInfo cloud restore on page load (v1.40.282)
 * ──────────────────────────────────────────────────────────────────────
 *
 * Problem fixed
 * ─────────────
 *   Gabriel reported (2026-05-21): refreshing the page wipes the
 *   personal information from memory. It should be restored from the
 *   cloud.
 *
 *   Existing cloud-sync sidecars (ai-consent-cloud-sync, fit-cv-cloud-sync,
 *   generate-cloud-sync-277) all push localStorage → cloud or pull on a
 *   specific button click (Run-Fit, Generate). None of them pulls
 *   personalInfo from /api/prefs on page load. So after a hard refresh,
 *   service-worker invalidation, or first load on a new device,
 *   localStorage.personalInfo is empty and nothing repopulates it.
 *
 *   The cloud format is NOT encoded — it's plain JSON at
 *
 *     GET {relayBase}/api/prefs
 *     Authorization: Bearer {token}
 *
 *   returning an object where personalInfo (or personal_info) sits at
 *   the top level OR nested under prefs/preferences/settings/data/user/
 *   account/profile/active_application. Same shape that
 *   antcv-ai-disclosure-cloud.js already walks.
 *
 * Approach
 * ────────
 *   1. Once per session (sessionStorage flag), fetch /api/prefs and
 *      pull personalInfo out of the response.
 *   2. Merge with localStorage.personalInfo using a "fill missing"
 *      strategy: for every key the cloud provides, if the local value
 *      is empty (undefined / null / "" / [] / {}), accept the cloud
 *      value. Local values that already have content are preserved —
 *      this protects edits that haven't been pushed to cloud yet (e.g.,
 *      user typed something and refreshed before the push trigger
 *      fired).
 *   3. Write the merged object back to localStorage and dispatch a
 *      StorageEvent + a custom event so React's reducers pick it up
 *      without waiting for the user to navigate.
 *
 * Auth handling
 * ─────────────
 *   If the auth token isn't present at script init, wait for a storage
 *   event on the token key (sign-in completes) or poll briefly (sign-in
 *   in same tab). Once the token + relay base are both available, run
 *   the restore exactly once per session. Session-scoped means the user
 *   can navigate within the SPA without re-fetching, but next page-load
 *   (or hard refresh) does pull again.
 *
 * What this does NOT touch
 * ────────────────────────
 *   - `sections` (CV/CL content) — already pulled by patch 277 on
 *     Generate click, and by fit-cv-cloud-sync on Fit-vs-CV.
 *   - Auth state, tokens, relay URL — only consumed, never modified.
 *   - Any field that local already has content for — see merge rule.
 */
(function () {
  'use strict';
  var VERSION = '1.50.432-no-merge';
  if (window.__antcvPersonalInfoCloudRestore282 === VERSION) return;
  window.__antcvPersonalInfoCloudRestore282 = VERSION;

  var TOKEN_KEY    = 'antcv:auth:token';
  var SESSION_FLAG = 'antcv:personalInfo:cloud-restored-282';

  // Mirror the helpers used by antcv-ai-disclosure-cloud.js so we read
  // the same auth state. Some flows write the URL as a JSON-quoted
  // string ("https://..."), so unwrap if needed.
  function readUrlKey(key) {
    var v = '';
    try { v = localStorage.getItem(key) || ''; } catch (_) {}
    try { if (v && v.charAt(0) === '"') v = JSON.parse(v); } catch (_) {}
    return String(v || '').trim();
  }
  function getRelayBase() {
    var v = readUrlKey('proxyUrl') || readUrlKey('relayUrl');
    if (!v && typeof window.ANTCV_RELAY_URL === 'string') v = window.ANTCV_RELAY_URL;
    return String(v || '').replace(/\/+$/, '');
  }
  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (_) { return ''; }
  }

  // Walk the cloud response looking for personalInfo / personal_info,
  // descending into common wrappers. Cycle-guarded.
  function extractPersonalInfo(prefs, seen) {
    if (!prefs || typeof prefs !== 'object') return null;
    seen = seen || [];
    if (seen.indexOf(prefs) >= 0) return null;
    seen.push(prefs);

    if (prefs.personalInfo && typeof prefs.personalInfo === 'object') return prefs.personalInfo;
    if (prefs.personal_info && typeof prefs.personal_info === 'object') return prefs.personal_info;

    var nests = [
      prefs.prefs, prefs.preferences, prefs.settings, prefs.data,
      prefs.user, prefs.account, prefs.profile, prefs.active_application
    ];
    for (var i = 0; i < nests.length; i++) {
      var found = extractPersonalInfo(nests[i], seen);
      if (found) return found;
    }
    return null;
  }

  function isEmpty(v) {
    if (v === undefined || v === null) return true;
    if (typeof v === 'string') return v.length === 0;
    if (Array.isArray(v)) return v.length === 0;
    if (typeof v === 'object') {
      for (var k in v) {
        if (Object.prototype.hasOwnProperty.call(v, k)) return false;
      }
      return true;
    }
    return false;
  }

  // Recursively fill missing fields in `local` from `cloud`. Returns
  // { merged, changed }. Objects are merged key-by-key; primitives are
  // replaced only when local is empty.
  function fillMissing(local, cloud) {
    if (isEmpty(cloud)) return { merged: local, changed: false };
    if (isEmpty(local) || typeof local !== 'object' || Array.isArray(local)) {
      // Local is empty/scalar; take cloud wholesale.
      if (typeof cloud === 'object' && !Array.isArray(cloud)) {
        return { merged: JSON.parse(JSON.stringify(cloud)), changed: true };
      }
      return { merged: cloud, changed: true };
    }
    if (typeof cloud !== 'object' || Array.isArray(cloud)) {
      // Cloud is scalar / array and local is an object — keep local.
      return { merged: local, changed: false };
    }
    var changed = false;
    var merged = {};
    var key;
    for (key in local) {
      if (Object.prototype.hasOwnProperty.call(local, key)) merged[key] = local[key];
    }
    for (key in cloud) {
      if (!Object.prototype.hasOwnProperty.call(cloud, key)) continue;
      var cv = cloud[key];
      var lv = merged[key];
      if (lv === undefined || isEmpty(lv)) {
        // Local missing or empty — take cloud.
        merged[key] = (cv && typeof cv === 'object') ? JSON.parse(JSON.stringify(cv)) : cv;
        changed = true;
      } else if (cv && typeof cv === 'object' && !Array.isArray(cv) &&
                 lv && typeof lv === 'object' && !Array.isArray(lv)) {
        // Both are objects — recurse.
        var sub = fillMissing(lv, cv);
        merged[key] = sub.merged;
        if (sub.changed) changed = true;
      }
      // Otherwise local has content of an incompatible shape — keep local.
    }
    return { merged: merged, changed: changed };
  }

  function dispatchUpdate(merged) {
    var serialized = JSON.stringify(merged);
    // StorageEvent doesn't fire in the originating tab, so we
    // construct and dispatch one manually for in-tab React listeners.
    try {
      var ev = new StorageEvent('storage', {
        key: 'personalInfo',
        newValue: serialized,
        storageArea: window.localStorage,
      });
      window.dispatchEvent(ev);
    } catch (_) {
      try {
        var ev2 = document.createEvent('Event');
        ev2.initEvent('storage', true, true);
        ev2.key = 'personalInfo';
        ev2.newValue = serialized;
        window.dispatchEvent(ev2);
      } catch (_) {}
    }
    try {
      window.dispatchEvent(new CustomEvent('antcv:personal-info-restored', {
        detail: { source: 'cloud-restore-282', size: serialized.length },
      }));
    } catch (_) {}
    try {
      window.dispatchEvent(new CustomEvent('antcv:sections-updated', {
        detail: { source: 'cloud-restore-282', kind: 'personal-info' },
      }));
    } catch (_) {}
  }

  var restoreInFlight = false;
  var restoreDone = false;

  function restoreFromCloud(reason) {
    if (restoreInFlight || restoreDone) return Promise.resolve(false);
    var base = getRelayBase();
    var token = getToken();
    if (!base || !token) {
      try { console.debug('[personal-info-cloud-restore-282] not signed in or no relay; skipping (' + reason + ')'); } catch (_) {}
      return Promise.resolve(false);
    }
    try {
      if (sessionStorage.getItem(SESSION_FLAG) === '1') {
        restoreDone = true;
        return Promise.resolve(false);
      }
    } catch (_) {}

    restoreInFlight = true;
    return window.fetch(base + '/api/prefs', {
      method: 'GET',
      credentials: 'include',
      headers: { 'Accept': 'application/json', 'Authorization': 'Bearer ' + token },
    }).then(function (res) {
      if (!res || !res.ok) {
        try { console.warn('[personal-info-cloud-restore-282] GET failed:', res && res.status); } catch (_) {}
        return null;
      }
      return res.json().catch(function () { return null; });
    }).then(function (prefs) {
      var cloudPi = extractPersonalInfo(prefs);
      if (!cloudPi) {
        try { console.debug('[personal-info-cloud-restore-282] no personalInfo in cloud response'); } catch (_) {}
        return false;
      }
      var localPi = {};
      try {
        var raw = localStorage.getItem('personalInfo');
        if (raw) localPi = JSON.parse(raw) || {};
      } catch (_) {}
      // LEAK-FIX (owner 2026-06-13, "restore but never merge"): the old
      // field-by-field fillMissing let one persona's cloud fields bleed into
      // the OTHER persona's empty slots (the Gabriel/Anita specialization
      // leak) — you could end up with a half-Gabriel / half-Anita record.
      // When the cloud holds a SUBSTANTIVE personalInfo, replace local
      // WHOLESALE so the restored record is a single consistent persona — no
      // cross-field mixing. Only fall back to the gentle fillMissing when the
      // cloud copy is sparse, so a near-empty cloud can't wipe a fuller local.
      var cloudKeys = (cloudPi && typeof cloudPi === 'object')
        ? Object.keys(cloudPi).filter(function (k) { return !isEmpty(cloudPi[k]); })
        : [];
      var cloudSubstantive = !!(String((cloudPi && cloudPi.name) || '').trim()) || cloudKeys.length >= 3;
      var result;
      if (cloudSubstantive) {
        var mergedClone = JSON.parse(JSON.stringify(cloudPi));
        result = { merged: mergedClone, changed: JSON.stringify(mergedClone) !== JSON.stringify(localPi) };
      } else {
        result = fillMissing(localPi, cloudPi);
      }
      if (!result.changed) {
        try { console.debug('[personal-info-cloud-restore-282] nothing to restore (local already complete)'); } catch (_) {}
        try { sessionStorage.setItem(SESSION_FLAG, '1'); } catch (_) {}
        restoreDone = true;
        return false;
      }
      try { localStorage.setItem('personalInfo', JSON.stringify(result.merged)); } catch (_) {}
      dispatchUpdate(result.merged);
      try { sessionStorage.setItem(SESSION_FLAG, '1'); } catch (_) {}
      try {
        console.debug('[personal-info-cloud-restore-282] restored personalInfo from cloud (' + reason +
          '), keys: ' + Object.keys(result.merged).join(','));
      } catch (_) {}
      restoreDone = true;
      return true;
    }).catch(function (err) {
      try { console.warn('[personal-info-cloud-restore-282] error:', err && err.message); } catch (_) {}
      return false;
    }).then(function (result) {
      restoreInFlight = false;
      return result;
    });
  }

  // Wait for sign-in if necessary. Watches both a storage event
  // (auth-in-another-tab) and short polling (auth-in-this-tab).
  function init() {
    if (getToken() && getRelayBase()) {
      restoreFromCloud('init');
      return;
    }
    var onStorage = function (ev) {
      if (!ev) return;
      if (ev.key === TOKEN_KEY || ev.key === 'proxyUrl' || ev.key === 'relayUrl') {
        if (getToken() && getRelayBase()) {
          window.removeEventListener('storage', onStorage);
          restoreFromCloud('post-signin');
        }
      }
    };
    window.addEventListener('storage', onStorage);
    var polls = 0;
    var id = setInterval(function () {
      polls++;
      if (getToken() && getRelayBase()) {
        clearInterval(id);
        window.removeEventListener('storage', onStorage);
        restoreFromCloud('poll-signin');
      } else if (polls >= 30) {
        clearInterval(id);
      }
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    setTimeout(init, 80);
  }

  window.AntcvPersonalInfoCloudRestore282 = {
    version: VERSION,
    restore: restoreFromCloud,
    _extract: extractPersonalInfo,
    _fillMissing: fillMissing,
    _isEmpty: isEmpty,
    _clearSession: function () {
      try { sessionStorage.removeItem(SESSION_FLAG); } catch (_) {}
      restoreDone = false;
    },
  };
})();
