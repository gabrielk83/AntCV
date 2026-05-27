/* AntCV stale-status sidecar (v1.40.339-h)
 * ============================================================
 *
 * Symptom (original — v1.40.158)
 * ------------------------------
 * After CV generation completes, the live-status pill (the
 * cyan/blue pulsing toast that says e.g. "🔎 Tightening to length
 * targets…") sometimes stayed visible forever in the editor. The
 * user is just editing, no LLM operation is running, and the pill
 * insists otherwise. v1.40.158 added click-to-dismiss + stale-hide
 * to address that.
 *
 * Bug 8 (v1.40.339-h)
 * -------------------
 * v158's dismissal logic was unconditional. If the user clicked the
 * pill while a kernel/consensus operation was actively running, the
 * indicator disappeared even though the operation was still in
 * flight — leaving the user with no live progress signal for the
 * remaining 4–6 minutes of generation. The same problem affected
 * the 60-second stale auto-hide: long-running operations would have
 * their pill auto-hidden mid-flight.
 *
 * Fix
 * ---
 * Both dismissal paths now consult a busy() check that reads:
 *   window._antcvKernelBusy
 *   window._antcvConsensusBusy
 *   window.AntcvKernel.busy   (defensive — newer code may set this)
 *
 * When busy:
 *   - The click handler refuses to hide and flashes the pill border
 *     so the user gets feedback that the click was received and
 *     deliberately rejected (otherwise a no-op feels broken).
 *   - The check() loop's 60s stale auto-hide is skipped entirely.
 *   - The pill's cursor switches to 'wait' and the title appendage
 *     changes from "— click to dismiss" to "— operation in progress"
 *     so the affordance matches reality.
 *
 * When idle:
 *   - Click hides the pill (same as v158).
 *   - 60s stale hides the pill (same as v158).
 *   - cursor:pointer, title appendage reads "— click to dismiss".
 *
 * Escape hatch
 * ------------
 *   localStorage.antcvStaleStatusForceDismissible = '1'
 *     → restores v158 behaviour (unconditional dismiss + auto-hide)
 */
