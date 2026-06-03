/* AntCV pdf-page-mismatch sidecar (v1.40.196)
 * ============================================================
 *
 * Purpose
 * -------
 * The preview-paper uses CSS-rendered A4 metrics while the docx-
 * worker uses LibreOffice's pagination. The two have drifted ~3-5%
 * historically. Symptom: a CL preview that fits one page on screen
 * spills onto page two in the exported PDF.
 *
 * v1.14.9 of the docx-worker returns `X-AntCV-Pdf-Pages: N` (the
 * page count of the produced PDF). v1.40.196 of antcv-docx-client.js
 * reads that header and includes it as `pages` on the
 * `antcv:pdf-export-success` event detail.
 *
 * This sidecar:
 *   1. Listens for antcv:pdf-export-success.
 *   2. Compares result.pages to the preview-side page count.
 *   3. If they differ, raises a small dismissible chip:
 *        "PDF spans N pages (preview shows M)."
 *   4. The chip stays visible for 12 s or until dismissed.
 *
 * Preview page count
 * ------------------
 * Hard to compute exactly without measuring DOM heights. We use a
 * pragmatic approximation:
 *   - Count `[data-antcv-page-break="1"]` markers (from
 *     antcv-item-pages-render.js v1.40.194+) plus 1.
 *   - If no markers exist, fall back to 1 page for CL and either
 *     1 or 2 for CV based on whether an EXPERIENCE (CONT.) header
 *     is present (we look for both real and our patched-in versions).
 *   - We never assert more than 4 pages from preview alone.
 *
 * Gating
 * ------
 * - No chip if pages is missing/0/non-numeric.
 * - No chip if the difference is just 1 in either direction AND
 *   the user has dismissed a mismatch chip in this session — we
 *   don't nag.
 * - The chip is suppressed when the active doc is CV and the
 *   difference is +1 (CV is allowed 1.5 pages and frequently
 *   ends up either 1 or 2 in the PDF — that's expected, not a bug).
 *   For CL the spec is "1 page max", so any spill is loud.
 */
