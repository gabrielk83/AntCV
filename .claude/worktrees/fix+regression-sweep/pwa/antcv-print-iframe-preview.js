/* AntCV print-iframe-preview sidecar (v1.40.195)
 * ============================================================
 *
 * Purpose
 * -------
 * When the docx-worker /generate-pdf endpoint fails (CloudConvert
 * scope errors, timeouts, 5xx), app.js falls back to window.print()
 * directly. That triggers the browser's native print dialog with no
 * preview — the user can't see what they're about to print, and on
 * mobile the print path often goes straight to download with no
 * confirmation. Gabriel flagged this on 2026-05-19: "no preview
 * window just sent to print".
 *
 * Strategy
 * --------
 * Wrap `window.print` so it:
 *   1. Builds a hidden iframe whose body is a clone of the live
 *      preview-paper element (carrying our continuation-header fixes
 *      and translation patches).
 *   2. Shows a small modal overlay with the iframe as a preview
 *      panel and two buttons: [Print] and [Cancel].
 *   3. On Print, calls the iframe's window.print() (not the parent
 *      window's), which prints exactly the preview the user just
 *      reviewed.
 *   4. On Cancel, removes the modal — no print.
 *
 * The modal is dismissible by clicking the backdrop or pressing
 * Escape. Cancel does NOT re-throw to the caller (we treat the
 * original window.print invocation as a request, not a commitment).
 *
 * Compatibility
 * -------------
 * The PDF export normal path goes through the docx-worker. Only the
 * FALLBACK path (browser print → PDF) hits window.print. Our wrapper
 * preserves the call signature — code that does `window.print()` or
 * `window.print(undefined)` just gets a preview. Code that calls
 * with a `force: true` flag (some sidecars do) bypasses the modal:
 *
 *   window.print({ force: true });   // legacy behavior, no modal
 *
 * Visibility of fixes
 * -------------------
 * The cloned DOM picks up everything in the live preview at clone
 * time: `data-antcv-cont-fix` rewritten headings (from
 * antcv-exp-continuation-fix.js), patched translations (from
 * antcv-translation-patch.js), per-item continuation headers
 * (from antcv-item-pages-render.js v1.40.194). So the printed PDF
 * gets all of them automatically.
 *
 * We also fire `beforeprint` on the parent window before the clone
 * so other sidecars can run last-minute passes (the exp-cont-fix
 * sidecar listens for this).
 */
