/* AntCV Application-History dropdown z-fix (v1.40.291)
 * ──────────────────────────────────────────────────────────────────────
 *
 * Problem
 * ───────
 * The Application History dropdown (the panel that opens when the
 * "Application history" topbar button is clicked) renders at
 * z-index 1500 with position:absolute, anchored to a position:relative
 * parent inside the topbar.
 *
 * The preview vertical slider (.antcv-preview-v-slider) is rendered
 * with position:fixed and z-index 2490 (and the bottom nav at 2500).
 * As fixed-positioned siblings in the document's root stacking
 * context, the slider paints OVER the dropdown's right edge.
 *
 * Two visible symptoms (Gabriel's report):
 *   1. "The pop is behind the vertical roller" — the slider's pill
 *      obscures the right portion of the dropdown, including the
 *      area where "Open in Settings" sits.
 *   2. "Open in Settings does not open" — pointer events in the
 *      overlap region are captured by the slider's hit area, not
 *      the button underneath. The onClick never fires.
 *
 * Both symptoms have the same cause: the dropdown is paint-order
 * behind a higher z-index sibling. No edit to the slider, the
 * button's click handler, or the modal-open path is required.
 *
 * Fix
 * ───
 * A MutationObserver on document.body watches for elements being
 * added with inline style z-index:1500 (the dropdown's signature)
 * and inline style z-index:1499 (the dropdown's full-viewport
 * dismissal overlay, which lives one stacking layer below it). When
 * either appears, the sidecar bumps the inline style:
 *
 *   dropdown:  z-index 1500 → 9001  (above slider's 2490 and bottom
 *                                    nav's 2500)
 *   overlay:   z-index 1499 → 9000  (just below dropdown; keeps the
 *                                    click-outside-to-close semantics)
 *
 * On dropdown close React unmounts both elements; nothing to revert.
 * If the dropdown reopens, the observer fires again. No interval, no
 * polling.
 *
 * Why MutationObserver, not CSS
 * ─────────────────────────────
 * A CSS rule with !important targeting [style*="z-index:1500"] would
 * also work in theory, but inline z-index is set as a number by React,
 * and the rendered DOM serialisation varies between browsers (some
 * include a space, some don't, some omit the unit). The observer
 * matches the parsed style.zIndex property which is reliable across
 * engines. It also lets us identify the overlay sibling structurally
 * rather than relying on a second CSS rule.
 *
 * Safety
 * ──────
 * - z-index 1500 is unique to this dropdown in the bundle (grep
 *   confirmed 1 occurrence). The observer's match condition cannot
 *   false-positive on unrelated elements at the time of writing.
 *   If a future bundle adds another element at 1500, the worst that
 *   happens is that element also gets bumped — visually neutral in
 *   most cases.
 * - The overlay's purpose is to intercept clicks outside the
 *   dropdown and close it. At its new z-index 9000 it still sits
 *   above the slider, so clicks on the slider while the dropdown is
 *   open dismiss the dropdown instead. That is the correct behaviour
 *   for a transient menu — the user is interacting with the menu,
 *   not the slider, during that moment.
 * - Idempotent: re-bumping an already-bumped element is a no-op.
 * - No edit to app.js. Pure sidecar.
 *
 * Diagnostic
 * ──────────
 * Logs each bump at debug level. To verify in production:
 *   - Open Application History.
 *   - Check console for "[app-history-zfix-291] bumped dropdown".
 *   - Click "Open in Settings". The pre-existing
 *     "[v1.40.114 open-in-settings] firing" log will now actually
 *     fire (the click handler reaches the React onClick path).
 */
