/* antcv-header-elem-colors.js — HEADER-ELEM-COLORS-001 (owner 2026-07-22)
 * ===========================================================================
 * Per-element BRAND colours for the header, the Ibsen scheme:
 *   name    -> brand ink   (white on the dark band)
 *   spec    -> brand ACCENT (Ibsen orange)
 *   contact -> brand ink   (white)
 *   slogan  -> brand SLOGAN colour (Ibsen deep blue)  [CL]
 *   application (role·company line) -> muted dark gray [CL]
 *
 * WHY this layer: the live band hardcodes white for name/spec/contact and
 * ignores the palette; COMPANY-BRAND-FIT-001 collapses name=spec=contact into a
 * single ink. The owner's spec needs DIFFERENT colours per element. This sidecar
 * applies the correct per-element mapping at render time, reading the PER-APP
 * brand object (antcv:brandV2 / meta.brandV2) — so it is scoped to the branded
 * app and cannot leak globally (avoids the palette-stick class). No brand => no
 * change (unbranded apps keep the default look).
 *
 * A per-element manual OVERRIDE store (antcv:headerElemColors) wins over the
 * brand value — this is what the forthcoming side-panel colour controls write.
 *
 * SAFETY: no global document.body subtree observer (that regressed React event
 * handling once — ANALYSIS-HEADER-EDITOR-GATE-001). Re-applies only on the app's
 * own 'antcv:sections-updated' nudge + a light editor-gated poll. Inline styles
 * are additive and cleared when a colour is unset. Kill-switch:
 * localStorage['antcv:disable-header-elem-colors']='1'.
 */
