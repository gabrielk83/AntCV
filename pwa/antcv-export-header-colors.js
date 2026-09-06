/* antcv-export-header-colors.js — EXPORT-HEADER-COLORS-001 (owner 2026-07-22)
 * ===========================================================================
 * DOCX 1:1 parity for the per-element header colours + the application-line rule.
 *
 * The preview engine (HEADER-ELEM-COLORS-001) paints name/spec/contact/slogan/
 * application with DIFFERENT colours (override store `antcv:headerElemColors`, else
 * the brand slots — spec=accent, slogan=sloganColor, …). But the export payload
 * carries the brand-COLLAPSED styleConfig (COMPANY-BRAND-FIT-001 sets
 * headerNameColor=SpecColor=ContactColor=ink), so the DOCX didn't match the
 * screen. This request-only fetch guard patches the /generate payload sent to the
 * docx worker with the SAME per-element values the engine applies:
 *   payload.style.headerNameColor / headerSpecColor / headerContactColor
 *   payload.meta.slogan_color
 *   payload.meta.app_line_color        (NEW — the worker gray-defaults the app line)
 *   payload.meta.app_line_rule {on,color,pt}  (NEW — the #6 rule under the app line)
 * Worker colours are 6-hex WITHOUT '#'. No brand + no override => no patch (export
 * keeps its own colours, matching the dormant preview). Kill:
 * localStorage['antcv:disable-export-header-colors']='1'.
 */
