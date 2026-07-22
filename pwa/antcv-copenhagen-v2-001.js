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
 * DEFAULT ON since 1.51.3061 (STAGE 3, mockup lock 2026-07-22): the owner signed
 * off the Copenhagen Modern design on the interactive mockup (see
 * docs/design/COPENHAGEN_MODERN_NORDIC_PALETTE_SPEC.md "LOCKED via interactive
 * mockup"), which is the approval the old opt-in was waiting for. Kill switch:
 * localStorage['antcv:copenhagen-v2']='0' reverts instantly ('1' still forces on).
 *
 * STAGE 3 additions (same mockup lock): band NAME gets expanded tracking (.14em,
 * frames the photo like a 2nd ring), the CONTACT line condenses (scaleX .73) so
 * it holds one line at ~name width, and band hyperlinks (email/LinkedIn) render
 * WHITE on the dark box (blue/cyan "break the aesthetics"). Name/contact nodes
 * are identified the same way antcv-header-elem-colors.js does (first text div =
 * name; the emoji/phone div = contact) and stamped for clean removal.
 */
(function () {
  'use strict';
  if (window.__antcvCopenhagenV2) return;
  window.__antcvCopenhagenV2 = '1.51.3262-band-symmetry';

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
  // Owner-tunable photo offset. Default dx=20 dy=-8 — LIVE-MEASURED 2026-07-22 on
  // the owner's logged-in session in the band/heading-left (Sidebar-bridge) mode
  // they actually use: translate(-20,-8) lands the photo at ~7px left / ~6px top
  // inset, evenly nestled in the 22px rounded corner. (The earlier +6 came from
  // the main-COLUMN spec, a different element that this selector no longer hits.)
  // AntcvCopenhagenV2.photo(dx,dy) overrides live for further tuning.
  function photoOffset() {
    try {
      var raw = localStorage.getItem('antcv:cph-photo');
      if (raw) { var p = raw.split(',').map(function (n) { return parseFloat(n); }); if (p.length === 2 && !isNaN(p[0]) && !isNaN(p[1])) return { dx: p[0], dy: p[1] }; }
    } catch (_) {}
    return { dx: 20, dy: -8 };
  }
  // The candidate-band photo is float:left OR float:right depending on placement.
  // CSS can't branch on computed float, so we read it here and emit the matching
  // sign: left-floated -> move left (-dx); right-floated -> move right (+dx). dy
  // is always down (+). Falls back to targeting both floats if none is on screen.
  function photoNudgeCSS() {
    var o = photoOffset();
    var floatDir = '';
    try {
      var img = document.querySelector('.antcv-preview-paper [data-antcv-candidate-band="1"] img');
      if (img) floatDir = getComputedStyle(img).cssFloat || getComputedStyle(img).float || '';
    } catch (_) {}
    var sel = '.antcv-preview-paper [data-antcv-candidate-band="1"] img';
    if (floatDir === 'right') return sel + '{transform:translate(' + o.dx + 'px,' + o.dy + 'px) !important;}';
    if (floatDir === 'left') return sel + '{transform:translate(' + (-o.dx) + 'px,' + o.dy + 'px) !important;}';
    // Unknown (not yet rendered): leave the current on-screen float as left default.
    return sel + '{transform:translate(' + (-o.dx) + 'px,' + o.dy + 'px) !important;}';
  }
  function buildCSS() {
    var side = sidebarSide();
    var BAND = '.antcv-preview-paper [data-antcv-candidate-band="1"]';
    var css =
      BAND + '{' +
        'border-radius:22px !important;' +
        'border:1.5px solid var(--brand-accent, var(--header-line-color, #01B9BD)) !important;' +
        'margin:7.4px 7.4px 0 7.4px !important;box-sizing:border-box !important;' +
        'position:relative !important;' +
      '}';
    if (isBridge()) {
      // bridge: same vertical heights, ~3.2px horizontal from the contour.
      css += '.antcv-preview-paper [data-antcv-document-sidebar]{margin-' + side + ':3.2px !important;box-sizing:border-box !important;}';
      // Bridge keeps the owner-tuned straddle nudge (live-measured 2026-07-22).
      css += photoNudgeCSS();
    } else {
      // non-bridge: float the sidebar panel — gap below header + inset from the
      // bottom and the page-edge corner it aligns to.
      css += '.antcv-preview-paper [data-antcv-document-sidebar]{' +
        'margin-top:7.4px !important;margin-bottom:7.4px !important;margin-' + side + ':7.4px !important;' +
        'box-sizing:border-box !important;}';
      // HEADER-DEFECTS 2026-07-23 ("figure is not aligned with corners"): the
      // misalignment was the bridge-tuned translate NUDGE leaking into non-bridge
      // modes — photoNudgeCSS is bridge-only now, so the floated photo sits at its
      // natural padding position, nestled in the rounded corner. CPH-BAND-GAP-001
      // (owner 2026-07-23 "why so much space between the text and the figure"):
      // the earlier absolute-positioning fix took the photo OUT of the text flow,
      // which made the band text center on the full box far from the photo —
      // reverted; the float keeps the text beside the figure. Only neutralize any
      // stale transform from a cached nudge.
      // CPH-BAND-SIZE/GRID/SYMMETRY (owner 2026-07-23 iterations, latest: "place
      // the figure so it looks like it is in the middle of sidebar width, increase
      // the heading box height, increase the width the contact line is allowed
      // (from both its sides), improve spaces and symmetry — the specialization
      // and photo are both in mid-box height"):
      //  - photo column = the LIVE-MEASURED sidebar width, photo centered in it
      //    -> the figure sits over the sidebar's midline;
      //  - rows are 1fr / auto / 1fr: NAME bottom-anchored above center, SPEC
      //    exactly at mid-box height (like the photo, align-self:center), CONTACT
      //    top-anchored below — symmetric around the middle;
      //  - CONTACT spans the FULL band (grid-column 1/-1), so with nowrap +
      //    scaleX(.73) it has maximum symmetric width from both sides;
      //  - box height 174 -> 200px.
      var sbW = 0;
      try { var __sb = document.querySelector('.antcv-preview-paper [data-antcv-document-sidebar]'); if (__sb) sbW = Math.round(__sb.getBoundingClientRect().width); } catch (_) {}
      if (!sbW || sbW < 150 || sbW > 500) sbW = 250;
      css += BAND + '{display:grid !important;grid-template-columns:' + sbW + 'px 1fr !important;' +
        'grid-template-rows:1fr auto 1fr !important;align-content:stretch !important;row-gap:0 !important;' +
        'min-height:200px !important;padding-top:14px !important;padding-bottom:14px !important;}';
      css += BAND + ' img{grid-column:1 !important;grid-row:1 / span 3 !important;align-self:center !important;justify-self:center !important;' +
        'transform:none !important;width:134px !important;height:134px !important;margin:0 !important;float:none !important;}';
      css += BAND + ' > div{grid-column:2 !important;margin:0 !important;}';
      css += BAND + ' > div:first-of-type{grid-row:1 !important;align-self:end !important;margin-bottom:8px !important;}';
      css += BAND + ' > div:nth-of-type(2):not(:last-of-type){grid-row:2 !important;align-self:center !important;}';
      css += BAND + ' > div:last-of-type:not(:first-of-type){grid-column:1 / -1 !important;grid-row:3 !important;' +
        'align-self:start !important;margin-top:8px !important;white-space:nowrap !important;}';
    }
    // STAGE 3 (structural CSS, NOT per-node inline styles — inline styles were
    // wiped by React re-renders and re-applied late, which the owner saw as the
    // CL name/contact "jumping between two sizes"; CSS applies at every paint):
    //  - NAME (first text line of the band): expanded tracking .14em.
    //  - CONTACT (last band line): scaleX(.73) condense.
    //  - band hyperlinks (email/LinkedIn): WHITE on the dark box.
    css += BAND + ' > div:first-of-type{letter-spacing:.14em !important;}';
    css += BAND + ' > div:last-of-type:not(:first-of-type){transform:scaleX(.73);transform-origin:center;}';
    css += BAND + ' a{color:#fff !important;}';
    // CPH-BAND-SIZE-001: slightly larger header text, alignment untouched
    // (mockup name 23-24px; spec/contact scale with it).
    css += BAND + ' > div:first-of-type{font-size:24px !important;}';
    css += BAND + ' > div:nth-of-type(2):not(:last-of-type){font-size:18px !important;}';
    css += BAND + ' > div:last-of-type:not(:first-of-type){font-size:13px !important;}';
    // APPLINE-SPACING-001 (owner 2026-07-23 "the application line is too far from
    // the slogan and too close to the horizontal line"): pull the line UP toward
    // the slogan and open air between the text and its rule underneath.
    css += '.antcv-preview-paper [data-antcv-app-line-native]{margin-top:-7px !important;padding-bottom:7px !important;}';
    // SPEC-LINE-COLOR-001 (owner 2026-07-23 "proper color for the specialization
    // line"): the band render inks the spec line with the header ink (white);
    // mockup wants the cyan #01B9BD. Branded apps still win via the
    // header-elem-colors inline accent paint (inline style beats stylesheet).
    css += BAND + ' > div:nth-of-type(2):not(:last-of-type){color:var(--header-spec-color, #01B9BD) !important;}';
    return css;
  }

  // SIGNOFF-UNDERLINE-001 (owner 2026-07-23 "missing is the underline under at
  // your service"): mockup locks the CL sign-off as teal, NON-bold, with a 1.5pt
  // CYAN #01B9BD underline. The sign-off div carries no data attribute — find it
  // by its text (same pattern family as antcv-cl-ai-notice-inline SIGNOFFS) and
  // paint inline, stamped for clean removal.
  var SIGN_RX = /^(at your service|best regards|kind regards|sincerely|warm regards|yours sincerely|yours faithfully|med venlig hilsen|saludos cordiales|atentamente)[,，]?$/i;
  var SIGN_STAMP = 'data-antcv-cph-signoff';
  function paintSignoff(on) {
    var flow;
    try { flow = document.querySelector('.antcv-preview-paper [data-antcv-cl-flow]'); } catch (_) { flow = null; }
    if (!flow) return;
    if (!on) {
      Array.prototype.slice.call(flow.querySelectorAll('[' + SIGN_STAMP + ']')).forEach(function (d) {
        d.style.removeProperty('color'); d.style.removeProperty('font-weight');
        d.style.removeProperty('text-decoration'); d.style.removeProperty('text-decoration-color');
        d.style.removeProperty('text-decoration-thickness'); d.style.removeProperty('text-underline-offset');
        d.removeAttribute(SIGN_STAMP);
      });
      return;
    }
    var nodes = flow.querySelectorAll('div,p,span');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.children.length > 1) continue;                       // leaf-ish only
      var txt = String(el.textContent || '').trim();
      if (!SIGN_RX.test(txt)) continue;
      el.style.setProperty('color', '#00746E', 'important');
      el.style.setProperty('font-weight', '400', 'important');
      el.style.setProperty('text-decoration', 'underline', 'important');
      el.style.setProperty('text-decoration-color', '#01B9BD', 'important');
      el.style.setProperty('text-decoration-thickness', '1.5px', 'important');
      el.style.setProperty('text-underline-offset', '3px', 'important');
      el.setAttribute(SIGN_STAMP, '1');
      break;                                                      // one sign-off per letter
    }
  }

  // STAGE 3 v2 (2026-07-23): the name/contact styling moved into buildCSS
  // structural selectors (see above) — the 1.51.3061 per-node inline styles
  // fought React re-renders and made the CL band text "jump between two sizes".
  // This sweeper only STRIPS the legacy 3061 stamps so a client transitioning
  // from the old build self-heals; it never adds styles.
  var TUNE_STAMP = 'data-antcv-cph-v3';
  function tuneBandText() {
    var band;
    try { band = document.querySelector('.antcv-preview-paper [data-antcv-candidate-band="1"]'); } catch (_) { band = null; }
    if (!band) return;
    Array.prototype.slice.call(band.querySelectorAll('[' + TUNE_STAMP + ']')).forEach(function (d) {
      d.style.removeProperty('letter-spacing');
      d.style.removeProperty('transform');
      d.style.removeProperty('transform-origin');
      d.removeAttribute(TUNE_STAMP);
    });
  }

  function enabled() {
    // DEFAULT ON (Stage 3) — '0' is the kill switch, '1' still forces on.
    try { return localStorage.getItem(FLAG) !== '0'; } catch (_) { return true; }
  }
  function apply() {
    var on = enabled();
    var el = document.getElementById(STYLE_ID);
    if (on) {
      if (!el) {
        el = document.createElement('style');
        el.id = STYLE_ID;
        (document.head || document.documentElement).appendChild(el);
        try { console.debug('[copenhagen-v2] box + inset panels + stage-3 band text ON'); } catch (_) {}
      }
      var next = buildCSS();
      if (el.textContent !== next) el.textContent = next;  // re-derive (bridge/side can change)
    } else if (el && el.parentNode) {
      el.parentNode.removeChild(el);
    }
    try { tuneBandText(); } catch (_) {}   // strip legacy 3061 inline stamps only
    try { paintSignoff(on); } catch (_) {}
  }

  // React to the flag being toggled in this tab (custom event) or another tab
  // (storage event), and re-assert on the app's re-render nudges.
  window.addEventListener('storage', function (e) { if (!e || e.key === FLAG || e.key == null) apply(); });
  window.addEventListener('antcv:sections-updated', apply);
  document.addEventListener('DOMContentLoaded', apply);
  apply();
  // STAGE 3: the band mounts after React boot — a few delayed re-asserts cover
  // the late mount + the first re-renders (NO global observer, see memory
  // sidecar-global-observer-breaks-React).
  [400, 1200, 3000, 6000].forEach(function (ms) { setTimeout(apply, ms); });

  // Debug API + a one-liner toggle for the owner.
  window.AntcvCopenhagenV2 = {
    version: window.__antcvCopenhagenV2,
    on: function () { try { localStorage.setItem(FLAG, '1'); } catch (_) {} apply(); },
    off: function () { try { localStorage.setItem(FLAG, '0'); } catch (_) {} apply(); },
    // Live photo tuner: AntcvCopenhagenV2.photo(20,6) — dx toward the corner, dy
    // down. Re-applies immediately so the owner can dial it and report the numbers.
    photo: function (dx, dy) {
      try { localStorage.setItem('antcv:cph-photo', (dx == null ? 20 : dx) + ',' + (dy == null ? 6 : dy)); } catch (_) {}
      apply();
      try { return 'photo offset dx=' + dx + ' dy=' + dy + ' — reload not needed'; } catch (_) {}
    },
    _apply: apply
  };
})();
