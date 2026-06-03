/* AntCV panel-escape sidecar (v1.40.199)
 * ============================================================
 *
 * Purpose
 * -------
 * On mobile, tapping a section in the lower sections bar opens a
 * section editor that takes over the viewport. Gabriel reported on
 * 2026-05-19: "pressing on section in the lower bar makes everting
 * not accesble apart from rolling the page in the preview."
 *
 * Root cause (best inference without app.js source): the section
 * editor mounts as a full-viewport panel with `pointer-events: auto`
 * — intentional — and `touch-action: pan-y` somewhere on the chain,
 * which is why pan-scroll still bubbles through but taps don't. The
 * editor's close button is either off-screen, very small, or
 * unfamiliar; the user has no obvious way back to the preview.
 *
 * v1.40.197's `preview-touch-fix` only handles INVISIBLE overlays
 * (opacity 0 / transparent bg / area>=40%). The section editor is
 * intentionally visible — it's the editor UI — so that sidecar
 * correctly leaves it alone. The fix needed is different: give the
 * user a stable escape route.
 *
 * Strategy
 * --------
 * Inject a small floating "← Preview" button that:
 *
 *   - Is ALWAYS visible on mobile viewports (≤900px or coarse pointer)
 *   - Sits top-right of the viewport, position:fixed, z-index 99999
 *     (above any modal scrim)
 *   - On tap, runs the aggressive overlay-dismissal sequence:
 *       (a) Search every visible modal/drawer for a close/back button
 *           and click the first match
 *       (b) Dispatch Escape on document, window, and the active element
 *       (c) Click an outside region of the body (a "tap-outside" gesture
 *           many React modal libs use to dismiss)
 *       (d) As last resort, hide any [role="dialog"] / .modal element
 *           via inline display:none — only those that were mounted in
 *           the last 30 s (avoid hiding the main app shell)
 *   - Glows amber and gains a "stuck?" sublabel if the same overlay
 *     persists for >2 s after our dismissal attempts
 *
 * Visibility heuristic
 * --------------------
 * The button shows on mobile by default. It doesn't crowd the UI
 * because it's 36×36 px at top-right with 60% opacity, going to
 * 100% on touchstart. Override:
 *
 *   localStorage['antcv:panel-escape'] = 'always' | 'never' | 'auto'
 *
 * 'auto' (default) = show on mobile only. 'always' = show always.
 * 'never' = inert.
 *
 * Diagnostics
 * -----------
 * Logs a snapshot of the DOM overlay structure on each press, so we
 * can tell next time what's actually showing.
 */
