/* AntCV mobile Export FAB (v1.51.178)
 * ============================================================================
 * MOBILE-TOPBAR-EXPORT-FAB-001 (owner 2026-07-05, live phone report). The
 * .antcv-export-buttons (⬇ PDF / 📄 DOCX) row lives in .antcv-preview-actions,
 * not the topbar — it stays visible and untouched everywhere.
 *
 * This adds an ALWAYS-VISIBLE floating "Export" launcher on mobile, styled
 * and behaved exactly like the existing "Ask AI" launcher
 * (antcv-doc-chatbot-440.js): fixed position, draggable, persisted position.
 * Tapping it opens a small menu with PDF / DOCX, and each option forwards a
 * real .click() to the ACTUAL .antcv-export-buttons buttons — this reuses
 * every bit of the real export logic (worker calls, fallbacks, alerts,
 * password gate, analytics) with zero duplication and zero app.js edit, as
 * a convenient one-tap shortcut regardless of where that row currently sits
 * on screen.
 */
(function () {
  'use strict';
  var VERSION = '1.51.178';
  if (window.__antcvMobileExportFab === VERSION) return;
  window.__antcvMobileExportFab = VERSION;

  var LAUNCH_ID = 'antcv-mobile-export-fab-launch';
  var MENU_ID = 'antcv-mobile-export-fab-menu';
  var MOBILE_MAX_WIDTH = 900; // matches the antcv-mobile-controls.css breakpoint

  function isMobile() {
    try { return (window.innerWidth || 0) <= MOBILE_MAX_WIDTH; } catch (_) { return false; }
  }
  function inEditor() {
    try {
      var raw = localStorage.getItem('step');
      var step = raw ? JSON.parse(raw) : null;
      return step === 'editor' && !!document.querySelector('.antcv-preview-paper, [data-antcv-document-main]');
    } catch (_) { return false; }
  }
  function findExportButton(titleRe) {
    var btns = document.querySelectorAll('.antcv-export-buttons button');
    for (var i = 0; i < btns.length; i++) {
      if (titleRe.test(btns[i].title || '')) return btns[i];
    }
    return null;
  }

  function el(tag, css, text) { var n = document.createElement(tag); if (css) n.style.cssText = css; if (text != null) n.textContent = text; return n; }
  function closeMenu() { var m = document.getElementById(MENU_ID); if (m) m.remove(); }

  function openMenu(anchor) {
    if (document.getElementById(MENU_ID)) return;
    var rect = anchor.getBoundingClientRect();
    var menu = el('div', [
      'position:fixed', 'z-index:2147483602',
      'left:' + Math.max(6, rect.left - 90) + 'px',
      'top:' + Math.max(6, rect.top - 100) + 'px',
      'background:#1b2945', 'border:1px solid rgba(1,183,187,0.5)', 'border-radius:12px',
      'box-shadow:0 12px 36px rgba(0,0,0,0.5)', 'padding:8px', 'display:flex', 'flex-direction:column', 'gap:6px',
      'font-family:Calibri,Arial,sans-serif',
    ].join(';'));
    menu.id = MENU_ID;
    menu.setAttribute('data-antcv-mobile-export-menu', '1');

    function makeOption(label, titleRe) {
      var b = el('button', [
        'padding:9px 16px', 'border-radius:8px', 'border:0', 'cursor:pointer',
        'background:rgba(255,255,255,0.08)', 'color:#fff', 'font-weight:700', 'font-size:13px',
        'text-align:left', 'white-space:nowrap',
      ].join(';'), label);
      b.type = 'button';
      b.onclick = function () {
        var real = findExportButton(titleRe);
        closeMenu();
        if (real) real.click();
      };
      return b;
    }
    menu.appendChild(makeOption('⬇ PDF', /export as pdf/i));
    menu.appendChild(makeOption('📄 DOCX', /export as \.docx/i));
    (document.body || document.documentElement).appendChild(menu);

    setTimeout(function () {
      document.addEventListener('pointerdown', function onDoc(ev) {
        if (menu.contains(ev.target) || ev.target === anchor) return;
        closeMenu();
        document.removeEventListener('pointerdown', onDoc);
      });
    }, 0);
  }

  function ensureLauncher() {
    var existing = document.getElementById(LAUNCH_ID);
    if (!isMobile() || !inEditor()) { if (existing) existing.remove(); closeMenu(); return; }
    if (existing) return;
    var b = el('button', [
      'position:fixed', 'z-index:2147483600',
      'padding:10px 15px', 'border-radius:24px', 'border:0',
      'background:#6d28d9', 'color:#fff', 'font-weight:800', 'font-size:13px',
      'font-family:Calibri,Arial,sans-serif', 'cursor:grab', 'touch-action:none',
      'box-shadow:0 6px 20px rgba(0,0,0,0.35)', 'display:flex', 'align-items:center', 'gap:6px',
    ].join(';'), '⬇ Export');
    b.id = LAUNCH_ID;
    b.type = 'button';
    b.title = 'Export PDF/DOCX — drag to move';
    b.setAttribute('data-antcv-mobile-export-fab-launch', '1');

    // Default ABOVE the "Ask AI" launcher (bottom:150px) so the two floating
    // buttons don't overlap out of the box; both are independently draggable.
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem('antcv:exportFabPos') || 'null'); } catch (_) {}
    if (saved && typeof saved.left === 'number') {
      b.style.left = Math.max(4, Math.min(saved.left, (window.innerWidth || 800) - 60)) + 'px';
      b.style.top = Math.max(4, Math.min(saved.top, (window.innerHeight || 600) - 50)) + 'px';
    } else {
      b.style.right = '14px';
      b.style.bottom = '220px';
    }
    var dragging = false, moved = false, sx = 0, sy = 0, ox = 0, oy = 0;
    b.addEventListener('pointerdown', function (ev) {
      dragging = true; moved = false; sx = ev.clientX; sy = ev.clientY;
      var r = b.getBoundingClientRect(); ox = r.left; oy = r.top;
      b.style.cursor = 'grabbing';
      try { b.setPointerCapture(ev.pointerId); } catch (_) {}
    });
    b.addEventListener('pointermove', function (ev) {
      if (!dragging) return;
      var dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
      if (moved) {
        b.style.left = Math.max(4, Math.min(ox + dx, (window.innerWidth || 800) - 60)) + 'px';
        b.style.top = Math.max(4, Math.min(oy + dy, (window.innerHeight || 600) - 50)) + 'px';
        b.style.right = ''; b.style.bottom = '';
        closeMenu();
      }
    });
    b.addEventListener('pointerup', function (ev) {
      dragging = false; b.style.cursor = 'grab';
      try { b.releasePointerCapture(ev.pointerId); } catch (_) {}
      if (moved) {
        var r = b.getBoundingClientRect();
        try { localStorage.setItem('antcv:exportFabPos', JSON.stringify({ left: r.left, top: r.top })); } catch (_) {}
      } else {
        if (document.getElementById(MENU_ID)) closeMenu(); else openMenu(b);
      }
    });
    (document.body || document.documentElement).appendChild(b);
  }

  var pending = false;
  function schedule() { if (pending) return; pending = true; requestAnimationFrame(function () { pending = false; try { ensureLauncher(); } catch (_) {} }); }
  function boot() {
    schedule();
    [300, 900, 2000].forEach(function (ms) { setTimeout(schedule, ms); });
    window.addEventListener('resize', schedule);
    try { new MutationObserver(schedule).observe(document.body || document.documentElement, { childList: true, subtree: true }); } catch (_) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.AntcvMobileExportFab = { version: VERSION, open: openMenu, close: closeMenu };
  try { console.debug('[mobile-export-fab] installed v' + VERSION); } catch (_) {}
})();
