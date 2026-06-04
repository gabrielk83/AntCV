/* AntCV section panel headline controls (v1.40.208)
 * - Comp. panel button is icon-only.
 * - Adds/repurposes a CJLR button for CAND./SIDEBAR/MAIN header rows.
 * - Header-row CJLR changes the section headline alignment only, not content/items.
 * - Keeps action buttons right-aligned and section titles left by default.
 */
(function () {
  'use strict';

  const VERSION = '1.40.208';
  if (window.__antcvSectionPanel208Installed === VERSION) return;
  window.__antcvSectionPanel208Installed = VERSION;

  const LOCS = ['topbar', 'sidebar', 'main'];
  const TITLE_COLOR = '#01B7BB';
  const STORAGE_KEY = 'antcv.sectionHeadlineAlignment.v1';
  const ALIGNMENTS = ['center', 'justify', 'left', 'right'];
  const GLYPHS = { left: '⇤', center: '↔', right: '⇥', justify: '☰' };

  function clean(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function low(s) { return clean(s).toLowerCase(); }
  function anchor(loc) { return document.querySelector('[data-candidate-drop-loc="' + loc + '"]'); }
  function row(loc) { const a = anchor(loc); return a ? a.parentElement : null; }

  function readMap() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      return obj && typeof obj === 'object' ? obj : {};
    } catch (_) { return {}; }
  }
  function writeMap(map) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(map || {})); } catch (_) {}
  }
  function readAlign(loc) {
    const v = readMap()[loc];
    return ALIGNMENTS.indexOf(v) >= 0 ? v : 'left';
  }
  function writeAlign(loc, v) {
    const map = readMap();
    map[loc] = v;
    writeMap(map);
  }
  function nextAlign(v) {
    const i = ALIGNMENTS.indexOf(v);
    return ALIGNMENTS[(i < 0 ? 0 : i + 1) % ALIGNMENTS.length];
  }

  function classify(btn) {
    const title = low(btn.getAttribute('title'));
    const text = low(btn.textContent || btn.innerText);
    const prev = btn.getAttribute('data-antcv-panel-action-207') || btn.getAttribute('data-antcv-panel-action-206') || btn.getAttribute('data-antcv-main-action') || '';
    const isCjlr = btn.getAttribute('data-antcv-headline-cjlr') === '1' || btn.getAttribute('data-antcv-align-cycler') === 'panel-default';

    if (isCjlr) return { key: 'cjlr', order: 45, label: GLYPHS.left };
    if (title.indexOf('undo') >= 0 || prev === 'undo' || /undo|↶|↩/.test(text)) return { key: 'undo', order: 10, label: '↶' };
    if (title.indexOf('make it fit') >= 0 || title.indexOf('fit it') >= 0 || title.indexOf('orphan-cleanup') >= 0 || prev === 'fit' || /\bfit\b/.test(text) || /\bfix\b/.test(text)) return { key: 'fit', order: 20, label: '🎯 Fit' };
    if (title.indexOf('compress') >= 0 || prev === 'comp' || /comp\.?|compress|↹|⇥|→/.test(text)) return { key: 'comp', order: 30, label: '↹' };
    if (title.indexOf('enrich') >= 0 || prev === 'enr' || /enr\.?|enrich|✨/.test(text)) return { key: 'enr', order: 40, label: '✨ Enr.' };
    if (title.indexOf('add a ') >= 0 || prev === 'add' || /^\+/.test(text) || text.indexOf('add') >= 0) return { key: 'add', order: 50, label: '+' };
    return null;
  }

  function refreshCjlr(btn, loc) {
    const cur = readAlign(loc);
    btn.setAttribute('data-antcv-headline-cjlr', '1');
    btn.setAttribute('data-antcv-panel-action-208', 'cjlr');
    btn.setAttribute('data-antcv-panel-action-207', 'cjlr');
    btn.setAttribute('data-antcv-panel-label-208', GLYPHS[cur] || GLYPHS.left);
    btn.setAttribute('data-antcv-panel-label-207', GLYPHS[cur] || GLYPHS.left);
    btn.setAttribute('data-antcv-title-align-current', cur);
    btn.title = (loc === 'topbar' ? 'CAND.' : loc === 'sidebar' ? 'SIDEBAR' : 'MAIN') + ' headline alignment: ' + cur + ' (click to cycle)';
    btn.setAttribute('aria-label', btn.title);
    btn.style.order = '45';
  }

  function ensureHeadlineCjlr(loc) {
    const r = row(loc);
    if (!r) return null;
    let btn = r.querySelector(':scope button[data-antcv-headline-cjlr="1"]');
    if (!btn) btn = r.querySelector(':scope button[data-antcv-align-cycler="panel-default"]');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      const a = anchor(loc);
      if (a && a.nextSibling) r.insertBefore(btn, a.nextSibling);
      else r.appendChild(btn);
    }
    btn.setAttribute('data-antcv-headline-cjlr', '1');
    btn.setAttribute('data-antcv-align-cycler', 'headline');
    btn.setAttribute('data-antcv-panel-default-loc', loc);
    refreshCjlr(btn, loc);
    return btn;
  }

  function applyTitleAlignment(loc) {
    const a = anchor(loc);
    const r = row(loc);
    if (!a || !r) return;
    const cur = readAlign(loc);
    r.setAttribute('data-antcv-title-align-row', cur);
    a.setAttribute('data-antcv-title-align', cur);
  }

  function applyPanel(loc) {
    const a = anchor(loc);
    const r = row(loc);
    if (!a || !r) return;

    r.setAttribute('data-antcv-panel-208', loc);
    r.setAttribute('data-antcv-panel-207', loc);
    a.setAttribute('data-antcv-section-title-208', loc);
    a.setAttribute('data-antcv-section-title-207', loc);

    if (loc === 'topbar') {
      a.setAttribute('data-antcv-cand-title-208', '1');
      a.setAttribute('data-antcv-cand-title-207', '1');
      a.setAttribute('aria-label', 'CAND.');
    }

    ensureHeadlineCjlr(loc);
    applyTitleAlignment(loc);

    Array.from(r.querySelectorAll('button')).forEach(function (btn) {
      const meta = classify(btn);
      if (!meta) return;
      if (meta.key === 'cjlr') refreshCjlr(btn, loc);
      // v1.50.83 — idempotency: write only on change (was ~202/sec per the
      // mutation-source probe — a top re-render-storm pump on this screen).
      var lbl = meta.key === 'cjlr' ? (btn.getAttribute('data-antcv-panel-label-208') || meta.label) : meta.label;
      if (btn.getAttribute('data-antcv-panel-action-208') !== meta.key) btn.setAttribute('data-antcv-panel-action-208', meta.key);
      if (btn.getAttribute('data-antcv-panel-label-208') !== lbl) btn.setAttribute('data-antcv-panel-label-208', lbl);
      if (btn.getAttribute('data-antcv-panel-action-207') !== meta.key) btn.setAttribute('data-antcv-panel-action-207', meta.key);
      if (btn.getAttribute('data-antcv-panel-label-207') !== lbl) btn.setAttribute('data-antcv-panel-label-207', lbl);
      if (btn.style.order !== String(meta.order)) btn.style.order = String(meta.order);
      if (loc === 'topbar' && meta.key === 'fit') {
        btn.setAttribute('data-antcv-fit-scope', 'topbar');
        btn.setAttribute('data-antcv-cand-fit-207', '1');
        btn.setAttribute('data-antcv-cand-fit-208', '1');
        btn.setAttribute('aria-label', 'Fit CAND. items');
        btn.setAttribute('data-antcv-action', 'fit-candidate-items');
      }
    });
  }

  function installHeadlineClickGuard() {
    if (window.__antcvHeadlineCjlrGuard208) return;
    window.__antcvHeadlineCjlrGuard208 = true;
    document.addEventListener('click', function (ev) {
      const btn = ev.target && ev.target.closest && ev.target.closest('button[data-antcv-headline-cjlr="1"]');
      if (!btn) return;
      const loc = btn.getAttribute('data-antcv-panel-default-loc') || (row('topbar') && row('topbar').contains(btn) ? 'topbar' : row('sidebar') && row('sidebar').contains(btn) ? 'sidebar' : 'main');
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      const nxt = nextAlign(readAlign(loc));
      writeAlign(loc, nxt);
      refreshCjlr(btn, loc);
      applyTitleAlignment(loc);
    }, true);
  }

  function injectCss() {
    const old = document.getElementById('antcv-section-panel-208-css');
    if (old) old.remove();
    const style = document.createElement('style');
    style.id = 'antcv-section-panel-208-css';
    style.textContent = `
      [data-antcv-panel-208] {
        display: flex !important;
        align-items: center !important;
        width: 100% !important;
        box-sizing: border-box !important;
        gap: 5px !important;
      }
      [data-antcv-section-title-208] {
        margin-right: auto !important;
        flex: 1 1 auto !important;
        color: ${TITLE_COLOR} !important;
        font-size: 15px !important;
        font-weight: 800 !important;
        line-height: 1.05 !important;
        font-family: inherit !important;
        letter-spacing: 0 !important;
        white-space: nowrap !important;
        min-width: 0 !important;
      }
      [data-antcv-section-title-208][data-antcv-title-align="left"] { text-align: left !important; }
      [data-antcv-section-title-208][data-antcv-title-align="center"] { text-align: center !important; }
      [data-antcv-section-title-208][data-antcv-title-align="right"] { text-align: right !important; }
      [data-antcv-section-title-208][data-antcv-title-align="justify"] { text-align: justify !important; }
      [data-antcv-section-title-208][data-antcv-title-align="justify"]::after { content: ""; display: inline-block; width: 100%; }

      [data-antcv-cand-title-208="1"] {
        color: transparent !important;
        font-size: 0 !important;
        line-height: 1.05 !important;
        overflow: visible !important;
      }
      [data-antcv-cand-title-208="1"]::before {
        content: "CAND. ▾" !important;
        color: ${TITLE_COLOR} !important;
        font-size: 15px !important;
        font-weight: 800 !important;
        line-height: 1.05 !important;
        font-family: inherit !important;
        letter-spacing: 0 !important;
      }

      [data-antcv-panel-208] button[data-antcv-panel-label-208] {
        font-size: 0 !important;
        white-space: nowrap !important;
        box-sizing: border-box !important;
        min-width: 0 !important;
        width: auto !important;
        overflow: hidden !important;
      }
      [data-antcv-panel-208] button[data-antcv-panel-label-208]::after {
        content: attr(data-antcv-panel-label-208) !important;
        font-size: 12px !important;
        font-weight: 700 !important;
        line-height: 1 !important;
      }
      [data-antcv-panel-208] button[data-antcv-panel-action-208="undo"] { order: 10 !important; }
      [data-antcv-panel-208] button[data-antcv-panel-action-208="fit"] { order: 20 !important; }
      [data-antcv-panel-208] button[data-antcv-panel-action-208="comp"] { order: 30 !important; }
      [data-antcv-panel-208] button[data-antcv-panel-action-208="enr"] { order: 40 !important; }
      [data-antcv-panel-208] button[data-antcv-panel-action-208="cjlr"] { order: 45 !important; }
      [data-antcv-panel-208] button[data-antcv-panel-action-208="add"] { order: 50 !important; }

      [data-antcv-panel-208] button[data-antcv-panel-label-208] {
        height: 24px !important;
        min-height: 24px !important;
        padding: 2px 7px !important;
        border-radius: 5px !important;
      }
      [data-antcv-panel-208="main"] button[data-antcv-panel-label-208] {
        height: 26px !important;
        min-height: 26px !important;
        padding: 3px 8px !important;
        border-radius: 6px !important;
      }
      [data-antcv-panel-208] button[data-antcv-panel-action-208="cjlr"] {
        border-color: #01B7BB !important;
        color: #00746E !important;
        background: rgba(1, 183, 187, 0.08) !important;
      }
      [data-antcv-panel-208] button[data-antcv-panel-action-208="comp"] {
        min-width: 31px !important;
      }

      @media (max-width: 900px), (pointer: coarse) {
        [data-antcv-section-title-208],
        [data-antcv-cand-title-208="1"]::before {
          font-size: 15px !important;
        }
        [data-antcv-panel-208] { flex-wrap: nowrap !important; gap: 5px !important; }
        [data-antcv-panel-208] button[data-antcv-panel-label-208] {
          height: 24px !important;
          min-height: 24px !important;
          padding-left: 7px !important;
          padding-right: 7px !important;
        }
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  let cssReady = false;
  let pending = false;
  function applyAll() { LOCS.forEach(applyPanel); }
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      try {
        if (!cssReady) { injectCss(); cssReady = true; }
        installHeadlineClickGuard();
        applyAll();
      } catch (e) {
        try { console.warn('[section-panel-208] failed:', e && e.message); } catch (_) {}
      }
    });
  }
  function start() {
    schedule();
    [80, 180, 400, 900, 1600, 2600].forEach(function (ms) { setTimeout(schedule, ms); });
    try {
      const mo = new MutationObserver(schedule);
      mo.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class', 'title', 'data-antcv-panel-label-207', 'data-antcv-panel-action-207', 'data-antcv-align-cycler']
      });
    } catch (_) {}
    setInterval(schedule, 1400);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.AntcvSectionPanel208 = { version: VERSION, _applyAll: applyAll, _readAlign: readAlign, _writeAlign: writeAlign };
})();
