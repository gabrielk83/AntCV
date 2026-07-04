/* antcv-ai-notice-position-control.js — AI-NOTICE-POSITION-CONTROL-001 (owner 2026-07-01)
 *
 * Layout-tab control for the CV "AI-assisted document" notice placement. The auto larger-gap
 * side-detection sometimes lands on the text-heavy column; this lets the owner PIN the corner.
 *   antcv:aiNoticePos  'auto' | 'left' | 'center' | 'right'   (default 'auto')
 *     auto   -> the worker/preview measured larger-gap logic (unchanged)
 *     left/center/right -> bottom-left / bottom-center / bottom-right, forced
 *
 * Consumed by: antcv-watermark-page-anchor-341.js (preview) + antcv-docx-client.js -> worker
 * (ai_notice_pos -> ctx.aiNoticePos). NO app.js mirror. Mounts ONCE after the CL signature
 * control (else after the PROFILE PHOTO control) in the Layout tab; own data-marker.
 */
(function () {
  'use strict';
  if (window.__antcvAiNoticePosControl) return;
  window.__antcvAiNoticePosControl = true;

  var KEY = 'antcv:aiNoticePos';
  var OPEN = 'antcv:aiNoticePosCtrlOpen';
  var ACCENT = 'rgb(1,183,187)';
  function get(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (_) { return d; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
  function pos() { var p = get(KEY, 'auto'); return (p === 'left' || p === 'center' || p === 'right') ? p : 'auto'; }
  function isOpen() { return get(OPEN, '0') === '1'; }

  function nudge() {
    // re-render the preview (React reads sections) and let the watermark anchor re-tick.
    try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'ai-notice-pos' } })); } catch (_) {}
  }

  function btn(txt, title) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = txt;
    if (title) b.title = title;
    b.style.cssText = 'padding:4px 8px;margin:0;border-radius:5px;border:1px solid rgba(1,183,187,0.45);' +
      'background:rgba(1,183,187,0.10);color:' + ACCENT + ';font-size:10px;font-weight:600;cursor:pointer;';
    return b;
  }

  var OPTS = [
    { k: 'auto', t: 'Auto', title: 'Place automatically in the emptier column (default)' },
    { k: 'left', t: '⬐ Left', title: 'Bottom-left corner' },
    { k: 'center', t: '⬇ Center', title: 'Bottom-center' },
    { k: 'right', t: '⬎ Right', title: 'Bottom-right corner' }
  ];

  function build() {
    var box = document.createElement('div');
    box.setAttribute('data-antcv-ai-notice-pos', '1');
    box.style.cssText = 'margin:8px 0 0 0;padding:8px 10px;border:1px solid rgba(1,183,187,0.25);' +
      'border-radius:8px;background:rgba(255,255,255,0.02);';

    var head = document.createElement('div');
    head.style.cssText = 'cursor:pointer;font-size:11px;font-weight:700;letter-spacing:.04em;color:' + ACCENT + ';' +
      'display:flex;align-items:center;gap:6px;user-select:none;';
    head.setAttribute('role', 'button');
    head.title = 'Show / hide the AI-notice placement control';
    var caret = document.createElement('span'); caret.style.cssText = 'font-size:9px;opacity:.7;';
    var htxt = document.createElement('span'); htxt.textContent = 'AI NOTICE POSITION';
    head.appendChild(caret); head.appendChild(htxt);

    var body = document.createElement('div');
    body.style.cssText = 'margin-top:8px;display:flex;flex-direction:column;gap:6px;';
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';
    var buttons = {};
    OPTS.forEach(function (o) {
      var b = btn(o.t, o.title);
      b.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        set(KEY, o.k); setActive(); nudge();
      });
      buttons[o.k] = b; row.appendChild(b);
    });
    var hint = document.createElement('div');
    hint.style.cssText = 'font-size:9px;opacity:.6;color:' + ACCENT + ';';
    hint.textContent = 'CV only. The cover letter notice stays bottom-right.';
    body.appendChild(row); body.appendChild(hint);

    box.appendChild(head); box.appendChild(body);

    // SETTINGS-SWEEP-STABILIZE (row 17, 1.51.156): __refresh runs every scan tick;
    // these re-set button styles + replaced the caret text node unconditionally
    // (35 childList mutations / 6s on the Layout panel). Write-on-change only.
    function setActive() {
      var cur = pos();
      for (var k in buttons) {
        var on = (k === cur), bg = on ? ACCENT : 'rgba(1,183,187,0.10)', col = on ? '#04231f' : ACCENT;
        if (buttons[k].style.background !== bg) buttons[k].style.background = bg;
        if (buttons[k].style.color !== col) buttons[k].style.color = col;
      }
    }
    function applyOpen() { var o = isOpen(), g = o ? '▾' : '▸', d = o ? 'flex' : 'none'; if (caret.textContent !== g) caret.textContent = g; if (body.style.display !== d) body.style.display = d; }
    head.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); set(OPEN, isOpen() ? '0' : '1'); applyOpen(); });

    box.__refresh = function () { setActive(); applyOpen(); };
    box.__refresh();
    return box;
  }

  // ---- mount: after the CL signature control, else after the PROFILE PHOTO control ----
  function anchor() {
    var sig = document.querySelector('[data-antcv-cl-sig-control]');
    if (sig && sig.parentNode) return sig;
    var rows = document.querySelectorAll('[data-antcv-bridge-active]');
    for (var i = 0; i < rows.length; i++) {
      var ctrl = rows[i].parentElement;
      var c = ctrl && ctrl.firstElementChild;
      if (c && /PROFILE PHOTO/i.test(c.textContent || '') && (c.textContent || '').length < 40) return ctrl;
    }
    return null;
  }

  var mounted = null;
  function scan() {
    var existing = document.querySelectorAll('[data-antcv-ai-notice-pos]');
    if (existing.length > 1) { for (var j = 1; j < existing.length; j++) { if (existing[j].parentNode) existing[j].parentNode.removeChild(existing[j]); } }
    if (mounted && mounted.isConnected) { if (mounted.__refresh) mounted.__refresh(); return; }
    var a = anchor();
    if (!a || !a.parentNode) return;
    if (a.nextElementSibling && a.nextElementSibling.getAttribute && a.nextElementSibling.getAttribute('data-antcv-ai-notice-pos') === '1') {
      mounted = a.nextElementSibling; if (mounted.__refresh) mounted.__refresh(); return;
    }
    mounted = build();
    a.parentNode.insertBefore(mounted, a.nextSibling);
  }

  var t = null;
  function schedule() { if (t) return; t = setTimeout(function () { t = null; try { scan(); } catch (_) {} }, 160); }
  var mo = new MutationObserver(function (muts) { for (var i = 0; i < muts.length; i++) { if (muts[i].addedNodes && muts[i].addedNodes.length) { schedule(); return; } } });
  function start() { try { mo.observe(document.body, { childList: true, subtree: true }); } catch (_) {} schedule(); }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
