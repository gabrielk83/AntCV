/* AntCV 357 sidecar loader (v1.40.357-loader)
 * ============================================================
 *
 * Purpose
 * -------
 * Registers the four additive sidecars that otherwise need new
 * <script> tags in index.html. The inline PHOTO_B64 blob in
 * index.html makes whole-file rewrites through the deploy tools
 * fragile, so this loader injects the tags at runtime instead.
 * It is itself registered by ONE <script> line in index.html
 * (small, safe edit), and pulls in:
 *
 *   1. antcv-validation-severity-consumer-357.js  (VAL-001 / VF-016)
 *      Stamps Set-menu validation nodes with data-antcv-severity
 *      so warnings render yellow and errors red. Pairs with the
 *      already-registered antcv-validation-severity-341.js token
 *      sidecar.
 *
 *   2. antcv-help-text-wording-357.js  (PB-005 / TB-003)
 *      Rewrites "Compress" -> "Fit" on non-button help/legend/
 *      caption/label leaf nodes the 341 button sweep can't reach.
 *
 *   3. antcv-page-break-icon-357.js  (PB-005 / GEN-003)
 *      Swaps a down-arrow glyph for the semantic next-page glyph
 *      (U+2398) ONLY on identified page-break controls.
 *
 *   4. antcv-analysis-panel-jd-block-356.js  (analysis-panel fix)
 *      Injects the JD paste/upload + "Analyse JD" controls INTO
 *      the Analysis panel. When no analysis exists yet the block
 *      becomes the visible content, so the panel is usable
 *      instead of only showing "Generate a CV first to see the
 *      analysis". When an analysis exists it sits below the
 *      result for compare-against-JD.
 *
 * Load order
 * ----------
 * The dependency sidecars (validation-severity-341, recheck-fit)
 * are already loaded with `defer` by the time this loader runs.
 * Injected scripts use `defer` too and are appended to <head> in
 * the same order, so they execute after the deferred set ahead of
 * them. Each target sidecar is idempotent and version-guarded, so
 * a double-load (if a tag is later also added to index.html) is a
 * no-op.
 *
 * Safety
 * ------
 *   - Idempotent: a single guard flag means the loader injects the
 *     set exactly once per page.
 *   - Skips any script whose src is already present in the DOM, so
 *     it never duplicates a tag that index.html already has.
 *   - No \s regex literals; no \u escapes.
 *   - Pure tag injection; touches no app DOM or state itself.
 */
(function () {
  'use strict';

  var VERSION = '1.40.357-loader';
  if (window.__antcv357Loader === VERSION) return;
  window.__antcv357Loader = VERSION;

  var SCRIPTS = [
    { src: 'antcv-validation-severity-consumer-357.js', v: '1.40.357-val001c' },
    { src: 'antcv-help-text-wording-357.js', v: '1.40.357-p1b2' },
    { src: 'antcv-page-break-icon-357.js', v: '1.40.357-pb005b' },
    { src: 'antcv-analysis-panel-jd-block-356.js', v: '1.40.356' }
  ];

  function alreadyPresent(src) {
    var tags = document.getElementsByTagName('script');
    for (var i = 0; i < tags.length; i++) {
      var s = tags[i].getAttribute('src') || '';
      // match ignoring the ?v= query string
      var base = s.split('?')[0];
      if (base === src || base.indexOf('/' + src) >= 0) return true;
    }
    return false;
  }

  function inject() {
    var head = document.head || document.getElementsByTagName('head')[0] || document.documentElement;
    var added = 0;
    for (var i = 0; i < SCRIPTS.length; i++) {
      var item = SCRIPTS[i];
      if (alreadyPresent(item.src)) continue;
      var el = document.createElement('script');
      el.src = item.src + '?v=' + item.v;
      el.defer = true;
      head.appendChild(el);
      added++;
    }
    try { console.debug('[antcv-357-loader] injected', added, 'sidecar(s) v' + VERSION); } catch (_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject, { once: true });
  } else {
    inject();
  }

  window.Antcv357Loader = { version: VERSION, inject: inject };
})();
