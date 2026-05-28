/* AntCV DnD insertion-point + destination styling (v1.40.341-p0d)
 * ============================================================
 *
 * CA-004 + CA-005 (partial — visual layer only)
 * ---------------------------------------------
 * CA-004 acceptance: "Drag to first/middle/last positions in main
 * and sidebar lands at the indicator, not the end."
 * CA-005 acceptance: "Moved Contact (top→main, main→sidebar,
 * sidebar→top) is readable, uses destination styling, keeps order."
 *
 * Scope of this sidecar
 * ---------------------
 * The actual reorder/move semantics live in `pwa/app.js` (minified
 * React bundle). Section drag-and-drop emits its own dragstart /
 * dragover / drop events keyed on `[data-sid]` and the
 * `[data-candidate-drop-loc]` containers. This sidecar adds a
 * VISUAL layer on top:
 *
 *   1. During a drag (when any element fires dragstart with
 *      [data-sid] in its lineage), insert a thin teal indicator
 *      line between row siblings inside the same container,
 *      positioned by the live pointer Y.
 *   2. When the user releases (drop or dragend), remove the
 *      indicator and stamp the dropped section with a
 *      `data-antcv-just-moved-to="<container>"` attribute for
 *      a brief window so destination-styling CSS rules can pick
 *      it up.
 *   3. Inject CSS that applies destination-container style tokens
 *      to elements carrying `data-antcv-just-moved-to`. The
 *      tokens are minimal (`color`, `background`, `border-color`)
 *      — full styling depth comes from the parent container's
 *      cascade once the React re-render settles.
 *
 * What this CANNOT do
 * -------------------
 * Without touching app.js the actual model-level move (which
 * container the section lands in after drop) is determined by
 * app.js's drop handler. If app.js always appends to the end,
 * the indicator shows position N but the section lands at end.
 * The visual gap is then easy to spot in a follow-up pass and
 * informs the app.js fix.
 *
 * Idempotency / cleanup
 * ---------------------
 * The indicator element carries `data-antcv-dnd-indicator="1"`
 * and is recreated each drag — never accumulates. The
 * just-moved-to attribute self-clears after 800 ms.
 */
