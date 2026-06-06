/* AntCV in-app debug logger (v1.50.167)
 * ---------------------------------------------------------------------------
 * Crash-proof, mobile-first error capture + on-device log viewer.
 *
 * WHY: a blue-screen crash reproduces ONLY on real mobile — where there is no
 *      devtools and no terminal. This sidecar captures uncaught errors plus a
 *      breadcrumb trail to localStorage SYNCHRONOUSLY, so the log survives both
 *      the crash and the reload that follows, and renders a plain-DOM viewer
 *      that still works after the React app has died.
 *
 * SAFETY (per CLAUDE.md hotfix discipline):
 *   - Loads FIRST (before app.js / console-quiet) so window error handlers are
 *     the earliest installed.
 *   - Does NOT wrap window.fetch — the fetch-wrapper chain is left untouched.
 *   - Pure vanilla; appended to <html> so it outlives a React unmount.
 *
 * OPEN THE VIEWER (any one):
 *   - URL hash:  add  #antcv-debug  to the address bar         (mobile-friendly)
 *   - Gesture:   4 quick taps in the TOP-RIGHT corner (<1.5s)
 *   - API:       window.AntcvDebug.open()
 *   - Settings:  a "🐞 Debug log" button is injected near the app version
 *   - Badge:     a small 🐞 dot appears after a real crash; tap it
 *
 * localStorage keys (all plain):
 *   antcv:debug:log      — JSON ring buffer of captured events (capped)
 *   antcv:debug:verbose  — '1' => also record short input-value previews
 *   antcv:debug:disable  — '1' => disable capture entirely (escape hatch)
 *
 * window.AntcvDebug = { open, close, dump, clear, log, isVerbose, setVerbose,
 *   renderInto, mountSettingsButton }
 */
