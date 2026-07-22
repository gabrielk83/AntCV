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

  // Radius: the spec is ~20pt. The preview paper is 794px = 595pt (1pt≈1.334px),
  // so ~20pt ≈ 26px; use 22px (a touch conservative — the owner can tune).
  // Border 1.5pt ≈ 2px. Corners round via border-radius alone (the band bg is
  // clipped to the border-box); we do NOT force overflow:hidden so the bridge-
  // mode photo that straddles the band edge is never clipped.
  var CSS =
    '.antcv-preview-paper [data-antcv-candidate-band="1"]{' +
      'border-radius:22px !important;' +
      'border:2px solid var(--brand-accent, var(--header-line-color, #01B7BB)) !important;' +
      '-webkit-box-decoration-break:clone;box-decoration-break:clone;' +
    '}';

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
        el.textContent = CSS;
        (document.head || document.documentElement).appendChild(el);
        try { console.debug('[copenhagen-v2] V1 rounded header box ON'); } catch (_) {}
      }
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
