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
  var V = '1.50.174-370';
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
  // Log any error during first paint (the blue-screen window).
  try {
    window.addEventListener('error', function (e) {
      if (performance.now() < 10000) log('LOGIN-GATE-001 boot ERROR', (e && e.message) || e, e && e.filename, e && e.lineno);
    }, true);
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
        var el = ev.target;
        var hops = 0, txt = '';
        while (el && hops < 4) { txt += ' ' + (el.textContent || ''); el = el.parentElement; hops++; }
        if (!/Hard Refresh/i.test(txt)) return;
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

  // ---- SETTINGS-SUBTAB-001 auto-capture ---------------------------------
  // The owner ran the snapshot with Settings closed (panel not found). Watch for
  // a Settings panel appearing and auto-run probeSettings the moment it opens.
  try {
    var lastSettingsRun = 0;
    new MutationObserver(function () {
      var now = Date.now();
      if (now - lastSettingsRun < 800) return;
      var hit = false, divs = document.querySelectorAll('div');
      for (var i = 0; i < divs.length; i++) {
        var t = divs[i].textContent || '';
        if (/\bSettings\b/.test(t) && /\bAdvanced\b/.test(t) && /\bStandard\b/.test(t)) {
          var cs = window.getComputedStyle(divs[i]);
          if (cs.position === 'fixed' || cs.position === 'absolute') { hit = true; break; }
        }
      }
      if (hit) { lastSettingsRun = now; log('SETTINGS-SUBTAB-001 panel opened — auto-probe:'); probeSettings(); }
    }).observe(document.body || document.documentElement, { childList: true, subtree: true });
  } catch (_) {}

  // ---- dump-all + auto snapshot -----------------------------------------
  function dumpAll() {
    log('==== AntcvDiag snapshot v' + V + ' ====');
    probeContribute(); probeSettings(); probeBoot();
    log('HARDREFRESH-001: click "↻ Hard Refresh" to probe its reload path live.');
  }
  window.AntcvDiag = dumpAll;
  window.AntcvDiag.contribute = probeContribute;
  window.AntcvDiag.settings = probeSettings;
  window.AntcvDiag.boot = probeBoot;
  window.AntcvDiag.hardrefresh = function () { log('HARDREFRESH-001: click the "↻ Hard Refresh" button to capture timing.'); };

  setTimeout(dumpAll, 2500);
  try { console.warn('[antcv-diag] probes installed v' + V + ' — run AntcvDiag() any time.'); } catch (_) {}
})();
