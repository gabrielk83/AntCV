/* AntCV A4 page-fit and watermark guard (v1.40.266)
 * Keeps the preview/print layout inside A4 pages (8.27in x 11.9in).
 * If a rendered section row would cross a page boundary, this sidecar
 * inserts a real page break before that row and, when the section continues,
 * inserts a same-color continuation heading. It also pins the AI watermark to
 * the bottom corner of the final A4 page, not to the end of text content.
 */
(function () {
  'use strict';

  if (window.__antcvA4PageFitInstalled) return;
  window.__antcvA4PageFitInstalled = '1.40.266';

  var A4_W_IN = 8.27;
  var A4_H_IN = 11.9;
  var RATIO = A4_H_IN / A4_W_IN;
  var MARK = 'data-antcv-a4-page-fit';
  var WATERMARK = 'data-antcv-a4-ai-watermark';
  var STORAGE_KEY = 'antcv:itemPages';
  var SECTIONS_KEY = 'sections';

  function injectCss() {
    if (document.getElementById('antcv-a4-page-fit-css-266')) return;
    var css = document.createElement('style');
    css.id = 'antcv-a4-page-fit-css-266';
    css.textContent = '' +
      '@page{size:8.27in 11.9in;margin:0;}' +
      '.antcv-preview-paper,[data-antcv-preview-paper]{width:8.27in;min-height:11.9in;box-sizing:border-box;position:relative;overflow:visible;}' +
      '[' + MARK + '="break"]{break-before:page;page-break-before:always;height:0!important;margin:0!important;padding:0!important;line-height:0!important;}' +
      '[' + MARK + '="cont"]{break-after:avoid;page-break-after:avoid;}' +
      '[' + WATERMARK + '="1"]{position:absolute;z-index:3;font-size:7pt;line-height:1.1;color:rgba(0,0,0,.38);font-family:Arial,Helvetica,sans-serif;pointer-events:none;white-space:nowrap;}' +
      '@media print{html,body{margin:0!important;padding:0!important;} .antcv-preview-paper,[data-antcv-preview-paper]{width:8.27in!important;min-height:11.9in!important;box-shadow:none!important;overflow:visible!important;}}';
    document.head && document.head.appendChild(css);
  }

  function activeDoc() {
    try {
      var v = localStorage.getItem('doc');
      return (v === 'cl' || v === 'cv') ? v : 'cv';
    } catch (_) { return 'cv'; }
  }

  function readSections() {
    try {
      var parsed = JSON.parse(localStorage.getItem(SECTIONS_KEY) || '{}');
      var list = parsed && parsed[activeDoc()];
      return Array.isArray(list) ? list : [];
    } catch (_) { return []; }
  }

  function readSection(sid) {
    var list = readSections();
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].id === sid) return list[i];
    return null;
  }

  function cleanTitle(s) {
    return String(s || '').replace(/\s*\([^)]*\)\s*$/g, '').trim();
  }

  function titleFor(sid) {
    var s = readSection(sid);
    return cleanTitle((s && s.title) || sid || 'SECTION');
  }

  function supportedSection(sid) {
    var s = readSection(sid);
    if (!s) return true; // keep DOM fallback active for older app builds
    var t = String(s.type || '');
    return t === 'labeled_list' || t === 'list' || t === 'education' || t === 'matrix' || t === 'text' || t === 'profile';
  }

  function paper() {
    return document.querySelector('.antcv-preview-paper, [data-antcv-preview-paper]');
  }

  function isVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function removeOurs(root) {
    if (!root) return;
    var nodes = root.querySelectorAll('[' + MARK + '],[' + WATERMARK + ']');
    for (var i = 0; i < nodes.length; i++) {
      try { nodes[i].parentNode && nodes[i].parentNode.removeChild(nodes[i]); } catch (_) {}
    }
  }

  function makeBreak() {
    var d = document.createElement('div');
    d.setAttribute(MARK, 'break');
    d.setAttribute('aria-hidden', 'true');
    d.style.breakBefore = 'page';
    d.style.pageBreakBefore = 'always';
    d.style.height = '0';
    d.style.margin = '0';
    d.style.padding = '0';
    d.style.lineHeight = '0';
    return d;
  }

  function sourceHeading(sectionEl) {
    return sectionEl && sectionEl.querySelector('[data-antcv-section-heading],h1,h2,h3,h4,[role="heading"]');
  }

  function makeCont(sectionEl, sid) {
    var h = document.createElement('div');
    h.setAttribute(MARK, 'cont');
    var src = sourceHeading(sectionEl);
    var cs = null;
    try { cs = src ? getComputedStyle(src) : null; } catch (_) {}
    var color = (cs && cs.color) || '#00746E';
    h.textContent = titleFor(sid).toUpperCase() + ' (Cont)';
    h.style.color = color;
    h.style.borderBottom = '1pt solid ' + color;
    h.style.paddingBottom = '2pt';
    h.style.margin = '4pt 0 7pt 0';
    h.style.fontWeight = (cs && cs.fontWeight) || '700';
    h.style.fontSize = (cs && cs.fontSize) || '11pt';
    h.style.fontFamily = (cs && cs.fontFamily) || 'Trebuchet MS, Calibri, sans-serif';
    h.style.breakAfter = 'avoid';
    h.style.pageBreakAfter = 'avoid';
    return h;
  }

  function rowIndex(el) {
    var p = el && el.getAttribute && el.getAttribute('data-antcv-row-path');
    var m = p && String(p).match(/items\.(\d+)/);
    return m ? parseInt(m[1], 10) : -1;
  }

  function findRows(sectionEl) {
    if (!sectionEl) return [];
    var rows = Array.prototype.slice.call(sectionEl.querySelectorAll('[data-antcv-row-path^="items."]'));
    if (rows.length) {
      var seen = Object.create(null);
      return rows.filter(function (el) {
        var p = el.getAttribute('data-antcv-row-path') || '';
        if (seen[p]) return false;
        seen[p] = true;
        return isVisible(el);
      });
    }
    var out = [];
    for (var i = 0; i < sectionEl.children.length; i++) {
      var c = sectionEl.children[i];
      if (!c || c.getAttribute && c.getAttribute(MARK)) continue;
      var tag = String(c.tagName || '').toLowerCase();
      if (/^h[1-6]$/.test(tag) || tag === 'hr') continue;
      if (isVisible(c)) out.push(c);
    }
    return out;
  }

  function pageHeightPx(p) {
    var r = p.getBoundingClientRect();
    return Math.max(1, r.width * RATIO);
  }

  function shouldAddCont(row, sectionEl) {
    var rows = findRows(sectionEl);
    return rows.length && rows[0] !== row;
  }

  function setItemPage(sid, idx, pageNo) {
    if (!sid || idx < 0 || pageNo < 2) return;
    try {
      var map = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (!map || typeof map !== 'object' || Array.isArray(map)) map = {};
      if (!map[sid] || typeof map[sid] !== 'object' || Array.isArray(map[sid])) map[sid] = {};
      if (Number(map[sid][String(idx)]) === pageNo) return;
      map[sid][String(idx)] = pageNo;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
      window.dispatchEvent(new CustomEvent('antcv:item-pages-changed', { detail: { sid: sid, index: idx, page: pageNo, source: 'a4-auto-fit' } }));
    } catch (_) {}
  }

  function applyBreakBefore(sectionEl, row, sid, pageNo) {
    var parent = row && row.parentNode;
    if (!parent) return;
    parent.insertBefore(makeBreak(), row);
    if (shouldAddCont(row, sectionEl)) parent.insertBefore(makeCont(sectionEl, sid), row);
    var idx = rowIndex(row);
    if (idx >= 0) setItemPage(sid, idx, pageNo);
  }

  function fitPages() {
    injectCss();
    var p = paper();
    if (!p || !isVisible(p)) return;
    removeOurs(p);

    var pRect = p.getBoundingClientRect();
    var pageH = pageHeightPx(p);
    var bottomPad = Math.max(14, pageH * 0.018);
    var sections = Array.prototype.slice.call(p.querySelectorAll('[data-sid]'));

    sections.forEach(function (sec) {
      var sid = sec.getAttribute('data-sid') || '';
      if (!sid || !supportedSection(sid) || !isVisible(sec)) return;
      var rows = findRows(sec);
      if (!rows.length) return;
      for (var i = 0; i < rows.length; i++) {
        var rr = rows[i].getBoundingClientRect();
        if (!rr.height) continue;
        var top = rr.top - pRect.top;
        var bottom = rr.bottom - pRect.top;
        var pageNo = Math.floor(Math.max(0, top) / pageH) + 1;
        var pageBottom = pageNo * pageH;
        if (bottom > pageBottom - bottomPad) {
          applyBreakBefore(sec, rows[i], sid, pageNo + 1);
          // Layout changed; re-measure on next scheduled pass.
          return;
        }
      }
    });

    placeWatermark();
  }

  function candidateTextNodesNearBottom(p, pageTop, pageH, rightHalf) {
    var pRect = p.getBoundingClientRect();
    var xMid = pRect.left + pRect.width / 2;
    var y1 = pRect.top + pageTop + pageH - Math.max(95, pageH * 0.10);
    var y2 = pRect.top + pageTop + pageH - 8;
    var count = 0;
    var els = p.querySelectorAll('*:not([' + WATERMARK + '])');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (!el || !el.textContent || !el.textContent.trim()) continue;
      var r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.bottom < y1 || r.top > y2) continue;
      var inRight = (r.left + r.width / 2) >= xMid;
      if (inRight === rightHalf) count++;
    }
    return count;
  }

  function placeWatermark() {
    var p = paper();
    if (!p || !isVisible(p)) return;
    var pRect = p.getBoundingClientRect();
    var pageH = pageHeightPx(p);
    var contentBottom = 0;
    var kids = Array.prototype.slice.call(p.children);
    kids.forEach(function (el) {
      if (!el || el.getAttribute && el.getAttribute(WATERMARK)) return;
      if (!isVisible(el)) return;
      var r = el.getBoundingClientRect();
      contentBottom = Math.max(contentBottom, r.bottom - pRect.top);
    });
    var pages = Math.max(1, Math.ceil((contentBottom + 24) / pageH));
    var totalH = pages * pageH;
    p.style.minHeight = totalH + 'px';

    var wm = document.createElement('div');
    wm.setAttribute(WATERMARK, '1');
    wm.textContent = 'AI-assisted draft. Review before use.';
    var lastTop = (pages - 1) * pageH;
    var leftLoad = candidateTextNodesNearBottom(p, lastTop, pageH, false);
    var rightLoad = candidateTextNodesNearBottom(p, lastTop, pageH, true);
    wm.style.top = Math.max(0, totalH - 22) + 'px';
    if (leftLoad <= rightLoad) {
      wm.style.left = '12pt';
      wm.style.right = 'auto';
      wm.style.textAlign = 'left';
    } else {
      wm.style.right = '12pt';
      wm.style.left = 'auto';
      wm.style.textAlign = 'right';
    }
    p.appendChild(wm);
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      try { fitPages(); } catch (e) { try { console.warn('[a4-page-fit] failed:', e && e.message); } catch (_) {} }
    });
  }

  injectCss();
  schedule();
  [150, 500, 1200, 2500].forEach(function (d) { setTimeout(schedule, d); });
  window.addEventListener('resize', schedule);
  window.addEventListener('beforeprint', function () { try { fitPages(); } catch (_) {} });
  window.addEventListener('antcv:sections-updated', schedule);
  window.addEventListener('antcv:item-pages-changed', schedule);

  function isOurNode(n) {
    return !!(n && n.nodeType === 1 && n.getAttribute && (n.getAttribute(MARK) || n.getAttribute(WATERMARK)));
  }

  try {
    var mo = new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var r = records[i];
        if (r.type === 'childList') {
          var allOurs = true;
          for (var a = 0; a < r.addedNodes.length; a++) if (!isOurNode(r.addedNodes[a])) { allOurs = false; break; }
          for (var b = 0; b < r.removedNodes.length; b++) if (!isOurNode(r.removedNodes[b])) { allOurs = false; break; }
          if (allOurs) continue;
        }
        if (isOurNode(r.target)) continue;
        schedule();
        break;
      }
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
  } catch (_) {}

  window.AntcvA4PageFit = { version: '1.40.266', apply: fitPages, watermark: placeWatermark };
})();
