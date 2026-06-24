/* antcv-photo-control-collapse.js — D (owner 2026-06-24)
 *
 * 1) COLLAPSE: the Layout-tab "PROFILE PHOTO" control (position buttons + diameter +
 *    shape/contour/shadow) is tall. Make it expandable/collapsible, COLLAPSED BY
 *    DEFAULT — click the "PROFILE PHOTO" header to expand. State persists in
 *    localStorage 'antcv:photoCtrlOpen' ('1' open, anything else = collapsed).
 *
 * 2) ACCOUNT-TAB LEAK: the owner saw the control "stick" on the Account tab. If more
 *    than one PROFILE PHOTO control is mounted at once (a duplicate leaked into another
 *    panel), keep the FIRST (the Layout one — Layout precedes Account in panel order)
 *    and hide the rest.
 *
 * Efficient + event-driven: hooks the control via its UNIQUE button-row marker
 * [data-antcv-bridge-active] (a cheap attribute selector, NOT a full div sweep),
 * idempotent (data-flag), debounced MutationObserver. No polling swarm.
 */
(function () {
  'use strict';
  if (window.__antcvPhotoCtrlCollapse) return;
  window.__antcvPhotoCtrlCollapse = true;

  var OPEN_KEY = 'antcv:photoCtrlOpen';
  function isOpen() { try { return localStorage.getItem(OPEN_KEY) === '1'; } catch (_) { return false; } }
  function setOpen(v) { try { localStorage.setItem(OPEN_KEY, v ? '1' : '0'); } catch (_) {} }

  // The control's first element child is the "PROFILE PHOTO" label.
  function labelEl(ctrl) {
    var c = ctrl && ctrl.firstElementChild;
    return (c && /^\s*PROFILE PHOTO\s*$/i.test(c.textContent || '') && c.children.length === 0) ? c : null;
  }
  // Find each control via its button-row marker (specific + cheap).
  function findControls() {
    var rows = document.querySelectorAll('[data-antcv-bridge-active]');
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var ctrl = rows[i].parentElement;
      if (ctrl && labelEl(ctrl) && out.indexOf(ctrl) === -1) out.push(ctrl);
    }
    return out;
  }

  function applyCollapse(ctrl, label) {
    var open = isOpen();
    var caret = label.querySelector('[data-antcv-photo-caret]');
    if (caret) caret.textContent = open ? '▾' : '▸';
    var ch = ctrl.children;
    for (var i = 0; i < ch.length; i++) { if (ch[i] !== label) ch[i].style.display = open ? '' : 'none'; }
  }

  function enhance(ctrl, idx) {
    // (2) duplicate leaked into another panel (e.g. Account) — hide all but the first.
    if (idx > 0) {
      if (ctrl.getAttribute('data-antcv-photo-collapse') !== 'dup') {
        ctrl.style.display = 'none';
        ctrl.setAttribute('data-antcv-photo-collapse', 'dup');
      }
      return;
    }
    if (ctrl.getAttribute('data-antcv-photo-collapse') === 'dup') {
      // promoted back to first (the dup is gone) — un-hide + fall through to collapse it.
      ctrl.style.display = '';
      ctrl.removeAttribute('data-antcv-photo-collapse');
    }
    var label = labelEl(ctrl);
    if (!label) return;
    if (ctrl.getAttribute('data-antcv-photo-collapse') === '1') { applyCollapse(ctrl, label); return; }
    ctrl.setAttribute('data-antcv-photo-collapse', '1');
    label.style.cursor = 'pointer';
    label.setAttribute('role', 'button');
    label.title = 'Show / hide the photo controls';
    if (!label.querySelector('[data-antcv-photo-caret]')) {
      var caret = document.createElement('span');
      caret.setAttribute('data-antcv-photo-caret', '1');
      caret.style.cssText = 'margin-right:6px;font-size:9px;opacity:.7;display:inline-block;';
      label.insertBefore(caret, label.firstChild);
    }
    applyCollapse(ctrl, label);
    label.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      setOpen(!isOpen());
      applyCollapse(ctrl, label);
    });
  }

  function scan() {
    var ctrls = findControls();
    for (var i = 0; i < ctrls.length; i++) enhance(ctrls[i], i);
  }

  var t = null;
  function schedule() { if (t) return; t = setTimeout(function () { t = null; scan(); }, 120); }

  var mo = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      if (muts[i].addedNodes && muts[i].addedNodes.length) { schedule(); return; }
    }
  });
  function start() {
    try { mo.observe(document.body, { childList: true, subtree: true }); } catch (_) {}
    schedule();
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
