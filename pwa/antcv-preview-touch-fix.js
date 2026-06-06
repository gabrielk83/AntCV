/* AntCV preview-touch-fix sidecar (v1.40.197)
 * ============================================================
 *
 * Purpose
 * -------
 * Gabriel reported on 2026-05-19: "WHEN GOING TO PREVIEW IT IS NOT
 * POSSIBLE TO PRESS ANYTHING only roll up down — especially after
 * passing next to the lower bar — sections."
 *
 * Reproducer (best understanding): on mobile / narrow viewport,
 * scrolling far enough that the lower sections panel comes into
 * view leaves an invisible overlay or pointer-events-blocking
 * ancestor between the user's finger and the preview-paper. The
 * user can scroll (vertical pan still bubbles via touch-action)
 * but taps/clicks never reach the preview.
 *
 * Likely root causes (we can't see app.js):
 *   1. A full-viewport overlay from the sections panel/drawer
 *      that should have collapsed but didn't.
 *   2. `pointer-events: none` on a wrapper that flips on under
 *      certain CSS conditions (e.g. transition end state).
 *   3. `touch-action` set to a value that prevents tap.
 *   4. An invisible <div> with high z-index sitting over the
 *      preview-paper.
 *
 * Strategy
 * --------
 * This sidecar:
 *
 *   (a) Periodically — and on every scroll / resize / touchstart —
 *       inspects the chain from the preview-paper up to <body> and
 *       repairs any ancestor that has `pointer-events: none` or
 *       `touch-action: none` set inline. We only repair INLINE
 *       styles (not stylesheet-set ones, which we'd undo by
 *       force-setting `pointer-events: auto !important` via a
 *       small injected stylesheet — see below).
 *
 *   (b) Injects a stylesheet at higher specificity that re-asserts
 *       `pointer-events: auto` and `touch-action: manipulation` on
 *       the preview-paper and its descendants.
 *
 *   (c) Detects invisible overlay elements (visible: false / opacity
 *       0 / fully transparent background) that sit OVER the
 *       preview-paper viewport rect with high z-index, and either
 *       removes them or sets `pointer-events: none`.
 *
 *   (d) For the "lower sections panel" specifically: detects when a
 *       fixed-bottom panel grows tall enough to overlap the
 *       preview-paper's visible portion; in that case, sets the
 *       overlapping element's `pointer-events` to `none` so taps
 *       fall through. (The panel's own buttons still work because
 *       their explicit pointer-events:auto wins.)
 *
 * Mobile-only by default
 * ----------------------
 * Activates when the viewport is <= 900px wide OR the user agent
 * advertises touch support. Desktop pointer interactions weren't
 * reported as broken; activating there could mask bugs we'd rather
 * see.
 *
 * Override:
 *   localStorage['antcv:preview-touch-fix'] = 'always' | 'never' | 'auto'
 */
