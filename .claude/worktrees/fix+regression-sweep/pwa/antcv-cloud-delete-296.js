/* AntCV cloud DELETE on user-delete (v1.40.296)
 * ============================================================
 *
 * Problem
 * ───────
 *   When the user clicks "Disagree & Delete user", the existing
 *   flow (deleteUserFully in antcv-onboarding.js, line 555) does:
 *     1. mark sessionStorage.antcv:ai-disclosure-declined-delete
 *     2. call window.AntcvFullErase() if defined,
 *     3. else call window.AntcvAuth.signOut(),
 *     4. else localStorage.clear() + sessionStorage.clear() + reload.
 *
 *   None of those steps wipe the cloud copy at /api/prefs.
 *   antcv-cloud-put-shrink-guard-289 (correctly) refuses to forward
 *   empty-personalInfo PUTs to prevent accidental cloud wipes,
 *   so a PUT after the local clear cannot overwrite the cloud
 *   either. Result: next sign-in's cloud-restore brings back the
 *   old personalInfo (with wizardCompleted=true and identity
 *   fields) and the user appears un-deleted.
 *
 *   The header comment of antcv-onboarding.js line 61 documents
 *   the intended behaviour: "On delete user: AntcvFullErase +
 *   relay DELETE wipe both." This sidecar supplies the relay
 *   DELETE half.
 *
 * What this sidecar does
 * ──────────────────────
 *   Intercepts the deletion entry points and fires
 *   DELETE <relay>/api/prefs BEFORE the local erase + reload.
 *
 *   Three layered hooks (all install at boot; whichever fires
 *   first wins, the others see __antcv_deleted and skip):
 *
 *     A. Wraps window.AntcvFullErase. If not defined yet, polls
 *        every 200 ms for up to 30 s. Once defined, replaces it
 *        with an async wrapper that does DELETE first, then
 *        calls the original.
 *
 *     B. Wraps window.AntcvAuth.signOut similarly. signOut is the
 *        fallback the onboarding deletion calls when AntcvFullErase
 *        is absent. We only wrap signOut if it's invoked from
 *        a "delete user" context, detected by the sessionStorage
 *        marker antcv:ai-disclosure-declined-delete being set
 *        within the last 5 seconds (the onboarding writes it
 *        synchronously immediately before calling signOut). For
 *        normal sign-out flows we leave signOut alone — DELETE
 *        is wrong there.
 *
 *     C. Wraps window.AntcvOnboarding.deleteUser if exposed.
 *        Same approach: DELETE first, then the original.
 *
 *   Also exposes window.AntcvCloudDelete() as a public API for
 *   manual use (e.g. console testing).
 *
 * Coordination with other sidecars
 * ─────────────────────────────────
 *   Sets sessionStorage.antcv:just-erased = Date.now() BEFORE
 *   the DELETE fetch so:
 *     - antcv-cloud-put-shrink-guard-289 sees the marker (it
 *       doesn't currently, but if we add reading later it'll
 *       work),
 *     - antcv-wizard-fix.js v1.40.296 G4 path catches it for
 *       same-session post-delete state,
 *     - antcv-onboarding.js's existing post-delete UX flow
 *       (lines 1473-1791) activates correctly.
 *
 * Worker-side requirement
 * ───────────────────────
 *   This sidecar assumes the relay worker implements
 *     DELETE /api/prefs
 *   that deletes the authenticated user's entire prefs record.
 *   If the worker returns 404 / 405 / other non-2xx, the sidecar
 *   logs a warning but still proceeds with local erase. So:
 *     - If the worker DOES implement DELETE, deletion is
 *       end-to-end.
 *     - If the worker does NOT, behaviour is unchanged from
 *       v1.40.295: local clears but cloud persists. The v296
 *       wizard-fix guards still compensate so the user isn't
 *       trapped — they just need to know cloud is stale.
 *
 * Escape hatch
 * ────────────
 *   localStorage.antcv:disable-cloud-delete = "1" → skip the
 *   DELETE call and behave like v1.40.295.
 */