(function () {
  'use strict';
  var VERSION = '1.40.291';
  if (window.__antcvAppHistoryZFix291 === VERSION) return;
  window.__antcvAppHistoryZFix291 = VERSION;

  // Target z-index of the dropdown after bump. Must exceed the
  // bundle's highest known fixed-position z-index (2500 for the
  // bottom nav). 9001 leaves headroom for future stacking changes
  // without colliding with the 9999 emergency banners.
  var DROPDOWN_NEW_Z = '9001';
  var OVERLAY_NEW_Z = '9000';

  // Markers so we can detect already-processed elements and avoid
  // re-mutating on each MutationRecord.
  var DROPDOWN_MARK = 'data-antcv-zfix-291-dropdown';
  var OVERLAY_MARK = 'data-antcv-zfix-291-overlay';

  function isDropdown(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.tagName !== 'DIV') return false;
    if (el.hasAttribute(DROPDOWN_MARK)) return false;
    var s = el.style;
    if (!s) return false;
    // The dropdown's exact inline-style signature: z-index 1500,
    // position absolute, has overflow-y auto, and has maxHeight set.
    // We check zIndex first (cheapest discriminator), then position
    // to be conservative.
    if (String(s.zIndex) !== '1500') return false;
    if (s.position !== 'absolute') return false;
    return true;
  }

  function isOverlay(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.tagName !== 'DIV') return false;
    if (el.hasAttribute(OVERLAY_MARK)) return false;
    var s = el.style;
    if (!s) return false;
    if (String(s.zIndex) !== '1499') return false;
    if (s.position !== 'fixed') return false;
    // The overlay covers the full viewport: top/left/right/bottom all 0.
    if (s.top !== '0px' && s.top !== '0') return false;
    if (s.left !== '0px' && s.left !== '0') return false;
    return true;
  }

  function bumpDropdown(el) {
    try {
      el.style.zIndex = DROPDOWN_NEW_Z;
      el.setAttribute(DROPDOWN_MARK, '1');
      try {
        console.debug('[app-history-zfix-291] bumped dropdown z-index 1500 -> ' + DROPDOWN_NEW_Z);
      } catch (_) {}
    } catch (e) {
      try { console.warn('[app-history-zfix-291] bump dropdown failed:', e && e.message); } catch (_) {}
    }
  }

  function bumpOverlay(el) {
    try {
      el.style.zIndex = OVERLAY_NEW_Z;
      el.setAttribute(OVERLAY_MARK, '1');
      try {
        console.debug('[app-history-zfix-291] bumped overlay z-index 1499 -> ' + OVERLAY_NEW_Z);
      } catch (_) {}
    } catch (e) {
      try { console.warn('[app-history-zfix-291] bump overlay failed:', e && e.message); } catch (_) {}
    }
  }

  // Process an element and its descendants. The dropdown may be added
  // as a subtree root (most common: React mounts <div>dropdown</div>
  // and we see it as the addedNode directly) or it may be inside a
  // bigger added subtree (e.g. on first render). Walking descendants
  // catches both.
  function processNode(node) {
    if (!node || node.nodeType !== 1) return;
    if (isDropdown(node)) bumpDropdown(node);
    else if (isOverlay(node)) bumpOverlay(node);
    // Scan descendants too. Most adds will be the leaf div itself
    // (depth 0), but a remount of the whole topbar would surface the
    // dropdown a few levels deep. Limit to a reasonable depth via
    // querySelectorAll — it visits the whole subtree which is fine
    // for the small fragments React produces.
    if (typeof node.querySelectorAll === 'function') {
      var candidates = node.querySelectorAll('div[style]');
      for (var i = 0; i < candidates.length; i++) {
        var c = candidates[i];
        if (isDropdown(c)) bumpDropdown(c);
        else if (isOverlay(c)) bumpOverlay(c);
      }
    }
  }

  // Initial sweep in case the dropdown is already open when this
  // sidecar loads (unlikely but defensive).
  function initialSweep() {
    try {
      var existing = document.querySelectorAll('div[style]');
      for (var i = 0; i < existing.length; i++) {
        var c = existing[i];
        if (isDropdown(c)) bumpDropdown(c);
        else if (isOverlay(c)) bumpOverlay(c);
      }
    } catch (_) {}
  }

  function startObserver() {
    if (!document.body) {
      // body not ready yet; defer
      setTimeout(startObserver, 50);
      return;
    }
    initialSweep();

    try {
      var mo = new MutationObserver(function (records) {
        for (var i = 0; i < records.length; i++) {
          var rec = records[i];
          if (rec.type !== 'childList') continue;
          var added = rec.addedNodes;
          if (!added) continue;
          for (var j = 0; j < added.length; j++) {
            processNode(added[j]);
          }
        }
      });
      mo.observe(document.body, { childList: true, subtree: true });
      window.__antcvAppHistoryZFix291Observer = mo;
      try { console.debug('[app-history-zfix-291] installed v' + VERSION + '; observing for dropdown mount.'); } catch (_) {}
    } catch (e) {
      try { console.warn('[app-history-zfix-291] MutationObserver setup failed:', e && e.message); } catch (_) {}
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver, { once: true });
  } else {
    startObserver();
  }
})();
