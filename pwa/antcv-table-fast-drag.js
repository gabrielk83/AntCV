/* AntCV table column-ratio fast-drag sidecar (v1.40.147)
 * ============================================================
 * Gabriel reported: "control of table columns ratio on their
 * border does not work as smooth as before — need very long
 * steady press".
 *
 * Root cause
 * ----------
 * The React component `ke` in app.js (function at offset
 * ~75382) gates drag activation behind a 360ms long-press
 * timer. Less than 360ms steady press → tap dismissed. The
 * timer was set deliberately to distinguish from accidental
 * touches during scrolling, but in practice 360ms feels
 * sluggish on desktop where the user's cursor is precisely on
 * the resize handle.
 *
 * Fix
 * ---
 * This sidecar finds every resize handle by its accessibility
 * label (`aria-label="Resize columns (long-press and drag)"`)
 * and intercepts pointerdown in capture phase BEFORE the React
 * handler runs. It then:
 *   1. stops immediate propagation so React's 360ms timer
 *      never starts
 *   2. activates drag after just 80ms of steady press (3px
 *      movement threshold still cancels — i.e. scrolls still
 *      win the gesture)
 *   3. implements the same drag logic as React's handler:
 *      column widths in thead update live; handle position
 *      tracks the cursor; ratio clamped to [0.15, 0.50]
 *   4. on release, persists the new ratio to localStorage
 *      under the same keys React uses (`cvTableRatio` or
 *      `clTableRatio`, JSON-encoded number)
 *
 * The DOM is updated immediately, so the user sees the
 * resize. React reads the persisted ratio from localStorage
 * on next mount / refresh / tab switch, so the change
 * survives. There's a small window where the React state
 * and DOM are out of sync until the next render — visually
 * imperceptible.
 *
 * Caveat: this sidecar acts purely on the handle's DOM
 * neighbourhood. If a future ship moves the handle elsewhere,
 * the selectors won't match and the React handler reactivates
 * (correct 360ms behaviour). No regression risk.
 */
