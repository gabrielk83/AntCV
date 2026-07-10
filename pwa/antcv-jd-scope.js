// antcv-jd-scope.js — per-application JD-state isolation (JD-SCOPE-ISOLATION-001)
// =====================================================================
// Two parallel sessions of the SAME account — two tabs, desktop+mobile, or two
// browsers — must NOT let one application's job-description state contaminate
// another. Today the active JD lives in GLOBAL single-slot localStorage keys
// (antcv:lastJdText / antcv:applicationQuestions / antcv:applicationQuestionsJd /
// antcv:activeAppCompany). Two tabs on different applications share those slots,
// so tab A's JD upload is read by tab B (the GEN-UNSOL-STALE-JD / NVIDIA-on-
// unsolicited class of bug).
//
// Fix: namespace those keys per CURRENT-APPLICATION-ID. The current app id is
// tracked PER TAB (window memory + sessionStorage — NEVER a shared localStorage
// key, which would re-share it across tabs). A NARROW keyed redirect over
// localStorage.getItem/setItem/removeItem rewrites ONLY the four JD keys to
// `antcv:app:{appId}:{base}`; every other key passes straight through. The redirect
// is bulletproof — any failure falls back to the raw call, so it can never brick
// the app. Same-app cross-tab sync still works because both tabs resolve the same
// app id → the same namespaced key → the same storage event.
//
// The app tells this module which application a tab is on via
// AntcvJdScope.setCurrentAppId(id) (driven from the single active-app-id React
// state). Cloud isolation (device-stamped active pointer) is a separate stage.
//
// MUST load as the FIRST script in index.html so the redirect is installed before
// app.js and every sidecar first touches these keys. Kill switch: none by design —
// disabling it re-opens the contamination. To debug raw slots, read window
// .__antcvJdScopeRaw.getItem(key).
(function () {
  if (typeof window === 'undefined') return;
  if (window.__antcvJdScopeInstalled) return;

  // base name each global JD key maps to under antcv:app:{appId}:
  var SCOPED = {
    'antcv:lastJdText': 'jdText',
    'antcv:applicationQuestions': 'questions',
    'antcv:applicationQuestionsJd': 'questionsJd',
    'antcv:activeAppCompany': 'company'
  };

  function tabAppId() {
    if (window.__antcvCurrentAppId != null && window.__antcvCurrentAppId !== '')
      return String(window.__antcvCurrentAppId);
    var s = null;
    try { s = sessionStorage.getItem('antcv:currentAppId'); } catch (_) {}
    window.__antcvCurrentAppId = (s && String(s).trim()) ? String(s) : 'kernel';
    return window.__antcvCurrentAppId;
  }
  function setCurrentAppId(id) {
    var v = (id == null || id === '' || id === 'null' || id === 'undefined') ? 'kernel' : String(id);
    if (window.__antcvCurrentAppId === v) return;
    window.__antcvCurrentAppId = v;
    try { sessionStorage.setItem('antcv:currentAppId', v); } catch (_) {}
  }
  function nsKey(base, id) { return 'antcv:app:' + (id || tabAppId()) + ':' + base; }
  // true only for THIS tab's own namespaced JD keys — used by the sidecar storage
  // listeners so a foreign app's write (different namespace) is correctly ignored.
  function isMyJdKey(k) {
    if (!k) return false;
    var pre = 'antcv:app:' + tabAppId() + ':';
    return k === pre + 'jdText' || k === pre + 'questions' ||
           k === pre + 'questionsJd' || k === pre + 'company';
  }

  var LS = null;
  try { LS = window.localStorage; } catch (_) { LS = null; }
  if (!LS || typeof LS.getItem !== 'function') {
    window.AntcvJdScope = {
      setCurrentAppId: setCurrentAppId, getCurrentAppId: tabAppId, isMyJdKey: isMyJdKey,
      nsKey: nsKey, getJd: function () { return ''; }, setJd: function () {},
      getQuestions: function () { return ''; }, setQuestions: function () {}, getCompany: function () { return ''; }
    };
    window.__antcvJdScopeInstalled = true;
    return;
  }

  var rawGet = LS.getItem.bind(LS), rawSet = LS.setItem.bind(LS), rawRemove = LS.removeItem.bind(LS);
  window.__antcvJdScopeRaw = { getItem: rawGet, setItem: rawSet, removeItem: rawRemove };

  // one-time migration: copy any pre-existing GLOBAL value into the CURRENT app's
  // namespaced slot so an in-flight application is not lost on first load. The
  // globals are LEFT in place for one release (rollback safety); the redirect
  // below means future reads/writes never touch them again.
  try {
    if (rawGet('antcv:jdScopeMigrated') !== '1') {
      var id0 = tabAppId();
      Object.keys(SCOPED).forEach(function (g) {
        try {
          var nk = nsKey(SCOPED[g], id0), cur = rawGet(nk), glob = rawGet(g);
          if (cur == null && glob != null) rawSet(nk, glob);
        } catch (_) {}
      });
      rawSet('antcv:jdScopeMigrated', '1');
    }
  } catch (_) {}

  // narrow keyed redirect — ONLY the four JD keys; everything else passes through.
  try {
    LS.getItem = function (k) {
      try { if (Object.prototype.hasOwnProperty.call(SCOPED, k)) return rawGet(nsKey(SCOPED[k])); } catch (_) {}
      return rawGet(k);
    };
    LS.setItem = function (k, v) {
      try { if (Object.prototype.hasOwnProperty.call(SCOPED, k)) return rawSet(nsKey(SCOPED[k]), v); } catch (_) {}
      return rawSet(k, v);
    };
    LS.removeItem = function (k) {
      try { if (Object.prototype.hasOwnProperty.call(SCOPED, k)) return rawRemove(nsKey(SCOPED[k])); } catch (_) {}
      return rawRemove(k);
    };
  } catch (_) {}

  // ---- Stage 2 (cloud): a per-INSTALL device id (device-scoped, NOT a JD key, so it
  // is not redirected) — lets the cloud active_application pointer record which device
  // set it, so a second device's cold-restore can avoid being yanked onto the first
  // device's app. Generated once, persisted in localStorage.
  function deviceId() {
    var d = null;
    try { d = rawGet('antcv:deviceId'); } catch (_) {}
    if (d && String(d).trim()) return String(d);
    var v;
    try { v = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : null; } catch (_) { v = null; }
    if (!v) v = 'dev-' + Math.abs(((Date.now ? Date.now() : 0) ^ (Math.floor(1e9 * (Math.random ? Math.random() : 0))))).toString(36) + '-' + (tabAppId() || 'k');
    try { rawSet('antcv:deviceId', v); } catch (_) {}
    return v;
  }
  // PARALLEL-GEN-POINTER-002: build a `?device_id=…` query suffix for the cloud prefs/
  // active GETs, so the relay returns THIS device's own active-application pointer (not
  // whatever another device generated last). Empty string when no device id — relay then
  // falls back to the legacy global pointer, i.e. today's behavior.
  function devQ(sep) {
    try {
      var d = deviceId();
      if (!d) return '';
      return (sep || '?') + 'device_id=' + encodeURIComponent(d);
    } catch (_) { return ''; }
  }
  // PURE decision: should THIS tab's cold-restore adopt the cloud active_application
  // pointer, or keep the app it is already editing? Adopt when the pointer is mine, or
  // when I have no specific app in progress, or when it points at the same app. Only
  // when ANOTHER device just switched the shared pointer to a DIFFERENT app do we keep
  // ours (the desktop<->mobile / two-browser "don't yank me" case).
  function shouldAdoptCloudPointer(o) {
    o = o || {};
    var cloudApp = (o.cloudAppId == null || o.cloudAppId === '') ? null : String(o.cloudAppId);
    if (!cloudApp) return true;                                   // no cloud app → nothing to guard
    if (o.cloudDeviceId && o.cloudDeviceId === o.myDeviceId) return true;  // my own pointer
    var myApp = (o.myTabAppId == null || o.myTabAppId === '' || o.myTabAppId === 'null') ? 'kernel' : String(o.myTabAppId);
    if (myApp === 'kernel') return true;                          // I'm not on a specific app
    if (myApp === cloudApp) return true;                          // same app
    return false;                                                 // another device, a different app → keep mine
  }
  function getJd(id) { try { return rawGet(nsKey('jdText', id)) || ''; } catch (_) { return ''; } }
  function setJd(v, id) { try { rawSet(nsKey('jdText', id), String(v == null ? '' : v)); } catch (_) {} }
  function getQuestions(id) { try { return rawGet(nsKey('questions', id)) || ''; } catch (_) { return ''; } }
  function setQuestions(v, id) { try { rawSet(nsKey('questions', id), String(v == null ? '' : v)); } catch (_) {} }
  function getCompany(id) { try { return rawGet(nsKey('company', id)) || ''; } catch (_) { return ''; } }

  window.AntcvJdScope = {
    setCurrentAppId: setCurrentAppId, getCurrentAppId: tabAppId, isMyJdKey: isMyJdKey, nsKey: nsKey,
    getJd: getJd, setJd: setJd, getQuestions: getQuestions, setQuestions: setQuestions, getCompany: getCompany,
    deviceId: deviceId, shouldAdoptCloudPointer: shouldAdoptCloudPointer, devQ: devQ
  };
  window.__antcvJdScopeInstalled = true;
})();
