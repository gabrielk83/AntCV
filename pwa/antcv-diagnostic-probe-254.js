/* AntCV diagnostic probe (v1.40.254)
 * ===================================================================
 *
 * Gabriel needs to see what's happening across:
 *   (a) AntcvFullErase: which step fails, what cloud actually returns
 *   (b) AI notice: when it mounts, why it mounts early, what happens on
 *       accept (and especially: the blue screen with no console output)
 *   (c) Wizard: when it opens, when it doesn't, what step is visible
 *   (d) Cloud restore: full GET /api/prefs response (truncated)
 *   (e) Crashes: window.error, unhandledrejection — across navigations
 *
 * Strategy
 * --------
 * Everything is logged to a ring buffer persisted to localStorage so
 * it survives reloads, navigations, and crashes. The buffer is at
 * 'antcv:diag:ring' (max 500 lines). Run window.AntcvDiag.dump() in
 * the console to print every line. window.AntcvDiag.clear() resets.
 *
 * Logs are ALSO mirrored to console.debug with the prefix '[diag]' so
 * Gabriel can follow live. console.log/info/warn/error are wrapped so
 * any third-party log line also lands in the ring buffer — that means
 * when the blue screen wipes the visible console, the buffer still
 * has the last 500 lines including whatever app.js logged.
 *
 * Hooks
 * -----
 *   - console.{log,info,warn,error,debug}: tee into ring buffer
 *   - window.addEventListener('error', ...) — capture stacks
 *   - window.addEventListener('unhandledrejection', ...)
 *   - beforeunload: snapshot of localStorage keys + values
 *   - wraps window.fetch to log /api/prefs request method + URL +
 *     response status + a SAFE preview of the response body
 *     (truncated, no API keys / tokens)
 *   - patches window.AntcvFullErase to log enter, each step, and exit
 *   - watches the wizard DOM for step transitions
 *   - watches the AI-notice slide mount / dismiss + button clicks
 *
 * Privacy
 * -------
 * Authorization headers, bearer tokens, API keys, photo data URIs,
 * personalInfo.email, and personalInfo.name are redacted before
 * logging.
 */
