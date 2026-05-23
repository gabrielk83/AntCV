/* AntCV section panel final polish (v1.40.207)
 * - CAND./SIDEBAR/MAIN headings use the same color and size.
 * - Headings are slightly smaller than v1.40.206; CAND. no longer looks oversized.
 * - CAND. stays uppercase and uses #01B7BB.
 * - Panel buttons remain right-aligned while titles remain left-aligned.
 * - Add buttons show + only.
 * - CAND. Fit is kept scoped to the CAND/topbar panel, not SIDEBAR.
 */
(function () {
  'use strict';

  const VERSION = '1.40.207';
  if (window.__antcvSectionPanel207Installed === VERSION) return;
  window.__antcvSectionPanel207Installed = VERSION;

  const LOCS = ['topbar', 'sidebar', 'main'];
  const TITLE_COLOR = '#01B7BB';

  function clean(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function low(s) { return clean(s).toLowerCase(); }

  function anchor(loc) {
    return document.querySelector('[data-candidate-drop-loc="' + loc + '"]');
  }

  function row(loc) {
    const a = anchor(loc);
    return a ? a.parentElement : null;
  }

  function classify(btn) {
    const title = low(btn.getAttribute('title'));
    const text = low(btn.textContent || btn.innerText);
    const prev = btn.getAttribute('data-antcv-main-action') || btn.getAttribute('data-antcv-panel-action-206') || '';

    if (btn.getAttribute('data-antcv-align-cycler') === 'panel-default') return { key: 'cjlr', order: 15, label: '' };
    if (title.indexOf('undo') >= 0 || prev === 'undo' || /undo|↶|↩/.test(text)) return { key: 'undo', order: 10, label: '↶' };
    if (title.indexOf('make it fit') >= 0 || title.indexOf('fit it') >= 0 || title.indexOf('orphan-cleanup') >= 0 || prev === 'fit' || /\bfit\b/.test(text) || /\bfix\b/.test(text)) return { key: 'fit', order: 20, label: '🎯 Fit' };
    if (title.indexOf('compress') >= 0 || prev === 'comp' || /comp\.?|compress|↹|⇥|→/.test(text)) return { key: 'comp', order: 30, label: '↹ Comp.' };
    if (title.indexOf('enrich') >= 0 || prev === 'enr' || /enr\.?|enrich|✨/.test(text)) return { key: 'enr', order: 40, label: '✨ Enr.' };
    if (title.indexOf('add a ') >= 0 || prev === 'add' || /^\+/.test(text) || text.indexOf('add') >= 0) return { key: 'add', order: 50, label: '+' };
    return null;
  }

  function applyPanel(loc) {
    const a = anchor(loc);
    const r = row(loc);
    if (!a || !r) return;

    r.setAttribute('data-antcv-panel-207', loc);
    r.setAttribute('data-antcv-panel-206', loc);
    a.setAttribute('data-antcv-section-title-207', loc);
    a.setAttribute('data-antcv-panel-title-206', loc);

    if (loc === 'topbar') {
      a.setAttribute('data-antcv-cand-title-207', '1');
      a.setAttribute('data-antcv-cand-title-206', '1');
      a.setAttribute('aria-label', 'CAND.');
    }

    Array.from(r.querySelectorAll('button')).forEach(function (btn) {
      const meta = classify(btn);
      if (!meta) return;
      btn.setAttribute('data-antcv-panel-action-207', meta.key);
      btn.setAttribute('data-antcv-panel-action-206', meta.key);
      btn.setAttribute('data-antcv-panel-label-207', meta.label);
      btn.setAttribute('data-antcv-panel-label-206', meta.label);
      btn.style.order = String(meta.order);
      if (loc === 'topbar' && meta.key === 'fit') {
        btn.setAttribute('data-antcv-fit-scope', 'topbar');
        btn.setAttribute('data-antcv-cand-fit-207', '1');
        // Keep the original React handler, but make the DOM metadata unambiguous
        // for any delegated code that scopes by title/action attributes.
        if (/fix/i.test(btn.textContent || '') || /orphan-cleanup/i.test(btn.getAttribute('title') || '')) {
          btn.setAttribute('aria-label', 'Fit CAND. items');
          btn.setAttribute('data-antcv-action', 'fit-candidate-items');
        }
      }
    });
  }

  function installCandFitGuard() {
    if (window.__antcvCandFitGuard207) return;
    window.__antcvCandFitGuard207 = true;

    document.addEventListener('click', function (ev) {
      const btn = ev.target && ev.target.closest && ev.target.closest('button[data-antcv-cand-fit-207="1"]');
      if (!btn) return;
      const r = row('topbar');
      if (!r || !r.contains(btn)) return;
      btn.setAttribute('data-antcv-fit-scope', 'topbar');
      btn.setAttribute('data-antcv-action', 'fit-candidate-items');
      try {
        window.dispatchEvent(new CustomEvent('antcv:fit-candidate-items', {
          bubbles: false,
          detail: { source: 'section-panel-207', loc: 'topbar' }
        }));
      } catch (_) {}
      // Do not preventDefault here: the React-owned CAND. handler still runs.
      // This guard only prevents later sidecars/delegates from treating the
      // visually relabelled CAND. Fit as a SIDEBAR Fit button.
    }, true);
  }

  function injectCss() {
    const old = document.getElementById('antcv-section-panel-207-css');
    if (old) old.remove();
    const style = document.createElement('style');
    style.id = 'antcv-section-panel-207-css';
    style.textContent = `
      [data-antcv-panel-207] {
        display: flex !important;
        align-items: center !important;
        width: 100% !important;
        box-sizing: border-box !important;
        gap: 5px !important;
      }
      [data-antcv-section-title-207] {
        margin-right: auto !important;
        flex: 0 0 auto !important;
        color: ${TITLE_COLOR} !important;
        font-size: 16px !important;
        font-weight: 800 !important;
        line-height: 1.05 !important;
        font-family: inherit !important;
        letter-spacing: 0 !important;
        white-space: nowrap !important;
      }
      [data-antcv-cand-title-207="1"] {
        color: transparent !important;
        font-size: 0 !important;
        line-height: 1.05 !important;
        overflow: visible !important;
      }
      [data-antcv-cand-title-207="1"]::before {
        content: "CAND. ▾" !important;
        color: ${TITLE_COLOR} !important;
        font-size: 16px !important;
        font-weight: 800 !important;
        line-height: 1.05 !important;
        font-family: inherit !important;
        letter-spacing: 0 !important;
      }

      [data-antcv-panel-207] button[data-antcv-panel-label-207],
      [data-antcv-panel-207] button[data-antcv-panel-label-206] {
        font-size: 0 !important;
        white-space: nowrap !important;
        box-sizing: border-box !important;
        min-width: 0 !important;
        width: auto !important;
        overflow: hidden !important;
      }
      [data-antcv-panel-207] button[data-antcv-panel-label-207]::after,
      [data-antcv-panel-207] button[data-antcv-panel-label-206]::after {
        content: attr(data-antcv-panel-label-207) !important;
        font-size: 12px !important;
        font-weight: 700 !important;
        line-height: 1 !important;
      }
      [data-antcv-panel-207] button[data-antcv-panel-action-207="undo"] { order: 10 !important; }
      [data-antcv-panel-207] button[data-antcv-panel-action-207="fit"] { order: 20 !important; }
      [data-antcv-panel-207] button[data-antcv-panel-action-207="comp"] { order: 30 !important; }
      [data-antcv-panel-207] button[data-antcv-panel-action-207="enr"] { order: 40 !important; }
      [data-antcv-panel-207] button[data-antcv-panel-action-207="add"] { order: 50 !important; }

      [data-antcv-panel-207="topbar"] button[data-antcv-panel-label-207],
      [data-antcv-panel-207="sidebar"] button[data-antcv-panel-label-207] {
        height: 24px !important;
        min-height: 24px !important;
        padding: 2px 7px !important;
        border-radius: 5px !important;
      }
      [data-antcv-panel-207="main"] {
        justify-content: flex-end !important;
        gap: 6px !important;
      }
      [data-antcv-panel-207="main"] button[data-antcv-panel-label-207] {
        height: 27px !important;
        min-height: 27px !important;
        padding: 3px 9px !important;
        border-radius: 6px !important;
      }
      [data-antcv-panel-207="main"] button[data-antcv-panel-label-207]::after {
        font-size: 12.5px !important;
      }

      @media (max-width: 900px), (pointer: coarse) {
        [data-antcv-section-title-207],
        [data-antcv-cand-title-207="1"]::before {
          font-size: 16px !important;
        }
        [data-antcv-panel-207] {
          flex-wrap: nowrap !important;
          gap: 5px !important;
        }
        [data-antcv-panel-207="topbar"] button[data-antcv-panel-label-207],
        [data-antcv-panel-207="sidebar"] button[data-antcv-panel-label-207] {
          height: 24px !important;
          min-height: 24px !important;
          padding-left: 7px !important;
          padding-right: 7px !important;
        }
        [data-antcv-panel-207="main"] button[data-antcv-panel-label-207] {
          height: 27px !important;
          min-height: 27px !important;
          padding-left: 8px !important;
          padding-right: 8px !important;
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
        installCandFitGuard();
        applyAll();
      } catch (e) {
        try { console.warn('[section-panel-207] failed:', e && e.message); } catch (_) {}
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
        attributeFilter: ['style', 'class', 'title', 'data-antcv-main-action', 'data-antcv-panel-label', 'data-antcv-panel-label-206', 'data-antcv-panel-action-206']
      });
    } catch (_) {}
    setInterval(schedule, 1400);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.AntcvSectionPanel207 = { version: VERSION, _applyAll: applyAll, _classify: classify };
})();