(function () {
  'use strict';
  if (window.__antcvExportHeaderColors) return;
  window.__antcvExportHeaderColors = '1.2';
  var origFetch = window.fetch;
  if (typeof origFetch !== 'function') return;

  var KILL = 'antcv:disable-export-header-colors';
  function killed() { try { return localStorage.getItem(KILL) === '1'; } catch (_) { return false; } }
  function readJSON(k) { try { var r = localStorage.getItem(k); return r ? JSON.parse(r) : null; } catch (_) { return null; } }
  function hex6(c) { c = String(c || '').replace('#', '').trim(); return /^[0-9a-fA-F]{6}$/.test(c) ? c.toUpperCase() : ''; }

  // BRANDV2-SLOTS-UNWRAP-001 (1.51.4146): v2 brand objects nest colours under
  // .slots — reading them at the top level made every colorFor() return ''
  // (same defect as the preview engine; both patched in lockstep).
  function brand() {
    var m = readJSON('meta') || {};
    var b = (m && m.brandV2) || readJSON('antcv:brandV2') || null;
    if (b && b.slots && typeof b.slots === 'object') return Object.assign({}, b, b.slots);
    return b;
  }
  function ov(elem) { var o = readJSON('antcv:headerElemColors') || {}; return hex6(o[elem]); }
  // SPEC-CONTRAST-GUARD-001 (1.51.4146): mirror of the preview engine's guard —
  // brand inks below the 3:1 AA large-text floor against the band fall back to
  // headerInk so DOCX/PDF match the (guarded) screen. Overrides not guarded.
  function lum(c) {
    c = String(c || '').replace('#', '');
    if (!/^[0-9a-fA-F]{6}$/.test(c)) return null;
    var f = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(parseInt(c.slice(0, 2), 16)) + 0.7152 * f(parseInt(c.slice(2, 4), 16)) + 0.0722 * f(parseInt(c.slice(4, 6), 16));
  }
  function contrastOk(ink, bg) {
    var a = lum(ink), b = lum(bg);
    if (a == null || b == null) return true;
    var hi = Math.max(a, b), lo = Math.min(a, b);
    return (hi + 0.05) / (lo + 0.05) >= 3;
  }
  function guard(color, b) {
    if (!color || !b) return color;
    var bg = hex6(b.headerBg); if (!bg) return color;
    if (contrastOk(color, bg)) return color;
    var ink = hex6(b.headerInk) || hex6(b.headerNameColor);
    if (ink && contrastOk(ink, bg)) return ink;
    return (lum(bg) != null && lum(bg) > 0.4) ? '1A1A1A' : 'FFFFFF';
  }
  // SLOGAN-PAPER-CONTRAST-001 (1.51.4526): mirror of the preview engine — the
  // slogan sits on the WHITE paper, so it is guarded against white, never the
  // band. The band guard sent FFFFFF for every dark-band brand; the worker's
  // sloganColorOnWhite then darkened that white to a mid-grey, so DOCX/PDF lost
  // the brand slogan colour too. Chain: sloganColor, accent, headerBg, near-black.
  function guardOnPaper(cands) {
    for (var i = 0; i < cands.length; i++) { var c = hex6(cands[i]); if (c && contrastOk(c, 'FFFFFF')) return c; }
    return '1A1A1A';
  }
  // Mirror the engine's per-element mapping (colorFor).
  function colorFor(elem) {
    var o = ov(elem); if (o) return o;
    // COPENHAGEN-STAGE4 (2026-07-23): the preview paints the app line grey for
    // EVERY app (elem-colors APP_GRAY), branded or not — forward it before the
    // brand gate so a brandless DOCX/PDF matches the screen.
    if (elem === 'application') return '595959';
    var b = brand(); if (!b) return '';
    switch (elem) {
      case 'name':
      case 'contact': return guard(hex6(b.headerInk) || hex6(b.headerNameColor) || '', b);
      case 'spec': return guard(hex6(b.accent) || '', b);
      case 'slogan': return (hex6(b.sloganColor) || hex6(b.accent)) ? guardOnPaper([b.sloganColor, b.accent, b.headerBg]) : '';
      default: return '';
    }
  }

  function patch(payload) {
    var changed = false;
    var name = colorFor('name'), spec = colorFor('spec'), contact = colorFor('contact'), slog = colorFor('slogan'), app = colorFor('application');
    if (name || spec || contact) {
      if (!payload.style || typeof payload.style !== 'object') payload.style = {};
      if (name) { payload.style.headerNameColor = name; changed = true; }
      if (spec) { payload.style.headerSpecColor = spec; changed = true; }
      if (contact) { payload.style.headerContactColor = contact; changed = true; }
    }
    if (slog || app) {
      if (!payload.meta || typeof payload.meta !== 'object') payload.meta = {};
      if (slog) { payload.meta.slogan_color = slog; payload.slogan_color = slog; changed = true; }
      if (app) { payload.meta.app_line_color = app; changed = true; }
    }
    // HEADER-RULE-DEFAULTS-002 (owner 2026-07-23): the application rule lives in
    // headerItemRule.application (legacy antcv:applineRule as fallback) and is
    // DEFAULT-VISIBLE; the slogan rule (headerItemRule.slogan) is default-hidden.
    var hir = readJSON('headerItemRule') || {};
    var ar = Object.assign({}, readJSON('antcv:applineRule') || {}, (hir.application && typeof hir.application === 'object') ? hir.application : {});
    if (typeof ar.on !== 'boolean') ar.on = true;    // def-visible
    if (!payload.meta || typeof payload.meta !== 'object') payload.meta = {};
    // COPENHAGEN-STAGE4: rule colour prefers TEAL (the preview appline-rule
    // accent default), never the grey app-line text; default thickness 1.5pt
    // (the mockup-locked preview default — was 0.75).
    payload.meta.app_line_rule = ar.on ? { on: true, color: hex6(ar.color) || spec || '', pt: (Number(ar.pt) || 1.5) } : { on: false };
    changed = true;
    var sr = (hir.slogan && typeof hir.slogan === 'object') ? hir.slogan : {};
    if (sr.on === true) {
      payload.meta.slogan_rule = { on: true, color: hex6(sr.color) || slog || '', pt: (Number(sr.pt) || 0.75) };
    }
    return changed;
  }

  window.fetch = function (url, init) {
    try {
      if (!killed() && init && init.method === 'POST' && init.body) {
        var u = ''; try { u = (typeof url === 'string') ? url : (url && url.url) || ''; } catch (_) {}
        // COPENHAGEN-STAGE4: /generate-pdf builds from the SAME payload — the
        // old /generate-only match left every CloudConvert PDF unpatched (the
        // screen showed per-element colours the PDF never got).
        if (/\/generate(-pdf)?(\?|$)/.test(String(u)) && typeof init.body === 'string' && init.body.charAt(0) === '{') {
          var p = null; try { p = JSON.parse(init.body); } catch (_) { p = null; }
          if (p && (p.sections !== undefined || p.style !== undefined)) {
            if (patch(p)) {
              var copy = {}; for (var k in init) if (Object.prototype.hasOwnProperty.call(init, k)) copy[k] = init[k];
              copy.body = JSON.stringify(p);
              try { console.debug('[export-header-colors] patched /generate payload colours'); } catch (_) {}
              return origFetch.call(window, url, copy);
            }
          }
        }
      }
    } catch (e) { try { console.warn('[export-header-colors] passthrough', e && e.message); } catch (_) {} }
    return origFetch.call(window, url, init);
  };

  window.AntcvExportHeaderColors = { version: '1.2', _colorFor: colorFor, _patch: patch };
  try { console.debug('[export-header-colors] installed'); } catch (_) {}
})();
