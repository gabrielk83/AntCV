/* AntCV sidebar section-row hide page button (v1.40.279)
 * ──────────────────────────────────────────────────────────────────────
 * In the section/preview panel each sidebar section row currently
 * carries six controls:
 *
 *     [◀] [📄1] [✨] [→] [ON] [✕]
 *
 * The [📄1] page button at the section level is redundant: every
 * sidebar section's individual sub-sub-section row (Tools & Methods
 * row, Certification row, Education row, Publication entry,
 * Regulatory bullet, Additional-info row) already carries its own
 * page selector via the existing row-control sidecars
 *   - antcv-additional-info-row-controls-247.js
 *   - antcv-publications-strict-row-layout-273.js
 *   - antcv-how-contribute-controls-245.js
 *   - antcv-core-competencies-row-controls-234.js
 *   - antcv-selected-outcomes-row-controls-237.js
 * which all wire page.onclick to cycle the
 * localStorage['antcv:itemPages'] entry 1→2→3→4→1.
 *
 * So we hide the section-level page button for sidebar sections only:
 *
 *     TOOLS & METHODS, CERTIFICATIONS, EDUCATION,
 *     PUBLICATIONS & PATENT, REGULATORY CONTEXT,
 *     ADDITIONAL INFORMATION
 *
 * Main-column sections (PROFILE, CORE COMPETENCIES, SELECTED OUTCOMES,
 * PROFESSIONAL EXPERIENCE, WHAT I BRING, HOW I WOULD CONTRIBUTE) are
 * untouched — their section-level page button is still useful where
 * sub-rows are bulleted lists rather than item-records.
 *
 * Detection
 * ─────────
 *   1. Walk up from each visible button until we land on an ancestor
 *      whose uppercase text contains one of the six sidebar section
 *      names AND which holds ≥ 4 buttons (the section-header row).
 *   2. Stop walking after that: we never want to mark the panel root.
 *   3. In the matched row, locate the page button by glyph (📄), pure
 *      digit textContent, or "page" in title/aria-label — same
 *      classification used by antcv-publications-section-panel-row-fix-278.js.
 *   4. Hide it via inline display:none plus a data attribute, so it's
 *      idempotent on re-runs and survives React re-renders that
 *      re-create the button (the MutationObserver re-applies on each
 *      subtree change).
 *
 * No other buttons are touched. Sub-sub-section row-level page buttons
 * are not affected — they live in deeper rows that don't carry a
 * section-name text.
 */