(function () {
  'use strict';

  const SCRIPT_VERSION = '1.50.489';
  const HANDLE_SEL = '[aria-label="Resize columns (long-press and drag)"]';
  const PRESS_MS = 80;          // was 360 in React handler
  const MOVE_CANCEL_PX = 6;     // matches React handler's threshold
  const MIN_RATIO = 0.15;
  const MAX_RATIO = 0.50;
  const ATTACHED_FLAG = 'antcvFastDragInstalled';

  if (window.__antcvTableFastDragInstalled) return;
  window.__antcvTableFastDragInstalled = SCRIPT_VERSION;

  // Determine which storage key to update based on the current
  // doc (cv vs cl). The app tracks active doc via `localStorage.doc`,
  // populated by the React state's `Lt` ('cv' or 'cl').
  function currentRatioKey() {
    try {
      const raw = localStorage.getItem('doc');
      if (!raw) return 'cvTableRatio';
      let v = raw;
      try { const p = JSON.parse(raw); if (typeof p === 'string') v = p; } catch (_) {}
      return v === 'cl' ? 'clTableRatio' : 'cvTableRatio';
    } catch (_) {
      return 'cvTableRatio';
    }
  }

  // TABLE-RATIO-DRAG-PERSIST-001 (owner 2026-06-15): "change of the column
  // border by MOUSE GRAB pulls back; changing on the ROLLER (slider) stays."
  // Root cause: this sidecar wrote clTableRatio to localStorage + moved the
  // <th> widths in the DOM, but NEVER updated React state (Qr/Xr). The roller
  // <input type=range> persists because its onChange calls the React setter
  // (ia/aa); a bare localStorage write does not, so the next React re-render
  // reverts the columns to the stale state — the "pull back". Fix: on release,
  // DRIVE the matching roller input via the native value setter + input/change
  // events, so React's own setter runs and the ratio survives re-render exactly
  // like the slider. Desktop top-tools rollers only; falls back to the plain
  // localStorage write when the roller is not in the DOM (no regression).
  function driveReactRoller(ratio) {
    try {
      const isCl = currentRatioKey() === 'clTableRatio';
      const title = (isCl ? 'CL' : 'CV') + ' table: Focus Area column width';
      let input = null;
      const wraps = document.querySelectorAll('.antcv-top-sliders [title]');
      for (let i = 0; i < wraps.length; i++) {
        if ((wraps[i].getAttribute('title') || '').indexOf(title) === 0) {
          input = wraps[i].querySelector('input[type="range"]');
          if (input) break;
        }
      }
      if (!input) return false;
      const pct = String(Math.round(ratio * 100)); // the input clamps to its own min/max
      const proto = window.HTMLInputElement && window.HTMLInputElement.prototype;
      const desc = proto && Object.getOwnPropertyDescriptor(proto, 'value');
      if (desc && typeof desc.set === 'function') desc.set.call(input, pct);
      else input.value = pct;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } catch (_) { return false; }
  }

  function attachHandler(handle) {
    if (handle.dataset[ATTACHED_FLAG] === '1') return;
    handle.dataset[ATTACHED_FLAG] = '1';

    const onDown = function (ev) {
      if (ev.button !== undefined && ev.button !== 0) return;
      // Silence React's handler — it would otherwise set its own
      // 360ms timer in parallel and fight us for pointer capture.
      ev.stopImmediatePropagation();

      const wrapper = handle.parentElement;
      if (!wrapper) return;
      const wrapRect = wrapper.getBoundingClientRect();

      const state = {
        sx: ev.clientX || 0,
        wrapL: wrapRect.left,
        wrapW: Math.max(1, wrapRect.width),
        active: false,
        lastR: null,
        pointerId: ev.pointerId,
      };

      const activate = function () {
        if (state.active) return;
        state.active = true;
        try { handle.setPointerCapture(state.pointerId); } catch (_) {}
        // Visual feedback (matches React handler's hover state)
        handle.dataset.antcvDragActive = '1';
      };

      const timer = setTimeout(activate, PRESS_MS);

      const onMove = function (mev) {
        if (!state.active) {
          // Pre-activation: cancel timer if the user has scrolled
          // beyond the threshold (i.e. this was a scroll, not a
          // resize).
          if (Math.abs((mev.clientX || 0) - state.sx) > MOVE_CANCEL_PX) {
            clearTimeout(timer);
            cleanup();
          }
          return;
        }
        mev.preventDefault();
        const o = (mev.clientX || 0) - state.wrapL;
        const r = Math.max(MIN_RATIO, Math.min(MAX_RATIO, o / state.wrapW));
        state.lastR = r;

        const table = wrapper.querySelector('table');
        if (table) {
          const ths = table.querySelectorAll('thead th');
          const pct = (100 * r).toFixed(2);
          if (ths[0]) ths[0].style.width = pct + '%';
          if (ths[1]) ths[1].style.width = (100 - parseFloat(pct)).toFixed(2) + '%';
        }
        handle.style.left = 'calc(' + (100 * r).toFixed(2) + '% - 12px)';
      };

      const onUp = function () {
        clearTimeout(timer);
        if (state.active && state.lastR !== null) {
          const ratio = Math.round(state.lastR * 1000) / 1000;
          try {
            const key = currentRatioKey();
            // Match the app's u.set() shape: JSON-encode numbers.
            localStorage.setItem(key, JSON.stringify(ratio));
            // TABLE-RATIO-DRAG-PERSIST-001: drive the React roller so state
            // (Qr/Xr) updates too — otherwise the next re-render reverts the
            // columns ("pull back"). When the roller is in the DOM React's own
            // ia/aa setter also re-persists clTableRatio, so the two agree.
            driveReactRoller(ratio);
            // Dispatch a synthetic storage event so any listeners
            // (e.g. preview re-render watchers) pick up the change
            // in the same tab. `storage` only fires on OTHER tabs
            // natively, so we synthesize it here.
            try {
              const se = new Event('storage');
              se.key = key;
              se.newValue = JSON.stringify(ratio);
              window.dispatchEvent(se);
            } catch (_) {}
          } catch (_) {}
        }
        try { handle.releasePointerCapture(state.pointerId); } catch (_) {}
        delete handle.dataset.antcvDragActive;
        cleanup();
      };

      function cleanup() {
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        handle.removeEventListener('pointercancel', onUp);
      }

      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
      handle.addEventListener('pointercancel', onUp);
    };

    // Capture phase so we run BEFORE the React-attached handler.
    handle.addEventListener('pointerdown', onDown, { capture: true });
  }

  function scanForHandles() {
    document.querySelectorAll(HANDLE_SEL).forEach(attachHandler);
  }

  // Initial passes — handles may not yet be in the DOM.
  [0, 200, 600, 1500].forEach(function (d) {
    if (d === 0) scanForHandles();
    else setTimeout(scanForHandles, d);
  });

  // Catch new handles via MutationObserver (React re-renders when
  // tables appear / disappear, e.g. CORE COMPETENCIES being
  // toggled or doc switched between CV and CL).
  try {
    const mo = new MutationObserver(function () { scanForHandles(); });
    mo.observe(document.body, { childList: true, subtree: true });
  } catch (_) {}

  // Polling fallback at low rate.
  setInterval(scanForHandles, 1500);
})();
