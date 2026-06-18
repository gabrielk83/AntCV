/* antcv-group-name-visibility.js — GROUP-NAME-VISIBILITY-001 (owner 2026-06-16)
 * ============================================================================
 * Sets a non-destructive `labelHidden` flag on labeled_list rows so the PREVIEW
 * render (app.js, GROUP-NAME-VISIBILITY-001) and the worker export show the row's
 * VALUE without its bold group name. Two rules (owner):
 *
 *  RULE 1 — single-group subsubsection: within a labeled_list, items are split
 *  into subsubsections by `{group:"…"}` markers (rows before the first marker are
 *  the lead subsubsection). A subsubsection holding exactly ONE labeled `{l,v}` row
 *  hides that row's name (the section/subsubsection heading already labels it; the
 *  lone label is redundant). Items stay visible.
 *
 *  RULE 2 — tools / methods: keep the name on the up-to-4 most JD-relevant groups
 *  (JD = antcv:lastJdText; no JD → first 4 in order), hide the rest's name (values
 *  stay). This trims a wall of labels to the 2-4 that matter for the position.
 *
 *  MANUAL OVERRIDE: a row the user explicitly re-shows is recorded in the STANDALONE
 *  key `antcv:groupNameShow` ({ "sectionId#label": true }) and is never hidden —
 *  clobber-proof (not stored on the section). The labelHidden flag itself is written
 *  onto the section items and RE-APPLIED on every restore (loop-safe, write-on-change).
 *
 * No app.js mirror of LOGIC (the render honor is in app.js; the rules live here).
 */
