/* AntCV mobile preview-actions horizontal strip (v1.40.276 → fix 1.40.280)
 * ──────────────────────────────────────────────────────────────────────
 * On mobile, the three floating action buttons in the bottom-right
 * overlay — JD Analysis, Fusion (Fuse CV/CL), and Privacy LED — sit
 * vertically over the preview area and get in the user's way. Gabriel
 * asked for them to be placed horizontally at the top of the preview's
 * gray zone, between the "CV/CL preview" heading text and the PDF /
 * DOCX export buttons.
 *
 * v1.40.280 fix: tighten the export-toolbar detection. Previously,
 * `isExportButton` accepted any button whose textContent contained
 * "pdf" or "docx" as a word, which mis-fired on the home page's JD
 * upload zone whose click-target text reads "Drop job description here
 * or click to browse  PDF · DOCX · TXT". My old logic then walked up
 * to the JD URL panel, treated it as the export toolbar, and moved the
 * 3 FABs (including the Privacy LED) into it — making the LED appear
 * inline inside the JD card. The fix:
 *   - Length-cap `isExportButton`: real export buttons are ≤ 12 chars
 *     ("PDF", "↓ PDF", "DOCX", "📄 DOCX"); the JD upload zone's text is
 *     much longer.
 *   - Verify the candidate toolbar actually contains BOTH a short PDF
 *     button AND a short DOCX button — text mention alone isn't enough.
 *   - Relax `findPdfButton` to accept short button text containing
 *     "pdf" (e.g., "↓ PDF") instead of strict `/^pdf$/i`, so the strip
 *     lands in the right slot inside the real toolbar.
 *
 * Approach
 * ────────
 * Mobile-only re-parenting (no synthetic clones, no event re-binding):
 *   1. Locate the existing `.antcv-overlay-bottom-right` container that
 *      app.js populates with FABs (each carrying the `.antcv-fab` class).
 *   2. Locate the export toolbar by walking up from any visible PDF/DOCX
 *      button until we find an ancestor whose text contains both PDF
 *      and DOCX **and which actually has both buttons as direct
 *      descendants**.
 *   3. Insert a small flex-row container as a sibling of the PDF button,
 *      positioned immediately BEFORE it in DOM order.
 *   4. Move each FAB from the bottom-right overlay into that container.
 *      Original parents are tagged with a marker so we can restore on
 *      resize back to desktop.
 *
 * Because we move the existing React-rendered button elements (rather
 * than cloning them), all their click handlers, refresh intervals, and
 * popover positioning logic continue to work. We don't add or remove
 * any DOM; we just change parents.
 *
 * Desktop path: if viewport widens past the mobile threshold, the FABs
 * are moved back into `.antcv-overlay-bottom-right` and the relocation
 * strip is removed.
 */
