/* AntCV Application History — back returns to Preview (v1.40.341-p0e)
 * ============================================================
 *
 * AH-001 (LOCKED in plan §0)
 * --------------------------
 * "Open in Settings" from the Application History dropdown must:
 *   1. Dismiss the popup.
 *   2. Push a route to Set with Application History foregrounded.
 *   3. Move focus to the AH panel.
 *   4. Scroll AH into view.
 *
 * The history entry MUST be a `history.pushState` (NOT replace) so
 * browser-back resolves to Preview (the route the user opened the
 * popup from), not to a deeper Set state.
 *
 * Cooperation
 * -----------
 * `pwa/antcv-app-history-zfix-291.js` handles the z-index visibility
 * of the dropdown. This sidecar is orthogonal: it handles the
 * routing behaviour of the dropdown's primary action button.
 *
 * Implementation
 * --------------
 * 1. Identify the "Open in Settings" button by its text content
 *    plus its presence inside the Application History dropdown
 *    (zfix-291's bumped dropdown carries data-antcv-zfix-291-dropdown).
 * 2. Add a capture-phase click listener that:
 *    a. Records the originating route into sessionStorage as
 *       `antcv:ah:back-target` (default: 'preview').
 *    b. Calls history.pushState with a sentinel marker so popstate
 *       can recognise our entry on unwind.
 *    c. Allows the click to continue propagating so app.js's
 *       existing Settings navigation handler runs.
 * 3. Listen for popstate. When fired and the new state is NOT our
 *    sentinel (i.e., the user backed out of our entry), dispatch
 *    CustomEvent('antcv:navigate-to-preview') for app.js / other
 *    sidecars to react. Also try the existing route bus
 *    (window.AntcvRoute, if exposed) as a best-effort.
 * 4. After the click, schedule focus + scrollIntoView on the AH
 *    panel root once it appears in the DOM (MutationObserver
 *    short-window, max 1500 ms).
 *
 * Hazards
 * -------
 * - sessionStorage may be unavailable (incognito, quota); guarded.
 * - Multiple Open-in-Settings clicks in quick succession: each
 *   pushes its own history entry, each unwinds back to Preview
 *   on its own back press. Idempotent.
 * - The sentinel state shape:
 *     { antcvAhPushedAt: <ts>, route: 'set', panel: 'applicationHistory' }
 *   App.js's own popstate handler (if any) sees a normal state
 *   object — we don't break its parsing.
 */
