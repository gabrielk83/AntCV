/* AntCV stale Publications mini-button reaper (v1.40.352)
 * ============================================================================
 *
 * Problem
 * -------
 * Two empty CSS-glyph buttons keep appearing on the Publications & Patent
 * SECTION-HEADER row (and sometimes near the JD-analysis / section panel):
 *
 *   <button data-antcv-pub-injected="enr" data-antcv-pub-mini-kind="enr"
 *           data-antcv-panel-action-211="enr" title="Enhance Publications & Patent"></button>
 *   <button data-antcv-pub-injected="comp" data-antcv-pub-mini-kind="comp"
 *           data-antcv-panel-action-211="comp" title="Fit Publications & Patent"
 *           data-antcv-row-wording-fixed="1"></button>
 *
 * These are legacy artifacts injected by an OLD antcv-section-panel-211.js
 * (≤ v1.40.348, which had cloneMini()). They were persisted into the live
 * DOM / React tree. The current 211 (≥ 1.40.351) and 273 both TRY to remove
 * them, but:
 *   - 273's purge() only runs inside panelRoot() (requires "← back" +
 *     "+ publication" text) — the section-HEADER row is outside that, so 273
 *     never reaches them.
 *   - 211's removePublicationsMiniButtons() runs inside a sweep wrapped by an
 *     `applying` MutationObserver guard + rAF; React re-attaches the buttons
 *     from its retained subtree between sweeps, and the wording sidecar
 *     re-stamps them, so they survive.
 *
 * Fix
 * ---
 * A dedicated, unconditional reaper that:
 *   - loads LAST (after 211 / 273 / wording-341),
 *   - on every mutation + a short interval, removes ANY button carrying
 *     data-antcv-pub-injected or data-antcv-pub-mini-kind,
 *   - EXCEPT 273's real controls (data-antcv-pub273-control) — belt-and-braces;
 *     those never carry pub-injected anyway,
 *   - has NO `applying` guard of its own, so it always wins the race,
 *   - removes the orphan whether it sits on the Publications header row, the
 *     section panel, or anywhere else.
 *
 * This is intentionally a separate file rather than another edit to 211 so the
 * removal can run with its own observer and is not gated by 211's mutation
 * suppression. Additive, idempotent, no app.js edits.
 */
(function () {
  'use strict';

  var VERSION = '1.40.352';
  if (window.__antcvPubInjectedReaper352 === VERSION) return;
  window.__antcvPubInjectedReaper352 = VERSION;

  var SELECTOR = 'button[data-antcv-pub-injected],button[data-antcv-pub-mini-kind]';

  function reap() {
    var nodes = document.querySelectorAll(SELECTOR);
    var removed = 0;
    for (var i = 0; i < nodes.length; i++) {
      var b = nodes[i];
      if (!b) continue;
      // Never touch 273's real Publications controls (defensive; they don't
      // carry pub-injected, but guard anyway).
      if (b.hasAttribute('data-antcv-pub273-control')) continue;
      try { b.remove(); removed++; }
      catch (_) { try { b.style.setProperty('display', 'none', 'important'); } catch (__) {} }
    }
    // Also drop the legacy row marker so nothing keys off it.
    var marked = document.querySelectorAll('[data-antcv-publications-row="1"]');
    for (var j = 0; j < marked.length; j++) {
      try { marked[j].removeAttribute('data-antcv-publications-row'); } catch (_) {}
    }
    if (removed) {
      try { console.debug('[pub-injected-reaper-352] removed', removed, 'stale button(s)'); } catch (_) {}
    }
    return removed;
  }

  // No rAF/applying guard: run synchronously on every observer hit so we always
  // beat React's re-attach. The selector is cheap.
  var mo;
  function onMutation() {
    try { reap(); } catch (_) {}
  }

  function start() {
    reap();
    [50, 150, 400, 900, 1800, 3000, 5000].forEach(function (ms) { setTimeout(reap, ms); });
    try {
      mo = new MutationObserver(onMutation);
      mo.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-antcv-pub-injected', 'data-antcv-pub-mini-kind', 'data-antcv-row-wording-fixed'],
      });
    } catch (_) {}
    // Low-frequency safety net.
    setInterval(reap, 2000);
    window.addEventListener('antcv:sections-updated', reap);
    window.addEventListener('click', function () { setTimeout(reap, 0); }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  window.AntcvPubInjectedReaper352 = { version: VERSION, reap: reap };

  try { console.debug('[pub-injected-reaper-352] installed v' + VERSION); } catch (_) {}
})();
