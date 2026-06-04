/* AntCV loop damper — central re-render-loop circuit breaker (v1.0.0)
 * ============================================================================
 *
 * The PWA loads ~60 sidecars. Most run a MutationObserver on the whole
 * document (document.body / documentElement with { subtree:true }) and, on
 * each callback, sweep + mutate the DOM (re-stamp attributes, re-style
 * buttons, re-inject controls). Because they all watch the whole document,
 * ANY one sidecar's mutation wakes ALL the others, which mutate again — a
 * coupled-oscillator re-render storm that has been measured at hundreds of
 * mutations/sec and ~800 requestAnimationFrame/sec. It makes the preview
 * flicker, the console flood, and inputs (HIWC bullets) lose focus because
 * the row is re-created faster than the user can type.
 *
 * Fixing each writer to be idempotent is whack-a-mole across 60 files. This
 * sidecar fixes the whole class at once, WITHOUT touching any individual
 * sidecar or app.js: it wraps MutationObserver so that callbacks for the
 * BROAD observers (the ones watching body/documentElement + subtree — i.e.
 * the herd) are coalesced and throttled to ~6.7/sec. A sidecar that genuinely
 * needs to react still does, just not at frame rate, so it can no longer
 * sustain a frame-rate feedback loop. NARROW / targeted observers (a specific
 * element, no subtree) pass through UNCHANGED, so contenteditable handling and
 * focused widgets keep their normal latency.
 *
 * Loaded FIRST (before every sidecar and app.js) so all observers get the
 * damped constructor. React 18 does not use MutationObserver for rendering,
 * so React is unaffected.
 *
 * Disable hatch (no redeploy needed): localStorage['antcvDisableLoopDamper']='1'
 * then reload.
 */
(function () {
  'use strict';
  if (window.__antcvLoopDamper) return;
  window.__antcvLoopDamper = '1.0.0';
  try { if (localStorage.getItem('antcvDisableLoopDamper') === '1') return; } catch (_) {}

  var Native = window.MutationObserver || window.WebKitMutationObserver;
  if (typeof Native !== 'function') return;

  var THROTTLE_MS = 150; // broad observers fire at most ~6.7x/sec

  function now() {
    return (window.performance && performance.now) ? performance.now() : Date.now();
  }

  function Damped(callback) {
    if (typeof callback !== 'function') {
      // Preserve native behaviour (it would throw) — let the real one do it.
      return new Native(callback);
    }
    var self = this;
    var broad = false;
    var queued = [];
    var timer = null;
    var lastRun = 0;

    function flush() {
      timer = null;
      lastRun = now();
      var recs = queued;
      queued = [];
      try { callback(recs, self); } catch (_) {}
    }

    var native = new Native(function (records) {
      if (!broad) {
        // Narrow/targeted observer — pass straight through, no delay.
        try { callback(records, self); } catch (_) {}
        return;
      }
      // Broad (whole-document) observer — coalesce + throttle.
      for (var i = 0; i < records.length; i++) queued.push(records[i]);
      if (timer) return;
      var wait = Math.max(0, THROTTLE_MS - (now() - lastRun));
      timer = setTimeout(flush, wait);
    });

    this.observe = function (target, opts) {
      try {
        if ((target === document.body || target === document.documentElement) &&
            opts && opts.subtree) {
          broad = true;
        }
      } catch (_) {}
      return native.observe(target, opts);
    };
    this.disconnect = function () {
      if (timer) { clearTimeout(timer); timer = null; }
      queued = [];
      return native.disconnect();
    };
    this.takeRecords = function () {
      var pending = queued; queued = [];
      var live = native.takeRecords();
      return pending.length ? pending.concat(live) : live;
    };
  }

  try {
    window.MutationObserver = Damped;
    window.WebKitMutationObserver = Damped;
  } catch (_) { return; }

  try { console.debug('[loop-damper] installed v1.0.0 — broad MutationObservers throttled to ~' + Math.round(1000 / THROTTLE_MS) + '/s'); } catch (_) {}
})();
