/* AntCV user-mode cloud restore — Phase 2 of wizard-mode-bridge-337
 * ============================================================================
 * Version: 1.40.340-a
 *
 * What this sidecar does
 * ----------------------
 * Phase 1 (antcv-wizard-mode-bridge-337.js) handles PWA → relay writes: when
 * the user picks demo / byok / paid in the wizard, the bridge POSTs to
 * /api/user/mode and the relay persists it on prefs2:<hash>.mode.
 *
 * Phase 2 (THIS FILE) handles relay → PWA reads on boot / sign-in: it fetches
 * /api/user/mode from the relay and publishes the authoritative value so the
 * bundle can reconcile its local React state ("En") to the cloud value.
 *
 * Why this is needed
 * ------------------
 * The wizard-mode bridge comment explicitly notes: "PWA local state remains
 * untouched here — the wizard's own logic (Rn / En / useChatGPT) still
 * controls watermarks and UI flow. Reconciling local <-> relay on sign-in
 * is a separate concern (Phase 2; not in this file)."
 *
 * Concrete scenario: user picks "demo" on Desktop A, the bridge POSTs that
 * to the relay, KV stores mode="demo". User signs in on Mobile B. The relay
 * still has mode="demo" but the bundle's En state initialises to whatever
 * the React useState default is — usually empty/byok — so Mobile B shows
 * paid/byok UI even though this user is on the demo tier. Watermarks,
 * banner copy, and "Sign up for paid" CTAs are all wrong.
 *
 * What this sidecar emits
 * -----------------------
 * On every reconciliation (boot, sign-in event, focus, cross-tab storage
 * event) it:
 *
 * 1. Writes localStorage 'antcv:user-mode-cloud' = "demo" | "paid" | "byok"
 *    Canonical key. The bundle (or any future consumer) can read this on
 *    init when React state would otherwise default.
 *
 * 2. Writes localStorage 'antcv:user-mode-cloud-meta' = JSON
 *    { mode, at (ISO8601), source ("init"|"signin"|"focus"|"storage") }
 *    Diagnostic record so we can verify in DevTools when it last fired.
 *
 * 3. Dispatches CustomEvent 'antcv:user-mode-reconciled' on window
 *    with detail = { mode, previousMode, source, at }
 *    Live signal. The bundle's app.js should listen for this and call its
 *    React setter (Rn) to update En. See "Bundle hook" below.
 *
 * 4. Dispatches a StorageEvent for 'antcv:user-mode-cloud' as a cross-tab
 *    fallback (some listeners only watch storage events).
 *
 * It does NOT call window.AntcvSetUserMode() — that's the Phase 1 write path
 * and would create a needless echo POST back to the relay.
 *
 * Bundle hook (one-liner the bundle needs)
 * ----------------------------------------
 * Inside the app.js wizard component, alongside the existing useState for
 * En, add:
 *
 *     React.useEffect(() => {
 *       const onReconciled = (ev) => {
 *         const cloudMode = ev && ev.detail && ev.detail.mode;
 *         if (cloudMode && cloudMode !== En) Rn(cloudMode);
 *       };
 *       window.addEventListener('antcv:user-mode-reconciled', onReconciled);
 *       // Also seed initial state from LS if En is unset and LS has a value:
 *       try {
 *         const ls = localStorage.getItem('antcv:user-mode-cloud');
 *         if (ls && !En) Rn(ls);
 *       } catch (_) {}
 *       return () => window.removeEventListener('antcv:user-mode-reconciled', onReconciled);
 *     }, [En]);
 *
 * Until that hook is added, this sidecar is harmless — values sit in LS
 * and are available for the next bundle version that wires it up.
 *
 * Source of truth contract
 * ------------------------
 * Cloud (relay KV prefs2:<hash>.mode) is authoritative. This sidecar always
 * trusts the relay response. If the user changed mode on another device 5
 * seconds ago, this device picks up the change on next sign-in / focus.
 * Never the inverse: this sidecar does NOT push local state to the cloud.
 *
 * Session de-duplication
 * ----------------------
 * sessionStorage 'antcv:user-mode-cloud-restored' gates against re-fetching
 * within a single session (same pattern as antcv-personal-info-cloud-restore-282).
 * Sign-in events and focus events force a re-check anyway so the user can't
 * get stuck on stale data.
 *
 * Escape hatch: localStorage['antcv:disable-user-mode-restore'] = '1'.
 * Debug API: window.AntcvUserModeRestore340.
 * ============================================================================
 */
