/* antcv-settings-sync-extra.js — SETTINGS-SYNC-EXTRA-001 (owner 2026-06-18)
 * ============================================================================
 * Cloud-syncs 6 standalone settings keys the main app.js sl()/restore path does
 * NOT cover, so they were previously local-only (lost on a new device):
 *   photoPosition, photoSize, exportPwEnabled,
 *   enabledProviders, customTopbarPalette, topbarOrder
 *
 * Why a sidecar (not app.src.js): the gap needs a SEND path (sl serializer) AND
 * a RESTORE path (the per-key cold-start apply + the Load button) — adding all
 * three across app.src.js + the minified app.js mirror is exactly the surgery
 * CLAUDE.md flags as bluescreen-prone. This sidecar rides the EXISTING
 * window._antcvCloudWrite auto-sync (the relay now allowlists these keys —
 * access-relay SETTINGS-SYNC-EXTRA-001) for push, and a single guarded GET
 * /api/prefs for restore.
 *
 * Push    : poll-diff every 4s + on tab-hide / pagehide -> _antcvCloudWrite.
 * Restore : one GET after the app's own restore settles; applies a cloud value
 *           ONLY when the key is MISSING locally, so it never clobbers a local
 *           edit (takes visual effect on the next reload, like other restores).
 * Guards  : signed-out (no relay URL) -> no-op; erase window -> no-op; seeds the
 *           baseline at boot so the initial state is never re-pushed.
 * Disable : localStorage['antcv:disable-settings-sync-extra'] = '1'.
 */
(function () {
  'use strict';
  if (window.__antcvSettingsSyncExtra) return;
  window.__antcvSettingsSyncExtra = '1.50.629';

  var DISABLE = 'antcv:disable-settings-sync-extra';
  var KEYS = ['photoPosition', 'photoSize', 'exportPwEnabled', 'enabledProviders', 'customTopbarPalette', 'topbarOrder'];

  function disabled() { try { var v = localStorage.getItem(DISABLE); return v === '1' || v === 'true'; } catch (_) { return false; } }
  function erasing() { try { return !!(localStorage.getItem('antcv:full-erase-in-progress') || localStorage.getItem('antcv:just-erased')); } catch (_) { return false; } }
  function raw(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function parse(k) { var r = raw(k); if (r == null) return undefined; try { return JSON.parse(r); } catch (_) { return r; } }
  function relayUrl() {
    try {
      var v = JSON.parse(localStorage.getItem('proxyUrl') || '""') || '';
      v = String(v || '').replace(/\/+$/, '');
      if (!v && typeof window.ANTCV_RELAY_URL === 'string') v = String(window.ANTCV_RELAY_URL).replace(/\/+$/, '');
      return v;
    } catch (_) { return ''; }
  }

  // ── push: send only keys that changed since last seen ──────────────────────
  var lastSeen = {};
  function snapshot() { var o = {}; KEYS.forEach(function (k) { o[k] = raw(k); }); return o; }
  function pushChanged() {
    if (disabled() || erasing()) return;
    if (typeof window._antcvCloudWrite !== 'function') return;
    if (!relayUrl()) return;
    var patch = {};
    KEYS.forEach(function (k) {
      var cur = raw(k);
      if (cur != null && cur !== lastSeen[k]) { var v = parse(k); if (v !== undefined) patch[k] = v; }
      lastSeen[k] = cur;
    });
    if (Object.keys(patch).length) {
      try { window._antcvCloudWrite(patch); } catch (_) {}
      try { console.info('[settings-sync-extra] pushed:', Object.keys(patch).join(',')); } catch (_) {}
    }
  }

  // ── restore: one GET, apply only locally-missing keys ──────────────────────
  var restored = false;
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
          KEYS.forEach(function (k) {
            if (prefs[k] === undefined || prefs[k] === null) return;
            if (raw(k) != null) return; // present locally -> don't clobber a local edit
            try { localStorage.setItem(k, JSON.stringify(prefs[k])); applied.push(k); lastSeen[k] = raw(k); } catch (_) {}
          });
          if (applied.length) {
            try { console.info('[settings-sync-extra] restored from cloud:', applied.join(',')); } catch (_) {}
            try { window.dispatchEvent(new Event('storage')); } catch (_) {}
          }
        })
        .catch(function () { restored = false; });
    } catch (_) { restored = false; }
  }

  function boot() {
    lastSeen = snapshot();            // seed: never push the initial state
    setTimeout(restore, 2500);        // after the app's own cloud-restore settles
    setInterval(pushChanged, 4000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') pushChanged(); });
    window.addEventListener('pagehide', pushChanged);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  window.AntcvSettingsSyncExtra = { keys: KEYS, _push: pushChanged, _restore: function () { restored = false; restore(); } };
})();
