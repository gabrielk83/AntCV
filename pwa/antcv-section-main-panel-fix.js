/* AntCV MAIN section panel button parity + preview CJLR cleanup (v1.40.205)
 *
 * Fixes:
 * - Hide the blue CJLR/CLJR ghost from the preview.
 * - MAIN panel uses the same compact button sizing, icons and labels as SIDEBAR.
 * - MAIN button order is: Undo, Fit, Comp., Enr., + Add.
 * - Compress and Enrich stay as two separate buttons.
 * - Works for both desktop and mobile; it scopes by data-candidate-drop-loc="main",
 *   not by the visual direction of the expanded panel.
 */
(function () {
  'use strict';

  const VERSION = '1.40.205';
  if (window.__antcvSectionMainPanelFixInstalled === VERSION) return;
  window.__antcvSectionMainPanelFixInstalled = VERSION;

  function clean(s) {
    return String(s || '').replace(/\s+/g, ' ').trim();
  }

  function textOf(el) { return clean(el && (el.textContent || el.innerText)); }
  function titleOf(el) { return clean(el && el.getAttribute && el.getAttribute('title')); }
  function lower(s) { return clean(s).toLowerCase(); }

  function findMainRows() {
    const anchors = Array.from(document.querySelectorAll('[data-candidate-drop-loc="main"]'));
    const rows = [];
    anchors.forEach(function (anchor) {
      const row = anchor.parentElement;
      if (row && rows.indexOf(row) < 0) rows.push(row);
    });
    return rows;
  }

  function classifyMainButton(btn) {
    const title = lower(titleOf(btn));
    const text = lower(textOf(btn));
    const previous = btn.getAttribute('data-antcv-main-action') || '';

    if (btn.getAttribute('data-antcv-align-cycler') === 'panel-default') {
      return { key: 'cjlr', hidden: true };
    }

    if (title.indexOf('undo') >= 0 || previous === 'undo' || /^↶|^↩|undo\b/.test(text) || text.indexOf('undo') >= 0) {
      return { key: 'undo', order: 10, label: '↶ Undo' };
    }

    if (title.indexOf('make it fit') >= 0 || title.indexOf('fit it') >= 0 || previous === 'fit' || /\bfit\b/.test(text)) {
      return { key: 'fit', order: 20, label: '🎯 Fit' };
    }

    // Enrich must be detected before the broad compress/comp fallback.
    // Older v1.40.204 may have left data-antcv-panel-label="Comp. Enr." on the
    // DOM, so the original title is the strongest signal.
    if (
      title.indexOf('enrich') >= 0 ||
      previous === 'enr' ||
      text.indexOf('enrich') >= 0 ||
      /(^|\s)enr\.?($|\s)/.test(text) ||
      text.indexOf('✨') >= 0
    ) {
      return { key: 'enr', order: 40, label: '✨ Enr.' };
    }

    if (
      title.indexOf('compress') >= 0 ||
      previous === 'comp' || previous === 'comp-enr' ||
      text.indexOf('compress') >= 0 ||
      /(^|\s)comp\.?($|\s)/.test(text) ||
      text.indexOf('↹') >= 0 || text.indexOf('⇥') >= 0 || text.indexOf('→') >= 0
    ) {
      return { key: 'comp', order: 30, label: '↹ Comp.' };
    }

    if (title.indexOf('add a ') >= 0 || previous === 'add' || /^\+\s*add/.test(text) || text.indexOf('+ add') >= 0) {
      return { key: 'add', order: 50, label: '+ Add' };
    }

    return null;
  }

  function applyMainPanelFix() {
    findMainRows().forEach(function (row) {
      row.setAttribute('data-antcv-main-panel-fixed', '1');
      row.setAttribute('data-antcv-main-panel-sidebar-sized', '1');

      Array.from(row.querySelectorAll('button')).forEach(function (btn) {
        const meta = classifyMainButton(btn);
        if (!meta) return;

        if (meta.hidden) {
          btn.setAttribute('data-antcv-panel-hidden', '1');
          btn.style.display = 'none';
          btn.style.pointerEvents = 'none';
          return;
        }

        btn.removeAttribute('data-antcv-panel-hidden');
        btn.setAttribute('data-antcv-main-action', meta.key);
        btn.setAttribute('data-antcv-panel-label', meta.label);
        btn.style.order = String(meta.order);
      });
    });
  }

  function removePreviewCjlrGhosts() {
    const cyclers = Array.from(document.querySelectorAll('button.antcv-align-cycler, button[data-antcv-align-cycler="1"]'));
    cyclers.forEach(function (btn) {
      if (btn.getAttribute('data-antcv-align-cycler') === 'panel-default') return;
      btn.setAttribute('data-antcv-preview-cjlr-hidden', '1');
      btn.style.display = 'none';
      btn.style.pointerEvents = 'none';
      try { btn.remove(); } catch (_) {}
    });
  }

  function injectCssOnce() {
    const old = document.getElementById('antcv-section-main-panel-fix-css');
    if (old) old.remove();

    const style = document.createElement('style');
    style.id = 'antcv-section-main-panel-fix-css';
    style.textContent = `
      button.antcv-align-cycler,
      button[data-antcv-align-cycler="1"],
      button[data-antcv-preview-cjlr-hidden="1"] {
        display: none !important;
        pointer-events: none !important;
      }

      [data-antcv-main-panel-fixed="1"] button[data-antcv-panel-hidden="1"] {
        display: none !important;
        pointer-events: none !important;
      }

      [data-antcv-main-panel-fixed="1"] button[data-antcv-main-action="undo"] { order: 10 !important; }
      [data-antcv-main-panel-fixed="1"] button[data-antcv-main-action="fit"]  { order: 20 !important; }
      [data-antcv-main-panel-fixed="1"] button[data-antcv-main-action="comp"] { order: 30 !important; }
      [data-antcv-main-panel-fixed="1"] button[data-antcv-main-action="enr"]  { order: 40 !important; }
      [data-antcv-main-panel-fixed="1"] button[data-antcv-main-action="add"]  { order: 50 !important; }

      /* Match SIDEBAR button scale. We hide React-owned text visually and paint
         stable labels via CSS, so handlers and state remain untouched. */
      [data-antcv-main-panel-sidebar-sized="1"] {
        align-items: center !important;
        gap: 4px !important;
      }

      [data-antcv-main-panel-sidebar-sized="1"] button[data-antcv-panel-label] {
        font-size: 0 !important;
        min-width: 0 !important;
        width: auto !important;
        height: 25px !important;
        min-height: 25px !important;
        padding: 2px 8px !important;
        line-height: 1 !important;
        border-radius: 5px !important;
        white-space: nowrap !important;
        box-sizing: border-box !important;
      }

      [data-antcv-main-panel-sidebar-sized="1"] button[data-antcv-panel-label]::after {
        content: attr(data-antcv-panel-label);
        font-size: 12px !important;
        font-weight: 700 !important;
        line-height: 1 !important;
      }

      [data-antcv-main-panel-sidebar-sized="1"] button[data-antcv-main-action="undo"] {
        padding-left: 7px !important;
        padding-right: 7px !important;
      }

      @media (max-width: 900px), (pointer: coarse) {
        [data-antcv-main-panel-sidebar-sized="1"] {
          gap: 4px !important;
          flex-wrap: wrap !important;
        }
        [data-antcv-main-panel-sidebar-sized="1"] button[data-antcv-panel-label] {
          height: 26px !important;
          min-height: 26px !important;
          padding-left: 8px !important;
          padding-right: 8px !important;
        }
        [data-antcv-main-panel-sidebar-sized="1"] button[data-antcv-panel-label]::after {
          font-size: 12px !important;
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
        if (!cssReady) { injectCssOnce(); cssReady = true; }
        applyMainPanelFix();
        removePreviewCjlrGhosts();
      } catch (e) {
        try { console.warn('[section-main-panel-fix] failed:', e && e.message); } catch (_) {}
      }
    });
  }

  function start() {
    schedule();
    [80, 200, 500, 1000, 1800].forEach(function (ms) { setTimeout(schedule, ms); });
    try {
      const mo = new MutationObserver(schedule);
      mo.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class', 'data-antcv-align-cycler', 'data-antcv-main-action', 'data-antcv-panel-label']
      });
    } catch (_) {}
    setInterval(schedule, 1200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.AntcvSectionMainPanelFix = {
    version: VERSION,
    _applyMainPanelFix: applyMainPanelFix,
    _removePreviewCjlrGhosts: removePreviewCjlrGhosts,
    _classifyMainButton: classifyMainButton
  };
})();
