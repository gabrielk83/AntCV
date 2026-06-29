/* antcv-cl-cloud-sync-extra.js — CL-SIG-SLOGAN-CLOUD-001 (owner 2026-06-29)
 * ============================================================================
 * Cloud-sync the cover-letter SIGNATURE image + the editable SLOGAN, which live in
 * standalone (cloud-restore-safe) localStorage keys and were therefore LOCAL-ONLY —
 * every hard reset / new device needed a re-upload (owner report). Sister sidecar to
 * antcv-settings-sync-extra.js; same mechanism (push via the app's _antcvCloudWrite
 * auto-sync, restore via one guarded GET /api/prefs), with a key MAP because the
 * localStorage keys are `antcv:`-prefixed but the relay allowlists camelCase fields
 * (access-relay CL-SIG-SLOGAN-CLOUD-001 1.3.3).
 *
 *   localStorage key          relay preferences field
 *   antcv:signatureB64    <->  signatureB64       (processed PNG data-URL; small)
 *   antcv:signatureAlign  <->  signatureAlign
 *   antcv:signatureSize   <->  signatureSize      (numeric string; client coerces)
 *   antcv:signatureAspect <->  signatureAspect    (numeric string)
 *   antcv:signatureHidden <->  signatureHidden    ('1' | '0')
 *   antcv:clSlogan        <->  clSlogan
 *   antcv:clSloganHidden  <->  clSloganHidden      ('1' | '0')
 *   antcv:clSloganAlign   <->  clSloganAlign
 *
 * Push    : poll-diff every 4s + on tab-hide / pagehide -> _antcvCloudWrite(patch).
 * Restore : one GET after the app's own restore settles; applies a cloud value ONLY
 *           when the local key is MISSING (never clobbers a fresh local upload — takes
 *           effect on the next reload like the other restores), then pokes a re-render.
 * Guards  : signed-out / erase window -> no-op; seeds the baseline at boot so the
 *           initial state is never re-pushed.
 * Disable : localStorage['antcv:disable-cl-cloud-sync-extra'] = '1'.
 *
 * Values are stored RAW in localStorage (not JSON-stringified — that is how the
 * signature/slogan controls write them), so they are pushed and restored RAW.
 */
(function () {
  'use strict';
  if (window.__antcvClCloudSyncExtra) return;
  window.__antcvClCloudSyncExtra = '1.50.972';

  var DISABLE = 'antcv:disable-cl-cloud-sync-extra';
  // [ localStorage key, relay field ]
  var MAP = [
    ['antcv:signatureB64', 'signatureB64'],
    ['antcv:signatureAlign', 'signatureAlign'],
    ['antcv:signatureSize', 'signatureSize'],
    ['antcv:signatureAspect', 'signatureAspect'],
    ['antcv:signatureHidden', 'signatureHidden'],
    ['antcv:clSlogan', 'clSlogan'],
    ['antcv:clSloganHidden', 'clSloganHidden'],
    ['antcv:clSloganAlign', 'clSloganAlign'],
    ['antcv:clClosing', 'clClosing'],
  ];

  function disabled() { try { var v = localStorage.getItem(DISABLE); return v === '1' || v === 'true'; } catch (_) { return false; } }
  function erasing() { try { return !!(localStorage.getItem('antcv:full-erase-in-progress') || localStorage.getItem('antcv:just-erased')); } catch (_) { return false; } }
  function raw(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function relayUrl() {
    try {
      var v = JSON.parse(localStorage.getItem('proxyUrl') || '""') || '';
      v = String(v || '').replace(/\/+$/, '');
      if (!v && typeof window.ANTCV_RELAY_URL === 'string') v = String(window.ANTCV_RELAY_URL).replace(/\/+$/, '');
      return v;
    } catch (_) { return ''; }
  }

  // ── push: send only fields whose local value changed since last seen ──────────
  var lastSeen = {};
  function snapshot() { var o = {}; MAP.forEach(function (m) { o[m[0]] = raw(m[0]); }); return o; }
  function pushChanged() {
    if (disabled() || erasing()) return;
    if (typeof window._antcvCloudWrite !== 'function') return;
    if (!relayUrl()) return;
    var patch = {};
    MAP.forEach(function (m) {
      var lk = m[0], field = m[1], cur = raw(lk);
      if (cur != null && cur !== lastSeen[lk]) patch[field] = String(cur);
      lastSeen[lk] = cur;
    });
    if (Object.keys(patch).length) {
      try { window._antcvCloudWrite(patch); } catch (_) {}
      try { console.info('[cl-cloud-sync-extra] pushed:', Object.keys(patch).join(',')); } catch (_) {}
    }
  }

  // ── restore: one GET, apply only locally-missing fields ──────────────────────
  var restored = false;
  function applyAndNotify(applied) {
    if (!applied.length) return;
    try { console.info('[cl-cloud-sync-extra] restored from cloud:', applied.join(',')); } catch (_) {}
    try { window.dispatchEvent(new Event('storage')); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('antcv:signature-changed')); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'cl-cloud-sync-extra-restore' } })); } catch (_) {}
  }
  function restore() {
    if (restored || disabled() || erasing()) return;
    var base = relayUrl(); if (!base) return;
    restored = true;
    try {
      fetch(base + '/api/prefs', { method: 'GET', credentials: 'include' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          var prefs = j && j.prefs && typeof j.prefs === 'object' ? j.prefs : null;
          if (!prefs) return;
          var applied = [];
          MAP.forEach(function (m) {
            var lk = m[0], field = m[1], cloudVal = prefs[field];
            if (cloudVal === undefined || cloudVal === null) return;
            if (raw(lk) != null) return; // present locally -> don't clobber a local edit
            try { localStorage.setItem(lk, String(cloudVal)); applied.push(field); lastSeen[lk] = raw(lk); } catch (_) {}
          });
          applyAndNotify(applied);
        })
        .catch(function () { restored = false; });
    } catch (_) { restored = false; }
  }

  function boot() {
    lastSeen = snapshot();            // seed: never re-push the initial state
    setTimeout(restore, 2600);        // after the app's own cloud-restore settles
    setInterval(pushChanged, 4000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') pushChanged(); });
    window.addEventListener('pagehide', pushChanged);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  window.AntcvClCloudSyncExtra = { map: MAP, _push: pushChanged, _restore: function () { restored = false; restore(); } };
})();
