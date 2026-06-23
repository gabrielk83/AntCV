/* AntCV sidebar/main splitter flip sidecar (v1.40.151)
 * ============================================================
 *
 * Gabriel reported: "Moving sidebar to the right keep the sidebar
 * position shifter on the left" (and the inverse: with sidebar=left,
 * the shifter stays on the right). Picture marks a small vertical
 * bar at the top of the page area in the wrong column.
 *
 * Background
 * ----------
 * App.js renders a small splitter at the top of every
 * `.antcv-page-row` with className `antcv-col-splitter`:
 *
 *   <div className="antcv-col-splitter no-print"
 *        onPointerDown={sa}
 *        title="Drag to resize the sidebar/main split. ..."
 *        style={{ position:"absolute", top:12, height:80,
 *                 left:`calc(${Math.round(100*ta)}% - 14px)`,
 *                 width:28, cursor:"ew-resize", zIndex:100,
 *                 touchAction:"none", pointerEvents:"auto" }}/>
 *
 * `ta` is the sidebar width ratio (e.g. 0.25). The splitter's
 * `left` is set to `ta * 100% - 14px` — correct when the sidebar
 * sits on the LEFT (it lands on the sidebar/main boundary).
 *
 * When antcv-sidebar-position.js v1.40.146 applies
 * `flex-direction: row-reverse` to the page-row (sidebarPosition
 * = 'right'), the visual layout becomes [Main | Sidebar]. The
 * splitter is `position: absolute` so the flex direction does
 * NOT move it — its `left: ta%` keeps it INSIDE the main column,
 * far from the actual boundary which is now at `(1-ta) * 100%`.
 *
 * Fix
 * ---
 * This sidecar:
 *
 *   1. Re-positions the splitter to `(1-ta)% - 14px` when
 *      `sidebarPosition === 'right'`. It reads the React-set
 *      inline `left` value (matching the `calc(${pct}% - 14px)`
 *      shape) and overrides with the flipped value. A MutationObserver
 *      catches React re-renders.
 *
 *   2. Intercepts pointerdown on the splitter in capture phase
 *      when sidebar=right. The native handler (`sa`) expects the
 *      sidebar to be on the left; dragging the splitter right
 *      would grow the sidebar in that math. In reverse mode the
 *      same drag should SHRINK the sidebar. We implement our own
 *      pointer-move loop:
 *
 *        r = 1 - (clientX - wrapL) / wrapW       (clamped 0.15..0.50)
 *
 *      and persist to `localStorage.cvSidebarRatio` so the React
 *      state catches up on next re-render.
 *
 * Storage key: `cvSidebarRatio` (number, JSON-encoded — same as
 * app.js).
 *
 * Side note: the `ke` table column-resize handle (aria-label
 * "Resize columns (long-press and drag)") is INSIDE the main
 * column and is not affected by sidebar position. We leave it
 * alone.
 */