(function () {
  'use strict';
  if (window.__antcvHeaderElemColorsInstalled) return;
  window.__antcvHeaderElemColorsInstalled = '1.0';

  var KILL = 'antcv:disable-header-elem-colors';
  var OVERRIDE_KEY = 'antcv:headerElemColors';
  var APP_GRAY = '#595959';
  var STAMP = 'data-antcv-elem-colored';

  function killed() { try { return localStorage.getItem(KILL) === '1'; } catch (_) { return false; } }
  function readJSON(k) { try { var r = localStorage.getItem(k); return r ? JSON.parse(r) : null; } catch (_) { return null; } }
  function hex(v) { return (typeof v === 'string' && /^#?[0-9a-fA-F]{6}$/.test(v.trim())) ? (v.trim()[0] === '#' ? v.trim() : '#' + v.trim()) : ''; }
  function editorActive() {
    try { var v = window.__antcvView; return !(v === 'upload' || v === 'input' || v === 'generating'); } catch (_) { return true; }
  }

  // The per-app brand object (published by COMPANY-BRAND-FIT-001). meta.brandV2
  // mirrors the active app's brand; antcv:brandV2 is the global fallback.
  // BRANDV2-SLOTS-UNWRAP-001 (1.51.4146): v2 brand objects nest the colours
  // under .slots ({version:2, slots:{accent,…}}). This read the slots at the
  // TOP level, so every colorFor() returned '' and the paint silently no-op'd —
  // the Copenhagen cyan CSS fallback then stood (invisible on a light band).
  function brand() {
    var meta = readJSON('meta') || {};
    var b = (meta && meta.brandV2) || readJSON('antcv:brandV2') || null;
    if (b && b.slots && typeof b.slots === 'object') return Object.assign({}, b, b.slots);
    return b;
  }
  // SPEC-CONTRAST-GUARD-001 (1.51.4146): WCAG relative luminance + contrast
  // ratio. Brand-derived inks that cannot be read on the band (ratio < 3:1,
  // the AA large-text floor) fall back to the brand headerInk — the standing
  // "sampled brand colours keep vision-safe contrast" rule. Manual overrides
  // are NOT guarded (an explicit user choice wins).
  function lum(c) {
    c = String(c || '').replace('#', '');
    if (!/^[0-9a-fA-F]{6}$/.test(c)) return null;
    var f = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(parseInt(c.slice(0, 2), 16)) + 0.7152 * f(parseInt(c.slice(2, 4), 16)) + 0.0722 * f(parseInt(c.slice(4, 6), 16));
  }
  function contrastOk(ink, bg) {
    var a = lum(ink), b = lum(bg);
    if (a == null || b == null) return true; // unknown -> don't block
    var hi = Math.max(a, b), lo = Math.min(a, b);
    return (hi + 0.05) / (lo + 0.05) >= 3;
  }
  function guard(color, b) {
    if (!color || !b) return color;
    var bg = hex(b.headerBg); if (!bg) return color;
    if (contrastOk(color, bg)) return color;
    var ink = hex(b.headerInk) || hex(b.headerNameColor);
    if (ink && contrastOk(ink, bg)) return ink;
    return (lum(bg) != null && lum(bg) > 0.4) ? '#1a1a1a' : '#ffffff';
  }
  // Resolve the target colour for one element: manual override > brand slot.
  function colorFor(elem) {
    var ov = readJSON(OVERRIDE_KEY) || {};
    var o = hex(ov[elem]); if (o) return o;
    var b = brand(); if (!b) return '';
    switch (elem) {
      case 'name':
      case 'contact': return guard(hex(b.headerInk) || hex(b.headerNameColor) || '', b);
      case 'spec':    return guard(hex(b.accent) || '', b);
      case 'slogan':  return guard(hex(b.sloganColor) || hex(b.accent) || '', b);
      case 'application': return APP_GRAY;
      default: return '';
    }
  }

  // ---- element identification (verified live) -------------------------------
  function bandParts() {
    var band = document.querySelector('.antcv-preview-paper [data-antcv-candidate-band="1"]');
    if (!band) return {};
    var divs = Array.prototype.slice.call(band.querySelectorAll(':scope > div'))
      .filter(function (d) { return Array.prototype.some.call(d.childNodes, function (n) { return n.nodeType === 3 && n.textContent.trim(); }); });
    var contact = divs.filter(function (d) { return /[☎🔗⌂✉@]/.test(d.textContent) || /\d[\d\s]{6,}/.test(d.textContent); })[0];
    var name = divs[0];
    var spec = divs.filter(function (d) { return d !== name && d !== contact; })[0];
    return { name: name, spec: spec, contact: contact };
  }
  function slogan() {
    var paper = document.querySelector('.antcv-preview-paper');
    if (!paper) return null;
    // The slogan is either the slogan-sidecar wrapper OR the app's own
    // contenteditable "positioning line" div (title-identified), inside the CL flow.
    return paper.querySelector('[data-antcv-cl-slogan-element]') ||
      paper.querySelector('[title*="positioning line" i]') ||
      (function () {
        var flow = paper.querySelector('[data-antcv-cl-flow]');
        if (!flow) return null;
        return flow.querySelector('[contenteditable]:not([data-antcv-app-line])');
      })();
  }
  // APPLINE-NATIVE-MARK-001 (2026-07-23): the native line carries
  // data-antcv-app-line-native (the legacy attribute is swept by the retired
  // application-line-001 sidecar) — without this the grey paint never applied
  // and the line stayed teal.
  function appLine() { return document.querySelector('.antcv-preview-paper [data-antcv-app-line-native]') || document.querySelector('.antcv-preview-paper [data-antcv-app-line]'); }

  function paint(el, color) {
    if (!el) return;
    if (color) { el.style.setProperty('color', color, 'important'); el.setAttribute(STAMP, '1'); }
    else if (el.getAttribute(STAMP)) { el.style.removeProperty('color'); el.removeAttribute(STAMP); }
  }

  function apply() {
    if (killed() || !editorActive()) {
      // clear any colours we set
      ['name', 'spec', 'contact'].forEach(function (k) {}); // handled by paint('') below
    }
    var parts = bandParts();
    var off = killed() || !editorActive();
    paint(parts.name, off ? '' : colorFor('name'));
    paint(parts.spec, off ? '' : colorFor('spec'));
    paint(parts.contact, off ? '' : colorFor('contact'));
    paint(slogan(), off ? '' : colorFor('slogan'));
    paint(appLine(), off ? '' : colorFor('application'));
  }

  var deb = null;
  function schedule() { clearTimeout(deb); deb = setTimeout(apply, 120); }
  window.addEventListener('antcv:sections-updated', schedule);
  window.addEventListener('storage', function (e) { if (!e || e.key === OVERRIDE_KEY || e.key === 'antcv:brandV2' || e.key === 'meta' || e.key == null) schedule(); });
  document.addEventListener('DOMContentLoaded', apply);
  try { setInterval(apply, 1500); } catch (_) {}
  apply();

  window.AntcvHeaderColors = {
    version: '1.0',
    apply: apply,
    // set a manual per-element override (wins over brand); '' clears it.
    set: function (elem, color) {
      var ov = readJSON(OVERRIDE_KEY) || {};
      if (color) ov[elem] = color; else delete ov[elem];
      try { localStorage.setItem(OVERRIDE_KEY, JSON.stringify(ov)); } catch (_) {}
      apply();
      return ov;
    },
    get: function () { return readJSON(OVERRIDE_KEY) || {}; },
    _brand: brand,
    _parts: bandParts
  };
  try { console.debug('[header-elem-colors] installed'); } catch (_) {}
})();
