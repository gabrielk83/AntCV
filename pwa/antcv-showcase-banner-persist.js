/* antcv-showcase-banner-persist.js — SHOWCASE-BANNER-PERSIST-001 (owner 2026-06-18)
 * ============================================================================
 * Owner: "for the entire time a kernel is in generation keep the purple/black
 * status on, even after moving to the editor — right now it ends while there's
 * still lots of activity on the editor."
 *
 * The native banner (#antcv-showcase-progress-banner, app.src.js ~27575) is tied
 * to `kernelShowcaseInProgress` and is removed the instant the showcase RESULT
 * COMMITS — but the editor then keeps rendering (lamination / pagination / fit).
 * This sidecar continues the banner past that point: when the native banner
 * disappears it shows an identical CLONE and keeps it up until the editor's DOM
 * goes QUIET (no structural mutations for QUIESCE_MS) — so the status reflects
 * the whole generation+render, not just the kernel commit.
 *
 * No app.src.js / app.js surgery — it never touches the generation state, only
 * mirrors + extends the banner element. Disable:
 *   localStorage['antcv:disable-showcase-banner-persist'] = '1'.
 */
(function () {
  'use strict';
  if (window.__antcvShowcaseBannerPersist) return;
  window.__antcvShowcaseBannerPersist = '1.50.632';
  if (typeof document === 'undefined') return;
  try { var d = localStorage.getItem('antcv:disable-showcase-banner-persist'); if (d === '1' || d === 'true') return; } catch (_) {}

  var NATIVE_ID = 'antcv-showcase-progress-banner';
  var CLONE_ID = 'antcv-showcase-progress-banner-persist';
  var BODY_CLASS = 'antcv-banner-active';
  var QUIESCE_MS = 2500;   // editor counts as settled after this much DOM-quiet
  var MAX_MS = 60000;      // hard cap so the continuation can never get stuck
  var TICK_MS = 500;

  var savedHTML = '', savedStyle = '';
  var nativeSeen = false, lastActivity = 0, contStartedAt = 0;
  var tick = null, activityMo = null;

  function now() { return new Date().getTime(); }
  function bump() { lastActivity = now(); }
  function native() { return document.getElementById(NATIVE_ID); }
  function cloneEl() { return document.getElementById(CLONE_ID); }
  function genActive() {
    try { var v = localStorage.getItem('kernelShowcaseInProgress'); return v === 'true' || v === '1'; } catch (_) { return false; }
  }

  // Heavy subtree observer runs ONLY while the continuation clone is up — bumps
  // activity on any editor DOM change (ignoring the clone's own subtree).
  function startActivityWatch() {
    if (activityMo) return;
    try {
      activityMo = new MutationObserver(function (muts) {
        var c = cloneEl();
        for (var i = 0; i < muts.length; i++) {
          var t = muts[i].target;
          if (c && (t === c || (c.contains && c.contains(t)))) continue;
          bump(); break;
        }
      });
      activityMo.observe(document.body, { childList: true, subtree: true });
    } catch (_) {}
  }
  function stopActivityWatch() { if (activityMo) { try { activityMo.disconnect(); } catch (_) {} activityMo = null; } }

  function showContinuation() {
    if (cloneEl() || !savedHTML) return;
    var el = document.createElement('div');
    el.id = CLONE_ID;
    el.setAttribute('style', savedStyle);
    el.innerHTML = savedHTML;
    document.body.appendChild(el);
    try { document.body.classList.add(BODY_CLASS); } catch (_) {}
    contStartedAt = now(); bump();
    startActivityWatch();
    if (!tick) tick = setInterval(tickFn, TICK_MS);
  }
  function removeContinuation() {
    var el = cloneEl(); if (el) { try { el.remove(); } catch (_) {} }
    stopActivityWatch();
    if (tick) { clearInterval(tick); tick = null; }
    if (!native()) { try { document.body.classList.remove(BODY_CLASS); } catch (_) {} }
  }
  function tickFn() {
    if (native()) { removeContinuation(); return; }   // native took over again (new gen)
    if (!cloneEl()) { if (tick) { clearInterval(tick); tick = null; } return; }
    try { document.body.classList.add(BODY_CLASS); } catch (_) {} // app.js removed it on commit — keep the 52px offset
    var idle = now() - lastActivity;
    var capped = now() - contStartedAt > MAX_MS;
    if ((!genActive() && idle >= QUIESCE_MS) || capped) removeContinuation();
  }

  // Lightweight always-on observer (direct children only) detects the native
  // banner appearing (snapshot it) and disappearing (continue it).
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
  // Catch a banner that already exists at script load.
  try { if (native()) onBody(); } catch (_) {}

  window.AntcvShowcaseBannerPersist = {
    version: '1.50.632',
    _active: function () { return !!cloneEl(); },
    _stop: removeContinuation
  };
})();
