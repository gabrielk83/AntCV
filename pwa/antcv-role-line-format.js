/* antcv-role-line-format.js — ROLE-LOCATION-001 control (EXEC-LINEAR step 2)
 * ============================================================================
 * Adds a "Role line" select to the PAGE FLOW group of the style panel:
 *   classic  title, company ........ years[ | location]     (default, unchanged look)
 *   meta     title - company ....... (years | location)     (the 2026-09-27 v2 reference CV; hyphen per owner 2026-09-29)
 * Store: localStorage['antcv:roleLineFormat'] = 'meta' | absent. Read by
 * antcv-roles-richblock-adapter.js (preview) and antcv-docx-client.js (export
 * -> style.roleLineFormat -> worker renderExperience). Own key on purpose: no
 * React state, no app.js edit. Kill (UI only): antcv:disable-role-line-format=1.
 * Spec: docs/design/EXECUTIVE_LINEAR_LAYOUT_PROPOSAL.md §3.1 / §3.3.
 */
(function () {
  'use strict';
  var VERSION = '1.51.4629-linear-repaginate';
  if (window.__antcvRoleLineFormat === VERSION) return;
  window.__antcvRoleLineFormat = VERSION;

  var KEY = 'antcv:roleLineFormat';
  var ATTR = 'data-antcv-role-line-format';
  function disabled() { try { var v = localStorage.getItem('antcv:disable-role-line-format'); return v === '1' || v === 'true'; } catch (_) { return false; } }
  function read() { try { return localStorage.getItem(KEY) === 'meta' ? 'meta' : 'classic'; } catch (_) { return 'classic'; } }
  function write(v) {
    try {
      if (v === 'meta') localStorage.setItem(KEY, 'meta'); else localStorage.removeItem(KEY);
      // The sections store handler re-reads and re-renders the preview on this event;
      // the adapter reads the key at render time.
      window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'role-line-format' } }));
    } catch (_) {}
  }

  var LKEY = 'antcv:cvLayout';
  function readLayout() { try { return localStorage.getItem(LKEY) === 'linear' ? 'linear' : 'two_column'; } catch (_) { return 'two_column'; } }
  function writeLayout(v) {
    try {
      if (v === 'linear') localStorage.setItem(LKEY, 'linear'); else localStorage.removeItem(LKEY);
      // step 3: antcv-cv-layout-linear.js moves the sections + switches the columns right away
      if (typeof window.__antcvCvLayoutApply === 'function') window.__antcvCvLayoutApply();
      else window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'cv-layout' } }));
    } catch (_) {}
  }
  // EXEC-LINEAR "CV layout" - Two-column (default) | Linear. Export: worker buildLinearCvDocument (5a);
  // preview: antcv-cv-layout-linear.js (step 3, single column, plain sections).
  function buildLayout() {
    var row = document.createElement('label');
    row.setAttribute(ATTR, 'layout');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;margin:2px 0 4px;cursor:pointer;';
    var lb = document.createElement('span');
    lb.textContent = 'CV layout';
    lb.style.cssText = 'font-size:9px;color:rgba(255,255,255,0.45);flex:0 0 auto;';
    var sel = document.createElement('select');
    sel.style.cssText = 'font-size:9px;padding:1px 2px;max-width:100%;';
    [['two_column', 'Two-column'], ['linear', 'Linear']].forEach(function (o) {
      var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1];
      if (o[0] === readLayout()) op.selected = true;
      sel.appendChild(op);
    });
    sel.onchange = function () { writeLayout(sel.value); };
    row.appendChild(lb); row.appendChild(sel);
    return row;
  }

  function build() {
    var row = document.createElement('label');
    row.setAttribute(ATTR, '1');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;margin:6px 0 4px;cursor:pointer;';
    var lb = document.createElement('span');
    lb.textContent = 'Role line';
    lb.style.cssText = 'font-size:9px;color:rgba(255,255,255,0.45);flex:0 0 auto;';
    var sel = document.createElement('select');
    sel.style.cssText = 'font-size:9px;padding:1px 2px;max-width:100%;';
    [
      ['classic', 'Title, company · years'],
      ['meta', 'Title - company (years | location)']
    ].forEach(function (o) {
      var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1];
      if (o[0] === read()) op.selected = true;
      sel.appendChild(op);
    });
    sel.onchange = function () { write(sel.value); };
    row.appendChild(lb); row.appendChild(sel);
    return row;
  }

  // Anchor: the "PAGE FLOW" group title (app.src.js ~16028). Insert after its last
  // checkbox label. Idempotent per panel mount (the attribute marks a placed row).
  function place() {
    if (disabled()) return;
    var nodes = document.querySelectorAll('div');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.childElementCount !== 0 || String(n.textContent || '').trim() !== 'PAGE FLOW') continue;
      var parent = n.parentNode;
      if (!parent || parent.querySelector('[' + ATTR + ']')) continue;
      // Skip the title + every checkbox label that follows it.
      var after = n;
      while (after.nextSibling && after.nextSibling.tagName === 'LABEL' && !after.nextSibling.hasAttribute(ATTR)) after = after.nextSibling;
      var r1 = build();
      parent.insertBefore(r1, after.nextSibling);
      parent.insertBefore(buildLayout(), r1.nextSibling);
    }
  }

  var pending = 0;
  function schedule() { if (pending) return; pending = setTimeout(function () { pending = 0; try { place(); } catch (_) {} }, 150); }
  function start() {
    try { place(); } catch (_) {}
    try { new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true }); } catch (_) {}
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
