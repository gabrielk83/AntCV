/* AntCV cover-letter length sidecar (v1.50.560) — owner 2026-06-17
 * ============================================================================
 * Adds a "Target cover-letter length" dropdown in Advanced Styles, directly
 * UNDER the "Target CV length" control. Stores localStorage["pageBudgetCl"]
 * (JSON-stringified, like pageBudget) which the CV/CL generation prompt reads
 * via u.get("pageBudgetCl", 1). Cover letters are ≤ 1.5 pages (cl-skeleton.md).
 *
 * Per-style DEFAULT when unset: Nordic Minimal + Cold Outreach = 1 page;
 * Mediterranean / Context-Rich / Prestige-Structured = 1.5; else 1.
 * (Owner: "for nordic minimal a length of = 1.")
 * ============================================================================
 */
(function () {
  'use strict';
  var VERSION = '1.50.560-cl-length';
  if (window.__antcvClLength560 === VERSION) return;
  window.__antcvClLength560 = VERSION;

  var STORAGE_KEY = 'pageBudgetCl';
  var OPTIONS = [
    { v: 1.0, label: '1 page', hint: 'One page — tight. Default for Nordic Minimal and Cold Outreach.' },
    { v: 1.5, label: '1.5 pages', hint: 'Up to 1.5 pages — for the more expansive styles (Mediterranean, Context-Rich, Prestige).' },
  ];

  function activeStyle() {
    // The app stores the active writing style in localStorage["toneRegister"]
    // (JSON-stringified id, e.g. "nordic-minimal" — see app.src.js u.get/set).
    // Fall back to personalInfo.writingPrefs.style for older data.
    try { var tr = localStorage.getItem('toneRegister'); if (tr) { var v = JSON.parse(tr); if (typeof v === 'string' && v) return v; } } catch (_) {}
    try { var pi = JSON.parse(localStorage.getItem('personalInfo') || '{}') || {}; return (pi.writingPrefs && pi.writingPrefs.style) || ''; } catch (_) { return ''; }
  }
  function styleDefault() {
    var s = activeStyle();
    if (s === 'mediterranean-formal' || s === 'context-rich' || s === 'prestige-structured') return 1.5;
    return 1; // nordic-minimal, cold-outreach, and everything else default to 1 page
  }
  function read() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw == null || raw === '') return styleDefault();
      var v = JSON.parse(raw);
      return (typeof v === 'number' && v > 0 && v <= 1.5) ? v : styleDefault();
    } catch (_) { return styleDefault(); }
  }
  function write(v) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); window.dispatchEvent(new CustomEvent('antcv:cl-budget-changed', { detail: { value: v } })); } catch (_) {}
  }
  window.AntcvClLength = { get: read, set: write, OPTIONS: OPTIONS, STORAGE_KEY: STORAGE_KEY };

  function buildRow() {
    var wrap = document.createElement('div');
    wrap.setAttribute('data-antcv-cl-budget-row', '1');
    wrap.style.cssText = 'margin: 0 0 14px 0; padding: 10px 12px; background: rgba(1,183,187,0.06); border: 1px solid rgba(1,183,187,0.25); border-radius: 6px;';
    var lbl = document.createElement('div');
    lbl.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.75);font-weight:600;margin-bottom:6px;letter-spacing:0.3px;';
    lbl.textContent = 'Target cover-letter length';
    wrap.appendChild(lbl);
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;';
    wrap.appendChild(row);
    var select = document.createElement('select');
    select.style.cssText = 'flex: 1 1 140px; min-width: 140px; padding: 5px 8px; font-size: 11px; background: rgba(255,255,255,0.06); color: #fff; border: 1px solid rgba(255,255,255,0.18); border-radius: 4px; font-family: inherit;';
    var current = read();
    OPTIONS.forEach(function (opt) {
      var o = document.createElement('option');
      o.value = String(opt.v); o.textContent = opt.label; o.style.color = '#1a1a1a'; o.style.background = '#ffffff';
      if (Math.abs(opt.v - current) < 0.001) o.selected = true;
      select.appendChild(o);
    });
    row.appendChild(select);
    var hint = document.createElement('div');
    hint.style.cssText = 'font-size:9.5px;color:rgba(255,255,255,0.5);margin-top:6px;line-height:1.45;';
    function refreshHint(v) { var opt = OPTIONS.find(function (o) { return Math.abs(o.v - v) < 0.001; }) || OPTIONS[0]; hint.textContent = opt.hint; }
    refreshHint(current);
    wrap.appendChild(hint);
    select.addEventListener('change', function () { var v = parseFloat(select.value); if (isNaN(v)) return; write(v); refreshHint(v); });
    var note = document.createElement('div');
    note.style.cssText = 'font-size:9px;color:rgba(255,255,255,0.4);margin-top:8px;line-height:1.4;';
    note.textContent = 'Aims the cover letter at this length during generation. Defaults to 1 page for Nordic Minimal.';
    wrap.appendChild(note);
    return wrap;
  }

  function inject() {
    if (document.querySelector('[data-antcv-cl-budget-row="1"]')) return;
    var cvRow = document.querySelector('[data-antcv-page-budget-row="1"]');
    if (!cvRow || !cvRow.parentElement) return; // wait for the CV-length row (antcv-page-budget.js)
    cvRow.parentElement.insertBefore(buildRow(), cvRow.nextSibling);
  }

  var scheduled = false;
  function schedule() { if (scheduled) return; scheduled = true; requestAnimationFrame(function () { scheduled = false; try { inject(); } catch (_) {} }); }
  function start() { schedule(); try { new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true }); } catch (_) {} }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
