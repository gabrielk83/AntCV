/* antcv-tab-doc-isolation.js — TAB-DOC-ISOLATION-001 (owner 2026-07-10)
 *                              TAB-DOC-LEASE-001     (2026-11-05)
 * ============================================================================
 * Per-TAB isolation of the generated document against a PARALLEL-TAB clobber.
 *
 * Same-device tabs share localStorage. Two tabs on different applications both
 * wrote the shared `sections` / `meta`: app.js autosaves its in-memory document
 * 500 ms after any change, the write belts re-run on content that arrives through
 * `storage` events, and app.js merges a foreign `meta` into its own state.
 * Measured on antcv.pages.dev 2026-11-05: 667 `sections` writes in 20 s, the
 * recommendations flipping Sagiv Szeltser <-> Rani Golan, the lease below
 * changing hands every 100-300 ms, and a third tab re-rendering Settings on
 * every write. 1.0.0 only STAMPED a lease; nothing read it before writing.
 *
 * 2.0.0 makes the lease real:
 *   - Every tab keeps its OWN document in a shadow (memory + sessionStorage) for
 *     DOC_KEYS. localStorage.getItem/setItem/removeItem on those keys read and
 *     write the shadow, in every tab, so app.js and every sidecar see this tab's
 *     document and never the parallel tab's.
 *   - Only the lease holder (`antcv:docWriterTab`) publishes its shadow writes to
 *     localStorage. A non-holder writes nothing shared.
 *   - A cross-tab `storage` event for a DOC key stops at a capture listener that
 *     loads before every sidecar: the tab's own document did not change, so no
 *     belt runs and app.js re-renders nothing.
 *   - A tab claims the lease when the user is on it (boot while visible, tab
 *     shown, window focus, pointer or key input), or on its next write when the
 *     lease is free or the holder went silent; it then publishes its shadow.
 *     Holder heartbeat 20 s, stale after 120 s, released on pagehide.
 *   - Reload keeps the tab's document: the shadow persists in sessionStorage.
 *
 * Kill via localStorage['antcv:disable-tab-doc-iso']='1' (reload): no shadow, no
 * lease, every tab reads and writes the shared keys as before 1.0.0.
 */
