/* AntCV cover-letter length sidecar (v1.50.560) — owner 2026-06-17
 * ============================================================================
 * Adds a "Target cover-letter length" dropdown in Advanced Styles, directly
 * UNDER the "Target CV length" control. Stores localStorage["pageBudgetCl"]
 * (JSON-stringified, like pageBudget) which the CV/CL generation prompt reads
 * via u.get("pageBudgetCl", 1). Cover letters are ≤ 1.5 pages (cl-skeleton.md).
 *
 * DEFAULT when unset (LETTER-LENGTH-002, owner 2026-11-25: "keep it 2 pages when it is a
 * real academic position/phd. if it is not keep it one page and very relevant to the job"):
 * 2 pages for an academic position or PhD (job title / university, or the Research Formal
 * style), 1 page for everything else. Academic Work is a staffing company, not academic.
 * A length the user picked always wins. The generation prompt reads AntcvClLength.get().
 * ============================================================================
 */
(function () {
  'use strict';
  var VERSION = '1.51.6706-letter-length';
  if (window.__antcvClLength560 === VERSION) return;
  window.__antcvClLength560 = VERSION;

  var STORAGE_KEY = 'pageBudgetCl';
  var OPTIONS = [
    { v: 0.5, label: '½ page', hint: 'Half a page — a short note. Good for a brief speculative / cold-outreach opener.' },
    { v: 1.0, label: '1 page', hint: 'One page — tight. The default for every job that is not academic.' },
    { v: 1.5, label: '1.5 pages', hint: 'Up to 1.5 pages — when a letter needs a little more room.' },
    { v: 2.0, label: '2 pages', hint: 'Two pages — the default for an academic position or PhD.' },
    { v: 2.5, label: '2.5 pages', hint: 'Up to 2.5 pages — the maximum, for senior / heavily-tailored applications.' },
  ];

  function activeStyle() {
    // The app stores the active writing style in localStorage["toneRegister"]
    // (JSON-stringified id, e.g. "nordic-minimal" — see app.src.js u.get/set).
    // Fall back to personalInfo.writingPrefs.style for older data.
    try { var tr = localStorage.getItem('toneRegister'); if (tr) { var v = JSON.parse(tr); if (typeof v === 'string' && v) return v; } } catch (_) {}
    try { var pi = JSON.parse(localStorage.getItem('personalInfo') || '{}') || {}; return (pi.writingPrefs && pi.writingPrefs.style) || ''; } catch (_) { return ''; }
  }
  // Pure: is this a real academic position? Judged on the job TITLE and the EMPLOYER, never on the ad text
  // (an industry ad that asks for a PhD is not an academic position).
  var ACAD_TITLE = /\b(ph\.?\s?d\.?|doctoral|doctorate|post-?\s?doc\w*|professor|lecturer|research (assistant|associate|fellow)|ph\.?d\.?-stipendiat\w*|doktorand\w*|adjunkt|lektor|videnskabelig assistent|forskningsassistent)\b/i;
  var ACAD_ORG = /universit|\bdtu\b|\bku\b|\baau\b|\bsdu\b|\bitu\b|\beth\b|\bkth\b|institute of technology|h[øo]j?skole|hochschule|max[- ]planck|niels bohr/i;
  function jobIsAcademic(m) {
    var title = String((m && (m.role || m.title || m.jobTitle)) || ''), org = String((m && m.company) || '');
    if (/academic work/i.test(org)) return false;
    if (/recruit|talent|coordinator|administrat/i.test(title)) return false;   // runs the programme, is not the position
    if (/\b(ph\.?\s?d\.?|doctoral|doktorand\w*)\b/i.test(title)) return true;
    return ACAD_TITLE.test(title) && ACAD_ORG.test(org);
  }
  function jobMeta() { try { return JSON.parse(localStorage.getItem('meta') || '{}') || {}; } catch (_) { return {}; } }
  function styleDefault() {
    return (activeStyle() === 'research-formal' || jobIsAcademic(jobMeta())) ? 2 : 1;
  }
  function read() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw == null || raw === '') return styleDefault();
      var v = JSON.parse(raw);
      return (typeof v === 'number' && v >= 0.5 && v <= 2.5) ? v : styleDefault();
    } catch (_) { return styleDefault(); }
  }
  function write(v) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); window.dispatchEvent(new CustomEvent('antcv:cl-budget-changed', { detail: { value: v } })); } catch (_) {}
  }
  window.AntcvClLength = { get: read, set: write, OPTIONS: OPTIONS, STORAGE_KEY: STORAGE_KEY, jobIsAcademic: jobIsAcademic };

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
    note.textContent = 'Aims the cover letter at this length during generation. Defaults to 1 page, and to 2 pages for an academic position or PhD.';
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
