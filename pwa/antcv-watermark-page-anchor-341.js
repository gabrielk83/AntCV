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

  var SCRIPT_VERSION = '1.50.918-pagebox-parent-visible';
  if (window.__antcvWatermarkPageAnchor341 === SCRIPT_VERSION) return;
  window.__antcvWatermarkPageAnchor341 = SCRIPT_VERSION;

  var WATERMARK_SELECTOR = '.antcv-ai-document-watermark, [data-antcv-ai-disclosure], [data-antcv-watermark]';
  var PAGE_BOX_SELECTOR = '.antcv-page-row, [data-antcv-page]';
  var HIDDEN_FLAG = 'data-antcv-watermark-hidden-by-anchor';

  function findPreviewPaper() {
    return document.querySelector('.antcv-preview-paper, [data-antcv-preview-paper]');
  }

  // The active doc is stored in localStorage as a JSON string, so the raw
  // value is '"cl"' (with quotes), not 'cl'. Parse/strip before comparing.
  function docIsCl() {
    try {
      var v = localStorage.getItem('doc') || '';
      try { var p = JSON.parse(v); if (typeof p === 'string') v = p; } catch (_) {}
      return String(v).toLowerCase() === 'cl';
    } catch (_) { return false; }
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
      // Owner 2026-06-05: skip full-height structural/background containers
      // (the navy sidebar panel, the main-column wrapper, the page-row box).
      // They reach the page bottom even when their TEXT ends much higher, so
      // counting them made the "gap" look ~0 on the sidebar side and pushed
      // the watermark to the dense main column. We want the gap below actual
      // CONTENT, so ignore anything spanning most of the page height.
      if (rect.height && r.height >= rect.height * 0.8) continue;
      // WM-COLUMN-CLASSIFY-001 (owner 2026-06-25 "notice should be in the empty sidebar"):
      // classify by actual COLUMN container, NOT the geometric page midline. The main column
      // starts LEFT of midX (the sidebar is narrow), so a short left-aligned MAIN label — e.g.
      // the RECOMMENDATIONS "References" line — had its midpoint < midX and was mis-counted as
      // SIDEBAR content. That set leftMaxBottom = the main's bottom, cancelling the empty
      // sidebar's large gap -> leftGap == rightGap -> tie -> 'right'. Column membership fixes it.
      var __inMain = n.closest && n.closest('.antcv-document-main, [data-antcv-document-main="true"]');
      var __inSide = n.closest && n.closest('.antcv-document-sidebar');
      var __isLeft = __inSide ? true : (__inMain ? false : ((r.left + r.width / 2) < midX));
      if (__isLeft) {
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

  // BOOT-WM-PERF-001 (nightly 2026-06-24): chooseCorner() walks EVERY element in
  // the page and getBoundingClientRect()s each (O(N) forced layout). tick() runs
  // it on every input keystroke, the 1500ms interval, the MutationObserver and
  // the boot-storm — so it was a top boot-CPU consumer (~143ms, profiled via
  // diag-boot-profile.mjs) even when nothing relevant changed. Memoise the RESULT
  // by a cheap content signature (doc + page count + last-page text length +
  // viewport width — exactly what changes the corner). The cheap anchoring still
  // runs every tick (so React re-renders are handled); only the O(N) scan is
  // skipped when the signature is unchanged.
  var __ccSig = null, __ccCorner = 'right';
  function chooseCornerCached(box, sig) {
    if (sig !== null && sig === __ccSig) return __ccCorner;
    __ccCorner = chooseCorner(box);
    if (sig !== null) __ccSig = sig;
    return __ccCorner;
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
    // AI-NOTICE-MISSING-PREVIEW-001 (owner 2026-06-25 "the notice is MISSING from the preview" in
    // 917): the 914 fix re-parented the watermark INTO `.antcv-document-sidebar` so the left corner
    // anchored against the sidebar — but on the LAST page that sidebar column can be short / empty /
    // overflow-clipped, so the absolutely-positioned marker placed at the PAGE bottom landed outside
    // the sidebar's box and was clipped away (vanished). Re-parent into the PAGE-BOX instead: it
    // always spans the full page, so the left inset still resolves against the page's true left edge
    // (= the sidebar's left edge, what the owner wanted) while the marker stays visible. Idempotent
    // (guarded by parentNode) so it doesn't loop the MutationObserver.
    if (corner === 'left') {
      try {
        var __pbIsPage = pageBox.matches && pageBox.matches(PAGE_BOX_SELECTOR);
        if (__pbIsPage && watermark.parentNode !== pageBox) {
          pageBox.appendChild(watermark);
        }
      } catch (_) {}
    }
    watermark.style.position = 'absolute';
    watermark.style.zIndex = '5';
    // BUGFIX 2026-06-05 (CL watermark "gone"): a `bottom`/`right` inset only
    // lands on the page when the OFFSET PARENT is the page-box. On the cover
    // letter a closer positioned ancestor sits between the watermark and the
    // paper, so `bottom:12pt; right:14pt` resolved against that wrapper and the
    // marker ended up ~400px LEFT of the paper (probe: x=20, paperLeft=424).
    // Position relative to the ACTUAL offset parent, computed from the
    // page-box's rect, so it lands at the page-box's bottom corner no matter
    // what the offset parent is. Clamp into the viewport on narrow screens.
    var DEFAULT_INSET = 18; // ~14pt
    var op = watermark.offsetParent || pageBox;
    var pbr = null, wmr = null, opr = null;
    try {
      // reading offsetParent after setting position:absolute forces the
      // up-to-date value (and a layout) — that's what we want here.
      op = watermark.offsetParent || pageBox;
      pbr = pageBox.getBoundingClientRect();
      wmr = watermark.getBoundingClientRect();
      opr = op.getBoundingClientRect();
    } catch (_) {}
    if (pbr && opr) {
      // BUGFIX 2026-06-06 (watermark "lost" on mobile): the preview paper is
      // rendered inside a `transform: scale(ui)` zoom container (app.js preview
      // zoom; on a phone the auto-fit factor is well below 1). getBoundingClientRect
      // returns SCALED screen coords, but style.top/left are interpreted in the
      // offset parent's UNSCALED local coordinate space — so a screen-space delta
      // written as a local offset is wrong by the scale factor and pushes the
      // marker off the visible paper. Recover the cumulative scale from the offset
      // parent (rect size vs layout offset size) and convert every screen-space
      // delta into the offset parent's LOCAL space before writing it. scale === 1
      // on desktop, so this is a no-op there.
      var scaleX = (op.offsetWidth && opr.width) ? (opr.width / op.offsetWidth) : 1;
      var scaleY = (op.offsetHeight && opr.height) ? (opr.height / op.offsetHeight) : 1;
      if (!isFinite(scaleX) || scaleX <= 0) scaleX = 1;
      if (!isFinite(scaleY) || scaleY <= 0) scaleY = 1;
      var wmHLocal = ((wmr && wmr.height) || 12) / scaleY;
      var wmWLocal = ((wmr && wmr.width) || 60) / scaleX;
      var pbBottomLocal = (pbr.bottom - opr.top) / scaleY;
      var pbLeftLocal = (pbr.left - opr.left) / scaleX;
      var pbRightLocal = (pbr.right - opr.left) / scaleX;
      // vertical: sit ~16px above the page-box bottom.
      watermark.style.bottom = 'auto';
      watermark.style.top = (pbBottomLocal - wmHLocal - 16) + 'px';
      if (corner === 'left') {
        var leftLocal = pbLeftLocal + DEFAULT_INSET;
        if (leftLocal < 2) leftLocal = 2;
        watermark.style.left = leftLocal + 'px';
        watermark.style.right = 'auto';
      } else {
        watermark.style.left = (pbRightLocal - DEFAULT_INSET - wmWLocal) + 'px';
        watermark.style.right = 'auto';
      }
    } else {
      // Fallback to the old corner inset if rects are unavailable.
      watermark.style.bottom = '12pt';
      if (corner === 'left') { watermark.style.left = DEFAULT_INSET + 'px'; watermark.style.right = 'auto'; }
      else { watermark.style.right = DEFAULT_INSET + 'px'; watermark.style.left = 'auto'; }
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
    //
    // CRITICAL (owner 2026-06-05): this white-over-navy rule applies ONLY to
    // the two-column CV. The COVER LETTER is a single white column with no
    // navy sidebar, so painting it white made the watermark invisible
    // (white-on-white) — it looked "missing" in the preview even though the
    // export rendered it fine in teal. So: CL → always teal.
    var sidebarSide = 'left';
    try {
      var sp = localStorage.getItem('sidebarPosition');
      if (sp) { try { var pp = JSON.parse(sp); if (typeof pp === 'string') sp = pp; } catch (_) {} sidebarSide = (String(sp).toLowerCase() === 'right') ? 'right' : 'left'; }
    } catch (_) {}
    var overNavy = !docIsCl() && (corner === sidebarSide);
    watermark.style.setProperty('color', overNavy ? 'rgba(255,255,255,0.78)' : 'rgba(0,116,110,0.72)', 'important');
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
    // BOOT-WM-PERF-001: cheap signature of everything that affects the corner.
    var __wmSig = (docIsCl() ? 'cl' : 'cv') + '|' + pageBoxes.length + '|' + ((lastPage && lastPage.textContent || '').length) + '|' + Math.round(window.innerWidth || 0);
    // Keep the LAST watermark in document order — that's the lowest one, nearest
    // the content end (owner: the CL watermark must sit next to the end, like
    // Word — not the higher duplicate). Hide the rest. Anchor relative to the
    // last page-box when it contains the watermark, else the watermark's own parent.
    var anchored = null;
    for (var i = watermarks.length - 1; i >= 0; i--) {
      var wm = watermarks[i];
      if (!wm.isConnected) continue;
      if (!anchored) {
        unhideWatermark(wm);
        try {
          // BUGFIX 2026-06-05 (CL watermark off-paper): anchor relative to an
          // element that ACTUALLY contains the watermark, else position:absolute
          // resolves against the wrong offset parent and the marker lands ~400px
          // left of the paper (probe: x=20 while paperLeft=424). Prefer the last
          // page-box when it contains the watermark, then the paper (always
          // contains it on the CL), and only fall back to wm.parentElement last.
          var box = lastPage.contains(wm)
            ? lastPage
            : (paper.contains(wm) ? paper : (wm.parentElement || lastPage));
          // Owner 2026-06-05: DECOUPLE the CL from the CV. On the cover letter
          // the signature name sits bottom-LEFT, and chooseCorner kept landing
          // the marker on top of it ("hidden inside the name"). The CL marker
          // belongs on the RIGHT — opposite the left-aligned signature — per the
          // original spec. The CV stays dynamic (whichever column has more room).
          var corner = docIsCl() ? 'right' : chooseCornerCached(box, __wmSig);
          anchorToCorner(wm, box, corner);
          stashWmSide(corner);
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
        var corner2 = chooseCornerCached(lastPage, __wmSig);
        anchorToCorner(clone, lastPage, corner2);
        stashWmSide(corner2);
      } catch (_) {}
    }
  }

  // Owner 2026-06-05: the DOCX/PDF worker can't measure rendered column
  // heights, so it can't decide which COLUMN's text ends higher (the one
  // with empty space below it, where the watermark belongs). We already
  // compute that here as the larger-gap corner — persist it so the export
  // payload (antcv-docx-client) forwards it as `ai_wm_side`. Two-column CV
  // only; the single-column CL ignores the hint, so don't overwrite a CV
  // value while the CL is showing.
  function stashWmSide(corner) {
    try {
      if (docIsCl()) return;
      var side = (corner === 'left') ? 'left' : 'right';
      window.__antcvAiWmSide = side;
      localStorage.setItem('antcv:aiWmSide', side);
    } catch (_) {}
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
  // 1.50.328 (owner 2026-06-09): MOVE the AI notice when section lengths change.
  // antcv:auto-pages-changed fires whenever the measurer re-paginates — the
  // primary "a column got taller/shorter" signal — so re-run chooseCorner and
  // re-anchor (the notice belongs in whichever column now ends higher). Also
  // re-run on alignment changes and live edits (typing reflows a paragraph's
  // height without a sections event), plus a light poll as a backstop. schedule()
  // is rAF-debounced and tick() skips its own anchored-watermark mutations, so
  // these extra triggers can't loop; the CV last page is re-measured each time.
  window.addEventListener('antcv:auto-pages-changed', schedule);
  window.addEventListener('antcv:item-align-changed', schedule);
  window.addEventListener('input', schedule, true);
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('beforeprint', function () { try { tick(); } catch (_) {} });
  setInterval(schedule, 1500);

  window.AntcvWatermarkPageAnchor341 = {
    version: SCRIPT_VERSION,
    _tick: tick,
    _chooseCorner: chooseCorner,
  };

  try { console.debug('[watermark-page-anchor] installed v' + SCRIPT_VERSION); } catch (_) {}
})();
