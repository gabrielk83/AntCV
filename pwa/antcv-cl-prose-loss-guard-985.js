/* antcv-cl-prose-loss-guard-985.js — CL-PROSE-LOSS-GUARD-001 (owner 2026-06-30)
 * ============================================================================
 * LOAD-GRACE GUARD for the cover-letter prose sections.
 *
 * THE BUG (owner): after a fresh CL generation the live preview shows the real
 * who / why / opening / contribute / foundation-lead prose, but exporting AFTER a
 * page refresh (needed to switch to CloudConvert) shows the raw me() TEMPLATE
 * PLACEHOLDERS again ("[Role title]", "[Use Company Info…]", "[Professional
 * identity…]") and drops HOW I WOULD CONTRIBUTE. The refresh triggers a cloud /
 * me()-enforce restore that overwrites the freshly-generated prose with a STALE /
 * template copy. bring / foundation-rows / closure survive because their own
 * sidecars re-apply them; the render-hydrated prose sections have no such guard.
 *
 * THIS GUARD: snapshot each CL prose section's content to a LOCAL-ONLY key
 * (`antcv:clProseGuard`, NOT cloud-synced, so it survives the cloud-restore),
 * keyed by application (meta.company|role). When a later load / restore reverts a
 * snapshotted section to a placeholder, RE-APPLY the snapshot. It only ever
 * replaces a PLACEHOLDER with previously-seen REAL content — it never deletes,
 * empties, or overwrites real content, and never crosses applications. Self-
 * disabling on any error. Disable: localStorage['antcv:disable-cl-prose-guard']='1'.
 *
 * It does NOT touch the CV, the bring rows, or any non-prose section.
 */