(function () {
  'use strict';

  var SCRIPT_VERSION = '1.40.341-p0e';
  if (window.__antcvAppHistoryBackToPreview341 === SCRIPT_VERSION) return;
  window.__antcvAppHistoryBackToPreview341 = SCRIPT_VERSION;

  var SS_KEY = 'antcv:ah:back-target';

  function readSS(key, fallback) {
    try {
      var v = sessionStorage.getItem(key);
      return v == null ? fallback : v;
    } catch (_) { return fallback; }
  }
  function writeSS(key, val) {
    try { sessionStorage.setItem(key, String(val)); } catch (_) {}
  }
  function deleteSS(key) {
    try { sessionStorage.removeItem(key); } catch (_) {}
  }

  function isOpenInSettingsButton(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.tagName !== 'BUTTON' && el.tagName !== 'A') return false;
    var t = (el.textContent || '').replace(/[\t\n\r ]+/g, ' ').trim().toLowerCase();
    // Match the English label + a few obvious localisations. The
    // text comes from app.js; if a future locale uses a different
    // string we may miss it — fallback below catches a data-marker.
    if (t.indexOf('open in settings') >= 0) return true;
    if (t.indexOf('åbn i indstillinger') >= 0) return true;
    if (t.indexOf('abrir en ajustes') >= 0) return true;
    if (t.indexOf('在设置中打开') >= 0) return true;
    if (el.getAttribute && el.getAttribute('data-antcv-open-in-settings') === '1') return true;
    return false;
  }

  function detectCurrentRoute() {
    // Best-effort: read window.AntcvRoute or hash. Falls back to
    // 'preview' (the typical route the user opens AH from).
    try {
      if (window.AntcvRoute && typeof window.AntcvRoute.current === 'function') {
        var r = window.AntcvRoute.current();
        if (r) return String(r);
      }
    } catch (_) {}
    try {
      var hash = (location.hash || '').replace(/^#/, '').toLowerCase();
      if (hash === 'preview' || hash === 'set' || hash === 'settings') return hash;
    } catch (_) {}
    try {
      var p = (location.pathname || '').toLowerCase();
      if (p.indexOf('/set') >= 0 || p.indexOf('/settings') >= 0) return 'set';
    } catch (_) {}
    return 'preview';
  }

  function focusAhPanel() {
    var deadline = Date.now() + 1500;
    var attempted = false;
    var tryFocus = function () {
      var candidates = [
        '[data-antcv-application-history-panel]',
        '[data-application-history]',
        '#applicationHistory',
        '[aria-label="Application history" i]',
        '[aria-label="Application History" i]',
      ];
      for (var i = 0; i < candidates.length; i++) {
        var el = document.querySelector(candidates[i]);
        if (!el) continue;
        try {
          if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
          el.focus({ preventScroll: false });
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          attempted = true;
        } catch (_) {}
        return true;
      }
      return false;
    };
    if (tryFocus()) return;
    var mo;
    try {
      mo = new MutationObserver(function () {
        if (tryFocus() || Date.now() > deadline) {
          try { mo.disconnect(); } catch (_) {}
        }
      });
      mo.observe(document.body || document.documentElement, {
        childList: true, subtree: true,
      });
    } catch (_) {}
    setTimeout(function () { try { mo && mo.disconnect(); } catch (_) {}; if (!attempted) tryFocus(); }, 1500);
  }

  function pushHistoryEntry() {
    try {
      var prev = detectCurrentRoute();
      // Record the back target so popstate knows where to return.
      writeSS(SS_KEY, prev || 'preview');
      var state = {
        antcvAhPushedAt: Date.now(),
        route: 'set',
        panel: 'applicationHistory',
      };
      // Use a hash so the URL is meaningful but the History API
      // entry is the actual mechanism (some browsers coalesce
      // identical-URL pushes; the unique antcvAhPushedAt prevents
      // that).
      var url = (location.pathname || '/') + '#applicationHistory';
      history.pushState(state, '', url);
    } catch (e) {
      try { console.warn('[app-history-back-to-preview] pushState failed:', e && e.message); } catch (_) {}
    }
  }

  function onOpenInSettingsClick(ev) {
    var t = ev.target;
    if (!t || !t.closest) return;
    var btn = t.closest('button, a');
    if (!btn) return;
    if (!isOpenInSettingsButton(btn)) return;
    // Capture phase — fire BEFORE app.js's onClick. The pushState
    // call is synchronous; we do not preventDefault or stopProp so
    // app.js's handler still runs and navigates to Settings.
    pushHistoryEntry();
    // Schedule the focus + scroll once the AH panel appears.
    setTimeout(focusAhPanel, 50);
  }

  function onPopState(ev) {
    var backTarget = readSS(SS_KEY, '');
    if (!backTarget) return;
    var st = ev && ev.state;
    var stillOnAh = !!(st && typeof st === 'object' && st.panel === 'applicationHistory');
    if (stillOnAh) return; // popstate from a deeper push; ignore.
    // We just popped OUT of our pushed entry. The browser is now
    // on the route that preceded our push (typically Preview).
    deleteSS(SS_KEY);
    // Best-effort: tell app.js / other sidecars to render Preview.
    try {
      window.dispatchEvent(new CustomEvent('antcv:navigate-to-preview', {
        detail: { source: 'app-history-back-to-preview-341', via: 'popstate' },
      }));
    } catch (_) {}
    // Also try window.AntcvRoute.go if exposed (some bundles expose it).
    try {
      if (window.AntcvRoute && typeof window.AntcvRoute.go === 'function') {
        window.AntcvRoute.go(backTarget);
      }
    } catch (_) {}
  }

  function install() {
    document.addEventListener('click', onOpenInSettingsClick, true);
    window.addEventListener('popstate', onPopState, false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }

  window.AntcvAppHistoryBackToPreview341 = {
    version: SCRIPT_VERSION,
    _focusAhPanel: focusAhPanel,
    _detectCurrentRoute: detectCurrentRoute,
  };

  try { console.debug('[app-history-back-to-preview] installed v' + SCRIPT_VERSION); } catch (_) {}
})();
