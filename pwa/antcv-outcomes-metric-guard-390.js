/* AntCV — OUTCOMES-METRIC-GUARD-001 (v1.50.390)
 * ============================================================
 *
 * Owner 2026-06-12: "make sure numerical outcomes are always present."
 *
 * The writing engines (cv-proxy + demo-proxy, live-verified) already flag a
 * metric-free SELECTED OUTCOMES section and retry up to 3 drafts — but the
 * third draft ships flagged:true and the app renders it SILENTLY (the
 * GEN-SCE-FLAG-001 finding). This guard is the LAST line of defence on the
 * render side: whenever the on-screen SELECTED OUTCOMES carries no numeric
 * token (same heuristic as the engine: any digit, or a written multiplier),
 * an amber warning chip pins to the section in the preview:
 *
 *   "⚠ No numeric outcome — add an on-record number"
 *
 * Clicking the chip focuses the outcomes section in the editor list (the
 * native ✨ Enhance there is the repair path). The guard never writes a
 * number itself — the engine's own rule: forcing a number risks
 * fabrication; a human picks the on-record metric.
 *
 * Checks run on boot, on storage 'sections' changes, and on preview
 * mutations (debounced). Kill switch: localStorage
 * 'antcv:metricguard:off' = '1'. API: window.AntcvMetricGuard.check().
 */
(function () {
  'use strict';

  if (window.__antcvOutcomesMetricGuardInstalled) return;
  var VERSION = '1.50.390';
  window.__antcvOutcomesMetricGuardInstalled = VERSION;

  var CHIP_CLASS = 'antcv-metric-guard-chip';
  function off() { try { return localStorage.getItem('antcv:metricguard:off') === '1'; } catch (_) { return false; } }

  function hasMetric(text) {
    return /\d/.test(text) || /\b(\d+x|tenfold|two-?fold|three-?fold|fourfold|halved|doubled|tripled)\b/i.test(text);
  }

  function outcomesSections() {
    // PWA shape: sections.{cv|cl} arrays; outcomes = id/title matching.
    var out = [];
    try {
      var root = JSON.parse(localStorage.getItem('sections') || '{}') || {};
      ['cv', 'cl'].forEach(function (doc) {
        (Array.isArray(root[doc]) ? root[doc] : []).forEach(function (s) {
          if (!s || s.on === false) return;
          var key = ((s.id || '') + ' ' + (s.title || '')).toLowerCase();
          if (/outcome/.test(key)) out.push(s);
        });
      });
    } catch (_) {}
    return out;
  }

  function sectionText(s) {
    var blob = '';
    (Array.isArray(s.items) ? s.items : []).forEach(function (it) {
      if (typeof it === 'string') blob += ' ' + it;
      else if (it && typeof it === 'object') {
        ['b', 't', 'v', 'l', 'title', 'body'].forEach(function (k) {
          if (typeof it[k] === 'string') blob += ' ' + it[k];
        });
      }
    });
    if (typeof s.content === 'string') blob += ' ' + s.content;
    return blob.trim();
  }

  function clearChips() {
    document.querySelectorAll('.' + CHIP_CLASS).forEach(function (c) { c.remove(); });
  }

  function pinChip(sid) {
    var host = document.querySelector('.antcv-preview-paper [data-sid="' + sid + '"]');
    if (!host || host.querySelector('.' + CHIP_CLASS)) return;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    var chip = document.createElement('button');
    chip.type = 'button';
    chip.className = CHIP_CLASS + ' no-print';
    chip.textContent = '⚠ No numeric outcome — add an on-record number';
    chip.title = 'SELECTED OUTCOMES has no number. The writing rules require at least one on-record metric (e.g. a cycle time, a % reduction, a team size). Click to open the section in the editor, then use ✨ Enhance or edit a bullet. Never invent a number.';
    chip.style.cssText = 'position:absolute;top:-10px;right:4px;z-index:5;padding:3px 9px;font-size:10px;font-weight:700;color:#7a4a00;background:#fff3d6;border:1px solid #d97706;border-radius:999px;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,0.18);';
    chip.addEventListener('click', function () {
      try {
        var row = Array.from(document.querySelectorAll('[data-section-row-index]'))
          .find(function (r) { return /outcome/i.test(r.textContent || ''); });
        if (row) {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          row.style.outline = '2px solid #d97706';
          setTimeout(function () { row.style.outline = ''; }, 2500);
        }
      } catch (_) {}
    });
    host.appendChild(chip);
  }

  function check() {
    if (off()) { clearChips(); return []; }
    var missing = [];
    outcomesSections().forEach(function (s) {
      var text = sectionText(s);
      if (text && !hasMetric(text)) missing.push(s.id);
    });
    clearChips();
    missing.forEach(pinChip);
    if (missing.length) {
      try { console.warn('[metric-guard] SELECTED OUTCOMES without a numeric metric:', missing.join(',')); } catch (_) {}
    }
    return missing;
  }

  var t = null;
  function schedule() { clearTimeout(t); t = setTimeout(check, 700); }
  window.addEventListener('storage', function (ev) { if (ev && ev.key === 'sections') schedule(); });
  var mo = new MutationObserver(schedule);
  function boot() {
    try { mo.observe(document.body, { childList: true, subtree: true }); } catch (_) {}
    setTimeout(check, 2000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.AntcvMetricGuard = { version: VERSION, check: check };
})();
