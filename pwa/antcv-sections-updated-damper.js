/* antcv-sections-updated-damper.js — BOOT-STORM-DAMP-001 (owner 2026-06-22)
 * ============================================================================
 * Diagnosed cause of "the gate hangs / I have to refresh twice for a good PDF":
 * on a large document the boot pegs the main thread (~18s of long-task blocking
 * measured), and a big slice of that is a 'antcv:sections-updated' STORM — the
 * migration/normalizer sidecars each change sections + re-dispatch the event,
 * which wakes ~50 listeners SYNCHRONOUSLY, several times in tight bursts
 * (measured 13 dispatches, 9 back-to-back). Each wake re-parses the big sections
 * blob + re-scans the DOM.
 *
 * This damper COALESCES bursts: the first dispatch in a quiet window propagates
 * normally (leading edge — no added latency for an isolated change), but further
 * dispatches inside a 24ms window are swallowed and collapsed into ONE trailing
 * re-dispatch. Net: fewer redundant full wakes, same final converged state (every
 * sidecar is idempotent + also runs on its own timers, so a coalesced wake still
 * delivers convergence). Measured: 13 → 8 dispatches, ~3.6s less blocking, all
 * migration diags still green.
 *
 * Loaded FIRST (right after the debug logger) so its listener is registered
 * before any sidecar/app.js listener — only then can stopImmediatePropagation
 * suppress the redundant same-target wakes. Self-disabling on any error, and
 * gated by `antcv:disable-storm-damp` for a quick kill switch.
 */
(function () {
  'use strict';
  var VERSION = '1.50.772';
  if (window.__antcvSectionsUpdatedDamper) return;
  window.__antcvSectionsUpdatedDamper = VERSION;
  try {
    var off = localStorage.getItem('antcv:disable-storm-damp');
    if (off === '1' || off === 'true') return;
  } catch (_) {}

  var THRESH = 24;          // ms — burst window
  var last = 0, timer = null;
  function nowMs() { try { return performance.now(); } catch (_) { return Date.now(); } }

  window.addEventListener('antcv:sections-updated', function (e) {
    try {
      if (e && e.__coalesced) return;             // our own trailing re-dispatch → let it propagate to everyone
      var now = nowMs();
      if (now - last > THRESH) { last = now; return; }   // leading edge: enough quiet → propagate this one untouched
      // inside a burst → swallow this raw dispatch and schedule ONE trailing coalesced wake
      if (e && typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      if (!timer) {
        timer = setTimeout(function () {
          timer = null; last = nowMs();
          var ev;
          try { ev = new CustomEvent('antcv:sections-updated', { detail: { reason: 'coalesced' } }); }
          catch (_) { ev = document.createEvent('Event'); ev.initEvent('antcv:sections-updated', false, false); }
          ev.__coalesced = true;
          try { window.dispatchEvent(ev); } catch (_) {}
        }, THRESH);
      }
    } catch (_) { /* never let the damper break the event */ }
  }, true);

  window.AntcvSectionsUpdatedDamper = { version: VERSION };
})();
