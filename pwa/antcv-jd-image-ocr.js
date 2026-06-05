/* AntCV wizard JD image-OCR sidecar (v1.40.139)
 * ============================================================
 * Adds image-OCR support to app.js's own JD upload paths (the
 * setup-wizard's "JD for new position" input and the re-upload
 * input). The merged JD panel already supports images via
 * antcv-recheck-fit.js v1.40.139 — this sidecar covers the other
 * two paths.
 *
 * Strategy (DOM-level, no app.js changes)
 * ---------------------------------------
 *   1. MutationObserver watches the document for <input type="file">
 *      elements whose accept attribute looks JD-shaped (accepts .pdf
 *      and at least one of .doc / .docx / .txt).
 *
 *   2. For each such input we:
 *        a. Append image MIME types to the accept attribute so the
 *           OS file picker shows images alongside docs.
 *        b. Attach a capture-phase change listener.
 *
 *   3. When the user picks a file, the listener checks the type:
 *        - Non-image file → do nothing, let app.js handle as usual.
 *        - Image file → stopPropagation + preventDefault, run OCR
 *          via window.AntcvJdImageOcr.extract(file), build a
 *          synthetic .txt File holding the extracted text, swap it
 *          into input.files via DataTransfer, then re-dispatch a
 *          fresh change event. The same input now carries a .txt
 *          file with the OCR'd JD text, so app.js's existing text
 *          extractor (FileReader.readAsText) handles it natively.
 *
 *   4. A small toast tells the user that OCR is running and shows
 *      success/failure when it completes.
 *
 * Why not extend antcv-recheck-fit.js
 * -----------------------------------
 * That sidecar owns the merged JD panel — it builds its own file
 * input. The wizard/re-upload inputs live inside app.js's React
 * tree, which we can't modify directly. A separate sidecar that
 * just listens at the DOM layer keeps responsibilities clean.
 *
 * Dependencies
 * ------------
 * Relies on window.AntcvJdImageOcr.extract(file), exposed by
 * antcv-recheck-fit.js v1.40.139. Boots after that sidecar by
 * waiting up to 5 s for the helper to appear (deferred script
 * order is best-effort).
 */
