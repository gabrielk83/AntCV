/* AntCV — EXPORT-PAGE2-001 diagnostic probe (read-only)
 * ============================================================
 *
 * Purpose
 * -------
 * Gather the evidence needed to diagnose EXPORT-PAGE2-001 without
 * changing anything. The bug: the document-export preview shows only
 * page 1 / page breaks are not applied; page 2 content is missing from
 * the rendered preview.
 *
 * What we already know (server side is healthy)
 * ---------------------------------------------
 * The docx-worker page-break smokes pass (smoke-pagebreak.js,
 * smoke-jd-questions-page2.js — 10/10 each), so the .docx export emits
 * page 2 correctly. The remaining surface is the CLIENT export-preview
 * path: antcv-pdf-preview-gate.js builds a modal with an iframe
 * (#antcv-pdf-preview-modal-iframe) and clones every .antcv-preview-paper
 * into it, applying `break-before: page` to [data-antcv-page-break] /
 * [data-page-break-before="true"]. Preview page count is derived as
 * (# of [data-antcv-page-break="1"] markers) + 1.
 *
 * This probe is NOT a fix and is NOT loaded by index.html. It is a
 * console tool. It only reads the DOM, the same-origin iframe document,
 * and computed styles; it never writes, patches window.fetch, or
 * mutates state.
 *
 * How to run
 * ----------
 * 1. Open the live site on the CV/CL whose export drops page 2.
 * 2. Open the document-export PREVIEW (the PDF/export preview modal) so
 *    the iframe is present. (You can also run it without the modal to
 *    inspect just the on-page preview papers.)
 * 3. Open DevTools console, paste this whole file, press Enter.
 * 4. It prints a SNAPSHOT and stashes it on window.__exportPage2Probe.last
 *    (copy with `copy(window.__exportPage2Probe.last)`).
 * 5. Paste the SNAPSHOT back. Key fields: `mainPreview.papers` (+ their
 *    marker counts and overflow), `exportIframe.papers` and
 *    `exportIframe.markers` (do they match the source?), and
 *    `exportIframe.markerBreakComputed` (is break-before actually
 *    applied?).
 */
