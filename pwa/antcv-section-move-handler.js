/* antcv-section-move-handler.js — owner 2026-06-17 (button audit fix)
 * ============================================================================
 * The Move (☰) buttons (antcv-section-move-button-341 / antcv-cl-body-move-
 * button-341) DISPATCH `antcv:section-move-requested` but NOTHING listened — so
 * clicking Move did nothing (a dead button). This handler subscribes and
 * performs the actual move: it shows a small destination popover (the allowed
 * targets, current excluded) and, on choice, updates the section's `loc`
 * (main / sidebar / topbar) in the `sections` store and re-renders.
 *
 * Section loc is the same field the preview/export render by (loc === "main" /
 * "sidebar"); the DnD sidecar sets the same field on drop, so this is the
 * keyboard/click-equivalent of a drag.
 * ============================================================================
 */
(function () {
  'use strict';
  var VERSION = '1.50.582-section-move';
  if (window.__antcvSectionMoveHandler === VERSION) return;
  window.__antcvSectionMoveHandler = VERSION;

  var DEST_LABEL = { main: 'CV main column', sidebar: 'CV sidebar', topbar: 'Candidate / top bar' };

  function rj(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; } }
  function wj(k, o) { try { localStorage.setItem(k, JSON.stringify(o)); return true; } catch (_) { return false; } }
  function activeDoc() { try { var x = JSON.parse(localStorage.getItem('doc') || '"cv"'); return x === 'cl' ? 'cl' : 'cv'; } catch (_) { return 'cv'; } }

  // Set the section's loc across whichever doc array holds it; returns true on hit.
  function moveSection(sectionId, dest) {
    var b = rj('sections', null);
    if (!b) return false;
    var changed = false;
    ['cv', 'cl'].forEach(function (doc) {
      var list = Array.isArray(b[doc]) ? b[doc] : null;
      if (!list) return;
      b[doc] = list.map(function (s) {
        if (s && (s.id === sectionId || s.key === sectionId) && s.loc !== dest) {
          changed = true;
          return Object.assign({}, s, { loc: dest });
        }
        return s;
      });
    });
    if (!changed) return false;
    wj('sections', b);
    try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: 'section-move-handler' } })); } catch (_) {}
    return true;
  }

  var pop = null;
  function closePop() { if (pop && pop.parentElement) pop.parentElement.removeChild(pop); pop = null; }

  function openPopover(sectionId, container, destinations) {
    closePop();
    var anchor = document.querySelector('[data-antcv-section-move-button="' + (window.CSS && CSS.escape ? CSS.escape(sectionId) : sectionId) + '"]')
      || document.querySelector('[data-antcv-section-move-button="' + sectionId + '"]');
    var dests = (destinations || []).filter(function (d) { return d && d !== container && DEST_LABEL[d]; });
    if (!dests.length) return;
    pop = document.createElement('div');
    pop.setAttribute('data-antcv-section-move-pop', '1');
    pop.style.cssText = 'position:fixed;z-index:2147483600;background:#fff;border:1px solid rgba(40,53,86,0.3);border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,0.25);padding:5px;min-width:150px;font-family:Calibri,Arial,sans-serif;font-size:12.5px;color:#1a2433;';
    var hdr = document.createElement('div');
    hdr.textContent = 'Move to…';
    hdr.style.cssText = 'font-size:10px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;color:#7a8699;padding:4px 8px 5px;';
    pop.appendChild(hdr);
    dests.forEach(function (d) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = DEST_LABEL[d];
      btn.style.cssText = 'display:block;width:100%;text-align:left;padding:7px 8px;border:none;background:none;cursor:pointer;border-radius:5px;font-size:12.5px;color:#1a2433;';
      btn.addEventListener('mouseenter', function () { btn.style.background = 'rgba(1,183,187,0.10)'; });
      btn.addEventListener('mouseleave', function () { btn.style.background = 'none'; });
      btn.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        moveSection(sectionId, d);
        closePop();
      });
      pop.appendChild(btn);
    });
    document.body.appendChild(pop);
    // Position near the anchor (fallback: viewport centre-top).
    try {
      var r = anchor ? anchor.getBoundingClientRect() : { left: window.innerWidth / 2 - 75, bottom: 80 };
      pop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - pop.offsetWidth - 8)) + 'px';
      pop.style.top = (r.bottom + 4) + 'px';
    } catch (_) {}
    setTimeout(function () {
      document.addEventListener('pointerdown', function onDoc(ev) {
        if (pop && !pop.contains(ev.target)) { closePop(); document.removeEventListener('pointerdown', onDoc); }
      });
    }, 0);
  }

  window.addEventListener('antcv:section-move-requested', function (e) {
    var d = (e && e.detail) || {};
    if (!d.sectionId) return;
    // destinations come from the button's matrix; default to main/sidebar/topbar.
    var dests = Array.isArray(d.destinations) && d.destinations.length ? d.destinations : ['main', 'sidebar', 'topbar'];
    try { openPopover(d.sectionId, d.container || '', dests); } catch (_) {}
  });

  window.AntcvSectionMoveHandler = { version: VERSION, _move: moveSection };
})();
