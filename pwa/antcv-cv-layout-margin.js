/* antcv-cv-layout-margin.js — MARGIN-LAYOUT-001: the house "margin" (academy) two-column CV
 * ============================================================================
 * Spec: docs/design/MARGIN_LAYOUT_SPEC.md (owner 2026-11-05: "currently our default 2 column
 * structure is with header text inside sidebar (academy format)"). Format of record: the house
 * generator gen_margin.py / finish_margin.ps1 (packages 1048-1057).
 *
 * Store: localStorage['antcv:cvLayout'] = 'margin' | absent  -> margin (DEFAULT)
 *                                       = 'two_column'       -> the band (explicit opt-out)
 *                                       = 'linear'           -> single column (antcv-cv-layout-linear.js)
 * Kill: localStorage['antcv:disable-cv-layout-margin'] = '1' -> absent reads as the band.
 * Control: antcv-role-line-format.js (CV layout select). Export: antcv-docx-client.js readCvLayout()
 * sends layout 'margin'; the docx-worker builds the same card (buildMarginSidebarCard).
 *
 * What this file does:
 *   1. window.__antcvCvLayout() / __antcvCvLayoutIs(name) - the one reader app.js consults at render
 *      time (app.src.js: __antcvMarginOn). In margin mode app.js draws NO candidate band and renders
 *      [data-antcv-sidebar-card] first in the page-1 sidebar: photo + the band's own name / spec /
 *      contact nodes + a CONTACT heading (so inline edits keep working).
 *   2. body[data-antcv-cv-margin="1"] + a scoped <style> that restyles those nodes for the pale
 *      panel: left-aligned dark ink, name 16 pt, title 10 pt bold in the sidebar head colour, the
 *      CONTACT heading like a sidebar section headline, one contact item per line (flex column).
 *   3. Paginator budgets (antcv-auto-pagebreak-block-001.js): page 1 has no band, so the main
 *      column deducts 0 (was 152) and the sidebar deducts the measured card height + 78 (the
 *      non-band residue of the tuned 230). Restored when the band is back. CV only.
 * CL untouched (app.js gates on doc === 'cv'). No app.js DOM moves: React owns the card.
 */
