/* AntCV diagnostic probes (v1.50.171-370)
 * ============================================================
 * READ-ONLY. Adds no behaviour; only observes and logs. Owner runs the app,
 * reproduces an issue, then copies the `[antcv-diag]` console lines back.
 *
 * Covers four open items (owner authorised probes, 2026-06-06):
 *   - HARDREFRESH-001    in-app Hard Refresh confirms but never reloads
 *   - SETTINGS-SUBTAB-001 settings render behind preview (z-index) / wrong subtab
 *   - HARDREFRESH/LOGIN  boot order: blue-screen -> wizard -> menu
 *   - HOWCONTRIBUTE-001  "How I would contribute" bullets missing in template preview
 *
 * On-demand:  window.AntcvDiag()            -> dump every probe now
 *             window.AntcvDiag.contribute()  /  .settings()  /  .boot()  /  .hardrefresh()
 * Auto:       a one-shot snapshot ~2.5s after load.
 */
(function () {
  'use strict';
  var V = '1.50.181-370';
  if (window.__antcvDiagProbes === V) return;
  window.__antcvDiagProbes = V;

  function log() {
    try {
      var a = Array.prototype.slice.call(arguments);
      a.unshift('[antcv-diag]');
      // Route through console.warn so antcv-console-quiet doesn't swallow it.
      console.warn.apply(console, a);
    } catch (_) {}
  }
  function readJSON(k) {
    try {
      var v = localStorage.getItem(k);
      if (v == null) return null;
      try { return JSON.parse(v); } catch (_) { return v; }
    } catch (_) { return null; }
  }
  function zIndexOf(el) {
    try { return el ? (window.getComputedStyle(el).zIndex || 'auto') : '(none)'; } catch (_) { return '(err)'; }
  }

  // ---- HOWCONTRIBUTE-001 -------------------------------------------------
  function probeContribute() {
    try {
      var doc = readJSON('doc');
      var key = doc === 'cl' ? 'sections_cl' : 'sections';
      // Find the sections store the app actually uses; try a few known keys.
      var stores = ['sections_cl', 'sections', 'cl_sections', 'antcv:sections'];
      var found = null, foundKey = null;
      for (var i = 0; i < stores.length; i++) {
        var s = readJSON(stores[i]);
        if (s) { found = s; foundKey = stores[i]; break; }
      }
      var contribute = null;
      function scan(arr) {
        if (!Array.isArray(arr)) return;
        for (var j = 0; j < arr.length; j++) {
          var sec = arr[j];
          if (sec && (sec.id === 'contribute' || (sec.title && /contribut/i.test(sec.title)))) contribute = sec;
        }
      }
      if (Array.isArray(found)) scan(found);
      else if (found && typeof found === 'object') { scan(found.cl); scan(found.sections); scan(found.cv); }

      var domBullets = document.querySelectorAll('[data-sid="contribute"] li, [data-section-id="contribute"] li');
      var report = {
        doc: doc, sectionsKeyUsed: foundKey,
        contributeFound: !!contribute,
        intro: contribute ? (contribute.intro || contribute.content || '').slice(0, 60) : null,
        bulletsInStore: contribute && Array.isArray(contribute.bullets) ? contribute.bullets.length : (contribute && Array.isArray(contribute.items) ? contribute.items.length : 0),
        bulletShape: contribute ? Object.keys(contribute).join(',') : null,
        bulletsInPreviewDOM: domBullets.length,
        looksLikeTemplatePlaceholder: contribute ? /\[[A-Z][^\]]{2,}\]/.test(JSON.stringify(contribute)) : null,
      };
      log('HOWCONTRIBUTE-001', report);
      // Full stored shape (untruncated by the console object collapse) so we can
      // see whether the placeholder items were scrubbed to [] or never stored.
      log('HOWCONTRIBUTE-001 raw', contribute ? JSON.stringify(contribute).slice(0, 900) : 'n/a');
    } catch (e) { log('HOWCONTRIBUTE-001 probe error', e && e.message); }
  }

  // ---- SETTINGS-SUBTAB-001 ----------------------------------------------
  function probeSettings() {
    try {
      // Heuristic: a settings panel is a fixed/absolute overlay containing the
      // word "Settings" or the standard/advanced subtab buttons.
      var candidates = Array.prototype.slice.call(document.querySelectorAll('div'));
      var panel = null;
      for (var i = 0; i < candidates.length; i++) {
        var el = candidates[i];
        var t = (el.textContent || '');
        if (/\bSettings\b/.test(t) && /\bAdvanced\b/.test(t) && /\bStandard\b/.test(t)) {
          var cs = window.getComputedStyle(el);
          if (cs.position === 'fixed' || cs.position === 'absolute') { panel = el; break; }
        }
      }
      var preview = document.querySelector('.antcv-preview-paper, .antcv-preview-wrap, [data-antcv-preview-paper]');
      var report = {
        settingsPanelFound: !!panel,
        settingsZIndex: zIndexOf(panel),
        previewFound: !!preview,
        previewZIndex: zIndexOf(preview),
        settingsAbovePreview: panel && preview ? (parseInt(zIndexOf(panel)) || 0) > (parseInt(zIndexOf(preview)) || 0) : null,
        settingsTab: readJSON('settingsTab'),
        subtab: readJSON('subtab'),
        note: panel && preview && !((parseInt(zIndexOf(panel)) || 0) > (parseInt(zIndexOf(preview)) || 0)) ? 'PANEL z-index <= preview -> settings render BEHIND preview' : 'ok-or-unknown',
      };
      log('SETTINGS-SUBTAB-001', report);
    } catch (e) { log('SETTINGS-SUBTAB-001 probe error', e && e.message); }
  }

  // ---- LOGIN-GATE-001 (boot order) --------------------------------------
  var bootMarks = [];
  function mark(name) { bootMarks.push({ t: Math.round(performance.now()), what: name }); }
  function probeBoot() {
    try {
      log('LOGIN-GATE-001 boot sequence', bootMarks.slice());
    } catch (e) { log('LOGIN-GATE-001 probe error', e && e.message); }
  }
  // Capture boot-relevant DOM transitions.
  try {
    if (document.querySelector('[data-antcv-loading-gate], #antcv-loading-cover')) mark('loading-cover-present@install');
    var bootObs = new MutationObserver(function (recs) {
      for (var i = 0; i < recs.length; i++) {
        var added = recs[i].addedNodes || [];
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (n.nodeType !== 1) continue;
          var txt = (n.textContent || '').slice(0, 40);
          var cls = (n.className && n.className.toString) ? n.className.toString() : '';
          if (/loading-gate|loading-cover/i.test(cls)) mark('loading-cover-added');
          else if (/wizard/i.test(cls) || /Step\s*\d/i.test(txt)) mark('wizard-added:' + txt.replace(/\s+/g, ' ').slice(0, 20));
          else if (n.id === 'root' || (n.querySelector && n.querySelector('.antcv-preview-paper'))) mark('app-root/preview-added');
        }
      }
    });
    bootObs.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(function () { try { bootObs.disconnect(); } catch (_) {} }, 8000);
  } catch (_) {}
  // CRASH CAPTURE (1.50.181): a blue screen is a React render crash caught by the
  // error boundary — it doesn't surface as an uncaught window error, React logs it
  // via console.error. Capture uncaught errors, promise rejections, AND error-like
  // console.error args, re-logged loudly as [antcv-diag] CRASH so the owner can find
  // and paste the message + stack after reproducing the blue screen.
  try {
    window.addEventListener('error', function (e) {
      log('CRASH (window.error):', (e && e.message) || e, '@', (e && e.filename) || '', (e && e.lineno) || '',
        (e && e.error && e.error.stack) ? String(e.error.stack).slice(0, 500) : '');
    }, true);
    window.addEventListener('unhandledrejection', function (e) {
      var r = e && e.reason;
      log('CRASH (rejection):', (r && r.message) || r, (r && r.stack) ? String(r.stack).slice(0, 500) : '');
    });
    var _ce = console.error;
    console.error = function () {
      try {
        for (var i = 0; i < arguments.length; i++) {
          var a = arguments[i];
          if (a && a.stack && a.message) { log('CRASH (react):', a.message, String(a.stack).slice(0, 500)); break; }
        }
      } catch (_) {}
      return _ce.apply(console, arguments);
    };
  } catch (_) {}

  // ---- HARDREFRESH-001 ---------------------------------------------------
  // Non-invasive: detect clicks on a "Hard Refresh" control, then watch whether
  // the page actually starts unloading. Also time the two async steps that can
  // hang before location.reload() (SW unregister, caches.keys).
  var unloadStarted = false;
  try { window.addEventListener('beforeunload', function () { unloadStarted = true; }); } catch (_) {}
  try {
    document.addEventListener('click', function (ev) {
      try {
        // Console hygiene (owner 2026-06-12): the old matcher collected 4
        // ancestors' textContent, so ANY click inside a container that
        // mentions "Hard Refresh" anywhere fired the probe (repeated
        // "click detected" + bogus "NO reload" warnings). Match only the
        // BUTTON whose own short label is the Hard Refresh action.
        var el = ev.target, btn = null, hops = 0;
        while (el && hops < 3) {
          if (el.tagName === 'BUTTON' || (el.getAttribute && el.getAttribute('role') === 'button')) { btn = el; break; }
          el = el.parentElement; hops++;
        }
        if (!btn) return;
        var ownTxt = (btn.textContent || '').trim();
        if (!/Hard Refresh/i.test(ownTxt) || ownTxt.length > 40) return;
        var t0 = performance.now();
        log('HARDREFRESH-001 click detected — timing reload path…');
        // Probe the two async steps the handler awaits.
        if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
          var sw0 = performance.now();
          navigator.serviceWorker.getRegistrations().then(function (r) {
            log('HARDREFRESH-001 getRegistrations resolved', { ms: Math.round(performance.now() - sw0), count: r.length });
          }, function (err) { log('HARDREFRESH-001 getRegistrations REJECTED', err && err.message); });
        }
        if (window.caches && caches.keys) {
          var c0 = performance.now();
          caches.keys().then(function (k) {
            log('HARDREFRESH-001 caches.keys resolved', { ms: Math.round(performance.now() - c0), count: k.length });
          }, function (err) { log('HARDREFRESH-001 caches.keys REJECTED', err && err.message); });
        }
        setTimeout(function () {
          if (!unloadStarted) {
            log('HARDREFRESH-001 ⚠ NO reload ~6s after click — an awaited step likely hung before location.reload(), or the confirm was cancelled. (ms since click: ' + Math.round(performance.now() - t0) + ')');
          } else {
            log('HARDREFRESH-001 reload started ✓');
          }
        }, 6000);
      } catch (e) { log('HARDREFRESH-001 click probe error', e && e.message); }
    }, true);
  } catch (_) {}

  // SETTINGS-SUBTAB-001 auto-capture REMOVED in 1.50.178: the MutationObserver
  // ran querySelectorAll('div') + getComputedStyle over the WHOLE DOM on every
  // mutation (its throttle only armed on a panel match, so normally it never
  // throttled). While typing in Settings that fires constantly -> forced reflow
  // storm -> main-thread freeze / blue screen. Run AntcvDiag.settings() by hand
  // with Settings open instead.

  // ---- PALETTE-MIX-001 ---------------------------------------------------
  // The "mixed visual style": app.js renders accent colours from its own
  // styleConfig/stylePackage while the CSS tokenises structure from a registry
  // package id. Capture BOTH sources + the actual computed colours of key
  // rendered elements so the exact mismatch can be pinpointed (no browser here).
  function cc(el, prop) {
    try { return el ? window.getComputedStyle(el)[prop] : '(no-el)'; } catch (_) { return '(err)'; }
  }
  function probePalette() {
    try {
      var sc = readJSON('styleConfig') || {};
      var rep = {
        stylePackage_raw: (function () { try { return localStorage.getItem('stylePackage'); } catch (_) { return null; } })(),
        navyColor: readJSON('navyColor'),
        styleConfig_keys: {
          headerBg: sc.headerBg, sidebarBg: sc.sidebarBg, mainHeadColor: sc.mainHeadColor,
          sidebarHeadColor: sc.sidebarHeadColor, headerLineColor: sc.headerLineColor, mainLineColor: sc.mainLineColor
        },
        body_data_package: (document.body && (document.body.getAttribute('data-package') || document.body.getAttribute('data-style'))) || null
      };
      // Computed colours of the actually-rendered preview.
      var sidebar = document.querySelector('.antcv-preview-paper [class*="sidebar"], .antcv-preview-paper [style*="background"][style*="283556"], .antcv-cv-sidebar');
      var head = document.querySelector('.antcv-preview-paper h1, .antcv-preview-paper [class*="header"]');
      var mainHead = document.querySelector('.antcv-preview-paper h2, .antcv-preview-paper [class*="section"] h2, .antcv-preview-paper [class*="mainHead"]');
      rep.computed = {
        sidebarBg: cc(sidebar, 'backgroundColor'),
        headerColor: cc(head, 'color'),
        mainHeadColor: cc(mainHead, 'color')
      };
      log('PALETTE-MIX-001', rep);
      log('PALETTE-MIX-001 raw styleConfig', JSON.stringify(sc).slice(0, 700));
    } catch (e) { log('PALETTE-MIX-001 probe error', e && e.message); }
  }

  // ---- dump-all + auto snapshot -----------------------------------------
  function dumpAll() {
    log('==== AntcvDiag snapshot v' + V + ' ====');
    probeContribute(); probeSettings(); probeBoot(); probePalette();
    log('HARDREFRESH-001: click "↻ Hard Refresh" to probe its reload path live.');
  }
  window.AntcvDiag = dumpAll;
  window.AntcvDiag.contribute = probeContribute;
  window.AntcvDiag.settings = probeSettings;
  window.AntcvDiag.palette = probePalette;
  window.AntcvDiag.boot = probeBoot;
  window.AntcvDiag.hardrefresh = function () { log('HARDREFRESH-001: click the "↻ Hard Refresh" button to capture timing.'); };

  // ---- RESET-PROBE-001 (owner 2026-06-13) -------------------------------
  // "Scrolling the account menu to the end resets the app" keeps recurring.
  // This probe makes the NEXT occurrence self-describing. Mechanics:
  //  - every second, while the settings modal is open, its subtab guess +
  //    scrollTop/atEnd are checkpointed into sessionStorage;
  //  - pagehide stamps a GRACEFUL-unload marker (programmatic reload, link,
  //    pull-to-refresh all fire it; a renderer CRASH does not — but
  //    sessionStorage survives Chrome's crash-restore);
  //  - on boot, the navigation type + the two markers are read back and a
  //    loud verdict line is printed:
  //      graceful=true  + type=reload  -> something CALLED reload / PTR
  //      graceful=false + settings ctx -> the TAB CRASHED (memory/renderer)
  (function resetProbe() {
    try {
      var K_UNLOAD = 'antcv:resetprobe:unload', K_CTX = 'antcv:resetprobe:ctx';
      var nav = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || null;
      var unload = null, ctx = null;
      try { unload = JSON.parse(sessionStorage.getItem(K_UNLOAD) || 'null'); } catch (_) {}
      try { ctx = JSON.parse(sessionStorage.getItem(K_CTX) || 'null'); } catch (_) {}
      sessionStorage.removeItem(K_UNLOAD); sessionStorage.removeItem(K_CTX);
      var graceful = !!(unload && Date.now() - unload.ts < 120000);
      var inSettings = !!(ctx && Date.now() - ctx.ts < 120000 && ctx.settingsOpen);
      if (nav && nav.type !== 'navigate') {
        console.warn('[reset-probe] RESET-PROBE-001 verdict: navType=' + nav.type
          + ' graceful=' + graceful
          + (graceful ? ' (unload ' + Math.round((Date.now() - unload.ts) / 1000) + 's ago, vis=' + unload.vis + ')' : ' (NO unload marker — likely a TAB CRASH / memory kill)')
          + (inSettings ? ' | settings WAS open: scrollTop=' + ctx.scrollTop + ' atEnd=' + ctx.atEnd : ' | settings not open at checkpoint'));
      }
      window.addEventListener('pagehide', function () {
        try { sessionStorage.setItem(K_UNLOAD, JSON.stringify({ ts: Date.now(), vis: document.visibilityState })); } catch (_) {}
      });
      setInterval(function () {
        try {
          // the settings modal panel: fixed backdrop zIndex 10000 -> inner panel
          var panel = null;
          var els = document.querySelectorAll('div[style*="z-index: 10000"], div[style*="zIndex"]');
          for (var i = 0; i < els.length; i++) { if (els[i].style.zIndex === '10000') { panel = els[i].firstElementChild; break; } }
          if (!panel) { return; }
          var atEnd = panel.scrollHeight - panel.scrollTop - panel.clientHeight < 24;
          sessionStorage.setItem(K_CTX, JSON.stringify({ ts: Date.now(), settingsOpen: true, scrollTop: Math.round(panel.scrollTop), atEnd: atEnd }));
        } catch (_) {}
      }, 1000);
    } catch (_) {}
  })();

  // ---- ENHANCE-185-CAPTURE-001 (owner 2026-06-13) -----------------------
  // React #185 ("Maximum update depth exceeded") hit once on "Enhance core
  // competencies" (cached 1.50.285) and never reproduced synthetically. Trap
  // it: when a #185-class error surfaces, store a context snapshot (last
  // enhance click breadcrumb from app.js, stack, render context) in
  // localStorage so the report survives the blue screen / reload.
  (function trap185() {
    function capture(msg, stack) {
      try {
        var snap = {
          ts: new Date().toISOString(),
          msg: String(msg || '').slice(0, 300),
          stack: String(stack || '').slice(0, 1500),
          lastEnhance: window.__antcvLastEnhance || null,
          step: (function () { try { return JSON.parse(localStorage.getItem('step') || 'null'); } catch (_) { return null; } })(),
          href: location.href.split('?')[0],
        };
        localStorage.setItem('antcv:185capture', JSON.stringify(snap));
        console.warn('[185-capture] React #185 CAPTURED — snapshot at localStorage antcv:185capture', snap);
      } catch (_) {}
    }
    var is185 = function (s) { return /Maximum update depth|react error #185|error%2Fdecoder%3F%2F185|invariant=185/i.test(String(s || '')); };
    window.addEventListener('error', function (ev) {
      var m = (ev && ev.message) || '';
      var st = ev && ev.error && ev.error.stack;
      if (is185(m) || is185(st)) capture(m, st);
    });
    window.addEventListener('unhandledrejection', function (ev) {
      var r = ev && ev.reason;
      var m = (r && r.message) || String(r || '');
      if (is185(m) || is185(r && r.stack)) capture(m, r && r.stack);
    });
    // surface a prior capture loudly on boot, once
    try {
      var prior = localStorage.getItem('antcv:185capture');
      if (prior) console.warn('[185-capture] PRIOR #185 snapshot exists — paste this to the maintainer, then localStorage.removeItem("antcv:185capture"):', prior);
    } catch (_) {}
  })();

  // ---- RELOAD-ATTRIBUTION-001 (owner 2026-06-13) ------------------------
  // The subtab-scroll-end / topbar-language reload keeps recurring and the
  // graceful-unload verdict can't name the caller. Wrap location.reload so
  // the NEXT programmatic reload records its STACK + last interaction into
  // sessionStorage; the boot probe prints it. User-gesture reloads (hard
  // refresh button, login-clean-reload) are tagged so they're distinguishable
  // from a spurious one.
  (function reloadAttribution() {
    try {
      var KEY = 'antcv:reloadwho';
      // surface a captured caller from the previous page life
      var prev = sessionStorage.getItem(KEY);
      if (prev) {
        sessionStorage.removeItem(KEY);
        console.warn('[reload-who] the previous reload was triggered by:', prev);
      }
      var orig = window.location.reload.bind(window.location);
      // last meaningful user interaction (helps tell "I clicked X then it reloaded")
      var lastClick = '';
      document.addEventListener('click', function (e) {
        try {
          var t = e.target;
          lastClick = (t && (t.id || t.getAttribute && (t.getAttribute('data-antcv-genspeed') || t.getAttribute('data-lang') || t.getAttribute('aria-label')) || (t.textContent || '').trim().slice(0, 30))) || t.tagName;
        } catch (_) {}
      }, true);
      try {
        window.location.reload = function () {
          try {
            sessionStorage.setItem(KEY, JSON.stringify({
              ts: new Date().toISOString(),
              lastClick: lastClick,
              tag: window.__antcvReloadTag || '(untagged — investigate)',
              stack: (new Error('reload-trace').stack || '').split('\n').slice(1, 8).join(' <- '),
            }));
          } catch (_) {}
          return orig.apply(this, arguments);
        };
      } catch (_) { /* some browsers make reload read-only — non-fatal */ }
    } catch (_) {}
  })();

  setTimeout(dumpAll, 2500);
  try { console.warn('[antcv-diag] probes installed v' + V + ' — run AntcvDiag() any time.'); } catch (_) {}
})();
