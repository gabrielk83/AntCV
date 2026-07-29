/* antcv-outcomes-loss-guard.js — SO-003 (register row 40, owner, DATA LOSS)
 * ============================================================================
 * LAST-GOOD SNAPSHOT GUARD for the CV SELECTED OUTCOMES section (`outcomes`).
 *
 * THE BUG (owner): changing the CORE COMPETENCIES row count wipes SELECTED
 * OUTCOMES, and the empty state is CLOUD-PERSISTED (it round-trips; manual
 * recovery only). Diagnosis (SO-003): there is no single deterministic writer
 * that drops the section — the wipe is a stale empty-editor readback race. A
 * core_comp change fires antcv:sections-updated; on the resulting re-render an
 * editor/DOM-sync reads the outcomes editor before it has re-hydrated and commits
 * items:[]. Because an empty array is a valid write it persists to the cloud. The
 * outcomes section carries no personalInfo backing, so the only durable copy is a
 * local snapshot.
 *
 * THIS GUARD (modeled on antcv-corecomp-loss-guard.js): snapshot the REAL
 * outcomes items to a LOCAL-ONLY key (`antcv:outcomesGuard`, NOT cloud-synced, so
 * it survives the round-trip), keyed by application (meta.company|meta.role). When
 * a later sections state shows the outcomes section EMPTY or placeholder-only,
 * RE-APPLY the snapshot. It ONLY ever replaces an empty/placeholder-only section
 * with previously-seen REAL items — it never deletes, empties, or overwrites a
 * section that still has real items, and never crosses applications. Self-disabling
 * on any error. Disable: localStorage['antcv:disable-outcomes-guard']='1'.
 *
 * CV only. Item shape mirrors the app: bullets {b,t} (or a bare string). The
 * placeholder test mirrors app.src.js `Se` (the me() skeleton "[Verb]/[concrete
 * outcome N]" rows), so a skeleton restore never counts as real.
 */
