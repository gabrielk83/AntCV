/* AntCV top-bar tools relocation (v1.40.347)
 * ============================================================================
 *
 * Consolidates floating corner FABs into the top bar's tools container, and
 * retires the redundant JD-analysis FAB.
 *
 * User spec
 * ---------
 *   1. Move the Privacy LED button into the top bar.
 *   2. Move the "Document export" button into the top bar.
 *   3. The redundant JD-analysis FAB must be removed entirely (not just
 *      hidden) — detach it from the DOM every sweep.
 *
 * Anchors (verified against live app.js + DOM)
 * --------------------------------------------
 *   Top-bar tools container : .antcv-top-tools   (flex row, gap 4, in the
 *                              top bar right after the AntCV title block)
 *   Privacy FAB             : button[data-antcv-privacy-led-fab="1"]
 *   Document-export FAB     : #antcv-pdf-preview-fab
 *   JD FAB (retire)         : button[data-antcv-recheck-fab="1"]
 *
 * Why the JD FAB needed full removal
 * ----------------------------------
 * antcv-analysis-merge-344 set data-antcv-recheck-fab-hidden="1" + aria-hidden
 * + tabindex once, then early-returned on subsequent sweeps. The overlay
 * re-creates / re-styles the FAB (its inline style was reset to ""), so any
 * one-shot display:none was wiped and never re-applied — the button kept
 * flickering back into view. Hiding is not enough; we now REMOVE the node
 * from the DOM every sweep so it cannot re-surface.
 *
 * Approach
 * --------
 * DOM-injection sidecar. Each sweep: ensure the top-tools container exists,
 * then RE-PARENT the privacy + document-export buttons into it (once),
 * neutralising their position:fixed with inline top-bar styling. Re-parenting
 * is safe: we keep the original elements (so their own click handlers and
 * state survive) and only change their parent + positioning. If app.js
 * re-renders the top bar and drops them, the next sweep re-homes them.
 *
 * The Document-export button keeps its own visibility gate (it shows only
 * when a document preview is on screen) — we deliberately do NOT set its
 * display here, so antcv-pdf-preview-gate's syncFabVisibility stays in
 * control. We only set position + compact sizing.
 *
 * No app.js / React-island edits.
 */
