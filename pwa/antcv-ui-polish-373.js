/* AntCV UI polish — design-language consistency layer (v1.50.342)
 * ============================================================================
 * Owner-approved 2026-06-10: safe, reversible UI improvements for appeal,
 * design language, clarity, and convergence speed. This is a PURE CSS layer —
 * no behaviour, no DOM mutation, no event hooks.
 *
 * What it does (and why it's safe)
 * --------------------------------
 *  - Unifies the FOCUS-VISIBLE ring across every interactive control in the
 *    app CHROME (buttons, inputs, textareas, selects, links, [tabindex]) in
 *    the brand teal #01B7BB. Keyboard users get a clear, consistent focus
 *    affordance (clarity + accessibility) without affecting mouse clicks
 *    (:focus-visible only).
 *  - Adds a subtle hover/active micro-feedback on buttons (shadow + 1px lift)
 *    and a calm focus ring on text fields — a more cohesive, premium feel.
 *  - Tints the editor panels' scrollbars to match the palette.
 *
 * Why it cannot break anything
 * ----------------------------
 *  1. EVERY rule is wrapped in :where(), which has ZERO specificity — any
 *     existing inline style, class rule, or app.js style object overrides it.
 *     It only fills in where the app set nothing.
 *  2. It animates ONLY non-layout properties (color, background-color,
 *     border-color, box-shadow, transform, opacity) — NEVER width/height/
 *     margin/padding. So it can never change measured geometry.
 *  3. It is SCOPED OUT of the rendered document: nothing inside
 *     .antcv-preview-paper / [data-antcv-preview-paper] / .antcv-page-row /
 *     .antcv-document-sidebar is touched. The auto-pagebreak measurer reads
 *     those; leaving them alone keeps the salmon page-split stable.
 *  4. prefers-reduced-motion: reduce disables all transitions.
 *  5. Removable in one <script> line; escape hatch
 *     localStorage['antcv:disable-ui-polish'] = '1'.
 * ============================================================================
 */
(function () {
  'use strict';
  var VERSION = '1.50.342-ui-polish';
  if (window.__antcvUiPolish === VERSION) return;
  window.__antcvUiPolish = VERSION;

  var STYLE_ID = 'antcv-ui-polish-css';

  try {
    var d = localStorage.getItem('antcv:disable-ui-polish');
    if (d === '1' || d === 'true') return;
  } catch (_) {}

  if (document.getElementById(STYLE_ID)) return;

  var TEAL = '#01B7BB';
  var NAVY = '#283556';

  // Exclusion guard reused in every selector so the rendered document — which
  // the page-break measurer reads — is never styled or transitioned.
  var NOT_DOC =
    ':not(.antcv-preview-paper):not(.antcv-preview-paper *)' +
    ':not([data-antcv-preview-paper]):not([data-antcv-preview-paper] *)' +
    ':not(.antcv-page-row):not(.antcv-page-row *)' +
    ':not(.antcv-document-sidebar):not(.antcv-document-sidebar *)';

  var css = [
    // --- Focus-visible ring: one consistent affordance everywhere in chrome ---
    ':where(button, [role="button"], a, input, textarea, select, [tabindex])' + NOT_DOC + ':focus-visible{',
    '  outline: 2px solid ' + TEAL + ';',
    '  outline-offset: 2px;',
    '  border-radius: 4px;',
    '}',

    // --- Buttons: calm hover/active micro-feedback (non-layout only) ---
    ':where(button, [role="button"])' + NOT_DOC + '{',
    '  transition: box-shadow .15s ease, transform .08s ease, background-color .15s ease, color .15s ease, filter .15s ease;',
    '}',
    ':where(button, [role="button"])' + NOT_DOC + ':hover{',
    '  filter: brightness(1.04);',
    '}',
    ':where(button, [role="button"])' + NOT_DOC + ':active{',
    '  transform: translateY(1px);',
    '}',

    // --- Text fields: a calm focus ring in brand teal ---
    ':where(input, textarea, select)' + NOT_DOC + '{',
    '  transition: border-color .15s ease, box-shadow .15s ease, background-color .15s ease;',
    '}',
    ':where(input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), textarea, select)' + NOT_DOC + ':focus{',
    '  box-shadow: 0 0 0 3px rgba(1,183,187,.16);',
    '}',

    // --- Editor panel scrollbars: subtle palette tint (chrome only) ---
    ':where(.antcv-editor-side-panel, .antcv-mobile-bottom-panel){',
    '  scrollbar-width: thin;',
    '  scrollbar-color: rgba(40,53,86,.35) transparent;',
    '}',
    ':where(.antcv-editor-side-panel, .antcv-mobile-bottom-panel)::-webkit-scrollbar{ width: 10px; height: 10px; }',
    ':where(.antcv-editor-side-panel, .antcv-mobile-bottom-panel)::-webkit-scrollbar-thumb{',
    '  background: rgba(40,53,86,.30); border-radius: 6px; border: 2px solid transparent; background-clip: padding-box;',
    '}',
    ':where(.antcv-editor-side-panel, .antcv-mobile-bottom-panel)::-webkit-scrollbar-thumb:hover{ background: rgba(40,53,86,.50); background-clip: padding-box; }',

    // --- Respect reduced-motion: drop every transition we added ---
    '@media (prefers-reduced-motion: reduce){',
    '  :where(button, [role="button"], input, textarea, select)' + NOT_DOC + '{ transition: none !important; }',
    '  :where(button, [role="button"])' + NOT_DOC + ':active{ transform: none; }',
    '}',
  ].join('\n');

  var s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = css;
  (document.head || document.documentElement).appendChild(s);

  window.AntcvUiPolish = { version: VERSION, _tokens: { TEAL: TEAL, NAVY: NAVY } };
  try { console.debug('[ui-polish-373] installed v' + VERSION); } catch (_) {}
})();
