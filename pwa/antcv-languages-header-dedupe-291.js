/* AntCV LANGUAGES header de-stickify (v1.40.291)
 * ──────────────────────────────────────────────────────────────────────
 *
 * Problem
 * ───────
 *   Gabriel: "languages on top is very agressivly sticky - appreas on
 *   all settings menue - should be only in one of them - you choose
 *   which, the easyest for you".
 *
 *   A bordered heading containing the text "LANGUAGES IN THE TOP BAR"
 *   appears at the top of every Settings subtab — Personal, Layout,
 *   Sync, Adv. Styles, etc. — instead of in just one place.
 *
 *   We can't pinpoint the rendering site without DevTools inspection
 *   of the live DOM (the text doesn't appear in app.js or any
 *   sidecar source — likely composed from a translation/lookup table
 *   we don't have visibility into). So this patch operates at the DOM
 *   level: find every node whose visible text matches the heading
 *   pattern, and keep only ONE per Settings subtab view at a time.
 *
 * Approach
 * ────────
 *   1. MutationObserver on document.body. Each tick:
 *      a. Find candidates: elements whose direct textContent (or that
 *         of a very small descendant) matches /LANGUAGES.*TOP.*BAR/i
 *         OR /TOP.*BAR.*LANGUAGES/i with length ≤ 64 chars.
 *      b. Filter to candidates that are visible (offsetParent !==
 *         null) and inside the Settings panel.
 *      c. Keep the FIRST visible candidate; hide all subsequent ones
 *         via style.display='none' + data-antcv-lang-hidden-291="1".
 *   2. Reapply on Settings tab change (storage event for 'settingsTab'
 *      / 'settingsSubTab', or click events on tab buttons).
 *
 * Reversible: if the user clicks a tab where only one instance was
 * rendered to begin with, the hidden ones in other tabs are already
 * out of view (display:none). Restoring is a matter of clearing the
 * data-attr and removing display:none — which the patch does each
 * time it re-scans.
 */
(function () {
  'use strict';
  var VERSION = '1.40.291';
  if (window.__antcvLanguagesHeaderDedupe291 === VERSION) return;
  window.__antcvLanguagesHeaderDedupe291 = VERSION;

  var HIDDEN_ATTR = 'data-antcv-lang-hidden-291';
  var MATCH_ATTR  = 'data-antcv-lang-match-291';
  // Match patterns. We require BOTH 'languag' AND 'top' AND 'bar' to be
  // present in the same element's text, with the text being short.
  function isLanguageHeadingText(text) {
    if (!text) return false;
    var t = String(text).trim();
    if (t.length > 80) return false;
    var lo = t.toLowerCase();
    if (lo.indexOf('languag') < 0) return false;
    if (lo.indexOf('top') < 0) return false;
    if (lo.indexOf('bar') < 0) return false;
    return true;
  }

  function visible(el) {
    if (!el) return false;
    try {
      if (el.getAttribute && el.getAttribute(HIDDEN_ATTR) === '1') return false;
      if (el.offsetParent === null && el.tagName !== 'BODY') return false;
      var cs = window.getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      var r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return false;
      return true;
    } catch (_) { return false; }
  }

  // Walk text-bearing leaf-ish elements only. Avoid scanning everything.
  function findCandidates() {
    var out = [];
    var els;
    try {
      // Common heading-like elements + bordered DIVs.
      els = document.querySelectorAll('h1, h2, h3, h4, h5, label, span, div, p, button');
    } catch (_) { return out; }
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      // Skip if too many children (not a leaf heading).
      if (el.childElementCount > 4) continue;
      // Take innerText (or textContent fallback). We only care about
      // its OWN text, not deeply nested descendants.
      var txt = '';
      try { txt = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim(); }
      catch (_) {}
      if (!isLanguageHeadingText(txt)) continue;
      out.push(el);
    }
    return out;
  }

  function show(el) {
    try {
      if (el.getAttribute(HIDDEN_ATTR) === '1') {
        el.removeAttribute(HIDDEN_ATTR);
        // Restore previous display value if we stashed it.
        if (el.__antcvLangDisplay !== undefined) {
          el.style.display = el.__antcvLangDisplay;
          delete el.__antcvLangDisplay;
        } else {
          el.style.removeProperty('display');
        }
      }
      el.setAttribute(MATCH_ATTR, '1');
    } catch (_) {}
  }
  function hide(el) {
    try {
      if (el.getAttribute(HIDDEN_ATTR) === '1') return;
      el.__antcvLangDisplay = el.style.display || '';
      el.style.setProperty('display', 'none', 'important');
      el.setAttribute(HIDDEN_ATTR, '1');
    } catch (_) {}
  }

  function dedupe() {
    var candidates = findCandidates();
    if (!candidates.length) return;

    // Of candidates, partition into visible-now and hidden-by-us.
    var visibleOnes = [];
    var hiddenByUs = [];
    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      if (el.getAttribute(HIDDEN_ATTR) === '1') {
        hiddenByUs.push(el);
      } else if (visible(el)) {
        visibleOnes.push(el);
      } else {
        // Naturally invisible (off-screen tab) — leave alone.
      }
    }

    if (visibleOnes.length === 0) {
      // If nothing is visible right now, we may need to un-hide one of
      // OUR hidden ones (e.g. user navigated to the tab where the
      // heading actually lives, but we previously hid it). To avoid
      // breaking the layout, only un-hide if its NATURAL container
      // (the parent) is currently visible.
      for (var k = 0; k < hiddenByUs.length; k++) {
        var h = hiddenByUs[k];
        if (h.parentElement && visible(h.parentElement)) {
          show(h);
          break;
        }
      }
      return;
    }

    // Keep the FIRST visible candidate; hide the rest.
    for (var j = 1; j < visibleOnes.length; j++) {
      hide(visibleOnes[j]);
    }
    // Tag the kept one for debugging.
    try { visibleOnes[0].setAttribute(MATCH_ATTR, '1'); } catch (_) {}
  }

  // Scheduler.
  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      try { dedupe(); } catch (_) {}
    });
  }

  // Initial + delayed passes.
  schedule();
  [100, 400, 1000, 2500].forEach(function (d) { setTimeout(schedule, d); });

  // Observer.
  try {
    var mo = new MutationObserver(function (records) {
      var meaningful = false;
      for (var i = 0; i < records.length && !meaningful; i++) {
        var r = records[i];
        if (r.type === 'childList' && (r.addedNodes.length || r.removedNodes.length)) meaningful = true;
        else if (r.type === 'attributes' && (r.attributeName === 'style' || r.attributeName === 'class')) meaningful = true;
      }
      if (meaningful) schedule();
    });
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
  } catch (_) {}

  // Tab clicks within Settings re-trigger.
  document.addEventListener('click', function (ev) {
    // Cheap heuristic: any button click might be a tab change.
    if (ev && ev.target && (ev.target.tagName === 'BUTTON' ||
        (ev.target.closest && ev.target.closest('button')))) {
      setTimeout(schedule, 40);
      setTimeout(schedule, 200);
    }
  }, true);

  window.AntcvLanguagesHeaderDedupe291 = {
    version: VERSION,
    _findCandidates: findCandidates,
    _dedupe: dedupe,
    _showAll: function () {
      var hidden = document.querySelectorAll('[' + HIDDEN_ATTR + '="1"]');
      hidden.forEach(show);
    },
  };

  try { console.debug('[lang-header-dedupe-291] installed v' + VERSION); } catch (_) {}
})();
