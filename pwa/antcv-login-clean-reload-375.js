/* AntCV login clean-reload (v1.50.346)
 * ============================================================================
 * Owner 2026-06-10: after a hard reset + sign-in, a PAID user still sees the
 * demo / "⚠ Setup needed" notices AND the previous application/user's
 * specialisation headline (e.g. Gabriel sees Anita's last headline). Both only
 * clear after a manual browser refresh.
 *
 * Root cause
 * ----------
 * sign-OUT reloads the page (antcv-auth.js signOut → location.reload /
 * AntcvHardReset), so it starts clean. sign-IN does NOT — signInWithGoogle /
 * email-OTP just write the auth state and the app transitions to the editor in
 * the SAME page instance. React state + cached /config from the prior session
 * survive, so demo/setup gating and the candidate subtitle render stale until
 * the user manually refreshes (which is exactly what fixes it).
 *
 * Fix
 * ---
 * Automate that one refresh: when a NEW non-empty auth email appears DURING the
 * page's lifetime (a real login or user-switch — not the already-logged-in
 * state at load), do a single clean reload. The reloaded page re-initialises
 * everything from the new user's restored data, so the stale notices and the
 * stale subtitle are gone with no manual step.
 *
 * Loop safety
 * -----------
 *   - The email present at sidecar load is the BASELINE and never triggers a
 *     reload (so opening an already-logged-in tab does nothing).
 *   - A per-email sessionStorage marker prevents a second reload for the same
 *     login. After the reload the new email IS the baseline, so it can't
 *     re-fire. A different email (user switch) reloads once more.
 *   - Signing out (email → '') resets the baseline; antcv-auth also clears
 *     sessionStorage on signOut, so a later re-login reloads cleanly.
 *   - Escape hatch: localStorage['antcv:disable-login-reload'] = '1'.
 * ============================================================================
 */
(function () {
  'use strict';
  var VERSION = '1.50.346-login-clean-reload';
  if (window.__antcvLoginCleanReload === VERSION) return;
  window.__antcvLoginCleanReload = VERSION;

  try {
    var d = localStorage.getItem('antcv:disable-login-reload');
    if (d === '1' || d === 'true') return;
  } catch (_) {}

  var MARKER = 'antcv:login-reload-for';
  var primed = false;
  var seen = '';

  // Indirection so a headless test can spy on the reload without navigating.
  function doReload() {
    try { window.__antcvReloadTag = 'login-clean-reload-375'; } catch (_) {}
    try { window.location.reload(); } catch (_) {}
  }

  // RELOAD-SPURIOUS-GUARD-001 (owner 2026-06-13): the reset recurred on
  // subtab-scroll-end and topbar-language clicks — interactions that fire
  // cloud writes, which can re-emit the auth state. An A→B "user switch"
  // without an intervening signed-out ('') state is therefore almost always
  // a spurious re-emit, NOT a real user switch. Only reload on a genuine
  // signed-out → signed-in transition (seen === ''). This keeps the one
  // legitimate case (fresh login after load/sign-out) and removes the
  // spurious-reload surface entirely.
  function handle(state) {
    var email = (state && state.email) || '';
    if (!primed) { primed = true; seen = email; return; } // baseline, never reload
    if (!email) { seen = ''; return; }                    // signed out → reset baseline
    if (email === seen) return;                           // no real change
    if (seen !== '') {                                    // A→B without sign-out = spurious re-emit
      try { console.debug('[login-clean-reload-375] ignoring email re-emit', seen, '→', email, '(no intervening sign-out) — not reloading'); } catch (_) {}
      seen = email;
      return;
    }
    var done;
    try { done = sessionStorage.getItem(MARKER); } catch (_) { done = null; }
    if (done === email) { seen = email; return; }         // already reloaded for this login
    try { sessionStorage.setItem(MARKER, email); } catch (_) {}
    seen = email;
    try { console.debug('[login-clean-reload-375] fresh login →', email, '— reloading once for a clean start'); } catch (_) {}
    window.AntcvLoginCleanReload._doReload();
  }

  function attach() {
    if (window.AntcvAuth && typeof window.AntcvAuth.subscribe === 'function') {
      try { window.AntcvAuth.subscribe(handle); return true; } catch (_) {}
    }
    return false;
  }

  // AntcvAuth may not be ready when this sidecar runs; retry briefly.
  if (!attach()) {
    var tries = 0;
    var iv = setInterval(function () {
      if (attach() || ++tries > 40) clearInterval(iv);
    }, 120);
  }

  window.AntcvLoginCleanReload = {
    version: VERSION,
    _doReload: doReload,        // overridable for tests
    _handle: handle,            // exposed for tests
    _state: function () { return { primed: primed, seen: seen }; },
  };
  try { console.debug('[login-clean-reload-375] installed v' + VERSION); } catch (_) {}
})();