(function () {
  'use strict';

  var IFRAME_ID = 'antcv-pdf-preview-modal-iframe';
  var MARKER_SELECTORS = ['[data-antcv-page-break="1"]', '[data-antcv-page-break]', '[data-antcv-pagebreak]', '[data-page-break-before="true"]'];
  // Approximate A4 content box at 96dpi (297mm tall). Used only to flag
  // "content taller than one page with no break marker".
  var PAGE_PX = 1122;

  function describe(el) {
    if (!el || el.nodeType !== 1) return String(el);
    var seg = el.tagName.toLowerCase();
    if (el.id) seg += '#' + el.id;
    if (el.className && typeof el.className === 'string') {
      var cls = el.className.trim().split(/\s+/).slice(0, 3).join('.');
      if (cls) seg += '.' + cls;
    }
    return seg;
  }

  function rectOf(el) {
    try { var r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; }
    catch (e) { return null; }
  }

  function countMarkers(root) {
    var counts = {};
    var unionSet = [];
    for (var i = 0; i < MARKER_SELECTORS.length; i++) {
      var sel = MARKER_SELECTORS[i];
      var n = 0;
      try {
        var nodes = root.querySelectorAll(sel);
        n = nodes.length;
        for (var j = 0; j < nodes.length; j++) if (unionSet.indexOf(nodes[j]) < 0) unionSet.push(nodes[j]);
      } catch (e) {}
      counts[sel] = n;
    }
    return { perSelector: counts, uniqueElements: unionSet };
  }

  // For each marker element, is a page break actually computed on it?
  function markerBreakComputed(markerEls, win) {
    var out = [];
    for (var i = 0; i < markerEls.length && i < 20; i++) {
      var el = markerEls[i];
      var cs = null;
      try { cs = (win || window).getComputedStyle(el); } catch (e) {}
      out.push({
        el: describe(el),
        breakBefore: cs ? cs.breakBefore : null,
        pageBreakBefore: cs ? cs.pageBreakBefore : null,
        display: cs ? cs.display : null,
      });
    }
    return out;
  }

  function inspectPapers(root, win) {
    var papers = [];
    var list;
    try { list = root.querySelectorAll('.antcv-preview-paper, [data-antcv-preview-paper]'); }
    catch (e) { return papers; }
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      var rect = rectOf(p);
      var markers = countMarkers(p);
      var scrollH = 0, clientH = 0;
      try { scrollH = p.scrollHeight; clientH = p.clientHeight; } catch (e) {}
      papers.push({
        index: i,
        selector: describe(p),
        rect: rect,
        scrollHeight: scrollH,
        clientHeight: clientH,
        markerCount: markers.uniqueElements.length,
        markersPerSelector: markers.perSelector,
        // overflow signature: content taller than ~one page but no
        // internal break marker => browser will paginate on print but
        // the on-screen single paper looks like "page 2 missing".
        overflowsOnePageWithoutMarker: (scrollH > PAGE_PX * 1.15) && markers.uniqueElements.length === 0,
        derivedPageCount: markers.uniqueElements.length + 1,
      });
    }
    return papers;
  }

  function inspectExportIframe() {
    var iframe = null;
    try { iframe = document.getElementById(IFRAME_ID); } catch (e) {}
    if (!iframe) {
      // Fall back: any iframe titled like a preview.
      try {
        var ifr = document.querySelectorAll('iframe');
        for (var i = 0; i < ifr.length; i++) {
          if (/preview|cv|export/i.test(ifr[i].title || ifr[i].id || '')) { iframe = ifr[i]; break; }
        }
      } catch (e) {}
    }
    if (!iframe) return { present: false };
    var doc = null, win = null;
    try { doc = iframe.contentDocument; win = iframe.contentWindow; } catch (e) {
      return { present: true, id: iframe.id || null, accessible: false, note: 'cross-origin or not yet loaded' };
    }
    if (!doc) return { present: true, id: iframe.id || null, accessible: false, note: 'no contentDocument' };
    var papers = inspectPapers(doc, win);
    var allMarkers = countMarkers(doc);
    var totalH = 0;
    try { totalH = doc.body ? doc.body.scrollHeight : 0; } catch (e) {}
    return {
      present: true,
      id: iframe.id || null,
      accessible: true,
      rect: rectOf(iframe),
      bodyScrollHeight: totalH,
      paperCount: papers.length,
      papers: papers,
      totalMarkerCount: allMarkers.uniqueElements.length,
      markerBreakComputed: markerBreakComputed(allMarkers.uniqueElements, win),
    };
  }

  function snapshot() {
    var mainPapers = inspectPapers(document, window);
    var mainMarkers = countMarkers(document);
    var iframe = inspectExportIframe();

    var report = {
      when: new Date().toISOString(),
      url: location.href,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      mainPreview: {
        paperCount: mainPapers.length,
        totalMarkerCount: mainMarkers.uniqueElements.length,
        derivedPageCount: mainMarkers.uniqueElements.length + 1,
        papers: mainPapers,
      },
      exportIframe: iframe,
      // The diagnostic question: does the iframe carry the same papers +
      // markers as the source? A mismatch is the page-2-missing signature.
      mismatch: iframe && iframe.accessible ? {
        paperCountSourceVsIframe: [mainPapers.length, iframe.paperCount],
        markerCountSourceVsIframe: [mainMarkers.uniqueElements.length, iframe.totalMarkerCount],
        iframeCarriesFewerPapers: iframe.paperCount < mainPapers.length,
        iframeCarriesFewerMarkers: iframe.totalMarkerCount < mainMarkers.uniqueElements.length,
      } : null,
      sidecars: {
        pdfPreviewGate: !!document.getElementById('antcv-pdf-preview-styles'),
        itemPagesRender: (window.AntcvItemPagesRender ? window.AntcvItemPagesRender.version : null),
        pageBreaksEverywhere284: (window.__antcvPageBreaksEverywhere284 || null),
        pdfPageMismatchChip: !!document.querySelector('[data-antcv-pdf-mismatch-chip]'),
      },
    };

    window.__exportPage2Probe.last = report;
    try {
      console.groupCollapsed('%c[EXPORT-PAGE2-001 probe] snapshot', 'color:#0a7;font-weight:bold');
      console.log('main preview papers (' + mainPapers.length + '), markers ' + report.mainPreview.totalMarkerCount + ':', mainPapers);
      console.log('export iframe:', iframe);
      console.log('source vs iframe mismatch:', report.mismatch);
      console.log('sidecars:', report.sidecars);
      if (!iframe.present) console.log('NOTE: export-preview iframe not found. Open the export/PDF preview modal first, then re-run __exportPage2Probe.snapshot().');
      console.log('Full object on window.__exportPage2Probe.last  (run `copy(__exportPage2Probe.last)`)');
      console.groupEnd();
    } catch (e) { console.log(report); }
    return report;
  }

  window.__exportPage2Probe = { version: '1.0.0', snapshot: snapshot, last: null };
  snapshot();
})();
