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
  window.__antcvExportHeaderColors = '1.0';
  var origFetch = window.fetch;
  if (typeof origFetch !== 'function') return;

  var KILL = 'antcv:disable-export-header-colors';
  function killed() { try { return localStorage.getItem(KILL) === '1'; } catch (_) { return false; } }
  function readJSON(k) { try { var r = localStorage.getItem(k); return r ? JSON.parse(r) : null; } catch (_) { return null; } }
  function hex6(c) { c = String(c || '').replace('#', '').trim(); return /^[0-9a-fA-F]{6}$/.test(c) ? c.toUpperCase() : ''; }

  function brand() { var m = readJSON('meta') || {}; return (m && m.brandV2) || readJSON('antcv:brandV2') || null; }
  function ov(elem) { var o = readJSON('antcv:headerElemColors') || {}; return hex6(o[elem]); }
  // Mirror the engine's per-element mapping (colorFor).
  function colorFor(elem) {
    var o = ov(elem); if (o) return o;
    var b = brand(); if (!b) return '';
    switch (elem) {
      case 'name':
      case 'contact': return hex6(b.headerInk) || hex6(b.headerNameColor) || '';
      case 'spec': return hex6(b.accent) || '';
      case 'slogan': return hex6(b.sloganColor) || hex6(b.accent) || '';
      case 'application': return '595959';
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
    var ar = readJSON('antcv:applineRule') || {};
    if (ar.on) {
      if (!payload.meta || typeof payload.meta !== 'object') payload.meta = {};
      payload.meta.app_line_rule = { on: true, color: hex6(ar.color) || app || spec || '', pt: (Number(ar.pt) || 0.75) };
      changed = true;
    }
    return changed;
  }

  window.fetch = function (url, init) {
    try {
      if (!killed() && init && init.method === 'POST' && init.body) {
        var u = ''; try { u = (typeof url === 'string') ? url : (url && url.url) || ''; } catch (_) {}
        if (/\/generate(\?|$)/.test(String(u)) && typeof init.body === 'string' && init.body.charAt(0) === '{') {
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

  window.AntcvExportHeaderColors = { version: '1.0', _colorFor: colorFor, _patch: patch };
  try { console.debug('[export-header-colors] installed'); } catch (_) {}
})();
