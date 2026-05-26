/* AntCV AI consent cookie-clear guard (v1.40.339-l)
 * ===========================================================================
 * Detects when the user has cleared cookies and re-prompts the AI disclosure.
 *
 * Problem
 * -------
 * Browsers' cookie-clear UI typically only wipes cookies, leaving
 * localStorage intact. Meanwhile, the bundle's AI-notice gate keys off
 * localStorage.aiDisclosureAccepted. After cookies are cleared and the
 * user re-signs in, LS still says "consent accepted" so the notice is
 * skipped — but legally/ethically the user wanted a fresh start.
 *
 * Compounding the issue: antcv-personal-info-cloud-restore-282.js
 * restores personalInfo from cloud, which contains aiDisclosureAccepted
 * mirrored at acceptance time by antcv-ai-consent-cloud-sync-224.js.
 * Even wiping LS isn't enough — cloud restore brings it back.
 *
 * Mechanism
 * ---------
 * On AI-notice acceptance, write a persistent non-HttpOnly cookie
 * `antcv-ai-consent-marker` (max-age 1 year, path /, samesite=lax,
 * secure on https). The cookie is the trail of acceptance. At boot,
 * examine three signals:
 *
 *   - LS aiDisclosureAccepted (truthy)?
 *   - Marker cookie present?
 *   - One-shot backfill LS key present?
 *
 *   Case A: no LS consent                       → no-op
 *   Case B: LS consent + marker cookie present  → healthy; backfill
 *           LS key if absent. No further action.
 *   Case C: LS consent + cookie missing + backfill missing
 *           → first run after this sidecar shipped (or cross-device
 *             first signin). Silently backfill cookie + LS key. No
 *             re-prompt — this user accepted before we tracked the
 *             cookie.
 *   Case D: LS consent + cookie missing + backfill present
 *           → COOKIES WERE CLEARED. Scrub local + cloud consent so
 *             the bundle re-prompts on the next render tick. Then
 *             persistent re-scrub for 30 s to defeat the cloud
 *             restore window opened by personal-info-cloud-restore-282.
 *
 * Cloud scrub
 * -----------
 * PUT /api/prefs with consent fields explicitly emptied. Mirrors the
 * field set written by antcv-ai-consent-cloud-sync-224.js but with
 * empty-string and false values. Polls up to 30 s for relay base URL
 * + token to become available (signin flow is async).
 *
 * Cross-device
 * ------------
 * Acceptance on Device A is mirrored to cloud. When user signs in on
 * Device B, cloud restore lands LS consent but Device B has no marker
 * cookie. The backfill LS key is also absent (per-device LS). Case C
 * fires → silent cookie backfill, no scrub. Later cookie clears on
 * Device B trigger Case D correctly.
 *
 * Escape hatch
 * ------------
 * localStorage['antcv:disable-consent-cookie-guard'] = '1' bypasses
 * the entire sidecar.
 *
 * Coexistence with antcv-ai-consent-cloud-sync-224.js
 * ---------------------------------------------------
 * No conflict. -224 syncs LS → cloud on acceptance; this sidecar
 * writes the marker cookie on the same event. The two storage paths
 * are independent. On Case D, -224's poll loop would normally re-sync
 * the cleared LS → cloud as "not accepted" anyway, but we PUT
 * explicitly to ensure the cloud is empty even before -224's next
 * poll tick.
 * ===========================================================================
 */