(function () {
  'use strict';
  var VERSION = '1.50.633-tools-labels-show';
  if (window.__antcvGroupNameVis === VERSION) return;
  window.__antcvGroupNameVis = VERSION;

  var SRC = 'group-name-visibility';
  var SHOW_KEY = 'antcv:groupNameShow';   // { "sectionId#label": true } — manual re-show
  var MAX_NAMED = 4;                        // tools/methods: keep up to 4 names

  function rj(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; } }
  function jd() { try { return String(localStorage.getItem('antcv:lastJdText') || '').toLowerCase(); } catch (_) { return ''; } }
  function isLV(it) { return it && typeof it === 'object' && it.group === undefined && (it.l !== undefined || it.v !== undefined); }
  function rowText(it) { return String(((it && it.l) || '') + ' ' + ((it && it.v) || '')).toLowerCase(); }
  function isToolsMethods(sec) { var s = String((sec.id || '') + ' ' + (sec.title || '')); return /tool|method/i.test(s); }

  // tokens of >=4 chars present in the JD, used to score a tools/methods row.
  function jdScore(it, jw) { if (!jw.length) return 0; var t = rowText(it); var n = 0; jw.forEach(function (w) { if (t.indexOf(w) >= 0) n++; }); return n; }

  // returns a Set of item indices whose label should be HIDDEN for this section.
  function hiddenSet(sec, showMap) {
    var items = Array.isArray(sec.items) ? sec.items : [];
    var hide = {};
    // TOOLS-METHODS-LABELS-SHOW-001 (owner 2026-06-18): tools/methods sections
    // now show EVERY row's bold "Label:" opener in the preview — the owner asked
    // for it back on all of them ("for many of the Tools and method the opening
    // (Part in Bold and :) is not showing"). This reverses RULE 2's up-to-4 trim
    // AND skips RULE 1 for these sections; other labeled_list sections keep RULE 1.
    // (apply() then STRIPS any labelHidden flag already on these rows → labels show.)
    if (isToolsMethods(sec)) return hide;
    // RULE 1 — partition into subsubsections by {group} markers, hide lone rows.
    var cur = [];
    var subs = [];
    items.forEach(function (it, i) {
      if (it && typeof it === 'object' && it.group !== undefined) { subs.push(cur); cur = []; }
      else if (isLV(it)) cur.push(i);
    });
    subs.push(cur);
    subs.forEach(function (sub) { if (sub.length === 1) hide[sub[0]] = true; });
    // RULE 2 — tools/methods: keep up to MAX_NAMED most-relevant named, hide rest.
    if (isToolsMethods(sec)) {
      var lvIdx = [];
      items.forEach(function (it, i) { if (isLV(it)) lvIdx.push(i); });
      if (lvIdx.length > MAX_NAMED) {
        var jw = jd().split(/[^a-z0-9]+/).filter(function (w) { return w.length >= 4; });
        var ranked = lvIdx.slice().sort(function (a, b) { return jdScore(items[b], jw) - jdScore(items[a], jw); });
        // when no JD signal, ranked is a stable no-op → keep ORIGINAL order's first 4.
        var keep = {};
        (jw.length ? ranked : lvIdx).slice(0, MAX_NAMED).forEach(function (i) { keep[i] = true; });
        lvIdx.forEach(function (i) { if (!keep[i]) hide[i] = true; });
      }
    }
    // MANUAL OVERRIDE — never hide a row the user explicitly re-showed.
    items.forEach(function (it, i) { if (hide[i] && isLV(it)) { var key = (sec.id || '') + '#' + ((it.l || '').trim()); if (showMap[key]) delete hide[i]; } });
    return hide;
  }

  function apply() {
    var b = rj('sections', null); if (!b) return;
    var showMap = rj(SHOW_KEY, {}) || {};
    var changed = false;
    var docs = ['cv', 'cl'];
    var nb = Object.assign({}, b);
    docs.forEach(function (dk) {
      var list = b[dk]; if (!Array.isArray(list)) return;
      var nextList = list.map(function (sec) {
        if (!sec || sec.type !== 'labeled_list' || !Array.isArray(sec.items)) return sec;
        var hide = hiddenSet(sec, showMap);
        var secChanged = false;
        var nextItems = sec.items.map(function (it, i) {
          if (!isLV(it)) { if (it && it.labelHidden) { secChanged = true; return stripFlag(it); } return it; }
          var want = !!hide[i];
          if (!!it.labelHidden === want) return it;
          secChanged = true;
          return want ? Object.assign({}, it, { labelHidden: true }) : stripFlag(it);
        });
        if (secChanged) { changed = true; return Object.assign({}, sec, { items: nextItems }); }
        return sec;
      });
      nb[dk] = nextList;
    });
    if (changed) {
      try { localStorage.setItem('sections', JSON.stringify(nb)); } catch (_) { return; }
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: SRC } })); } catch (_) {}
    }
  }
  function stripFlag(it) { var c = Object.assign({}, it); delete c.labelHidden; return c; }

  // public: manually re-show (or re-hide) a row's group name; persists clobber-proof.
  function showName(sectionId, label, show) {
    var m = rj(SHOW_KEY, {}) || {}; var key = (sectionId || '') + '#' + String(label || '').trim();
    if (show) m[key] = true; else delete m[key];
    try { localStorage.setItem(SHOW_KEY, JSON.stringify(m)); } catch (_) {}
    tick();
  }

  var pending = false;
  function tick() { if (pending) return; pending = true; (window.requestAnimationFrame || setTimeout)(function () { pending = false; try { apply(); } catch (_) {} }); }

  [400, 1200, 2600].forEach(function (d) { setTimeout(tick, d); });
  try { window.addEventListener('antcv:sections-updated', function (e) { if (!(e && e.detail && e.detail.source === SRC)) tick(); }); } catch (_) {}
  try { window.addEventListener('storage', function (e) { if (!e || e.key === 'sections' || e.key === SHOW_KEY || e.key === 'antcv:lastJdText' || e.key === null) tick(); }); } catch (_) {}
  setInterval(tick, 3000);

  window.AntcvGroupNameVisibility = { version: VERSION, _apply: apply, _hiddenSet: hiddenSet, showName: showName };
})();
