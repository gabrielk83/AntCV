/* antcv-edit-freeze.js — EDIT-FREEZE-001 (owner 2026-07-14)
 *
 * "sidebar color is still dancing and making things go out of the edit."
 *
 * The inline preview editors commit on blur, and several sidecars re-layout the
 * preview on EVERY DOM mutation (antcv-sidebar-fill-equalize-227 watches
 * characterData, so a single keystroke reflows the sidebar UNDER the caret and
 * knocks the user out of the edit). This sidecar publishes a single source of
 * truth — `window.__antcvEditing` — that those reflow sidecars gate on, so while
 * a preview field is focused the heavy passes are suspended and run once on blur.
 *
 * It only sets a boolean + fires `antcv:edit-freeze-end`; it never touches the
 * DOM or the store, so it cannot itself cause a reflow or data change.
 */
(function () {
  'use strict';
  if (window.__antcvEditFreezeInstalled) return;
  window.__antcvEditFreezeInstalled = true;
  window.__antcvEditing = false;

  // Any span/field the preview makes editable: the app's B editor
  // (data-antcv-editable-text), the results editor, the persist-sidecar's
  // promoted spans (data-antcv-prv-bullets-original), and plain contenteditable.
  var SEL = '[data-antcv-editable-text],[data-antcv-results-edit],[data-antcv-prv-bullets-original],[contenteditable="true"],input,textarea';

  function isEditable(el) {
    try { return !!(el && el.closest && el.closest(SEL)); } catch (_) { return false; }
  }

  var blurTimer = null;

  document.addEventListener('focusin', function (e) {
    if (isEditable(e.target)) {
      if (blurTimer) { clearTimeout(blurTimer); blurTimer = null; }
      window.__antcvEditing = true;
    }
  }, true);

  document.addEventListener('focusout', function (e) {
    if (!isEditable(e.target)) return;
    if (blurTimer) clearTimeout(blurTimer);
    // Small grace so moving focus field -> field (or a transient blur during a
    // keystroke) does not thrash the flag and let a reflow slip through.
    blurTimer = setTimeout(function () {
      blurTimer = null;
      // Only clear if focus really left all editables.
      if (isEditable(document.activeElement)) return;
      window.__antcvEditing = false;
      try { window.dispatchEvent(new Event('antcv:edit-freeze-end')); } catch (_) {}
    }, 140);
  }, true);
})();
