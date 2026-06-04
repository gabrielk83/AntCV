/* AntCV section panel polish (v1.40.206)
 *
 * Applies the agreed desktop/mobile layout:
 * - CAND. header: uppercase, #01B7BB, slightly larger, no leading icon.
 * - Panel action buttons stay to the right while CAND./SIDEBAR/MAIN stay left.
 * - CAND. Fix is shown as Fit with the SIDEBAR look.
 * - MAIN buttons are slightly larger than v1.40.205 and right-aligned.
 * - All three panel add buttons show "+" only.
 * - Button names remain separate: Comp. and Enr.
 */
(function () {
  'use strict';

  const VERSION = '1.40.206';
  if (window.__antcvSectionPanel206Installed === VERSION) return;
  window.__antcvSectionPanel206Installed = VERSION;

  const LOCS = ['topbar', 'sidebar', 'main'];

  function clean(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function low(s) { return clean(s).toLowerCase(); }

  function panelAnchor(loc) {
    return document.querySelector('[data-candidate-drop-loc="' + loc + '"]');
  }

  function panelRow(loc) {
    const a = panelAnchor(loc);
    return a ? a.parentElement : null;
  }

  function classify(btn) {
    const title = low(btn.getAttribute('title'));
    const text = low(btn.textContent || btn.innerText);
    const prevMain = btn.getAttribute('data-antcv-main-action') || '';

    if (btn.getAttribute('data-antcv-align-cycler') === 'panel-default') return { key: 'cjlr', order: 15, label: '' };
    if (title.indexOf('undo') >= 0 || prevMain === 'undo' || /undo|↶|↩/.test(text)) return { key: 'undo', order: 10, label: '↶' };
    if (title.indexOf('make it fit') >= 0 || title.indexOf('fit it') >= 0 || title.indexOf('orphan-cleanup') >= 0 || prevMain === 'fit' || /\bfit\b/.test(text) || /\bfix\b/.test(text)) return { key: 'fit', order: 20, label: '🎯 Fit' };
    if (title.indexOf('enrich') >= 0 || prevMain === 'enr' || /enr\.?|enrich|✨/.test(text)) return { key: 'enr', order: 40, label: '✨ Enr.' };
    if (title.indexOf('compress') >= 0 || prevMain === 'comp' || prevMain === 'comp-enr' || /comp\.?|compress|↹|⇥|→/.test(text)) return { key: 'comp', order: 30, label: '↹ Comp.' };
    if (title.indexOf('add a ') >= 0 || prevMain === 'add' || /^\+/.test(text) || text.indexOf('add') >= 0) return { key: 'add', order: 50, label: '+' };
    return null;
  }

  function applyPanel(loc) {
    const anchor = panelAnchor(loc);
    const row = panelRow(loc);
    if (!anchor || !row) return;

    row.setAttribute('data-antcv-panel-206', loc);
    anchor.setAttribute('data-antcv-panel-title-206', loc);

    if (loc === 'topbar') {
      anchor.setAttribute('data-antcv-cand-title-206', '1');
      anchor.setAttribute('aria-label', 'CAND.');
    }

    const buttons = Array.from(row.querySelectorAll('button'));
    buttons.forEach(function (btn) {
      const meta = classify(btn);
      if (!meta) return;
      // v1.50.83 — idempotency. These stamped attrs + style.order on every
      // button every sweep (~228/sec per the mutation-source probe) — a top
      // pump of the re-render storm. Write only on change.
      if (btn.getAttribute('data-antcv-panel-action-206') !== meta.key) btn.setAttribute('data-antcv-panel-action-206', meta.key);
      if (btn.getAttribute('data-antcv-panel-label-206') !== meta.label) btn.setAttribute('data-antcv-panel-label-206', meta.label);
      if (btn.style.order !== String(meta.order)) btn.style.order = String(meta.order);
      if (loc === 'main' && btn.getAttribute('data-antcv-main-action') !== meta.key) btn.setAttribute('data-antcv-main-action', meta.key);
    });
  }

  function applyAll() {
    LOCS.forEach(applyPanel);
  }

  function injectCss() {
    const old = document.getElementById('antcv-section-panel-206-css');
    if (old) old.remove();

    const style = document.createElement('style');
    style.id = 'antcv-section-panel-206-css';
    style.textContent = `
      [data-antcv-panel-206] {
        display: flex !important;
        align-items: center !important;
        width: 100% !important;
        box-sizing: border-box !important;
      }

      [data-antcv-panel-title-206] {
        margin-right: auto !important;
        flex: 0 0 auto !important;
      }

      /* CAND. title: no bag/icon, same bright teal family as SIDEBAR. */
      [data-antcv-cand-title-206="1"] {
        color: transparent !important;
        font-size: 0 !important;
        line-height: 1 !important;
        white-space: nowrap !important;
        overflow: visible !important;
      }
      [data-antcv-cand-title-206="1"]::before {
        content: "CAND. ▾" !important;
        color: #01B7BB !important;
        font-size: 19px !important;
        font-weight: 800 !important;
        line-height: 1 !important;
        font-family: inherit !important;
        letter-spacing: 0.01em !important;
      }

      /* Paint stable button labels without changing React-owned text. */
      [data-antcv-panel-206] button[data-antcv-panel-label-206] {
        font-size: 0 !important;
        white-space: nowrap !important;
        box-sizing: border-box !important;
        min-width: 0 !important;
        width: auto !important;
        overflow: hidden !important;
      }
      [data-antcv-panel-206] button[data-antcv-panel-label-206]::after {
        content: attr(data-antcv-panel-label-206) !important;
        font-size: 12px !important;
        font-weight: 700 !important;
        line-height: 1 !important;
      }

      [data-antcv-panel-206] button[data-antcv-panel-action-206="undo"] { order: 10 !important; }
      [data-antcv-panel-206] button[data-antcv-panel-action-206="fit"] { order: 20 !important; }
      [data-antcv-panel-206] button[data-antcv-panel-action-206="comp"] { order: 30 !important; }
      [data-antcv-panel-206] button[data-antcv-panel-action-206="enr"] { order: 40 !important; }
      [data-antcv-panel-206] button[data-antcv-panel-action-206="add"] { order: 50 !important; }

      /* SIDEBAR and CAND. use the compact sidebar button scale. */
      [data-antcv-panel-206="topbar"],
      [data-antcv-panel-206="sidebar"] {
        gap: 5px !important;
      }
      [data-antcv-panel-206="topbar"] button[data-antcv-panel-label-206],
      [data-antcv-panel-206="sidebar"] button[data-antcv-panel-label-206] {
        height: 25px !important;
        min-height: 25px !important;
        padding: 2px 8px !important;
        border-radius: 5px !important;
      }

      /* MAIN: right-aligned and slightly larger than the previous too-small build. */
      [data-antcv-panel-206="main"] {
        gap: 6px !important;
        justify-content: flex-end !important;
      }
      [data-antcv-panel-206="main"] button[data-antcv-panel-label-206] {
        height: 28px !important;
        min-height: 28px !important;
        padding: 3px 10px !important;
        border-radius: 6px !important;
      }
      [data-antcv-panel-206="main"] button[data-antcv-panel-label-206]::after {
        font-size: 13px !important;
      }
      [data-antcv-panel-206="main"] button[data-antcv-panel-action-206="undo"],
      [data-antcv-panel-206="main"] button[data-antcv-panel-action-206="add"] {
        padding-left: 10px !important;
        padding-right: 10px !important;
      }

      @media (max-width: 900px), (pointer: coarse) {
        [data-antcv-cand-title-206="1"]::before {
          font-size: 19px !important;
        }
        [data-antcv-panel-206] {
          flex-wrap: nowrap !important;
        }
        [data-antcv-panel-206="topbar"],
        [data-antcv-panel-206="sidebar"],
        [data-antcv-panel-206="main"] {
          gap: 5px !important;
        }
        [data-antcv-panel-206="topbar"] button[data-antcv-panel-label-206],
        [data-antcv-panel-206="sidebar"] button[data-antcv-panel-label-206] {
          height: 26px !important;
          min-height: 26px !important;
          padding-left: 8px !important;
          padding-right: 8px !important;
        }
        [data-antcv-panel-206="main"] button[data-antcv-panel-label-206] {
          height: 28px !important;
          min-height: 28px !important;
          padding-left: 9px !important;
          padding-right: 9px !important;
        }
        [data-antcv-panel-206] button[data-antcv-panel-label-206]::after {
          font-size: 12px !important;
        }
        [data-antcv-panel-206="main"] button[data-antcv-panel-label-206]::after {
          font-size: 13px !important;
        }
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  let cssReady = false;
  let pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      try {
        if (!cssReady) { injectCss(); cssReady = true; }
        applyAll();
      } catch (e) {
        try { console.warn('[section-panel-206] failed:', e && e.message); } catch (_) {}
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
        attributeFilter: ['style', 'class', 'title', 'data-antcv-main-action', 'data-antcv-panel-label', 'data-antcv-panel-label-206']
      });
    } catch (_) {}
    setInterval(schedule, 1400);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.AntcvSectionPanel206 = { version: VERSION, _applyAll: applyAll, _classify: classify };
})();
