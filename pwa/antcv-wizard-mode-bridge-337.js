// antcv-wizard-mode-bridge-337.js
//
// Bridges the wizard's En selection ("demo" / "own" / "byok") to the relay's
// /api/user/mode endpoint, so the relay routes uploads to cv-proxy (paid) or
// antcv-demo-proxy (demo) based on the user's choice.
//
// Wire-up:
//   - app.js calls window.AntcvSetUserMode("demo" | "paid") immediately after
//     each of the three Rn(...) state setters in the wizard step-1 handlers.
//   - This file does the actual fetch. Dedupes against last-sent value so
//     re-clicks within the wizard don't multiply KV writes on the relay.
//   - fire-and-forget; failure is logged but does NOT block the wizard.
//
// Source of truth: relay KV (prefs2:<hash>.mode). PWA local state remains
// untouched here — the wizard's own logic (Rn / En / useChatGPT) still
// controls watermarks and UI flow. Reconciling local <-> relay on sign-in
// is a separate concern (Phase 2; not in this file).
//
// Escape hatch: localStorage['antcv:disable-wizard-mode-bridge'] = '1'.

(function(){
  'use strict';

  if (window.AntcvSetUserMode) {
    // Already installed (hot reload, double-script, …). Don't redefine.
    return;
  }

  var TAG = '[wizard-mode-bridge-337]';
  var lastSent = null;

  function disabled() {
    try {
      return localStorage.getItem('antcv:disable-wizard-mode-bridge') === '1';
    } catch (_) { return false; }
  }

  function getRelayUrl() {
    // Same precedence chain the rest of the PWA uses.
    if (typeof window.ANTCV_RELAY_URL === 'string' && window.ANTCV_RELAY_URL) {
      return window.ANTCV_RELAY_URL.replace(/\/+$/, '');
    }
    try {
      var p = localStorage.getItem('proxyUrl') || '';
      if (p.charAt(0) === '"' && p.charAt(p.length - 1) === '"') p = p.slice(1, -1);
      p = (p || '').replace(/\/+$/, '');
      if (p) return p;
    } catch (_) {}
    return null;
  }

  function signedIn() {
    try {
      return !!(window.AntcvAuth &&
                window.AntcvAuth.getSignedInUser &&
                window.AntcvAuth.getSignedInUser());
    } catch (_) { return false; }
  }

  /**
   * Persist the user's mode preference on the relay.
   * @param {string} mode - "demo" or "paid"
   * @returns {Promise<void>}  (always resolves; errors are logged)
   */
  window.AntcvSetUserMode = function(mode) {
    if (disabled()) {
      console.log(TAG, 'disabled via localStorage flag');
      return Promise.resolve();
    }
    if (mode !== 'demo' && mode !== 'paid') {
      console.warn(TAG, 'ignored invalid mode:', mode);
      return Promise.resolve();
    }
    if (mode === lastSent) {
      console.log(TAG, 'dedupe — same as last sent:', mode);
      return Promise.resolve();
    }
    if (!signedIn()) {
      // The wizard CAN be open before sign-in, but the relay refuses
      // unauthenticated POSTs and we can't write KV without a JWT. Just
      // log and skip; the user will hit this code path again post-sign-in.
      console.log(TAG, 'not signed in yet — skipping POST for mode:', mode);
      return Promise.resolve();
    }
    var base = getRelayUrl();
    if (!base) {
      console.warn(TAG, 'no relay URL available; cannot POST mode');
      return Promise.resolve();
    }

    // Fire-and-forget. antcv-auth.js wraps window.fetch and injects the
    // Authorization header automatically, so we do NOT pass one here.
    return fetch(base + '/api/user/mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: mode }),
    }).then(function(r) {
      if (r.ok) {
        lastSent = mode;
        console.log(TAG, 'mode persisted on relay:', mode);
      } else {
        console.warn(TAG, 'relay rejected mode POST:', r.status);
      }
    }).catch(function(e) {
      console.warn(TAG, 'mode POST threw:', e && e.message ? e.message : e);
    });
  };

  console.log(TAG, 'installed window.AntcvSetUserMode');
})();
