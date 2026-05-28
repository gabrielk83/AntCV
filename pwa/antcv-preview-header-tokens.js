/* AntCV preview header-band tokenization (v1.50.41)
 * ===========================================================================
 *
 * Goal
 * ----
 * Make the preview's candidate-header band respond to package switches
 * live, without touching the minified app.js bundle. This is Phase 1
 * of Bucket 1 in the v1.50.0 plan (hex → CSS variables for document
 * content). Phase 1 is sidecar-driven: we override the inline styles
 * the legacy preview renderer baked in with `var(--header-*)` so the
 * body[data-package="..."] cascade owns the resolved colour.
 *
 * Phase 2+ would dig into the app.js source to remove the baked
 * hex at the source. That needs a live DOM session and is deferred
 * per CLAUDE.md hotfix discipline.
 *
 * What this sidecar covers
 * ------------------------
 * The candidate header band is the FIRST <table> inside
 * `.antcv-preview-paper`. It carries:
 *   - background colour     → var(--header-bg)
 *   - candidate name colour → var(--header-name-color)
 *   - specialisation colour → var(--header-spec-color)
 *   - contact-line colour   → var(--header-contact-color)
 *   - underline colour      → var(--header-line-color)
 *
 * We DO NOT touch:
 *   - The main column section colours (Profile, Experience, etc.)
 *   - The sidebar
 *   - Table cells (Core Competencies, What I Bring)
 *   - Export pipelines (DOCX, PDF, OOXML) — those resolve colours
 *     server-side via the package id in the payload.
 *
 * Failure mode
 * ------------
 * If the header band markup changes shape, the worst case is the
 * preview keeps its legacy baked colours and the user has to switch
 * packages via a Settings re-render. Nothing crashes, nothing
 * disappears.
 */
