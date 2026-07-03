/* antcv-sidebar-visibility-ux.js — SIDEBAR-LONGPRESS-HIDE-001 + VISIBILITY-FEEDBACK-001
 * ============================================================================
 * Owner (2026-07-03): "I can in the preview select a sidebar element, long
 * press it, and get a selection menu including the option to hide the element,
 * so it is now entering the hidden group (or generate the hidden group if no
 * such). And you will add to analytics cases I chose to unhide or hide that
 * are not fit to your generation in order to improve your work in the future."
 *
 * THREE legs:
 *
 *  1. LONG-PRESS MENU — press-and-hold (~550ms, or right-click) on a sidebar
 *     row in the PREVIEW ([data-sid] section, loc:'sidebar', row
 *     [data-antcv-row-path^="items."]) opens a small menu:
 *       - for a multi-token tools row: one "Hide <token>" entry per token —
 *         the token is removed from the line and the tools-hidden-residue
 *         sidecar collects it into the per-application "Hidden - <category>"
 *         group (created when absent; non-kernel tokens are preserved there
 *         via the reconcile extension shipped with this file).
 *       - "Hide entire element" — classic per-item hidden:true (greyed row
 *         with the eye in the panel).
 *  2. ANALYTICS — every manual hide/unhide is by construction an override of
 *     what the generation chose, so ALL of them are recorded to
 *     localStorage 'antcv:visibilityAnalytics' (capped array of
 *     {t, app, sid, label, token, action, src}). Besides the menu's own
 *     actions, an observer diffs consecutive `sections` snapshots and logs
 *     panel-eye flips and residue-row restores — gated to small diffs
 *     (<= 4 changes) so a full generation/restore write is never
 *     misattributed to the user.
 *  3. FEEDBACK LOOP — a compact summary of the latest overrides is kept in
 *     'antcv:visibility-feedback'; the generation prompt (both bundles,
 *     VISIBILITY-FEEDBACK-001 injection) passes it to the model so future
 *     generations honor the user's demonstrated hide/keep preferences.
 *
 * setTimeout debounce only (STICKY-LEAK-005). Loop-safe: own tagged event
 * ignored; observer keeps its own last-snapshot.
 * Disable: localStorage['antcv:disable-sidebar-visibility-ux'] = '1'.
 */
