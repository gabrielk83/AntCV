/* antcv-neardup-preview-hide.js — PAN-IDRAET-PREVIEW-HIDE-001 (register row 13)
 * ============================================================================
 * The EXPORT collapses within-role near-duplicate bullets (1.51.70, sanitize-
 * ForExport -> _collapseRoleBullets), but the PREVIEW still showed the source
 * bullet — a preview/PDF mismatch. This sidecar VISUALLY hides the same losers
 * in the preview, INDEX-SAFE by construction:
 *  - stored sections are NEVER touched;
 *  - hidden bullets stay in the DOM (display:none + marker attribute), so the
 *    `roles.N.bullets.M` edit paths and every index-based consumer keep their
 *    positions (the ORPHAN-WRITE-VERIFY lesson: no reindexing, ever);
 *  - the predicate is THE EXPORT'S OWN function (window.AntcvCollapseRoleBullets,
 *    exposed by antcv-docx-client) — zero drift possible;
 *  - fully reversible: texts change -> re-evaluate -> un-hide.
 * Kill: localStorage['antcv:disable-neardup-preview-hide']='1'.
 */
(function () {
  'use strict';
  var VERSION = '1.51.77-neardup-preview-hide';
  if (window.__antcvNeardupPreviewHide === VERSION) return;
  window.__antcvNeardupPreviewHide = VERSION;

  var MARK = 'data-antcv-neardup-hidden';
  var PATH_RE = /^roles\.(\d+)\.bullets\.(\d+)$/;

  function disabled() { try { var v = localStorage.getItem('antcv:disable-neardup-preview-hide'); return v === '1' || v === 'true'; } catch (_) { return false; } }

  function bulletText(el) {
    try {
      var ed = el.querySelector('[data-antcv-editable-text]') || el.querySelector('[data-edit-path]') || el;
      return String(ed.textContent || '').replace(/ /g, ' ').trim();
    } catch (_) { return ''; }
  }

  // Pure: given the role's bullet texts + the export collapse fn, return the
  // indexes to hide (first-match consumption so duplicate texts stay stable).
  function computeHidden(texts, collapse) {
    try {
      if (!Array.isArray(texts) || texts.length < 2 || typeof collapse !== 'function') return [];
      var out = collapse({ bullets: texts.slice() });
      var kept = out && Array.isArray(out.bullets) ? out.bullets.slice() : texts.slice();
      if (kept.length >= texts.length) return [];
      var hidden = [];
      for (var i = 0; i < texts.length; i++) {
        var k = kept.indexOf(texts[i]);
        if (k === -1) hidden.push(i);
        else kept.splice(k, 1);                 // consume so true duplicates match one-to-one
      }
      return hidden;
    } catch (_) { return []; }
  }

  function sweep() {
    if (disabled()) return;
    var collapse = window.AntcvCollapseRoleBullets;
    if (typeof collapse !== 'function') return;   // docx-client module not loaded yet
    try {
      var els = document.querySelectorAll('[data-antcv-row-path]');
      var byRole = {};
      els.forEach(function (el) {
        var m = PATH_RE.exec(String(el.getAttribute('data-antcv-row-path') || ''));
        if (!m) return;
        (byRole[m[1]] = byRole[m[1]] || []).push({ el: el, idx: Number(m[2]) });
      });
      Object.keys(byRole).forEach(function (ri) {
        var rows = byRole[ri].sort(function (a, b) { return a.idx - b.idx; });
        var texts = rows.map(function (r) { return bulletText(r.el); });
        var hidden = computeHidden(texts, collapse);
        rows.forEach(function (r, i) {
          var shouldHide = hidden.indexOf(i) !== -1;
          var isHidden = r.el.getAttribute(MARK) === '1';
          if (shouldHide && !isHidden) {
            r.el.setAttribute(MARK, '1');
            r.el.style.display = 'none';
          } else if (!shouldHide && isHidden) {
            r.el.removeAttribute(MARK);
            r.el.style.display = '';
          }
        });
      });
    } catch (_) { /* never break the preview */ }
  }

  var t = null;
  function schedule() { clearTimeout(t); t = setTimeout(sweep, 500); }
  window.addEventListener('antcv:sections-updated', schedule);
  try {
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var tg = muts[i].target;
        // ignore our own attribute/style writes
        if (tg && tg.getAttribute && tg.getAttribute(MARK) === '1') continue;
        if (muts[i].attributeName === MARK || muts[i].attributeName === 'style') continue;
        schedule();
        return;
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  } catch (_) {}
  [900, 2500, 6000].forEach(function (ms) { setTimeout(sweep, ms); });
  window.AntcvNeardupPreviewHide = { version: VERSION, sweep: sweep, _computeHidden: computeHidden };
})();
