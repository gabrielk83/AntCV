/* AntCV — ROW-CONTROLS-DEDUPE-001 (v1.50.388)
 * ============================================================
 *
 * Owner 2026-06-12: "some lines have duplicated buttons. Especially …
 * sub-subsections that have 2 parts (such as verb + content …) — having
 * 2 page splitters per row makes absolutely no sense."
 *
 * Root shape: per-item controls come from app.js natively AND from several
 * generations of injection sidecars; with certain section shapes a row ends
 * up with TWO buttons of the same meaning. Headless boots with synthetic
 * data render clean rows, so rather than guessing which injector to gut,
 * this guard dedupes by SEMANTICS at the row level:
 *
 *   - An "item row host" is the nearest ancestor of a button that contains
 *     the row's text field (input/textarea) — nested fields make nested
 *     hosts, so a group header's buttons never pool with its items'.
 *   - Within one host, buttons are classed by meaning: page-split (📄/↧ or
 *     /page/i), fit (⇥ or /fit|tighten|compress/i), enhance (✨ or
 *     /enrich|enhance/i), cjlr (/alignment|cjlr/i), delete, visibility.
 *   - The FIRST button of each class stays (it already operates on the
 *     row's full content — "Enrich this item/row/outcome"); later ones are
 *     hidden (display:none + data-antcv-deduped="1") so the owning code
 *     keeps working and nothing is destroyed.
 *
 * Scope: the EDITOR side panel only. Never touches the preview, never
 * removes nodes, fully idempotent. Disable: localStorage
 * 'antcv:rowdedupe:off' = '1'. Report: window.AntcvRowDedupe.report().
 */
(function () {
  'use strict';

  if (window.__antcvRowControlsDedupeInstalled) return;
  var VERSION = '1.50.388';
  window.__antcvRowControlsDedupeInstalled = VERSION;

  function off() { try { return localStorage.getItem('antcv:rowdedupe:off') === '1'; } catch (_) { return false; } }

  function classify(btn) {
    var t = (btn.textContent || '').trim();
    var ti = ((btn.title || '') + ' ' + (btn.getAttribute('aria-label') || '')).toLowerCase();
    if (/📄|↧/.test(t) || /page\b|pagebreak|page break|start .* on page/.test(ti)) return 'page';
    if (t === '⇥' || /\bfit\b|tighten|compress/.test(ti)) return 'fit';
    if (t === '✨' || /enrich|enhance/.test(ti)) return 'enhance';
    if (/alignment|cjlr/.test(ti) || /^[⇤⇆≡]$/.test(t)) return 'cjlr';
    if (t === '✕' || /delete/.test(ti)) return 'delete';
    if (/👁|🙈/.test(t) || /visible|hidden — tap/.test(ti)) return 'vis';
    return null;
  }

  function hostOf(btn) {
    var n = btn.parentElement, hops = 0;
    while (n && hops++ < 7) {
      if (n.classList && n.classList.contains('antcv-editor-side-panel')) return null; // reached panel root: no field host
      if (n.querySelector && n.querySelector(':scope input, :scope textarea, :scope > * > input, :scope > * > textarea')) return n;
      n = n.parentElement;
    }
    return null;
  }

  var lastReport = [];
  function sweep() {
    if (off()) return;
    var panel = document.querySelector('.antcv-editor-side-panel');
    if (!panel) return;
    var groups = new Map(); // host -> { class -> [buttons] }
    panel.querySelectorAll('button').forEach(function (b) {
      var cls = classify(b);
      if (!cls) return;
      var host = hostOf(b);
      if (!host) return;
      if (!groups.has(host)) groups.set(host, {});
      var g = groups.get(host);
      (g[cls] = g[cls] || []).push(b);
    });
    var report = [];
    groups.forEach(function (g, host) {
      Object.keys(g).forEach(function (cls) {
        var list = g[cls].filter(function (b) { return b.offsetParent !== null || b.dataset.antcvDeduped === '1'; });
        if (list.length < 2) {
          // single (or none visible): un-hide anything we previously deduped
          g[cls].forEach(function (b) {
            if (b.dataset.antcvDeduped === '1' && g[cls].filter(function (x) { return x.dataset.antcvDeduped !== '1'; }).length < 1) {
              b.style.display = '';
              delete b.dataset.antcvDeduped;
            }
          });
          return;
        }
        list.slice(1).forEach(function (b) {
          if (b.dataset.antcvDeduped !== '1') {
            b.dataset.antcvDeduped = '1';
            b.style.display = 'none';
            report.push({ cls: cls, hidden: (b.title || b.textContent || '').slice(0, 50), host: (host.textContent || '').slice(0, 30) });
          }
        });
      });
    });
    if (report.length) {
      lastReport = report;
      try { console.log('[row-dedupe] hid ' + report.length + ' duplicate control(s):', report.map(function (r) { return r.cls; }).join(',')); } catch (_) {}
    }
  }

  var t = null;
  var mo = new MutationObserver(function () { clearTimeout(t); t = setTimeout(sweep, 450); });
  function boot() {
    try { mo.observe(document.body, { childList: true, subtree: true }); } catch (_) {}
    setTimeout(sweep, 1500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.AntcvRowDedupe = { version: VERSION, sweep: sweep, report: function () { return lastReport; } };
})();
