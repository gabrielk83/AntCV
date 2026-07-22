/* antcv-copenhagen-v2-001.js — COPENHAGEN-MODERN-V2 stage V1: rounded header box
 * ============================================================================
 * docs/plan/COPENHAGEN_MODERN_VISUAL_PASS.md — the default visual style
 * (copenhagen-modern) "floating inset panels" refresh, reverse-engineered from
 * the Ibsen 1017 CV/CL PDFs (memory copenhagen-modern-refresh-and-palette-first).
 *
 * STAGE V1 (this file): turn the candidate BAND into a rounded, bordered box.
 * Spec: rounded rect (radius ~20pt), 1.5pt border in the ACCENT colour, fill =
 * the header background. Both come from the palette resolver CSS vars set on the
 * paper wrapper (__antcvResolvePaperVars): fill --header-bg, border --brand-accent
 * / --header-line-color. NO hardcoded hex, so the box is navy+amber only for a
 * brand/Ibsen app and the Copenhagen-Modern default palette otherwise.
 *
 * WHY a CSS sidecar (not a React edit): this is a look change I cannot visually
 * verify from an unauthenticated session, and the band render is deep minified
 * React. A scoped <style> is reversible, touches no render logic, and applies
 * only to the live PREVIEW DOM. Export (PDF srcdoc + DOCX) parity is a LATER
 * stage once the look is approved (this stage is preview-only on purpose).
 *
 * OPT-IN (default OFF): applies ONLY when localStorage['antcv:copenhagen-v2']==='1'.
 * Nothing changes in production until the owner flips the flag to eyeball it;
 * removing the flag (or setting '0') reverts instantly. Later, once approved, the
 * default flips ON and export/DOCX parity lands.
 *
 * Insets / floating gaps / photo-left / accent rules = stages V2-V4, not here.
 */
(function () {
  'use strict';
  if (window.__antcvCopenhagenV2) return;
  window.__antcvCopenhagenV2 = '1.0-V1';

  var FLAG = 'antcv:copenhagen-v2';
  var STYLE_ID = 'antcv-copenhagen-v2-style';

  // Owner-tuned (2026-07-21): radius 22px = "perfect"; border 1.5px accent; box
  // inset 7.4px from top/left/right (V2 floating panels). The sidebar becomes an
  // inset panel: in every figure placement mode EXCEPT sidebar-bridge, gap 7.4px
  // below the header, 7.4px from the bottom and from the page-edge corner it hugs
  // (left/right per sidebarPosition); in bridge mode keep the current vertical
  // heights and inset ~3.2px horizontally from the contour. Colours from the
  // palette resolver vars — never hardcoded. Corners round via border-radius (bg
  // is clipped to the border-box); NO overflow:hidden so a straddling photo is
  // never clipped. Preview-only; export parity is a follow-up once numbers lock.
  function sidebarSide() {
    try {
      var v = String(localStorage.getItem('sidebarPosition') || 'left').replace(/["']/g, '').toLowerCase();
      return v === 'right' ? 'right' : 'left';
    } catch (_) { return 'left'; }
  }
  function isBridge() {
    try { return !!document.querySelector('.antcv-preview-paper [data-antcv-bridge-spacer]'); } catch (_) { return false; }
  }
  function buildCSS() {
    var side = sidebarSide();
    var css =
      '.antcv-preview-paper [data-antcv-candidate-band="1"]{' +
        'border-radius:22px !important;' +
        'border:1.5px solid var(--brand-accent, var(--header-line-color, #01B7BB)) !important;' +
        'margin:7.4px 7.4px 0 7.4px !important;box-sizing:border-box !important;' +
      '}';
    if (isBridge()) {
      // bridge: same vertical heights, ~3.2px horizontal from the contour.
      css += '.antcv-preview-paper [data-antcv-document-sidebar]{margin-' + side + ':3.2px !important;box-sizing:border-box !important;}';
    } else {
      // non-bridge: float the sidebar panel — gap below header + inset from the
      // bottom and the page-edge corner it aligns to.
      css += '.antcv-preview-paper [data-antcv-document-sidebar]{' +
        'margin-top:7.4px !important;margin-bottom:7.4px !important;margin-' + side + ':7.4px !important;' +
        'box-sizing:border-box !important;}';
    }
    // V3 photo-corner alignment (owner 2026-07-21, measured): the main-left/
    // main-right floated photo sits ~6px too high and ~20px off toward the
    // centre. Nudge via transform (visual only, does not disturb the wrap):
    // main-left -> down 6, left 20; main-right -> down 6, right 20. Pre-existing
    // offset; the [data-antcv-main-photo] div's direct-child <img> IS the photo.
    css += '.antcv-preview-paper [data-antcv-main-photo="main-left"] > img{transform:translate(-20px,6px) !important;}';
    css += '.antcv-preview-paper [data-antcv-main-photo="main-right"] > img{transform:translate(20px,6px) !important;}';
    return css;
  }

  function enabled() {
    try { return localStorage.getItem(FLAG) === '1'; } catch (_) { return false; }
  }
  function apply() {
    var on = enabled();
    var el = document.getElementById(STYLE_ID);
    if (on) {
      if (!el) {
        el = document.createElement('style');
        el.id = STYLE_ID;
        (document.head || document.documentElement).appendChild(el);
        try { console.debug('[copenhagen-v2] V1+V2 box + inset panels ON'); } catch (_) {}
      }
      var next = buildCSS();
      if (el.textContent !== next) el.textContent = next;  // re-derive (bridge/side can change)
    } else if (el && el.parentNode) {
      el.parentNode.removeChild(el);
    }
  }

  // React to the flag being toggled in this tab (custom event) or another tab
  // (storage event), and re-assert on the app's re-render nudges.
  window.addEventListener('storage', function (e) { if (!e || e.key === FLAG || e.key == null) apply(); });
  window.addEventListener('antcv:sections-updated', apply);
  document.addEventListener('DOMContentLoaded', apply);
  apply();

  // Debug API + a one-liner toggle for the owner.
  window.AntcvCopenhagenV2 = {
    version: window.__antcvCopenhagenV2,
    on: function () { try { localStorage.setItem(FLAG, '1'); } catch (_) {} apply(); },
    off: function () { try { localStorage.setItem(FLAG, '0'); } catch (_) {} apply(); },
    _apply: apply
  };
})();