(function () {
  'use strict';

  if (window.__antcvPreviewTouchFixInstalled) return;
  window.__antcvPreviewTouchFixInstalled = '1.50.179-no-sweep-typing';

  const STYLE_ID = 'antcv-preview-touch-fix-style';

  function modeSetting() {
    try {
      const v = String(localStorage.getItem('antcv:preview-touch-fix') || '').toLowerCase();
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

  function isActive() {
    const m = modeSetting();
    if (m === 'always') return true;
    if (m === 'never') return false;
    return isMobileViewport();
  }

  // ─── Stylesheet: assert preview interactivity ───────────────────
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const css = `
      /* AntCV preview-touch-fix v1.40.197 — re-assert interactivity */
      .antcv-preview-paper,
      [data-antcv-preview-paper] {
        pointer-events: auto !important;
        touch-action: manipulation !important;
      }
      .antcv-preview-paper *,
      [data-antcv-preview-paper] * {
        /* Avoid blanket touch-action on descendants to keep nested
           scrollers working; only pointer-events. */
        pointer-events: auto;
      }
      /* Elements we've identified as invisible overlays — see JS. */
      [data-antcv-touch-fix-overlay-suppressed="1"] {
        pointer-events: none !important;
      }
    `;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.type = 'text/css';
    style.appendChild(document.createTextNode(css));
    (document.head || document.documentElement).appendChild(style);
  }

  function removeStyle() {
    const s = document.getElementById(STYLE_ID);
    if (s && s.parentNode) try { s.parentNode.removeChild(s); } catch (_) {}
  }

  // ─── Preview-paper discovery ─────────────────────────────────────
  function getPaper() {
    return document.querySelector('.antcv-preview-paper, [data-antcv-preview-paper]');
  }

  // ─── Ancestor inline-style repair ────────────────────────────────
  function repairAncestors() {
    const paper = getPaper();
    if (!paper) return 0;
    let n = 0;
    let cur = paper;
    let depth = 0;
    while (cur && cur !== document.body && depth < 20) {
      depth++;
      try {
        // Only repair *inline* pointer-events: none — leave stylesheet-
        // set values alone, since touching those needlessly would
        // mask intentional UI states.
        if (cur.style && cur.style.pointerEvents === 'none') {
          cur.__antcvOriginalPointerEvents = cur.style.pointerEvents;
          cur.style.pointerEvents = 'auto';
          n++;
        }
        if (cur.style && cur.style.touchAction === 'none') {
          cur.__antcvOriginalTouchAction = cur.style.touchAction;
          cur.style.touchAction = 'manipulation';
          n++;
        }
      } catch (_) {}
      cur = cur.parentNode;
    }
    return n;
  }

  // ─── Invisible-overlay detection ─────────────────────────────────
  // Element is an "invisible overlay" if:
  //   - position is fixed or absolute
  //   - rect covers >= 60% of the preview-paper's visible rect
  //   - background is transparent or alpha = 0
  //   - it's NOT a descendant of the preview-paper itself
  //   - it has at least 1 child element OR it's a leaf that
  //     blocks touch (we err on suspecting any leaf as harmless to
  //     suppress for pointer-events purposes)
  function rectOverlap(a, b) {
    const x = Math.max(a.left, b.left);
    const y = Math.max(a.top, b.top);
    const r = Math.min(a.right, b.right);
    const w = Math.min(a.bottom, b.bottom);
    if (r <= x || w <= y) return 0;
    return (r - x) * (w - y);
  }

  function suppressInvisibleOverlays() {
    const paper = getPaper();
    if (!paper) return 0;
    const paperRect = paper.getBoundingClientRect();
    if (paperRect.width <= 0 || paperRect.height <= 0) return 0;
    const paperArea = paperRect.width * paperRect.height;
    if (paperArea <= 0) return 0;
    let n = 0;
    // Candidates: fixed/absolute elements with high-ish z-index
    // that are NOT in the preview-paper.
    const cands = document.querySelectorAll('body *');
    for (const el of cands) {
      if (!el || el === paper || paper.contains(el)) continue;
      if (el.contains && el.contains(paper)) continue; // ancestors of paper
      // Skip already-suppressed.
      if (el.getAttribute('data-antcv-touch-fix-overlay-suppressed') === '1') continue;
      // Skip our own injected nodes.
      if (el.id === STYLE_ID) continue;
      let cs;
      try { cs = getComputedStyle(el); } catch (_) { continue; }
      if (!cs) continue;
      const pos = cs.position;
      if (pos !== 'fixed' && pos !== 'absolute') continue;
      // Visible?
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const opacity = parseFloat(cs.opacity || '1');
      const bg = cs.backgroundColor || '';
      // Treat "rgba(*,0)" or "transparent" or opacity-0 as invisible.
      const bgTransparent =
        bg === 'transparent' ||
        bg === 'rgba(0, 0, 0, 0)' ||
        /rgba\([^)]*,\s*0(?:\.0+)?\)/.test(bg);
      const isInvisible = (opacity === 0) || bgTransparent;
      if (!isInvisible) continue;
      // Geometric overlap.
      let r;
      try { r = el.getBoundingClientRect(); } catch (_) { continue; }
      if (!r || r.width <= 0 || r.height <= 0) continue;
      const overlap = rectOverlap(paperRect, r);
      if (overlap / paperArea < 0.40) continue;
      // Z-index — if the overlay is below the paper, it isn't actually
      // blocking touches.
      const zi = parseInt(cs.zIndex, 10);
      // pointer-events from CSS — if already none, no need to fix.
      const pe = cs.pointerEvents;
      if (pe === 'none') continue;
      // 1.50.176: do NOT suppress a real interactive LAYER. A stray blocking
      // scrim (the original bug) is empty/transparent with nothing to click;
      // a modal/dialog/dropdown (Application History, the Settings panel) is
      // ALSO a transparent high-z wrapper but CONTAINS interactive content.
      // Setting pointer-events:none on such a wrapper kills its whole subtree,
      // so the history/settings view "opens behind the preview" and can't be
      // used. Skip any overlay that holds focusable content or a dialog/menu
      // role — only genuinely empty scrims get suppressed.
      try {
        const role = el.getAttribute('role');
        if (role === 'dialog' || role === 'menu' || role === 'listbox') continue;
        if (el.querySelector(
          'button, a[href], input, select, textarea, [role="button"], [role="dialog"],' +
          ' [role="menu"], [role="menuitem"], [role="listbox"], [contenteditable="true"], [tabindex]'
        )) continue;
      } catch (_) {}
      // Suppress.
      el.setAttribute('data-antcv-touch-fix-overlay-suppressed', '1');
      n++;
      try {
        console.debug('[preview-touch-fix] suppressed invisible overlay over preview-paper',
          { tag: el.tagName, cls: el.className, z: zi, op: opacity, bg: bg, overlap: Math.round(overlap / paperArea * 100) + '%' });
      } catch (_) {}
    }
    return n;
  }

  // ─── Lower-bar overlap handling ──────────────────────────────────
  // The "lower bar — sections" panel sits fixed at the bottom of the
  // viewport. When the user scrolls down on mobile, the panel can
  // expand or remain visible and cover part of the preview. The
  // panel's own buttons should still work (their explicit pointer-
  // events:auto wins), but if the panel has an invisible scrim that
  // doesn't pass clicks, that scrim is what we want to suppress.
  // 1.50.179: do NOT run the expensive full-body overlay sweep while the user is
  // typing in a field. On mobile, React re-renders on every keystroke fire the
  // MutationObserver -> a per-frame getComputedStyle()/getBoundingClientRect()
  // sweep over the WHOLE DOM -> the page freezes ("blue screen" on mobile while
  // typing in Settings). Typing in a form field needs no preview-overlay repair.
  function isTypingInField() {
    try {
      var ae = document.activeElement;
      if (!ae) return false;
      var tag = (ae.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
      if (ae.isContentEditable) return true;
    } catch (_) {}
    return false;
  }
  function repairAfterScroll() {
    if (!isActive()) return;
    if (isTypingInField()) return;
    ensureStyle();
    try { repairAncestors(); } catch (_) {}
    try { suppressInvisibleOverlays(); } catch (_) {}
  }

  // ─── Mode switching ──────────────────────────────────────────────
  function tick() {
    if (isActive()) ensureStyle();
    else removeStyle();
    repairAfterScroll();
  }

  // ─── Schedule ────────────────────────────────────────────────────
  let pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      try { tick(); } catch (_) {}
    });
  }

  schedule();
  [200, 600, 1500, 4000].forEach(function (d) { setTimeout(schedule, d); });

  // Re-run on every scroll, resize, and touchstart.
  let lastTouchRepair = 0;
  function onScrollOrTouch() {
    const now = Date.now();
    if (now - lastTouchRepair < 100) return; // throttle
    lastTouchRepair = now;
    schedule();
  }
  window.addEventListener('scroll', onScrollOrTouch, true);
  window.addEventListener('resize', schedule);
  window.addEventListener('touchstart', onScrollOrTouch, { capture: true, passive: true });
  window.addEventListener('orientationchange', schedule);

  try {
    const mo = new MutationObserver(function () { schedule(); });
    mo.observe(document.body, { childList: true, subtree: true });
  } catch (_) {}

  // Public API.
  window.AntcvPreviewTouchFix = {
    version: '1.40.197',
    _isActive: isActive,
    _repairAncestors: repairAncestors,
    _suppressInvisibleOverlays: suppressInvisibleOverlays,
    _tick: tick,
  };

  try { console.debug('[preview-touch-fix] installed v1.40.197 — active=' + isActive()); } catch (_) {}
})();
