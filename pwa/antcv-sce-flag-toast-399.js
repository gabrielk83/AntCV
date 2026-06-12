/* AntCV SCE flagged-draft toast (v1.50.399)
 * ============================================================
 * GEN-SCE-FLAG-001 (a): by design the writing-engine returns the third
 * dirty draft with `X-AntCV-Flagged: 1` after the retry budget is spent —
 * but the PWA rendered it with NO user-facing indicator, so banned wording
 * could ship silently. The proxy now EXPOSES the SCE headers
 * (Access-Control-Expose-Headers); this sidecar watches every fetch
 * response and shows a dismissible amber toast when a flagged draft (or a
 * shape-skip) comes back.
 *
 * Read-only: inspects response headers only — never touches the request
 * body, never reconstructs the Response, returns the original object, so
 * it cannot interfere with the existing fetch-wrapper chain.
 */
(function () {
  'use strict';

  var VERSION = '1.50.399';
  if (window.__antcvSceFlagToast === VERSION) return;
  window.__antcvSceFlagToast = VERSION;

  var lastToastAt = 0;
  var TOAST_DEBOUNCE_MS = 8000; // one toast per generation burst

  function showToast(text) {
    var now = Date.now();
    if (now - lastToastAt < TOAST_DEBOUNCE_MS) return;
    lastToastAt = now;
    try {
      var el = document.createElement('div');
      el.setAttribute('data-antcv-sce-flag-toast', '1');
      el.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:99998;'
        + 'background:#7c2d12;color:#fff;border:1px solid #f59e0b;border-radius:10px;'
        + 'padding:10px 38px 10px 14px;font:13px/1.45 Calibri,Arial,sans-serif;max-width:520px;'
        + 'box-shadow:0 6px 24px rgba(0,0,0,0.35);';
      el.textContent = text;
      var x = document.createElement('button');
      x.textContent = '✕';
      x.setAttribute('aria-label', 'Dismiss');
      x.style.cssText = 'position:absolute;top:6px;right:8px;background:none;border:none;color:#fff;'
        + 'font-size:13px;cursor:pointer;opacity:0.8;';
      x.onclick = function () { try { el.remove(); } catch (_) {} };
      el.appendChild(x);
      (document.body || document.documentElement).appendChild(el);
      setTimeout(function () { try { el.remove(); } catch (_) {} }, 14000);
    } catch (_) {}
  }

  function inspect(res) {
    try {
      if (!res || !res.headers || typeof res.headers.get !== 'function') return;
      if (res.headers.get('X-AntCV-Flagged') === '1') {
        var words = res.headers.get('X-AntCV-Sce-Banned-Words') || '0';
        var phrases = res.headers.get('X-AntCV-Sce-Banned-Phrases') || '0';
        showToast('⚠ Writing check: this draft still contains flagged wording after 3 attempts ('
          + words + ' banned word(s), ' + phrases + ' phrase/structure issue(s)). Review the new text before sending.');
      }
      var skip = res.headers.get('X-AntCV-Sce-Skip');
      if (skip) {
        try { console.warn('[sce-flag-toast] writing check SKIPPED on this response: ' + skip); } catch (_) {}
      }
    } catch (_) {}
  }

  function install() {
    if (typeof window.fetch !== 'function') return;
    var prev = window.fetch;
    if (prev.__antcvSceFlagToastWrap) return;
    var wrapped = function (input, init) {
      var p = prev.apply(this, arguments);
      try {
        if (p && typeof p.then === 'function') {
          p.then(function (res) { inspect(res); return res; }, function () {});
        }
      } catch (_) {}
      return p;
    };
    wrapped.__antcvSceFlagToastWrap = true;
    window.fetch = wrapped;
  }

  try { install(); } catch (e) { try { console.warn('[sce-flag-toast] install failed', e && e.message); } catch (_) {} }
  try { console.debug('[sce-flag-toast] installed v' + VERSION); } catch (_) {}
})();
