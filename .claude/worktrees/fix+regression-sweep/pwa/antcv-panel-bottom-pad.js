/* AntCV side-panel height-cap sidecar (v1.40.145)
 * ============================================================
 * Replaces v1.40.143's padding-injection approach. That sidecar
 * pushed visible gaps between section group headers (Cand.,
 * SIDEBAR) and their child rows (Name / Specialisation / Contact;
 * TOOLS & METHODS / CERTIFICATIONS / EDUCATION / PUBLICATIONS),
 * which Gabriel flagged in v1.40.144 testing. The real fix is
 * different: cap the PANEL ITSELF so its bottom edge sits above
 * the fixed bottom-nav pill bar.
 *
 * Geometry from app.js:
 *   - Panel: .antcv-editor-side-panel; on desktop it's a flex
 *     child with `overflow:hidden`, no height/bottom constraint —
 *     so it stretches to fill the flex parent which is full vh.
 *   - Pill bar: .antcv-react-bottom-nav; `position:fixed;
 *     bottom:12px (or env(safe-area-inset-bottom))` — it overlays
 *     the panel's bottom edge from below.
 *
 * Strategy:
 *   1. Measure panel.getBoundingClientRect().top
 *   2. Measure pill.getBoundingClientRect().top
 *   3. Set panel.style.maxHeight = (pill.top - panel.top - GAP)
 *   4. Re-run on: window resize, visualViewport resize (catches
 *      browser zoom), MutationObserver re-renders, and a low-rate
 *      polling interval as belt-and-braces for zoom on engines
 *      that don't fire visualViewport.resize.
 *
 * Skips: mobile panel (already constrained via inline
 * `position:fixed; bottom:80; maxHeight:33dvh`); preview panel.
 *
 * IMPORTANT: also removes the v1.40.143 CSS that padded the
 * panel's children. That stylesheet was the source of the
 * inter-section gaps.
 */
(function () {
  'use strict';

  const SCRIPT_VERSION = '1.40.145';
  const STYLE_ID_LEGACY = 'antcv-panel-bottom-pad-styles';
  const PANEL_SEL = '.antcv-editor-side-panel';
  const PILL_SEL = '.antcv-react-bottom-nav';
  const APPLIED_FLAG = 'antcvPanelHeightCapped';
  const GAP_PX = 14;          // visual breathing room between panel bottom and pill top
  const MIN_PANEL_PX = 120;   // never collapse below this — keep the panel usable
  const POLL_INTERVAL_MS = 750;
  const SAFE_RETRY_MS = [0, 200, 600, 1500];

  if (window.__antcvPanelHeightCapInstalled) return;
  window.__antcvPanelHeightCapInstalled = SCRIPT_VERSION;

  // Remove the legacy v1.40.143 stylesheet if it was injected by a
  // previous build that's still cached in the SW. New ships ship
  // without that <style> tag, but during the rolling SW migration
  // we may inherit it.
  function removeLegacyStyles() {
    const legacy = document.getElementById(STYLE_ID_LEGACY);
    if (legacy && legacy.parentNode) legacy.parentNode.removeChild(legacy);
  }

  // Compute and apply the maxHeight constraint. Idempotent —
  // skips assignment when the value hasn't changed.
  function relayout() {
    removeLegacyStyles();
    const panel = document.querySelector(PANEL_SEL);
    const pill = document.querySelector(PILL_SEL);
    if (!panel) return;
    // Mobile panel is already constrained — leave it alone.
    const isMobilePanel = panel.getAttribute('data-antcv-app-panel') === 'mobile-bottom-panel';
    if (isMobilePanel) return;

    if (!pill) {
      // No pill bar in DOM — clear our cap if we previously set one.
      if (panel.dataset[APPLIED_FLAG]) {
        panel.style.maxHeight = '';
        delete panel.dataset[APPLIED_FLAG];
      }
      return;
    }

    const panelRect = panel.getBoundingClientRect();
    const pillRect  = pill.getBoundingClientRect();

    // Skip if either rect is uninitialised (zero-sized — likely
    // during mount or display:none).
    if (panelRect.width === 0 || pillRect.width === 0) return;

    // The panel's bottom should sit at most at (pillTop - GAP).
    const maxBottom = pillRect.top - GAP_PX;
    const desiredHeight = Math.max(MIN_PANEL_PX, maxBottom - panelRect.top);
    const newMaxHeight = Math.round(desiredHeight) + 'px';

    if (panel.style.maxHeight !== newMaxHeight) {
      panel.style.maxHeight = newMaxHeight;
      panel.dataset[APPLIED_FLAG] = '1';
    }
  }

  // Run a few times early — the panel may not yet be in the DOM
  // when this script first executes, and the pill bar mounts
  // separately.
  SAFE_RETRY_MS.forEach(function (delay) {
    if (delay === 0) relayout();
    else setTimeout(relayout, delay);
  });

  // React to viewport changes. window.resize fires on both window
  // resizes AND browser zoom on most engines; visualViewport.resize
  // is the more reliable source for zoom on Chrome / mobile.
  window.addEventListener('resize', relayout, { passive: true });
  window.addEventListener('orientationchange', relayout, { passive: true });
  if (window.visualViewport && typeof window.visualViewport.addEventListener === 'function') {
    window.visualViewport.addEventListener('resize', relayout, { passive: true });
    window.visualViewport.addEventListener('scroll', relayout, { passive: true });
  }

  // MutationObserver catches the panel mounting/unmounting on tab
  // switch (sections ↔ analysis ↔ edit). Attribute filtering
  // catches React re-renders that mutate style/class without
  // adding nodes.
  try {
    const mo = new MutationObserver(function () { relayout(); });
    mo.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'data-antcv-app-panel'],
    });
  } catch (_) {
    // older engines without MutationObserver: rely on the polling
    // interval below.
  }

  // Polling fallback — cheap (one getBoundingClientRect per
  // panel + pill per tick) and guarantees correctness even when
  // resize/visualViewport events don't fire on a particular zoom
  // gesture or when React swaps the panel without our observer
  // catching the style change.
  setInterval(relayout, POLL_INTERVAL_MS);
})();
