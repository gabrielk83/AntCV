/* antcv-multitab-signout-sync.js — MULTITAB-SIGNOUT-001 (owner 2026-06-22)
 * ============================================================================
 * localStorage is shared across all same-origin tabs, so when one tab SIGNS OUT
 * or DELETES the account (both clear the auth token / all of localStorage), the
 * OTHER open tabs keep their in-memory session and their autosave RE-WRITES +
 * re-syncs the data within seconds — defeating the sign-out/delete (a security
 * gap: a "deleted" account's data reappears because another tab put it back).
 *
 * Fix: every tab listens for the cross-tab `storage` event. When another tab
 *   - CLEARS localStorage (delete → event.key === null), or
 *   - removes the auth token (sign-out → key 'antcv:auth:token' → null),
 * this tab immediately drops its own auth and reloads to the login screen — so
 * ALL tabs sign out together and none re-syncs stale data. A refreshed tab also
 * naturally picks up the signed-out shared state on boot. Belt-and-suspenders:
 * a BroadcastChannel mirror for the explicit sign-out path.
 *
 * Idempotent install; kill switch antcv:disable-multitab-signout. Self-disabling.
 */
(function () {
  'use strict';
  var VERSION = '1.50.785';
  if (window.__antcvMultitabSignout) return;
  window.__antcvMultitabSignout = VERSION;
  try { var off = localStorage.getItem('antcv:disable-multitab-signout'); if (off === '1' || off === 'true') return; } catch (_) {}

  var AUTH_TOKEN = 'antcv:auth:token';
  var reacting = false;

  function dropAndReload(reason) {
    if (reacting) return;
    reacting = true;
    try {
      // clear our own auth so the reload lands on the login screen (never re-auth from a stale token)
      localStorage.removeItem(AUTH_TOKEN);
      localStorage.removeItem('antcv:auth:email');
      localStorage.removeItem('antcv:auth:expires_at');
      localStorage.removeItem('session');
    } catch (_) {}
    try { console.info('[multitab-signout] another tab ' + reason + ' — this tab signs out too'); } catch (_) {}
    try { location.reload(); } catch (_) {}
  }

  // Cross-tab via the storage event (fires in OTHER tabs only).
  window.addEventListener('storage', function (e) {
    try {
      if (!e) return;
      if (e.key === null) { dropAndReload('cleared all storage (delete)'); return; }          // localStorage.clear()
      if (e.key === AUTH_TOKEN && (e.newValue == null || e.newValue === '')) { dropAndReload('signed out'); return; }
    } catch (_) {}
  });

  // BroadcastChannel mirror (explicit signal, in case a sign-out path doesn't touch localStorage).
  var bc = null;
  try {
    if (typeof BroadcastChannel === 'function') {
      bc = new BroadcastChannel('antcv-auth');
      bc.onmessage = function (ev) { try { if (ev && ev.data && ev.data.type === 'signout') dropAndReload('broadcast sign-out'); } catch (_) {} };
    }
  } catch (_) {}

  // Expose a helper so a sign-out/delete handler can ALSO announce explicitly (optional).
  window.AntcvBroadcastSignout = function () { try { if (bc) bc.postMessage({ type: 'signout', at: 0 }); } catch (_) {} };

  window.AntcvMultitabSignout = { version: VERSION };
})();
