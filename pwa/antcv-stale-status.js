/* AntCV stale-status sidecar (v1.40.158)
 * ============================================================
 *
 * Symptom
 * -------
 * After CV generation completes, the live-status pill (the
 * cyan/blue pulsing toast that says e.g. "🔎 Tightening to length
 * targets…") sometimes stays visible forever in the editor. The
 * user is just editing, no LLM operation is running, and the pill
 * insists otherwise.
 *
 * Root cause
 * ----------
 * In app.js's post-generate tightening block, the catch/success
 * paths both clear the per-section status (`fo({profile:"done"…})`)
 * but neither calls `uo("")` to clear the global live-status text.
 * The pill's render predicate is `po && po.trim() && !Pl &&
 * "generating" !== Nt`, so once Nt switches to "editor", the
 * stale `po` still satisfies the condition and the pill keeps
 * showing.
 *
 * Fix (sidecar)
 * -------------
 * App.js's `po` state is internal React state we can't mutate
 * from outside. What we CAN do is:
 *
 *   - Watch the rendered pill (it carries a `title` attribute
 *     starting "Live status from the current operation").
 *   - Track when the pill's text last changed.
 *   - If the text has been the same for ≥ STALE_MS (default 60s),
 *     hide the pill via `display: none` (CSS-only, doesn't touch
 *     React state).
 *   - When the text changes again, restore visibility.
 *   - Make the pill click-to-dismiss too — clicking it hides it
 *     until the next text change.
 *
 * This is a cosmetic patch — the underlying state in app.js stays
 * as it was; we just stop showing the user a stuck banner. A
 * proper fix would add `uo("")` to the tightening block's catch
 * AND success paths.
 */
(function () {
  'use strict';

  const SCRIPT_VERSION = '1.40.158';
  const PILL_SELECTOR = '[title^="Live status from the current operation"]';
  const STALE_MS_DEFAULT = 60 * 1000;
  const POLL_MS = 1000;

  if (window.__antcvStaleStatusInstalled) return;
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

  // Track text + last-change-time per pill element.
  const seen = new WeakMap();

  function check() {
    const pill = document.querySelector(PILL_SELECTOR);
    if (!pill) return;
    const cur = (pill.textContent || '').trim();
    const now = Date.now();

    let rec = seen.get(pill);
    if (!rec) {
      rec = { text: cur, since: now, hidden: false };
      seen.set(pill, rec);
      attachClickToDismiss(pill);
    }

    if (cur !== rec.text) {
      rec.text = cur;
      rec.since = now;
      // Text changed — show again
      if (rec.hidden) {
        pill.style.removeProperty('display');
        rec.hidden = false;
      }
      return;
    }

    // Same text — check elapsed
    if (!rec.hidden && (now - rec.since) > staleMs()) {
      pill.style.setProperty('display', 'none', 'important');
      rec.hidden = true;
    }
  }

  function attachClickToDismiss(pill) {
    if (pill.dataset.antcvStaleDismissAttached === '1') return;
    pill.style.cursor = 'pointer';
    if (!pill.title || pill.title.indexOf('— click to dismiss') < 0) {
      pill.title = pill.title + ' — click to dismiss';
    }
    pill.addEventListener('click', function () {
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
    _seen: seen,
    PILL_SELECTOR: PILL_SELECTOR,
  };
})();