(function () {
  'use strict';
  var VERSION = '1.50.988-cl-prose-loss-guard';
  if (window.__antcvClProseGuard985 === VERSION) return;
  window.__antcvClProseGuard985 = VERSION;

  var STORE = 'antcv:clProseGuard';
  // The CL prose sections that are render-hydrated and lost on a stale restore.
  // (bring is persisted by antcv-nordic-cl-order-971; closure by the editor; both
  //  are included as belt-and-suspenders — re-applying a real value is harmless.)
  var GUARDED = ['opening', 'why', 'who', 'foundation', 'contribute', 'closure', 'bring'];
  var lastApplyAt = 0;

  function disabled() { try { var v = localStorage.getItem('antcv:disable-cl-prose-guard'); return v === '1' || v === 'true'; } catch (_) { return false; } }
  function erasing() { try { return !!(localStorage.getItem('antcv:full-erase-in-progress') || localStorage.getItem('antcv:just-erased')); } catch (_) { return false; } }

  function appKey() {
    try {
      var m = JSON.parse(localStorage.getItem('meta') || '{}') || {};
      return String((m.company || '') + '|' + (m.role || '')).slice(0, 200);
    } catch (_) { return '|'; }
  }
  function readSections() {
    try { var v = JSON.parse(localStorage.getItem('sections') || '{}'); return (v && typeof v === 'object') ? v : null; } catch (_) { return null; }
  }
  function readStore() {
    try { var v = JSON.parse(localStorage.getItem(STORE) || '{}'); return (v && typeof v === 'object') ? v : {}; } catch (_) { return {}; }
  }

  function isPlaceholder(t) { var s = String(t == null ? '' : t).trim(); return !s || s.charAt(0) === '['; }

  // The primary prose text of a section (decides real vs placeholder).
  function proseOf(sec) {
    if (!sec || typeof sec !== 'object') return '';
    if (sec.type === 'rich_block' && Array.isArray(sec.items)) {
      // join the non-marker (lead/body) item texts; a real section has at least one
      for (var i = 0; i < sec.items.length; i++) {
        var it = sec.items[i];
        var t = it && typeof it === 'object' ? (it.t || it.b) : it;
        if (!isPlaceholder(t)) return String(t);
      }
      return '';
    }
    if (typeof sec.content === 'string') return sec.content;
    if (Array.isArray(sec.rows) && sec.rows.length) {
      // bring (table): a real row has a non-placeholder cell
      for (var r = 0; r < sec.rows.length; r++) {
        var row = sec.rows[r];
        if (Array.isArray(row)) for (var c = 0; c < row.length; c++) if (!isPlaceholder(row[c])) return String(row[c]);
      }
      return '';
    }
    return '';
  }
  function isReal(sec) { return !isPlaceholder(proseOf(sec)); }

  // Snapshot real CL prose sections for the current application.
  function snapshot() {
    var secs = readSections(); if (!secs || !Array.isArray(secs.cl)) return;
    var key = appKey();
    var store = readStore();
    var bucket = (store[key] && typeof store[key] === 'object') ? store[key] : {};
    var changed = false;
    secs.cl.forEach(function (sec) {
      if (!sec || GUARDED.indexOf(sec.id) < 0) return;
      if (isReal(sec)) {
        // store a deep copy of the real section
        try { bucket[sec.id] = JSON.parse(JSON.stringify(sec)); changed = true; } catch (_) {}
      }
    });
    if (!changed) return;
    store[key] = bucket;
    // keep the store small: cap at the 6 most-recent application buckets
    try {
      var keys = Object.keys(store);
      if (keys.length > 6) { for (var i = 0; i < keys.length - 6; i++) { if (keys[i] !== key) delete store[keys[i]]; } }
    } catch (_) {}
    try { localStorage.setItem(STORE, JSON.stringify(store)); } catch (_) {}
  }

  // Re-apply a snapshotted real section ONLY where the live one is now a placeholder.
  function reapply() {
    var now = (window.performance && performance.now) ? performance.now() : 0;
    if (now && lastApplyAt && (now - lastApplyAt) < 1200) return; // anti-loop
    var secs = readSections(); if (!secs || !Array.isArray(secs.cl)) return;
    var store = readStore();
    var bucket = store[appKey()];
    if (!bucket || typeof bucket !== 'object') return;
    var changed = false;
    var cl = secs.cl.map(function (sec) {
      if (!sec || GUARDED.indexOf(sec.id) < 0) return sec;
      var snap = bucket[sec.id];
      if (!snap || isReal(sec) || !isReal(snap)) return sec; // only placeholder<-real
      changed = true;
      return JSON.parse(JSON.stringify(snap));
    });
    if (!changed) return;
    lastApplyAt = now || 1;
    secs.cl = cl;
    try { localStorage.setItem('sections', JSON.stringify(secs)); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'cl-prose-loss-guard' } })); } catch (_) {}
    try { console.log('[CL-PROSE-LOSS-GUARD] re-applied real prose over restored placeholders'); } catch (_) {}
  }

  // STANDALONE CL KEYS (signature + editable slogan/closing/name) are ALSO wiped by the
  // refresh-triggered restore (owner: "export PDF has no signature"). Snapshot them to a
  // LOCAL-ONLY stash when non-empty; re-apply when a restore empties them. The signature is
  // skipped if the user explicitly HID it (antcv:signatureHidden='1').
  var SK = ['antcv:signatureB64', 'antcv:signatureAlign', 'antcv:signatureSize', 'antcv:signatureAspect',
    'antcv:clSlogan', 'antcv:clClosing', 'antcv:clSignName', 'antcv:clSloganAlign', 'antcv:clClosingAlign', 'antcv:clSignNameAlign'];
  var SK_STORE = 'antcv:clKeysGuard';
  function guardKeys() {
    var stash = {}; try { stash = JSON.parse(localStorage.getItem(SK_STORE) || '{}') || {}; } catch (_) {}
    var hidden = false; try { hidden = localStorage.getItem('antcv:signatureHidden') === '1'; } catch (_) {}
    var dirty = false, restored = false;
    SK.forEach(function (k) {
      var v = null; try { v = localStorage.getItem(k); } catch (_) {}
      var has = v != null && String(v).trim() !== '';
      if (has) { if (stash[k] !== v) { stash[k] = v; dirty = true; } }
      else if (stash[k] != null && String(stash[k]).trim() !== '') {
        if (k === 'antcv:signatureB64' && hidden) return; // honour an explicit hide
        try { localStorage.setItem(k, stash[k]); restored = true; } catch (_) {}
      }
    });
    if (dirty) { try { localStorage.setItem(SK_STORE, JSON.stringify(stash)); } catch (_) {} }
    if (restored) { try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'cl-keys-guard' } })); } catch (_) {} try { console.log('[CL-PROSE-LOSS-GUARD] re-applied signature / editable CL keys'); } catch (_) {} }
  }

  var t = null;
  function run() {
    if (disabled() || erasing()) return;
    try { reapply(); snapshot(); guardKeys(); } catch (_) { /* self-disable on error */ }
  }
  function debounced() { if (t) clearTimeout(t); t = setTimeout(run, 400); }

  window.addEventListener('antcv:sections-updated', debounced);
  // Boot sweep + later windows to catch a cloud-restore / me()-enforce that
  // out-races the first pass (restore + the converter sidecars settle by ~5s).
  [600, 1500, 3500, 7000, 12000].forEach(function (ms) { setTimeout(run, ms); });
  window.AntcvClProseGuard = { version: VERSION, run: run, snapshot: snapshot, reapply: reapply };
})();
