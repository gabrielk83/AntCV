/* AntCV cover-letter AI-notice (v1.50.97)
 * ============================================================================
 * Owner request: in the COVER LETTER the AI notice sits on the signature-name
 * row, on the OPPOSITE side from the name, written in the document language,
 * with NO box, and only partly visible.
 *
 * IMPORTANT — why we do NOT touch app.js's own watermark element:
 * app.js renders the notice as a React-controlled, boxed, absolutely-positioned
 * .antcv-ai-document-watermark. Restyling or MOVING that element fights React:
 * it reverts our inline styles on the next render (so the box came back), and
 * moving a React-owned node out of its parent corrupts React's child diffing
 * for that subtree (which knocked the header "Application:" line off-colour).
 *
 * So instead:
 *   1. Hide app.js's watermark in the CL with a stylesheet rule (!important
 *      beats React's inline style — no node is moved, nothing corrupts).
 *   2. Render OUR OWN <span> notice (de-boxed, translucent, localised) and
 *      float it to the right of the signature-name row.
 * CV is untouched: the class gate only hides the watermark while doc === cl.
 */
(function () {
  'use strict';
  if (window.__antcvClAiNoticeInline) return;
  window.__antcvClAiNoticeInline = '1.50.97';

  var NOTICE = {
    en: 'AI-assisted',
    da: 'AI-assisteret',
    es: 'Asistido por IA',
    'zh-CN': 'AI 辅助',
    zh: 'AI 辅助'
  };
  var SIGNOFFS = [
    'best regards,', 'kind regards,', 'sincerely,', 'warm regards,', 'yours sincerely,', 'yours faithfully,',
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
  function noticeText() { return NOTICE[lang()] || NOTICE.en; }
  function activeDoc() { try { return localStorage.getItem('doc') === 'cl' ? 'cl' : 'cv'; } catch (_) { return 'cv'; } }
  function paper() { return document.querySelector('.antcv-preview-paper, [data-antcv-preview-paper]'); }
  function clean(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function visible(el) { return !!(el && el.isConnected && (el.offsetWidth || el.offsetHeight || el.getClientRects().length)); }

  function injectCss() {
    if (document.getElementById('antcv-cl-ai-notice-css')) return;
    var s = document.createElement('style');
    s.id = 'antcv-cl-ai-notice-css';
    s.textContent =
      // (1) hide app.js's boxed watermark while in the cover letter
      'body.antcv-cl-doc .antcv-preview-paper .antcv-ai-document-watermark,' +
      'body.antcv-cl-doc .antcv-preview-paper [data-antcv-watermark],' +
      'body.antcv-cl-doc .antcv-preview-paper [data-antcv-ai-disclosure]{display:none!important;}' +
      // (2) our own de-boxed, translucent, right-floated notice
      '[data-antcv-cl-ai-notice]{float:right;margin:0 0 0 12px;border:0!important;background:none!important;' +
      'box-shadow:none!important;padding:0!important;border-radius:0!important;max-width:none!important;' +
      'color:rgba(0,116,110,.9);opacity:.5;font-size:7pt;font-weight:600;line-height:1.3;letter-spacing:.3px;' +
      'white-space:nowrap;pointer-events:none;user-select:none;}';
    (document.head || document.documentElement).appendChild(s);
  }

  function setDocClass() {
    try { if (document.body) document.body.classList.toggle('antcv-cl-doc', activeDoc() === 'cl'); } catch (_) {}
  }

  function findSignoffNameRow(p) {
    // The sign-off line ("Kind regards,") is followed by the name row. Walk
    // short text blocks; on a sign-off match, return the next block (the name),
    // or the sign-off element itself if there is no separate name block.
    var blocks = Array.from(p.querySelectorAll('p,div'));
    for (var i = 0; i < blocks.length; i++) {
      var el = blocks[i];
      if (!visible(el)) continue;
      var t = clean(el.textContent).toLowerCase();
      if (!t || t.length > 60) continue;
      for (var s = 0; s < SIGNOFFS.length; s++) {
        if (t.indexOf(SIGNOFFS[s]) === 0 || t === SIGNOFFS[s]) {
          var next = el.nextElementSibling;
          if (next && visible(next) && clean(next.textContent) && clean(next.textContent).length <= 60) return next;
          return el;
        }
      }
    }
    return null;
  }

  function tick() {
    injectCss();
    setDocClass();
    var existing = document.querySelector('[data-antcv-cl-ai-notice]');
    var p = paper();
    if (!p || activeDoc() !== 'cl') {
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      return;
    }
    var row = findSignoffNameRow(p);
    if (!row) {
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      return;
    }
    var el = existing;
    if (!el) {
      el = document.createElement('span');
      el.setAttribute('data-antcv-cl-ai-notice', '1');
      el.setAttribute('aria-hidden', 'true');
    }
    var want = noticeText();
    if (el.textContent !== want) el.textContent = want;
    // Append our OWN span as the last child of the name row. We never move or
    // restyle a React node, so React's tree (and the header) stay intact.
    if (el.parentNode !== row) { try { row.appendChild(el); } catch (_) {} }
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
          if (t && t.nodeType === 1 && t.hasAttribute && t.hasAttribute('data-antcv-cl-ai-notice')) continue;
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
  window.AntcvClAiNoticeInline = { version: '1.50.97', _tick: tick, _lang: lang };
  try { console.debug('[cl-ai-notice-inline] installed v1.50.97'); } catch (_) {}
})();
