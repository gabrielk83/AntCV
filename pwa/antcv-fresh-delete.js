/* AntCV fresh-start delete helper (v1.50.790)
 * ============================================================================
 * FRESH-START-DELETE-001 (owner 2026-06-22). Account-delete must land the user
 * on the WIZARD, not the editor-with-skeleton, and the relay URL must NOT
 * silently reappear — while the API secrets are KEPT (the wizard re-maps the
 * docx-worker URL + server-side secrets from the relay URL the user re-pastes).
 *
 * Two halves, both reused by app.js:
 *
 *   window.AntcvFreshErase()   — the local wipe used by all delete paths:
 *       1. snapshot the API SECRETS (keys + models + CloudConvert key),
 *       2. localStorage.clear() + sessionStorage.clear() (full personal-data
 *          wipe — same security posture as the 1.50.782 blanket clear),
 *       3. RESTORE only the snapshotted secrets — deliberately NOT the relay /
 *          docx / proxy URLs (those are cleared so the wizard re-asks the relay
 *          URL and auto-maps docx + secrets from it),
 *       4. set the `antcv-just-deleted` cookie (the cross-reload/OAuth-proof
 *          fresh-start signal already honoured by antcv-cloud-restore-filter-298
 *          + AntcvIsFreshStart below).
 *     Caller still does the cloud DELETE (window.AntcvCloudDelete) + reload.
 *
 *   window.AntcvIsFreshStart()  — true while the fresh-start cookie is present
 *       and recent. app.js uses it to (a) SUPPRESS the minimum-sections floor
 *       (so a deleted user's sections stay empty → wizard opens), (b) FORCE the
 *       onboarding wizard open, (c) SUPPRESS the boot-time relay-URL re-default.
 *
 *   window.AntcvClearFreshStart()  — clears the cookie; called on wizard
 *       completion so the next boot is a normal returning-user boot.
 *
 * Escape: localStorage['antcv:disable-fresh-delete'] = '1' → AntcvFreshErase
 * falls back to a plain clear (no secret-keep, no cookie); AntcvIsFreshStart
 * still works off the cookie.
 */
(function () {
  'use strict';
  var VERSION = '1.50.790-fresh-delete';
  if (window.__antcvFreshDelete === VERSION) return;
  window.__antcvFreshDelete = VERSION;

  var COOKIE = 'antcv-just-deleted';
  var FRESH_TTL_MS = 24 * 60 * 60 * 1000;

  // The keys treated as KEEP-able secrets/prefs (NOT personal data, NOT relay
  // URLs). Mirrors the wizard's API-keys step + CloudConvert key.
  var SECRET_KEYS = [
    'apiKey', 'openaiKey', 'mistralKey', 'geminiKey',
    'openaiModel', 'mistralModel', 'geminiModel',
    'cloudconvertKey'
  ];

  function disabled() {
    try {
      var d = localStorage.getItem('antcv:disable-fresh-delete');
      return d === '1' || d === 'true';
    } catch (_) { return false; }
  }

  function setFreshCookie() {
    try {
      document.cookie = COOKIE + '=' + encodeURIComponent(String(Date.now())) +
        '; max-age=86400; path=/; samesite=lax';
    } catch (_) {}
  }

  function clearFreshCookie() {
    try { document.cookie = COOKIE + '=; max-age=0; path=/; samesite=lax'; } catch (_) {}
  }

  function isFreshStart() {
    try {
      var ck = document.cookie || '';
      var m = ck.match(/(?:^|;\s*)antcv-just-deleted=([^;]+)/);
      if (!m) return false;
      var ts = parseInt(decodeURIComponent(m[1]), 10);
      if (!ts) return false;
      return (Date.now() - ts) < FRESH_TTL_MS;
    } catch (_) { return false; }
  }

  function freshErase() {
    if (disabled()) {
      try { localStorage.clear(); } catch (_) {}
      try { sessionStorage.clear(); } catch (_) {}
      return;
    }
    // 1. snapshot secrets
    var keep = {};
    try {
      for (var i = 0; i < SECRET_KEYS.length; i++) {
        var k = SECRET_KEYS[i], v = null;
        try { v = localStorage.getItem(k); } catch (_) {}
        if (v != null) keep[k] = v;
      }
    } catch (_) {}
    // 2. full wipe
    try { localStorage.clear(); } catch (_) {}
    try { sessionStorage.clear(); } catch (_) {}
    // 3. restore ONLY the secrets (never the relay/docx/proxy URLs)
    try {
      Object.keys(keep).forEach(function (k) {
        try { localStorage.setItem(k, keep[k]); } catch (_) {}
      });
    } catch (_) {}
    // 4. arm the fresh-start signal
    setFreshCookie();
    try {
      console.info('[fresh-delete] erased (kept ' + Object.keys(keep).length +
        ' secret key(s); relay/docx URLs cleared); fresh-start armed');
    } catch (_) {}
  }

  window.AntcvFreshErase = freshErase;
  window.AntcvIsFreshStart = isFreshStart;
  window.AntcvClearFreshStart = clearFreshCookie;
  window.AntcvFreshDelete = {
    version: VERSION,
    erase: freshErase,
    isFreshStart: isFreshStart,
    clear: clearFreshCookie,
    secretKeys: SECRET_KEYS
  };
  try { console.debug('[fresh-delete] installed v' + VERSION); } catch (_) {}
})();
