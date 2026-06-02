/* AntCV top-bar tools relocation (v1.40.347)
 * ============================================================================
 *
 * Consolidates floating corner FABs into the top bar's tools container, and
 * fixes a stuck-visible JD FAB.
 *
 * User spec
 * ---------
 *   1. Move the Privacy LED button into the top bar.
 *   2. Move the "Document export" button into the top bar.
 *   3. The redundant JD-analysis FAB is still visible even though the
 *      analysis-merge sidecar flagged it hidden — re-assert the hide.
 *
 * Anchors (verified against live app.js + DOM)
 * --------------------------------------------
 *   Top-bar tools container : .antcv-top-tools   (flex row, gap 4, in the
 *                              top bar right after the AntCV title block)
 *   Privacy FAB             : button[data-antcv-privacy-led-fab="1"]
 *   Document-export FAB     : #antcv-pdf-preview-fab
 *   JD FAB (retire)         : button[data-antcv-recheck-fab="1"]
 *
 * Why the JD FAB was still showing
 * --------------------------------
 * antcv-analysis-merge-344 set data-antcv-recheck-fab-hidden="1" + aria-hidden
 * + tabindex once, then early-returned on subsequent sweeps. But the overlay
 * re-creates / re-styles the FAB (its inline style was reset to ""), so the
 * one-shot display:none was wiped and never re-applied. Here we re-assert
 * display:none every sweep, unconditionally, so it stays hidden.
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

  var SCRIPT_VERSION = '1.40.347';
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
    el.style.setProperty('height', '28px', 'important');
    el.style.setProperty('min-width', '28px', 'important');
    el.style.setProperty('padding', '0 6px', 'important');
    el.style.setProperty('font-size', '13px', 'important');
    el.style.setProperty('display', 'inline-flex', 'important');
    el.style.setProperty('align-items', 'center', 'important');
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
    }

    // 2) Document-export -> top tools
    var doc = document.querySelector(DOCEXPORT_SEL);
    if (doc && doc.getAttribute(MOVED_ATTR) !== '1') {
      try {
        styleDocExportForTopbar(doc);
        tools.appendChild(doc); // rightmost
        doc.setAttribute(MOVED_ATTR, '1');
      } catch (_) {}
    } else if (doc && doc.parentNode !== tools) {
      try { styleDocExportForTopbar(doc); tools.appendChild(doc); } catch (_) {}
    }
  }

  // Re-assert the JD FAB hide every sweep (the one-shot hide in -344 gets
  // wiped when the overlay re-styles the FAB).
  function hideJdFab() {
    var jd = document.querySelector(JD_SEL);
    if (!jd) return;
    jd.style.setProperty('display', 'none', 'important');
    jd.setAttribute('aria-hidden', 'true');
    jd.setAttribute('tabindex', '-1');
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      try { relocate(); } catch (_) {}
      try { hideJdFab(); } catch (_) {}
    });
  }

  schedule();
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