(function () {
  'use strict';

  const SCRIPT_VERSION = '1.50.151';
  const HOOK_MARK = '__antcvJdImageOcrHooked';
  const SYNTHETIC_MARK = '__antcvJdImageOcrSynthetic';

  // ─── Detection of JD-shaped inputs ────────────────────────────────
  //
  // An input is JD-shaped if it accepts a PDF AND at least one of
  // DOC/DOCX/TXT. That signature catches the two JD upload sites in
  // app.js (.pdf,.doc,.docx,.txt and .pdf,.doc,.docx) without
  // catching the photo upload (image/png,image/jpeg,…) or the JSON
  // import (.json) or the .docx-only template upload.

  function isJdShapedAccept(accept) {
    if (!accept) return false;
    const a = String(accept).toLowerCase();
    if (a.indexOf('.pdf') < 0) return false;
    return a.indexOf('.doc') >= 0 || a.indexOf('.txt') >= 0;
  }

  function isImageFile(file) {
    if (!file) return false;
    const type = String(file.type || '').toLowerCase();
    if (type.indexOf('image/') === 0) return true;
    const name = String(file.name || '').toLowerCase();
    return /\.(png|jpg|jpeg|gif|webp|heic)$/.test(name);
  }

  // v1.50.151 — PDF detection. We also intercept PDFs now so image-based
  // PDFs (a LinkedIn "Save as PDF" etc.) reach the OCR fallback in the
  // shared extractor instead of app.js's text-only parse, which returns
  // near-zero text for them.
  function isPdfFile(file) {
    if (!file) return false;
    if (String(file.type || '').toLowerCase() === 'application/pdf') return true;
    return /\.pdf$/i.test(String(file.name || ''));
  }

  // ─── Toast helper (lightweight, no app.js dependency) ─────────────

  function ensureToastContainer() {
    let c = document.getElementById('antcv-jd-image-ocr-toast');
    if (c) return c;
    c = document.createElement('div');
    c.id = 'antcv-jd-image-ocr-toast';
    c.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);' +
      'z-index:99999;display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none;';
    document.body.appendChild(c);
    return c;
  }

  function showToast(message, kind) {
    const c = ensureToastContainer();
    const t = document.createElement('div');
    const colors = kind === 'error'
      ? { bg: 'rgba(180,40,40,0.95)', border: '#ff6b6b' }
      : kind === 'success'
        ? { bg: 'rgba(20,90,80,0.95)', border: '#01B7BB' }
        : { bg: 'rgba(40,53,86,0.95)', border: '#01B7BB' };
    t.style.cssText = 'background:' + colors.bg + ';color:#fff;padding:8px 14px;' +
      'border-radius:6px;border:1px solid ' + colors.border + ';font-family:Calibri,Arial,sans-serif;' +
      'font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,0.3);max-width:480px;' +
      'opacity:0;transition:opacity 200ms ease;';
    t.textContent = message;
    c.appendChild(t);
    requestAnimationFrame(() => { t.style.opacity = '1'; });
    const fade = kind === 'error' ? 5000 : 3000;
    setTimeout(() => {
      t.style.opacity = '0';
      setTimeout(() => { try { c.removeChild(t); } catch (_) {} }, 250);
    }, fade);
    return t;
  }

  // ─── Helper: wait for the OCR helper to be available ─────────────

  function waitForOcrHelper(timeoutMs) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const tick = () => {
        if (window.AntcvJdImageOcr && typeof window.AntcvJdImageOcr.extract === 'function') {
          resolve(window.AntcvJdImageOcr);
          return;
        }
        if (Date.now() - start > (timeoutMs || 5000)) {
          reject(new Error('OCR helper not available (antcv-recheck-fit.js missing or older)'));
          return;
        }
        setTimeout(tick, 100);
      };
      tick();
    });
  }

  // ─── The file-input hook ──────────────────────────────────────────

  function hookInput(input) {
    if (!input || input[HOOK_MARK]) return false;
    if (input.type !== 'file') return false;
    if (!isJdShapedAccept(input.getAttribute('accept'))) return false;
    // v1.50.151 — skip the merged Analysis-panel JD block's own input.
    // That block already extracts via AntcvRecheckFit._extractTextFromFile
    // (now image-PDF/OCR-capable), so hooking it too would double-handle
    // the same file. This hook is only for app.js's wizard/re-upload inputs.
    if (input.closest && input.closest('#antcv-analysis-panel-jd-block')) return false;

    input[HOOK_MARK] = true;

    // Add image MIMEs to accept. Preserve the existing extensions so
    // app.js's own validation (which looks at the .ext) still works
    // for non-image files.
    const existing = input.getAttribute('accept') || '';
    if (existing.toLowerCase().indexOf('image/') < 0) {
      const augmented = (existing.replace(/,?\s*$/, '') +
        ',image/png,image/jpeg,image/webp,image/gif').replace(/^,/, '');
      input.setAttribute('accept', augmented);
    }
    input.setAttribute('data-antcv-jd-image-ocr', '1');

    input.addEventListener('change', onChange, true);
    return true;
  }

  async function onChange(ev) {
    const input = ev.target;
    if (!(input instanceof HTMLInputElement)) return;
    // Skip our own synthetic re-dispatched event
    if (ev[SYNTHETIC_MARK]) return;

    const file = input.files && input.files[0];
    if (!file) return;
    const pdf = isPdfFile(file);
    if (!isImageFile(file) && !pdf) return; // not image/pdf: let app.js handle

    // Intercept and extract (image → OCR; PDF → text, with an image-based
    // PDF OCR fallback inside the shared extractor).
    ev.stopImmediatePropagation();
    ev.preventDefault();

    const toast = showToast(pdf ? 'Reading JD (PDF — OCR if image-based)…' : 'Extracting JD text from image…');
    let extractedText = '';
    try {
      const ocr = await waitForOcrHelper(5000);
      if (pdf) {
        if (typeof ocr.extractFile !== 'function') {
          throw new Error('PDF extractor unavailable — refresh and retry.');
        }
        extractedText = await ocr.extractFile(file);
      } else {
        extractedText = await ocr.extract(file);
      }
      if (!extractedText || !extractedText.trim()) {
        throw new Error('Empty result from extraction');
      }
    } catch (err) {
      if (toast && toast.parentElement) toast.parentElement.removeChild(toast);
      showToast((pdf ? 'JD PDF read failed: ' : 'Image OCR failed: ') + (err && err.message || err), 'error');
      // Reset so the user can pick another file
      try { input.value = ''; } catch (_) {}
      return;
    }
    if (toast && toast.parentElement) toast.parentElement.removeChild(toast);

    // Swap in a synthetic .txt file. If DataTransfer isn't available
    // (older browsers, jsdom in some setups), fall back to dispatching
    // a custom event the page can listen for.
    const txtName = (file.name || 'jd').replace(/\.[^.]+$/, '') + '.txt';
    let txtFile;
    try {
      txtFile = new File([extractedText], txtName, {
        type: 'text/plain',
        lastModified: Date.now(),
      });
    } catch (_) {
      txtFile = new Blob([extractedText], { type: 'text/plain' });
      try { txtFile.name = txtName; } catch (__) {}
    }

    let swapped = false;
    try {
      const dt = new DataTransfer();
      dt.items.add(txtFile);
      // input.files is read-only in many browsers EXCEPT when
      // assigned a DataTransfer.files FileList.
      input.files = dt.files;
      swapped = (input.files && input.files[0] && input.files[0].name === txtName);
    } catch (_) {
      swapped = false;
    }

    if (swapped) {
      // Re-dispatch change without our interceptor catching it.
      const synth = new Event('change', { bubbles: true });
      synth[SYNTHETIC_MARK] = true;
      input.dispatchEvent(synth);
      showToast('JD text extracted.', 'success');
    } else {
      // Fallback: emit a custom event carrying the text so the page
      // (or another sidecar) can pick it up and write it into the
      // JD textarea directly.
      const custom = new CustomEvent('antcv-jd-image-ocr-result', {
        bubbles: true,
        detail: { input: input, text: extractedText, file: file },
      });
      input.dispatchEvent(custom);
      showToast('JD text extracted (fallback: emitted event).', 'success');
    }
  }

  // ─── Scan + observe ───────────────────────────────────────────────

  function scanForInputs(root) {
    const inputs = (root || document).querySelectorAll('input[type="file"]');
    let count = 0;
    for (const input of inputs) {
      if (hookInput(input)) count++;
    }
    return count;
  }

  function boot() {
    scanForInputs(document);
    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.addedNodes && m.addedNodes.length) {
          for (const n of m.addedNodes) {
            if (n.nodeType !== 1) continue;
            // The node itself or its descendants might be a JD input.
            if (n.tagName === 'INPUT') hookInput(n);
            else if (n.querySelectorAll) scanForInputs(n);
          }
        }
        if (m.type === 'attributes' &&
            m.target && m.target.tagName === 'INPUT' &&
            m.target.type === 'file' &&
            m.attributeName === 'accept') {
          hookInput(m.target);
        }
      }
    });
    obs.observe(document.body, {
      childList: true, subtree: true,
      attributes: true, attributeFilter: ['accept'],
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // Test / debug API
  window.AntcvJdImageOcrHook = {
    version: SCRIPT_VERSION,
    _isJdShapedAccept: isJdShapedAccept,
    _isImageFile: isImageFile,
    _hookInput: hookInput,
    _scanForInputs: scanForInputs,
    _onChange: onChange,
    _waitForOcrHelper: waitForOcrHelper,
  };
})();
