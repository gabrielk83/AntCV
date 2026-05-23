/* AntCV hide GSI-rendered Google button sidecar (v1.40.154)
 * ============================================================
 *
 * Symptom (Entry_jump video)
 * ----------------------------
 * The landing page shows TWO Google sign-in buttons stacked:
 *
 *   ┌──────────────────────────────────┐
 *   │   Sign in with Google            │   ← AntCV custom (teal)
 *   └──────────────────────────────────┘
 *   ┌──────────────────────────────────┐
 *   │ G  Log ind med Google            │   ← Google-rendered (in
 *   └──────────────────────────────────┘     the browser's locale)
 *
 * They appear at different times — the AntCV button paints first
 * (server-side rendered React), then the Google GSI script
 * (https://accounts.google.com/gsi/client) loads asynchronously
 * and injects its iframe-backed button into the `googleBtnRef`
 * container. The layout shifts as the second button materialises,
 * which Gabriel sees as a visual "jump".
 *
 * Beyond the jump, the two buttons do different things:
 *
 *   - Custom "Sign in with Google" → Auth.signInWithGoogleSelectAccount
 *     (OAuth redirect with prompt=select_account → general account
 *     picker, every Google account shown).
 *   - GSI-rendered "Log ind med Google" → Google's One-Tap-style
 *     personalized flow → auto-targets the browser's current
 *     Google user.
 *
 * Gabriel asked for "a general user selection before the browser's
 * user is selected", and at minimum to remove the jump. The
 * cleanest answer to both is to hide the GSI-rendered button and
 * keep the custom one as the only sign-in entry point.
 *
 * Implementation
 * --------------
 * Search the DOM for `<iframe>` elements whose `src` starts with
 * `https://accounts.google.com/gsi/button`. For each match, walk
 * up the parent chain looking for the `googleBtnRef` container
 * (identified by the inline style `min-height: 40px` set in
 * antcv-auth.js at line 657), and set `display: none` on it. If
 * the marker style isn't found within a few levels, fall back to
 * hiding the iframe's immediate parent.
 *
 * MutationObserver + interval poll catches re-renders. The hide
 * is idempotent: re-applying display:none on an already-hidden
 * element is a no-op, and we set a marker so we don't keep
 * mutating the same element.
 *
 * Side effects
 * ------------
 *   - The "Sign in with Google" custom button still works
 *     unchanged (clicks → select-account redirect flow).
 *   - The Google GSI script still loads and initialises in the
 *     background, which is harmless. We just hide its rendered
 *     button.
 *   - The auth callback registered via setGoogleSignInHandler
 *     still resolves correctly if the user signs in via any path
 *     that surfaces it (e.g. One-Tap card, if ever enabled).
 *
 * Reversal
 * --------
 * Set `localStorage.antcvShowGsiButton = "1"` and reload to keep
 * the GSI-rendered button visible.
 */
(function () {
  'use strict';

  const SCRIPT_VERSION = '1.40.154';
  const IFRAME_SRC_PREFIX = 'https://accounts.google.com/gsi/button';
  const HIDDEN_FLAG = 'antcvGsiHidden';
  const ESCAPE_HATCH_KEY = 'antcvShowGsiButton';

  if (window.__antcvHideGsiButtonInstalled) return;
  window.__antcvHideGsiButtonInstalled = SCRIPT_VERSION;

  function escapeHatchActive() {
    try {
      const raw = localStorage.getItem(ESCAPE_HATCH_KEY);
      if (!raw) return false;
      let v = raw;
      try { const p = JSON.parse(raw); if (typeof p === 'string') v = p; } catch (_) {}
      return String(v).trim() === '1' || String(v).trim().toLowerCase() === 'true';
    } catch (_) { return false; }
  }

  // Walk up `levels` parents looking for the googleBtnRef
  // container. The container is identified by `style.minHeight ===
  // "40px"` (set inline at antcv-auth.js:657). If we don't find it,
  // hiding the iframe's direct parent is a reasonable fallback.
  function findGoogleBtnContainer(iframe) {
    let cur = iframe.parentElement;
    let levels = 0;
    while (cur && levels < 6) {
      const sty = cur.style || {};
      // Primary marker: the googleBtnRef div's inline style.
      if (sty.minHeight === '40px' && sty.display === 'flex') return cur;
      // Secondary marker: a container with opacity 0.95 (also set
      // on the googleBtnRef wrapper).
      if (sty.opacity === '0.95') return cur;
      cur = cur.parentElement;
      levels++;
    }
    // Fallback: the iframe's immediate parent. Less precise but
    // hides the visible chrome around the iframe.
    return iframe.parentElement;
  }

  function hideGsiButtons() {
    if (escapeHatchActive()) return;
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(function (iframe) {
      const src = iframe.src || iframe.getAttribute('src') || '';
      if (src.indexOf(IFRAME_SRC_PREFIX) !== 0) return;
      const container = findGoogleBtnContainer(iframe);
      if (!container) return;
      if (container.dataset[HIDDEN_FLAG] === '1') return;
      // Use !important-equivalent inline style by setting display
      // directly. CSS specificity isn't a concern here since the
      // googleBtnRef container has inline style {display:'flex'}
      // — overriding inline with inline wins for the same element.
      container.style.setProperty('display', 'none', 'important');
      container.dataset[HIDDEN_FLAG] = '1';
    });
  }

  [0, 200, 600, 1500, 3000].forEach(function (d) {
    if (d === 0) hideGsiButtons();
    else setTimeout(hideGsiButtons, d);
  });

  try {
    const mo = new MutationObserver(function () { hideGsiButtons(); });
    mo.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'style'],
    });
  } catch (_) {}

  // Polling fallback at low rate. GSI button may render very late
  // on slow networks.
  setInterval(hideGsiButtons, 1500);

  // Test/debug API
  window.AntcvHideGsiButton = {
    version: SCRIPT_VERSION,
    _hideGsiButtons: hideGsiButtons,
    _findGoogleBtnContainer: findGoogleBtnContainer,
    _escapeHatchActive: escapeHatchActive,
    IFRAME_SRC_PREFIX: IFRAME_SRC_PREFIX,
  };
})();
