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
  window.__antcvPdfPreviewGateInstalled = '1.50.374-page2-print';

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

  // 1.50.374 EXPORT-PAGE2-001 — the PWA preview paginates NATIVELY now: ONE
  // .antcv-preview-paper holding one .antcv-page-row PER A4 page. The page
  // count is the page-row count (falling back to the paper count for the
  // legacy single-box render).
  function countPages(papers) {
    var rows = 0;
    for (var i = 0; i < papers.length; i++) {
      try { rows += papers[i].querySelectorAll('.antcv-page-row').length; } catch (_) {}
    }
    return Math.max(papers.length, rows, 1);
  }
  function pagesTitle(n) {
    return n > 1 ? 'Document export · ' + n + ' pages' : 'Document export';
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
    // 1.50.374 — count NATIVE page-rows, not papers (one paper now holds
    // every page; the old count stuck at "1" for multi-page CVs).
    const previewPapers = findAllActivePapers();
    title.textContent = pagesTitle(countPages(previewPapers));
    // CV/CL toggle (1.50.229) — pill switch in the export-preview header so the
    // user can flip between CV and Cover Letter without closing the modal,
    // switching the live preview, and re-opening. Mirrors the editor's CV/CL
    // pill. Reads current doc via window.AntcvGetDoc, switches via
    // window.AntcvSetDoc (both exposed by app.src.js); falls back to direct
    // localStorage('doc') write if the helpers haven't mounted yet.
    var currentDoc = (function () {
      try {
        if (typeof window.AntcvGetDoc === 'function') {
          var d0 = String(window.AntcvGetDoc() || '').toLowerCase();
          if (d0 === 'cv' || d0 === 'cl') return d0;
        }
      } catch (_) {}
      try {
        var raw = localStorage.getItem('doc') || 'cv';
        try { var p = JSON.parse(raw); if (typeof p === 'string') raw = p; } catch (_) {}
        return String(raw).toLowerCase() === 'cl' ? 'cl' : 'cv';
      } catch (_) { return 'cv'; }
    })();
    var docToggle = document.createElement('button');
    docToggle.id = MODAL_ID + '-doc-toggle';
    docToggle.type = 'button';
    docToggle.setAttribute('aria-label', 'Switch between CV and Cover Letter preview');
    docToggle.style.cssText = [
      'flex:0 0 74px', 'height:30px', 'border-radius:999px',
      'border:1px solid rgba(8,86,96,0.2)', 'background:#DFF4F4',
      'padding:3px', 'display:grid', 'grid-template-columns:1fr 1fr',
      'align-items:center', 'position:relative',
      'color:#07545E', 'font-weight:900', 'font-size:11px',
      'cursor:pointer', 'margin-right:8px',
    ].join(';');
    var docKnob = document.createElement('span');
    docKnob.style.cssText = [
      'position:absolute', 'top:3px', 'bottom:3px', 'border-radius:999px',
      'background:#087F7A', 'transition:left .16s', 'width:calc(50% - 3px)',
    ].join(';');
    var docLabelCv = document.createElement('span');
    docLabelCv.textContent = 'CV';
    docLabelCv.style.cssText = 'position:relative;z-index:1;text-align:center';
    var docLabelCl = document.createElement('span');
    docLabelCl.textContent = 'CL';
    docLabelCl.style.cssText = 'position:relative;z-index:1;text-align:center';
    docToggle.appendChild(docKnob);
    docToggle.appendChild(docLabelCv);
    docToggle.appendChild(docLabelCl);
    function paintDocToggle(d) {
      currentDoc = d === 'cl' ? 'cl' : 'cv';
      docKnob.style.left = currentDoc === 'cv' ? '3px' : 'calc(50% + 0px)';
      docLabelCv.style.color = currentDoc === 'cv' ? '#fff' : '#07545E';
      docLabelCl.style.color = currentDoc === 'cl' ? '#fff' : '#07545E';
    }
    paintDocToggle(currentDoc);

    const close = document.createElement('button');
    close.id = MODAL_ID + '-close';
    close.type = 'button';
    close.textContent = 'Close';
    close.addEventListener('click', closeModal);
    header.appendChild(title);
    header.appendChild(docToggle);
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
      const pageCount = countPages(papers);
      // 1.50.374 EXPORT-PAGE2-001: when the clone carries native page-rows,
      // each row IS a full A4 sheet (its own padding included) — the print
      // sheet must have NO extra margin or every row spills a sliver onto a
      // blank page. The legacy single-box render keeps the 10mm margin.
      const hasPageRows = papers.some(p => { try { return !!p.querySelector('.antcv-page-row'); } catch (_) { return false; } });
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
  /* Fit-to-width (owner: export preview was "too stretched", main column
     cut on the right on mobile). The A4 paper (~794px) is wider than a
     phone iframe, so we scale the whole body down to fit via a JS-set CSS
     var. SCREEN ONLY — print keeps full A4 (@page below) so the PDF is not
     shrunk. */
  @media screen { body.antcv-fit-width { zoom: var(--antcv-fit, 1); } }
  /* Hide any sidecar overlays / FABs that may have been cloned. */
  .antcv-fab, [class*="antcv-fab"], .antcv-overlay, [class*="antcv-overlay"] {
    display: none !important;
  }

  /* Print pagination. */
  @page { size: A4; margin: ${hasPageRows ? '0' : '10mm'}; }
  @media print {
    html, body { background: #fff; margin: 0; padding: 0; }
    /* 1.50.374 EXPORT-PAGE2-001: the preview paginates NATIVELY into
       .antcv-page-row boxes (one per A4 page). None of the legacy marker
       attributes below exist on them, so the print engine re-paginated the
       tall paper arbitrarily (mid-section cuts — "breaks not applied").
       Each page-row starts its own sheet and is clamped to one sheet. */
    .antcv-page-row + .antcv-page-row { page-break-before: always; break-before: page; }
    .antcv-page-row { max-height: 297mm; overflow: hidden; page-break-inside: avoid; break-inside: avoid; }
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
       points instead of mid-section.
       1.50.249: include data-antcv-page-break-284 (the suffixed
       attribute the sidecar actually writes — the unsuffixed selector
       below was a no-op against the live DOM, which is why print
       preview always collapsed to a single page). */
    [data-antcv-page-break],
    [data-antcv-page-break-284],
    [data-antcv-page-marker],
    [data-antcv-continuation-header],
    [data-antcv-sidebar-pagebreak-329],
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

      // 1.50.374 EXPORT-PREVIEW-FEATURES-001(c) — page selector. Numbered
      // chips under the header jump the iframe to that page-row. Rebuilt
      // whenever the iframe content changes (CV<->CL toggle).
      var pager = document.createElement('div');
      pager.id = MODAL_ID + '-pager';
      pager.setAttribute('role', 'navigation');
      pager.setAttribute('aria-label', 'Preview page selector');
      pager.style.cssText = [
        'display:none', 'gap:6px', 'padding:8px 16px 0 16px',
        'background:#e8eef3', 'flex-wrap:wrap', 'align-items:center',
      ].join(';');
      function renderPager(count) {
        pager.innerHTML = '';
        if (!(count > 1)) { pager.style.display = 'none'; return; }
        pager.style.display = 'flex';
        var lab = document.createElement('span');
        lab.textContent = 'Page:';
        lab.style.cssText = 'font-size:12px;color:#445;font-weight:650';
        pager.appendChild(lab);
        for (var n = 1; n <= count; n++) {
          (function (pn) {
            var chip = document.createElement('button');
            chip.type = 'button';
            chip.textContent = String(pn);
            chip.setAttribute('aria-label', 'Scroll to page ' + pn);
            chip.style.cssText = [
              'min-width:28px', 'height:26px', 'border-radius:6px',
              'border:1px solid rgba(40,53,86,.35)', 'background:#fff',
              'color:#283556', 'font-size:12px', 'font-weight:700', 'cursor:pointer',
            ].join(';');
            chip.addEventListener('click', function () {
              try {
                var d = iframe.contentDocument;
                if (!d) return;
                var rows = d.querySelectorAll('.antcv-page-row');
                var target = rows.length ? rows[pn - 1] : d.querySelectorAll('.antcv-preview-paper')[pn - 1];
                if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
              } catch (_) {}
            });
            pager.appendChild(chip);
          })(n);
        }
      }

      // Hook the doc-toggle to rebuild the iframe in place after the live
      // preview switches CV<->CL.
      function rebuildIframeFromLive() {
        try {
          var nextPapers = findAllActivePapers();
          if (!nextPapers || !nextPapers.length) return;
          var nextPaperHtml = nextPapers.map(function (p) { return p.outerHTML; }).join('\n');
          var nextPageCount = countPages(nextPapers);
          title.textContent = pagesTitle(nextPageCount);
          renderPager(nextPageCount);
          var nextSrcdoc = srcdoc.replace(
            /<body([^>]*)>[\s\S]*<\/body>/,
            '<body data-antcv-pages="' + nextPageCount + '">' + nextPaperHtml + '</body>'
          );
          iframe.srcdoc = nextSrcdoc;
        } catch (e) {
          try { console.warn('[pdf-preview-gate] rebuild failed:', e && e.message); } catch (_) {}
        }
      }
      renderPager(pageCount);
      modal._antcvPager = pager;
      docToggle.addEventListener('click', function () {
        var next = currentDoc === 'cv' ? 'cl' : 'cv';
        paintDocToggle(next);
        try {
          if (typeof window.AntcvSetDoc === 'function') window.AntcvSetDoc(next);
          else {
            // Fallback: write localStorage and dispatch a synthetic event so
            // listeners pick it up. The live preview React tree may not
            // observe this without AntcvSetDoc, in which case the user must
            // reopen the modal — surfaced via title hint.
            localStorage.setItem('doc', next);
          }
        } catch (_) {}
        // Wait long enough for React to re-render + sidecars to settle, then
        // rebuild the iframe srcdoc from the now-current live preview.
        setTimeout(rebuildIframeFromLive, 320);
      });

      // ─ Wire the Print button to iframe.contentWindow.print() ─
      iframe.addEventListener('load', () => {
        // Stash a reference on the modal so onPrint can use it later.
        modal._antcvPrintTarget = iframe;
        // Fit-to-width (owner #7): squeeze the A4 paper so its full width
        // fits the iframe viewport — no right-edge clipping on mobile. We
        // set a CSS var consumed by a SCREEN-ONLY zoom rule, so the print
        // path stays full A4. Re-fit on resize/orientation change.
        const fitWidth = () => {
          try {
            const idoc = iframe.contentDocument;
            const ibody = idoc && idoc.body;
            const paper = ibody && ibody.querySelector('.antcv-preview-paper');
            if (!ibody || !paper) return;
            // Measure at natural scale: clear any prior fit first.
            ibody.classList.remove('antcv-fit-width');
            ibody.style.removeProperty('--antcv-fit');
            const avail = (iframe.clientWidth || ibody.clientWidth || 0) - 24; // body padding
            const pw = paper.getBoundingClientRect().width;
            if (pw > 0 && avail > 0 && pw > avail) {
              ibody.style.setProperty('--antcv-fit', String(Math.max(0.3, avail / pw)));
              ibody.classList.add('antcv-fit-width');
            }
          } catch (_) {}
        };
        fitWidth();
        try { window.addEventListener('resize', fitWidth, { passive: true }); } catch (_) {}
        iframe._antcvFitWidth = fitWidth;
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
      closeModal();
      // Defer so the modal teardown finishes before the export dialog/flow.
      setTimeout(() => { triggerDocxExport(); }, 60);
    });

    actions.appendChild(cancel);
    actions.appendChild(docx);
    actions.appendChild(print);

    // Assemble
    modal.appendChild(header);
    modal.appendChild(banner);
    if (modal._antcvPager) modal.appendChild(modal._antcvPager);
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
    // Drop the fit-to-width resize listener so it doesn't accumulate / pin
    // the iframe across re-opens.
    try {
      const ifr = document.getElementById(MODAL_ID + '-iframe');
      if (ifr && ifr._antcvFitWidth) window.removeEventListener('resize', ifr._antcvFitWidth);
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
  // v1.50.90 — DOCX export from the preview modal. Previously this ONLY found
  // and clicked the app's hidden `button[title^="Export as .docx"]`; when that
  // button wasn't reachable in the current view it just alerted "isn't ready"
  // and nothing downloaded. Now: (1) try several ways to find + click the app
  // button (it owns the exact payload), (2) if it can't be found, call
  // window.exportDocxViaWorker directly with a payload rebuilt from
  // localStorage. Logs which path it took so the failure mode is visible.
  function findAppDocxButton() {
    var b = document.querySelector('button[title^="Export as .docx"], button[title*="Export as .docx"]');
    if (b) return b;
    var all = document.querySelectorAll('button');
    for (var i = 0; i < all.length; i++) {
      var t = ((all[i].textContent || '') + ' ' + (all[i].getAttribute('title') || '')).toLowerCase();
      if (all[i].id && all[i].id.indexOf('antcv-pdf-preview-modal') === 0) continue;
      if (/export as \.?docx|save as docx|export.*\bword\b/.test(t)) return all[i];
    }
    return null;
  }
  function buildDocxPayloadFromStorage() {
    function s(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (_) { return d; } }
    function j(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (_) { return d; } }
    // The DOCX worker schema only accepts language en|da. Sending anything else
    // (e.g. es/zh while the UI is in those languages) makes the worker reject
    // the whole request with HTTP 422. Clamp to a supported value so export
    // never hard-fails; da when Danish, otherwise en.
    function clampLang(l) { return /^da/i.test(String(l || '')) ? 'da' : 'en'; }
    // doc may be stored bare ('cl') OR JSON-encoded ('"cl"'); handle both so the
    // CL preview never exports the CV (the bare === 'cl' check missed '"cl"').
    var doc = (function () {
      var d = s('doc', 'cv');
      try { var p = JSON.parse(d); if (typeof p === 'string') d = p; } catch (_) {}
      return String(d).toLowerCase() === 'cl' ? 'cl' : 'cv';
    })();
    var pi = j('personalInfo', {}) || {};
    return {
      sections: j('sections', { cv: [], cl: [] }),
      meta: j('meta', {}),
      doc: doc,
      photo: pi.photo || j('photo', null) || s('antcv_photo', null) || null,
      personalInfo: pi,
      styleConfig: pi.customStyleConfig || undefined,
      fontSizes: pi.fontSizes || undefined,
      language: clampLang(s('language', 'en')),
      navyColor: s('navyColor', '#283556'),
    };
  }
  function triggerDocxExport() {
    var btn = findAppDocxButton();
    if (btn) {
      try { console.debug('[pdf-preview-gate] DOCX: delegating to app button'); } catch (_) {}
      try { btn.click(); return; } catch (_) {}
    }
    if (typeof window.exportDocxViaWorker === 'function' && window.ANTCV_DOCX_WORKER) {
      try {
        console.debug('[pdf-preview-gate] DOCX: app button not found — calling exportDocxViaWorker directly');
        var p = window._antcvShrinkPhoto && (typeof window._antcvShrinkPhoto === 'function');
        var payload = buildDocxPayloadFromStorage();
        Promise.resolve(p ? window._antcvShrinkPhoto(payload.photo).catch(function () { return payload.photo; }) : payload.photo)
          .then(function (ph) { payload.photo = ph; return window.exportDocxViaWorker(payload); })
          .catch(function (e) { try { console.warn('[pdf-preview-gate] DOCX export failed', e && e.message); } catch (_) {} alert('DOCX export failed: ' + (e && e.message || e)); });
        return;
      } catch (e) { try { console.warn('[pdf-preview-gate] DOCX direct call threw', e && e.message); } catch (_) {} }
    }
    alert('The DOCX export isn\'t ready yet.\n\n' +
      'Open your CV or cover-letter preview first (so the document is on screen), then use the Export button. ' +
      'If this keeps happening, the DOCX worker URL may not be configured (Settings → Account).');
  }

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
    version: '1.50.374-page2-print',
    open: openModal,
    close: closeModal,
  };
})();
