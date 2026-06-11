/* AntCV live setup-state chips (v1.50.347)
 * ============================================================================
 * REGULAR-MODE-STALE-SETUP-001 (owner 2026-06-09): in regular (BYOK) mode the
 * landing header keeps showing the "⚠ Setup needed" warning and the "🟡 Use
 * demo" coin until a manual refresh.
 *
 * Why
 * ---
 * Both chips are rendered by app.js gated on M() (needs-setup) and
 * __antcvHasOwnKey() — plain localStorage reads evaluated AT RENDER TIME.
 * When the keys arrive AFTER the header mounted (cloud restore on sign-in,
 * pasting a key in Settings, another tab), nothing re-renders the header, so
 * the stale chips sit there until a refresh. Same-tab localStorage writes
 * fire NO 'storage' event, so the app can't even listen its way out.
 *
 * PAID-USER-STALE-SETUP-002 (owner 2026-06-11): a PAID / entitled user (signed
 * in through the relay, NO BYOK key) ALSO sees "⚠ Setup needed" + the "🟡 Use
 * demo" coin until a refresh. The original sidecar only hid the chips when
 * __antcvHasOwnKey() was true — a BYOK key in localStorage. But an entitled
 * user has no own key; their access comes from the relay allowlist tied to
 * their signed-in email (antcv:auth:token + antcv:auth:email). So hasOwnKey()
 * was false and the chips stayed. The app's own gating reaches the entitled
 * state only after the relay /config resolves, which on the first paint (or
 * when landing already-signed-in) is too late — hence the refresh "fixes" it.
 *
 * Fix
 * ---
 * Treat the user as set-up when EITHER:
 *   (a) they have a BYOK key (apiKey / openaiKey / mistralKey / geminiKey), OR
 *   (b) they are SIGNED IN to the relay (AntcvAuth.isSignedIn(), i.e. a present
 *       auth token + email) — an entitled/paid user. The relay enforces the
 *       allowlist server-side, so a signed-in session means "set up", and both
 *       "Setup needed" and "Use demo" are wrong for them.
 * Hide the chips by exact leaf text in either case; restore them only when the
 * user has NO key AND is NOT signed in. A MutationObserver re-applies after
 * React re-renders recreate the nodes; auth changes are picked up via the
 * AntcvAuth subscription plus the existing poll. Additive, idempotent.
 */