(function () {
  'use strict';

  if (window.__antcvPrintIframePreviewInstalled) return;
  window.__antcvPrintIframePreviewInstalled = '1.40.195';

  const origPrint = window.print;
  if (typeof origPrint !== 'function') return;

  // Collect <link rel="stylesheet"> and <style> from the parent so
  // the iframe renders with the same fonts/colors/layout.
  function collectParentStyles() {
    const out = [];
    const heads = document.querySelectorAll('link[rel="stylesheet"], style');
    for (const el of heads) {
      out.push(el.outerHTML);
    }
    return out.join('\n');
  }

  // Build the iframe document body from a live preview-paper clone.
  function buildIframeHtml() {
    const paper = document.querySelector('.antcv-preview-paper, [data-antcv-preview-paper]');
    if (!paper) return null;
    // Run a last-pass on parent sidecars before cloning.
    try { window.dispatchEvent(new Event('beforeprint')); } catch (_) {}
    const clone = paper.cloneNode(true);
    // Inline computed styles for elements that depend on JS-applied
    // styles (some sidecars set inline styles directly — those survive
    // clone — but a few rely on parent CSS that may not load via the
    // iframe origin in offline cases).
    const styles = collectParentStyles();
    return `<!doctype html>
<html><head><meta charset="utf-8"><title>Print preview</title>${styles}
<style>
  html, body { margin: 0; padding: 0; background: #f7f7f7; }
  body { display: flex; justify-content: center; padding: 20px 0; }
  .antcv-preview-paper, [data-antcv-preview-paper] {
    background: #fff; box-shadow: 0 0 8px rgba(0,0,0,0.15);
  }
  @media print {
    html, body { background: #fff; padding: 0; margin: 0; }
    .antcv-preview-paper, [data-antcv-preview-paper] { box-shadow: none; }
  }
</style></head><body>${clone.outerHTML}</body></html>`;
  }

  // Create the modal DOM.
  function showModal() {
    return new Promise(function (resolve) {
      const html = buildIframeHtml();
      if (!html) {
        // No preview-paper available — fall back to native print
        // (resolve with 'force' so the wrapper bypasses modal logic).
        resolve('no-preview');
        return;
      }
      const backdrop = document.createElement('div');
      backdrop.setAttribute('data-antcv-print-modal', '1');
      Object.assign(backdrop.style, {
        position: 'fixed', inset: '0',
        background: 'rgba(0,0,0,0.55)',
        zIndex: '99999',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        boxSizing: 'border-box',
      });

      const panel = document.createElement('div');
      Object.assign(panel.style, {
        background: '#fff',
        borderRadius: '8px',
        boxShadow: '0 12px 36px rgba(0,0,0,0.35)',
        width: 'min(960px, 100%)',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      });

      const header = document.createElement('div');
      Object.assign(header.style, {
        padding: '12px 16px',
        background: '#283556',
        color: '#fff',
        fontFamily: 'Trebuchet MS, Calibri, sans-serif',
        fontSize: '13px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
      });
      const title = document.createElement('span');
      title.textContent = 'Print preview — verify the layout before sending to your printer or PDF';
      header.appendChild(title);

      const iframe = document.createElement('iframe');
      Object.assign(iframe.style, {
        flex: '1 1 auto',
        width: '100%',
        height: '70vh',
        minHeight: '420px',
        border: 'none',
        background: '#f7f7f7',
      });
      iframe.setAttribute('title', 'Print preview');
      iframe.setAttribute('aria-label', 'Print preview');

      const footer = document.createElement('div');
      Object.assign(footer.style, {
        padding: '10px 16px',
        borderTop: '1px solid #e6e6e6',
        display: 'flex',
        gap: '8px',
        justifyContent: 'flex-end',
        background: '#fafafa',
        fontFamily: 'Trebuchet MS, Calibri, sans-serif',
        fontSize: '13px',
      });
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.textContent = 'Cancel';
      Object.assign(cancelBtn.style, {
        padding: '6px 14px',
        border: '1px solid #bbb',
        background: '#fff',
        borderRadius: '4px',
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: 'inherit',
      });
      const printBtn = document.createElement('button');
      printBtn.type = 'button';
      printBtn.textContent = 'Print';
      Object.assign(printBtn.style, {
        padding: '6px 14px',
        border: 'none',
        background: '#01B7BB',
        color: '#fff',
        borderRadius: '4px',
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: 'inherit',
        fontWeight: '600',
      });
      footer.appendChild(cancelBtn);
      footer.appendChild(printBtn);

      panel.appendChild(header);
      panel.appendChild(iframe);
      panel.appendChild(footer);
      backdrop.appendChild(panel);

      function cleanup(answer) {
        try { document.removeEventListener('keydown', onKey, true); } catch (_) {}
        try { backdrop.parentNode && backdrop.parentNode.removeChild(backdrop); } catch (_) {}
        resolve(answer);
      }
      function onKey(ev) {
        if (ev.key === 'Escape') { ev.preventDefault(); cleanup('cancel'); }
        else if (ev.key === 'Enter' && ev.target === printBtn) {
          ev.preventDefault(); doPrint();
        }
      }
      function doPrint() {
        try {
          const win = iframe.contentWindow;
          if (!win) { cleanup('cancel'); return; }
          // Focus the iframe before print so the print job uses its
          // document, not the parent's.
          try { win.focus(); } catch (_) {}
          try {
            win.print();
          } catch (e) {
            try { console.warn('[print-iframe] iframe print failed:', e && e.message); } catch (_) {}
          }
          // Give the print dialog a moment to engage before tearing
          // down the iframe (some browsers close the dialog if the
          // source DOM disappears mid-flow).
          setTimeout(function () { cleanup('printed'); }, 600);
        } catch (e) {
          cleanup('cancel');
        }
      }
      cancelBtn.addEventListener('click', function () { cleanup('cancel'); });
      printBtn.addEventListener('click', doPrint);
      backdrop.addEventListener('click', function (ev) {
        if (ev.target === backdrop) cleanup('cancel');
      });
      document.addEventListener('keydown', onKey, true);

      document.body.appendChild(backdrop);
      // Write the document into the iframe.
      iframe.addEventListener('load', function () {
        // No-op; we use srcdoc which fires load itself.
      });
      iframe.setAttribute('srcdoc', html);
    });
  }

  // Wrap window.print.
  window.print = function (opts) {
    if (opts && opts.force === true) {
      return origPrint.call(window);
    }
    // Suppress recursive calls from within our own iframe.
    if (window.__antcvPrintingViaModal) {
      return origPrint.call(window);
    }
    window.__antcvPrintingViaModal = true;
    showModal()
      .then(function (answer) {
        window.__antcvPrintingViaModal = false;
        if (answer === 'no-preview') {
          // Fall back to native print so we never block a real
          // print attempt just because we couldn't find the paper.
          try { origPrint.call(window); } catch (_) {}
        }
      })
      .catch(function () {
        window.__antcvPrintingViaModal = false;
      });
  };

  window.AntcvPrintIframePreview = {
    version: '1.40.195',
    _origPrint: origPrint,
    _showModal: showModal,
  };

  try { console.debug('[print-iframe-preview] installed v1.40.195'); } catch (_) {}
})();
