/* AntCV keyboard shortcuts (v1.50.344)
 * ============================================================================
 * Owner-approved 2026-06-10 ("yes, build it") — faster iteration loop.
 *
 * Shortcuts
 * ---------
 *   Ctrl/Cmd + Enter   →  Generate (clicks "Generate CV & Cover Letter").
 *                         Works from anywhere, including the JD textarea, so
 *                         you can paste a JD and fire generation without
 *                         reaching for the mouse.
 *   Esc                →  If a text field is focused, blur it (escape the
 *                         field). Otherwise close the top-most open modal /
 *                         panel by clicking its visible ✕ / × / Close / Done
 *                         control. Only swallows the key when it actually
 *                         acts — native Esc behaviour is preserved elsewhere.
 *
 * Safety
 * ------
 *   - Listener-only: no DOM mutation of the preview/document, so the
 *     page-break measurer and the salmon are untouched.
 *   - Never preventDefault on ordinary typing; only on the two combos above,
 *     and Esc only when it closes something.
 *   - Finds controls by visible label at press time (no app.js coupling); a
 *     no-op when the relevant control isn't on screen.
 *   - A one-time, auto-dismissing hint toast (shown once ever) tells you the
 *     Generate shortcut exists. Fixed-position, outside the preview.
 *   - Removable in one <script> line; escape hatch
 *     localStorage['antcv:disable-shortcuts'] = '1'.
 * ============================================================================
 */
(function () {
  'use strict';
  var VERSION = '1.50.344-shortcuts';
  if (window.__antcvKeyboardShortcuts === VERSION) return;
  window.__antcvKeyboardShortcuts = VERSION;

  try {
    var d = localStorage.getItem('antcv:disable-shortcuts');
    if (d === '1' || d === 'true') return;
  } catch (_) {}

  var GEN_LABELS = ['generate cv & cover letter', 'generer cv & følgebrev', 'generate cv'];
  var CLOSE_LABELS = ['✕', '×', 'close', 'luk', 'done', 'færdig'];

  function visible(el) {
    if (!el) return false;
    if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function isTextField(el) {
    if (!el) return false;
    var tag = (el.tagName || '').toLowerCase();
    if (tag === 'textarea') return true;
    if (el.isContentEditable) return true;
    if (tag === 'input') {
      var t = (el.getAttribute('type') || 'text').toLowerCase();
      return ['text', 'search', 'email', 'url', 'tel', 'password', 'number', ''].indexOf(t) >= 0;
    }
    return false;
  }

  // Find a visible button whose trimmed lowercased text equals one of `labels`.
  function findButton(labels) {
    var btns = document.querySelectorAll('button, [role="button"]');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if (!visible(b)) continue;
      var txt = (b.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      for (var k = 0; k < labels.length; k++) {
        if (txt === labels[k] || (labels[k].length > 2 && txt.indexOf(labels[k]) === 0 && txt.length <= labels[k].length + 4)) return b;
      }
    }
    return null;
  }

  function clickGenerate() {
    var b = findButton(GEN_LABELS);
    if (b && !b.disabled) { b.click(); return true; }
    return false;
  }

  // Close the top-most overlay: prefer a ✕/×/Close/Done button that sits in a
  // high-stacking-context container (a modal/overlay), else any visible one.
  function closeTopPanel() {
    var b = findButton(CLOSE_LABELS);
    if (b && !b.disabled) { b.click(); return true; }
    return false;
  }

  function onKeydown(ev) {
    // Ctrl/Cmd + Enter → Generate.
    if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'Enter' || ev.keyCode === 13)) {
      if (clickGenerate()) { ev.preventDefault(); ev.stopPropagation(); }
      return;
    }
    // Esc → blur a focused field first, else close a panel.
    if (ev.key === 'Escape' || ev.keyCode === 27) {
      var a = document.activeElement;
      if (isTextField(a)) {
        try { a.blur(); } catch (_) {}
        ev.preventDefault();
        return;
      }
      if (closeTopPanel()) { ev.preventDefault(); ev.stopPropagation(); }
      return;
    }
  }
  document.addEventListener('keydown', onKeydown, false);

  // ---- one-time hint toast ---------------------------------------------------
  function maybeHint() {
    try { if (localStorage.getItem('antcv:shortcuts-hint-seen') === '1') return; } catch (_) {}
    // Only hint once the editor is actually up (the Generate button exists).
    if (!findButton(GEN_LABELS)) return;
    try { localStorage.setItem('antcv:shortcuts-hint-seen', '1'); } catch (_) {}
    var isMac = /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent || '');
    var combo = isMac ? '⌘ + Enter' : 'Ctrl + Enter';
    var t = document.createElement('div');
    t.setAttribute('role', 'status');
    t.textContent = '⌨ Tip: ' + combo + ' to Generate · Esc to close panels';
    t.style.cssText = [
      'position:fixed', 'left:50%', 'bottom:22px', 'transform:translateX(-50%)',
      'z-index:2147482000', 'background:#283556', 'color:#fff',
      'font:600 12px/1.2 Calibri,Arial,sans-serif', 'padding:9px 14px',
      'border-radius:8px', 'box-shadow:0 6px 24px rgba(0,0,0,.28)',
      'opacity:0', 'transition:opacity .35s ease', 'pointer-events:none',
      'letter-spacing:.2px', 'max-width:92vw', 'text-align:center',
    ].join(';');
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.style.opacity = '1'; });
    setTimeout(function () { t.style.opacity = '0'; setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 400); }, 5200);
  }
  [1500, 3500, 6000].forEach(function (d) { setTimeout(maybeHint, d); });

  window.AntcvKeyboardShortcuts = {
    version: VERSION,
    _clickGenerate: clickGenerate,
    _closeTopPanel: closeTopPanel,
    _findButton: findButton,
  };
  try { console.debug('[keyboard-shortcuts-374] installed v' + VERSION); } catch (_) {}
})();
