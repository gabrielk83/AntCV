/* antcv-preview-paper-memo.js — SETTINGS-PERSONAL-FREEZE-001 (owner 2026-07-03)
 * ============================================================================
 * ~40 sidecars carry a copy-pasted isInPreviewPaper() helper that calls
 *   document.querySelector('.antcv-preview-paper, [data-antcv-preview-paper]')
 * PER ELEMENT they inspect, on EVERY sweep. With Settings → Personal open
 * (hundreds of inputs) the CDP profile showed this one lookup at ~60% of ALL
 * CPU (isInPreviewPaper frames in 238/359/331/341/247/327/357/245/237/234…),
 * passes stretched to seconds, the sweeps re-triggered each other through
 * their MutationObservers, and the tab hard-froze ("buttons appear and
 * disappear in a loop" on faster machines).
 *
 * Fix at the single shared chokepoint: memoize EXACTLY that selector string on
 * Document.prototype.querySelector. The preview paper mounts/unmounts rarely;
 * a 250ms TTL + isConnected revalidation keeps every consumer correct while
 * collapsing tens of thousands of full-document scans per pass into one.
 * Anything other than this one selector-on-document passes straight through.
 * Kill: localStorage['antcv:disable-pp-memo']='1' (restores the original).
 */
(function () {
  'use strict';
  var VERSION = '1.51.59-pp-memo';
  if (window.__antcvPpMemo === VERSION) return;
  window.__antcvPpMemo = VERSION;

  try {
    var v = localStorage.getItem('antcv:disable-pp-memo');
    if (v === '1' || v === 'true') return;
  } catch (_) {}

  var SEL = '.antcv-preview-paper, [data-antcv-preview-paper]';
  var TTL = 250;
  var orig = Document.prototype.querySelector;
  if (typeof orig !== 'function') return;
  var cache = { t: -1e9, el: null };
  var now = (typeof performance !== 'undefined' && performance.now) ? function () { return performance.now(); } : function () { return Date.now(); };

  Document.prototype.querySelector = function (sel) {
    if (sel === SEL && this === document) {
      var t = now();
      if (t - cache.t < TTL && (cache.el === null || cache.el.isConnected)) return cache.el;
      var el = orig.call(this, sel);
      cache.t = t; cache.el = el;
      return el;
    }
    return orig.apply(this, arguments);
  };

  window.AntcvPreviewPaperMemo = {
    version: VERSION,
    _invalidate: function () { cache.t = -1e9; cache.el = null; },
    _peek: function () { return { age: now() - cache.t, has: !!cache.el }; },
  };
})();
