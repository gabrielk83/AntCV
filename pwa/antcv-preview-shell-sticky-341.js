/* AntCV Preview shell sticky visibility (v1.40.341-p0e)
 * ============================================================
 *
 * PRV-001 / PRV-002 / PRV-003 / GEN-009
 * --------------------------------------
 * Today the desktop Preview's chrome (the lower-right utility
 * FABs — Privacy 🛡, Fuse 🔀, third utility — plus the right-
 * side cluster and the PDF / DOCX buttons in the top gray strip)
 * intermittently DISAPPEARS after Settings → Application history
 * navigation or other route changes.
 *
 * Root cause (Gabriel's v1.40.341-zfix analysis, preserved on
 * stash@{0}):
 *
 *   antcv-overlay.js's isContentReady() polls every 1.5 s and
 *   reads localStorage.sections. The settings flow triggers a
 *   cloud-sync round-trip; during reconciliation the prefs
 *   object can briefly serialise with empty cv/cl arrays. The
 *   next poll sees no content and adds class
 *   `antcv-overlay-hidden` to the overlay root — hiding all the
 *   FABs. Nothing flips the class back unless sections changes
 *   again.
 *
 * Plan §4.7 (locked):
 *   The fix is one Preview-shell state derived from app state,
 *   not from route side-effects. Mobile is the parity reference
 *   for which buttons should be available at all.
 *
 * The real refactor is in app.js. Until that lands, this sidecar
 * implements the sticky-visibility guard: once we've observed
 * the overlay visible at least once, keep it visible. A
 * MutationObserver on the overlay root strips
 * `antcv-overlay-hidden` whenever it reappears, unless the user
 * has explicitly hit the full-erase / hard-reset path (step
 * 'upload' is the legitimate hide signal we honour).
 *
 * Scope: desktop only. Mobile keeps its own existing visibility
 * model — antcv-stability-core-334's applyPreviewActions still
 * runs and the sticky path is skipped there.
 *
 * Cooperation with other sidecars
 * -------------------------------
 * - antcv-overlay.js owns the actual hide/show transitions
 *   (we don't intercept its polling; we let it run normally on
 *   the FIRST hide, then keep the overlay visible thereafter).
 * - antcv-stability-core-334 owns mobile visibility — this
 *   sidecar's media-query guard skips it on viewport < 901px.
 * - antcv-editor-layout-cleanup-331's CSS hides
 *   antcv-preview-core-actions on desktop — we don't fight that;
 *   only the OVERLAY (FABs + chrome) is sticky.
 *
 * GEN-009 acceptance
 * ------------------
 * Preview utility + export buttons remain visible across
 * Set → Preview → Set → Preview, and hard refreshes in either
 * route. This sidecar handles the in-session visibility; the
 * "hard refresh restores them" guarantee comes from
 * isContentReady() running once on fresh load and the same
 * sticky logic kicking in.
 */
