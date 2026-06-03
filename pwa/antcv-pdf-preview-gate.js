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
  window.__antcvPdfPreviewGateInstalled = '1.50.50';

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
      #${MODAL_ID}-docx {
        background: #6d28d9;
        color: #fff;
        border: 1px solid #6d28d9;
      }
      #${MODAL_ID}-docx:hover { background: #5b21b6; }
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
      title.textContent = 'Document export · ' + previewPapers.length + ' pages';
    } else {
      title.textContent = 'Document export';
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
      // v1.50.33 — multi-page handling. The PWA renders the WHOLE CV
      // as a single tall .antcv-preview-paper with internal page-break
      // markers (see antcv-page-breaks-everywhere-284.js). v1.50.32
      // forced width:210mm + min-height:297mm + overflow:hidden which
      // clipped everything past the first A4 sheet — that's exactly
      // why the user saw "page 1 only, squeezed". The fix:
      //   - DO NOT force paper width / height / overflow. Let the
      //     paper render at its natural dimensions (the inherited
      //     stylesheet already targets A4 layout).
      //   - @page sets the print sheet size to A4 with small margins
      //     so headers/footers added by the browser don't crop CV
      //     content.
      //   - Add explicit page-break-before on any element flagged by
      //     the existing page-break sidecars so multi-page CVs split
      //     cleanly at the intended boundaries instead of mid-section.
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
  /* Screen view inside the iframe — soft slate bg so the white
     paper stands out. */
  html, body { margin: 0; padding: 0; background: #e8eef3; }
  body { padding: 12px; }
  .antcv-preview-paper {
    margin: 0 auto 14px auto;
    background: #fff;
    box-shadow: 0 2px 12px rgba(0,0,0,.15);
    /* NO fixed width / height / overflow — let the cloned paper
       keep its inherited PWA-rendered dimensions. */
  }
  .antcv-preview-paper:last-child { margin-bottom: 0; }
  /* Hide any sidecar overlays / FABs that may have been cloned. */
  .antcv-fab, [class*="antcv-fab"], .antcv-overlay, [class*="antcv-overlay"] {
    display: none !important;
  }

  /* Print pagination. */
  @page { size: A4; margin: 10mm; }
  @media print {
    html, body { background: #fff; margin: 0; padding: 0; }
    .antcv-preview-paper {
      box-shadow: none !important;
      margin: 0 !important;
      page-break-after: avoid;
      break-after: avoid;
    }
    /* Multi-paper case (rare): each separate .antcv-preview-paper
       starts a new sheet so they don't blend together on print. */
    .antcv-preview-paper + .antcv-preview-paper {
      page-break-before: always;
      break-before: page;
    }
    /* Existing page-break markers injected by
       antcv-page-breaks-everywhere-284 / item-pages-render. Honour
       them in print so a single tall paper splits at the right
       points instead of mid-section. */
    [data-antcv-page-break],
    [data-antcv-page-marker],
    .antcv-page-break,
    .antcv-page-marker,
    [data-page-break-before="true"] {
      page-break-before: always;
      break-before: page;
    }
    /* Keep each section's heading on the same page as its first
       row of content. */
    [data-sid] > :first-child,
    h1, h2, h3, h4 {
      page-break-after: avoid;
      break-after: avoid;
    }
    /* Reduce orphan/widow risk on multi-line paragraphs. */
    p, li, tr { page-break-inside: avoid; break-inside: avoid; }
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
    print.textContent = 'Save as PDF';
    print.title =
      'Save as PDF. Uses the app’s server-side ATS PDF export when available, ' +
      'falling back to the browser print dialog (choose "Save as PDF").';
    print.addEventListener('click', () => {
      // Prefer the app's real PDF export (CloudConvert /generate-pdf when the
      // docx-worker has CLOUDCONVERT_API_KEY — proper Unicode-embedded ATS
      // PDF). Identify it by its stable title prefix. Fall back to printing
      // the iframe clone if that button isn't present.
      const realPdf = document.querySelector('button[title^="Export as PDF"]');
      if (realPdf) {
        closeModal();
        setTimeout(() => { try { realPdf.click(); } catch (_) {} }, 60);
        return;
      }
      const target = modal._antcvPrintTarget;
      if (!target || !target.contentWindow) {
        try { window.print(); } catch (_) {}
        return;
      }
      try {
        target.contentWindow.focus();
        target.contentWindow.print();
      } catch (_) {
        // Fallback to top-level print if iframe print is blocked.
        try { window.print(); } catch (_) {}
      }
    });

    // Save as DOCX — delegates to the app's existing DOCX export button
    // (which owns the worker call, inline fallback, password gate, and the
    // CV/CL layout choice). We find it by its stable title prefix and click
    // it, then close the preview so the user sees the download/flow. Distinct
    // purple to set it apart from the teal PDF/Print action.
    const docx = document.createElement('button');
    docx.id = MODAL_ID + '-docx';
    docx.type = 'button';
    docx.textContent = 'Save as DOCX';
    docx.title =
      'Save as .docx (recommended for job applications). Opens in Word, ' +
      'Google Docs, LibreOffice. Uses the same export as the main DOCX button.';
    docx.addEventListener('click', () => {
      const btn = document.querySelector('button[title^="Export as .docx"]');
      if (!btn) {
        alert('The DOCX export button isn\'t available right now.\n\n' +
          'Switch to the document view and try the DOCX export there.');
        return;
      }
      closeModal();
      // Defer so the modal teardown finishes before the export dialog/flow.
      setTimeout(() => { try { btn.click(); } catch (_) {} }, 60);
    });

    actions.appendChild(cancel);
    actions.appendChild(docx);
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
  // ─── Visibility gate (v1.50.47) ──────────────────────────────────
  // The FAB must appear ONLY when the document preview is actually on
  // screen — not on the login screen, the Settings panels, or the wizard.
  // Earlier builds injected the FAB unconditionally, so it bled into those
  // views. We gate on a real, RENDERED .antcv-preview-paper: present in the
  // DOM and actually visible (has layout boxes / non-zero size). On login
  // and Settings there is no rendered preview paper, so the FAB hides.
  function previewIsOnScreen() {
    try {
      var papers = document.querySelectorAll('.antcv-preview-paper');
      for (var i = 0; i < papers.length; i++) {
        var p = papers[i];
        // offsetParent is null for display:none / detached nodes. Also
        // require a non-trivial rendered size so a 0x0 placeholder doesn't
        // count.
        if (p.offsetParent !== null) {
          var r = p.getBoundingClientRect();
          if (r.width > 40 && r.height > 40) return true;
        }
      }
    } catch (_) {}
    return false;
  }
  // v1.50.49 — the preview modal is now the single export surface, so the
  // embedded gray-zone export buttons are hidden. We hide (not remove) them so
  // the modal's Save-as-PDF / Save-as-DOCX can still find and click them to
  // reuse the app's real export pipelines. Visually-hidden + out of tab order.
  function hideEmbeddedExportButtons() {
    try {
      var sels = ['button[title^="Export as PDF"]', 'button[title^="Export as .docx"]'];
      for (var k = 0; k < sels.length; k++) {
        var btns = document.querySelectorAll(sels[k]);
        for (var i = 0; i < btns.length; i++) {
          var b = btns[i];
          // Never touch buttons inside our own preview modal.
          if (b.closest && b.closest('#' + MODAL_ID + '-backdrop')) continue;
          if (b.id && b.id.indexOf(MODAL_ID) === 0) continue;
          if (b.getAttribute('data-antcv-embedded-export-hidden') === '1') continue;
          b.setAttribute('data-antcv-embedded-export-hidden', '1');
          b.setAttribute('aria-hidden', 'true');
          b.setAttribute('tabindex', '-1');
          b.style.setProperty('position', 'absolute', 'important');
          b.style.setProperty('width', '1px', 'important');
          b.style.setProperty('height', '1px', 'important');
          b.style.setProperty('padding', '0', 'important');
          b.style.setProperty('margin', '-1px', 'important');
          b.style.setProperty('overflow', 'hidden', 'important');
          b.style.setProperty('clip', 'rect(0 0 0 0)', 'important');
          b.style.setProperty('white-space', 'nowrap', 'important');
          b.style.setProperty('border', '0', 'important');
          b.style.setProperty('opacity', '0', 'important');
          b.style.setProperty('pointer-events', 'none', 'important');
        }
      }
    } catch (_) {}
  }

  function syncFabVisibility() {
    var fab = document.getElementById(FAB_ID);
    if (!fab) return;
    var show = previewIsOnScreen();
    fab.style.setProperty('display', show ? '' : 'none', 'important');
    // Keep it out of the tab order when hidden.
    if (show) fab.removeAttribute('tabindex');
    else fab.setAttribute('tabindex', '-1');
  }

  function injectFab() {
    if (document.getElementById(FAB_ID)) return;
    injectStylesOnce();
    const fab = document.createElement('button');
    fab.id = FAB_ID;
    fab.type = 'button';
    fab.setAttribute('aria-label', 'Export — preview and save as PDF or DOCX');
    fab.title = 'Export — preview the document and save as PDF or DOCX';
    // v1.50.51 — keep the SVG document icon (the "page" affordance the user
    // asked to retain) but shorten the visible text label from
    // "Document export" to "Export". innerHTML is safe here — no user input
    // flows into this string.
    fab.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/>' +
        '<path d="M14 3v6h5"/>' +
        '<path d="M9 14h6"/>' +
        '<path d="M9 18h4"/>' +
      '</svg><span>Export</span>';
    fab.addEventListener('click', () => openModal());
    document.body.appendChild(fab);
    syncFabVisibility();
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
      syncFabVisibility();
      hideEmbeddedExportButtons();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    // Backstop: views can change without a body childList mutation
    // (e.g. a CSS/display toggle deep in the tree). A light poll keeps
    // the FAB's visibility correct without depending on mutations.
    setInterval(function () { syncFabVisibility(); hideEmbeddedExportButtons(); }, 600);
    syncFabVisibility();
    hideEmbeddedExportButtons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  // Public API for diagnostics / power-users.
  window.AntcvPdfPreviewGate = {
    version: '1.50.50',
    open: openModal,
    close: closeModal,
  };
})();
