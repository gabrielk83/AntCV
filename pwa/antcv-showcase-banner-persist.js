/* antcv-showcase-banner-persist.js — SHOWCASE-BANNER-PERSIST-001 (owner 2026-06-18)
 * ============================================================================
 * Owner: "for the entire time a kernel is in generation keep the purple/black
 * status on, even after moving to the editor — right now it ends while there's
 * still lots of activity."  Then (2026-06-19): "the correct time to the END of the
 * purple reload: ANALYSIS IS READY ON SCREEN."
 *
 * The native banner (#antcv-showcase-progress-banner, app.src.js ~27575) is removed
 * the instant the showcase RESULT COMMITS, but the full generation (the LAST phase of
 * which is "Generating analysis …") keeps running. This sidecar clones the banner and
 * keeps it up until generation truly finishes — i.e. until the analysis is ready —
 * then ends it promptly.
 *
 * END CONDITION (BANNER-END-ANALYSIS-READY-001, owner 2026-06-19): generation is
 * "active" while kernelShowcaseInProgress is set OR step === "generating" (this spans
 * the whole draft incl. the analysis phase, bridging the LLM's DOM-quiet lulls — so it
 * never ends early on a semi-empty template). The moment generation goes inactive the
 * analysis is on screen; end after a short render-settle GRACE. No heavy DOM-activity
 * observer anymore (it added churn for no benefit) — the end is driven by the
 * generation state, not by watching every editor mutation.
 *
 * No app.src.js / app.js surgery. Disable:
 *   localStorage['antcv:disable-showcase-banner-persist'] = '1'.
 */
(function () {
  'use strict';
  if (window.__antcvShowcaseBannerPersist) return;
  window.__antcvShowcaseBannerPersist = '1.50.696';
  if (typeof document === 'undefined') return;
  try { var d = localStorage.getItem('antcv:disable-showcase-banner-persist'); if (d === '1' || d === 'true') return; } catch (_) {}

  var NATIVE_ID = 'antcv-showcase-progress-banner';
  var CLONE_ID = 'antcv-showcase-progress-banner-persist';
  var BODY_CLASS = 'antcv-banner-active';
  var GRACE_MS = 1200;     // render-settle after generation goes inactive (analysis on screen)
  var MAX_MS = 180000;     // hard cap (3 min) so the continuation can't get stuck
  var TICK_MS = 400;

  var savedHTML = '', savedStyle = '';
  var nativeSeen = false, contStartedAt = 0, genStoppedAt = 0;
  var tick = null;

  function now() { return new Date().getTime(); }
  function native() { return document.getElementById(NATIVE_ID); }
  function cloneEl() { return document.getElementById(CLONE_ID); }
  function genActive() {
    try {
      var v = localStorage.getItem('kernelShowcaseInProgress');
      if (v === 'true' || v === '1') return true;
      // The main generate flow stores u.set('step','generating') -> '"generating"'.
      // step stays "generating" through the final "Generating analysis" phase, so it
      // is the authoritative "analysis not ready yet" signal.
      var step = localStorage.getItem('step');
      if (step && /generating/i.test(step)) return true;
    } catch (_) {}
    return false;
  }

  function showContinuation() {
    if (cloneEl() || !savedHTML) return;
    var el = document.createElement('div');
    el.id = CLONE_ID;
    el.setAttribute('style', savedStyle);
    el.innerHTML = savedHTML;
    document.body.appendChild(el);
    try { document.body.classList.add(BODY_CLASS); } catch (_) {}
    contStartedAt = now(); genStoppedAt = 0;
    if (!tick) tick = setInterval(tickFn, TICK_MS);
  }
  function removeContinuation() {
    var el = cloneEl(); if (el) { try { el.remove(); } catch (_) {} }
    if (tick) { clearInterval(tick); tick = null; }
    if (!native()) { try { document.body.classList.remove(BODY_CLASS); } catch (_) {} }
  }
  function tickFn() {
    if (native()) { removeContinuation(); return; }   // native took over again (new gen)
    if (!cloneEl()) { if (tick) { clearInterval(tick); tick = null; } return; }
    try { document.body.classList.add(BODY_CLASS); } catch (_) {} // app.js removed it on commit — keep the 52px offset
    if (genActive()) { genStoppedAt = 0; return; }    // still generating -> hold the banner
    // Generation just went inactive -> the analysis is ready on screen. Stamp the
    // moment, then end after a short render-settle grace (or the hard cap).
    if (!genStoppedAt) genStoppedAt = now();
    var ready = (now() - genStoppedAt) >= GRACE_MS;
    var capped = (now() - contStartedAt) > MAX_MS;
    if (ready || capped) removeContinuation();
  }

  // Lightweight always-on observer (direct children only) detects the native banner
  // appearing (snapshot it) and disappearing (continue it).
  function onBody() {
    var nb = native();
    if (nb) {
      nativeSeen = true;
      savedHTML = nb.innerHTML;
      savedStyle = nb.getAttribute('style') || '';
      removeContinuation();   // native owns the banner while it's present
      return;
    }
    if (nativeSeen && !cloneEl()) { nativeSeen = false; showContinuation(); }
  }
  try {
    var bodyMo = new MutationObserver(onBody);
    bodyMo.observe(document.body, { childList: true });
  } catch (_) {}
  try { if (native()) onBody(); } catch (_) {}

  window.AntcvShowcaseBannerPersist = {
    version: '1.50.696',
    _active: function () { return !!cloneEl(); },
    _stop: removeContinuation
  };
})();