(function () {
  'use strict';

  var SCRIPT_VERSION = '1.40.341-p0e';
  if (window.__antcvPreviewShellSticky341 === SCRIPT_VERSION) return;
  window.__antcvPreviewShellSticky341 = SCRIPT_VERSION;

  var HIDDEN_CLASS = 'antcv-overlay-hidden';
  var OVERLAY_SELECTORS = [
    '.antcv-overlay',
    '[data-antcv-preview-overlay]',
    '.antcv-preview-overlay',
    '#antcv-fab-host',
  ];

  // Track whether the overlay has been observed visible at least
  // once in this session. We don't pin it visible BEFORE the user
  // has any content — that would expose the FABs before isContent
  // Ready validates them.
  var armed = false;
  // Honour the full-erase / hard-reset signal — when window.step
  // (or session storage marker) reads 'upload', the user is
  // intentionally clearing state.
  function isLegitimateReset() {
    try {
      if (typeof window.step === 'string' && window.step === 'upload') return true;
      var s = sessionStorage.getItem('antcv:step');
      if (s === 'upload' || s === 'reset') return true;
      var je = sessionStorage.getItem('antcv:just-erased');
      if (je) {
        var t = Number(je);
        if (Number.isFinite(t) && (Date.now() - t) < 5000) return true;
      }
    } catch (_) {}
    return false;
  }

  function isDesktop() {
    try {
      return window.matchMedia && window.matchMedia('(min-width: 901px)').matches;
    } catch (_) {}
    return true;
  }

  function findOverlayRoots() {
    var out = [];
    for (var i = 0; i < OVERLAY_SELECTORS.length; i++) {
      var nodes = document.querySelectorAll(OVERLAY_SELECTORS[i]);
      for (var j = 0; j < nodes.length; j++) out.push(nodes[j]);
    }
    return out;
  }

  function isOverlayVisible(el) {
    if (!el || !el.isConnected) return false;
    if (el.classList && el.classList.contains(HIDDEN_CLASS)) return false;
    try {
      var rect = el.getBoundingClientRect();
      if (rect && (rect.width > 0 || rect.height > 0)) return true;
    } catch (_) {}
    return false;
  }

  function unhide(el) {
    if (!el || !el.classList) return false;
    if (!el.classList.contains(HIDDEN_CLASS)) return false;
    el.classList.remove(HIDDEN_CLASS);
    try { console.debug('[preview-shell-sticky] unhid', el); } catch (_) {}
    return true;
  }

  // v1.50.81 — anti-ping-pong back-off. antcv-overlay re-adds
  // `antcv-overlay-hidden` whenever isContentReady() is false (Settings open,
  // or transient empty sections during cloud-sync). We strip it. Both observe
  // the overlay, so we fought each other at frame rate → the privacy-FAB
  // flicker + a contributor to the rAF flood, AND the FAB showed "on the side"
  // in Settings where the overlay is meant to be hidden. Distinguish a single
  // transient hide (preview bug — correct it once) from a persistent hide
  // (Settings / not-ready — antcv-overlay should win): after repeated unhides
  // in a short window, yield for a few seconds so it settles hidden.
  var unhideTimes = [];
  var yieldUntil = 0;
  function nowMs() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
  function tick() {
    if (!isDesktop()) return;
    var overlays = findOverlayRoots();
    if (!overlays.length) return;
    for (var i = 0; i < overlays.length; i++) {
      if (isOverlayVisible(overlays[i])) {
        armed = true;
        break;
      }
    }
    if (!armed) return;
    if (isLegitimateReset()) return;
    var now = nowMs();
    if (now < yieldUntil) return; // backed off — let antcv-overlay's hide stand
    var didUnhide = false;
    for (var k = 0; k < overlays.length; k++) {
      if (unhide(overlays[k])) didUnhide = true;
    }
    if (didUnhide) {
      unhideTimes.push(now);
      unhideTimes = unhideTimes.filter(function (t) { return now - t < 2000; });
      if (unhideTimes.length >= 3) {
        // antcv-overlay keeps re-hiding (persistent) — stop fighting so it
        // doesn't flicker and stays hidden where intended (e.g. Settings).
        yieldUntil = now + 5000;
        unhideTimes = [];
        try { console.debug('[preview-shell-sticky] persistent hide — backing off 5s'); } catch (_) {}
      }
    }
  }

  function install() {
    tick();
    // First-class polling supplements the MutationObserver to
    // cover transitions the observer misses (e.g., DOM teardown +
    // rebuild on route change).
    setInterval(tick, 1500);
    var delays = [150, 500, 1500, 3000];
    for (var d = 0; d < delays.length; d++) setTimeout(tick, delays[d]);
    try {
      // v1.50.81 — only react to class changes ON an overlay root (the
      // hide/show toggle), not every class mutation in the document. Reacting
      // to the whole body made this tick on every sidecar's class write and
      // amplified the fight. The 1.5s poll covers overlay re-mounts.
      var mo = new MutationObserver(function (records) {
        for (var r = 0; r < records.length; r++) {
          var rec = records[r];
          var t = rec.target;
          if (rec.type === 'attributes' && rec.attributeName === 'class'
            && t && t.nodeType === 1 && t.classList && t.classList.contains('antcv-overlay')) {
            tick();
            return;
          }
        }
      });
      mo.observe(document.body || document.documentElement, {
        attributes: true, attributeFilter: ['class'], subtree: true,
      });
    } catch (_) {}
    window.addEventListener('antcv:sections-updated', tick);
    window.addEventListener('focus', tick);
    window.addEventListener('hashchange', tick);
    window.addEventListener('popstate', tick);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }

  window.AntcvPreviewShellSticky341 = {
    version: SCRIPT_VERSION,
    isArmed: function () { return armed; },
    _tick: tick,
  };

  try { console.debug('[preview-shell-sticky] installed v' + SCRIPT_VERSION); } catch (_) {}
})();