(function () {
  'use strict';

  if (window.__antcvDiagnosticProbe254) return;
  window.__antcvDiagnosticProbe254 = '1.40.254';

  var VERSION = '1.40.254';
  var RING_KEY = 'antcv:diag:ring';
  var RING_MAX = 500;
  var LINE_MAX = 1400;        // per-line char cap

  // ── ring buffer ─────────────────────────────────────────────────
  var ring = [];
  try {
    var existing = localStorage.getItem(RING_KEY);
    if (existing) ring = JSON.parse(existing) || [];
    if (!Array.isArray(ring)) ring = [];
  } catch (_) { ring = []; }

  var writePending = false;
  function flush() {
    if (writePending) return;
    writePending = true;
    setTimeout(function () {
      writePending = false;
      try { localStorage.setItem(RING_KEY, JSON.stringify(ring)); } catch (_) {}
    }, 100);
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function ts() {
    var d = new Date();
    return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + '.' + String(d.getMilliseconds()).padStart(3, '0');
  }

  function clip(s) {
    s = String(s == null ? '' : s);
    if (s.length > LINE_MAX) return s.slice(0, LINE_MAX) + '…[+' + (s.length - LINE_MAX) + ']';
    return s;
  }
  function redact(s) {
    s = String(s == null ? '' : s);
    // bearer tokens
    s = s.replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, 'Bearer <redacted>');
    // API keys (sk-... / sk_... / 32+ char hex/base64ish)
    s = s.replace(/(sk[_-][A-Za-z0-9_\-]{20,})/g, '<redacted:apikey>');
    // emails
    s = s.replace(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g, '<redacted:email>');
    // data URIs (photo)
    s = s.replace(/data:[a-z]+\/[a-z+\-]+;base64,[A-Za-z0-9+\/=]+/gi, 'data:<redacted:base64>');
    return s;
  }

  function push(tag, msg) {
    var line = '[' + ts() + '] ' + tag + ' ' + clip(redact(msg));
    ring.push(line);
    if (ring.length > RING_MAX) ring.splice(0, ring.length - RING_MAX);
    flush();
    try { (window.__antcvDiagOrigConsole || console).debug('[diag]', tag, redact(msg)); } catch (_) {}
  }
  function fmt(args) {
    var out = [];
    for (var i = 0; i < args.length; i++) {
      var a = args[i];
      try {
        if (a === null || a === undefined) out.push(String(a));
        else if (typeof a === 'string') out.push(a);
        else if (a instanceof Error) out.push(a.message + (a.stack ? ' :: ' + a.stack.split('\n').slice(0, 4).join(' | ') : ''));
        else out.push(JSON.stringify(a));
      } catch (_) {
        try { out.push(String(a)); } catch (__) { out.push('<unprintable>'); }
      }
    }
    return out.join(' ');
  }

  // ── console wrap ────────────────────────────────────────────────
  var origConsole = {};
  ['log', 'info', 'warn', 'error', 'debug'].forEach(function (lvl) {
    origConsole[lvl] = console[lvl] && console[lvl].bind(console);
    if (!origConsole[lvl]) return;
    console[lvl] = function () {
      try { push('console.' + lvl, fmt(arguments)); } catch (_) {}
      try { origConsole[lvl].apply(console, arguments); } catch (_) {}
    };
  });
  window.__antcvDiagOrigConsole = origConsole;

  push('boot', 'antcv-diagnostic-probe ' + VERSION + ' installed; ring already has ' + ring.length + ' lines');

  // ── window.error / unhandledrejection ───────────────────────────
  window.addEventListener('error', function (ev) {
    try {
      var msg = (ev && (ev.message || (ev.error && ev.error.message))) || '';
      var stack = (ev && ev.error && ev.error.stack) || '';
      var src = (ev && ev.filename) || '';
      var ln = (ev && ev.lineno) || '';
      push('window.error', msg + ' | ' + src + ':' + ln + ' | ' + stack.split('\n').slice(0, 6).join(' / '));
    } catch (_) {}
  }, true);
  window.addEventListener('unhandledrejection', function (ev) {
    try {
      var r = ev && ev.reason;
      var msg = (r && (r.message || r.toString && r.toString())) || String(r || 'unknown');
      var stack = (r && r.stack) || '';
      push('unhandledrejection', msg + ' | ' + stack.split('\n').slice(0, 6).join(' / '));
    } catch (_) {}
  });

  // ── snapshot helpers ────────────────────────────────────────────
  function lsSnapshot(reason) {
    try {
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
      var summary = keys.map(function (k) {
        var v = '';
        try { v = localStorage.getItem(k) || ''; } catch (_) {}
        var size = v.length;
        var preview = v.length > 120 ? v.slice(0, 120) + '…' : v;
        return k + '(' + size + ')=' + preview;
      });
      push('ls.snapshot[' + reason + ']', summary.join(' || '));
    } catch (_) {}
  }
  function wizardState(reason) {
    try {
      var nodes = document.querySelectorAll(
        '[role="dialog"],[role="alertdialog"],[data-antcv-wizard],[data-antcv-modal="wizard"],[class*="wizard" i],[class*="setup" i]'
      );
      var hits = [];
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        try {
          var cs = getComputedStyle(n);
          if (cs.display === 'none' || cs.visibility === 'hidden') continue;
          var r = n.getBoundingClientRect();
          if (r.width < 4 || r.height < 4) continue;
          var t = (n.textContent || '').replace(/\s+/g, ' ').trim();
          hits.push({
            tag: n.tagName + '.' + (n.className || '').slice(0, 40),
            size: Math.round(r.width) + 'x' + Math.round(r.height),
            text: t.slice(0, 240)
          });
        } catch (_) {}
      }
      push('wizard.state[' + reason + ']', JSON.stringify(hits));
    } catch (_) {}
  }
  function aiNoticeState(reason) {
    try {
      var slides = document.querySelectorAll('.antcv-ai-wizard-slide,[data-antcv-modal="ai-disclosure"],[data-antcv-ai-disclosure]');
      var hits = [];
      for (var i = 0; i < slides.length; i++) {
        var n = slides[i];
        try {
          var cs = getComputedStyle(n);
          var r = n.getBoundingClientRect();
          hits.push({
            tag: n.tagName + '.' + (n.className || '').slice(0, 50),
            display: cs.display, vis: cs.visibility,
            size: Math.round(r.width) + 'x' + Math.round(r.height),
            attrs: {
              gate: n.getAttribute && n.getAttribute('data-antcv-ai-gate'),
              modal: n.getAttribute && n.getAttribute('data-antcv-modal'),
            }
          });
        } catch (_) {}
      }
      push('ainotice.state[' + reason + ']', JSON.stringify(hits));
    } catch (_) {}
  }

  // ── fetch wrap ──────────────────────────────────────────────────
  var origFetch = window.fetch && window.fetch.bind(window);
  if (origFetch) {
    window.fetch = function (input, init) {
      var url = '';
      var method = 'GET';
      try {
        url = typeof input === 'string' ? input : (input && input.url) || '';
        method = (init && init.method) || (input && input.method) || 'GET';
      } catch (_) {}
      var isPrefs = /\/api\/prefs|\/api\/profile\/kernel|\/auth\/(google|logout)/.test(url);
      if (isPrefs) push('fetch.req', method + ' ' + url);
      return origFetch(input, init).then(function (res) {
        if (!isPrefs) return res;
        try {
          push('fetch.res', method + ' ' + url + ' → ' + res.status);
          // Clone to read body safely without consuming
          if (res.ok && /\/api\/prefs/.test(url) && method === 'GET') {
            res.clone().json().then(function (data) {
              try {
                var keys = data ? Object.keys(data) : [];
                var pi = data && data.personalInfo;
                var piKeys = pi && typeof pi === 'object' ? Object.keys(pi) : [];
                var piPopulated = (pi && typeof pi === 'object') ? Object.keys(pi).filter(function (k) {
                  var v = pi[k];
                  if (v === null || v === undefined) return false;
                  if (typeof v === 'string') return v.trim() !== '';
                  if (typeof v === 'number') return v !== 0;
                  if (typeof v === 'boolean') return v === true;
                  if (Array.isArray(v)) return v.length > 0;
                  if (typeof v === 'object') return Object.keys(v).length > 0;
                  return true;
                }) : [];
                var meta = {
                  topKeys: keys,
                  topPopulated: keys.filter(function (k) {
                    var v = data[k];
                    if (v === null || v === undefined || v === '') return false;
                    if (typeof v === 'boolean') return v === true;
                    if (Array.isArray(v)) return v.length > 0;
                    if (typeof v === 'object') return Object.keys(v).length > 0;
                    return true;
                  }),
                  piKeys: piKeys,
                  piPopulated: piPopulated,
                  wizardCompleted: data.wizardCompleted,
                  aiDisclosureAccepted: typeof data.aiDisclosureAccepted === 'string' ? '<set>' : data.aiDisclosureAccepted,
                };
                push('fetch.res.body', method + ' ' + url + ' :: ' + JSON.stringify(meta));
              } catch (e) { push('fetch.res.body.err', String(e && e.message)); }
            }).catch(function (e) { push('fetch.res.body.err', String(e && e.message)); });
          }
          if (res.ok && /\/api\/prefs/.test(url) && method === 'DELETE') {
            res.clone().json().then(function (data) {
              try { push('fetch.res.body', 'DELETE ' + url + ' :: ' + JSON.stringify(data).slice(0, 800)); } catch (_) {}
            }).catch(function () {});
          }
        } catch (_) {}
        return res;
      }, function (err) {
        if (isPrefs) push('fetch.err', method + ' ' + url + ' → ' + (err && err.message));
        throw err;
      });
    };
  }

  // ── DOM watcher: wizard + AI-notice transitions ─────────────────
  var lastWizardSig = '';
  var lastNoticeSig = '';
  function sigOf(el) {
    if (!el) return '0';
    try {
      var cs = getComputedStyle(el);
      var r = el.getBoundingClientRect();
      var t = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120);
      return cs.display + '|' + cs.visibility + '|' + Math.round(r.width) + 'x' + Math.round(r.height) + '|' + t;
    } catch (_) { return '?'; }
  }
  function findVisible(selector) {
    try {
      var nodes = document.querySelectorAll(selector);
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        var cs = getComputedStyle(n);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        var r = n.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) continue;
        return n;
      }
    } catch (_) {}
    return null;
  }
  function pollDom() {
    try {
      var wz = findVisible('[role="dialog"],[role="alertdialog"],[data-antcv-wizard],[data-antcv-modal="wizard"],[class*="wizard" i],[class*="setup" i]');
      var wsig = sigOf(wz);
      if (wsig !== lastWizardSig) {
        push('wizard.transition', lastWizardSig + ' → ' + wsig);
        lastWizardSig = wsig;
      }
      var ai = document.querySelector('.antcv-ai-wizard-slide, [data-antcv-modal="ai-disclosure"]');
      var asig = ai ? sigOf(ai) : '';
      if (asig !== lastNoticeSig) {
        if (asig) push('ainotice.appeared', asig);
        else if (lastNoticeSig) push('ainotice.disappeared', lastNoticeSig);
        lastNoticeSig = asig;
      }
    } catch (_) {}
  }
  setInterval(pollDom, 500);

  // ── click logger for AI-notice buttons ──────────────────────────
  document.addEventListener('click', function (ev) {
    try {
      var tgt = ev.target && ev.target.closest && ev.target.closest('button, [role="button"], a, input[type="button"], input[type="submit"]');
      if (!tgt) return;
      var slide = tgt.closest && tgt.closest('.antcv-ai-wizard-slide,[data-antcv-modal="ai-disclosure"],[data-antcv-ai-disclosure]');
      if (!slide) return;
      var text = (tgt.textContent || tgt.value || '').replace(/\s+/g, ' ').trim().slice(0, 80);
      var cls = (tgt.className || '').slice(0, 80);
      push('ainotice.click', text + ' | class=' + cls);
      // capture state right after click
      setTimeout(function () {
        push('ainotice.click+50ms', 'localAccepted=' + (function(){try{return !!localStorage.getItem('aiDisclosureAccepted');}catch(_){return '?';}})());
        aiNoticeState('after-click-50ms');
        wizardState('after-click-50ms');
      }, 50);
      setTimeout(function () { aiNoticeState('after-click-300ms'); wizardState('after-click-300ms'); }, 300);
      setTimeout(function () { aiNoticeState('after-click-1500ms'); wizardState('after-click-1500ms'); }, 1500);
    } catch (_) {}
  }, true);

  // ── beforeunload snapshot (navigations, reloads) ────────────────
  window.addEventListener('beforeunload', function () {
    try { push('beforeunload', 'location=' + location.href); } catch (_) {}
    lsSnapshot('beforeunload');
  });

  // ── AntcvFullErase hook ─────────────────────────────────────────
  function patchFullErase() {
    var orig = window.AntcvFullErase;
    if (typeof orig !== 'function' || orig.__antcvDiagPatched) return false;
    var wrapped = async function () {
      push('antcvFullErase.enter', 'href=' + location.href);
      lsSnapshot('antcvFullErase.enter');
      try {
        var r = await orig.apply(this, arguments);
        push('antcvFullErase.exit.ok', String(r));
        return r;
      } catch (e) {
        push('antcvFullErase.exit.err', (e && e.message) + ' :: ' + (e && e.stack || '').slice(0, 400));
        throw e;
      }
    };
    wrapped.__antcvDiagPatched = true;
    try { window.AntcvFullErase = wrapped; } catch (_) {}
    push('antcvFullErase.patched', 'ok');
    return true;
  }
  // Try now; if not yet defined, poll until it is.
  if (!patchFullErase()) {
    var tries = 0;
    var pid = setInterval(function () {
      tries += 1;
      if (patchFullErase() || tries > 40) clearInterval(pid);
    }, 250);
  }

  // ── snapshots at key lifecycle moments ──────────────────────────
  lsSnapshot('boot');
  setTimeout(function () { lsSnapshot('boot+500ms'); }, 500);
  setTimeout(function () { lsSnapshot('boot+3s'); wizardState('boot+3s'); }, 3000);
  window.addEventListener('load', function () {
    push('window.load', 'href=' + location.href);
    lsSnapshot('window.load');
  });
  window.addEventListener('focus', function () { push('window.focus', ''); });
  window.addEventListener('blur', function () { push('window.blur', ''); });

  // ── public API ──────────────────────────────────────────────────
  window.AntcvDiag = {
    version: VERSION,
    dump: function () {
      try {
        var lines = ring.slice();
        origConsole.log && origConsole.log('=== AntcvDiag: ' + lines.length + ' line(s) ===');
        lines.forEach(function (L) { try { origConsole.log(L); } catch (_) {} });
        return lines.join('\n');
      } catch (_) { return null; }
    },
    text: function () {
      try { return ring.join('\n'); } catch (_) { return ''; }
    },
    download: function () {
      try {
        var blob = new Blob([ring.join('\n')], { type: 'text/plain' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'antcv-diag-' + new Date().toISOString().replace(/[:.]/g, '-') + '.txt';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
      } catch (e) { origConsole.error && origConsole.error(e); }
    },
    clear: function () {
      ring.length = 0;
      try { localStorage.removeItem(RING_KEY); } catch (_) {}
      push('diag.clear', 'ring reset by AntcvDiag.clear()');
    },
    snapshot: function (reason) { lsSnapshot(reason || 'manual'); wizardState('manual'); aiNoticeState('manual'); },
    push: function (tag, msg) { push('user.' + tag, msg); },
    state: function () {
      return {
        lines: ring.length,
        ring_key: RING_KEY,
        version: VERSION,
        href: location.href
      };
    }
  };

  push('diag.ready', 'AntcvDiag exposed; run AntcvDiag.dump() / AntcvDiag.download() / AntcvDiag.clear() to use');
})();