(function () {
  'use strict';
  var VERSION = '1.51.138-outcomes-loss-guard';
  if (window.__antcvOutcomesGuard === VERSION) return;
  window.__antcvOutcomesGuard = VERSION;

  var STORE = 'antcv:outcomesGuard';
  var SECTION_ID = 'outcomes';
  var lastApplyAt = 0;

  function disabled() {
    try { var v = localStorage.getItem('antcv:disable-outcomes-guard'); return v === '1' || v === 'true'; }
    catch (_) { return false; }
  }
  function erasing() {
    try { return !!(localStorage.getItem('antcv:full-erase-in-progress') || localStorage.getItem('antcv:just-erased')); }
    catch (_) { return false; }
  }

  // LANG-GUARD-KEY-001 (owner 2026-07-22 "every generation starts in Chinese"): the
  // loss-guard cache is keyed by application (company|role) but was LANGUAGE-BLIND, so a
  // Chinese generation's cached items were re-injected into a later ENGLISH generation
  // during the skeleton window (empty section -> reapply) — the doc "started in Chinese,
  // then switched to English". Include the current output language in the key so a
  // generation only ever restores from a SAME-LANGUAGE snapshot; a stale zh cache (keyed
  // without a lang suffix) can never poison an en gen — it simply no longer matches.
  function curLang() {
    try { return String(localStorage.getItem('language') || 'en').replace(/["']/g, '').toLowerCase().slice(0, 2) || 'en'; }
    catch (_) { return 'en'; }
  }
  function appKey() {
    var lang = curLang();
    try {
      var m = JSON.parse(localStorage.getItem('meta') || '{}') || {};
      return String((m.company || '') + '|' + (m.role || '') + '|' + lang).slice(0, 200);
    } catch (_) { return '||' + lang; }
  }
  function readSections() {
    try { var v = JSON.parse(localStorage.getItem('sections') || '{}'); return (v && typeof v === 'object') ? v : null; }
    catch (_) { return null; }
  }
  function readStore() {
    try { var v = JSON.parse(localStorage.getItem(STORE) || '{}'); return (v && typeof v === 'object') ? v : {}; }
    catch (_) { return {}; }
  }

  // Text of an outcomes item, mirroring app.src.js `Se`: {b,t} joined, or a bare
  // string. Used by the placeholder test below.
  function itemText(e) {
    return (e && ((e.b || '') + ' ' + (e.t || ''))) || (typeof e === 'string' ? e : '');
  }
  // An item is a PLACEHOLDER if it is empty OR a short bracket-template row
  // (the me() skeleton "[Verb] / [concrete outcome N]"). Byte-mirror of `Se`'s
  // filter predicate so a skeleton-restore is never mistaken for real content.
  function isPlaceholderItem(e) {
    var t = itemText(e);
    if (!String(t).trim()) return true;
    if (/^\s*\[/.test(t) && t.indexOf(']') > 0 && t.replace(/\[[^\]]*\]/g, '').trim().length < 5) return true;
    return false;
  }
  function realItems(items) {
    var out = [];
    if (!Array.isArray(items)) return out;
    for (var i = 0; i < items.length; i++) { if (!isPlaceholderItem(items[i])) out.push(items[i]); }
    return out;
  }

  function outcomesSection(cv) {
    if (!Array.isArray(cv)) return null;
    for (var i = 0; i < cv.length; i++) {
      if (cv[i] && cv[i].id === SECTION_ID && Array.isArray(cv[i].items)) return cv[i];
    }
    return null;
  }

  // REAL = at least one non-placeholder item. Empty items:[] or a placeholder-only
  // (skeleton) section is NOT real.
  function isReal(sec) { return !!(sec && Array.isArray(sec.items) && realItems(sec.items).length > 0); }

  // Snapshot the real outcomes items for the current application (clean items only,
  // so a later restore can never bring skeleton rows back).
  function snapshot() {
    var secs = readSections(); if (!secs || !Array.isArray(secs.cv)) return;
    var sec = outcomesSection(secs.cv);
    if (!sec || !isReal(sec)) return;
    var key = appKey();
    var store = readStore();
    try { store[key] = { items: JSON.parse(JSON.stringify(realItems(sec.items))) }; }
    catch (_) { return; }
    // keep the store small: cap at the 6 most-recent application buckets.
    try {
      var keys = Object.keys(store);
      if (keys.length > 6) { for (var i = 0; i < keys.length - 6; i++) { if (keys[i] !== key) delete store[keys[i]]; } }
    } catch (_) {}
    try { localStorage.setItem(STORE, JSON.stringify(store)); } catch (_) {}
  }

  // Re-apply the snapshotted real items ONLY where the live outcomes section is now
  // empty or placeholder-only AND a real snapshot exists for this app. Never over
  // real content, never cross-app.
  function reapply() {
    var now = (window.performance && performance.now) ? performance.now() : 0;
    if (now && lastApplyAt && (now - lastApplyAt) < 1200) return; // anti-loop
    var secs = readSections(); if (!secs || !Array.isArray(secs.cv)) return;
    var sec = outcomesSection(secs.cv);
    if (!sec) return;                 // section absent - nothing to heal in place
    if (isReal(sec)) return;          // has real items - never touch
    var snap = readStore()[appKey()];
    if (!snap || !Array.isArray(snap.items) || !snap.items.length) return;
    if (!isReal({ items: snap.items })) return; // defence in depth
    var changed = false;
    var cv = secs.cv.map(function (s) {
      if (!s || s.id !== SECTION_ID) return s;
      changed = true;
      var copy = JSON.parse(JSON.stringify(s));
      copy.items = JSON.parse(JSON.stringify(snap.items));
      return copy;
    });
    if (!changed) return;
    lastApplyAt = now || 1;
    secs.cv = cv;
    try { localStorage.setItem('sections', JSON.stringify(secs)); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'outcomes-loss-guard' } })); } catch (_) {}
    try { console.log('[SELECTED-OUTCOMES-LOSS-GUARD] re-applied real outcomes over an emptied/placeholder section (SO-003)'); } catch (_) {}
  }

  var t = null;
  function run() {
    if (disabled() || erasing()) return;
    try { reapply(); snapshot(); } catch (_) { /* self-disable on error */ }
  }
  function debounced() { if (t) clearTimeout(t); t = setTimeout(run, 400); }

  window.addEventListener('antcv:sections-updated', function (ev) {
    // Ignore our own write to avoid a self-triggered loop.
    try { if (ev && ev.detail && ev.detail.reason === 'outcomes-loss-guard') return; } catch (_) {}
    debounced();
  });
  // Boot sweep + later windows to catch a cloud-restore that out-races the first
  // pass (restore + converter sidecars settle by ~5s).
  [600, 1500, 3500, 7000, 12000].forEach(function (ms) { setTimeout(run, ms); });
  // Forever poll (like the corecomp / cl-prose guards): the wipe can strike long
  // after boot. Safe because reapply ONLY replaces an empty/placeholder section
  // with a real snapshot, never a real value, so it cannot fight a genuine edit.
  setInterval(run, 2500);

  window.AntcvOutcomesGuard = {
    version: VERSION, run: run, snapshot: snapshot, reapply: reapply,
    _isReal: isReal, _isPlaceholderItem: isPlaceholderItem, _realItems: realItems,
  };
})();
