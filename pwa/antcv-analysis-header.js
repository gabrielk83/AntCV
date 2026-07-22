/* antcv-analysis-header.js — ANALYSIS-PANEL-HEADER-001 (owner 2026-07-22)
 * ===========================================================================
 * Owner: "in the analysis panel: start it by writing the job and company name,
 * analysis date." This additive sidecar renders a small header card at the TOP
 * of the in-app Analysis panel showing:  <role> · <company>   +   Analysis: <date>.
 *
 * Data sources (all localStorage, no network, never edits app.js):
 *   - role / company  -> `meta` (the same object app.js writes on generate:
 *     {"company":"3Shape","role":"Senior Project Manager ..."}).
 *   - analysis date    -> `antcv:analysis-date`, an ISO date this sidecar STAMPS
 *     whenever the JD-analysis result is merged (the `antcv:rationale-merge`
 *     event that antcv-fit-panel.js also listens to). Honest fallback: shown as
 *     "—" when no analysis has run in this browser for the loaded app (we do not
 *     fabricate a date). NOTE: full per-app persistence of the analysis date on
 *     cloud load is the "saved apps load ALL analysis data" work — tracked
 *     separately; this stamp is browser-local until that lands.
 *
 * Placement: FIRST child of the analysis panel container (reuses the 356
 * panel-finder), so it visually starts the panel. Rendered only while the panel
 * is in ANALYSIS mode (the report/jd-block anchors are present) — never over the
 * Section panel. Idempotent, kill-switch: localStorage['antcv:disable-analysis-header']='1'.
 */
(function () {
  'use strict';

  var VERSION = '1.0';
  if (window.__antcvAnalysisHeaderInstalled === VERSION) return;
  window.__antcvAnalysisHeaderInstalled = VERSION;

  var KILL_SWITCH = 'antcv:disable-analysis-header';
  var CARD_ID = 'antcv-analysis-header';
  var STYLE_ID = 'antcv-analysis-header-css';
  var DATE_KEY = 'antcv:analysis-date';

  function killed() { try { return localStorage.getItem(KILL_SWITCH) === '1'; } catch (_) { return false; } }
  function readJSON(key) { try { var r = localStorage.getItem(key); return r ? JSON.parse(r) : null; } catch (_) { return null; } }
  function readString(key, def) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return def || '';
      try { var p = JSON.parse(raw); return typeof p === 'string' ? p : String(raw); } catch (_) { return String(raw); }
    } catch (_) { return def || ''; }
  }
  function isDanish() { return /^da/i.test(readString('language', 'en')); }
  function T() {
    return isDanish()
      ? { role: 'Stilling', company: 'Virksomhed', date: 'Analysedato', unsol: 'Uopfordret ansøgning', none: '—' }
      : { role: 'Role', company: 'Company', date: 'Analysis date', unsol: 'Unsolicited application', none: '—' };
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ISO (yyyy-mm-dd) stamp kept locale-stable; render() reformats to the user's locale.
  function stampToday() {
    try {
      var d = new Date();
      var iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      localStorage.setItem(DATE_KEY, iso);
    } catch (_) {}
  }
  function readDate() {
    var iso = readString(DATE_KEY, '');
    if (!iso) return '';
    try {
      var parts = iso.split('-');
      if (parts.length === 3) {
        var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        if (!isNaN(d.getTime())) return d.toLocaleDateString(isDanish() ? 'da-DK' : undefined, { year: 'numeric', month: 'short', day: 'numeric' });
      }
    } catch (_) {}
    return iso;
  }

  function findPanel() {
    try {
      if (window.AntcvAnalysisPanelJdBlock356 && typeof window.AntcvAnalysisPanelJdBlock356._findPanel === 'function') {
        var p = window.AntcvAnalysisPanelJdBlock356._findPanel();
        if (p) return p;
      }
    } catch (_) {}
    return document.querySelector('.antcv-editor-side-panel, .antcv-mobile-bottom-panel, [data-antcv-app-panel]');
  }
  // Only render when the panel is actually showing analysis content.
  function inAnalysisMode(panel) {
    if (!panel) return false;
    return !!(panel.querySelector('#antcv-analysis-report-top') ||
      panel.querySelector('#antcv-analysis-report') ||
      panel.querySelector('#antcv-analysis-panel-jd-block'));
  }

  function injectStylesOnce() {
    if (document.getElementById(STYLE_ID)) return;
    var css =
      '#' + CARD_ID + '{margin:2px 0 12px;padding:10px 14px;border:1px solid #d7ddec;border-left:3px solid #01B7BB;' +
      'border-radius:8px;background:#f4f7fb;font-family:Trebuchet MS,Calibri,sans-serif;color:#283556;}' +
      '#' + CARD_ID + ' .aah-role{font-size:15px;font-weight:700;line-height:1.25;margin:0 0 2px;}' +
      '#' + CARD_ID + ' .aah-company{font-size:13px;font-weight:600;color:#33446F;margin:0 0 6px;}' +
      '#' + CARD_ID + ' .aah-date{font-size:12px;color:#5a6577;}' +
      '#' + CARD_ID + ' .aah-date b{color:#283556;font-weight:600;}';
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function cardHtml() {
    var t = T();
    var meta = readJSON('meta') || {};
    var role = (meta.role || '').toString().trim();
    var company = (meta.company || '').toString().trim();
    var date = readDate();
    var html = '';
    html += '<div class="aah-role">' + (role ? esc(role) : esc(t.none)) + '</div>';
    html += '<div class="aah-company">' + (company ? esc(company) : esc(t.unsol)) + '</div>';
    html += '<div class="aah-date">' + esc(t.date) + ': <b>' + (date ? esc(date) : esc(t.none)) + '</b></div>';
    return html;
  }

  function render() {
    var existing = document.getElementById(CARD_ID);
    if (killed()) { if (existing && existing.parentNode) existing.parentNode.removeChild(existing); return; }
    var panel = findPanel();
    if (!panel || !inAnalysisMode(panel)) {
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      return;
    }
    injectStylesOnce();
    var card = existing;
    if (!card) { card = document.createElement('div'); card.id = CARD_ID; }
    card.innerHTML = cardHtml();
    // Keep it as the panel's FIRST child so it starts the panel.
    if (card.parentNode !== panel || panel.firstChild !== card) {
      panel.insertBefore(card, panel.firstChild);
    }
  }

  var debounce = null;
  var mo = new MutationObserver(function () {
    clearTimeout(debounce);
    debounce = setTimeout(render, 300);
  });
  function boot() {
    try { mo.observe(document.body, { childList: true, subtree: true }); } catch (_) {}
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  // Stamp the analysis date when a JD-analysis result is merged (same signal the
  // fit panel uses), then re-render so the date appears without a reload.
  try {
    window.addEventListener('antcv:rationale-merge', function () { stampToday(); render(); });
  } catch (_) {}
  try { window.addEventListener('antcv:sections-updated', render); } catch (_) {}

  window.AntcvAnalysisHeader = { version: VERSION, render: render, _cardHtml: cardHtml, _findPanel: findPanel };
  try { console.debug('[analysis-header] installed v' + VERSION); } catch (_) {}
})();