(function () {
  'use strict';
  var VERSION = '1.40.281';
  if (window.__antcvSidebarHidePage279 === VERSION) return;
  window.__antcvSidebarHidePage279 = VERSION;

  var SIDEBAR_SECTIONS = [
    'TOOLS & METHODS',
    'CERTIFICATIONS',
    'EDUCATION',
    'PUBLICATIONS & PATENT',
    'REGULATORY CONTEXT',
    'ADDITIONAL INFORMATION'
  ];

  // Main-column section names — used to disambiguate a single sidebar row
  // from the whole section panel. The panel contains every section name;
  // a single row contains only its own.
  var MAIN_SECTIONS = [
    'PROFILE',
    'CORE COMPETENCIES',
    'SELECTED OUTCOMES',
    'PROFESSIONAL EXPERIENCE',
    'WHAT I BRING',
    'HOW I WOULD CONTRIBUTE',
    'FOUNDATION',
    'WHY THIS POSITION',
    'WHO I AM'
  ];

  var ATTR_HIDDEN = 'data-antcv-sidebar-page-hidden-279';
  var ATTR_ROW    = 'data-antcv-sidebar-row-279';

  function clean(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function low(s)   { return clean(s).toLowerCase(); }
  function visible(el) {
    return !!(el && el.isConnected && (el.offsetWidth || el.offsetHeight ||
      (el.getClientRects && el.getClientRects().length)));
  }
  function btext(b) {
    if (!b) return '';
    var t = clean(b.textContent || '');
    var ti = (b.getAttribute && clean(b.getAttribute('title') || '')) || '';
    var al = (b.getAttribute && clean(b.getAttribute('aria-label') || '')) || '';
    return low((t || '') + ' ' + (ti || '') + ' ' + (al || ''));
  }

  // Same classification used by 278 — a button is a "page" button if
  // its textContent has a 📄 glyph or is a pure digit, or if its
  // title/aria-label mentions "page".
  function isPageButton(b) {
    if (!b) return false;
    var tc = low(clean(b.textContent || ''));
    var combined = btext(b);
    if (/📄/.test(tc)) return true;
    if (/^\d+$/.test(tc)) return true;
    if (/\bpage\b/.test(combined)) return true;
    return false;
  }

  // Count how many sidebar + main section names appear in `upperText`.
  // A single row's text matches exactly one. The panel root matches many.
  function countSectionMatches(upperText) {
    var n = 0;
    var i;
    for (i = 0; i < SIDEBAR_SECTIONS.length; i++) {
      if (upperText.indexOf(SIDEBAR_SECTIONS[i]) >= 0) n++;
    }
    for (i = 0; i < MAIN_SECTIONS.length; i++) {
      if (upperText.indexOf(MAIN_SECTIONS[i]) >= 0) n++;
    }
    return n;
  }

  // Walk up from each button looking for the smallest ancestor whose
  // text contains exactly ONE sidebar section name and no main-column
  // section names, AND whose total text is short (a real section
  // header row's text is just "EDUCATION ◀ 📄1 ✨ → ON ✕" — under 100
  // chars including button glyphs and titles), AND whose button count
  // is bounded to the controls in the row (≤ 10: up/down arrows +
  // back/page/enr/comp/on/del).
  //
  // The size caps are what excludes a section-block container whose
  // descendants include the section header PLUS the rendered item
  // rows. When a section is expanded in the panel, that block carries
  // the section name (from its header) plus item text and a much
  // larger button count — without the caps, my v1.40.279 detector
  // mistook the whole block for "the row" and hid every page button
  // inside, including the per-item subsubsection page selectors the
  // user relies on for page-split control. Hence v1.40.281 tightening.
  function findSidebarSectionRows() {
    var out = [];
    var btns = document.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if (!visible(b)) continue;
      var p = b.parentElement;
      for (var h = 0; p && p !== document.body && h < 8; h++, p = p.parentElement) {
        if (out.indexOf(p) >= 0) break;
        var upperText = clean(p.textContent || '').toUpperCase();
        // Hard ceiling on text length — an expanded section block
        // typically blows past 200 chars. The header row itself is far
        // smaller. 120 leaves comfortable headroom for the longest
        // sidebar name ("ADDITIONAL INFORMATION" = 22 chars) plus
        // button glyphs and stray whitespace.
        if (upperText.length === 0 || upperText.length > 120) {
          if (upperText.length > 500) break;     // way too high, stop
          continue;
        }
        if (countSectionMatches(upperText) !== 1) continue;
        var hasSidebarName = false;
        for (var s = 0; s < SIDEBAR_SECTIONS.length; s++) {
          if (upperText.indexOf(SIDEBAR_SECTIONS[s]) >= 0) { hasSidebarName = true; break; }
        }
        if (!hasSidebarName) continue;
        var buttonCount = p.querySelectorAll('button').length;
        // Header row carries between 4 (collapsed minimum) and 10
        // (up/down + back/page/enr/comp/on/del). Anything beyond that
        // includes item rows.
        if (buttonCount < 4 || buttonCount > 10) continue;
        out.push(p);
        break;
      }
    }
    return out;
  }

  function hidePageInRow(row) {
    var btns = row.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if (!isPageButton(b)) continue;
      if (b.hasAttribute(ATTR_HIDDEN)) continue;
      b.setAttribute(ATTR_HIDDEN, '1');
      // Inline style as belt-and-braces against framework re-styles.
      b.style.display = 'none';
      b.style.visibility = 'hidden';
      b.style.pointerEvents = 'none';
    }
  }

  function apply() {
    var rows = findSidebarSectionRows();
    for (var i = 0; i < rows.length; i++) {
      rows[i].setAttribute(ATTR_ROW, '1');
      try { hidePageInRow(rows[i]); } catch (_) {}
    }
  }

  function injectCss() {
    if (document.getElementById('antcv-sidebar-hide-page-279-css')) return;
    var s = document.createElement('style');
    s.id = 'antcv-sidebar-hide-page-279-css';
    s.textContent = [
      '[' + ATTR_HIDDEN + '="1"]{',
      '  display:none!important;',
      '  visibility:hidden!important;',
      '  pointer-events:none!important;',
      '}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(s);
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      injectCss();
      try { apply(); } catch (e) {
        try { console.warn('[sidebar-hide-page-279]', e && e.message); } catch (_) {}
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedule, { once: true });
  } else {
    schedule();
  }
  var delays = [80, 200, 500, 1000, 2000, 4000];
  for (var di = 0; di < delays.length; di++) setTimeout(schedule, delays[di]);

  try {
    new MutationObserver(schedule).observe(document.body || document.documentElement, {
      childList: true, subtree: true,
      attributes: true, attributeFilter: ['class', 'style', 'title', 'aria-label']
    });
  } catch (_) {}

  window.addEventListener('click', function () { setTimeout(schedule, 0); }, true);
  window.addEventListener('antcv:sections-updated', schedule);

  window.AntcvSidebarHidePage279 = {
    version: VERSION,
    run: schedule,
    _isPageButton: isPageButton,
  };
})();
