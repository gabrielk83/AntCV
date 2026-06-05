/* AntCV AI watermark — last-page page-box anchor (v1.40.341-p1a)
 * ============================================================
 *
 * WM-001 + WM-002 + VF-004
 * ------------------------
 * Acceptance per plan §4.5:
 *   WM-001: Watermark is a page-level object anchored to the
 *           last page only. Never part of body flow. Does not
 *           move when content reflows. One-, two-, three-page
 *           docs all show the watermark only on the last page
 *           lower corner in Preview, DOCX, PDF.
 *   WM-002: Choose lower-left vs lower-right by available
 *           visual distance from main content. Keep visible on
 *           coloured backgrounds. Never overlap text.
 *
 * Scope of this sidecar
 * ---------------------
 * Preview side only. DOCX worker v1.14.13 already renders the
 * AI disclosure on the last page as a styled paragraph anchored
 * to the page flow (it survives LibreOffice/CloudConvert PDF
 * conversion intact — see workers/docx-worker/CHANGELOG.md).
 * The PDF render path inherits from DOCX via CloudConvert.
 *
 * The Preview today renders the AI watermark via the
 * `antcv-ai-document-watermark` class (emitted by app.js) and
 * may show it on every page or on the wrong page after content
 * reflow. This sidecar:
 *
 *   1. Finds every .antcv-ai-document-watermark inside the
 *      preview paper.
 *   2. Identifies the last page-box via `.antcv-page-row`
 *      (or `[data-antcv-page]` fallback).
 *   3. Hides every watermark instance NOT in the last page.
 *   4. Re-positions the last-page instance to absolute,
 *      bottom-right or bottom-left of its page-box parent,
 *      depending on which corner has more visual distance
 *      from the body content (per WM-002).
 *
 * Corner choice (WM-002)
 * ----------------------
 * For each candidate corner (LL / LR), compute the vertical
 * distance from the lowest body-content baseline to the page
 * bottom in that corner's horizontal slice (split the page
 * width into 2 halves). The corner with the larger distance
 * wins. Tie → right (cultural default in LTR scripts).
 *
 * Hazards
 * -------
 * - No \s in regex.
 * - No \u escapes in JSX (this is plain JS).
 * - Page-box detection relies on .antcv-page-row class (used by
 *   index.html print CSS). If the bundle ever renames it, the
 *   fallback to the LAST [data-sid] ancestor's bounding rect
 *   covers it.
 */
