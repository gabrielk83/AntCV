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
  window.__antcvSidebarVisibilityUx = '1.51.116';

  var SRC = 'sidebar-visibility-ux';
  var LOG_KEY = 'antcv:visibilityAnalytics';
  var FEEDBACK_KEY = 'antcv:visibility-feedback';
  var LOG_CAP = 400;
  var FEEDBACK_MAX = 30;
  var RESIDUE_RE = /^\s*hidden\s*[-–—:]\s*/i;

  function disabled() { try { var v = localStorage.getItem('antcv:disable-sidebar-visibility-ux'); return v === '1' || v === 'true'; } catch (_) { return false; } }

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
        var pByLabel = {};
        p.items.forEach(function (it) {
          if (it && typeof it === 'object' && it.group === undefined && it.l) pByLabel[String(it.l).trim().toLowerCase()] = it;
        });
        s.items.forEach(function (it) {
          if (!it || typeof it !== 'object' || it.group !== undefined || !it.l) return;
          var old = pByLabel[String(it.l).trim().toLowerCase()];
          if (!old) return;
          var wasHidden = old.hidden === true, isHidden = it.hidden === true;
          if (wasHidden === isHidden) return;
          var residue = RESIDUE_RE.test(String(it.l));
          if (residue) {
            // Un-hiding a residue row = restoring its tokens.
            if (!isHidden) tokensOf(it.v).forEach(function (t) {
              out.push({ t: new Date().toISOString(), app: app, sid: s.id, label: String(it.l).replace(RESIDUE_RE, '').trim(), token: t, action: 'unhide', src: 'residue-eye' });
            });
          } else {
            out.push({ t: new Date().toISOString(), app: app, sid: s.id, label: String(it.l).trim(), token: null, action: isHidden ? 'hide' : 'unhide', src: 'panel-eye' });
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
      if (!it || typeof it !== 'object' || it.group !== undefined) return null;
      if (RESIDUE_RE.test(String(it.l || ''))) return null;   // residue rows never render anyway
      return { sid: sid, idx: idx, item: it, el: rowEl };
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
      var toks = tokensOf(it.v).filter(function (t) { return t !== token; });
      if (tokensOf(it.v).length === toks.length) return false;
      sec.items[row.idx] = Object.assign({}, it, { v: toks.join(', ') });
      // Upsert the Hidden group NOW (owner: "or generate the hidden group if no
      // such") so the move is visible immediately even before the residue
      // sidecar's next reconcile pass.
      var label = 'Hidden - ' + String(it.l || '').trim();
      var res = sec.items.find(function (x) { return x && typeof x === 'object' && x.group === undefined && String(x.l || '').trim().toLowerCase() === label.toLowerCase(); });
      if (res) { if (tokensOf(res.v).indexOf(token) === -1) res.v = (String(res.v || '').trim() ? String(res.v).trim().replace(/[,;\s]+$/, '') + ', ' : '') + token; res.hidden = true; }
      else sec.items.push({ l: label, v: token, hidden: true });
      return true;
    });
    if (ok) logEvent({ t: new Date().toISOString(), app: appContext(), sid: row.sid, label: String(row.item.l || '').trim(), token: token, action: 'hide', src: 'longpress' });
  }

  function hideRow(row) {
    var ok = writeSections(function (b) {
      var sec = (b.cv || []).find(function (s) { return s && s.id === row.sid; });
      if (!sec || !Array.isArray(sec.items) || !sec.items[row.idx]) return false;
      sec.items[row.idx] = Object.assign({}, sec.items[row.idx], { hidden: true });
      return true;
    });
    if (ok) logEvent({ t: new Date().toISOString(), app: appContext(), sid: row.sid, label: String(row.item.l || '').trim(), token: null, action: 'hide', src: 'longpress' });
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
    var toks = tokensOf(row.item.v);
    if (toks.length >= 2) toks.forEach(function (t) {
      addEntry('🙈 Hide “' + (t.length > 34 ? t.slice(0, 33) + '…' : t) + '”', function () { hideToken(row, t); });
    });
    addEntry('🙈 Hide entire element', function () { hideRow(row); }, true);
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
    version: '1.51.116',
    _diffEvents: diffEvents,
    _buildFeedback: buildFeedback,
    _logEvent: logEvent,
    _readLog: readLog,
    _hideToken: hideToken,
    _findRow: findRow,
  };
})();
