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
  window.__antcvCopenhagenV2 = '1.51.3686-name-width4';

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
  // CPH-SPEC-MIDLINE-001/002: small optical trim (px) on top of the geometric
  // row centering, so the spec GLYPH middle (the • circle centers) sits on the
  // box midline — the line-box descender otherwise seats glyphs a touch high.
  // Owner-tunable live: AntcvCopenhagenV2.specDy(n), positive = lower, persisted.
  function specDy() {
    try {
      var v = parseFloat(localStorage.getItem('antcv:cph-spec-dy'));
      if (isFinite(v) && Math.abs(v) <= 60) return v;
    } catch (_) {}
    // Default 0 since SYMMETRY-004: the centered auto-row group already seats
    // the spec a few px below exact center (name taller than contact).
    return 0;
  }

  // CPH-FIT-STABLE-001: the chosen name/contact fit persists across applies so
  // re-measurement can only TIGHTEN it, never snap the lines back to full size.
  var __fit = { nameLs: null, nameFs: null, contFs: null, contK: null };

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
      // CPH-BAND-SYMMETRY-004 (owner 2026-07-23 round 4): "equal gap between the
      // top of the name and the bottom of the contact line" — the OUTER gaps
      // (box top -> name, contact -> box bottom) must match too. Auto rows
      // centered as a GROUP (align-content:center) + one uniform row-gap give
      // all three symmetries at once: outer gaps equal, internal gaps equal,
      // spec near the midline (its natural seat is a few px below exact center
      // because the name is taller than the contact — the specDy dial trims).
      css += BAND + '{display:grid !important;grid-template-columns:1fr !important;' +
        'grid-template-rows:auto auto auto !important;align-content:center !important;row-gap:18px !important;' +
        'min-height:200px !important;padding-top:14px !important;padding-bottom:14px !important;}';
      // CPH-PHOTO-CENTER-001 (owner 2026-07-23 "this is definitely not centered
      // to the middle of the sidebar"): the old grid column carried the band's
      // border+padding offset AND compared SCALED rects (the preview paper is
      // scale-transformed) against unscaled CSS px — both skewed the center.
      // Now: measure the sidebar's midline and the band origin in the SAME
      // (scaled) space, divide by the live scale factor, and pin the photo
      // ABSOLUTE at that CSS-px x, vertically centered. Out of the grid flow,
      // so the text rows never stretch around it.
      var __phL = null;
      try {
        var __sbEl2 = document.querySelector('.antcv-preview-paper [data-antcv-document-sidebar]');
        var __bEl2 = document.querySelector(BAND);
        if (__sbEl2 && __bEl2 && __bEl2.offsetWidth) {
          var __sR2 = __sbEl2.getBoundingClientRect(), __bR2 = __bEl2.getBoundingClientRect();
          var __sc2 = __bR2.width / __bEl2.offsetWidth;
          if (isFinite(__sc2) && __sc2 > 0.2) {
            var __cx = ((__sR2.left + __sR2.width / 2) - __bR2.left) / __sc2;
            if (__cx > 80 && __cx < 420) __phL = __cx - 64.5;   // photo half = 64.5px (129px circle)
          }
        }
      } catch (_) {}
      if (__phL == null) __phL = Math.max(14, sbW / 2 - 55.5); // fallback approximation (129px half)
      css += BAND + ' img{position:absolute !important;left:' + __phL.toFixed(1) + 'px !important;top:50% !important;' +
        'transform:translateY(-50%) !important;width:129px !important;height:129px !important;margin:0 !important;float:none !important;}';
      // CPH-BAND-SYMMETRY-002 (owner 2026-07-23 round 2): (a) the spec's OPTICAL
      // middle (the bullet-circle centers) sits on the box midline — all three
      // text rows now span the FULL band (grid-column 1/-1) so the spec centers
      // on the band, not on column 2, and the 1fr/auto/1fr rows put the middle
      // row's center at box center geometrically (specDy remains a small optical
      // trim, dial AntcvCopenhagenV2.specDy); (b) the name→spec and spec→contact
      // gaps are EQUAL (10px each side of the spec row); (c) NAME and CONTACT may
      // run long at the SAME full-band width — both nowrap, both centered.
      // Rows carry NO margins — the uniform row-gap + group centering are the
      // spacing truth. specDy stays a pure visual trim on the spec only.
      css += BAND + ' > div{grid-column:1 / -1 !important;margin:0 !important;}';
      css += BAND + ' > div:first-of-type{grid-row:1 !important;white-space:nowrap !important;}';
      css += BAND + ' > div:nth-of-type(2):not(:last-of-type){grid-row:2 !important;' +
        'transform:translateY(' + specDy() + 'px) !important;}';
      css += BAND + ' > div:last-of-type:not(:first-of-type){grid-row:3 !important;white-space:nowrap !important;}';
      // CPH-BAND-FIT-001 (owner 2026-07-23 round 5, supersedes the round-3
      // spec-width matching): (a) the NAME condenses — tracking first, then font
      // size — until its centered box clears the figure by >=10px; (b) the
      // CONTACT compresses/shrinks (scaleX) until its visual width fits the
      // NAME's width. Live-measured against the actual photo rect; re-derived
      // on every apply, convergent (each pass measures the already-applied
      // state), 2px hysteresis so it settles.
      try {
        var __b = document.querySelector(BAND);
        var __ds = __b ? __b.querySelectorAll(':scope > div') : null;
        if (__b && __ds && __ds.length >= 2) {
          var __nameEl = __ds[0], __contEl = __ds[__ds.length - 1];
          var __bR = __b.getBoundingClientRect();
          var __img = __b.querySelector('img');
          // CPH-PHOTO-CENTER-001: rects are SCALED (preview transform) while
          // scrollWidth is CSS px — normalize everything to CSS px via the live
          // scale factor before comparing.
          var __cssW = __b.offsetWidth || __b.clientWidth;
          var __sc = __cssW ? (__bR.width / __cssW) : 1;
          if (!isFinite(__sc) || __sc <= 0.2) __sc = 1;
          var __maxW = __cssW - 32;                                // horizontal padding allowance
          if (__img) {
            var __iR = __img.getBoundingClientRect();
            var __photoRightCss = (__iR.right - __bR.left) / __sc;
            // centered line clears the photo when width <= 2*(bandCenter - photoRight - 10)
            var __clear = 2 * ((__cssW / 2) - __photoRightCss - 14);
            if (__clear > 0) __maxW = Math.min(__maxW, Math.max(140, __clear));
          }
          // CPH-FIT-ABS-001 (owner 2026-07-23 "now it is extremely smaller"): the
          // tighten-only ratchet let ONE bad transient measurement (band mid-
          // re-render) lock the smallest size forever. The fit is now computed
          // ABSOLUTELY each good pass from the line's NATURAL width (scale-
          // invariant: width/fontSize is constant), so recomputation is
          // idempotent, a bad pass is simply skipped (sanity gates), and a
          // poisoned cache self-heals on the next good pass. Floors keep the
          // contact legible: font >= 9.5px, compression >= 0.68.
          var __sane = __cssW > 350 && __cssW < 1600 && __maxW > 200;
          // CPH-NAME-WIDTH-001b: scrollWidth equals the GRID CELL once the
          // text is narrower than the band (the stretched child clips nothing),
          // which fed the fit a 745px "name width" and shrank the name to 15px.
          // Measure the true text INK width via a Range (normalized to CSS px);
          // the contact's condense transform is divided back out via its
          // matrix a-value so __Wc is the UNSCALED text width.
          var __rngW = function (el) {
            try { var r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect().width; }
            catch (_) { return 0; }
          };
          var __kCur = 1;
          try {
            var __tm = getComputedStyle(__contEl).transform;
            if (__tm && __tm !== 'none') { var __ma = __tm.match(/matrix\(([-\d.]+)/); if (__ma) __kCur = Math.max(0.5, Math.min(1.2, parseFloat(__ma[1]) || 1)); }
          } catch (_) {}
          var __Wn = __rngW(__nameEl) / __sc;
          var __chars = Math.max(8, String(__nameEl.textContent || '').trim().length - 1);
          var __lsCur = parseFloat(getComputedStyle(__nameEl).letterSpacing) || 0;
          var __fsCur = parseFloat(getComputedStyle(__nameEl).fontSize) || 22;
          // CPH-NAME-WIDTH-001 (owner 2026-07-24, supersedes the round-5
          // direction): the CONTACT fits the band first; the NAME then grows
          // (or shrinks) so its tracked width MATCHES the contact's fitted
          // width. Explicit Font sizes (pt) panel values (sparse
          // styleConfig.fontSizes) win over the auto-fit on every line. The
          // same rule runs worker-side (__cphNameFit, docx-worker 1.14.166)
          // for export parity-by-rule.
          var __fsOv = {};
          try {
            var __scRaw = localStorage.getItem('styleConfig');
            var __scP = __scRaw ? JSON.parse(__scRaw) : null;
            if (typeof __scP === 'string') __scP = JSON.parse(__scP);
            __fsOv = (__scP && __scP.fontSizes) || {};
          } catch (_) { __fsOv = {}; }
          var __pt2px = function (pt) { return pt * 96 / 72; };
          if (__sane && __Wn > 150) {
            var __nat0 = Math.max(50, __Wn - __lsCur * __chars);   // width at zero tracking, current font
            // CONTACT first: fill the band (photo-cleared) width.
            var __Wc = __contEl !== __nameEl ? (__rngW(__contEl) / __sc / __kCur) : 0;
            var __cfs = parseFloat(getComputedStyle(__contEl).fontSize) || 13;
            var __per = __Wc / __cfs;                              // px of width per font-px (constant)
            var __contactFinalW = __maxW;
            if (__Wc > 100 && __per > 15 && __per < 120) {
              var __f, __k;
              if (typeof __fsOv.contactSize === 'number' && __fsOv.contactSize > 0) {
                __f = Math.round(__pt2px(__fsOv.contactSize) * 2) / 2;   // panel value wins
                __k = Math.max(0.72, Math.min(1, __maxW / (__per * __f)));
              } else {
                __f = Math.max(10.5, Math.min(13, __maxW / (__per * 0.88)));
                __f = Math.round(__f * 2) / 2;
                __k = Math.max(0.72, Math.min(1, __maxW / (__per * __f)));
              }
              __fit.contFs = __f;
              __fit.contK = __k;
              __contactFinalW = Math.min(__maxW, __per * __f * __k);
            }
            // NAME second: width-match the contact line. CPH-NAME-WIDTH-001c:
            // the one-shot nat0 solve inherited whatever measurement bias the
            // pass had (a pre-webfont pass measured the FALLBACK face and its
            // cached result stuck ~12% narrow). Feedback form instead: scale
            // the CURRENT font by the RENDERED width error — each scheduled
            // pass measures the applied state, so any model bias divides out
            // and the ink converges onto the target (2% hysteresis).
            // CPH-NAME-WIDTH-001d: the equality target is the contact line AS
            // RENDERED — its owner-locked floors (10.5px / scaleX .72) can keep
            // it wider than the photo-cleared __maxW, and clamping the name to
            // __maxW left a permanent 390-vs-417 gap. Cap only at the band
            // padding; the few px past the photo clearance are accepted (the
            // contact already runs that wide).
            var __contactInkNow = __contEl !== __nameEl ? (__rngW(__contEl) / __sc) : 0;
            var __target = (__contactInkNow > 100)
              ? Math.min(__contactInkNow, __cssW - 32)
              : Math.min(__contactFinalW, __maxW);
            var __TRACK_EM = 0.14;
            var __fs2, __ls2;
            if (typeof __fsOv.nameSize === 'number' && __fsOv.nameSize > 0) {
              __fs2 = Math.round(__pt2px(__fsOv.nameSize) * 2) / 2;      // panel value wins
              __ls2 = (__target - __nat0 * (__fs2 / __fsCur)) / __chars; // tracking absorbs the remainder
              __ls2 = Math.max(0.5, Math.min(4.8, __ls2));
            } else {
              var __err = __Wn > 0 ? (__target / __Wn) : 1;
              __fs2 = (__err > 1.02 || __err < 0.98) ? (__fsCur * __err) : __fsCur;
              __fs2 = Math.max(15, Math.min(34, Math.round(__fs2 * 2) / 2));
              __ls2 = Math.max(0.5, Math.min(4.8, __TRACK_EM * __fs2));
            }
            __fit.nameFs = __fs2;
            __fit.nameLs = __ls2;
          }
        }
      } catch (_) {}
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
    // CPH-NAME-WIDTH-001 (owner 2026-07-24, supersedes the 2026-07-23 23px
    // lock): 23px is only the PRE-FIT default — the measured fit rules emitted
    // last override it with the width-matched size. Spec/contact statics honor
    // the Font sizes (pt) panel when set (pt -> px at 96/72).
    var __fsOv0 = {};
    try {
      var __scR0 = localStorage.getItem('styleConfig');
      var __scP0 = __scR0 ? JSON.parse(__scR0) : null;
      if (typeof __scP0 === 'string') __scP0 = JSON.parse(__scP0);
      __fsOv0 = (__scP0 && __scP0.fontSizes) || {};
    } catch (_) { __fsOv0 = {}; }
    var __px0 = function (pt, dflt) { return (typeof pt === 'number' && pt > 0) ? Math.round(pt * 96 / 72 * 2) / 2 : dflt; };
    css += BAND + ' > div:first-of-type{font-size:' + __px0(__fsOv0.nameSize, 23) + 'px !important;}';
    css += BAND + ' > div:nth-of-type(2):not(:last-of-type){font-size:' + __px0(__fsOv0.specialisation, 18) + 'px !important;}';
    css += BAND + ' > div:last-of-type:not(:first-of-type){font-size:' + __px0(__fsOv0.contactSize, 13) + 'px !important;}';
    // APPLINE-SPACING-001 (owner 2026-07-23 "the application line is too far from
    // the slogan and too close to the horizontal line"): pull the line UP toward
    // the slogan and open air between the text and its rule underneath.
    css += '.antcv-preview-paper [data-antcv-app-line-native]{margin-top:-7px !important;padding-bottom:7px !important;}';
    // SPEC-LINE-COLOR-001 (owner 2026-07-23 "proper color for the specialization
    // line"): the band render inks the spec line with the header ink (white);
    // mockup wants the cyan #01B9BD. Branded apps still win via the
    // header-elem-colors inline accent paint (inline style beats stylesheet).
    css += BAND + ' > div:nth-of-type(2):not(:last-of-type){color:var(--header-spec-color, #01B9BD) !important;}';
    // CPH-FIT-STABLE-001b: the cached fit rules are emitted LAST so they beat
    // every static sizing rule above (same specificity — source order decides).
    // Emitted UNCONDITIONALLY: a pass that could not measure (band mid-re-render)
    // still re-asserts the chosen fit, so the lines can never snap back.
    if (__fit.nameLs != null) css += BAND + ' > div:first-of-type{letter-spacing:' + __fit.nameLs.toFixed(2) + 'px !important;}';
    if (__fit.nameFs != null) css += BAND + ' > div:first-of-type{font-size:' + __fit.nameFs + 'px !important;}';
    if (__fit.contFs != null) css += BAND + ' > div:last-of-type:not(:first-of-type){font-size:' + __fit.contFs + 'px !important;}';
    if (__fit.contK != null) css += BAND + ' > div:last-of-type:not(:first-of-type){transform:scaleX(' + __fit.contK.toFixed(3) + ') !important;transform-origin:center !important;}';
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

  // CPH-SIDEBAR-TRACK-001 (owner 2026-07-23 "if I resize the sidebar the picture
  // is not moving with it"): the photo column is sized from the live-measured
  // sidebar width, but apply() only re-ran on section events + boot timers — a
  // live sidebar DRAG fires neither. Observe the sidebar panel's own size and
  // re-derive on real width changes. Hazards respected: setTimeout debounce,
  // NEVER rAF (memory island-raf-freeze); the observer only rewrites OUR OWN
  // <style> tag, never React nodes (memory sidecar-global-observer-breaks-React);
  // >1px hysteresis so band-internal changes can't feedback-loop.
  var __sbRO = null, __sbROT = null, __sbLastW = 0;
  function watchSidebar() {
    try {
      if (!window.ResizeObserver) return;
      var sb = document.querySelector('.antcv-preview-paper [data-antcv-document-sidebar]');
      if (!sb || sb.__antcvCphSbWatched) return;
      if (!__sbRO) __sbRO = new ResizeObserver(function () {
        clearTimeout(__sbROT);
        __sbROT = setTimeout(function () {
          try {
            var el = document.querySelector('.antcv-preview-paper [data-antcv-document-sidebar]');
            var w = el ? Math.round(el.getBoundingClientRect().width) : 0;
            if (w && Math.abs(w - __sbLastW) > 1) { __sbLastW = w; apply(); }
          } catch (_) {}
        }, 120);
      });
      __sbRO.observe(sb);            // a replaced node re-registers on the next apply()
      sb.__antcvCphSbWatched = true;
    } catch (_) {}
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
    try { watchSidebar(); } catch (_) {}   // CPH-SIDEBAR-TRACK-001: re-arm on re-renders
  }

  // React to the flag being toggled in this tab (custom event) or another tab
  // (storage event), and re-assert on the app's re-render nudges.
  window.addEventListener('storage', function (e) { if (!e || e.key === FLAG || e.key == null) apply(); });
  window.addEventListener('antcv:sections-updated', apply);
  document.addEventListener('DOMContentLoaded', apply);
  // CPH-NAME-WIDTH-001c: a pass that measured the FALLBACK face caches a
  // skewed fit — re-derive once the real webfonts are in.
  try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { setTimeout(apply, 50); }); } catch (_) {}
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
    // CPH-SPEC-MIDLINE-001 live dial: positive = lower. AntcvCopenhagenV2.specDy(16)
    specDy: function (px) {
      try { localStorage.setItem('antcv:cph-spec-dy', String(px == null ? 12 : px)); } catch (_) {}
      apply();
      return 'spec downshift ' + (px == null ? 12 : px) + 'px';
    },
    _apply: apply
  };
})();