(function () {
  'use strict';
  var VERSION = '1.40.280';
  if (window.__antcvMobilePreviewActions276 === VERSION) return;
  window.__antcvMobilePreviewActions276 = VERSION;

  var STRIP_MARKER = 'data-antcv-mobile-preview-actions-strip-276';
  var FAB_RELOCATED = 'data-antcv-fab-relocated-276';
  var SOURCE_MARKER = 'data-antcv-fab-source-276';
  var MAX = 900;

  function txt(el) { return String((el && el.textContent) || '').replace(/\s+/g, ' ').trim(); }
  function lower(el) {
    return (txt(el) + ' '
      + String((el && el.title) || '') + ' '
      + String((el && el.getAttribute && el.getAttribute('aria-label')) || '')
    ).toLowerCase();
  }
  function visible(el) {
    return !!(el && el.isConnected && (el.offsetWidth || el.offsetHeight ||
      (el.getClientRects && el.getClientRects().length)));
  }
  function isMobile() {
    var vw = window.innerWidth || document.documentElement.clientWidth || 0;
    if (vw <= MAX) return true;
    try { if (window.matchMedia && window.matchMedia('(pointer:coarse)').matches) return true; } catch (_) {}
    return false;
  }

  function isExportButton(b) {
    var s = txt(b);
    // Real export buttons are short: "PDF", "↓ PDF", "DOCX", "📄 DOCX".
    // The JD upload zone is a click-target whose textContent includes
    // "Drop job description here or click to browse PDF · DOCX · TXT" —
    // long enough that the length guard alone rejects it. Without this
    // guard, the upload zone gets matched as an export button and we
    // walk up to the JD URL panel, treat it as the export toolbar, and
    // wrongly relocate the FABs into the JD section (issue reported
    // against v1.40.276).
    if (s.length > 12) return false;
    if (s.length === 0) return false;
    return /\bpdf\b/i.test(s) || /\bdocx\b/i.test(s);
  }

  // Same pattern as mobile-topbar-cleanup-275: walk up from a PDF/DOCX
  // button until an ancestor's text contains both words. We then verify
  // that the candidate ancestor actually has BOTH a short PDF button
  // AND a short DOCX button — text-only match isn't enough because a
  // surrounding container may incidentally contain those words as
  // supporting text (e.g., the JD upload zone's "PDF · DOCX · TXT"
  // hint).
  function findExportToolbar() {
    var buttons = Array.prototype.slice.call(document.querySelectorAll('button,[role="button"],a'));
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      if (!visible(b) || !isExportButton(b)) continue;
      var p = b.parentElement;
      for (var hops = 0; p && p !== document.body && hops < 6; hops++, p = p.parentElement) {
        var t = lower(p);
        if (t.indexOf('pdf') < 0 || t.indexOf('docx') < 0) continue;
        if (hasShortPdfButton(p) && hasShortDocxButton(p)) return p;
      }
    }
    return null;
  }

  function hasShortPdfButton(root) {
    var btns = root.querySelectorAll('button,[role="button"],a');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if (!visible(b)) continue;
      var s = txt(b);
      if (s.length > 0 && s.length <= 12 && /\bpdf\b/i.test(s)) return true;
    }
    return false;
  }
  function hasShortDocxButton(root) {
    var btns = root.querySelectorAll('button,[role="button"],a');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if (!visible(b)) continue;
      var s = txt(b);
      if (s.length > 0 && s.length <= 12 && /\bdocx\b/i.test(s)) return true;
    }
    return false;
  }

  function findPdfButton(toolbar) {
    if (!toolbar) return null;
    var buttons = toolbar.querySelectorAll('button,[role="button"],a');
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      if (!visible(b)) continue;
      var s = txt(b);
      // Accept any short button containing "pdf" — e.g., "PDF", "↓ PDF",
      // "📄 PDF". Reject longer ones (the upload zone, etc.).
      if (s.length > 0 && s.length <= 12 && /\bpdf\b/i.test(s)) return b;
    }
    return null;
  }

  function findOverlayContainer() {
    return document.querySelector('.antcv-overlay-bottom-right');
  }

  function findFabs() {
    var container = findOverlayContainer();
    if (!container) {
      // FABs may have already been moved by a prior run — look for them
      // wherever they ended up by the relocation marker.
      var relocated = document.querySelectorAll('.antcv-fab[' + FAB_RELOCATED + '="1"]');
      return Array.prototype.slice.call(relocated);
    }
    var nodes = container.querySelectorAll('.antcv-fab');
    var out = [];
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (visible(n)) out.push(n);
    }
    return out;
  }

  function ensureStrip(toolbar, pdfBtn) {
    var strip = toolbar.querySelector(':scope > [' + STRIP_MARKER + ']');
    if (!strip) {
      strip = document.createElement('div');
      strip.setAttribute(STRIP_MARKER, '1');
    }
    // Place strip immediately before the PDF button (so visually it sits
    // between the heading text and the export buttons in a flex-row).
    if (pdfBtn && pdfBtn.parentElement === toolbar) {
      if (strip.parentElement !== toolbar || strip.nextSibling !== pdfBtn) {
        toolbar.insertBefore(strip, pdfBtn);
      }
    } else if (strip.parentElement !== toolbar) {
      toolbar.appendChild(strip);
    }
    return strip;
  }

  function relocate(strip, fabs) {
    for (var i = 0; i < fabs.length; i++) {
      var fab = fabs[i];
      if (fab.parentElement === strip && fab.getAttribute(FAB_RELOCATED) === '1') continue;
      // Tag the original parent so we can restore on desktop.
      var op = fab.parentElement;
      if (op && op !== strip) op.setAttribute(SOURCE_MARKER, '1');
      strip.appendChild(fab);
      fab.setAttribute(FAB_RELOCATED, '1');
    }
  }

  function restoreToDesktop() {
    var strip = document.querySelector('[' + STRIP_MARKER + ']');
    if (!strip) return;
    var src = findOverlayContainer() || document.querySelector('[' + SOURCE_MARKER + ']');
    var relocated = strip.querySelectorAll('[' + FAB_RELOCATED + '="1"]');
    for (var i = 0; i < relocated.length; i++) {
      var fab = relocated[i];
      fab.removeAttribute(FAB_RELOCATED);
      if (src && src !== strip) src.appendChild(fab);
    }
    if (strip.parentElement) strip.parentElement.removeChild(strip);
  }

  function apply() {
    // Recovery sweep for users who loaded the buggy v1.40.276: any FAB
    // that we tagged as relocated but isn't sitting in a current strip
    // — i.e., it was moved into a wrong "toolbar" (the JD upload zone)
    // and the strip has since been detached — gets pulled back to the
    // overlay container. This runs unconditionally before the mobile/
    // desktop branching so the stranded FAB recovers regardless of
    // which view the user is currently on.
    rescueStrandedFabs();

    if (!isMobile()) {
      restoreToDesktop();
      return;
    }
    var toolbar = findExportToolbar();
    if (!toolbar) return;
    var fabs = findFabs();
    if (!fabs.length) return;
    var pdfBtn = findPdfButton(toolbar);
    var strip = ensureStrip(toolbar, pdfBtn);
    relocate(strip, fabs);
  }

  // Find any FAB previously moved by an earlier (buggy) run that ended
  // up in a container we no longer recognise as a real export toolbar,
  // and put it back into `.antcv-overlay-bottom-right`.
  function rescueStrandedFabs() {
    var overlay = findOverlayContainer();
    if (!overlay) return;
    var stranded = document.querySelectorAll('.antcv-fab[' + FAB_RELOCATED + '="1"]');
    for (var i = 0; i < stranded.length; i++) {
      var fab = stranded[i];
      var strip = fab.closest('[' + STRIP_MARKER + ']');
      if (strip) {
        // It's inside a strip. Confirm the strip is inside a real
        // export toolbar (both short PDF and short DOCX buttons present
        // as siblings of the strip). If not, the strip is in a wrong
        // place — rescue.
        var stripParent = strip.parentElement;
        if (stripParent && hasShortPdfButton(stripParent) && hasShortDocxButton(stripParent)) {
          // Strip is inside a real toolbar — leave it.
          continue;
        }
        // Strip is in a wrong place. Move FAB out and remove the strip.
        fab.removeAttribute(FAB_RELOCATED);
        overlay.appendChild(fab);
        if (strip.children.length === 0 && strip.parentElement) {
          strip.parentElement.removeChild(strip);
        }
      } else {
        // FAB is marked relocated but no strip ancestor. Detached?
        // Move it back to overlay.
        fab.removeAttribute(FAB_RELOCATED);
        overlay.appendChild(fab);
      }
    }
  }

  function injectCss() {
    if (document.getElementById('antcv-mobile-preview-actions-276-css')) return;
    var s = document.createElement('style');
    s.id = 'antcv-mobile-preview-actions-276-css';
    s.textContent = [
      '[' + STRIP_MARKER + '="1"]{',
      '  display:inline-flex!important;',
      '  flex-direction:row!important;',
      '  align-items:center!important;',
      '  gap:8px!important;',
      '  flex:0 0 auto!important;',
      '  margin:0 8px!important;',
      '}',
      // Strip overrides for the FABs themselves so they sit inline at a
      // size appropriate for an inline toolbar, not at full FAB size.
      '[' + STRIP_MARKER + '="1"] .antcv-fab{',
      '  position:static!important;',
      '  margin:0!important;',
      '  transform:none!important;',
      '  width:36px!important;height:36px!important;',
      '  min-width:36px!important;min-height:36px!important;',
      '  max-width:36px!important;max-height:36px!important;',
      '  padding:0!important;',
      '  font-size:16px!important;line-height:1!important;',
      '  flex:0 0 auto!important;',
      '}',
      // Once the overlay is empty on mobile, hide the empty container
      // so it doesn't leave a click-eating ghost in the bottom-right.
      '@media (max-width:' + MAX + 'px), (pointer:coarse){',
      '  .antcv-overlay-bottom-right:empty{display:none!important;}',
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
        try { console.warn('[mobile-preview-actions-276]', e && e.message); } catch (_) {}
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedule, { once: true });
  } else {
    schedule();
  }
  var delays = [80, 200, 500, 1000, 2000, 4000];
  for (var i = 0; i < delays.length; i++) setTimeout(schedule, delays[i]);

  try {
    new MutationObserver(schedule).observe(document.body || document.documentElement, {
      childList: true, subtree: true,
      attributes: true, attributeFilter: ['class', 'style']
    });
  } catch (_) {}

  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);

  window.AntcvMobilePreviewActions276 = { version: VERSION, run: schedule };
})();
