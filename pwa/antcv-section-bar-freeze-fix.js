/* AntCV section-bar freeze fix (v1.40.203)
 * ============================================================
 * Fixes the mobile/PWA trap where tapping the lower-bar "Section(s)"
 * button opens a section editor/sheet that still allows preview scroll
 * but blocks the rest of the app.
 *
 * The app bundle is loaded externally, so this sidecar uses DOM-safe
 * repairs:
 *   1. Detects taps on the fixed lower Section(s) control.
 *   2. Finds the newly-opened section panel/sheet.
 *   3. Makes that panel scrollable within the visual viewport.
 *   4. Adds a visible "Preview" close button inside the panel.
 *   5. Falls back to Escape/backdrop/internal-close/hide only for the
 *      detected panel, never the whole app shell.
 */
(function () {
  'use strict';

  if (window.__antcvSectionBarFreezeFixInstalled) return;
  window.__antcvSectionBarFreezeFixInstalled = '1.40.203';

  const STYLE_ID = 'antcv-section-bar-freeze-fix-style';
  const CLOSE_CLASS = 'antcv-section-panel-close';
  let lastSectionTap = 0;
  let pending = false;

  function isMobileViewport() {
    if (window.innerWidth <= 900) return true;
    try { return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches); }
    catch (_) { return false; }
  }

  function visible(el) {
    if (!el || el.nodeType !== 1) return false;
    try {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      if (parseFloat(cs.opacity || '1') === 0) return false;
      const r = el.getBoundingClientRect();
      return r.width > 4 && r.height > 4;
    } catch (_) { return false; }
  }

  function textOf(el) {
    return ((el && el.textContent) || '').replace(/\s+/g, ' ').trim();
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const css = `
      .${CLOSE_CLASS} {
        position: sticky !important;
        top: 8px !important;
        float: right !important;
        z-index: 100000 !important;
        min-width: 76px !important;
        height: 34px !important;
        margin: 4px 4px 8px 8px !important;
        border: 0 !important;
        border-radius: 999px !important;
        background: #283556 !important;
        color: #fff !important;
        font: 700 13px/1 Calibri, Arial, sans-serif !important;
        box-shadow: 0 2px 10px rgba(0,0,0,.28) !important;
        touch-action: manipulation !important;
        pointer-events: auto !important;
      }
      [data-antcv-section-freeze-repaired="1"] {
        max-height: calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 12px) !important;
        overflow-y: auto !important;
        -webkit-overflow-scrolling: touch !important;
        touch-action: pan-y !important;
        overscroll-behavior: contain !important;
        pointer-events: auto !important;
      }
      [data-antcv-section-freeze-repaired="1"] * {
        pointer-events: auto;
      }
      body[data-antcv-section-panel-open="1"] .antcv-preview-paper,
      body[data-antcv-section-panel-open="1"] [data-antcv-preview-paper] {
        pointer-events: auto !important;
      }
    `;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.appendChild(document.createTextNode(css));
    (document.head || document.documentElement).appendChild(s);
  }

  function looksLikeLowerSectionButton(el) {
    const btn = el && el.closest && el.closest('button, [role="button"], a, [tabindex]');
    if (!btn || !visible(btn)) return false;
    const t = textOf(btn).toLowerCase();
    if (!/^(section|sections|§)(\b|$)/i.test(t) && t !== 'sec') return false;
    const r = btn.getBoundingClientRect();
    const nearBottom = r.top > window.innerHeight * 0.58 || r.bottom > window.innerHeight - 96;
    let cur = btn;
    let fixedAncestor = false;
    for (let i = 0; cur && cur !== document.body && i < 6; i++, cur = cur.parentElement) {
      try {
        const cs = getComputedStyle(cur);
        if (cs.position === 'fixed' || cs.position === 'sticky') fixedAncestor = true;
      } catch (_) {}
    }
    return nearBottom || fixedAncestor;
  }

  function findCloseButtons(root) {
    if (!root) return [];
    const out = [];
    const sel = '[aria-label*="close" i], [aria-label*="back" i], [aria-label*="dismiss" i], [title*="close" i], [title*="back" i], button, [role="button"]';
    root.querySelectorAll(sel).forEach(function (b) {
      if (!visible(b) || b.classList.contains(CLOSE_CLASS)) return;
      const t = textOf(b).toLowerCase();
      const a = ((b.getAttribute('aria-label') || '') + ' ' + (b.getAttribute('title') || '')).toLowerCase();
      if (/^(×|✕|x|close|back|done|cancel|dismiss|luk|tilbage)$/.test(t) || /close|back|dismiss|cancel|luk|tilbage/.test(a)) out.push(b);
    });
    return Array.from(new Set(out));
  }

  function dispatchEscape() {
    [document.activeElement, document, window, document.body].forEach(function (target) {
      if (!target || typeof target.dispatchEvent !== 'function') return;
      try {
        target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true }));
      } catch (_) {}
    });
  }

  function findBottomPreviewButton() {
    const controls = Array.from(document.querySelectorAll('button, [role="button"], a, [tabindex]')).filter(visible);
    let best = null;
    for (const c of controls) {
      const t = textOf(c).toLowerCase();
      if (!/^(preview|cv|document|doc|edit|sections?)(\b|$)/.test(t)) continue;
      const r = c.getBoundingClientRect();
      if (r.top > window.innerHeight * 0.55 || r.bottom > window.innerHeight - 120) { best = c; break; }
    }
    return best;
  }

  function closePanel(panel) {
    const closes = findCloseButtons(panel);
    if (closes.length) {
      try { closes[0].click(); } catch (_) {}
      setTimeout(function () { if (!visible(panel)) document.body.removeAttribute('data-antcv-section-panel-open'); }, 120);
      return;
    }
    dispatchEscape();
    setTimeout(function () {
      if (!visible(panel)) { document.body.removeAttribute('data-antcv-section-panel-open'); return; }
      const preview = findBottomPreviewButton();
      if (preview) {
        try { preview.click(); } catch (_) {}
      }
      setTimeout(function () {
        // Do not force-hide React-owned panels. It desynchronizes the
        // drawer state and was the reason the lower Section view could stay
        // stuck after the later button rearrangement.
        document.body.removeAttribute('data-antcv-section-panel-open');
      }, 180);
    }, 120);
  }

  function scorePanel(el) {
    if (!visible(el)) return 0;
    if (el === document.body || el === document.documentElement) return 0;
    if (el.id === 'root') return 0;
    // Never repair the full app shell. The previous fix was too broad and
    // could accidentally turn a large app container into the scroll-trapped
    // "panel". We only target a real Section drawer/header area.
    try {
      if (el.querySelector && el.querySelector('#root')) return 0;
      const cls = String(el.className || '').toLowerCase();
      if (/app|root|shell/.test(cls) && !/modal|drawer|sheet|panel/.test(cls)) return 0;
    } catch (_) {}
    const r = el.getBoundingClientRect();
    const vw = Math.max(1, window.innerWidth);
    const vh = Math.max(1, window.innerHeight);
    const areaRatio = Math.min(r.width, vw) * Math.min(r.height, vh) / (vw * vh);
    if (areaRatio < 0.18) return 0;
    let cs;
    try { cs = getComputedStyle(el); } catch (_) { return 0; }
    const positioned = /fixed|absolute|sticky/.test(cs.position) ? 30 : 0;
    const txt = textOf(el).toLowerCase();
    const hasPanelAnchor = !!(el.querySelector && el.querySelector('[data-candidate-drop-loc="main"], [data-candidate-drop-loc="sidebar"], [data-candidate-drop-loc="topbar"]'));
    const hasPanelButtons = /\b(add|fit|compress|enrich|undo)\b/.test(txt);
    const hasSectionWords = /\b(main|sidebar|candidate|section|sections)\b/.test(txt);
    if (!hasPanelAnchor && !(hasSectionWords && hasPanelButtons)) return 0;
    let s = positioned + areaRatio * 40;
    if (hasSectionWords) s += 24;
    if (hasPanelButtons) s += 14;
    if (hasPanelAnchor) s += 30;
    if (el.getAttribute('role') === 'dialog') s += 20;
    if (/modal|drawer|sheet|panel|section/i.test(String(el.className || ''))) s += 14;
    if (r.bottom > vh - 4 && r.height > vh * 0.35) s += 12;
    return s;
  }

  function findSectionPanel() {
    const all = Array.from(document.querySelectorAll('body *'));
    let best = null;
    let bestScore = 0;
    for (const el of all) {
      const s = scorePanel(el);
      if (s > bestScore) { best = el; bestScore = s; }
    }
    return bestScore >= 45 ? best : null;
  }

  function repairPanel(panel) {
    if (!panel || !visible(panel)) return false;
    ensureStyle();
    document.body.setAttribute('data-antcv-section-panel-open', '1');
    panel.setAttribute('data-antcv-section-freeze-repaired', '1');
    try {
      panel.style.maxHeight = 'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 12px)';
      panel.style.overflowY = 'auto';
      panel.style.WebkitOverflowScrolling = 'touch';
      panel.style.touchAction = 'pan-y';
      panel.style.pointerEvents = 'auto';
      if (getComputedStyle(panel).position === 'fixed') {
        panel.style.top = panel.style.top || '6px';
        panel.style.bottom = panel.style.bottom || '6px';
      }
    } catch (_) {}
    let cur = panel;
    for (let i = 0; cur && cur !== document.body && i < 8; i++, cur = cur.parentElement) {
      try { if (cur.style && cur.style.pointerEvents === 'none') cur.style.pointerEvents = 'auto'; } catch (_) {}
    }
    if (!panel.querySelector('.' + CLOSE_CLASS)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = CLOSE_CLASS;
      b.textContent = 'Preview';
      b.setAttribute('aria-label', 'Back to preview');
      b.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        closePanel(panel);
      });
      try { panel.insertBefore(b, panel.firstChild); } catch (_) { panel.appendChild(b); }
    }
    return true;
  }

  function scheduleRepair() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      if (!isMobileViewport()) return;
      if (Date.now() - lastSectionTap > 5000) return;
      const panel = findSectionPanel();
      if (panel) repairPanel(panel);
    });
  }

  document.addEventListener('click', function (ev) {
    if (!isMobileViewport()) return;
    if (!looksLikeLowerSectionButton(ev.target)) return;
    lastSectionTap = Date.now();
    [80, 220, 500, 1000, 1800].forEach(function (d) { setTimeout(scheduleRepair, d); });
  }, true);

  document.addEventListener('touchend', function (ev) {
    if (!isMobileViewport()) return;
    if (!looksLikeLowerSectionButton(ev.target)) return;
    lastSectionTap = Date.now();
    [80, 220, 500, 1000, 1800].forEach(function (d) { setTimeout(scheduleRepair, d); });
  }, true);

  try {
    const mo = new MutationObserver(function () { scheduleRepair(); });
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'role'] });
  } catch (_) {}

  window.AntcvSectionBarFreezeFix = {
    version: '1.40.203',
    repair: function () { const p = findSectionPanel(); return repairPanel(p); },
    findPanel: findSectionPanel,
    close: function () { const p = findSectionPanel(); if (p) closePanel(p); },
  };

  try { console.debug('[section-bar-freeze-fix] installed v1.40.203'); } catch (_) {}
})();