(function () {
  'use strict';
  if (window.__antcvSidebarVisibilityUx) return;
  window.__antcvSidebarVisibilityUx = '1.51.117';

  var SRC = 'sidebar-visibility-ux';
  var LOG_KEY = 'antcv:visibilityAnalytics';
  var FEEDBACK_KEY = 'antcv:visibility-feedback';
  var LOG_CAP = 400;
  var FEEDBACK_MAX = 30;
  var RESIDUE_RE = /^\s*hidden\s*[-–—:]\s*/i;

  function disabled() { try { var v = localStorage.getItem('antcv:disable-sidebar-visibility-ux'); return v === '1' || v === 'true'; } catch (_) { return false; } }

  // RICHBLOCK-SHAPE-001: tools (and other converted sections) carry rich_block
  // items {b,t,bullets} with {grp:true} group rows; visibility for those lives
  // in the SECTION-LEVEL hidden index map, not it.hidden.
  function labelOf(it) { return it && typeof it === 'object' ? (it.l != null ? it.l : (it.b != null ? it.b : '')) : ''; }
  function valOf(it) { return it && typeof it === 'object' ? (it.v != null ? it.v : (it.t != null ? it.t : '')) : (it == null ? '' : it); }
  function isGroupRow(it) { return !!(it && typeof it === 'object' && (it.group !== undefined || it.grp)); }
  function isRichItem(it) { return !!(it && typeof it === 'object' && it.l == null && it.v == null && (it.b !== undefined || it.t !== undefined)); }
  function setVal(it, v) { return it.v != null || it.l != null ? Object.assign({}, it, { v: v }) : Object.assign({}, it, { t: v }); }

  function tokensOf(v) {
    try { if (window.AntcvToolsHiddenResidue) return window.AntcvToolsHiddenResidue._tokens(v); } catch (_) {}
    return String(v == null ? '' : v).split(/[,;]/).map(function (t) { return t.trim(); })
      .filter(function (t) { return t.length >= 2 && t.indexOf('[') === -1; });
  }

  function appContext() {
    try {
      var m = JSON.parse(localStorage.getItem('meta') || '{}') || {};
      var c = String(m.company || '').trim(), r = String(m.role || '').trim();
      if (c || r) return (c || 'Unsolicited') + '|' + (r || '');
    } catch (_) {}
    return 'Unsolicited|';
  }

  // ---------- analytics ----------
  function readLog() {
    try { var a = JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (_) { return []; }
  }
  function logEvent(ev) {
    try {
      var a = readLog();
      a.push(ev);
      if (a.length > LOG_CAP) a = a.slice(a.length - LOG_CAP);
      localStorage.setItem(LOG_KEY, JSON.stringify(a));
      rebuildFeedback(a);
    } catch (_) {}
  }

  // Compact prompt-ready summary: latest decision per (label, token) wins.
  function buildFeedback(events) {
    var latest = {}, order = [];
    events.forEach(function (e) {
      if (!e || (e.action !== 'hide' && e.action !== 'unhide')) return;
      var k = (e.sid || '') + '|' + (e.label || '') + '|' + (e.token || '');
      if (!(k in latest)) order.push(k);
      latest[k] = e;
    });
    var lines = [];
    for (var i = order.length - 1; i >= 0 && lines.length < FEEDBACK_MAX; i--) {
      var e = latest[order[i]];
      var what = e.token ? '"' + e.token + '" (' + (e.label || e.sid) + ')' : '"' + (e.label || e.sid) + '" (whole element)';
      lines.push((e.action === 'hide' ? 'HIDE: ' : 'KEEP VISIBLE: ') + what + ' — user ' + (e.action === 'hide' ? 'hid it' : 'restored it') + ' [' + (e.app || '') + ']');
    }
    return lines.join('\n');
  }
  function rebuildFeedback(events) {
    try {
      var txt = buildFeedback(events || readLog());
      if (txt) localStorage.setItem(FEEDBACK_KEY, txt);
      else localStorage.removeItem(FEEDBACK_KEY);
    } catch (_) {}
  }

  // ---------- observer: infer hide/unhide events from sections diffs ----------
  // Pure: returns events for sidebar labeled_list/list item visibility changes
  // between two sections blobs. null/oversized diffs return [].
  function diffEvents(prevBlob, nextBlob, app) {
    var out = [];
    try {
      var pcv = (prevBlob && prevBlob.cv) || [], ncv = (nextBlob && nextBlob.cv) || [];
      var pById = {};
      pcv.forEach(function (s) { if (s && s.loc === 'sidebar' && Array.isArray(s.items)) pById[s.id] = s; });
      ncv.forEach(function (s) {
        if (!s || s.loc !== 'sidebar' || !Array.isArray(s.items)) return;
        var p = pById[s.id];
        if (!p) return;
        // Index rows by normalized label (labels are stable across a flip).
        var pByLabel = {}, pHid = p.hidden || {}, nHid = s.hidden || {};
        p.items.forEach(function (it, i) {
          var L = String(labelOf(it)).trim();
          if (it && typeof it === 'object' && !isGroupRow(it) && L) pByLabel[L.toLowerCase()] = { it: it, i: i };
        });
        s.items.forEach(function (it, i) {
          if (!it || typeof it !== 'object' || isGroupRow(it)) return;
          var L = String(labelOf(it)).trim();
          if (!L) return;
          var prev = pByLabel[L.toLowerCase()];
          if (!prev) return;
          // Visibility = it.hidden (labeled shape) OR the section index map (rich shape).
          var wasHidden = prev.it.hidden === true || pHid[prev.i] === true;
          var isHidden = it.hidden === true || nHid[i] === true;
          if (wasHidden === isHidden) return;
          var residue = RESIDUE_RE.test(L);
          if (residue) {
            // Un-hiding a residue row = restoring its tokens.
            if (!isHidden) tokensOf(valOf(it)).forEach(function (t) {
              out.push({ t: new Date().toISOString(), app: app, sid: s.id, label: L.replace(RESIDUE_RE, '').trim(), token: t, action: 'unhide', src: 'residue-eye' });
            });
          } else {
            out.push({ t: new Date().toISOString(), app: app, sid: s.id, label: L, token: null, action: isHidden ? 'hide' : 'unhide', src: 'panel-eye' });
          }
        });
      });
    } catch (_) { return []; }
    // A generation / cloud restore rewrites broadly — never misattribute it.
    if (out.length > 4) return [];
    return out;
  }

  var lastBlobRaw = null;
  function observe() {
    if (disabled()) return;
    try {
      var raw = localStorage.getItem('sections');
      if (!raw || raw === lastBlobRaw) return;
      var prevRaw = lastBlobRaw;
      lastBlobRaw = raw;
      if (prevRaw == null) return;                      // first sight — baseline only
      var evs = diffEvents(JSON.parse(prevRaw), JSON.parse(raw), appContext());
      evs.forEach(logEvent);
    } catch (_) {}
  }

  // ---------- long-press menu ----------
  var press = { timer: null, x: 0, y: 0, el: null };
  var menuEl = null;

  function closeMenu() {
    if (menuEl && menuEl.parentNode) menuEl.parentNode.removeChild(menuEl);
    menuEl = null;
  }

  function findRow(target) {
    if (!target || !target.closest) return null;
    var rowEl = target.closest('[data-antcv-row-path^="items."]');
    if (!rowEl) return null;
    var secEl = rowEl.closest('[data-sid]');
    if (!secEl) return null;
    var sid = secEl.getAttribute('data-sid');
    var idx = parseInt(String(rowEl.getAttribute('data-antcv-row-path')).slice(6), 10);
    if (!sid || isNaN(idx)) return null;
    try {
      var b = JSON.parse(localStorage.getItem('sections') || '{}') || {};
      var sec = (b.cv || []).find(function (s) { return s && s.id === sid; });
      if (!sec || sec.loc !== 'sidebar' || !Array.isArray(sec.items)) return null;
      var it = sec.items[idx];
      if (!it || typeof it !== 'object' || isGroupRow(it)) return null;
      if (RESIDUE_RE.test(String(labelOf(it)))) return null;   // residue rows never render anyway
      // Residue tokens of THIS category (for the menu's Restore entries).
      var category = String(labelOf(it)).trim();
      var residueToks = [];
      sec.items.forEach(function (r) {
        if (r && typeof r === 'object' && !isGroupRow(r) && RESIDUE_RE.test(String(labelOf(r))) &&
            String(labelOf(r)).replace(RESIDUE_RE, '').trim().toLowerCase() === category.toLowerCase()) {
          residueToks = residueToks.concat(tokensOf(valOf(r)));
        }
      });
      return { sid: sid, idx: idx, item: it, el: rowEl, rich: isRichItem(it), residueToks: residueToks };
    } catch (_) { return null; }
  }

  function writeSections(mut) {
    try {
      var b = JSON.parse(localStorage.getItem('sections') || '{}') || {};
      if (!mut(b)) return false;
      var os = JSON.stringify(b);
      lastBlobRaw = os;                                  // own write — not a user diff
      localStorage.setItem('sections', os);
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: SRC } })); } catch (_) {}
      return true;
    } catch (_) { return false; }
  }

  function hideToken(row, token) {
    var ok = writeSections(function (b) {
      var sec = (b.cv || []).find(function (s) { return s && s.id === row.sid; });
      if (!sec || !Array.isArray(sec.items)) return false;
      var it = sec.items[row.idx];
      if (!it) return false;
      pushUndo(sec, 'Hid “' + token + '”');
      var toks = tokensOf(valOf(it)).filter(function (t) { return t !== token; });
      if (tokensOf(valOf(it)).length === toks.length) { popUndo(); return false; }
      sec.items[row.idx] = setVal(it, toks.join(', '));
      // Upsert the Hidden group NOW (owner: "or generate the hidden group if no
      // such") so the move is visible immediately even before the residue
      // sidecar's next reconcile pass. Created in the SECTION's own shape:
      // rich rows carry no flag (RESIDUE-PREVIEW-SKIP hides them everywhere),
      // labeled rows get hidden:true.
      var label = 'Hidden - ' + String(labelOf(it)).trim();
      var res = null;
      sec.items.forEach(function (x) { if (!res && x && typeof x === 'object' && !isGroupRow(x) && String(labelOf(x)).trim().toLowerCase() === label.toLowerCase()) res = x; });
      if (res) {
        if (tokensOf(valOf(res)).indexOf(token) === -1) {
          var rv = String(valOf(res)).trim().replace(/[,;\s]+$/, '');
          var ri = sec.items.indexOf(res);
          sec.items[ri] = setVal(res, (rv ? rv + ', ' : '') + token);
          if (!isRichItem(res)) sec.items[ri].hidden = true;
        }
      } else sec.items.push(isRichItem(it) ? { b: label, t: token, bullets: [] } : { l: label, v: token, hidden: true });
      return true;
    });
    if (ok) {
      logEvent({ t: new Date().toISOString(), app: appContext(), sid: row.sid, label: String(labelOf(row.item)).trim(), token: token, action: 'hide', src: 'longpress' });
      showToast('Hidden “' + trunc(token, 24) + '”');
    }
  }

  function hideRow(row) {
    var ok = writeSections(function (b) {
      var sec = (b.cv || []).find(function (s) { return s && s.id === row.sid; });
      if (!sec || !Array.isArray(sec.items) || !sec.items[row.idx]) return false;
      pushUndo(sec, 'Hid “' + trunc(String(labelOf(row.item)), 24) + '”');
      if (isRichItem(sec.items[row.idx])) {
        // RICH shape: the renderer + the panel eye both use the SECTION-LEVEL
        // hidden index map — it.hidden is IGNORED there (the owner's
        // forever-hidden bug). Write the map so the panel shows the monkey and
        // the eye can restore.
        var h = Array.isArray(sec.hidden) ? sec.hidden.slice() : Object.assign({}, sec.hidden || {});
        h[row.idx] = true;
        sec.hidden = h;
      } else {
        sec.items[row.idx] = Object.assign({}, sec.items[row.idx], { hidden: true });
      }
      return true;
    });
    if (ok) {
      logEvent({ t: new Date().toISOString(), app: appContext(), sid: row.sid, label: String(labelOf(row.item)).trim(), token: null, action: 'hide', src: 'longpress' });
      showToast('Hidden “' + trunc(String(labelOf(row.item)), 24) + '”');
    }
  }

  function openMenu(row, x, y) {
    closeMenu();
    var m = document.createElement('div');
    m.setAttribute('data-antcv-visibility-menu', '1');
    m.style.cssText = 'position:fixed;z-index:99999;background:#fff;border:1px solid #bbb;border-radius:6px;box-shadow:0 4px 14px rgba(0,0,0,0.25);font:12px Georgia,serif;min-width:190px;max-width:280px;max-height:60vh;overflow-y:auto;padding:4px 0;';
    function addEntry(text, fn, bold) {
      var d = document.createElement('div');
      d.textContent = text;
      d.style.cssText = 'padding:7px 12px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' + (bold ? 'font-weight:700;' : '');
      d.addEventListener('mouseenter', function () { d.style.background = '#f0f6fa'; });
      d.addEventListener('mouseleave', function () { d.style.background = ''; });
      d.addEventListener('click', function (e) { e.stopPropagation(); closeMenu(); if (fn) fn(); });
      m.appendChild(d);
    }
    var toks = tokensOf(valOf(row.item));
    if (toks.length >= 2) toks.forEach(function (t) {
      addEntry('🙈 Hide “' + trunc(t, 34) + '”', function () { hideToken(row, t); });
    });
    addEntry('🙈 Hide entire element', function () { hideRow(row); }, true);
    // Restore entries for tokens sitting in this category's Hidden group (rich
    // rows have no eye-flag path, so the menu IS the restore surface).
    (row.residueToks || []).forEach(function (t) {
      addEntry('↩ Restore “' + trunc(t, 30) + '”', function () { restoreToken(row, t); });
    });
    if (undoStack.length) addEntry('↩ Undo: ' + undoStack[undoStack.length - 1].desc, function () { undoLast(); });
    addEntry('Cancel', null);
    document.body.appendChild(m);
    var w = m.offsetWidth, h = m.offsetHeight;
    m.style.left = Math.max(4, Math.min(x, (window.innerWidth || 800) - w - 4)) + 'px';
    m.style.top = Math.max(4, Math.min(y, (window.innerHeight || 600) - h - 4)) + 'px';
    menuEl = m;
    setTimeout(function () {
      document.addEventListener('pointerdown', function outside(e) {
        if (menuEl && !menuEl.contains(e.target)) closeMenu();
        document.removeEventListener('pointerdown', outside, true);
      }, true);
    }, 0);
  }

  // ---------- undo + toast (owner: "there is no undo for this hiding, and no
  // undo for resizing of sidebar or table") ----------
  function trunc(t, n) { t = String(t); return t.length > n ? t.slice(0, n - 1) + '…' : t; }
  var undoStack = [];   // {desc, kind:'section', sid, prev} | {desc, kind:'key', key, prev}
  function pushUndo(sec, desc) {
    try { undoStack.push({ desc: desc, kind: 'section', sid: sec.id, prev: JSON.parse(JSON.stringify(sec)) }); if (undoStack.length > 20) undoStack.shift(); } catch (_) {}
  }
  function popUndo() { undoStack.pop(); }
  function undoLast() {
    var u = undoStack.pop();
    if (!u) return;
    if (u.kind === 'section') {
      writeSections(function (b) {
        var i = (b.cv || []).findIndex(function (s) { return s && s.id === u.sid; });
        if (i < 0) return false;
        b.cv[i] = u.prev;
        return true;
      });
      logEvent({ t: new Date().toISOString(), app: appContext(), sid: u.sid, label: '', token: null, action: 'undo', src: 'undo' });
      showToast('Undone: ' + u.desc, true);
    } else if (u.kind === 'key') {
      if (!driveRoller(u.key, u.prev)) { try { localStorage.setItem(u.key, JSON.stringify(u.prev)); } catch (_) {} }
      resizeSeen[u.key] = JSON.stringify(u.prev);
      showToast('Undone: ' + u.desc, true);
    }
  }

  var toastEl = null, toastTimer = null;
  function showToast(msg, noUndo) {
    try {
      if (toastEl && toastEl.parentNode) toastEl.parentNode.removeChild(toastEl);
      if (toastTimer) clearTimeout(toastTimer);
      var d = document.createElement('div');
      d.setAttribute('data-antcv-visibility-toast', '1');
      d.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:26px;z-index:99999;background:#123;color:#fff;border-radius:8px;padding:9px 14px;font:12.5px Georgia,serif;box-shadow:0 4px 14px rgba(0,0,0,0.35);display:flex;gap:12px;align-items:center;max-width:92vw;';
      var span = document.createElement('span');
      span.textContent = msg;
      span.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      d.appendChild(span);
      if (!noUndo && undoStack.length) {
        var u = document.createElement('button');
        u.textContent = 'UNDO';
        u.style.cssText = 'background:none;border:1px solid #7fd;color:#7fd;border-radius:5px;padding:3px 10px;font:700 12px Georgia,serif;cursor:pointer;flex-shrink:0;';
        u.addEventListener('click', function (e) { e.stopPropagation(); undoLast(); });
        d.appendChild(u);
      }
      document.body.appendChild(d);
      toastEl = d;
      toastTimer = setTimeout(function () { if (toastEl && toastEl.parentNode) toastEl.parentNode.removeChild(toastEl); toastEl = null; }, 9000);
    } catch (_) {}
  }

  function restoreToken(row, token) {
    var category = String(labelOf(row.item)).trim();
    var done = false;
    try {
      var b0 = JSON.parse(localStorage.getItem('sections') || '{}') || {};
      var sec0 = (b0.cv || []).find(function (x) { return x && x.id === row.sid; });
      if (sec0) pushUndo(sec0, 'Restored “' + trunc(token, 24) + '”');
      if (window.AntcvToolsHiddenResidue && window.AntcvToolsHiddenResidue.restoreToken) {
        done = window.AntcvToolsHiddenResidue.restoreToken(row.sid, category, token);
      }
      if (!done) popUndo();
    } catch (_) {}
    if (done) {
      logEvent({ t: new Date().toISOString(), app: appContext(), sid: row.sid, label: category, token: token, action: 'unhide', src: 'longpress' });
      showToast('Restored “' + trunc(token, 24) + '”');
    }
  }

  // ---------- resize undo: sidebar splitter + table column rollers ----------
  var RESIZE_KEYS = {
    cvSidebarRatio: { desc: 'Sidebar resize', title: 'Sidebar width as % of total CV page width' },
    cvTableRatio: { desc: 'CV table resize', title: 'CV table: Focus Area column width' },
    clTableRatio: { desc: 'CL table resize', title: 'CL table: Focus Area column width' },
  };
  var resizeSeen = {}, resizePrev = {}, resizeBaselined = false;
  function driveRoller(key, ratio) {
    try {
      var conf = RESIZE_KEYS[key];
      if (!conf) return false;
      var input = null;
      var wraps = document.querySelectorAll('.antcv-top-sliders [title]');
      for (var i = 0; i < wraps.length; i++) {
        if ((wraps[i].getAttribute('title') || '').indexOf(conf.title) === 0) { input = wraps[i].querySelector('input[type="range"]'); if (input) break; }
      }
      if (!input) return false;
      var pct = String(Math.round(Number(ratio) * 100));
      var proto = window.HTMLInputElement && window.HTMLInputElement.prototype;
      var desc = proto && Object.getOwnPropertyDescriptor(proto, 'value');
      if (desc && typeof desc.set === 'function') desc.set.call(input, pct); else input.value = pct;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } catch (_) { return false; }
  }
  function watchResizes() {
    try {
      for (var key in RESIZE_KEYS) {
        var raw = localStorage.getItem(key);
        if (raw == null) continue;
        if (!(key in resizeSeen)) { resizeSeen[key] = raw; continue; }
        if (raw === resizeSeen[key]) { delete resizePrev[key]; continue; }
        // changed: wait until the value is STABLE across two polls (drag ended)
        if (resizePrev[key] === raw) {
          var prevVal = null;
          try { prevVal = JSON.parse(resizeSeen[key]); } catch (_) { prevVal = Number(resizeSeen[key]); }
          if (prevVal != null && isFinite(Number(prevVal))) {
            undoStack.push({ desc: RESIZE_KEYS[key].desc, kind: 'key', key: key, prev: Number(prevVal) });
            if (undoStack.length > 20) undoStack.shift();
            showToast(RESIZE_KEYS[key].desc);
          }
          resizeSeen[key] = raw;
          delete resizePrev[key];
        } else resizePrev[key] = raw;
      }
    } catch (_) {}
  }
  setInterval(watchResizes, 1300);

  function cancelPress() {
    if (press.timer) { clearTimeout(press.timer); press.timer = null; }
    if (press.el) { try { press.el.style.userSelect = ''; } catch (_) {} press.el = null; }
  }

  function onPointerDown(e) {
    if (disabled() || menuEl) return;
    if (e.button !== undefined && e.button !== 0) return;
    var row = findRow(e.target);
    if (!row) return;
    press.x = e.clientX; press.y = e.clientY; press.el = row.el;
    try { row.el.style.userSelect = 'none'; } catch (_) {}
    press.timer = setTimeout(function () {
      press.timer = null;
      try { press.el && (press.el.style.userSelect = ''); } catch (_) {}
      openMenu(row, press.x, press.y + 8);
    }, 550);
  }
  function onPointerMove(e) {
    if (!press.timer) return;
    if (Math.abs(e.clientX - press.x) > 8 || Math.abs(e.clientY - press.y) > 8) cancelPress();
  }

  try {
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerup', cancelPress, true);
    document.addEventListener('pointercancel', cancelPress, true);
    window.addEventListener('scroll', cancelPress, true);
    // Desktop right-click + Android long-press contextmenu route to our menu.
    document.addEventListener('contextmenu', function (e) {
      if (disabled()) return;
      var row = findRow(e.target);
      if (!row) return;
      e.preventDefault();
      cancelPress();
      openMenu(row, e.clientX, e.clientY + 4);
    }, true);
  } catch (_) {}

  var pending = false;
  function tick() { if (pending) return; pending = true; setTimeout(function () { pending = false; try { observe(); } catch (_) {} }, 150); }
  [900, 2200].forEach(function (d) { setTimeout(tick, d); });
  try { window.addEventListener('antcv:sections-updated', function (e) { if (!(e && e.detail && e.detail.source === SRC)) tick(); }); } catch (_) {}
  setInterval(tick, 4000);

  window.AntcvSidebarVisibilityUx = {
    version: '1.51.117',
    _undoLast: undoLast,
    _undoStack: function () { return undoStack; },
    _restoreToken: restoreToken,
    _diffEvents: diffEvents,
    _buildFeedback: buildFeedback,
    _logEvent: logEvent,
    _readLog: readLog,
    _hideToken: hideToken,
    _findRow: findRow,
  };
})();
