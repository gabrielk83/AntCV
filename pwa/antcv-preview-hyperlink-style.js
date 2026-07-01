/* antcv-preview-hyperlink-style.js — PREVIEW-HYPERLINK-STYLE-001 (owner 2026-07-01:
 * "make hyperlink look like hyperlinks also in preview").
 *
 * The DOCX/PDF export renders markdown links [text](url) as real hyperlinks, but the live
 * preview showed the RAW markdown as plain text, and autolinked bare URLs weren't visually
 * link-like. This sidecar restyles the preview only:
 *   - markdown [text](url)  -> a styled <a>text</a> (the raw markdown is hidden, matching export)
 *   - a bare http(s):// URL -> a styled <a> on the URL
 *   - existing <a> in the body -> given the link look (teal + underline), except in the navy
 *     candidate header band where the contact line must stay light.
 *
 * SAFE preview-DOM pattern (mirrors antcv-spell-annotator-384): only leaf text elements are
 * touched (no child elements), via innerHTML with an idempotency signature; React re-renders
 * revert it and we re-apply on antcv:sections-updated (debounced) + a MutationObserver — no tight
 * loop because we skip elements already linkified for the same text. Never touches export. Kill:
 * localStorage['antcv:disable-preview-links']='1'.
 */
(function () {
  'use strict';
  var VERSION = '1.51.38-preview-hyperlink-style';
  if (window.__antcvPreviewHyperlinkStyle === VERSION) return;
  window.__antcvPreviewHyperlinkStyle = VERSION;

  var LINK_TEAL = '#00746E';
  var MD = /\[([^\]\n]{1,120})\]\((https?:\/\/[^\s)]{3,400})\)/g;               // [text](url)
  var BARE = /(^|[\s(])((?:https?:\/\/)[^\s<)]{4,400})/g;                        // bare http(s) URL
  var SIG = 'data-antcv-linked';

  function disabled() { try { var v = localStorage.getItem('antcv:disable-preview-links'); return v === '1' || v === 'true'; } catch (_) { return false; } }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function inHeaderBand(el) {
    // the navy candidate header keeps its own light contact-line colour.
    return !!(el.closest && el.closest('[data-antcv-candidate-header],[class*="candidate-header" i],[class*="header-band" i]'));
  }
  function linkStyle(el) {
    // teal + underline on light body; leave header links to inherit (light on navy).
    return inHeaderBand(el) ? 'color:inherit;text-decoration:underline;' : 'color:' + LINK_TEAL + ';text-decoration:underline;';
  }

  function markup(text, el) {
    var st = linkStyle(el);
    var out = esc(text);
    var touched = false;
    // markdown first (so its inner url isn't double-linked by BARE)
    out = out.replace(MD, function (_m, label, url) {
      touched = true;
      return '<a href="' + esc(url) + '" target="_blank" rel="noopener" style="' + st + '">' + esc(label) + '</a>';
    });
    // bare urls not already inside an <a ...>...</a> we just made
    out = out.replace(BARE, function (m, pre, url) {
      // skip if this url already sits inside one of our anchors (href="url")
      if (out.indexOf('href="' + esc(url) + '"') >= 0) return m;
      touched = true;
      return pre + '<a href="' + esc(url) + '" target="_blank" rel="noopener" style="' + st + '">' + esc(url) + '</a>';
    });
    return touched ? out : null;
  }

  function papers() {
    try { return document.querySelectorAll('.antcv-preview-paper'); } catch (_) { return []; }
  }

  function scanOnce() {
    if (disabled()) return;
    var ps = papers(); if (!ps.length) return;
    for (var pi = 0; pi < ps.length; pi++) {
      // leaf elements only (no child elements) that contain a link pattern
      var nodes = ps[pi].querySelectorAll('*:not(script):not(style)');
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        if (el.childElementCount !== 0) continue;                 // leaf text only
        if (el.tagName === 'A') continue;                          // already an anchor
        var text = el.textContent || '';
        if (!text || (text.indexOf('](http') < 0 && text.indexOf('http') < 0)) continue;
        var sig = String(text.length) + ':' + text.slice(0, 40);
        if (el.getAttribute(SIG) === sig) continue;                // already done for this exact text
        var html = markup(text, el);
        if (html == null) { el.setAttribute(SIG, sig); continue; } // nothing to link; remember
        try { el.innerHTML = html; el.setAttribute(SIG, sig); } catch (_) {}
      }
      // style already-autolinked <a> in the body (not the header) with the link look
      var as = ps[pi].querySelectorAll('a');
      for (var j = 0; j < as.length; j++) {
        var a = as[j];
        if (a.getAttribute('data-antcv-linkstyled') === '1') continue;
        if (inHeaderBand(a)) { a.setAttribute('data-antcv-linkstyled', '1'); continue; }
        try { a.style.setProperty('color', LINK_TEAL, 'important'); a.style.setProperty('text-decoration', 'underline', 'important'); a.setAttribute('data-antcv-linkstyled', '1'); } catch (_) {}
      }
    }
  }

  var t = null;
  function schedule() { if (t) return; t = setTimeout(function () { t = null; try { scanOnce(); } catch (_) {} }, 180); }
  window.addEventListener('antcv:sections-updated', schedule);
  var mo = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) { if ((muts[i].addedNodes && muts[i].addedNodes.length) || muts[i].type === 'characterData') { schedule(); return; } }
  });
  function start() { try { mo.observe(document.body, { childList: true, subtree: true, characterData: true }); } catch (_) {} [500, 1500, 3500].forEach(function (ms) { setTimeout(schedule, ms); }); }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  window.AntcvPreviewLinks = { version: VERSION, scan: scanOnce };
})();