(function () {
  'use strict';

  const SCRIPT_VERSION = '1.50.818';
  const SPLITTER_SEL = '.antcv-col-splitter';
  const SIDEBAR_SEL = '[data-antcv-document-sidebar="true"]';
  const PAGE_ROW_SEL = '.antcv-page-row';
  const STORAGE_KEY = 'cvSidebarRatio';
  const POS_KEY = 'sidebarPosition';
  const ATTACHED_FLAG = 'antcvSplitterFlipAttached';
  const MIN_RATIO = 0.15;
  const MAX_RATIO = 0.50;

  if (window.__antcvSplitterFlipInstalled) return;
  window.__antcvSplitterFlipInstalled = SCRIPT_VERSION;

  // ─── Storage

  function readSidebarPosition() {
    try {
      const raw = localStorage.getItem(POS_KEY);
      if (!raw) return 'left';
      let v = raw;
      try { const p = JSON.parse(raw); if (typeof p === 'string') v = p; } catch (_) {}
      v = String(v).trim().toLowerCase();
      return v === 'right' ? 'right' : 'left';
    } catch (_) { return 'left'; }
  }

  function readSidebarRatio() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) return null;
      const v = JSON.parse(raw);
      return typeof v === 'number' ? v : null;
    } catch (_) { return null; }
  }

  function writeSidebarRatio(ratio) {
    try {
      const r = Math.max(MIN_RATIO, Math.min(MAX_RATIO, ratio));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
      const se = new Event('storage');
      se.key = STORAGE_KEY;
      se.newValue = JSON.stringify(r);
      window.dispatchEvent(se);
    } catch (_) {}
  }

  // ─── Parse React's inline left value: "calc(25% - 14px)" → 25

  function parseReactLeftPct(leftStr) {
    if (!leftStr) return null;
    // Char-walk to avoid \s in regex — repo-wide convention to
    // avoid the test harness's backslash-in-regex glitch.
    if (leftStr.indexOf('calc(') !== 0) return null;
    const rest = leftStr.slice(5);
    let i = 0;
    let numStr = '';
    while (i < rest.length) {
      const ch = rest.charAt(i);
      if (ch === '%') break;
      if ((ch >= '0' && ch <= '9') || ch === '.' || ch === '-') {
        numStr += ch;
        i++;
      } else if (ch === ' ' || ch === '\t') {
        i++;
      } else {
        return null;
      }
    }
    if (rest.charAt(i) !== '%') return null;
    const val = parseFloat(numStr);
    if (!isFinite(val)) return null;
    return val;
  }

  // ─── Idle position flip

  function flipSplitterPositions() {
    const pos = readSidebarPosition();
    const splitters = document.querySelectorAll(SPLITTER_SEL);
    splitters.forEach(function (s) {
      const curLeft = s.style.left || '';
      const curPct = parseReactLeftPct(curLeft);

      if (pos !== 'right') {
        // Sidebar on left — leave React's value alone. Clear our
        // marker so a future right-toggle doesn't get confused.
        if (s.dataset.antcvFlipLast) delete s.dataset.antcvFlipLast;
        return;
      }

      // Sidebar on right — compute target from the source-of-truth
      // ratio in localStorage, not from the current style (which may
      // already be our flipped value). If curPct already matches the
      // target within 0.5pt, do nothing — this is what breaks the
      // mutation loop that would otherwise fire when the
      // MutationObserver sees our own style write.
      if (curPct === null) return;
      const ratio = readSidebarRatio();
      if (ratio === null) return;

      const targetPct = (1 - ratio) * 100;
      if (Math.abs(curPct - targetPct) < 0.5) {
        // Already flipped — record marker for diagnostics and exit.
        s.dataset.antcvFlipLast = curLeft;
        return;
      }

      // Otherwise React just (re-)wrote `calc(X% - 14px)` where
      // X = round(100 * ratio). Flip it.
      const desired = 'calc(' + targetPct.toFixed(2) + '% - 14px)';
      s.style.left = desired;
      s.dataset.antcvFlipLast = desired;
    });
  }

  // ─── Drag handler for sidebar=right mode

  function makeReversePointerDown(splitter) {
    return function (ev) {
      if (readSidebarPosition() !== 'right') return;
      if (ev.button !== undefined && ev.button !== 0) return;

      // Block the native onPointerDown (React handler `sa`) — its
      // drag math expects sidebar on left, which is wrong now.
      ev.stopImmediatePropagation();
      ev.preventDefault && ev.preventDefault();

      const pageRow = splitter.closest(PAGE_ROW_SEL);
      if (!pageRow) return;
      const rect = pageRow.getBoundingClientRect();
      const wrapL = rect.left;
      const wrapW = Math.max(1, rect.width);
      const pointerId = ev.pointerId;

      try { splitter.setPointerCapture(pointerId); } catch (_) {}

      let lastR = null;

      function onMove(mev) {
        mev.preventDefault && mev.preventDefault();
        const o = (mev.clientX || 0) - wrapL;
        // Reverse-mode math: visual boundary at (1-r) * wrapW.
        // Cursor at clientX → o = (1-r) * wrapW → r = 1 - o/wrapW.
        const r = Math.max(MIN_RATIO, Math.min(MAX_RATIO, 1 - o / wrapW));
        lastR = r;
        // Update the splitter's visual position to track the cursor.
        const newLeftPct = (1 - r) * 100;
        const desired = 'calc(' + newLeftPct.toFixed(2) + '% - 14px)';
        splitter.style.left = desired;
        splitter.dataset.antcvFlipLast = desired;
        // Update sidebar width directly so the user sees the resize.
        const sidebar = pageRow.querySelector(SIDEBAR_SEL);
        if (sidebar) {
          sidebar.style.width = (r * 100).toFixed(2) + '%';
        }
      }

      function onUp() {
        try { splitter.releasePointerCapture(pointerId); } catch (_) {}
        splitter.removeEventListener('pointermove', onMove);
        splitter.removeEventListener('pointerup', onUp);
        splitter.removeEventListener('pointercancel', onUp);
        if (lastR !== null) {
          // Round to 3 decimals to match app.js convention.
          const ratio = Math.round(lastR * 1000) / 1000;
          writeSidebarRatio(ratio);
        }
      }

      splitter.addEventListener('pointermove', onMove);
      splitter.addEventListener('pointerup', onUp);
      splitter.addEventListener('pointercancel', onUp);
    };
  }

  function attachToSplitter(splitter) {
    if (splitter.dataset[ATTACHED_FLAG] === '1') return;
    splitter.dataset[ATTACHED_FLAG] = '1';
    const handler = makeReversePointerDown(splitter);
    splitter.addEventListener('pointerdown', handler, { capture: true });
  }

  function scan() {
    document.querySelectorAll(SPLITTER_SEL).forEach(attachToSplitter);
    flipSplitterPositions();
  }

  // Perf (BOOT-FREEZE / [[boot-storm-gate-freeze]]): big-doc pagination
  // churns style/class on thousands of nodes, so the observer fired a
  // full-tree scan() per mutation and the 1.5s poll was a named live
  // offender. Coalesce the observer/poll/storage paths into a trailing
  // debounce (waitMs) with a maxWaitMs cap so a continuous storm still
  // scans at least once per maxWaitMs. The initial passes stay direct
  // so the splitter attaches/positions immediately.
  function makeCoalesced(fn, waitMs, maxWaitMs) {
    let t = null, firstAt = 0;
    return function () {
      const now = (window.performance && window.performance.now)
        ? window.performance.now() : Date.now();
      if (t === null) firstAt = now;
      else clearTimeout(t);
      const sinceFirst = now - firstAt;
      const delay = sinceFirst >= maxWaitMs ? 0
        : Math.min(waitMs, maxWaitMs - sinceFirst);
      t = setTimeout(function () { t = null; fn(); }, delay);
    };
  }
  const scheduleScan = makeCoalesced(scan, 200, 1000);

  // Initial passes
  [0, 200, 600, 1500].forEach(function (d) {
    if (d === 0) scan();
    else setTimeout(scan, d);
  });

  try {
    const mo = new MutationObserver(scheduleScan);
    mo.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    });
  } catch (_) {}

  // Polling fallback at low rate (coalesced; slowed from 1.5s).
  setInterval(scheduleScan, 2500);

  // Storage change listener (other tabs)
  window.addEventListener('storage', function (e) {
    if (!e || e.key === POS_KEY || e.key === STORAGE_KEY || e.key === null) {
      scheduleScan();
    }
  });

  // Test/debug API
  window.AntcvSplitterFlip = {
    version: SCRIPT_VERSION,
    _readSidebarPosition: readSidebarPosition,
    _readSidebarRatio: readSidebarRatio,
    _parseReactLeftPct: parseReactLeftPct,
    _flipSplitterPositions: flipSplitterPositions,
    _writeSidebarRatio: writeSidebarRatio,
    _scan: scan,
    _scheduleScan: scheduleScan,
  };
})();