(function () {
  'use strict';

  if (window.__antcvPreviewHeaderTokens) return;
  window.__antcvPreviewHeaderTokens = '1.50.41';

  var TAG_ATTR = 'data-antcv-header-tokenized';

  // Map of legacy hex values we expect to find on the header band,
  // keyed by the CSS variable that should replace them. The match is
  // case-insensitive so we catch both #283556 and #283556.
  // The legacy DEFAULTS in app.js (v1.50.x): headerBg=#283556,
  // headerNameColor=#FFFFFF, headerSpecColor=#FFFFFF,
  // headerContactColor=#FFFFFF, headerLineColor=#01B7BB. The
  // tokenization swaps these AND any package-derived variant the
  // legacy preview renderer baked in.
  var HEADER_BG_CANDIDATES = ['#283556', '#1D2B45', '#8C4A32', '#37424A'];
  var HEADER_LINE_CANDIDATES = ['#01B7BB', '#D9A441', '#5C2E1F', '#7F9CB5'];

  function findPaper() {
    return document.querySelector('.antcv-preview-paper');
  }

  function findHeaderTable(paper) {
    if (!paper) return null;
    var tables = paper.querySelectorAll('table');
    if (!tables.length) return null;
    // The first table in DOM order is the header band per the
    // v1.40.137 photo-position sidecar's own probe logic. We
    // additionally require the table to contain something that
    // looks like a header band: navy/teal/terracotta bgcolor or
    // explicit background style.
    var first = tables[0];
    var bgInline = (first.getAttribute('style') || '').toLowerCase();
    var bgAttr = (first.getAttribute('bgcolor') || '').toLowerCase();
    var match = false;
    for (var i = 0; i < HEADER_BG_CANDIDATES.length; i++) {
      var hex = HEADER_BG_CANDIDATES[i].toLowerCase();
      if (bgInline.indexOf(hex) >= 0 || bgAttr === hex || bgAttr === hex.slice(1)) {
        match = true;
        break;
      }
    }
    return match ? first : null;
  }

  function rewriteStyle(el, varMap) {
    if (!el) return;
    var style = el.getAttribute('style') || '';
    var changed = false;
    Object.keys(varMap).forEach(function (hex) {
      // Match both #283556 and #283556 (case-insensitive) inside
      // the inline style string. We rebuild the style to ensure
      // the CSS parser picks up the change; setting style.cssText
      // would respect the engine's normalization but also re-quote
      // values awkwardly. String replace with a callback for the
      // ?: that handles upper/lower is safer.
      var lc = hex.toLowerCase();
      var uc = hex.toUpperCase();
      if (style.indexOf(lc) < 0 && style.indexOf(uc) < 0) return;
      style = style.split(lc).join(varMap[hex]);
      style = style.split(uc).join(varMap[hex]);
      changed = true;
    });
    if (changed) el.setAttribute('style', style);
    // bgcolor attribute on legacy tables.
    var bg = (el.getAttribute('bgcolor') || '').toLowerCase();
    if (bg) {
      for (var i = 0; i < HEADER_BG_CANDIDATES.length; i++) {
        var hex2 = HEADER_BG_CANDIDATES[i].toLowerCase();
        if (bg === hex2 || bg === hex2.slice(1)) {
          // Removing bgcolor lets the CSS background-color show
          // through. Replacing with the var() string in the
          // attribute is not legal (HTML bgcolor wants a hex /
          // named colour). The safer move: set the inline style
          // background-color to the var() and drop bgcolor.
          try { el.style.setProperty('background-color', varMap['#283556'] || 'var(--header-bg)', 'important'); } catch (_) {}
          el.removeAttribute('bgcolor');
          break;
        }
      }
    }
  }

  function tokenizeHeader(table) {
    if (!table) return;
    if (table.getAttribute(TAG_ATTR) === '1') return;
    var bgMap = {};
    HEADER_BG_CANDIDATES.forEach(function (h) { bgMap[h] = 'var(--header-bg)'; });
    var lineMap = {};
    HEADER_LINE_CANDIDATES.forEach(function (h) { lineMap[h] = 'var(--header-line-color)'; });
    // The text-colour map handles the white text used for name,
    // specialisation, and contact line. We can't distinguish between
    // them without selectors, so we use the same fallback var:
    // header-name-color. The PWA's registry keeps name/spec/contact
    // identical for every shipping package, so the visual outcome
    // is unchanged. The variables stay separately defined so a
    // future package CAN differentiate them.
    var whiteMap = {
      '#fff': 'var(--header-name-color, #fff)',
      '#ffffff': 'var(--header-name-color, #fff)',
    };

    // 1. Outer table: background.
    rewriteStyle(table, bgMap);

    // 2. Descendants: hunt for cells and text nodes carrying the
    // legacy colours.
    Array.prototype.forEach.call(table.querySelectorAll('*'), function (el) {
      rewriteStyle(el, bgMap);
      rewriteStyle(el, lineMap);
      rewriteStyle(el, whiteMap);
    });

    table.setAttribute(TAG_ATTR, '1');
  }

  function applyOnce() {
    var paper = findPaper();
    var table = findHeaderTable(paper);
    if (table) tokenizeHeader(table);
  }

  // Run on every commit. MutationObserver is the primary trigger;
  // a small debounce keeps repeated React renders cheap.
  var pending = null;
  function schedule() {
    if (pending != null) return;
    pending = requestAnimationFrame(function () {
      pending = null;
      try { applyOnce(); } catch (e) {
        try { console.warn('[antcv-preview-header-tokens] apply failed', e); } catch (_) {}
      }
    });
  }

  function boot() {
    schedule();
    var obs = new MutationObserver(schedule);
    obs.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'bgcolor', 'class'],
    });
    window.addEventListener('antcv:package-changed', schedule);
    window.addEventListener('storage', function (ev) {
      if (ev.key === 'personalInfo') schedule();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.AntcvPreviewHeaderTokens = {
    version: '1.50.41',
    apply: applyOnce,
  };
})();
