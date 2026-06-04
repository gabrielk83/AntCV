/* AntCV sections-updated de-duper (v1.0.0) — DEFAULT OFF (opt-in)
 * ============================================================================
 *
 * The re-render churn (HIWC input un-clickable, table page-button "flicker but
 * doesn't advance", controls reverting) is driven by `antcv:sections-updated`
 * being dispatched repeatedly with the SAME sections payload. Each dispatch ->
 * personality forceRebuild + app.js re-renders the preview -> injected inputs /
 * controls are destroyed/reverted before the user can interact.
 *
 * This wraps dispatchEvent and DROPS an `antcv:sections-updated` whose sections
 * payload is byte-identical to the previous one within a short window. A
 * same-payload event is a no-op for consumers (nothing changed), so dropping it
 * removes the redundant re-render without losing any real update. Every other
 * event passes through untouched.
 *
 * SAFETY: after the global MutationObserver damper (1.50.85) caused regressions,
 * this is shipped DEFAULT-OFF and scoped to ONE event type. Enable to test:
 *   localStorage.setItem('antcvSecDedupe','1'); location.reload();
 * Disable: remove the key (or set '0') and reload.
 */
(function () {
  'use strict';
  if (window.__antcvSecDedupe) return;
  window.__antcvSecDedupe = '1.0.0';

  var ON = false;
  try { ON = localStorage.getItem('antcvSecDedupe') === '1'; } catch (_) {}
  if (!ON) { try { console.debug('[sec-dedupe] present but OFF (set localStorage.antcvSecDedupe=1 to enable)'); } catch (_) {} return; }

  var EVT = 'antcv:sections-updated';
  var WINDOW_MS = 700;
  var lastKey = null, lastAt = 0, dropped = 0, lastLog = 0;

  function sectionsKey() {
    try { return (localStorage.getItem('sections') || '') + '' + (localStorage.getItem('doc') || ''); }
    catch (_) { return String(Math.random()); }
  }

  var proto = (window.EventTarget && EventTarget.prototype) || null;
  if (!proto || typeof proto.dispatchEvent !== 'function') return;
  var orig = proto.dispatchEvent;

  proto.dispatchEvent = function (ev) {
    try {
      if (ev && ev.type === EVT) {
        var k = sectionsKey();
        var now = Date.now();
        if (k === lastKey && (now - lastAt) < WINDOW_MS) {
          dropped++;
          if (now - lastLog > 2000) { lastLog = now; try { console.debug('[sec-dedupe] dropped', dropped, 'redundant sections-updated'); } catch (_) {} }
          return true; // swallow — identical payload, no real change
        }
        lastKey = k; lastAt = now;
      }
    } catch (_) {}
    return orig.apply(this, arguments);
  };

  try { console.debug('[sec-dedupe] installed v1.0.0 — ON (dropping identical sections-updated within ' + WINDOW_MS + 'ms)'); } catch (_) {}
})();