(function () {
  'use strict';

  var SCRIPT_VERSION = '1.50.140-wm-unify';
  if (window.__antcvWatermarkPageAnchor341 === SCRIPT_VERSION) return;
  window.__antcvWatermarkPageAnchor341 = SCRIPT_VERSION;

  var WATERMARK_SELECTOR = '.antcv-ai-document-watermark, [data-antcv-ai-disclosure], [data-antcv-watermark]';
  var PAGE_BOX_SELECTOR = '.antcv-page-row, [data-antcv-page]';
  var HIDDEN_FLAG = 'data-antcv-watermark-hidden-by-anchor';

  function findPreviewPaper() {
    return document.querySelector('.antcv-preview-paper, [data-antcv-preview-paper]');
  }

  function findPageBoxes(paper) {
    return Array.from(paper.querySelectorAll(PAGE_BOX_SELECTOR));
  }

  function findWatermarks(paper) {
    return Array.from(paper.querySelectorAll(WATERMARK_SELECTOR));
  }

  function lastVisible(arr) {
    for (var i = arr.length - 1; i >= 0; i--) {
      var rect;
      try { rect = arr[i].getBoundingClientRect(); } catch (_) { continue; }
      if (rect && (rect.width > 0 || rect.height > 0)) return arr[i];
    }
    return null;
  }

  function chooseCorner(pageBox) {
    // WM-002: pick LL vs LR by available distance from body
    // content. We split the page into left/right halves at the
    // midline, walk every body-content element (everything that
    // ISN'T our watermark or a page marker), and compute the
    // maximum bottom-edge Y in each half. The corner with the
    // LARGER gap (page bottom minus content bottom) wins.
    var rect;
    try { rect = pageBox.getBoundingClientRect(); } catch (_) { return 'right'; }
    if (!rect || !rect.width) return 'right';
    var midX = rect.left + rect.width / 2;
    var leftMaxBottom = rect.top;
    var rightMaxBottom = rect.top;
    var nodes = pageBox.querySelectorAll('*');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (!n || n.nodeType !== 1) continue;
      // Skip our own watermarks + structural page markers.
      if (n.classList && (
        n.classList.contains('antcv-ai-document-watermark') ||
        n.classList.contains('antcv-page-row')
      )) continue;
      if (n.getAttribute && (
        n.getAttribute('data-antcv-watermark') ||
        n.getAttribute('data-antcv-page-break') === '1' ||
        n.getAttribute('data-antcv-continuation-header') === '1'
      )) continue;
      var r;
      try { r = n.getBoundingClientRect(); } catch (_) { continue; }
      if (!r || (r.width === 0 && r.height === 0)) continue;
      var nodeMid = r.left + r.width / 2;
      if (nodeMid < midX) {
        if (r.bottom > leftMaxBottom) leftMaxBottom = r.bottom;
      } else {
        if (r.bottom > rightMaxBottom) rightMaxBottom = r.bottom;
      }
    }
    var leftGap = rect.bottom - leftMaxBottom;
    var rightGap = rect.bottom - rightMaxBottom;
    if (leftGap > rightGap + 8) return 'left';
    if (rightGap > leftGap + 8) return 'right';
    return 'right'; // LTR cultural default tie-break
  }

  function anchorToCorner(watermark, pageBox, corner) {
    // The page-box must be position:relative so our absolute
    // child anchors against it; if it isn't, set it.
    try {
      var cs = window.getComputedStyle ? window.getComputedStyle(pageBox) : null;
      if (cs && cs.position === 'static') {
        pageBox.style.position = 'relative';
      }
    } catch (_) {}
    watermark.style.position = 'absolute';
    watermark.style.bottom = '12pt';
    watermark.style.zIndex = '5';
    if (corner === 'left') {
      watermark.style.left = '14pt';
      watermark.style.right = 'auto';
    } else {
      watermark.style.right = '14pt';
      watermark.style.left = 'auto';
    }
    watermark.setAttribute('data-antcv-watermark-corner', corner);
    watermark.setAttribute('data-antcv-watermark-anchored', '1');
    // WM-003 (owner): text-only marker — strip the box (border, fill, padding,
    // radius, shadow) that app.js renders inline, leaving the light teal text
    // anchored in the corner. Matches the de-boxed DOCX/PDF export.
    watermark.style.setProperty('border', 'none', 'important');
    watermark.style.setProperty('background', 'transparent', 'important');
    watermark.style.setProperty('box-shadow', 'none', 'important');
    watermark.style.setProperty('padding', '0', 'important');
    watermark.style.setProperty('border-radius', '0', 'important');
    watermark.style.setProperty('max-width', 'none', 'important');
    // WM-002 (owner): adapt text colour to the corner's background. Over the
    // navy sidebar use a light colour (the muted teal is unreadable on navy);
    // over the white main column keep the muted teal.
    var sidebarSide = 'left';
    try {
      var sp = localStorage.getItem('sidebarPosition');
      if (sp) { try { var pp = JSON.parse(sp); if (typeof pp === 'string') sp = pp; } catch (_) {} sidebarSide = (String(sp).toLowerCase() === 'right') ? 'right' : 'left'; }
    } catch (_) {}
    watermark.style.setProperty('color', (corner === sidebarSide) ? 'rgba(255,255,255,0.78)' : 'rgba(0,116,110,0.72)', 'important');
  }

  function hideWatermark(wm) {
    if (wm.getAttribute(HIDDEN_FLAG) === '1') return;
    wm.setAttribute(HIDDEN_FLAG, '1');
    // Stash the original display so unhide can restore it.
    var orig = wm.style.display || '';
    wm.setAttribute('data-antcv-watermark-orig-display', orig);
    wm.style.display = 'none';
  }

  function unhideWatermark(wm) {
    if (wm.getAttribute(HIDDEN_FLAG) !== '1') return;
    var orig = wm.getAttribute('data-antcv-watermark-orig-display') || '';
    wm.style.display = orig;
    wm.removeAttribute(HIDDEN_FLAG);
    wm.removeAttribute('data-antcv-watermark-orig-display');
  }

  function tick() {
    var paper = findPreviewPaper();
    if (!paper) return;
    var watermarks = findWatermarks(paper);
    if (!watermarks.length) return;
    var pageBoxes = findPageBoxes(paper);
    var lastPage = lastVisible(pageBoxes);
    if (!lastPage) {
      // No page-row markers — fall back to the deepest [data-sid]
      // section's parent. Keeps the sidecar functional in older
      // bundle layouts.
      var sids = paper.querySelectorAll('[data-sid]');
      lastPage = sids.length ? sids[sids.length - 1] : paper;
    }
    // For every watermark, decide: keep + anchor on last page, or hide.
    var anchored = null;
    for (var i = 0; i < watermarks.length; i++) {
      var wm = watermarks[i];
      if (!wm.isConnected) continue;
      if (lastPage.contains(wm) && !anchored) {
        unhideWatermark(wm);
        try {
          var corner = chooseCorner(lastPage);
          anchorToCorner(wm, lastPage, corner);
        } catch (_) {}
        anchored = wm;
      } else {
        hideWatermark(wm);
      }
    }
    // If no watermark lived inside the last page, move the first
    // existing one there (clone-and-reinsert) so the disclosure
    // still appears.
    if (!anchored && watermarks.length) {
      var src = watermarks[0];
      try {
        var clone = src.cloneNode(true);
        clone.removeAttribute(HIDDEN_FLAG);
        clone.style.display = '';
        lastPage.appendChild(clone);
        var corner2 = chooseCorner(lastPage);
        anchorToCorner(clone, lastPage, corner2);
      } catch (_) {}
    }
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      try { tick(); } catch (_) {}
    });
  }

  schedule();
  var delays = [150, 500, 1500, 3000];
  for (var d = 0; d < delays.length; d++) setTimeout(schedule, delays[d]);

  try {
    new MutationObserver(function (records) {
      // Skip mutations whose only changes were on our own
      // anchored watermark (avoid feedback loop).
      var meaningful = false;
      for (var r = 0; r < records.length; r++) {
        var rec = records[r];
        var t = rec.target;
        if (t && t.nodeType === 1 && t.getAttribute && t.getAttribute('data-antcv-watermark-anchored') === '1') {
          continue;
        }
        meaningful = true;
        break;
      }
      if (meaningful) schedule();
    }).observe(document.body || document.documentElement, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'],
    });
  } catch (_) {}

  window.addEventListener('antcv:sections-updated', schedule);
  window.addEventListener('antcv:item-pages-changed', schedule);
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('beforeprint', function () { try { tick(); } catch (_) {} });

  window.AntcvWatermarkPageAnchor341 = {
    version: SCRIPT_VERSION,
    _tick: tick,
    _chooseCorner: chooseCorner,
  };

  try { console.debug('[watermark-page-anchor] installed v' + SCRIPT_VERSION); } catch (_) {}
})();
