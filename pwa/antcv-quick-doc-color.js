/* antcv-quick-doc-color.js — QUICK-COLOR-RETARGET-001 (owner 2026-07-23)
 * ===========================================================================
 * "make the color change the header box and table — not the antcv app ui."
 * The topbar quick-colour circles (alt-circles) recoloured the APP CHROME via
 * their React handler; the DOCUMENT (header box + tables) never changed (live-
 * verified: a circle click changed no palette key and the band stayed put).
 *
 * This sidecar RETARGETS the pick: a capture-phase click on an alt circle
 * swallows the event BEFORE React (chrome stays put) and applies the colour to
 * the DOCUMENT instead:
 *   - preview: a scoped <style> sets --header-bg on the paper, the candidate
 *     band fill, and the table header-row fill to the picked colour;
 *   - export: styleConfig.headerBg + tableHeaderBg are written too (buildStyle
 *     forwards them to the docx worker), keeping DOCX/PDF 1:1.
 * Clicking the circle whose colour is ALREADY applied clears the override
 * (back to the package/brand default). Persisted at antcv:quickDocColor.
 *
 * Interplay: antcv-mobile-ui-418's alt-drop collapse/open logic still owns the
 * open/close behaviour (now vertical at all widths); this sidecar only takes
 * over the SWITCH step. Kill: localStorage['antcv:disable-quick-doc-color']='1'
 * (restores chrome-switch behaviour and removes the override).
 */
(function () {
  'use strict';
  if (window.__antcvQuickDocColor) return;
  window.__antcvQuickDocColor = '1.0';

  var KILL = 'antcv:disable-quick-doc-color';
  var KEY = 'antcv:quickDocColor';
  var STYLE_ID = 'antcv-quick-doc-color-style';

  function killed() { try { return localStorage.getItem(KILL) === '1'; } catch (_) { return false; } }
  function current() { try { return String(localStorage.getItem(KEY) || '').replace(/["']/g, ''); } catch (_) { return ''; } }

  function applyCss(hex) {
    var el = document.getElementById(STYLE_ID);
    if (!hex) { if (el && el.parentNode) el.parentNode.removeChild(el); return; }
    if (!el) { el = document.createElement('style'); el.id = STYLE_ID; (document.head || document.documentElement).appendChild(el); }
    el.textContent =
      '.antcv-preview-paper{--header-bg:' + hex + ' !important;}' +
      '.antcv-preview-paper [data-antcv-candidate-band="1"]{background:' + hex + ' !important;background-color:' + hex + ' !important;}' +
      '.antcv-preview-paper table tr:first-child th,.antcv-preview-paper table tr:first-child td{background:' + hex + ' !important;color:#FFFFFF !important;}';
  }
  function writeStyleConfig(hex) {
    try {
      var sc = {}; try { sc = JSON.parse(localStorage.getItem('styleConfig') || '{}') || {}; } catch (_) {}
      if (hex) { sc.headerBg = hex; sc.tableHeaderBg = hex; }
      else { delete sc.headerBg; delete sc.tableHeaderBg; }
      localStorage.setItem('styleConfig', JSON.stringify(sc));
    } catch (_) {}
  }
  function setColor(hex) {
    try { if (hex) localStorage.setItem(KEY, hex); else localStorage.removeItem(KEY); } catch (_) {}
    applyCss(hex);
    writeStyleConfig(hex);
    try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'quick-doc-color' } })); } catch (_) {}
  }

  function isAltCircle(el) {
    if (!el || !el.closest) return null;
    var c = el.closest('div[title^="#"]');
    if (!c) return null;
    var s = c.getAttribute('style') || '';
    if (!/border-radius:\s*50%/.test(s)) return null;
    // topbar circles only (the settings/preview swatches are elsewhere)
    var r = c.getBoundingClientRect();
    if (r.top > 80) return null;
    return c;
  }

  // Capture-phase AFTER the 418 open/close handler (registration order): when the
  // group is open and a circle is picked, take over the switch — stop React's
  // chrome recolour and paint the DOCUMENT instead.
  document.addEventListener('click', function (ev) {
    if (killed()) return;
    var c = isAltCircle(ev.target);
    if (!c) return;
    var host = c.closest('[data-antcv-altdrop="1"]');
    if (host && host.getAttribute('data-antcv-altdrop-open') !== '1') return;  // the open-toggle click; 418 handles it
    ev.preventDefault(); ev.stopPropagation();
    if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
    var hex = String(c.title || '').trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
    setColor(current().toLowerCase() === hex.toLowerCase() ? '' : hex);   // same colour again = clear
    if (host) { host.setAttribute('data-antcv-altdrop-open', '0'); }
  }, true);

  // re-apply the persisted pick on boot + after re-renders
  function reapply() { var hex = current(); if (hex) applyCss(hex); }
  window.addEventListener('antcv:sections-updated', function (e) {
    if (e && e.detail && e.detail.reason === 'quick-doc-color') return;
    setTimeout(reapply, 150);
  });
  try { setInterval(reapply, 2000); } catch (_) {}
  reapply();

  window.AntcvQuickDocColor = { version: '1.0', set: setColor, get: current };
  try { console.debug('[quick-doc-color] installed'); } catch (_) {}
})();