(function () {
  'use strict';
  var VERSION = '1.50.187';
  if (window.__antcvDebugLogger === VERSION) return;
  window.__antcvDebugLogger = VERSION;

  var LOG_KEY = 'antcv:debug:log';
  var VERBOSE_KEY = 'antcv:debug:verbose';
  var DISABLE_KEY = 'antcv:debug:disable';
  var MAX_ENTRIES = 120;
  var MAX_BREADCRUMBS = 40;
  var MAX_STR = 2000;
  var CRASH_KINDS = { error: 1, promise: 1, 'console.error': 1 };

  function ls(get, key, val) {
    try { return get ? localStorage.getItem(key) : (localStorage.setItem(key, val), null); }
    catch (e) { return null; }
  }
  function disabled() { return ls(1, DISABLE_KEY) === '1'; }
  function verbose() { return ls(1, VERBOSE_KEY) === '1'; }
  function nowISO() { try { return new Date().toISOString(); } catch (e) { return '' + Date.now(); } }
  function trunc(s, n) {
    s = String(s == null ? '' : s); n = n || MAX_STR;
    return s.length > n ? s.slice(0, n) + '…[+' + (s.length - n) + ' chars]' : s;
  }

  // ─── ring-buffer persistence (synchronous; survives a crash + reload) ───────
  function readLog() {
    try { var a = JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function writeLog(arr) {
    try {
      while (arr.length > MAX_ENTRIES) arr.shift();
      localStorage.setItem(LOG_KEY, JSON.stringify(arr));
    } catch (e) {
      // localStorage quota — drop the oldest half and retry once.
      try { arr.splice(0, Math.ceil(arr.length / 2)); localStorage.setItem(LOG_KEY, JSON.stringify(arr)); }
      catch (e2) { /* give up silently — never throw from the logger */ }
    }
  }

  // ─── breadcrumbs (in-memory; snapshotted into each captured event) ──────────
  var breadcrumbs = [];
  function crumb(type, detail) {
    breadcrumbs.push({ t: nowISO(), type: type, detail: detail });
    if (breadcrumbs.length > MAX_BREADCRUMBS) breadcrumbs.shift();
  }
  function describe(el) {
    if (!el || el.nodeType !== 1) return String(el);
    var s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    try {
      var nm = el.getAttribute('name') || el.getAttribute('aria-label') || el.getAttribute('placeholder');
      if (nm) s += '[' + trunc(nm, 40) + ']';
    } catch (e) {}
    if (el.type) s += '(' + el.type + ')';
    return s;
  }

  function record(kind, fields) {
    if (disabled()) return;
    var entry = {
      kind: kind, t: nowISO(),
      url: (function () { try { return location.href; } catch (e) { return ''; } })(),
      ver: (function () { try { return window.ANTCV_VERSION || ''; } catch (e) { return ''; } })(),
      ua: (function () { try { return navigator.userAgent; } catch (e) { return ''; } })(),
      vw: (function () { try { return innerWidth + 'x' + innerHeight + ' dpr' + (window.devicePixelRatio || 1); } catch (e) { return ''; } })(),
      crumbs: breadcrumbs.slice(-MAX_BREADCRUMBS)
    };
    for (var k in fields) if (Object.prototype.hasOwnProperty.call(fields, k)) entry[k] = fields[k];
    var log = readLog();
    log.push(entry);
    writeLog(log);
    if (CRASH_KINDS[kind]) showBadge();
    if (panelOpen) renderList();
  }

  // ─── capture: uncaught errors (the blue screen) ─────────────────────────────
  window.addEventListener('error', function (e) {
    try {
      var tgt = e && e.target;
      if (tgt && tgt !== window && tgt.tagName && /^(SCRIPT|LINK|IMG)$/.test(tgt.tagName)) {
        record('resource-error', { message: 'failed to load ' + describe(tgt) + ' ' + (tgt.src || tgt.href || '') });
        return;
      }
      var err = e && e.error;
      record('error', {
        message: (e && e.message) ? String(e.message) : ((err && err.message) || 'unknown error'),
        source: (e && e.filename) ? (e.filename + ':' + e.lineno + ':' + e.colno) : '',
        stack: (err && err.stack) ? trunc(err.stack, 4000) : ''
      });
    } catch (_) {}
  }, true);

  window.addEventListener('unhandledrejection', function (e) {
    try {
      var r = e && e.reason;
      record('promise', {
        message: (r && r.message) ? String(r.message) : trunc(r, 500),
        stack: (r && r.stack) ? trunc(r.stack, 4000) : ''
      });
    } catch (_) {}
  });

  // console.error wrap — console-quiet only wraps log/info/debug/warn, so
  // console.error is ours to chain cleanly.
  try {
    var _cerr = console.error.bind(console);
    console.error = function () {
      try {
        var parts = Array.prototype.map.call(arguments, function (a) {
          if (a && a.stack) return trunc(a.stack, 4000);
          if (a && typeof a === 'object') { try { return trunc(JSON.stringify(a), 1000); } catch (e) { return String(a); } }
          return String(a);
        });
        record('console.error', { message: trunc(parts.join(' '), 4000) });
      } catch (_) {}
      return _cerr.apply(console, arguments);
    };
  } catch (_) {}

  // ─── breadcrumbs: user interactions + route changes ─────────────────────────
  document.addEventListener('pointerdown', function (e) { crumb('tap', describe(e.target)); }, true);
  document.addEventListener('input', function (e) {
    var d = describe(e.target);
    if (verbose() && e.target && 'value' in e.target) d += ' = "' + trunc(e.target.value, 80) + '"';
    crumb('input', d);
  }, true);
  document.addEventListener('change', function (e) { crumb('change', describe(e.target)); }, true);
  window.addEventListener('hashchange', function () { crumb('hash', location.hash); checkHash(); });
  window.addEventListener('popstate', function () { crumb('route', (function () { try { return location.href; } catch (e) { return ''; } })()); });

  // ─── formatting for export / share ──────────────────────────────────────────
  function entryToText(en) {
    var lines = [];
    lines.push('── [' + en.kind + '] ' + en.t + ' ──');
    if (en.message) lines.push(en.message);
    if (en.source) lines.push('at ' + en.source);
    if (en.stack) lines.push(en.stack);
    lines.push('url: ' + en.url + '   ver: ' + en.ver + '   viewport: ' + en.vw);
    if (en.ua) lines.push('ua: ' + en.ua);
    if (en.crumbs && en.crumbs.length) {
      lines.push('breadcrumbs (oldest→newest):');
      en.crumbs.forEach(function (c) { lines.push('  · ' + c.t.slice(11, 23) + ' ' + c.type + ' ' + c.detail); });
    }
    return lines.join('\n');
  }
  function dumpText() {
    var log = readLog();
    var head = 'AntCV debug log — ' + log.length + ' event(s) — exported ' + nowISO()
      + '\napp ' + (window.ANTCV_VERSION || '?') + '\n' + (navigator.userAgent || '') + '\n';
    return head + '\n' + log.slice().reverse().map(entryToText).join('\n\n');
  }

  // ─── viewer overlay (plain DOM; survives a React crash) ──────────────────────
  var panel = null, listEl = null, panelOpen = false, badge = null;

  function el(tag, css, text) {
    var n = document.createElement(tag);
    if (css) n.style.cssText = css;
    if (text != null) n.textContent = text;
    return n;
  }
  function btn(label, onClick) {
    var b = el('button', 'font:600 13px system-ui;padding:8px 12px;margin:0 6px 6px 0;border:0;border-radius:8px;background:#1f2937;color:#fff;cursor:pointer', label);
    b.addEventListener('click', onClick);
    return b;
  }

  function buildPanel() {
    if (panel) return;
    panel = el('div', 'position:fixed;inset:0;z-index:2147483647;background:#0b1020;color:#e5e7eb;'
      + 'font:13px/1.5 system-ui,-apple-system,sans-serif;display:flex;flex-direction:column;overflow:hidden');
    panel.setAttribute('data-antcv-debug-panel', '1');

    var bar = el('div', 'flex:0 0 auto;padding:12px 12px 4px;background:#111827;border-bottom:1px solid #1f2937');
    var title = el('div', 'font:700 15px system-ui;margin-bottom:8px', '🐞 AntCV debug log');
    bar.appendChild(title);

    var row = el('div', 'display:flex;flex-wrap:wrap;align-items:center');
    row.appendChild(btn('Copy', function () {
      var t = dumpText();
      if (navigator.clipboard) navigator.clipboard.writeText(t).then(flash('Copied'), function () { fallbackCopy(t); });
      else fallbackCopy(t);
    }));
    if (navigator.share) row.appendChild(btn('Share', function () {
      navigator.share({ title: 'AntCV debug log', text: dumpText() }).catch(function () {});
    }));
    row.appendChild(btn('Download', function () {
      try {
        var blob = new Blob([dumpText()], { type: 'text/plain' });
        var a = el('a'); a.href = URL.createObjectURL(blob);
        a.download = 'antcv-debug-' + nowISO().replace(/[:.]/g, '-') + '.txt';
        document.documentElement.appendChild(a); a.click(); a.remove();
      } catch (e) {}
    }));
    row.appendChild(btn('Clear', function () { ls(0, LOG_KEY, '[]'); renderList(); flash('Cleared')(); }));

    var vlabel = el('label', 'font:13px system-ui;margin:0 8px 6px 4px;display:inline-flex;align-items:center;cursor:pointer');
    var vchk = el('input'); vchk.type = 'checkbox'; vchk.checked = verbose(); vchk.style.marginRight = '6px';
    vchk.addEventListener('change', function () { setVerbose(vchk.checked); flash(vchk.checked ? 'Verbose ON' : 'Verbose OFF')(); });
    vlabel.appendChild(vchk); vlabel.appendChild(document.createTextNode('Capture typed values'));
    row.appendChild(vlabel);

    row.appendChild(btn('✕ Close', close));
    bar.appendChild(row);

    var hint = el('div', 'font:11px system-ui;color:#9ca3af;padding:2px 0 2px', 'Reopen any time: add #antcv-debug to the URL, or 4-tap the top-right corner.');
    bar.appendChild(hint);
    panel.appendChild(bar);

    listEl = el('div', 'flex:1 1 auto;overflow:auto;padding:8px 12px 24px;-webkit-overflow-scrolling:touch');
    panel.appendChild(listEl);

    var toast = el('div'); toast.id = '__antcv_dbg_toast';
    toast.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#01b7bb;color:#04222a;'
      + 'font:600 13px system-ui;padding:8px 14px;border-radius:20px;opacity:0;transition:opacity .2s;pointer-events:none;z-index:2147483647';
    panel.appendChild(toast);
  }

  function flash(msg) {
    return function () {
      try {
        var t = panel && panel.querySelector('#__antcv_dbg_toast');
        if (!t) return;
        t.textContent = msg; t.style.opacity = '1';
        setTimeout(function () { t.style.opacity = '0'; }, 1200);
      } catch (e) {}
    };
  }
  function fallbackCopy(text) {
    try {
      var ta = el('textarea'); ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.documentElement.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove(); flash('Copied')();
    } catch (e) { flash('Copy failed — long-press to select')(); }
  }

  function renderList() {
    if (!listEl) return;
    var log = readLog().slice().reverse();
    listEl.textContent = '';
    if (!log.length) { listEl.appendChild(el('div', 'color:#9ca3af;padding:16px 0', 'No events captured yet. Reproduce the crash, then reopen this.')); return; }
    log.forEach(function (en) {
      var color = en.kind === 'error' || en.kind === 'promise' ? '#f87171'
        : en.kind === 'console.error' ? '#fbbf24'
        : en.kind === 'resource-error' ? '#fb923c' : '#60a5fa';
      var card = el('div', 'border:1px solid #1f2937;border-left:3px solid ' + color + ';border-radius:8px;padding:8px 10px;margin:0 0 8px;background:#0f172a');
      var h = el('div', 'display:flex;justify-content:space-between;gap:8px;cursor:pointer');
      h.appendChild(el('div', 'font:700 13px system-ui;color:' + color, en.kind));
      h.appendChild(el('div', 'font:11px system-ui;color:#9ca3af', en.t.slice(11, 19)));
      card.appendChild(h);
      card.appendChild(el('div', 'margin-top:4px;white-space:pre-wrap;word-break:break-word', en.message || ''));
      var details = el('pre', 'display:none;margin-top:6px;white-space:pre-wrap;word-break:break-word;font:11px/1.45 ui-monospace,monospace;color:#cbd5e1');
      details.textContent = entryToText(en);
      card.appendChild(details);
      h.addEventListener('click', function () { details.style.display = details.style.display === 'none' ? 'block' : 'none'; });
      listEl.appendChild(card);
    });
  }

  function open() {
    buildPanel();
    if (!panel.parentNode) document.documentElement.appendChild(panel);
    panelOpen = true; renderList();
    if (badge) badge.style.display = 'none';
  }
  function close() {
    panelOpen = false;
    if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
    if (location.hash === '#antcv-debug') { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} }
  }

  // Keep the open panel attached even if React rewrites the body on a crash.
  setInterval(function () {
    if (panelOpen && panel && !panel.parentNode) { try { document.documentElement.appendChild(panel); } catch (e) {} }
  }, 1000);

  // ─── entry points ───────────────────────────────────────────────────────────
  function checkHash() { try { if (/^#(antcv-debug|debug-log)$/.test(location.hash)) open(); } catch (e) {} }

  // 4 quick taps in the top-right corner.
  var taps = [];
  document.addEventListener('pointerdown', function (e) {
    try {
      if (e.clientX < innerWidth - 70 || e.clientY > 70) return;
      var t = Date.now(); taps.push(t); taps = taps.filter(function (x) { return t - x < 1500; });
      if (taps.length >= 4) { taps = []; open(); }
    } catch (_) {}
  }, true);

  function showBadge() {
    try {
      if (panelOpen || disabled()) return;
      if (!badge) {
        badge = el('div', 'position:fixed;left:12px;bottom:12px;z-index:2147483646;width:40px;height:40px;border-radius:50%;'
          + 'background:#f87171;color:#fff;font:20px/40px system-ui;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.4);cursor:pointer', '🐞');
        badge.title = 'AntCV captured an error — tap to view';
        badge.addEventListener('click', open);
      }
      if (!badge.parentNode) document.documentElement.appendChild(badge);
      badge.style.display = 'block';
    } catch (e) {}
  }

  // ─── best-effort Settings button (the gesture/hash are the guarantees) ───────
  function mountSettingsButton() {
    try {
      if (document.querySelector('[data-antcv-debug-settings-btn]')) return;
      // Anchor on the app-version footer text (e.g. "1.50.x") inside Settings.
      var all = document.querySelectorAll('div,span,p,small,footer');
      var anchor = null;
      for (var i = 0; i < all.length; i++) {
        var t = all[i].textContent || '';
        if (t.length < 60 && /\bv?1\.50\.\d+/.test(t) && all[i].children.length === 0) { anchor = all[i]; break; }
      }
      if (!anchor || !anchor.parentNode) return;
      var b = el('button', 'display:block;margin:8px 0;padding:6px 10px;border:1px solid #374151;border-radius:8px;'
        + 'background:transparent;color:#6b7280;font:600 12px system-ui;cursor:pointer', '🐞 Open debug log');
      b.setAttribute('data-antcv-debug-settings-btn', '1');
      b.addEventListener('click', open);
      anchor.parentNode.insertBefore(b, anchor.nextSibling);
    } catch (e) {}
  }
  // NOTE: no auto-mount. The access point is the native Settings > Advanced >
  // Debug subtab (in app.js). mountSettingsButton() stays exposed for manual
  // use, but is NOT called automatically — the old version-text anchor leaked
  // the button onto the login screen (which also shows the version string).

  // ─── public API ──────────────────────────────────────────────────────────────
  function setVerbose(on) { ls(0, VERBOSE_KEY, on ? '1' : '0'); }
  window.AntcvDebug = {
    open: open, close: close,
    dump: dumpText, clear: function () { ls(0, LOG_KEY, '[]'); if (panelOpen) renderList(); },
    log: function (tag, data) { record('manual', { message: '[' + (tag || 'log') + '] ' + trunc(typeof data === 'object' ? JSON.stringify(data) : data, 2000) }); },
    isVerbose: verbose, setVerbose: setVerbose,
    renderInto: function (container) { buildPanel(); panelOpen = true; container.appendChild(panel); renderList(); },
    mountSettingsButton: mountSettingsButton,
    _version: VERSION
  };

  // If the page loaded already pointing at the debug hash, open immediately.
  checkHash();
  // Surface the badge on load if a prior session already captured a crash.
  try { if (readLog().some(function (e) { return CRASH_KINDS[e.kind]; })) showBadge(); } catch (e) {}
})();