(function () {
  'use strict';

  var VERSION = '1.40.308';
  var POLL_INTERVAL_MS = 200;
  var POLL_TIMEOUT_MS  = 30 * 1000;
  var DELETE_TIMEOUT_MS = 8 * 1000;   // give the worker 8s to respond
  var DELETE_INTENT_TTL_MS = 5 * 1000;
  var POST_DELETE_MARKER = 'antcv:just-erased';
  var DELETE_INTENT_MARKER = 'antcv:ai-disclosure-declined-delete';
  var DISABLE_KEY = 'antcv:disable-cloud-delete';

  if (window.__antcvCloudDelete296 === VERSION) return;
  window.__antcvCloudDelete296 = VERSION;

  // ── relay base URL discovery ───────────────────────────────
  // Mirrors the pattern used by antcv-ai-consent-cloud-sync-224.js's
  // relay() helper so we discover the URL the same way the rest of
  // the deploy does, instead of hardcoding.

  function readUrlKey(k) {
    try {
      var v = localStorage.getItem(k) || '';
      if (v && v.charAt(0) === '"') {
        try { v = JSON.parse(v); } catch (_) {}
      }
      return String(v || '').trim().replace(/\/+$/, '');
    } catch (_) { return ''; }
  }
  function relayBase() {
    var v = readUrlKey('proxyUrl') || readUrlKey('relayUrl');
    if (!v && typeof window.ANTCV_RELAY_URL === 'string') {
      v = String(window.ANTCV_RELAY_URL || '').replace(/\/+$/, '');
    }
    return v;
  }

  function disabled() {
    try {
      var raw = localStorage.getItem(DISABLE_KEY);
      return raw === '1' || raw === 'true';
    } catch (_) { return false; }
  }

  function setPostDeleteMarker() {
    try { sessionStorage.setItem(POST_DELETE_MARKER, String(Date.now())); } catch (_) {}
    // v1.40.302 — also set a cookie. sessionStorage gets wiped by
    // localStorage.clear() + sessionStorage.clear() in the fallback
    // deletion path AND would not survive a same-tab Google OAuth
    // round-trip with a hard reload. Cookies survive both. Read by
    // antcv-cloud-restore-filter and antcv-wizard-startup-clear so
    // that on the next sign-in, wizardCompleted is treated as stale
    // regardless of what the cloud returns (the worker-side DELETE
    // /api/prefs handler hasn't shipped, so the cloud still has the
    // old data with content arrays — the v298 filter's hasContent
    // check therefore wouldn't strip wizardCompleted without this
    // cookie signal). 24 h max-age covers normal delete→re-login
    // gaps; the receiving sidecars also clear it once acted on.
    try {
      document.cookie = 'antcv-just-deleted=' + encodeURIComponent(String(Date.now())) +
        '; max-age=86400; path=/; samesite=lax';
    } catch (_) {}
  }

  function deleteIntentRecent() {
    try {
      var raw = sessionStorage.getItem(DELETE_INTENT_MARKER);
      if (!raw) return false;
      var ts = parseInt(raw, 10);
      if (!ts) return false;
      return (Date.now() - ts) < DELETE_INTENT_TTL_MS;
    } catch (_) { return false; }
  }

  // ── the DELETE call itself ──────────────────────────────────

  function cloudDelete() {
    if (disabled()) {
      console.info('[antcv-cloud-delete-296] disabled via ' + DISABLE_KEY + ', skipping DELETE');
      return Promise.resolve({ ok: false, skipped: true });
    }
    var base = relayBase();
    if (!base) {
      console.warn('[antcv-cloud-delete-296] no relay base URL configured, cannot fire DELETE');
      return Promise.resolve({ ok: false, error: 'no relay base' });
    }
    var url = base + '/api/prefs';

    // Race against a timeout so a stuck worker can't block the local
    // erase + reload that follows. Eight seconds is generous for an
    // edge worker call; the deletion UI is non-blocking anyway.
    var ctrl = null;
    try { ctrl = (typeof AbortController === 'function') ? new AbortController() : null; } catch (_) {}
    var t = setTimeout(function () {
      if (ctrl) try { ctrl.abort(); } catch (_) {}
    }, DELETE_TIMEOUT_MS);

    var init = { method: 'DELETE', credentials: 'include' };
    if (ctrl) init.signal = ctrl.signal;

    console.info('[antcv-cloud-delete-296] DELETE ' + url);
    return fetch(url, init)
      .then(function (resp) {
        clearTimeout(t);
        if (resp.ok) {
          console.info('[antcv-cloud-delete-296] DELETE ok (' + resp.status + ')');
          return { ok: true, status: resp.status };
        }
        console.warn('[antcv-cloud-delete-296] DELETE non-2xx (' + resp.status + '). If the worker does not implement DELETE /api/prefs, add it server-side.');
        return { ok: false, status: resp.status };
      })
      .catch(function (err) {
        clearTimeout(t);
        console.warn('[antcv-cloud-delete-296] DELETE failed:', err && err.message);
        return { ok: false, error: String(err && err.message) };
      });
  }

  // Public API
  window.AntcvCloudDelete = cloudDelete;

  // ── Wrap layer A: window.AntcvFullErase ─────────────────────

  var fullEraseInstalledAt = null;

  function wrapFullErase() {
    var orig = window.AntcvFullErase;
    if (typeof orig !== 'function') return false;
    if (orig.__antcv_cloud_delete_wrapped === VERSION) return true;
    var wrapped = function () {
      var args = arguments;
      var self = this;
      setPostDeleteMarker();
      // Fire DELETE; only wait if the network is fast enough.
      // We don't block on it indefinitely — local erase proceeds either way.
      // Practically, AntcvFullErase typically reloads or signs out
      // synchronously, but is safe to call async too.
      return Promise.resolve(cloudDelete())
        .catch(function () { /* ignore — local erase still runs */ })
        .then(function () {
          try { return orig.apply(self, args); }
          catch (e) {
            console.warn('[antcv-cloud-delete-296] original AntcvFullErase threw:', e && e.message);
          }
        });
    };
    wrapped.__antcv_cloud_delete_wrapped = VERSION;
    window.AntcvFullErase = wrapped;
    fullEraseInstalledAt = Date.now();
    console.info('[antcv-cloud-delete-296] wrapped window.AntcvFullErase');
    return true;
  }

  // ── Wrap layer B: window.AntcvAuth.signOut ──────────────────
  // We only DELETE when signOut is being called in a "delete user"
  // context (intent marker set by the onboarding within the last
  // few seconds). Normal sign-out → no DELETE.

  function wrapSignOut() {
    var auth = window.AntcvAuth;
    if (!auth || typeof auth.signOut !== 'function') return false;
    var orig = auth.signOut;
    if (orig.__antcv_cloud_delete_wrapped === VERSION) return true;
    var wrapped = function () {
      var args = arguments;
      var self = this;
      if (deleteIntentRecent()) {
        setPostDeleteMarker();
        return Promise.resolve(cloudDelete())
          .catch(function () {})
          .then(function () {
            try { return orig.apply(self, args); }
            catch (e) {
              console.warn('[antcv-cloud-delete-296] original signOut threw:', e && e.message);
            }
          });
      }
      return orig.apply(self, args);
    };
    wrapped.__antcv_cloud_delete_wrapped = VERSION;
    auth.signOut = wrapped;
    console.info('[antcv-cloud-delete-296] wrapped window.AntcvAuth.signOut');
    return true;
  }

  // ── Wrap layer C: REMOVED in v1.40.308 ─────────────────────
  // window.AntcvOnboarding was retired with antcv-onboarding.js in
  // v1.40.303. The wrapOnboardingDeleteUser layer never had a target
  // after that. Kept as a no-op stub so any external caller that
  // still references it via the debug API (early-303 code) doesn't
  // crash; just logs once and returns true to satisfy old callers.

  var _legacyDeleteUserNoopLogged = false;
  function wrapOnboardingDeleteUser() {
    if (!_legacyDeleteUserNoopLogged) {
      _legacyDeleteUserNoopLogged = true;
      try {
        console.debug('[antcv-cloud-delete-296] wrapOnboardingDeleteUser is a no-op since v1.40.308 (target removed in v1.40.303).');
      } catch (_) {}
    }
    return true;
  }

  // ── Boot: try all three wraps, then poll until each succeeds
  //         or the poll timeout expires ─────────────────────────

  function tryAllWraps() {
    var a = wrapFullErase();
    var b = wrapSignOut();
    // v1.40.308: layer C (window.AntcvOnboarding.deleteUser) removed.
    // window.AntcvOnboarding was a separate file (antcv-onboarding.js)
    // retired in v1.40.303 when its wizard was folded into app.js. The
    // poll for AntcvOnboarding.deleteUser therefore always timed out, and
    // the resulting `deleteUser: false` line in the timeout log was just
    // noise. Polling now succeeds when both extant layers are wrapped.
    return a && b;
  }

  function bootPoll() {
    if (tryAllWraps()) return;
    var startedAt = Date.now();
    var iv = setInterval(function () {
      var allDone = tryAllWraps();
      if (allDone || (Date.now() - startedAt) > POLL_TIMEOUT_MS) {
        clearInterval(iv);
        if (!allDone) {
          var status = {
            fullErase: typeof window.AntcvFullErase === 'function'
              && window.AntcvFullErase.__antcv_cloud_delete_wrapped === VERSION,
            signOut:   !!(window.AntcvAuth && window.AntcvAuth.signOut
              && window.AntcvAuth.signOut.__antcv_cloud_delete_wrapped === VERSION),
          };
          console.info('[antcv-cloud-delete-296] poll timeout; wrap status:', status);
        }
      }
    }, POLL_INTERVAL_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootPoll);
  } else {
    setTimeout(bootPoll, 0);
  }

  // Debug API
  window.AntcvCloudDelete296 = {
    version: VERSION,
    cloudDelete: cloudDelete,
    relayBase: relayBase,
    _wrapFullErase: wrapFullErase,
    _wrapSignOut:   wrapSignOut,
    _disabled: disabled,
    _deleteIntentRecent: deleteIntentRecent,
  };
})();