(function () {
  'use strict';

  const SCRIPT_VERSION = '1.40.339-h';
  const PILL_SELECTOR = '[title^="Live status from the current operation"]';
  const STALE_MS_DEFAULT = 60 * 1000;
  const POLL_MS = 1000;

  if (window.__antcvStaleStatusInstalled === SCRIPT_VERSION) return;
  window.__antcvStaleStatusInstalled = SCRIPT_VERSION;

  function staleMs() {
    // Override via localStorage.antcvStaleStatusMs = "30000"
    try {
      const raw = localStorage.getItem('antcvStaleStatusMs');
      if (raw) {
        const n = parseInt(raw, 10);
        if (Number.isFinite(n) && n >= 1000 && n <= 600000) return n;
      }
    } catch (_) {}
    return STALE_MS_DEFAULT;
  }

  function forceDismissible() {
    try {
      const v = localStorage.getItem('antcvStaleStatusForceDismissible');
      return v === '1' || v === 'true';
    } catch (_) { return false; }
  }

  // Bug-8 core: is the app currently running an LLM operation whose
  // progress the pill is reporting? Be permissive about how the busy
  // signal is exposed — any of these channels counts.
  function isBusy() {
    if (forceDismissible()) return false;
    try {
      if (window._antcvKernelBusy) return true;
      if (window._antcvConsensusBusy) return true;
      if (window.AntcvKernel && window.AntcvKernel.busy) return true;
      if (window._antcvGenerating) return true;
    } catch (_) {}
    return false;
  }

  // Inject the flash style once (used as visual click-rejection feedback).
  function injectFlashStyle() {
    if (document.getElementById('antcv-stale-status-style')) return;
    const st = document.createElement('style');
    st.id = 'antcv-stale-status-style';
    st.textContent =
      '@keyframes antcv-stale-status-flash{' +
        '0%,100%{box-shadow:0 0 0 0 rgba(1,183,187,0)}' +
        '40%{box-shadow:0 0 0 4px rgba(255,180,30,0.55)}' +
      '}' +
      '.antcv-status-busy-flash{' +
        'animation:antcv-stale-status-flash 600ms ease-out;' +
        'border-radius:6px;' +
      '}';
    try { document.head.appendChild(st); } catch (_) {}
  }
  injectFlashStyle();

  // Track text + last-change-time + last-known dismissibility per pill.
  const seen = new WeakMap();

  function syncAffordance(pill, busy) {
    // Cursor + title appendage track busy/idle so the pill's affordance
    // matches what a click will actually do.
    const baseTitle = (pill.title || '').replace(/ — click to dismiss$/, '')
                                       .replace(/ — operation in progress$/, '');
    if (busy) {
      pill.style.cursor = 'wait';
      if (!/ — operation in progress$/.test(pill.title)) {
        pill.title = baseTitle + ' — operation in progress';
      }
    } else {
      pill.style.cursor = 'pointer';
      if (!/ — click to dismiss$/.test(pill.title)) {
        pill.title = baseTitle + ' — click to dismiss';
      }
    }
  }

  function check() {
    const pill = document.querySelector(PILL_SELECTOR);
    if (!pill) return;
    const cur = (pill.textContent || '').trim();
    const now = Date.now();
    const busy = isBusy();

    let rec = seen.get(pill);
    if (!rec) {
      rec = { text: cur, since: now, hidden: false };
      seen.set(pill, rec);
      attachClickToDismiss(pill);
    }

    // Affordance sync runs every tick — cheap, and the busy flag can
    // flip at any time.
    syncAffordance(pill, busy);

    if (cur !== rec.text) {
      rec.text = cur;
      rec.since = now;
      // Text changed — restore visibility (covers the case where a
      // previously stale-hidden pill comes back with new content).
      if (rec.hidden) {
        pill.style.removeProperty('display');
        rec.hidden = false;
      }
      return;
    }

    // Same text — check elapsed. Bug-8 fix: never auto-hide while
    // an LLM operation is in flight, even if the text hasn't changed
    // in over a minute (long-running kernel/consensus calls).
    if (!rec.hidden && !busy && (now - rec.since) > staleMs()) {
      pill.style.setProperty('display', 'none', 'important');
      rec.hidden = true;
    }
  }

  function attachClickToDismiss(pill) {
    if (pill.dataset.antcvStaleDismissAttached === '1') return;
    pill.addEventListener('click', function () {
      if (isBusy()) {
        // Bug-8 fix: refuse to hide while operation is in flight.
        // Flash the pill so the user knows the click was received.
        try {
          pill.classList.remove('antcv-status-busy-flash');
          // Force reflow so re-adding the class restarts the animation.
          void pill.offsetWidth;
          pill.classList.add('antcv-status-busy-flash');
          setTimeout(function () {
            try { pill.classList.remove('antcv-status-busy-flash'); } catch (_) {}
          }, 700);
        } catch (_) {}
        try { console.info('[antcv-stale-status] dismiss ignored — operation in progress'); } catch (_) {}
        return;
      }
      pill.style.setProperty('display', 'none', 'important');
      const rec = seen.get(pill);
      if (rec) rec.hidden = true;
    });
    pill.dataset.antcvStaleDismissAttached = '1';
  }

  // Poll every POLL_MS — cheap, no MutationObserver needed since
  // the pill's text is what we watch (and we don't care about
  // remount because the WeakMap handles freshly-rendered pills).
  setInterval(check, POLL_MS);
  // Also tick once at boot.
  check();

  // Test/debug API
  window.AntcvStaleStatus = {
    version: SCRIPT_VERSION,
    _check: check,
    _staleMs: staleMs,
    _isBusy: isBusy,
    _seen: seen,
    PILL_SELECTOR: PILL_SELECTOR,
  };

  try { console.info('[antcv-stale-status] installed (v=' + SCRIPT_VERSION + ')'); } catch (_) {}
})();