(function () {
  'use strict';

  if (window.__antcvPdfPageMismatchInstalled) return;
  window.__antcvPdfPageMismatchInstalled = '1.40.196';

  const SESSION_DISMISS_KEY = 'antcv:pdf-mismatch-dismissed';

  function activeDoc() {
    try {
      const v = localStorage.getItem('doc');
      if (v === 'cv' || v === 'cl') return v;
    } catch (_) {}
    return 'cv';
  }

  function getPaper() {
    return document.querySelector('.antcv-preview-paper, [data-antcv-preview-paper]');
  }

  // Approximate preview page count.
  function previewPageCount() {
    const paper = getPaper();
    if (!paper) return null;
    const markers = paper.querySelectorAll('[data-antcv-page-break="1"]');
    let n = markers.length + 1;
    // Sanity clamp.
    if (n < 1) n = 1;
    if (n > 4) n = 4;
    // Heuristic: if no markers and we see a continuation header
    // injected by app.js OR our exp-continuation-fix sidecar,
    // bump to 2.
    if (markers.length === 0) {
      const contHeader = paper.querySelector(
        '[data-antcv-continuation-header="1"], [data-antcv-cont-fix="1"], ' +
        '[data-antcv-page-header]'
      );
      if (contHeader && n < 2) n = 2;
    }
    return n;
  }

  // Toast UI — separate slot from the PDF-error toast.
  let chip = null;
  let chipTimer = null;

  function ensureChip() {
    if (chip) return chip;
    chip = document.createElement('div');
    chip.setAttribute('data-antcv-pdf-mismatch-chip', '1');
    Object.assign(chip.style, {
      position: 'fixed',
      bottom: '64px',
      right: '20px',
      zIndex: '9988',
      maxWidth: '320px',
      padding: '10px 14px',
      background: '#FFF7E0',
      border: '1px solid #E0B040',
      color: '#594018',
      borderRadius: '6px',
      boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
      fontFamily: 'Trebuchet MS, Calibri, sans-serif',
      fontSize: '13px',
      lineHeight: '1.4',
      cursor: 'default',
      display: 'flex',
      gap: '10px',
      alignItems: 'flex-start',
    });
    const icon = document.createElement('div');
    icon.textContent = '⚠';
    Object.assign(icon.style, { fontSize: '15px', flex: '0 0 auto' });
    const body = document.createElement('div');
    body.setAttribute('data-antcv-pdf-mismatch-body', '1');
    Object.assign(body.style, { flex: '1 1 auto', fontWeight: '500' });
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Dismiss');
    Object.assign(closeBtn.style, {
      flex: '0 0 auto',
      background: 'transparent',
      border: 'none',
      color: '#594018',
      fontSize: '17px',
      lineHeight: '1',
      padding: '0 2px',
      cursor: 'pointer',
      fontWeight: '700',
    });
    closeBtn.addEventListener('click', function () {
      dismissChip(true);
    });
    chip.appendChild(icon);
    chip.appendChild(body);
    chip.appendChild(closeBtn);
    document.body.appendChild(chip);
    return chip;
  }

  function dismissChip(rememberSession) {
    if (chipTimer) { clearTimeout(chipTimer); chipTimer = null; }
    if (chip && chip.parentNode) {
      try { chip.parentNode.removeChild(chip); } catch (_) {}
    }
    chip = null;
    if (rememberSession) {
      try { sessionStorage.setItem(SESSION_DISMISS_KEY, '1'); } catch (_) {}
    }
  }

  function sessionDismissed() {
    try { return sessionStorage.getItem(SESSION_DISMISS_KEY) === '1'; } catch (_) { return false; }
  }

  function showChip(message) {
    ensureChip();
    if (!chip) return;
    const body = chip.querySelector('[data-antcv-pdf-mismatch-body]');
    if (body) body.textContent = message;
    if (chipTimer) clearTimeout(chipTimer);
    chipTimer = setTimeout(function () { dismissChip(false); }, 12000);
  }

  function onPdfExportSuccess(ev) {
    const detail = ev && ev.detail;
    if (!detail) return;
    const pdfPages = Number(detail.pages || 0);
    if (!Number.isFinite(pdfPages) || pdfPages <= 0) return;
    const previewPages = previewPageCount();
    if (!previewPages) return;
    if (pdfPages === previewPages) return;
    const doc = activeDoc();
    const diff = pdfPages - previewPages;
    // CV is allowed to be 1.5 pages — tolerate +1 if preview was 1.
    if (doc === 'cv' && diff === 1 && previewPages === 1 && pdfPages === 2) return;
    // Don't nag if user already dismissed in this session.
    if (sessionDismissed()) return;
    const docLabel = doc === 'cl' ? 'Cover letter' : 'CV';
    const msg = docLabel + ' PDF spans ' + pdfPages + ' page' +
      (pdfPages === 1 ? '' : 's') +
      ' — preview shows ' + previewPages + '. The export uses ' +
      "LibreOffice's pagination, which can drift from the CSS preview.";
    showChip(msg);
    try {
      console.warn('[pdf-page-mismatch] doc=' + doc +
        ' pdf=' + pdfPages + ' preview=' + previewPages);
    } catch (_) {}
  }

  // On a fresh export, clear any prior chip (avoids stale state
  // confusing the user).
  function onPdfExportError() {
    dismissChip(false);
  }

  window.addEventListener('antcv:pdf-export-success', onPdfExportSuccess);
  window.addEventListener('antcv:pdf-export-error', onPdfExportError);

  // Public API.
  window.AntcvPdfPageMismatch = {
    version: '1.40.196',
    _previewPageCount: previewPageCount,
    _showChip: showChip,
    _dismissChip: dismissChip,
    _onPdfExportSuccess: onPdfExportSuccess,
  };

  try { console.debug('[pdf-page-mismatch] installed v1.40.196'); } catch (_) {}
})();
