/* AntCV PDF preview gate (v1.50.31)
 * ====================================================================
 *
 * Background — what this sidecar fixes
 * ------------------------------------
 * 1. The PDF export path inside app.js currently throws
 *    `TypeError: Assignment to constant variable` from a function
 *    `b()` called by `Array.map` inside `buildHTMLDoc`. The error
 *    surfaces to the user as a native browser alert that begins with
 *    "Export failed:" — uninformative and blocking.
 *
 * 2. The existing PDF flow downloads the .pdf directly. Users have
 *    asked for a preview-first workflow that prevents overuse of the
 *    function (every cycle costs LLM/render time, and you only want
 *    to commit when you're sure the document is right).
 *
 * Strategy
 * --------
 * Two additive surfaces, no app.js or React-island changes:
 *
 *   A. Floating "📄 Preview" FAB pinned bottom-left. Click opens a
 *      modal that renders a clone of the live `.antcv-preview-paper`
 *      (the CV — picked by the same "find the paper with a photo"
 *      heuristic that v1.50.29 uses for the photo-position sidecar)
 *      inside an iframe. The iframe is the right surface because
 *      iframe.contentWindow.print() prints ONLY the iframe content;
 *      window.print() at the page level would dump the whole PWA
 *      chrome.
 *
 *   B. `window.alert` wrap. When app.js's broken buildHTMLDoc throws,
 *      the alert text starts with "Export failed:". We detect that
 *      prefix, suppress the raw alert, and open the same preview
 *      modal with a small banner explaining "the built-in PDF
 *      pipeline threw an error — use the Print path instead".
 *
 * The user's existing PDF export button is NOT intercepted. Touching
 * it risks breaking the working DOCX flow that shares onClick code in
 * the minified app.js. Floating-FAB + alert-wrap is purely additive.
 *
 * No app.js changes. No React-islands changes. Standalone IIFE,
 * loaded via index.html.
 */
