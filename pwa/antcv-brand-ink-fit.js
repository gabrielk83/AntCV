/* BRAND-INK-FIT-001 (2026-10-20) — one ink rule for every brand writer.
 *
 * Terma, app 3511: the band was painted yellow (#ffc92b) while the stored
 * styleConfig still carried headerInk/sidebarInk = #ffffff from an earlier
 * brand record. Two key families describe the same ink:
 *   header : headerInk | headerNameColor, headerSpecColor, headerContactColor
 *   sidebar: sidebarInk | sidebarTextColor, sidebarHeadColor
 * The fresh-generate path wrote only the second family, the JobTracker Open
 * path and gen-runner only the first, and wa() merges patches over the old
 * styleConfig — so a stale ink from one brand survived onto the next brand's
 * band. Result: white text on a near-white band/sidebar.
 *
 * This file exposes:
 *   window.__antcvInkFor(bg, preferred)  -> preferred if it reads on bg
 *                                           (>= 4.5:1), else black/white.
 *   window.__antcvInkFit(cfg, patch)     -> mutates a merged styleConfig so
 *                                           both families agree and read on
 *                                           their own background.
 * and wraps window.__antcvResolvePaperVars so the preview paper can never
 * resolve an ink that fails contrast against the band/sidebar it sits on.
 * Kill switch: localStorage antcv:disable-brand-ink-fit=1.
 */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  var AA = 4.5;
  var DARK = '#111111', LIGHT = '#FFFFFF';
  function off() { try { return localStorage.getItem('antcv:disable-brand-ink-fit') === '1'; } catch (_) { return false; } }
  function hex(v) {
    if (typeof v !== 'string') return null;
    var s = v.trim(); if (s[0] !== '#') s = '#' + s;
    return /^#[0-9a-fA-F]{6}$/.test(s) ? s : null;
  }
  function lin(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function lum(h) { return 0.2126 * lin(parseInt(h.slice(1, 3), 16)) + 0.7152 * lin(parseInt(h.slice(3, 5), 16)) + 0.0722 * lin(parseInt(h.slice(5, 7), 16)); }
  function ratio(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function best(bg) { return ratio(bg, DARK) >= ratio(bg, LIGHT) ? DARK : LIGHT; }

  function inkFor(bg, preferred) {
    var b = hex(bg); var p = hex(preferred);
    if (!b) return p || null;
    if (p && ratio(p, b) >= AA) return p;
    return best(b);
  }

  var GROUPS = [
    { bg: 'headerBg', alias: 'headerInk', keys: ['headerNameColor', 'headerSpecColor', 'headerContactColor'] },
    { bg: 'sidebarBg', alias: 'sidebarInk', keys: ['sidebarTextColor', 'sidebarHeadColor'] },
  ];

  // cfg: the merged styleConfig about to be saved. patch: what the caller set.
  // The caller's own ink wins when it reads; an ink the caller did NOT set is
  // treated as possibly stale and re-derived from the (possibly new) bg.
  function inkFit(cfg, patch) {
    if (!cfg || typeof cfg !== 'object' || off()) return cfg;
    patch = patch && typeof patch === 'object' ? patch : {};
    GROUPS.forEach(function (g) {
      var bg = hex(cfg[g.bg]); if (!bg) return;
      var all = [g.alias].concat(g.keys);
      // The ink the caller explicitly provided in THIS patch, if any.
      var given = null;
      for (var i = 0; i < all.length && !given; i++) if (Object.prototype.hasOwnProperty.call(patch, all[i])) given = hex(patch[all[i]]);
      var bgChanged = Object.prototype.hasOwnProperty.call(patch, g.bg);
      var ink = inkFor(bg, given || (bgChanged ? null : hex(cfg[g.keys[0]]) || hex(cfg[g.alias])));
      all.forEach(function (k) {
        // sidebarHeadColor may be a deliberate brand accent; keep it only if it reads.
        if (k === 'sidebarHeadColor' && !Object.prototype.hasOwnProperty.call(patch, k) && hex(cfg[k]) && ratio(hex(cfg[k]), bg) >= AA && !bgChanged) return;
        if (Object.prototype.hasOwnProperty.call(patch, k) && hex(patch[k]) && ratio(hex(patch[k]), bg) >= AA) { cfg[k] = hex(patch[k]); return; }
        cfg[k] = ink;
      });
    });
    return cfg;
  }

  window.__antcvInkFor = inkFor;
  window.__antcvInkFit = inkFit;

  // Preview paper: guard the resolved vars against their own background.
  function wrapResolver() {
    var orig = window.__antcvResolvePaperVars;
    if (typeof orig !== 'function' || orig.__inkFit) return !!orig;
    var wrapped = function () {
      var v = orig.apply(this, arguments);
      if (!v || typeof v !== 'object' || off()) return v;
      try {
        var hb = hex(v['--header-bg']), sb = hex(v['--sidebar-bg']);
        if (hb) ['--header-name-color', '--header-spec-color', '--header-contact-color'].forEach(function (k) { if (k in v) v[k] = inkFor(hb, v[k]); });
        if (sb) ['--sidebar-text-color', '--sidebar-head-color'].forEach(function (k) { if (k in v) v[k] = inkFor(sb, v[k]); });
      } catch (_) {}
      return v;
    };
    wrapped.__inkFit = true;
    window.__antcvResolvePaperVars = wrapped;
    return true;
  }
  if (!wrapResolver()) {
    var tries = 0;
    var t = setInterval(function () { if (wrapResolver() || ++tries > 40) clearInterval(t); }, 250);
  }
})();