(function () {
  'use strict';
  var VERSION = '1.50.347-setup-chips-live';
  if (window.__antcvSetupChipsLive === VERSION) return;
  window.__antcvSetupChipsLive = VERSION;

  var TAG = '[setup-chips-live-372]';
  var ATTR = 'data-antcv-chip-hidden';
  var CHIP_TEXTS = ['⚠ Setup needed', '🟡 Use demo'];

  function unwrap(raw) {
    if (!raw) return '';
    try {
      var u = raw;
      try { var p = JSON.parse(raw); if (typeof p === 'string') u = p; } catch (_) {}
      return String(u).trim();
    } catch (_) { return ''; }
  }

  function hasOwnKey() {
    try {
      return !!(
        unwrap(localStorage.getItem('apiKey')) ||
        unwrap(localStorage.getItem('openaiKey')) ||
        unwrap(localStorage.getItem('mistralKey')) ||
        unwrap(localStorage.getItem('geminiKey'))
      );
    } catch (_) { return false; }
  }

  // PAID-USER-STALE-SETUP-002: signed in to the relay = entitled/paid. Prefer
  // the AntcvAuth API when present; fall back to the raw storage keys it writes
  // (antcv:auth:token + antcv:auth:email) so this works even if AntcvAuth hasn't
  // attached yet at the moment we check.
  function isSignedIn() {
    try {
      if (window.AntcvAuth && typeof window.AntcvAuth.isSignedIn === 'function') {
        return !!window.AntcvAuth.isSignedIn();
      }
    } catch (_) {}
    try {
      return !!(unwrap(localStorage.getItem('antcv:auth:token')) &&
                unwrap(localStorage.getItem('antcv:auth:email')));
    } catch (_) { return false; }
  }

  // "Set up" = has a BYOK key OR is a signed-in (entitled) user.
  function isSetUp() {
    return hasOwnKey() || isSignedIn();
  }

  function findChips() {
    var found = [];
    // The chips are leaf div/button elements whose entire text is the label.
    var nodes = document.querySelectorAll('div, button');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.children && n.children.length) continue;
      var t = (n.textContent || '').trim();
      for (var c = 0; c < CHIP_TEXTS.length; c++) {
        if (t === CHIP_TEXTS[c]) { found.push(n); break; }
      }
    }
    return found;
  }

  function applyState() {
    var setUp = isSetUp();
    var chips = findChips();
    for (var i = 0; i < chips.length; i++) {
      var el = chips[i];
      if (setUp) {
        if (el.getAttribute(ATTR) !== '1') {
          el.setAttribute(ATTR, '1');
          el.style.display = 'none';
        }
      } else if (el.getAttribute(ATTR) === '1') {
        el.removeAttribute(ATTR);
        el.style.display = '';
      }
    }
    return setUp;
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    setTimeout(function () { pending = false; try { applyState(); } catch (_) {} }, 60);
  }

  // Boot + cheap poll (same-tab key writes fire no event) + cross-tab +
  // tab-return. The poll only does DOM work when set-up state CHANGED since
  // the last pass — track it to keep idle cost ~0.
  var lastSetUp = null;
  function tick() {
    var setUp = isSetUp();
    if (setUp !== lastSetUp) {
      lastSetUp = setUp;
      try { applyState(); } catch (_) {}
      try { console.debug(TAG, 'set-up changed →', setUp ? 'set up (chips hidden)' : 'not set up (chips restored)'); } catch (_) {}
    }
  }
  tick();
  schedule();
  [300, 900, 2000, 4000].forEach(function (d) { setTimeout(schedule, d); });
  setInterval(tick, 1500);
  window.addEventListener('storage', function (ev) {
    if (!ev || ['apiKey', 'openaiKey', 'mistralKey', 'geminiKey', 'proxyUrl',
                'antcv:auth:token', 'antcv:auth:email'].indexOf(ev.key) >= 0) { lastSetUp = null; tick(); }
  });
  ['focus', 'pageshow'].forEach(function (e) { window.addEventListener(e, function () { lastSetUp = null; tick(); }); });

  // PAID-USER-STALE-SETUP-002: react immediately to sign-in / sign-out within
  // the same page instance (no 'storage' event fires for same-tab writes). The
  // AntcvAuth subscription delivers the auth state on change; force a re-eval.
  // AntcvAuth may not be present when this runs — retry briefly to attach.
  (function attachAuth() {
    function sub() {
      try {
        if (window.AntcvAuth && typeof window.AntcvAuth.subscribe === 'function') {
          window.AntcvAuth.subscribe(function () { lastSetUp = null; tick(); });
          return true;
        }
      } catch (_) {}
      return false;
    }
    if (!sub()) {
      var tries = 0;
      var iv = setInterval(function () { if (sub() || ++tries > 40) clearInterval(iv); }, 120);
    }
  })();

  // Re-apply after React re-renders recreate the chips.
  try {
    new MutationObserver(function (recs) {
      for (var i = 0; i < recs.length; i++) {
        var t = recs[i].target;
        if (t && t.nodeType === 1 && t.hasAttribute && t.hasAttribute(ATTR)) continue;
        schedule(); return;
      }
    }).observe(document.body || document.documentElement, { childList: true, subtree: true });
  } catch (_) {}

  window.AntcvSetupChipsLive = {
    version: VERSION,
    _apply: applyState,
    _hasOwnKey: hasOwnKey,
    _isSignedIn: isSignedIn,
    _isSetUp: isSetUp,
  };
  try { console.debug(TAG, 'installed v' + VERSION); } catch (_) {}
})();