(function () {
  'use strict';

  var SCRIPT_VERSION = '1.51.178-mobile-skip-relocate';
  if (window.__antcvTopbarTools347 === SCRIPT_VERSION) return;
  window.__antcvTopbarTools347 = SCRIPT_VERSION;

  var TOOLS_SEL = '.antcv-top-tools';
  var PRIVACY_SEL = 'button[data-antcv-privacy-led-fab="1"]';
  var DOCEXPORT_SEL = '#antcv-pdf-preview-fab';
  var JD_SEL = 'button[data-antcv-recheck-fab="1"]';
  var MOVED_ATTR = 'data-antcv-topbar-moved';

  // Override a FAB's position:fixed so it sits inline in the top-bar tools row.
  function neutralizeFixed(el) {
    el.style.setProperty('position', 'static', 'important');
    el.style.setProperty('bottom', 'auto', 'important');
    el.style.setProperty('top', 'auto', 'important');
    el.style.setProperty('left', 'auto', 'important');
    el.style.setProperty('right', 'auto', 'important');
    el.style.setProperty('margin', '0', 'important');
    el.style.setProperty('box-shadow', 'none', 'important');
    el.style.setProperty('z-index', 'auto', 'important');
  }

  // Compact top-bar sizing for the privacy LED (small icon button).
  function stylePrivacyForTopbar(el) {
    neutralizeFixed(el);
    // PRIVACY-FAB-FLICKER-MOBILE-001 (1.50.356): the islands PreviewToolbar
    // hides the NOT-YET-MOVED privacy FAB with an inline !important triple
    // (display/visibility/pointer-events) — its dedup for the corner copy.
    // When it wins the race before our relocation, that inline hide sticks:
    // inline !important beats the stylesheet visibility lock, and the islands
    // never unhide a moved pill (it only EXEMPTS it). Clear the triple on
    // every sweep; once data-antcv-topbar-moved=1 the islands leave it alone.
    el.style.removeProperty('display');
    el.style.removeProperty('visibility');
    el.style.removeProperty('pointer-events');
    el.style.setProperty('height', '28px', 'important');
    el.style.setProperty('min-width', '28px', 'important');
    el.style.setProperty('padding', '0 6px', 'important');
    el.style.setProperty('font-size', '13px', 'important');
    el.style.setProperty('align-items', 'center', 'important');
    // v1.50.84 — visibility is now forced by a passive CSS !important rule
    // (injectPrivacyVisibilityCss), NOT re-asserted here every sweep. The old
    // per-sweep display/visibility/opacity writes fought the islands
    // PreviewToolbar's periodic inline hide -> a ping-pong that mutated the
    // FAB's style ~29/sec = the privacy "blip". CSS wins passively, no JS
    // counter-write, no blip.
    if (el.hasAttribute('aria-hidden')) el.removeAttribute('aria-hidden');
  }

  // Passive visibility lock for the relocated privacy pill — beats the island's
  // non-important inline display:none/visibility:hidden without any JS sweep.
  function injectPrivacyVisibilityCss() {
    if (document.getElementById('antcv-topbar-tools-347-css')) return;
    var s = document.createElement('style');
    s.id = 'antcv-topbar-tools-347-css';
    s.textContent = 'button[data-antcv-privacy-led-fab="1"][' + MOVED_ATTR +
      '="1"]{display:inline-flex!important;visibility:visible!important;opacity:1!important;}';
    (document.head || document.documentElement).appendChild(s);
  }

  // Compact top-bar sizing for the Document-export button (icon + short text).
  function styleDocExportForTopbar(el) {
    neutralizeFixed(el);
    el.style.setProperty('height', '28px', 'important');
    el.style.setProperty('padding', '0 10px', 'important');
    el.style.setProperty('font-size', '11px', 'important');
    el.style.setProperty('border-radius', '14px', 'important');
    // NOTE: do NOT set display here. The gate in antcv-pdf-preview-gate
    // (syncFabVisibility) owns display — it shows the button only when a
    // document preview is on screen. Setting display here would fight that
    // gate every sweep. We set only the inline-layout helpers that apply
    // when the gate shows it.
    el.style.setProperty('align-items', 'center', 'important');
    el.style.setProperty('gap', '5px', 'important');
    // Shrink the SVG icon a touch for the smaller button.
    var svg = el.querySelector('svg');
    if (svg) {
      svg.style.setProperty('width', '13px', 'important');
      svg.style.setProperty('height', '13px', 'important');
    }
  }

  function relocate() {
    var tools = document.querySelector(TOOLS_SEL);
    if (!tools) return; // top bar not mounted yet

    // 1) Privacy LED -> top tools
    var privacy = document.querySelector(PRIVACY_SEL);
    if (privacy && privacy.getAttribute(MOVED_ATTR) !== '1') {
      try {
        stylePrivacyForTopbar(privacy);
        tools.insertBefore(privacy, tools.firstChild); // leftmost in the tools row
        privacy.setAttribute(MOVED_ATTR, '1');
      } catch (_) {}
    } else if (privacy && privacy.parentNode !== tools) {
      // app.js / overlay re-homed it back to the corner; pull it back.
      try { stylePrivacyForTopbar(privacy); tools.insertBefore(privacy, tools.firstChild); } catch (_) {}
    } else if (privacy) {
      // v1.50.58 — already in the tools row: re-assert styling+visibility every
      // sweep so the islands PreviewToolbar's periodic viewport-hide cannot
      // blank the pill under 900px.
      try { stylePrivacyForTopbar(privacy); } catch (_) {}
    }

    // 2) Document-export -> top tools
    // MOBILE-TOPBAR-EXPORT-FAB-001 (owner 2026-07-05, live phone report):
    // on a narrow viewport the topbar row (EN/Unsolicited dropdowns, title,
    // icons, THIS relocated FAB) doesn't fit at 100% zoom. Skip the
    // relocation on mobile so the FAB stays in its own natural floating spot
    // (antcv-pdf-preview-gate's own CSS: left:16px, bottom:100px — opposite
    // side from the Ask AI / mobile-export-fab launchers, no collision). If
    // a prior desktop session already relocated it before a resize to
    // mobile, move it back out.
    var doc = document.querySelector(DOCEXPORT_SEL);
    var isMobileWidth = (window.innerWidth || 0) <= 900;
    if (isMobileWidth) {
      if (doc && doc.getAttribute(MOVED_ATTR) === '1') {
        try {
          doc.style.cssText = '';
          doc.removeAttribute(MOVED_ATTR);
          (document.body || document.documentElement).appendChild(doc);
        } catch (_) {}
      }
    } else if (doc && doc.getAttribute(MOVED_ATTR) !== '1') {
      try {
        styleDocExportForTopbar(doc);
        tools.appendChild(doc); // rightmost
        doc.setAttribute(MOVED_ATTR, '1');
      } catch (_) {}
    } else if (doc && doc.parentNode !== tools) {
      try { styleDocExportForTopbar(doc); tools.appendChild(doc); } catch (_) {}
    }
  }

  // Retire the JD-analysis FAB completely. display:none was not enough —
  // the overlay re-styles the FAB and wiped the one-shot hide, so it kept
  // reappearing. Remove the node from the DOM every sweep so it cannot
  // re-surface. (If the overlay re-creates it on a later render, the next
  // sweep removes the fresh copy.)
  function removeJdFab() {
    var jd = document.querySelector(JD_SEL);
    if (!jd) return;
    try {
      if (jd.parentNode) jd.parentNode.removeChild(jd);
    } catch (_) {
      // Fallback: if removal is blocked for any reason, hard-hide it.
      try {
        jd.style.setProperty('display', 'none', 'important');
        jd.setAttribute('aria-hidden', 'true');
        jd.setAttribute('tabindex', '-1');
      } catch (__) {}
    }
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      try { relocate(); } catch (_) {}
      try { removeJdFab(); } catch (_) {}
    });
  }

  schedule();
  injectPrivacyVisibilityCss();
  [200, 600, 1500, 3000].forEach(function (d) { setTimeout(schedule, d); });

  try {
    new MutationObserver(schedule).observe(document.body || document.documentElement, {
      childList: true, subtree: true,
    });
  } catch (_) {}

  window.addEventListener('antcv:sections-updated', schedule);

  window.AntcvTopbarTools347 = { version: SCRIPT_VERSION, sweep: schedule };

  try { console.debug('[topbar-tools-347] installed v' + SCRIPT_VERSION); } catch (_) {}
})();