(function () {
  'use strict';

  var VERSION = '1.40.340-a';
  if (window.__antcvUserModeRestore340 === VERSION) return;
  window.__antcvUserModeRestore340 = VERSION;

  var TAG          = '[user-mode-restore-340]';
  var DISABLE_KEY  = 'antcv:disable-user-mode-restore';
  var LS_KEY       = 'antcv:user-mode-cloud';
  var LS_META_KEY  = 'antcv:user-mode-cloud-meta';
  var SESSION_FLAG = 'antcv:user-mode-cloud-restored';
  var TOKEN_KEY    = 'antcv:auth:token';
  var VALID_MODES  = { demo: 1, paid: 1, byok: 1 };

  function disabled() {
    try {
      var v = localStorage.getItem(DISABLE_KEY);
      return v === '1' || v === 'true';
    } catch (_) { return false; }
  }

  // Mirror the relay URL discovery used by the other sidecars (especially
  // wizard-mode-bridge-337). Strip wrapping JSON quotes if a previous setter
  // double-encoded the value.
  function getRelayUrl() {
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

  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (_) { return ''; }
  }

  function signedIn() {
    if (getToken()) return true;
    try {
      return !!(window.AntcvAuth &&
                typeof window.AntcvAuth.getSignedInUser === 'function' &&
                window.AntcvAuth.getSignedInUser());
    } catch (_) { return false; }
  }

  function readLs(k) { try { return localStorage.getItem(k) || ''; } catch (_) { return ''; } }
  function writeLs(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }

  function publishMode(mode, source) {
    var previousMode = readLs(LS_KEY);
    if (previousMode === mode) {
      // No-op — already in sync. Refresh the meta timestamp so we can see
      // in DevTools that the sidecar IS running, even when no change happens.
      try {
        writeLs(LS_META_KEY, JSON.stringify({
          mode: mode, at: new Date().toISOString(), source: source, noop: true
        }));
      } catch (_) {}
      return false;
    }

    writeLs(LS_KEY, mode);
    try {
      writeLs(LS_META_KEY, JSON.stringify({
        mode: mode, at: new Date().toISOString(), source: source, previousMode: previousMode
      }));
    } catch (_) {}

    // Live signal for in-tab consumers.
    try {
      window.dispatchEvent(new CustomEvent('antcv:user-mode-reconciled', {
        detail: { mode: mode, previousMode: previousMode || null, source: source, at: new Date().toISOString() }
      }));
    } catch (_) {}

    // Cross-tab fallback. Some consumers only listen for storage events.
    try {
      var ev = new StorageEvent('storage', {
        key: LS_KEY,
        newValue: mode,
        oldValue: previousMode || null,
        storageArea: window.localStorage,
      });
      window.dispatchEvent(ev);
    } catch (_) {
      try {
        var ev2 = document.createEvent('Event');
        ev2.initEvent('storage', true, true);
        ev2.key = LS_KEY;
        ev2.newValue = mode;
        ev2.oldValue = previousMode || null;
        window.dispatchEvent(ev2);
      } catch (_) {}
    }

    try {
      console.info(TAG, 'reconciled local mode →', mode,
                   '(was ' + (previousMode || '(unset)') + ', source=' + source + ')');
    } catch (_) {}
    return true;
  }

  var fetchInFlight = false;
  var lastFetchAt   = 0;

  // Force ignores the session flag but still respects in-flight de-dup
  // and a 1-second client-side cooldown so rapid focus/visibility ping-pong
  // doesn't hammer the relay.
  function fetchAndPublish(source, force) {
    if (disabled()) {
      try { console.debug(TAG, 'disabled via LS escape hatch'); } catch (_) {}
      return Promise.resolve(false);
    }
    if (fetchInFlight) return Promise.resolve(false);
    var now = Date.now();
    if (!force && now - lastFetchAt < 1000) return Promise.resolve(false);

    if (!force) {
      try {
        if (sessionStorage.getItem(SESSION_FLAG) === '1') {
          // Already fetched this session; skip silently. focus / signin /
          // storage events pass force=true to bypass this.
          return Promise.resolve(false);
        }
      } catch (_) {}
    }

    if (!signedIn()) {
      try { console.debug(TAG, 'not signed in yet, skipping (' + source + ')'); } catch (_) {}
      return Promise.resolve(false);
    }
    var base = getRelayUrl();
    if (!base) {
      try { console.warn(TAG, 'no relay URL available, cannot fetch'); } catch (_) {}
      return Promise.resolve(false);
    }
    var token = getToken();

    fetchInFlight = true;
    lastFetchAt   = now;

    // antcv-auth.js wraps window.fetch to inject Authorization; supplying it
    // explicitly here is belt-and-braces in case some other sidecar restored
    // window.fetch to its native form.
    var headers = { 'Accept': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    return window.fetch(base + '/api/user/mode', {
      method: 'GET',
      credentials: 'include',
      headers: headers,
    }).then(function (res) {
      if (!res || !res.ok) {
        try { console.warn(TAG, 'GET /api/user/mode failed:', res && res.status); } catch (_) {}
        return null;
      }
      return res.json().catch(function () { return null; });
    }).then(function (body) {
      if (!body || typeof body !== 'object') return false;
      var mode = body.mode;
      if (typeof mode !== 'string' || !VALID_MODES[mode]) {
        try { console.warn(TAG, 'relay returned unrecognised mode:', mode); } catch (_) {}
        return false;
      }
      try { sessionStorage.setItem(SESSION_FLAG, '1'); } catch (_) {}
      return publishMode(mode, source);
    }).catch(function (err) {
      try { console.warn(TAG, 'fetch error:', err && err.message); } catch (_) {}
      return false;
    }).then(function (result) {
      fetchInFlight = false;
      return result;
    });
  }

  function init() {
    if (signedIn()) {
      fetchAndPublish('init', false);
      return;
    }
    // Wait for sign-in. Watch storage (cross-tab signin) AND poll briefly
    // (same-tab signin) — same pattern as cloud-restore-282.
    var onStorage = function (ev) {
      if (!ev) return;
      if (ev.key === TOKEN_KEY || ev.key === 'proxyUrl' || ev.key === 'relayUrl') {
        if (signedIn() && getRelayUrl()) {
          window.removeEventListener('storage', onStorage);
          // Force here — fresh sign-in is exactly when we want a fetch even
          // if a previous session for this user already set the flag.
          try { sessionStorage.removeItem(SESSION_FLAG); } catch (_) {}
          fetchAndPublish('signin-storage', true);
        }
      }
    };
    window.addEventListener('storage', onStorage);

    var polls = 0;
    var id = setInterval(function () {
      polls++;
      if (signedIn() && getRelayUrl()) {
        clearInterval(id);
        window.removeEventListener('storage', onStorage);
        try { sessionStorage.removeItem(SESSION_FLAG); } catch (_) {}
        fetchAndPublish('signin-poll', true);
      } else if (polls >= 30) {
        clearInterval(id);
      }
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 250); }, { once: true });
  } else {
    setTimeout(init, 250);
  }

  // Re-fetch on focus/visibility so a mode change made on another device
  // shows up here without requiring a full reload. Force=true bypasses the
  // session flag.
  ['focus', 'pageshow'].forEach(function (e) {
    window.addEventListener(e, function () { fetchAndPublish(e, true); });
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') fetchAndPublish('visibilitychange', true);
  });

  // Cross-tab: another tab updated 'antcv:user-mode-cloud' directly (e.g.
  // user changed mode there). Re-publish event in this tab so listeners
  // pick it up.
  window.addEventListener('storage', function (ev) {
    if (!ev || ev.key !== LS_KEY || !ev.newValue) return;
    if (!VALID_MODES[ev.newValue]) return;
    try {
      window.dispatchEvent(new CustomEvent('antcv:user-mode-reconciled', {
        detail: { mode: ev.newValue, previousMode: ev.oldValue || null, source: 'storage-cross-tab', at: new Date().toISOString() }
      }));
    } catch (_) {}
  });

  window.AntcvUserModeRestore340 = {
    version: VERSION,
    fetch: function (force) { return fetchAndPublish('manual', !!force); },
    getCurrent: function () { return readLs(LS_KEY) || null; },
    getMeta: function () { try { return JSON.parse(readLs(LS_META_KEY) || 'null'); } catch (_) { return null; } },
    _publish: publishMode,
    _clearSessionFlag: function () { try { sessionStorage.removeItem(SESSION_FLAG); } catch (_) {} },
  };

  try { console.debug(TAG, 'installed ' + VERSION); } catch (_) {}
})();