(function () {
  'use strict';
  var VERSION = '2.0.0-tab-doc-lease';
  if (window.__antcvTabDocIso) return;
  window.__antcvTabDocIso = VERSION;

  var LEASE = 'antcv:docWriterTab';
  var DOC_KEYS = ['sections', 'meta', 'antcv:clSlogan'];
  var SNAP_V = 'antcv:tabDoc:v';           // '2' once this tab's shadow is in sessionStorage
  var SNAP_PRE = 'antcv:tabDoc:';          // + key -> value (absent = key not set)
  var LEGACY_SNAP = 'antcv:tabDocSnap';    // 1.0.0 snapshot {sections, meta, slogan}
  var BEAT_MS = 20000, STALE_MS = 120000;

  var LS = null;
  try { LS = window.localStorage; } catch (_) { LS = null; }
  if (!LS || typeof LS.getItem !== 'function') return;

  function disabled() { try { return LS.getItem('antcv:disable-tab-doc-iso') === '1'; } catch (_) { return false; } }
  if (disabled()) { window.AntcvTabDocIso = { version: VERSION, disabled: true }; return; }

  function ss(k) { try { return sessionStorage.getItem(k); } catch (_) { return null; } }
  function setSs(k, v) { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (_) {} }

  function tabId() {
    var t = ss('antcv:tabId');
    if (!t) {
      t = 't_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e9).toString(36);
      setSs('antcv:tabId', t);
    }
    return t;
  }
  var MY = tabId();

  // The calls this tab had before the shadow (antcv-jd-scope's redirect, or native).
  var prevGet = LS.getItem, prevSet = LS.setItem, prevRemove = LS.removeItem, prevClear = LS.clear;
  function rawGet(k) { try { return prevGet.call(LS, k); } catch (_) { return null; } }
  function rawPut(k, v) { if (v == null) prevRemove.call(LS, k); else prevSet.call(LS, k, v); }

  var DOC = {};
  DOC_KEYS.forEach(function (k) { DOC[k] = 1; });
  function isDoc(k) { return typeof k === 'string' && DOC[k] === 1; }

  var stats = { claims: 0, published: 0, shadowOnly: 0, blocked: 0, lastClaim: null };

  function myApp() {
    try { return window.AntcvJdScope ? String(window.AntcvJdScope.getCurrentAppId()) : ''; } catch (_) { return ''; }
  }
  function readLease() {
    try { var l = JSON.parse(rawGet(LEASE) || 'null'); return (l && l.tab) ? l : null; } catch (_) { return null; }
  }
  function isHolder() { var l = readLease(); return !!(l && l.tab === MY); }
  function stale(l) { return !l || !(Date.now() - (+l.ts || 0) < STALE_MS); }
  function writeLease() { try { prevSet.call(LS, LEASE, JSON.stringify({ tab: MY, ts: Date.now(), app: myApp() })); } catch (_) {} }

  // ─── Shadow: this tab's document ─────────────────────────────────────────────
  var SHADOW = {}, BAD = {};
  // A key sessionStorage refuses (quota) drops out of the snapshot and the
  // snapshot stops counting as valid, so a reload never restores a stale copy.
  function persist(k) {
    try {
      if (SHADOW[k] == null) sessionStorage.removeItem(SNAP_PRE + k); else sessionStorage.setItem(SNAP_PRE + k, SHADOW[k]);
      BAD[k] = 0;
    } catch (_) { BAD[k] = 1; setSs(SNAP_PRE + k, null); }
    setSs(SNAP_V, DOC_KEYS.some(function (x) { return BAD[x]; }) ? null : '2');
  }

  (function initShadow() {
    var lease = readLease();
    var legacy = null;
    try { legacy = JSON.parse(ss(LEGACY_SNAP) || 'null'); } catch (_) {}
    var src;
    if (ss(SNAP_V) === '2') src = function (k) { return ss(SNAP_PRE + k); };
    else if (legacy && legacy.sections && !(lease && lease.tab === MY)) {
      // 1.0.0 restored its snapshot only when another tab owned the shared doc.
      var lv = { sections: legacy.sections, meta: legacy.meta, 'antcv:clSlogan': legacy.slogan };
      src = function (k) { return lv[k] == null ? null : String(lv[k]); };
    }
    else src = rawGet;                                // fresh tab: start from the shared doc
    DOC_KEYS.forEach(function (k) { SHADOW[k] = src(k); persist(k); });
    setSs(LEGACY_SNAP, null);
  })();

  // ─── Lease ───────────────────────────────────────────────────────────────────
  // Publish the shadow (only keys that differ) so the shared store holds the
  // holder's document. Returns the keys written.
  function publish() {
    var out = [];
    DOC_KEYS.forEach(function (k) {
      if (rawGet(k) === SHADOW[k]) return;
      try { rawPut(k, SHADOW[k]); out.push(k); } catch (_) {}
    });
    return out;
  }
  function claim(why) {
    var l = readLease();
    var had = !!(l && l.tab === MY);
    writeLease();
    var wrote = had ? [] : publish();
    stats.claims += had ? 0 : 1;
    if (!had) {
      stats.lastClaim = { why: why || '', from: l ? l.tab : null, wrote: wrote, at: Date.now() };
      if (wrote.length) {
        try { console.info('[tab-doc-iso] lease claimed (' + (why || '') + ') from ' + (l ? l.tab : 'none') + '; published this tab\'s ' + wrote.join(', ')); } catch (_) {}
      }
    }
    return true;
  }
  function release() {
    try { if (isHolder()) prevRemove.call(LS, LEASE); } catch (_) {}
  }
  function visible() { try { return document.visibilityState !== 'hidden'; } catch (_) { return true; } }

  // ─── Redirect DOC keys to the shadow ─────────────────────────────────────────
  try {
    LS.getItem = function (k) {
      if (isDoc(k)) return SHADOW[k] == null ? null : SHADOW[k];
      return prevGet.call(LS, k);
    };
    LS.setItem = function (k, v) {
      if (!isDoc(k)) return prevSet.call(LS, k, v);
      SHADOW[k] = String(v);
      persist(k);
      var l = readLease();
      if (l && l.tab !== MY && !stale(l)) { stats.shadowOnly++; return; }
      if (!l || l.tab !== MY) claim('write, lease ' + (l ? 'stale' : 'free'));
      else if ((l.app || '') !== myApp()) writeLease();
      stats.published++;
      return prevSet.call(LS, k, SHADOW[k]);
    };
    LS.removeItem = function (k) {
      if (!isDoc(k)) return prevRemove.call(LS, k);
      SHADOW[k] = null;
      persist(k);
      if (isHolder()) return prevRemove.call(LS, k);
      stats.shadowOnly++;
    };
    // Erase / sign-out clear everything; this tab's document goes with it.
    LS.clear = function () {
      DOC_KEYS.forEach(function (k) { SHADOW[k] = null; persist(k); });
      return prevClear.apply(LS, arguments);
    };
  } catch (_) {}

  // ─── Cross-tab writes never reach this tab's sidecars ────────────────────────
  // Capture on window and registered before every sidecar: runs first. Same-tab
  // synthetic StorageEvents (isTrusted false, e.g. the candidate editor's meta
  // hint) pass untouched.
  try {
    window.addEventListener('storage', function (e) {
      if (!e || !e.isTrusted || !isDoc(e.key)) return;
      if (e.storageArea && e.storageArea !== LS) return;
      stats.blocked++;
      e.stopImmediatePropagation();
    }, true);
  } catch (_) {}

  // ─── Claim when the user is on this tab ──────────────────────────────────────
  (function bootClaim() {
    var l = readLease();
    if (!l || l.tab === MY || stale(l) || visible()) claim('boot');
  })();
  // Trusted input only; `focus` without capture is the window's own focus, not
  // an element focus() a background tab can run on its own.
  function onUser(why) { return function (e) { if (e && e.isTrusted && !isHolder()) claim(why); }; }
  try {
    document.addEventListener('visibilitychange', function () { if (visible() && !isHolder()) claim('tab shown'); });
    window.addEventListener('focus', onUser('focus'));
    window.addEventListener('pointerdown', onUser('pointer'), true);
    window.addEventListener('keydown', onUser('key'), true);
    window.addEventListener('pageshow', function (e) { if (e && e.persisted && visible()) claim('pageshow'); });
    window.addEventListener('pagehide', release);
  } catch (_) {}
  setInterval(function () { if (isHolder()) writeLease(); }, BEAT_MS);

  window.AntcvTabDocIso = {
    version: VERSION, tabId: MY, keys: DOC_KEYS.slice(), stats: stats,
    isHolder: isHolder, lease: readLease, claim: claim, release: release,
    shared: function (k) { return rawGet(k); },
    _snapshot: function () { DOC_KEYS.forEach(persist); }
  };
})();
