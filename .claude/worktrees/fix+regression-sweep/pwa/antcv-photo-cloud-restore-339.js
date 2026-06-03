/* AntCV photo cloud restore on page load (v1.40.339-i)
 * ─────────────────────────────────────────────────────────────────────
 *
 * Bug 6
 * -----
 * Profile photo set on PC does NOT show up on mobile after sign-in.
 * Sister sidecar to antcv-personal-info-cloud-restore-282.js, which
 * handles personalInfo on first page load but explicitly excludes the
 * `photo` field (photo lives at the SAME top level as personalInfo,
 * not nested inside it).
 *
 * Why two sidecars
 * ----------------
 * The cloud relay's PUT/GET schema treats personalInfo and photo as
 * independent keys (see AntcvFullErase's EMPTY_STATE: `{ proxyUrl,
 * photo, apiKeys, personalInfo, ... }`). v282 walks the GET response
 * for personalInfo only. The bundle's own cloudRead is supposed to
 * restore photo at sign-in, but the user reports that on mobile-fresh-
 * sign-in the photo doesn't appear after a PC-side upload. Two
 * possible failure modes:
 *
 *   (a) Read gap: relay's GET returns photo, but the bundle ignores
 *       it on hard-refresh / cold-load. → this sidecar fixes it.
 *   (b) Write gap: PC's cloudWrite never PUTs photo to the relay, so
 *       cloud-photo is empty for any device that reads. → this
 *       sidecar can't fix the write itself, but it will log
 *       "no photo in cloud response" so you can diagnose write-side
 *       failure from the console.
 *
 * Behaviour
 * ---------
 *  1. Once per session (sessionStorage flag), fetch /api/prefs.
 *  2. Walk the response for a top-level `photo` (or `photo_b64`,
 *     mirroring the kernel column name). Falls back to checking
 *     prefs.personalInfo.photo in case some flow nests it.
 *  3. If local photo is already populated (>100 chars, i.e. a real
 *     base64 string not the empty placeholder), do nothing — don't
 *     overwrite a local photo with a stale cloud one.
 *  4. Otherwise write the cloud photo to localStorage.photo (JSON-
 *     stringified, matching app.js's convention) and dispatch a
 *     storage event + custom event so React picks it up without a
 *     manual reload.
 *
 * Things this does NOT do
 * -----------------------
 *  - Push local-only photo to cloud (that's app.js's cloudWrite's
 *    job; if it's broken, this sidecar exposes it via logging).
 *  - Overwrite a populated local photo (would clobber a fresh
 *    mobile-side upload before it cloud-syncs).
 *  - Touch auth, relay URL, or any non-photo field.
 *
 * Escape hatch
 * ------------
 *  localStorage['antcv:disable-photo-cloud-restore'] = '1'
 *    → no-op (skip the GET entirely).
 */
