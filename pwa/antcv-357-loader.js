/* AntCV 357 sidecar loader (v1.40.358-loader)
 * ============================================================
 *
 * Purpose
 * -------
 * Registers the additive sidecars that otherwise need new <script>
 * tags in index.html. The inline PHOTO_B64 blob in index.html makes
 * whole-file rewrites through the deploy tools fragile, so this
 * loader injects the tags at runtime instead. It is itself
 * registered by ONE <script> line in index.html, and pulls in:
 *
 *   1. antcv-validation-severity-consumer-357.js  (VAL-001 / VF-016)
 *   2. antcv-help-text-wording-357.js             (PB-005 / TB-003)
 *   3. antcv-page-break-icon-357.js               (PB-005 / GEN-003)
 *   4. antcv-analysis-panel-jd-block-356.js       (analysis-panel fix)
 *
 * NOTE on versions: each entry's `v` is the cache-bust query string.
 * Bump it here when the target file changes so browsers refetch.
 * The loader skips any sidecar whose base src is ALREADY present in
 * the DOM (e.g. a direct <script> tag in index.html). When a direct
 * tag exists, ITS ?v= governs the loaded version — so to push a new
 * build, bump the direct tag in index.html too (or remove it and let
 * the loader own the version).
 *
 * Safety
 * ------
 *   - Idempotent: a single guard flag means the loader injects once.
 *   - Skips any script whose src is already present in the DOM.
 *   - No \s regex literals; no \u escapes.
 *   - Pure tag injection; touches no app DOM or state itself.
 */
(function () {
  'use strict';

  var VERSION = '1.40.358-loader';
  if (window.__antcv357Loader === VERSION) return;
  window.__antcv357Loader = VERSION;

  var SCRIPTS = [
    { src: 'antcv-validation-severity-consumer-357.js', v: '1.40.357-val001c' },
    { src: 'antcv-help-text-wording-357.js', v: '1.40.357-p1b2' },
    { src: 'antcv-page-break-icon-357.js', v: '1.40.357-pb005b' },
    { src: 'antcv-analysis-panel-jd-block-356.js', v: '1.40.358' }
  ];

  function alreadyPresent(src) {
    var tags = document.getElementsByTagName('script');
    for (var i = 0; i < tags.length; i++) {
      var s = tags[i].getAttribute('src') || '';
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