(function () {
  'use strict';

  var VERSION = '1.40.339-l';
  if (window.__antcvAiConsentCookieGuard === VERSION) return;
  window.__antcvAiConsentCookieGuard = VERSION;

  var DISABLE_KEY = 'antcv:disable-consent-cookie-guard';
  var BACKFILL_KEY = 'antcv:ai-consent-cookie-marker-backfilled';
  var COOKIE_NAME = 'antcv-ai-consent-marker';
  var COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year in seconds
  var TOKEN_KEY = 'antcv:auth:token';
  var POLL_INTERVAL_MS = 200;
  var POLL_TIMEOUT_MS = 30 * 1000;
  var PERSISTENT_SCRUB_DURATION_MS = 30 * 1000;
  var PERSISTENT_SCRUB_INTERVAL_MS = 300;

  // Keys mirrored from antcv-ai-consent-cloud-sync-224.js CONSENT_KEYS.
  // If that list changes, sync this one.
  var CONSENT_KEYS = [
    'aiDisclosureAccepted',
    'aiDisclosureAcceptedMeta',
    'euAiDisclosureAccepted',
    'ai_disclosure_accepted',
    'aiDisclosureConsent',
    'eu_ai_disclosure_consent',
    'antcv:aiDisclosureAccepted',
    'antcv:aiDisclosureAcceptedMeta',
    'antcv:euAiDisclosureAccepted',
    'antcv:ai-disclosure-accepted',
    'antcv:ai-disclosure-accepted-meta',
    'antcv:ai-disclosure-cloud:synced-at',
    'antcv:ai-disclosure-cloud:last-try',
    'antcv:ai-disclosure-cloud:last-fetch'
  ];

  var PI_CONSENT_FIELDS = [
    'aiDisclosureAccepted',
    'aiDisclosureAcceptedAt',
    'aiDisclosure',
    'disclosureAccepted',
    'disclosureAcceptedAt',
    'euAiDisclosureAccepted',
    'aiDisclosureAcceptedMeta'
  ];

  function disabled() {
    try { var raw = localStorage.getItem(DISABLE_KEY); return raw === '1' || raw === 'true'; } catch (_) { return false; }
  }
  function readLs(k) { try { return localStorage.getItem(k) || ''; } catch (_) { return ''; } }
  function writeLs(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
  function removeLs(k) { try { localStorage.removeItem(k); } catch (_) {} }

  function readUrlKey(k) {
    var v = readLs(k);
    try { if (v && v.charAt(0) === '"') v = JSON.parse(v); } catch (_) {}
    return String(v || '').trim().replace(/\/+$/, '');
  }
  function relayBase() {
    var v = readUrlKey('proxyUrl') || readUrlKey('relayUrl');
    if (!v && typeof window.ANTCV_RELAY_URL === 'string') {
      v = String(window.ANTCV_RELAY_URL || '').replace(/\/+$/, '');
    }
    return v;
  }
  function token() { return readLs(TOKEN_KEY); }

  // ── Marker cookie helpers ────────────────────────────────────────────────

  function readMarkerCookie() {
    try {
      var pairs = (document.cookie || '').split(';');
      for (var i = 0; i < pairs.length; i++) {
        var p = pairs[i].replace(/^ +/, '');
        var eq = p.indexOf('=');
        var name = eq < 0 ? p : p.substring(0, eq);
        if (name === COOKIE_NAME) return eq < 0 ? '' : decodeURIComponent(p.substring(eq + 1));
      }
    } catch (_) {}
    return '';
  }
  function writeMarkerCookie() {
    try {
      var secureBit = (location.protocol === 'https:') ? '; secure' : '';
      document.cookie = COOKIE_NAME + '=1; max-age=' + COOKIE_MAX_AGE +
        '; path=/; samesite=lax' + secureBit;
    } catch (_) {}
  }
  function clearMarkerCookie() {
    try {
      var secureBit = (location.protocol === 'https:') ? '; secure' : '';
      document.cookie = COOKIE_NAME + '=; max-age=0; path=/; samesite=lax' + secureBit;
    } catch (_) {}
  }

  // ── Truthy detection (mirrored from -224) ────────────────────────────────

  function truthy(v) {
    if (v === true) return true;
    if (typeof v === 'number') return v > 0;
    if (typeof v === 'string') {
      var s = v.trim().toLowerCase();
      return !!s && s !== 'false' && s !== '0' && s !== 'null' && s !== 'undefined' && s !== 'no';
    }
    if (v && typeof v === 'object') {
      if ('accepted' in v) return truthy(v.accepted);
      if ('value' in v) return truthy(v.value);
      if ('at' in v || 'acceptedAt' in v || 'timestamp' in v) return true;
    }
    return false;
  }
  function localConsentAccepted() {
    if (truthy(readLs('aiDisclosureAccepted'))) return true;
    try { if (truthy(JSON.parse(readLs('aiDisclosureAcceptedMeta') || 'null'))) return true; } catch (_) {}
    try {
      var pi = JSON.parse(readLs('personalInfo') || '{}') || {};
      if (truthy(pi.aiDisclosureAccepted) || truthy(pi.aiDisclosure) || truthy(pi.disclosureAccepted)) return true;
    } catch (_) {}
    return false;
  }

  // ── Scrub local consent ──────────────────────────────────────────────────

  function scrubLocalConsent() {
    CONSENT_KEYS.forEach(removeLs);
    try {
      var pi = JSON.parse(readLs('personalInfo') || '{}') || {};
      var changed = false;
      PI_CONSENT_FIELDS.forEach(function (k) {
        if (k in pi) { try { delete pi[k]; changed = true; } catch (_) {} }
      });
      if (changed) localStorage.setItem('personalInfo', JSON.stringify(pi));
    } catch (_) {}
    try {
      window.dispatchEvent(new CustomEvent('antcv:ai-disclosure-local-scrubbed',
        { detail: { version: VERSION, reason: 'cookie-clear' } }));
    } catch (_) {}
  }

  // ── Scrub cloud consent ──────────────────────────────────────────────────

  function scrubCloudConsent() {
    var base = relayBase();
    var tok = token();
    if (!base || !tok) return Promise.resolve(false);
    var payload = {
      aiDisclosureAccepted: '',
      euAiDisclosureAccepted: '',
      aiDisclosureAcceptedMeta: null,
      personalInfo: { aiDisclosureAccepted: '', aiDisclosure: false, disclosureAccepted: false }
    };
    try {
      return fetch(base + '/api/prefs', {
        method: 'PUT', credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': 'Bearer ' + tok
        },
        body: JSON.stringify(payload)
      }).then(function (res) {
        try { console.info('[ai-consent-cookie-guard] cloud scrub PUT → ' + (res && res.status)); } catch (_) {}
        return !!(res && res.ok);
      }).catch(function (e) {
        try { console.warn('[ai-consent-cookie-guard] cloud scrub failed', e && e.message); } catch (_) {}
        return false;
      });
    } catch (_) { return Promise.resolve(false); }
  }

  function pollForRelayAndScrubCloud() {
    var start = Date.now();
    function tick() {
      if (Date.now() - start > POLL_TIMEOUT_MS) {
        try { console.warn('[ai-consent-cookie-guard] relay/token never arrived within ' + POLL_TIMEOUT_MS + 'ms; cloud scrub skipped'); } catch (_) {}
        return;
      }
      if (relayBase() && token()) {
        scrubCloudConsent();
        return;
      }
      setTimeout(tick, POLL_INTERVAL_MS);
    }
    tick();
  }

  // ── Persistent re-scrub (defeats cloud-restore-282 window) ───────────────

  function startPersistentScrub() {
    scrubLocalConsent();
    var start = Date.now();
    var iv = setInterval(function () {
      if (Date.now() - start > PERSISTENT_SCRUB_DURATION_MS) {
        clearInterval(iv);
        try { console.debug('[ai-consent-cookie-guard] persistent scrub window closed'); } catch (_) {}
        return;
      }
      if (localConsentAccepted()) {
        try { console.info('[ai-consent-cookie-guard] consent restored by another sidecar during scrub window; re-scrubbing'); } catch (_) {}
        scrubLocalConsent();
      }
    }, PERSISTENT_SCRUB_INTERVAL_MS);
  }

  // ── Boot logic ───────────────────────────────────────────────────────────

  function runAtBoot() {
    if (disabled()) {
      try { console.debug('[ai-consent-cookie-guard] disabled via LS escape hatch'); } catch (_) {}
      return;
    }
    if (!localConsentAccepted()) {
      try { console.debug('[ai-consent-cookie-guard] Case A: no local consent; nothing to check'); } catch (_) {}
      return;
    }

    var hasCookie = !!readMarkerCookie();
    var hasBackfill = !!readLs(BACKFILL_KEY);

    if (hasCookie) {
      try { console.debug('[ai-consent-cookie-guard] Case B: marker cookie present — healthy'); } catch (_) {}
      if (!hasBackfill) writeLs(BACKFILL_KEY, '1');
      return;
    }

    if (!hasBackfill) {
      try { console.info('[ai-consent-cookie-guard] Case C: first run after install (or cross-device first signin); backfilling marker'); } catch (_) {}
      writeMarkerCookie();
      writeLs(BACKFILL_KEY, '1');
      return;
    }

    try { console.info('[ai-consent-cookie-guard] Case D: cookie-clear detected (backfill present, marker cookie missing); scrubbing local + cloud consent'); } catch (_) {}
    startPersistentScrub();
    pollForRelayAndScrubCloud();
  }

  // ── Event hooks ──────────────────────────────────────────────────────────

  function onConsentAccepted() {
    if (disabled()) return;
    writeMarkerCookie();
    writeLs(BACKFILL_KEY, '1');
    try { console.debug('[ai-consent-cookie-guard] acceptance event — marker cookie written'); } catch (_) {}
  }

  function onConsentScrubbed(ev) {
    // Don't clobber our own scrub: only clear the cookie when scrubbed by
    // someone else (e.g. user-delete flow). Our cookie-clear scrub already
    // implies the cookie is absent.
    var reason = ev && ev.detail && ev.detail.reason;
    if (reason === 'cookie-clear') return;
    clearMarkerCookie();
    removeLs(BACKFILL_KEY);
    try { console.debug('[ai-consent-cookie-guard] consent scrubbed externally (reason=' + (reason || 'unknown') + '); clearing marker cookie'); } catch (_) {}
  }

  function onStorageChange(ev) {
    if (!ev) return;
    if (ev.key === 'aiDisclosureAccepted' && truthy(ev.newValue)) {
      onConsentAccepted();
    }
  }

  // ── Init ─────────────────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(runAtBoot, 0); }, { once: true });
  } else {
    setTimeout(runAtBoot, 0);
  }

  window.addEventListener('antcv:ai-disclosure-accepted', onConsentAccepted);
  window.addEventListener('antcv:ai-disclosure-local-scrubbed', onConsentScrubbed);
  window.addEventListener('storage', onStorageChange);

  window.AntcvAiConsentCookieGuard = {
    version: VERSION,
    _runAtBoot: runAtBoot,
    _scrubLocal: scrubLocalConsent,
    _scrubCloud: scrubCloudConsent,
    _startPersistentScrub: startPersistentScrub,
    _readMarkerCookie: readMarkerCookie,
    _writeMarkerCookie: writeMarkerCookie,
    _clearMarkerCookie: clearMarkerCookie
  };
  try { console.debug('[ai-consent-cookie-guard] installed ' + VERSION); } catch (_) {}
})();