(function () {
  'use strict';
  var VERSION = '1.51.5865-margin-layout';
  if (window.__antcvCvLayoutMargin === VERSION) return;
  window.__antcvCvLayoutMargin = VERSION;

  var KEY = 'antcv:cvLayout', KILL = 'antcv:disable-cv-layout-margin', STYLE_ID = 'antcv-cv-layout-margin-style';
  var BAND_BUDGETS = { PAGE1_BAND: 152, SIDEBAR_PAGE1_BAND: 230 };
  var SIDEBAR_RESIDUE = 78;   // 230 (tuned sidebar page-1 deduction) - 152 (band)
  var CARD_FALLBACK_H = 250;  // before the card has rendered: photo 84 + name/title + CONTACT + 4-5 lines

  function killed() { try { var v = localStorage.getItem(KILL); return v === '1' || v === 'true'; } catch (_) { return false; } }
  function layout() {
    var v = null;
    try { v = localStorage.getItem(KEY); } catch (_) {}
    if (v === 'linear') return 'linear';
    if (v === 'two_column') return 'two_column';
    return killed() ? 'two_column' : 'margin';
  }
  window.__antcvCvLayout = layout;
  window.__antcvCvLayoutIs = function (name) { return layout() === name; };

  function docNow() {
    try { var d = JSON.parse(localStorage.getItem('doc') || '"cv"'); return String(d).toLowerCase() === 'cl' ? 'cl' : 'cv'; } catch (_) { return 'cv'; }
  }
  function readJson(k) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); if (typeof v === 'string') v = JSON.parse(v); return v && typeof v === 'object' ? v : null; } catch (_) { return null; } }
  // HDR-TYPE-SOURCE-KEY-001: the canonical Font sizes store is localStorage 'fontSizes'; styleConfig.fontSizes is
  // the legacy mirror (normally absent).
  function fontSizes() { var sc = readJson('styleConfig'); return readJson('fontSizes') || (sc && sc.fontSizes) || {}; }
  function pt2px(pt) { return Math.round(pt * 96 / 72 * 10) / 10; }
  function num(v, lo, hi) { v = Number(v); return Number.isFinite(v) && v >= lo && v <= hi ? v : null; }

  // The card heading copies the LIVE sidebar section headline (font, size, colour, tracking, alignment) so the
  // panel reads as one system; the first sidebar headline is the sample. Falls back to the package tokens.
  function headlineSample() {
    try {
      var h = document.querySelector('.antcv-preview-paper [data-antcv-document-sidebar] [data-antcv-section-headline]');
      if (!h) return null;
      var cs = getComputedStyle(h);
      return { font: cs.fontFamily, size: cs.fontSize, color: cs.color, track: cs.letterSpacing, align: cs.textAlign };
    } catch (_) { return null; }
  }
  function buildCSS() {
    var sc = readJson('styleConfig') || {};
    var fsz = fontSizes();
    var ink = 'var(--sidebar-text-color, ' + (sc.sidebarTextColor || '#283556') + ')';
    var head = 'var(--sidebar-head-color, ' + (sc.sidebarHeadColor || '#00746E') + ')';
    var hs = headlineSample();
    var headFont = hs ? hs.font : ((sc.mainHeadFont || 'Trebuchet MS') + ",Arial,sans-serif");
    var headSize = hs ? hs.size : pt2px(num(fsz.sbHead, 6, 30) || 11) + 'px';
    var headColor = hs ? hs.color : head;
    var headTrack = hs ? hs.track : '0.5px';
    var headAlign = hs && /^(left|center|right)$/.test(hs.align) ? hs.align : 'center';
    var rule = (typeof window.__antcvCphRule === 'function') ? window.__antcvCphRule() : '1px';
    var namePx = pt2px(num(fsz.nameSize, 6, 60) || 16);
    var specPx = pt2px(num(fsz.specialisation, 6, 40) || 10);
    var bodyPx = pt2px(num(fsz.sbBody, 6, 30) || 10);
    var CARD = 'body[data-antcv-cv-margin="1"] .antcv-preview-paper [data-antcv-sidebar-card]';
    return CARD + '{display:block;text-align:left;margin:0 0 10px;}' +
      CARD + ' img[data-antcv-card-photo]{width:84px !important;height:84px !important;display:block !important;margin:0 0 8px !important;float:none !important;position:static !important;transform:none !important;}' +
      // the band's name / spec / contact nodes, re-inked for the pale panel
      CARD + ' > div{color:' + ink + ' !important;text-align:left !important;white-space:normal !important;overflow:visible !important;text-overflow:clip !important;margin:0 !important;padding:0 !important;letter-spacing:0 !important;transform:none !important;max-width:none !important;}' +
      CARD + ' > div[style*="font-weight: 700"]{font-size:' + namePx + 'px !important;line-height:1.05 !important;margin:0 0 3px !important;}' +
      CARD + ' > div[title*="specialisation"]{font-size:' + specPx + 'px !important;font-weight:700 !important;color:' + head + ' !important;line-height:1.15 !important;margin:0 0 2px !important;}' +
      CARD + ' > div[style*="border-bottom"]{display:none !important;}' +   // the band's header rules
      CARD + ' > div[data-antcv-card-head]{font-family:' + headFont + ' !important;font-weight:700 !important;font-size:' + headSize + ' !important;line-height:1 !important;color:' + headColor + ' !important;text-transform:uppercase !important;letter-spacing:' + headTrack + ' !important;text-align:' + headAlign + ' !important;border-bottom:' + rule + ' solid ' + headColor + ' !important;padding-bottom:2px !important;margin:8px 0 4px !important;}' +
      CARD + ' > div:not([style*="font-weight: 700"]):not([title]):not([style*="border-bottom"]):not([data-antcv-card-head]){display:flex !important;flex-direction:column !important;align-items:flex-start !important;gap:2px !important;font-size:' + bodyPx + 'px !important;line-height:1.2 !important;}' +
      CARD + ' span, ' + CARD + ' a, ' + CARD + ' [contenteditable]{color:' + ink + ' !important;}' +
      CARD + ' a{text-decoration:none !important;}';
  }
  function setStyle(on) {
    var el = document.getElementById(STYLE_ID);
    if (!on) { if (el) el.remove(); return; }
    var css = buildCSS();
    if (!el) { el = document.createElement('style'); el.id = STYLE_ID; (document.head || document.documentElement).appendChild(el); }
    if (el.textContent !== css) el.textContent = css;
  }
  var __budgetsOn = null;
  function applyBudgets(on) {
    try {
      var P = window.AntcvAutoPagebreak;
      if (!P || typeof P.config !== 'function') return;
      if (!on) { if (__budgetsOn !== false) { P.config(BAND_BUDGETS); __budgetsOn = false; } return; }
      var card = document.querySelector('.antcv-preview-paper [data-antcv-sidebar-card]');
      var h = card ? card.offsetHeight + 10 : CARD_FALLBACK_H;   // offsetHeight = layout px, unaffected by the paper's scale transform
      if (!(h > 60 && h < 700)) h = CARD_FALLBACK_H;
      P.config({ PAGE1_BAND: 0, SIDEBAR_PAGE1_BAND: Math.round(h + SIDEBAR_RESIDUE) });
      __budgetsOn = true;
    } catch (_) {}
  }
  var __lastOn = null;
  function apply(reason) {
    var on = layout() === 'margin';
    try { if (document.body) document.body.setAttribute('data-antcv-cv-margin', on ? '1' : '0'); } catch (_) {}
    setStyle(on);
    applyBudgets(on && docNow() === 'cv');
    var flipped = __lastOn !== null && __lastOn !== on;
    __lastOn = on;
    // The card is React-rendered: a flip (or a paper that rendered before this file loaded) needs one re-render.
    var paper = null;
    try { paper = document.querySelector('.antcv-preview-paper'); } catch (_) {}
    var hasCard = !!(paper && paper.querySelector('[data-antcv-sidebar-card]'));
    var hasBand = !!(paper && paper.querySelector('[data-antcv-candidate-band="1"]'));
    if (flipped || (paper && docNow() === 'cv' && ((on && !hasCard && hasBand) || (!on && hasCard)))) {
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: reason || 'cv-layout-margin' } })); } catch (_) {}
    }
    // the budgets measure the rendered card; re-measure once the re-render has landed
    setTimeout(function () { try { applyBudgets(layout() === 'margin' && docNow() === 'cv'); } catch (_) {} }, 600);
  }
  window.__antcvCvLayoutMarginApply = function () { apply('cv-layout-margin'); };

  var pending = 0;
  function schedule() { if (pending) return; pending = setTimeout(function () { pending = 0; try { setStyle(layout() === 'margin'); applyBudgets(layout() === 'margin' && docNow() === 'cv'); } catch (_) {} }, 250); }
  function start() {
    try { apply('cv-layout-margin-boot'); } catch (_) {}
    try { window.addEventListener('storage', function (e) { if (!e || !e.key || e.key === KEY || e.key === KILL || e.key === 'fontSizes' || e.key === 'styleConfig' || e.key === 'doc') apply('cv-layout-margin-storage'); }); } catch (_) {}
    // font-size / palette / doc changes arrive as sections-updated (the app's own re-render bus); refresh the CSS + budgets after it
    try { window.addEventListener('antcv:sections-updated', function (e) { var r = e && e.detail && e.detail.reason; if (r === 'cv-layout-margin' || r === 'cv-layout-margin-boot') return; schedule(); }); } catch (_) {}
    try { new MutationObserver(schedule).observe(document.body, { childList: true, subtree: false }); } catch (_) {}
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