(function () {
  'use strict';

  if (window.__antcvPdfPreviewGateInstalled) return;
  window.__antcvPdfPreviewGateInstalled = '1.50.31';

  const FAB_ID = 'antcv-pdf-preview-fab';
  const MODAL_ID = 'antcv-pdf-preview-modal';
  const STYLE_ID = 'antcv-pdf-preview-styles';

  // ─── Style injection ─────────────────────────────────────────────
  function injectStylesOnce() {
    if (document.getElementById(STYLE_ID)) return;
    const css = `
      /* v1.50.32 — pill-shaped FAB with text label "Preview PDF". The
         previous emoji-only round icon was easy to miss (and the 📄
         glyph rendered as an invisible Tofu box on some systems
         where the user couldn't find the FAB at all). z-index now
         clears the overlay (99999) and most editor chrome but stays
         below the mobile bottom-nav (2147481600). */
      #${FAB_ID} {
        position: fixed;
        bottom: 100px;
        left: 16px;
        z-index: 2147481400;
        padding: 0 16px;
        height: 44px;
        min-width: 44px;
        border-radius: 22px;
        background: #00746E;
        color: #fff;
        border: 1px solid #00867F;
        cursor: pointer;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.02em;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        box-shadow: 0 4px 14px rgba(0,0,0,.40);
        display: inline-flex;
        align-items: center;
        gap: 6px;
        opacity: 0.96;
        transition: opacity 0.15s, transform 0.15s, background 0.15s;
      }
      #${FAB_ID}:hover { opacity: 1; background: #00867F; transform: translateY(-1px); }
      #${FAB_ID}:focus-visible { outline: 2.5px solid #01B7BB; outline-offset: 2px; }
      #${FAB_ID} svg { width: 16px; height: 16px; flex: 0 0 auto; }

      #${MODAL_ID}-backdrop {
        position: fixed;
        inset: 0;
        z-index: 2147483400;
        background: rgba(20, 28, 44, 0.62);
        display: flex;
        align-items: stretch;
        justify-content: center;
        padding: 4vh 16px;
        backdrop-filter: blur(2px);
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      #${MODAL_ID} {
        background: #fff;
        color: #1a2433;
        max-width: 880px;
        width: 100%;
        max-height: 92vh;
        border-radius: 12px;
        box-shadow: 0 12px 36px rgba(0,0,0,.4);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      #${MODAL_ID}-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 18px;
        background: #283556;
        color: #fff;
        border-bottom: 1px solid rgba(255,255,255,.10);
      }
      #${MODAL_ID}-title { font-weight: 700; font-size: 15px; }
      #${MODAL_ID}-close {
        background: transparent;
        border: 1px solid rgba(255,255,255,.30);
        color: #fff;
        cursor: pointer;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 700;
      }
      #${MODAL_ID}-close:hover { background: rgba(255,255,255,.10); }

      #${MODAL_ID}-banner {
        padding: 10px 16px;
        background: #fff5e1;
        color: #6d4c11;
        font-size: 12.5px;
        line-height: 1.45;
        border-bottom: 1px solid #d9a23a;
      }
      #${MODAL_ID}-banner.hidden { display: none; }

      #${MODAL_ID}-iframe-wrap {
        flex: 1;
        background: #e8eef3;
        padding: 14px;
        overflow: auto;
      }
      #${MODAL_ID}-iframe {
        width: 100%;
        height: 100%;
        min-height: 50vh;
        background: #fff;
        border: 1px solid rgba(0,0,0,.10);
        border-radius: 4px;
        box-shadow: 0 1px 4px rgba(0,0,0,.10);
      }
      #${MODAL_ID}-iframe-empty {
        padding: 24px 16px;
        font-size: 13px;
        color: #555;
        text-align: center;
      }

      #${MODAL_ID}-actions {
        display: flex;
        gap: 8px;
        padding: 12px 18px;
        background: #f7f9fc;
        border-top: 1px solid rgba(0,0,0,.08);
        justify-content: flex-end;
        flex-wrap: wrap;
      }
      #${MODAL_ID}-actions button {
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 650;
        font-family: inherit;
      }
      #${MODAL_ID}-print {
        background: #00746E;
        color: #fff;
        border: 1px solid #00746E;
      }
      #${MODAL_ID}-print:hover { background: #00867F; }
      #${MODAL_ID}-secondary {
        background: #fff;
        color: #283556;
        border: 1px solid rgba(40,53,86,.45);
      }
      #${MODAL_ID}-secondary:hover { background: #f0f3f7; }

      @media (max-width: 600px) {
        #${MODAL_ID}-backdrop { padding: 0; }
        #${MODAL_ID} {
          max-width: 100%;
          width: 100%;
          max-height: 100vh;
          border-radius: 0;
        }
      }
    `;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = css;
    document.head.appendChild(s);
  }

  // ─── Find the live preview papers ────────────────────────────────
  // v1.50.32 — return EVERY .antcv-preview-paper in DOM order. v1.50.31
  // returned only the paper containing the photo, which on a multi-page
  // CV meant the iframe carried only page 1 and the print dialog
  // cropped the rest. Multi-page CVs render as multiple paper elements
  // stacked vertically; we need all of them.
  //
  // When BOTH the CV and the CL are mounted (dual-view mode), the
  // function still returns all papers. The user can disambiguate by
  // switching to the document they want before opening the modal.
  // Practical disambiguation that worked for v1.50.29 (find the paper
  // with a photo) is too brittle here because only page 1 of the CV
  // carries the photo; pages 2+ would be excluded.
  function findAllActivePapers() {
    return Array.from(document.querySelectorAll('.antcv-preview-paper'));
  }

  // ─── Build the modal ─────────────────────────────────────────────
  function buildModal({ errorText }) {
    injectStylesOnce();

    // If a previous modal is still mounted (back-to-back triggers),
    // remove it so we don't stack.
    const existing = document.getElementById(MODAL_ID + '-backdrop');
    if (existing && existing.parentElement) existing.parentElement.removeChild(existing);

    const backdrop = document.createElement('div');
    backdrop.id = MODAL_ID + '-backdrop';

    const modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', MODAL_ID + '-title');

    // Header
    const header = document.createElement('div');
    header.id = MODAL_ID + '-header';
    const title = document.createElement('span');
    title.id = MODAL_ID + '-title';
    // v1.50.32 — page count in the title so the user sees at a glance
    // whether the preview captured all pages of their CV.
    const previewPapers = findAllActivePapers();
    if (previewPapers.length > 1) {
      title.textContent = 'PDF preview · ' + previewPapers.length + ' pages';
    } else {
      title.textContent = 'PDF preview';
    }
    const close = document.createElement('button');
    close.id = MODAL_ID + '-close';
    close.type = 'button';
    close.textContent = 'Close';
    close.addEventListener('click', closeModal);
    header.appendChild(title);
    header.appendChild(close);

    // Banner (error case only)
    const banner = document.createElement('div');
    banner.id = MODAL_ID + '-banner';
    if (errorText) {
      banner.textContent =
        'The built-in PDF export threw a TypeError. The document content below is intact — ' +
        'use the Print button to save it via your browser’s print dialog while we patch the issue.';
      banner.title = errorText;
    } else {
      banner.classList.add('hidden');
    }

    // Iframe wrap
    const wrap = document.createElement('div');
    wrap.id = MODAL_ID + '-iframe-wrap';

    const papers = findAllActivePapers();
    if (!papers.length) {
      const empty = document.createElement('div');
      empty.id = MODAL_ID + '-iframe-empty';
      empty.textContent =
        'No live preview detected. Open the editor first so the CV paper renders, then try again.';
      wrap.appendChild(empty);
    } else {
      const iframe = document.createElement('iframe');
      iframe.id = MODAL_ID + '-iframe';
      iframe.title = 'CV preview';
      // Same-origin srcdoc — no network round trip, no CSP issues with
      // most policies. We copy the page\'s computed styles into the
      // iframe head so the cloned paper renders with the same fonts,
      // colours, table widths, etc., that the user sees in the live
      // preview.
      const sheetLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .map(l => '<link rel="stylesheet" href="' + l.href.replace(/"/g, '&quot;') + '">')
        .join('\n');
      const inlineStyles = Array.from(document.querySelectorAll('style'))
        .map(s => '<style>' + (s.textContent || '') + '</style>')
        .join('\n');
      // v1.50.32 — stack EVERY paper. Multi-page CVs render as N
      // .antcv-preview-paper elements in DOM order; v1.50.31 grabbed
      // just one and the print cropped the rest. Joining outerHTML
      // preserves each paper\'s inline styles, fonts, and table
      // layouts so the iframe matches what the user sees on screen.
      const paperHtml = papers.map(p => p.outerHTML).join('\n');
      const pageCount = papers.length;
      const srcdoc = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>CV preview</title>
${sheetLinks}
${inlineStyles}
<style>
  html, body { margin: 0; padding: 0; background: #e8eef3; }
  body { padding: 12px; }
  .antcv-preview-paper {
    margin: 0 auto 14px auto;
    box-shadow: 0 2px 12px rgba(0,0,0,.15);
    /* v1.50.32 — fixed A4 width so multi-page CVs print at the
       intended size. The PWA renders the paper at this width too;
       echoing it here decouples the iframe from any inherited
       layout constraints. */
    width: 210mm;
    min-height: 297mm;
    box-sizing: border-box;
    background: #fff;
    overflow: hidden;
  }
  .antcv-preview-paper:last-child { margin-bottom: 0; }
  /* Hide any sidecar overlays that might be cloned along with the paper. */
  .antcv-fab, [class*="antcv-fab"], .antcv-overlay, [class*="antcv-overlay"] { display: none !important; }

  /* v1.50.32 — print pagination. @page sets the printable size to
     A4 with zero margin (the paper already carries its own internal
     padding). Each .antcv-preview-paper gets page-break-after:
     always so multi-page CVs paginate cleanly — without this rule
     the browser dumped everything onto sheet 1 and clipped the
     rest. The :last-child override prevents a trailing blank
     sheet after the final page. */
  @page { size: A4; margin: 0; }
  @media print {
    html, body { background: #fff; }
    body { padding: 0; }
    .antcv-preview-paper {
      box-shadow: none !important;
      margin: 0 !important;
      page-break-after: always;
      break-after: page;
    }
    .antcv-preview-paper:last-child {
      page-break-after: auto;
      break-after: auto;
    }
  }
</style>
</head>
<body data-antcv-pages="${pageCount}">${paperHtml}</body>
</html>`;
      iframe.srcdoc = srcdoc;
      wrap.appendChild(iframe);

      // ─ Wire the Print button to iframe.contentWindow.print() ─
      iframe.addEventListener('load', () => {
        // Stash a reference on the modal so onPrint can use it later.
        modal._antcvPrintTarget = iframe;
      });
    }

    // Actions
    const actions = document.createElement('div');
    actions.id = MODAL_ID + '-actions';

    const cancel = document.createElement('button');
    cancel.id = MODAL_ID + '-secondary';
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', closeModal);

    const print = document.createElement('button');
    print.id = MODAL_ID + '-print';
    print.type = 'button';
    print.textContent = 'Save as PDF (Print)';
    print.title =
      'Opens your browser’s print dialog. Choose "Save as PDF" as the destination. ' +
      'Works regardless of whether the built-in export is currently broken.';
    print.addEventListener('click', () => {
      const target = modal._antcvPrintTarget;
      if (!target || !target.contentWindow) return;
      try {
        target.contentWindow.focus();
        target.contentWindow.print();
      } catch (_) {
        // Fallback to top-level print if iframe print is blocked.
        try { window.print(); } catch (_) {}
      }
    });

    actions.appendChild(cancel);
    actions.appendChild(print);

    // Assemble
    modal.appendChild(header);
    modal.appendChild(banner);
    modal.appendChild(wrap);
    modal.appendChild(actions);
    backdrop.appendChild(modal);

    // Click outside closes.
    backdrop.addEventListener('click', (ev) => {
      if (ev.target === backdrop) closeModal();
    });

    // Escape closes.
    const onKey = (ev) => {
      if (ev.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', onKey);
    backdrop._antcvKeyHandler = onKey;

    return backdrop;
  }

  function closeModal() {
    const el = document.getElementById(MODAL_ID + '-backdrop');
    if (!el) return;
    try {
      const handler = el._antcvKeyHandler;
      if (handler) document.removeEventListener('keydown', handler);
    } catch (_) {}
    if (el.parentElement) el.parentElement.removeChild(el);
  }

  function openModal({ errorText } = {}) {
    const backdrop = buildModal({ errorText: errorText || null });
    document.body.appendChild(backdrop);
  }

  // ─── Floating FAB ────────────────────────────────────────────────
  function injectFab() {
    if (document.getElementById(FAB_ID)) return;
    injectStylesOnce();
    const fab = document.createElement('button');
    fab.id = FAB_ID;
    fab.type = 'button';
    fab.setAttribute('aria-label', 'Preview document and save as PDF');
    fab.title = 'Preview the CV and save as PDF via browser print';
    // v1.50.32 — SVG document icon + "Preview PDF" text label.
    // Replaces the 📄 emoji that didn\'t render on some systems and
    // gave the FAB no apparent affordance. innerHTML is safe here —
    // no user input flows into this string.
    fab.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/>' +
        '<path d="M14 3v6h5"/>' +
        '<path d="M9 14h6"/>' +
        '<path d="M9 18h4"/>' +
      '</svg><span>Preview PDF</span>';
    fab.addEventListener('click', () => openModal());
    document.body.appendChild(fab);
  }

  // ─── window.alert wrap ───────────────────────────────────────────
  // Only catches alerts whose text starts with "Export failed:" so we
  // don\'t intercept legitimate confirmation/notice alerts elsewhere.
  function installAlertWrap() {
    if (window.__antcvAlertWrappedForPdf) return;
    window.__antcvAlertWrappedForPdf = true;
    const orig = window.alert;
    window.alert = function (msg) {
      try {
        const text = msg == null ? '' : String(msg);
        if (/^\s*Export failed:/i.test(text)) {
          openModal({ errorText: text });
          return;
        }
      } catch (_) {}
      return orig.apply(this, arguments);
    };
  }

  // ─── Boot ────────────────────────────────────────────────────────
  function boot() {
    injectStylesOnce();
    injectFab();
    installAlertWrap();

    // Re-inject FAB if the React shell remounts and wipes the body.
    const observer = new MutationObserver(() => {
      if (!document.getElementById(FAB_ID)) injectFab();
    });
    observer.observe(document.body, { childList: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  // Public API for diagnostics / power-users.
  window.AntcvPdfPreviewGate = {
    version: '1.50.31',
    open: openModal,
    close: closeModal,
  };
})();
