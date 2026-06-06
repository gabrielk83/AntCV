/* AntCV package orphan auto-apply (v1.50.164)
 * ===========================================================================
 * Problem
 * -------
 * app.js's legacy DEFAULT package id is "scandinavian", which is NOT one of the
 * 7 registry styles. The Settings picker NORMALISES it to "Copenhagen Modern"
 * for display (so it looks selected), and the CSS cascade tokenises structural
 * colours to Copenhagen — but app.js still renders its own "scandinavian" accent
 * colours, producing a permanent palette MIX. The only thing that fixes it is
 * pressing a real package button, because that fires app.js's React setter which
 * RE-DERIVES the palette. On reload app.js never re-derives, so the mix returns.
 *
 * Fix (sidecar — app.js is built externally; its load path can't be changed here)
 * ------------------------------------------------------------------------------
 * When the stored package is the orphan default (any id not in the registry,
 * i.e. "scandinavian"), programmatically PRESS the Copenhagen Modern package
 * button once — exactly the manual fix — so the correct palette is applied
 * automatically. Scope: ONLY the orphan/mismatch; a clean, correctly-selected
 * package (or Custom) is never touched.
 *
 * Safety
 * ------
 *   - Fires only while stylePackage resolves to an orphan id (never "custom",
 *     never a clean registry id). Once a real id is applied, it stops.
 *   - Debounced + capped clicks per load (handles a late cloud-restore that
 *     reverts the orphan, without looping).
 *   - Matches the package button by its visible name ("Copenhagen Modern") —
 *     distinct from the "Copenhagen, Denmark" location line.
 * Escape: localStorage['antcv:disable-package-orphan-apply'] = '1'.
 */
(function () {
  'use strict';

  var VERSION = '1.50.172-yield-to-user';
  if (window.__antcvPackageOrphanApply === VERSION) return;
  window.__antcvPackageOrphanApply = VERSION;

  var DISABLE = 'antcv:disable-package-orphan-apply';
  var DISPLAY = {
    'copenhagen-modern': 'Copenhagen Modern',
    'navy-executive': 'Navy Executive',
    'warm-terracotta': 'Warm Terracotta',
    'nordic-frost': 'Nordic Frost',
    'pampas-contemporary': 'Pampas Contemporary',
    'tokyo-precision': 'Tokyo Precision',
    'delhi-technical': 'Delhi Technical'
  };
  var CLEAN_IDS = Object.keys(DISPLAY);
  var TARGET = 'copenhagen-modern';     // owner choice for the orphan default

  function disabled() {
    try { var v = localStorage.getItem(DISABLE); return v === '1' || v === 'true'; }
    catch (_) { return false; }
  }

  function readStylePackage() {
    var raw;
    try { raw = localStorage.getItem('stylePackage'); } catch (_) { return null; }
    if (raw == null) return null;
    raw = String(raw).trim();
    if (raw.charAt(0) === '"') { try { raw = JSON.parse(raw); } catch (_) {} }
    return String(raw).trim().toLowerCase();
  }

  // Orphan = a stored package that is not one of the clean registry ids
  // (the legacy "scandinavian" default). 'custom' and clean ids are left alone.
  function isOrphan() {
    var p = readStylePackage();
    if (p == null || p === 'custom') return false;
    return CLEAN_IDS.indexOf(p) < 0;
  }

  function findPackageButton(displayName) {
    var target = displayName.toLowerCase();
    var btns = document.querySelectorAll('button, [role="button"]');
    for (var i = 0; i < btns.length; i++) {
      var t = (btns[i].textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (!t) continue;
      // The package button's label leads with the style name. Keep it short so
      // we don't match a paragraph that merely mentions the name.
      if (t.indexOf(target) >= 0 && t.length <= 140) return btns[i];
    }
    return null;
  }

  var clicks = 0;
  var MAX = 6;
  var lastClick = 0;
  var selfClicking = false;   // true only while WE synthesize a click
  var userOverride = false;   // set once the USER picks any package -> we yield

  // The orphan migration must NEVER fight a deliberate user choice. The moment
  // the user clicks a package button themselves, stop auto-applying for the rest
  // of the session (otherwise the MutationObserver re-detects the orphan id that
  // app.js still stores and reverts the pick back to Copenhagen — the "have to
  // click several times" bug). The deeper persistence fix is APPJS-ID-SCHEME-UNIFY.
  function isPackageButton(el) {
    try {
      var node = el, hops = 0;
      while (node && hops < 4) {
        if (node.tagName === 'BUTTON' || (node.getAttribute && node.getAttribute('role') === 'button')) {
          var t = (node.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
          if (t && t.length <= 140) {
            for (var id in DISPLAY) {
              if (DISPLAY.hasOwnProperty(id) && t.indexOf(DISPLAY[id].toLowerCase()) >= 0) return true;
            }
          }
          return false;
        }
        node = node.parentElement; hops++;
      }
    } catch (_) {}
    return false;
  }
  try {
    document.addEventListener('click', function (ev) {
      if (selfClicking) return;            // ignore our own synthetic clicks
      if (isPackageButton(ev.target)) {
        userOverride = true;
        try { console.info('[package-orphan-apply] user picked a package — yielding (no more auto-apply)'); } catch (_) {}
      }
    }, true);
  } catch (_) {}

  function attempt() {
    if (disabled() || userOverride) return;
    if (!isOrphan()) return;            // clean / custom / nothing stored -> done
    if (clicks >= MAX) return;
    var now = Date.now();
    if (now - lastClick < 900) return;  // debounce
    var btn = findPackageButton(DISPLAY[TARGET]);
    if (!btn) return;                   // buttons not rendered yet (Settings closed)
    try {
      selfClicking = true;
      btn.click();
      selfClicking = false;
      clicks++; lastClick = now;
      try { console.info('[package-orphan-apply] orphan stylePackage detected; applied ' + TARGET + ' (click ' + clicks + ')'); } catch (_) {}
    } catch (_) { selfClicking = false; }
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    setTimeout(function () { pending = false; try { attempt(); } catch (_) {} }, 200);
  }

  function boot() {
    // Re-check across cloud-restore (which can revert the orphan) and lazy
    // Settings render.
    [600, 1500, 3000, 5000, 8000].forEach(function (d) { setTimeout(attempt, d); });
    try {
      new MutationObserver(schedule).observe(document.body || document.documentElement, {
        childList: true, subtree: true,
      });
    } catch (_) {}
    window.addEventListener('antcv:sections-updated', schedule);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.AntcvPackageOrphanApply = {
    version: VERSION,
    _isOrphan: isOrphan,
    _readStylePackage: readStylePackage,
    _findButton: function () { return findPackageButton(DISPLAY[TARGET]); },
    _attempt: attempt,
  };
})();