(function () {
  'use strict';

  var SCRIPT_VERSION = '1.40.341-p0d';
  if (window.__antcvDndInsertionPoint341 === SCRIPT_VERSION) return;
  window.__antcvDndInsertionPoint341 = SCRIPT_VERSION;

  var INDICATOR_ATTR = 'data-antcv-dnd-indicator';
  var JUST_MOVED_ATTR = 'data-antcv-just-moved-to';
  var CONTAINER_SELECTORS = [
    '[data-candidate-drop-loc]',
    '.antcv-document-sidebar',
    '.antcv-document-main',
    '[data-antcv-document-sidebar]',
    '[data-antcv-document-main]',
  ].join(', ');

  var indicatorEl = null;
  var dragSourceSid = null;

  function injectCss() {
    if (document.getElementById('antcv-dnd-insertion-point-341-css')) return;
    var s = document.createElement('style');
    s.id = 'antcv-dnd-insertion-point-341-css';
    s.textContent = [
      '[' + INDICATOR_ATTR + '="1"]{',
      '  position:absolute;left:0;right:0;height:0;',
      '  border-top:2px solid #01B7BB;',
      '  pointer-events:none;z-index:9999;',
      '  box-shadow:0 0 6px rgba(1,183,187,0.55);',
      '}',
      '[' + JUST_MOVED_ATTR + ']{',
      '  animation:antcv-dnd-flash 800ms ease-out;',
      '}',
      '@keyframes antcv-dnd-flash{',
      '  0%   { box-shadow: 0 0 0 3px rgba(1,183,187,0.55); }',
      '  100% { box-shadow: 0 0 0 0 rgba(1,183,187,0); }',
      '}',
      // Destination-container style tokens — minimal nudge; React
      // re-render picks up the full cascade.
      '[' + JUST_MOVED_ATTR + '="topbar"]{',
      '  color: var(--antcv-topbar-fg, inherit);',
      '  background: var(--antcv-topbar-bg, transparent);',
      '}',
      '[' + JUST_MOVED_ATTR + '="main"]{',
      '  color: var(--antcv-main-fg, inherit);',
      '  background: var(--antcv-main-bg, transparent);',
      '}',
      '[' + JUST_MOVED_ATTR + '="sidebar"]{',
      '  color: var(--antcv-sidebar-fg, inherit);',
      '  background: var(--antcv-sidebar-bg, transparent);',
      '}',
    ].join('\n');
    (document.head || document.documentElement).appendChild(s);
  }

  function ensureIndicator() {
    if (indicatorEl && indicatorEl.isConnected) return indicatorEl;
    indicatorEl = document.createElement('div');
    indicatorEl.setAttribute(INDICATOR_ATTR, '1');
    indicatorEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(indicatorEl);
    return indicatorEl;
  }

  function clearIndicator() {
    if (indicatorEl && indicatorEl.parentNode) {
      try { indicatorEl.parentNode.removeChild(indicatorEl); } catch (_) {}
    }
    indicatorEl = null;
  }

  function findContainerAt(x, y) {
    var stack = document.elementsFromPoint
      ? document.elementsFromPoint(x, y)
      : [document.elementFromPoint(x, y)];
    for (var i = 0; i < stack.length; i++) {
      var el = stack[i];
      if (!el || el.nodeType !== 1) continue;
      if (el.matches && el.matches(CONTAINER_SELECTORS)) return el;
      var parent = el.closest && el.closest(CONTAINER_SELECTORS);
      if (parent) return parent;
    }
    return null;
  }

  function findInsertionAnchorIn(container, y) {
    var rows = container.querySelectorAll(':scope > [data-sid]');
    if (!rows.length) {
      // Try one level deeper for containers that wrap rows.
      rows = container.querySelectorAll('[data-sid]');
    }
    var anchor = null;
    var insertBefore = true;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!r.isConnected) continue;
      var rect = r.getBoundingClientRect();
      if (y < rect.top + rect.height / 2) {
        anchor = r;
        insertBefore = true;
        return { anchor: anchor, insertBefore: insertBefore };
      }
      anchor = r;
      insertBefore = false; // last row before pointer
    }
    return { anchor: anchor, insertBefore: insertBefore };
  }

  function positionIndicatorBetween(anchor, insertBefore) {
    if (!anchor) return;
    var ind = ensureIndicator();
    var rect = anchor.getBoundingClientRect();
    var y = insertBefore ? rect.top : rect.bottom;
    ind.style.position = 'fixed';
    ind.style.top = (y - 1) + 'px';
    ind.style.left = rect.left + 'px';
    ind.style.width = rect.width + 'px';
    ind.style.height = '0';
    ind.style.display = 'block';
  }

  function onDragStart(ev) {
    // Identify the dragged section.
    var t = ev.target;
    if (!t || !t.closest) return;
    var node = t.closest('[data-sid]');
    if (!node) return;
    dragSourceSid = node.getAttribute('data-sid') || null;
    injectCss();
  }

  function onDragOver(ev) {
    if (!dragSourceSid) return;
    var container = findContainerAt(ev.clientX, ev.clientY);
    if (!container) {
      clearIndicator();
      return;
    }
    var loc = findInsertionAnchorIn(container, ev.clientY);
    if (loc && loc.anchor) {
      positionIndicatorBetween(loc.anchor, loc.insertBefore);
    } else {
      clearIndicator();
    }
  }

  function containerKindOf(container) {
    if (!container) return null;
    var loc = container.getAttribute && container.getAttribute('data-candidate-drop-loc');
    if (loc) return loc;
    if (container.matches && container.matches('.antcv-document-sidebar, [data-antcv-document-sidebar]')) return 'sidebar';
    if (container.matches && container.matches('.antcv-document-main, [data-antcv-document-main]')) return 'main';
    return null;
  }

  function stampJustMoved(sid, container) {
    if (!sid) return;
    var kind = containerKindOf(container);
    if (!kind) return;
    // Find any DOM nodes that reference this sid and stamp them.
    var nodes = document.querySelectorAll('[data-sid="' + sid + '"]');
    for (var i = 0; i < nodes.length; i++) {
      try { nodes[i].setAttribute(JUST_MOVED_ATTR, kind); } catch (_) {}
    }
    setTimeout(function () {
      for (var j = 0; j < nodes.length; j++) {
        try { nodes[j].removeAttribute(JUST_MOVED_ATTR); } catch (_) {}
      }
    }, 800);
  }

  function onDrop(ev) {
    var src = dragSourceSid;
    var container = findContainerAt(ev.clientX, ev.clientY);
    clearIndicator();
    dragSourceSid = null;
    if (src && container) {
      // Defer to the next tick so React's drop handler runs first.
      setTimeout(function () { stampJustMoved(src, container); }, 50);
    }
  }

  function onDragEnd() {
    clearIndicator();
    dragSourceSid = null;
  }

  function install() {
    injectCss();
    // Listen on document so we catch every drag regardless of source.
    document.addEventListener('dragstart', onDragStart, true);
    document.addEventListener('dragover', onDragOver, true);
    document.addEventListener('drop', onDrop, true);
    document.addEventListener('dragend', onDragEnd, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }

  window.AntcvDndInsertionPoint341 = {
    version: SCRIPT_VERSION,
  };

  try { console.debug('[dnd-insertion-point] installed v' + SCRIPT_VERSION); } catch (_) {}
})();