(function () {
  'use strict';
  var VERSION = '1.40.339-i';
  if (window.__antcvPhotoCloudRestore339 === VERSION) return;
  window.__antcvPhotoCloudRestore339 = VERSION;

  var TOKEN_KEY    = 'antcv:auth:token';
  var SESSION_FLAG = 'antcv:photo:cloud-restored-339i';
  var DISABLE_KEY  = 'antcv:disable-photo-cloud-restore';
  var MIN_PHOTO_LEN = 100;  // anything smaller isn't a real base64 photo

  function disabled() {
    try {
      var v = localStorage.getItem(DISABLE_KEY);
      return v === '1' || v === 'true';
    } catch (_) { return false; }
  }

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

  // Walk the GET /api/prefs response looking for a photo field.
  // Mirrors v282's extractPersonalInfo walk so we cover the same
  // wrapper variants the relay might return.
  function extractPhoto(prefs, seen) {
    if (!prefs || typeof prefs !== 'object') return null;
    seen = seen || [];
    if (seen.indexOf(prefs) >= 0) return null;
    seen.push(prefs);

    if (typeof prefs.photo === 'string' && prefs.photo.length >= MIN_PHOTO_LEN) return prefs.photo;
    if (typeof prefs.photo_b64 === 'string' && prefs.photo_b64.length >= MIN_PHOTO_LEN) return prefs.photo_b64;

    // Some flows nest the photo inside personalInfo, even though the
    // canonical schema treats it as top-level.
    if (prefs.personalInfo && typeof prefs.personalInfo === 'object') {
      var pi = prefs.personalInfo;
      if (typeof pi.photo === 'string' && pi.photo.length >= MIN_PHOTO_LEN) return pi.photo;
      if (typeof pi.photo_b64 === 'string' && pi.photo_b64.length >= MIN_PHOTO_LEN) return pi.photo_b64;
    }

    var nests = [
      prefs.prefs, prefs.preferences, prefs.settings, prefs.data,
      prefs.user, prefs.account, prefs.profile, prefs.active_application,
      prefs.kernel
    ];
    for (var i = 0; i < nests.length; i++) {
      var found = extractPhoto(nests[i], seen);
      if (found) return found;
    }
    return null;
  }

  function getLocalPhoto() {
    try {
      var raw = localStorage.getItem('photo') || '';
      // app.js stores photo as a JSON-stringified string; unwrap.
      if (raw && raw.charAt(0) === '"') {
        try { raw = JSON.parse(raw); } catch (_) {}
      }
      return raw || '';
    } catch (_) { return ''; }
  }

  function setLocalPhoto(value) {
    try {
      var serialized = JSON.stringify(value);
      localStorage.setItem('photo', serialized);
      // Fire the storage event in-tab so React picks it up immediately.
      try {
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'photo',
          newValue: serialized,
          storageArea: localStorage
        }));
      } catch (_) {
        try {
          var ev2 = document.createEvent('Event');
          ev2.initEvent('storage', true, true);
          ev2.key = 'photo';
          ev2.newValue = serialized;
          window.dispatchEvent(ev2);
        } catch (_) {}
      }
      try {
        window.dispatchEvent(new CustomEvent('antcv:photo-restored', {
          detail: { source: 'cloud-restore-339i', size: value.length }
        }));
      } catch (_) {}
    } catch (e) {
      try { console.warn('[photo-cloud-restore-339i] setLocalPhoto failed:', e && e.message); } catch (_) {}
    }
  }

  var restoreInFlight = false;
  var restoreDone = false;

  function restoreFromCloud(reason) {
    if (restoreInFlight || restoreDone) return Promise.resolve(false);
    if (disabled()) {
      restoreDone = true;
      return Promise.resolve(false);
    }
    var base = getRelayBase();
    var token = getToken();
    if (!base || !token) {
      try { console.debug('[photo-cloud-restore-339i] not signed in or no relay (' + reason + ')'); } catch (_) {}
      return Promise.resolve(false);
    }
    // Bail if local photo already has content. Cloud photo may be
    // stale relative to a fresh local upload; we don't want to clobber
    // it before the next cloudWrite syncs.
    var local = getLocalPhoto();
    if (local && local.length >= MIN_PHOTO_LEN) {
      try { sessionStorage.setItem(SESSION_FLAG, '1'); } catch (_) {}
      restoreDone = true;
      try { console.debug('[photo-cloud-restore-339i] local photo present (' + local.length + ' bytes); skipping cloud restore (' + reason + ')'); } catch (_) {}
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
      headers: { 'Accept': 'application/json', 'Authorization': 'Bearer ' + token }
    }).then(function (res) {
      if (!res || !res.ok) {
        try { console.warn('[photo-cloud-restore-339i] GET failed:', res && res.status); } catch (_) {}
        return null;
      }
      return res.json().catch(function () { return null; });
    }).then(function (prefs) {
      var cloudPhoto = extractPhoto(prefs);
      if (!cloudPhoto || typeof cloudPhoto !== 'string' || cloudPhoto.length < MIN_PHOTO_LEN) {
        // Diagnostic: write-side gap if PC supposedly uploaded a
        // photo but the cloud doesn't have one. This log makes it
        // possible to tell apart the read-side bug (this sidecar
        // fixes) from the write-side bug (cv-proxy / app.js's
        // cloudWrite not emitting photo).
        try { console.info('[photo-cloud-restore-339i] no photo in cloud response (' + reason + ') — if PC has a photo and you see this on mobile, the write path may be the failure point, not the read path'); } catch (_) {}
        try { sessionStorage.setItem(SESSION_FLAG, '1'); } catch (_) {}
        restoreDone = true;
        return false;
      }
      setLocalPhoto(cloudPhoto);
      try { sessionStorage.setItem(SESSION_FLAG, '1'); } catch (_) {}
      try { console.info('[photo-cloud-restore-339i] photo restored from cloud (' + cloudPhoto.length + ' bytes, ' + reason + ')'); } catch (_) {}
      restoreDone = true;
      return true;
    }).catch(function (err) {
      try { console.warn('[photo-cloud-restore-339i] error:', err && err.message); } catch (_) {}
      return false;
    }).then(function (result) {
      restoreInFlight = false;
      return result;
    });
  }

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
    setTimeout(init, 120);
  }

  window.AntcvPhotoCloudRestore339 = {
    version: VERSION,
    restore: restoreFromCloud,
    _extract: extractPhoto,
    _getLocalPhoto: getLocalPhoto,
    _setLocalPhoto: setLocalPhoto,
    _clearSession: function () {
      try { sessionStorage.removeItem(SESSION_FLAG); } catch (_) {}
      restoreDone = false;
    }
  };

  try { console.info('[photo-cloud-restore-339i] installed (v=' + VERSION + ')'); } catch (_) {}
})();
