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
  window.__antcvClAiNoticeInline = '1.50.142-no-unhide';

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

  function candidateName() {
    try {
      var pi = JSON.parse(localStorage.getItem('personalInfo') || '{}');
      var n = (pi && (pi.name || pi.fullName)) ||
              clean(((pi && pi.firstName) || '') + ' ' + ((pi && pi.lastName) || ''));
      return clean(n || '');
    } catch (_) { return ''; }
  }
  function isExcluded(el) {
    if (!el || el.nodeType !== 1) return true;
    if (el.hasAttribute && el.hasAttribute('data-antcv-cl-ai-notice')) return true;
    if (el.classList && (el.classList.contains('antcv-page-row') ||
        el.classList.contains('antcv-ai-document-watermark'))) return true;
    if (el.querySelector && el.querySelector('input,textarea,button')) return true;
    return false;
  }
  function lowerHalf(el, p) {
    try {
      var r = el.getBoundingClientRect(), pr = p.getBoundingClientRect();
      return pr.height > 0 && r.top >= pr.top + pr.height * 0.45;
    } catch (_) { return true; }
  }

  function findSignoffNameRow(p) {
    // Goal: the signature NAME row (name on the left → marker floats right).
    // Robust to CLs that don't render a separate "Kind regards," block.
    var blocks = Array.from(p.querySelectorAll('p,div')).filter(function (el) {
      return visible(el) && !isExcluded(el);
    });
    var signoffEl = null;

    // 1. Sign-off line ("Kind regards,") → the following name block (best case).
    for (var i = 0; i < blocks.length; i++) {
      var t = clean(blocks[i].textContent).toLowerCase();
      if (!t || t.length > 60) continue;
      for (var s = 0; s < SIGNOFFS.length; s++) {
        if (t.indexOf(SIGNOFFS[s]) === 0 || t === SIGNOFFS[s]) {
          if (!signoffEl) signoffEl = blocks[i];
          var next = blocks[i].nextElementSibling;
          while (next && (isExcluded(next) || !visible(next))) next = next.nextElementSibling;
          if (next) {
            var nt = clean(next.textContent);
            if (nt && nt.length <= 60) return next;
          }
        }
      }
    }

    // 2. A block whose text equals the candidate's name (lowest such block).
    var name = candidateName();
    if (name) {
      for (var j = blocks.length - 1; j >= 0; j--) {
        var bt = clean(blocks[j].textContent);
        if (bt && bt.length <= 60 && bt.toLowerCase() === name.toLowerCase()) return blocks[j];
      }
    }

    // 3. The sign-off element itself, if we found one but no name block after it.
    if (signoffEl) return signoffEl;

    // 4. Last short, leaf-ish text block in the lower half (the signature line).
    for (var k = blocks.length - 1; k >= 0; k--) {
      var lt = clean(blocks[k].textContent);
      if (lt && lt.length >= 2 && lt.length <= 48 && lowerHalf(blocks[k], p)) return blocks[k];
    }
    return null;
  }

  function tick() {
    // v1.50.140: DISABLED — watermark handling unified into
    // antcv-watermark-page-anchor-341, which now de-boxes + anchors the CL
    // watermark (text colour adapted over the navy sidebar). This sidecar's own
    // span was landing at Foundation (the redundant 2nd watermark). Clean up any
    // span we created + un-hide any watermark we hid, then no-op.
    try {
      var __sp = document.querySelector('[data-antcv-cl-ai-notice]');
      if (__sp && __sp.parentNode) __sp.parentNode.removeChild(__sp);
      var __w = document.querySelectorAll('.antcv-ai-document-watermark, [data-antcv-watermark], [data-antcv-ai-disclosure]');
      for (var __i = 0; __i < __w.length; __i++) {
        // Leave 341's hides alone — it hides every non-last-page watermark and
        // flags them. Un-hiding them here re-showed the duplicate (the ping-pong).
        if (__w[__i].getAttribute && __w[__i].getAttribute('data-antcv-watermark-hidden-by-anchor') === '1') continue;
        if (__w[__i].style && __w[__i].style.display === 'none') __w[__i].style.removeProperty('display');
      }
    } catch (_) {}
    return;
    // --- below is retired (unreachable) ---
    injectCss();
    setDocClass();
    var existing = document.querySelector('[data-antcv-cl-ai-notice]');
    var p = paper();
    if (!p || activeDoc() !== 'cl') {
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      // Defensive: un-hide any app.js watermark we hid while in CL (so the CV
      // watermark isn't left hidden after a doc switch).
      try {
        var u = document.querySelectorAll('.antcv-ai-document-watermark, [data-antcv-watermark], [data-antcv-ai-disclosure]');
        for (var ui = 0; ui < u.length; ui++) {
          if (u[ui].hasAttribute && u[ui].hasAttribute('data-antcv-cl-ai-notice')) continue;
          if (u[ui].style && u[ui].style.display === 'none') u[ui].style.removeProperty('display');
        }
      } catch (_) {}
      return;
    }
    // Owner: "turn it off and add a new watermark." The CSS hide didn't catch
    // app.js's boxed/anchored watermark, so hide it directly via JS (display:none
    // !important beats any inline style) — document-wide in CL mode, excluding our
    // own span. app.js's watermark text is "AI-assisted document"; ours is below.
    try {
      var wms = document.querySelectorAll('.antcv-ai-document-watermark, [data-antcv-watermark], [data-antcv-ai-disclosure]');
      for (var wi = 0; wi < wms.length; wi++) {
        var w = wms[wi];
        if (w.hasAttribute && w.hasAttribute('data-antcv-cl-ai-notice')) continue;
        w.style.setProperty('display', 'none', 'important');
      }
    } catch (_) {}
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
  window.AntcvClAiNoticeInline = { version: '1.50.136', _tick: tick, _lang: lang };
  try { console.debug('[cl-ai-notice-inline] installed v1.50.136'); } catch (_) {}
})();
