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
  var VERSION = '1.51.74-cl-prose-unsol-poison';
  if (window.__antcvClProseGuard985 === VERSION) return;
  window.__antcvClProseGuard985 = VERSION;

  var STORE = 'antcv:clProseGuard';
  // The CL prose sections that are render-hydrated and lost on a stale restore.
  // (bring is persisted by antcv-nordic-cl-order-971; closure by the editor; both
  //  are included as belt-and-suspenders — re-applying a real value is harmless.)
  var GUARDED = ['opening', 'why', 'who', 'foundation', 'contribute', 'closure', 'bring'];
  // Canonical CL section order (Nordic) — used to re-insert a guarded section that a
  // stale restore DELETED outright at its correct position. See CL-PROSE-LOSS-GUARD-002.
  var ORDER = ['greeting', 'opening', 'why', 'who', 'foundation', 'bring', 'contribute', 'closure'];
  var lastApplyAt = 0;

  function disabled() { try { var v = localStorage.getItem('antcv:disable-cl-prose-guard'); return v === '1' || v === 'true'; } catch (_) { return false; } }
  function erasing() { try { return !!(localStorage.getItem('antcv:full-erase-in-progress') || localStorage.getItem('antcv:just-erased')); } catch (_) { return false; } }

  function appKey() {
    try {
      var m = JSON.parse(localStorage.getItem('meta') || '{}') || {};
      return String((m.company || '') + '|' + (m.role || '')).slice(0, 200);
    } catch (_) { return '|'; }
  }
  // CL-PROSE-UNSOL-POISON-001 (owner 2026-07-03): an UNSOLICITED application's CL prose
  // must never be snapshotted or re-applied by this guard. Root cause of "an unsolicited
  // application went all Terma": meta.company was flipped to "Unsolicited" while a prior
  // TARGETED company's CL body was still live in sections, so snapshot() captured that
  // company's prose under the "Unsolicited|<role>" bucket and reapply() re-injected it
  // forever. Unsolicited prose is company-neutral and regenerable — it does not need
  // loss-protection, and skipping the guard here makes cross-company poisoning impossible.
  // (guardKeys() for signature/slogan is NOT gated — those are not company-specific.)
  function isUnsolicited() {
    try {
      var m = JSON.parse(localStorage.getItem('meta') || '{}') || {};
      var c = String(m.company || '').trim().toLowerCase();
      // EXPLICIT "unsolicited" only — an EMPTY company is the transient fresh-generation
      // window (before meta is stamped) that CL-BLANK-CAPTURE-001 relies on to snapshot
      // prose early; gating it would drop real prose. The poison was the explicit
      // "Unsolicited|<role>" bucket, which this catches.
      return c === 'unsolicited';
    } catch (_) { return false; }
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
      // CL-BLANK-001: a section is REAL only if a BODY (it.t) is real. The lead LABEL
      // (it.b, e.g. "Who I am") survives an empty generation, so counting it as prose
      // makes an empty-body-but-labelled section masquerade as real and defeats restore.
      for (var i = 0; i < sec.items.length; i++) {
        var it = sec.items[i];
        var t = it && typeof it === 'object' ? it.t : it; // body only — ignore the it.b label
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
    if (isUnsolicited()) return;   // never capture prose under an unsolicited key
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
    if (isUnsolicited()) return;   // never re-inject a company's prose into an unsolicited app
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
    // CL-PROSE-LOSS-GUARD-002 (owner 2026-07: "the whole HOW I WOULD CONTRIBUTE section
    // is gone after an edit"). The placeholder<-snapshot map above can only heal a section
    // that is still PRESENT (as a placeholder). A stale cloud / me()-enforce restore can
    // DELETE a guarded prose section outright — the map never sees it, so HWIC silently
    // vanishes from the export. Re-INSERT any guarded section that has a REAL snapshot but
    // is now ABSENT from cl, at its canonical CL position. Only ever ADDS back previously
    // seen real content; the disable switch + per-application keying still apply. (A
    // deliberate delete of a core CL section is rare and re-hideable; losing HWIC on export
    // is the worse failure — the owner's #1 bug.)
    var liveIds = {};
    cl.forEach(function (s) { if (s && s.id) liveIds[s.id] = true; });
    GUARDED.forEach(function (id) {
      if (liveIds[id]) return;
      var snap = bucket[id];
      if (!snap || !isReal(snap)) return;
      var oi = ORDER.indexOf(id);
      var at = cl.length;
      for (var j = 0; j < cl.length; j++) {
        var jOi = ORDER.indexOf(cl[j] && cl[j].id);
        if (jOi >= 0 && jOi > oi) { at = j; break; }
      }
      cl.splice(at, 0, JSON.parse(JSON.stringify(snap)));
      liveIds[id] = true;
      changed = true;
      try { console.log('[CL-PROSE-LOSS-GUARD] re-inserted missing CL section: ' + id); } catch (_) {}
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

  // CL-BLANK-CAPTURE-001 (owner 2026-07-01: "cover letter mostly empty, needs a 2nd
  // generation"). On the FIRST generation the real who/why/opening prose exists only
  // briefly before a stale cloud / me()-enforce restore reverts those sections to the
  // EMPTY Nordic skeleton ({items:[{b:label,t:""}]}) — and the 400ms-debounced snapshot
  // ran too late, so the guard had no real snapshot to restore from (foundation/bring
  // survive because they apply as direct items; who/why/opening apply as .content +
  // the 987 bridge and are the ones lost). Snapshot SYNCHRONOUSLY on every
  // sections-updated so the real prose is captured the instant it appears, before the
  // clobber. Additive + idempotent: snapshot ONLY ever STORES a real section, never
  // removes or overwrites a real value, so an extra early capture cannot regress
  // anything. Honours the kill switch / erase gate.
  window.addEventListener('antcv:sections-updated', function () {
    if (disabled() || erasing()) return;
    try { snapshot(); } catch (_) { /* self-disable on error */ }
  });
  window.addEventListener('antcv:sections-updated', debounced);
  // Boot sweep + later windows to catch a cloud-restore / me()-enforce that
  // out-races the first pass (restore + the converter sidecars settle by ~5s).
  [600, 1500, 3500, 7000, 12000].forEach(function (ms) { setTimeout(run, ms); });
  // PROSE-GUARD-POLL-001 (owner 2026-07): on a HEAVY load the cloud / me()-enforce restore
  // can placeholder opening/why/who LONG after the boot sweeps (the renderer freezes 45-60s),
  // so the preview + export stayed half-empty. A forever poll (like sections-normalize-415)
  // keeps restoring — safe because reapply ONLY ever replaces a PLACEHOLDER with a real
  // snapshot, never a real value, so it cannot fight a genuine user edit.
  setInterval(run, 2500);
  window.AntcvClProseGuard = { version: VERSION, run: run, snapshot: snapshot, reapply: reapply };
})();
