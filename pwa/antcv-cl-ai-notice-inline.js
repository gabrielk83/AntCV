/* AntCV cover-letter AI-notice inline placement (v1.50.96)
 * ============================================================================
 * Owner request: in the COVER LETTER, the AI notice should sit on the same row
 * as the signature name (after "Best regards,"), be written in the document's
 * language, carry NO surrounding box, and stay only partly visible.
 *
 * app.js emits the notice as a boxed corner watermark
 * (.antcv-ai-document-watermark, text "AI-assisted document", with a border +
 * white background). antcv-watermark-page-anchor-341 corner-anchors it. For the
 * CL we take that element over: relabel it in the active language, strip the
 * box, soften the opacity, and move it inline at the end of the signature-name
 * row. The corner sidecar skips any watermark we mark with
 * data-antcv-cl-inline="1", so the two do not fight.
 *
 * CV is untouched — the corner watermark there stays as-is.
 *
 * Fallback: if the sign-off / name row can't be found, we still de-box +
 * localise + soften the watermark in place (corner), so it never disappears.
 */
(function () {
  'use strict';
  if (window.__antcvClAiNoticeInline) return;
  window.__antcvClAiNoticeInline = '1.50.96';

  var NOTICE = {
    en: 'AI-assisted',
    da: 'AI-assisteret',
    es: 'Asistido por IA',
    'zh-CN': 'AI 辅助',
    zh: 'AI 辅助'
  };
  // Sign-off phrases (EN + the da/es/zh forms used by the translation patch).
  var SIGNOFFS = [
    'best regards,', 'kind regards,', 'sincerely,', 'warm regards,', 'yours sincerely,',
    'med venlig hilsen,', 'saludos cordiales,', 'atentamente,', '此致', '敬礼'
  ];

  function lang() {
    var v = '';
    try { v = localStorage.getItem('language') || localStorage.getItem('uiLang') || ''; } catch (_) {}
    if (!v) { try { v = document.documentElement.getAttribute('lang') || ''; } catch (_) {} }
    v = String(v || 'en');
    if (/^zh/i.test(v)) return 'zh-CN';
    if (/^da/i.test(v)) return 'da';
    if (/^es/i.test(v)) return 'es';
    return 'en';
  }
  function noticeText() { var l = lang(); return NOTICE[l] || NOTICE.en; }
  function activeDoc() { try { return localStorage.getItem('doc') === 'cl' ? 'cl' : 'cv'; } catch (_) { return 'cv'; } }
  function paper() { return document.querySelector('.antcv-preview-paper, [data-antcv-preview-paper]'); }
  function clean(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function visible(el) { return !!(el && el.isConnected && (el.offsetWidth || el.offsetHeight || el.getClientRects().length)); }

  function deBox(wm) {
    // Strip the box, soften, drop the corner-absolute positioning so it can sit
    // inline. Mark it so the corner anchor sidecar leaves it alone.
    wm.setAttribute('data-antcv-cl-inline', '1');
    wm.style.border = 'none';
    wm.style.background = 'none';
    wm.style.boxShadow = 'none';
    wm.style.padding = '0';
    wm.style.borderRadius = '0';
    wm.style.maxWidth = 'none';
    wm.style.opacity = '0.55';
    wm.style.color = 'rgba(0,116,110,.85)';
    wm.style.fontSize = '7pt';
    wm.style.fontWeight = '600';
    wm.style.zIndex = '5';
  }
  function inlineStyle(wm) {
    // Same row as the name, but the OPPOSITE side: pin to the right edge of the
    // (relative) name row so the name stays left and the notice sits far right.
    wm.style.position = 'absolute';
    wm.style.right = '0';
    wm.style.left = 'auto';
    wm.style.bottom = '0';
    wm.style.top = 'auto';
    wm.style.display = 'inline-block';
    wm.style.marginLeft = '0';
    wm.style.whiteSpace = 'nowrap';
    wm.style.verticalAlign = 'baseline';
  }

  function findSignoffRow(p) {
    // The name row is the line that follows the sign-off phrase. Walk small
    // text-bearing block elements; when one matches a sign-off, the row that
    // holds the name is the next sibling block (or, if the sign-off and name
    // share one element, that same element).
    var blocks = Array.from(p.querySelectorAll('p,div,span'));
    for (var i = 0; i < blocks.length; i++) {
      var el = blocks[i];
      if (!visible(el)) continue;
      var t = clean(el.textContent).toLowerCase();
      if (!t || t.length > 60) continue;
      for (var s = 0; s < SIGNOFFS.length; s++) {
        if (t.indexOf(SIGNOFFS[s]) === 0 || t === SIGNOFFS[s]) {
          // Prefer the next sibling block (the name); fall back to el itself.
          var next = el.nextElementSibling;
          if (next && visible(next) && clean(next.textContent) && clean(next.textContent).length <= 60) return next;
          return el;
        }
      }
    }
    return null;
  }

  function tick() {
    var p = paper();
    if (!p) return;
    var wms = Array.from(p.querySelectorAll('.antcv-ai-document-watermark, [data-antcv-ai-disclosure], [data-antcv-watermark]'));
    if (!wms.length) return;

    if (activeDoc() !== 'cl') {
      // Not the cover letter — release any inline takeover so the CV corner
      // watermark behaves normally again.
      wms.forEach(function (wm) {
        if (wm.getAttribute('data-antcv-cl-inline') === '1') {
          wm.removeAttribute('data-antcv-cl-inline');
        }
      });
      return;
    }

    var wm = wms[0];
    // Localise + de-box every time (cheap, idempotent on value).
    var want = noticeText();
    if (clean(wm.textContent) !== want) wm.textContent = want;
    deBox(wm);

    var row = findSignoffRow(p);
    if (row) {
      // The notice is absolutely positioned against this row, so the row must
      // be a positioning context.
      try { var cs = window.getComputedStyle ? window.getComputedStyle(row) : null; if (cs && cs.position === 'static') row.style.position = 'relative'; } catch (_) {}
      inlineStyle(wm);
      // Place it in the name row (far side); name stays left, notice right.
      if (wm.parentNode !== row || row.lastChild !== wm) {
        try { row.appendChild(wm); } catch (_) {}
      }
      wm.setAttribute('data-antcv-cl-inline-anchored', '1');
    } else {
      // Fallback: keep it where it is but de-boxed + translucent (no inline).
      wm.removeAttribute('data-antcv-cl-inline-anchored');
    }
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; try { tick(); } catch (_) {} });
  }

  function start() {
    schedule();
    [150, 500, 1500, 3000].forEach(function (d) { setTimeout(schedule, d); });
    try {
      new MutationObserver(function (recs) {
        for (var i = 0; i < recs.length; i++) {
          var t = recs[i].target;
          if (t && t.nodeType === 1 && t.getAttribute && t.getAttribute('data-antcv-cl-inline-anchored') === '1') continue;
          schedule(); return;
        }
      }).observe(document.body || document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
    } catch (_) {}
    window.addEventListener('antcv:sections-updated', schedule);
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('beforeprint', function () { try { tick(); } catch (_) {} });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.AntcvClAiNoticeInline = { version: '1.50.96', _tick: tick, _lang: lang };
  try { console.debug('[cl-ai-notice-inline] installed v1.50.96'); } catch (_) {}
})();
