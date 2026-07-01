/* antcv-preview-hyperlink-style.js — PREVIEW-HYPERLINK-STYLE-002 (owner 2026-07-01)
 *
 * Make links in the PREVIEW look like the export's hyperlinks. Owner scope + rules:
 *   - style links in ADDITIONAL INFORMATION + PUBLICATIONS (markdown [text](url) -> a real link,
 *     bare URLs -> a link); the raw markdown is hidden, matching the export.
 *   - COLOUR BY BACKGROUND: on a DARK background (the navy contact header) the link stays WHITE
 *     (just underlined + pressable), on a LIGHT background it is the teal link colour. This fixes
 *     the LinkedIn contact link that PREVIEW-HYPERLINK-STYLE-001 wrongly turned teal (and made
 *     "blink" — teal fighting React's white on every re-render). White-on-dark matches what React
 *     already paints, so there is no visible fight.
 *
 * Loop/blink control: apply ONLY on antcv:sections-updated (debounced) + a short boot sweep — NO
 * MutationObserver (v001's characterData observer re-fired on React's own revert = the blink). An
 * idempotency signature skips already-styled nodes. Never touches the export. Kill:
 * localStorage['antcv:disable-preview-links']='1'.
 */
(function () {
  'use strict';
  var VERSION = '1.51.39-preview-hyperlink-style';
  if (window.__antcvPreviewHyperlinkStyle === VERSION) return;
  window.__antcvPreviewHyperlinkStyle = VERSION;

  var TEAL = '#00746E';
  var WHITE = 'rgba(255,255,255,0.95)';
  var MD = /\[([^\]\n]{1,120})\]\((https?:\/\/[^\s)]{3,400})\)/g;
  var BARE = /(^|[\s(])((?:https?:\/\/)[^\s<)]{4,400})/g;
  var SIG = 'data-antcv-linked';

  function disabled() { try { var v = localStorage.getItem('antcv:disable-preview-links'); return v === '1' || v === 'true'; } catch (_) { return false; } }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // Effective background luminance (0..255) behind an element; null if unresolved.
  function bgLum(el) {
    var node = el;
    for (var i = 0; node && i < 16; i++, node = node.parentElement) {
      try {
        var m = String(getComputedStyle(node).backgroundColor || '').match(/rgba?\(([^)]+)\)/);
        if (m) { var p = m[1].split(',').map(function (s) { return parseFloat(s); }); var a = p.length > 3 ? p[3] : 1; if (a >= 0.5 && p.length >= 3) return 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]; }
      } catch (_) {}
    }
    return null;
  }
  function linkColor(el) { var l = bgLum(el); return (l != null && l < 140) ? WHITE : TEAL; }

  // Is this element inside ADDITIONAL INFORMATION or PUBLICATIONS (where the owner wants markdown
  // links rendered)? Match by the section [data-sid] or a nearby heading.
  function inLinkSection(el) {
    try {
      var sec = el.closest && el.closest('[data-sid]');
      var sid = sec && (sec.getAttribute('data-sid') || '');
      if (/additional|pubs|publication/i.test(sid)) return true;
    } catch (_) {}
    return false;
  }

  function markup(text, color) {
    var st = 'color:' + color + ';text-decoration:underline;';
    var out = esc(text), touched = false;
    out = out.replace(MD, function (_m, label, url) { touched = true; return '<a href="' + esc(url) + '" target="_blank" rel="noopener" style="' + st + '">' + esc(label) + '</a>'; });
    out = out.replace(BARE, function (m, pre, url) { if (out.indexOf('href="' + esc(url) + '"') >= 0) return m; touched = true; return pre + '<a href="' + esc(url) + '" target="_blank" rel="noopener" style="' + st + '">' + esc(url) + '</a>'; });
    return touched ? out : null;
  }

  function scanOnce() {
    if (disabled()) return;
    var ps; try { ps = document.querySelectorAll('.antcv-preview-paper'); } catch (_) { return; }
    for (var pi = 0; pi < ps.length; pi++) {
      // (1) markdown / bare-URL leaf text -> links, ONLY in additional/publications.
      var nodes = ps[pi].querySelectorAll('*:not(script):not(style)');
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        if (el.childElementCount !== 0 || el.tagName === 'A') continue;
        var text = el.textContent || '';
        if (!text || (text.indexOf('](http') < 0 && text.indexOf('http') < 0)) continue;
        if (!inLinkSection(el)) continue;
        var sig = String(text.length) + ':' + text.slice(0, 40);
        if (el.getAttribute(SIG) === sig) continue;
        var html = markup(text, linkColor(el));
        if (html == null) { el.setAttribute(SIG, sig); continue; }
        try { el.innerHTML = html; el.setAttribute(SIG, sig); } catch (_) {}
      }
      // (2) every existing <a> in the preview gets the link LOOK, coloured by its background
      // (white on the navy header, teal on light) so the contact links look pressable + underlined
      // WITHOUT the teal-on-navy blink.
      var as = ps[pi].querySelectorAll('a');
      for (var j = 0; j < as.length; j++) {
        var a = as[j];
        var col = linkColor(a);
        if (a.getAttribute('data-antcv-linkcol') === col) continue;
        try { a.style.setProperty('color', col, 'important'); a.style.setProperty('text-decoration', 'underline', 'important'); a.style.setProperty('cursor', 'pointer', 'important'); a.setAttribute('data-antcv-linkcol', col); } catch (_) {}
      }
    }
  }

  var t = null;
  function schedule() { if (t) return; t = setTimeout(function () { t = null; try { scanOnce(); } catch (_) {} }, 260); }
  window.addEventListener('antcv:sections-updated', schedule);
  // short boot sweep only — NO MutationObserver (that caused the v001 blink loop).
  [800, 2000, 4500, 9000].forEach(function (ms) { setTimeout(schedule, ms); });
  window.AntcvPreviewLinks = { version: VERSION, scan: scanOnce };
})();
