/* antcv-brandfit-sample.js — BRAND-FIT-PALETTE-001 (spec rule 37, row 28)
 * ============================================================================
 * Owner (NIL round): "brand fit selected but the export stayed on the default
 * copenhagen palette — a failed brand fit." The apply layer EXISTS
 * (COMPANY-BRAND-FIT-001: validates the gen's brand_fit, persists navy,
 * patches styleConfig, flips the package to custom) — but it only ever ran on
 * the LLM's returned brand_fit object, and the model omits/fails it even when
 * the JD text literally carries the brand colour codes (the NIL ad names
 * "logo blue #0373c6 / dark navy #00355a"). Rule 38: the checkable half is now
 * DETERMINISTIC.
 *
 * This sidecar defines window.__antcvBrandFitSample(): sample 6-digit hex
 * colour codes straight from the attached JD text (antcv:lastJdText) and shape
 * them like a gen brand_fit object. The generation flow (both bundles) falls
 * back to it when the model returned no usable brand_fit — the SAME validated
 * apply path runs (hex check, dark-enough gate, custom package flip), so a
 * too-light sample can never put white-on-white in the header.
 *
 *  - navy   = the darkest sampled colour, darkened further when it fails the
 *             app's white-text luminance gate (< 0.62);
 *  - accent = the next distinct sampled colour (or the undarkened original);
 *  - near-white chrome colours (luminance > 0.85) are never candidates.
 *
 * Returns null when brand-fit sampling has nothing real to say (no JD, no hex
 * codes) — the apply block then no-ops exactly as before. The opt-in gate is
 * unchanged: the 🎨 checkbox (session-only by design) still decides whether
 * ANY brand fit runs. Kill: localStorage['antcv:disable-brandfit-sample']='1'.
 */
(function () {
  'use strict';
  var VERSION = '1.51.123-brandfit-sample';
  if (window.__antcvBrandFitSampleVersion) return;
  window.__antcvBrandFitSampleVersion = VERSION;

  function disabled() { try { var v = localStorage.getItem('antcv:disable-brandfit-sample'); return v === '1' || v === 'true'; } catch (_) { return false; } }

  function lum(hex) {
    var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }
  function darken(hex, target) {
    var l = lum(hex);
    if (l < target) return hex;
    var f = l > 0 ? (target * 0.92) / l : 0;
    var c = function (i) {
      var v = Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * f)));
      return (v < 16 ? '0' : '') + v.toString(16);
    };
    return '#' + c(1) + c(3) + c(5);
  }

  function sample() {
    if (disabled()) return null;
    var jd = '';
    try { jd = String(localStorage.getItem('antcv:lastJdText') || ''); } catch (_) {}
    if (jd.trim().length < 30) return null;
    var m = jd.match(/#[0-9a-fA-F]{6}\b/g);
    if (!m || !m.length) return null;
    var seen = {}, hexes = [];
    m.forEach(function (h) {
      h = h.toLowerCase();
      if (seen[h]) return;
      seen[h] = 1;
      if (lum(h) > 0.85) return;          // page-background chrome, never a brand header
      hexes.push(h);
    });
    if (!hexes.length) return null;
    hexes.sort(function (a, b) { return lum(a) - lum(b); });
    var darkest = hexes[0];
    var navy = darken(darkest, 0.62);
    var accent = null;
    for (var i = 1; i < hexes.length; i++) { if (hexes[i] !== navy) { accent = hexes[i]; break; } }
    if (!accent && darkest !== navy) accent = darkest;   // darkened navy keeps the original as the accent
    var out = { navy: navy, source: 'Sampled deterministically from colour codes in the job ad text (' + hexes.slice(0, 3).join(', ') + ')' };
    if (accent) out.accent = accent;
    return out;
  }

  window.__antcvBrandFitSample = sample;
  window.AntcvBrandFitSample = { version: VERSION, sample: sample, _lum: lum, _darken: darken };
})();