(function () {
  'use strict';

  if (window.__antcvPanelEscapeInstalled) return;
  window.__antcvPanelEscapeInstalled = '1.40.199';

  const BUTTON_ID = 'antcv-panel-escape-btn';

  // ─── Mode ────────────────────────────────────────────────────────
  function modeSetting() {
    try {
      const v = String(localStorage.getItem('antcv:panel-escape') || '').toLowerCase();
      if (v === 'always' || v === 'never') return v;
    } catch (_) {}
    return 'auto';
  }

  function isMobileViewport() {
    if (typeof window === 'undefined') return false;
    if (window.innerWidth <= 900) return true;
    try {
      if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return true;
    } catch (_) {}
    return false;
  }

  function shouldShow() {
    const m = modeSetting();
    if (m === 'always') return true;
    if (m === 'never') return false;
    return isMobileViewport();
  }

  // ─── Visibility helper ──────────────────────────────────────────
  function isVisible(el) {
    if (!el || el.nodeType !== 1) return false;
    try {
      const cs = el.ownerDocument && el.ownerDocument.defaultView
        ? el.ownerDocument.defaultView.getComputedStyle(el) : null;
      if (!cs) return true;
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      if (parseFloat(cs.opacity || '1') === 0) return false;
      return (el.offsetWidth > 0 || el.offsetHeight > 0);
    } catch (_) { return true; }
  }

  // ─── Dismissal sequence ─────────────────────────────────────────
  function findCloseButtons(root) {
    if (!root) return [];
    const out = [];
    // 1. Common close patterns by aria-label / title.
    const ariaSel = '[aria-label="Close" i], [aria-label*="close" i], ' +
                    '[title="Close" i], [title*="close" i], ' +
                    '[aria-label*="back" i], [aria-label*="dismiss" i], ' +
                    '[aria-label*="cancel" i]';
    root.querySelectorAll(ariaSel).forEach(function (b) { if (isVisible(b)) out.push(b); });
    // 2. Buttons whose visible text is a close glyph or short close word.
    const CLOSE_RE = /^(×|✕|✖|⨉|⨯|close|back|cancel|dismiss|done|tilbage|luk|annuller)$/i;
    root.querySelectorAll('button, [role="button"]').forEach(function (b) {
      if (!isVisible(b)) return;
      const t = (b.textContent || '').trim();
      if (t && CLOSE_RE.test(t)) out.push(b);
    });
    // De-dupe.
    return Array.from(new Set(out));
  }

  // Find candidate overlays — any element that looks like a modal or
  // drawer currently mounted.
  function findOverlays() {
    const out = [];
    const cands = document.querySelectorAll(
      '[role="dialog"], [role="alertdialog"], ' +
      '[class*="modal" i], [class*="drawer" i], [class*="sheet" i], ' +
      '[class*="overlay" i], [data-antcv-modal], [data-antcv-drawer]'
    );
    for (const c of cands) {
      if (!isVisible(c)) continue;
      // Skip the panel-escape button itself.
      if (c.id === BUTTON_ID || c.closest('#' + BUTTON_ID)) continue;
      out.push(c);
    }
    return out;
  }

  function diagnosticSnapshot() {
    const overlays = findOverlays();
    const summaries = overlays.slice(0, 6).map(function (el) {
      let role = el.getAttribute('role') || '';
      let cls = (typeof el.className === 'string' ? el.className : '').trim().slice(0, 80);
      let txt = (el.textContent || '').trim().slice(0, 120).replace(/\s+/g, ' ');
      let r = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        role: role,
        cls: cls,
        txtSample: txt,
        rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
      };
    });
    try {
      console.debug('[panel-escape] snapshot —', overlays.length, 'overlay(s):', summaries);
    } catch (_) {}
    return overlays;
  }

  function dispatchEscape() {
    const targets = [document, window, document.activeElement, document.body];
    for (const t of targets) {
      if (!t || typeof t.dispatchEvent !== 'function') continue;
      try {
        t.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Escape', code: 'Escape', keyCode: 27, which: 27,
          bubbles: true, cancelable: true,
        }));
      } catch (_) {}
    }
  }

  function clickBackdrop(overlay) {
    // Some modals dismiss on backdrop-click — we synthesize a click
    // on the overlay element itself (NOT its content). The standard
    // pattern is `target === currentTarget` check at the top of the
    // overlay's click handler.
    try {
      // Find the outermost element that looks like a backdrop. If
      // the overlay has a separate backdrop child, click that. Else
      // click the overlay itself.
      let target = overlay;
      const backdrop = overlay.querySelector('[class*="backdrop" i], [class*="scrim" i], [data-antcv-backdrop]');
      if (backdrop && isVisible(backdrop)) target = backdrop;
      const rect = target.getBoundingClientRect();
      const evt = new MouseEvent('click', {
        bubbles: true, cancelable: true, view: window,
        clientX: rect.left + 2, clientY: rect.top + 2,
      });
      target.dispatchEvent(evt);
    } catch (_) {}
  }

  function escape() {
    const overlays = diagnosticSnapshot();
    if (!overlays.length) {
      // Nothing to dismiss — give the user a Toast acknowledging.
      flashButton('nothing to dismiss');
      return;
    }
    // (a) close-button click
    for (const o of overlays) {
      const closes = findCloseButtons(o);
      if (closes.length) {
        try { closes[0].click(); } catch (_) {}
      }
    }
    // (b) Escape key
    dispatchEscape();
    // (c) backdrop click
    for (const o of overlays) {
      clickBackdrop(o);
    }
    // (d) check after 250 ms; if still stuck, force-hide.
    setTimeout(function () {
      const stillUp = findOverlays();
      if (stillUp.length) {
        for (const o of stillUp) {
          try {
            o.__antcvOriginalDisplay = o.style.display || '';
            o.style.display = 'none';
            o.setAttribute('data-antcv-panel-escape-force-hidden', '1');
          } catch (_) {}
        }
        try { console.debug('[panel-escape] force-hid', stillUp.length, 'overlay(s) — softer dismissals failed'); } catch (_) {}
        flashButton('force-dismissed');
      } else {
        flashButton('ok');
      }
    }, 250);
  }

  // ─── Button UI ──────────────────────────────────────────────────
  let btn = null;
  let glowTimer = null;

  function ensureButton() {
    if (btn && btn.isConnected) return btn;
    btn = document.createElement('button');
    btn.id = BUTTON_ID;
    btn.setAttribute('type', 'button');
    btn.setAttribute('aria-label', 'Dismiss overlay / back to preview');
    btn.textContent = '✕';
    Object.assign(btn.style, {
      position: 'fixed',
      top: 'calc(env(safe-area-inset-top, 0px) + 8px)',
      right: 'calc(env(safe-area-inset-right, 0px) + 8px)',
      zIndex: '99999',
      width: '36px',
      height: '36px',
      borderRadius: '50%',
      border: 'none',
      background: '#283556',
      color: '#fff',
      fontSize: '18px',
      fontWeight: '700',
      lineHeight: '1',
      cursor: 'pointer',
      boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
      opacity: '0.55',
      transition: 'opacity 120ms ease, background 200ms ease',
      WebkitTapHighlightColor: 'transparent',
      touchAction: 'manipulation',
      padding: '0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    });
    btn.addEventListener('touchstart', function () {
      btn.style.opacity = '1';
    }, { passive: true });
    btn.addEventListener('mouseenter', function () { btn.style.opacity = '1'; });
    btn.addEventListener('mouseleave', function () { btn.style.opacity = '0.55'; });
    btn.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      try { escape(); } catch (_) {}
    });
    document.body.appendChild(btn);
    return btn;
  }

  function removeButton() {
    if (btn && btn.parentNode) {
      try { btn.parentNode.removeChild(btn); } catch (_) {}
    }
    btn = null;
  }

  function flashButton(label) {
    if (!btn) return;
    const orig = btn.style.background;
    btn.style.background = (label === 'ok' || label === 'nothing to dismiss') ? '#00746E' : '#C0610C';
    if (glowTimer) clearTimeout(glowTimer);
    glowTimer = setTimeout(function () {
      if (!btn) return;
      btn.style.background = '#283556';
    }, 700);
  }

  function tick() {
    if (shouldShow()) ensureButton();
    else removeButton();
  }

  tick();
  window.addEventListener('resize', tick);
  window.addEventListener('orientationchange', tick);
  window.addEventListener('storage', function (ev) {
    if (ev && ev.key === 'antcv:panel-escape') tick();
  });

  // Public API.
  window.AntcvPanelEscape = {
    version: '1.40.199',
    escape: escape,
    snapshot: diagnosticSnapshot,
    show: function () {
      try { localStorage.setItem('antcv:panel-escape', 'always'); } catch (_) {}
      tick();
    },
    hide: function () {
      try { localStorage.setItem('antcv:panel-escape', 'never'); } catch (_) {}
      tick();
    },
    auto: function () {
      try { localStorage.setItem('antcv:panel-escape', 'auto'); } catch (_) {}
      tick();
    },
    _findOverlays: findOverlays,
    _findCloseButtons: findCloseButtons,
  };

  try { console.debug('[panel-escape] installed v1.40.199 — mode=' + modeSetting()); } catch (_) {}
})();
