/* AntCV JD-analysis sidecar (v1.40.133, formerly recheck-fit)
 * ============================================================
 * Unified panel for both JD analysis modes:
 *
 *   - Recruiter, questions, red flags  →  POST /api/jd-analysis
 *   - Fit vs CV/CL (score, gaps, edits) →  POST /api/recheck-fit
 *
 * Both modes share the same JD source (textarea + file upload for
 * PDF/Word/Text; image upload is wired up but currently throws an
 * informative error until cv-proxy gains an OCR endpoint).
 *
 * History
 * -------
 *   v1.40.128 — initial recheck-fit sidecar with its own standalone FAB
 *   v1.40.130 — swapped the overlay's ↺ FAB for 🎯 instead of stacking
 *   v1.40.133 — merged 🎓 (JD analyze) into 🎯's panel; hides 🎓 FAB
 *
 * Why the merge
 * -------------
 * The 🎓 "Analyze JD" FAB in antcv-overlay.js and this sidecar's 🎯
 * "Recheck JD fit" panel both took the same input (JD text) and both
 * had to handle the "no JD captured yet" state with their own paste
 * prompt. They were structurally identical from the user's point of
 * view — only the output differed. Merging them into a single panel
 * with mode tabs removes one FAB from the stack and makes the
 * shared JD-source logic single-sourced.
 *
 * Flow
 * ----
 *   1. User clicks 🎯 (bottom-right). Panel opens with two mode tabs.
 *   2. JD source: textarea (pre-filled from /api/active if available)
 *      plus PDF / Word / Image upload buttons.
 *   3. User picks a mode (default: Fit vs CV) and clicks Run.
 *   4. Sidecar POSTs to the appropriate endpoint with the JD text
 *      and the relevant section data from localStorage.
 *   5. Results render inline with the mode-specific renderer.
 *
 * Where state lives
 * -----------------
 *   localStorage.proxyUrl              — relay base URL (string)
 *   localStorage.cv_pwa_sections       — CV sections array (JSON)
 *   localStorage.cl_pwa_sections       — CL sections array (JSON, optional)
 *   localStorage.language              — 'en' | 'da' (used for UI labels)
 *
 * Not stored in localStorage:
 *   - The JD text (lives in React refs inside app.js). The user
 *     pastes it into our textarea, or we try to fetch it via
 *     /api/active from D1, or they upload a file we extract text from.
 */
(function () {
  'use strict';

  // ─── Constants ────────────────────────────────────────────────────

  const BUTTON_ID = 'antcv-recheck-fit-fab';
  const MODAL_ID = 'antcv-recheck-fit-modal';
  const STYLE_ID = 'antcv-recheck-fit-styles';

  // ─── Storage + transport helpers ──────────────────────────────────

  function readProxyUrl() {
    try {
      const raw = localStorage.getItem('proxyUrl');
      if (!raw) return null;
      // Some app.js versions JSON-wrap the value, others store it raw.
      // Try JSON parse, fall back to the raw string.
      try { return String(JSON.parse(raw)).trim().replace(/\/+$/, ''); }
      catch (_) { return String(raw).trim().replace(/\/+$/, ''); }
    } catch (_) { return null; }
  }

  function readSections(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch (_) { return null; }
  }

  function readLanguage() {
    try {
      const raw = localStorage.getItem('language');
      if (!raw) return 'en';
      try { return String(JSON.parse(raw)).toLowerCase(); }
      catch (_) { return String(raw).toLowerCase(); }
    } catch (_) { return 'en'; }
  }

  // Try to pre-fill the JD textarea from the active application in
  // D1. Best-effort; if the relay isn't reachable or the user has no
  // active application, we silently leave the field empty.
  async function fetchActiveJd(proxyUrl) {
    if (!proxyUrl) return null;
    try {
      const r = await fetch(proxyUrl + '/api/active', { credentials: 'include' });
      if (!r.ok) return null;
      const j = await r.json();
      if (!j || !j.ok || !j.application_id) return null;
      const r2 = await fetch(proxyUrl + '/api/applications/' + j.application_id, { credentials: 'include' });
      if (!r2.ok) return null;
      const j2 = await r2.json();
      if (!j2 || !j2.ok || !j2.application) return null;
      return j2.application.jd_text || null;
    } catch (_) { return null; }
  }

  async function postRecheckFit(proxyUrl, body) {
    const r = await fetch(proxyUrl + '/api/recheck-fit', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    let parsed = null;
    try { parsed = await r.json(); } catch (_) {}
    return { status: r.status, body: parsed };
  }

  // ─── JD analyze transport (v1.40.133) ────────────────────────────
  //
  // Parallels postRecheckFit, but hits the older /api/jd-analysis
  // endpoint that returns { recruiter, questions, red_flags } shape.
  // The endpoint pre-dates this sidecar — it was previously called
  // from antcv-overlay.js's standalone 🎓 FAB, which we now hide in
  // favour of unified access through this panel.

  async function postJdAnalysis(proxyUrl, body) {
    const r = await fetch(proxyUrl + '/api/jd-analysis', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    // The endpoint sometimes returns a non-JSON body on hard failures.
    // Read text first, attempt parse, surface the raw bytes on miss.
    const raw = await r.text();
    let parsed = null;
    try { parsed = raw ? JSON.parse(raw) : null; } catch (_) {}
    return { status: r.status, body: parsed, raw: raw };
  }

  // ─── Image OCR (v1.40.139) ────────────────────────────────────────
  //
  // Reads an image file as base64, POSTs to /api/extract-jd-image on
  // the cv-proxy, returns the extracted JD text. Used by the image
  // branch of extractTextFromFile below, and also exposed on
  // `window.AntcvJdImageOcr.extract(file)` so other sidecars (the
  // wizard-JD hook) can call it.
  //
  // The endpoint runs Claude vision → GPT-4o vision in cascade.
  // See cv-proxy/src/extract-jd-image.js.

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => {
        const result = String(fr.result || '');
        // result is a data: URL; strip the "data:<mime>;base64," prefix
        const comma = result.indexOf(',');
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      fr.onerror = () => reject(new Error('Could not read image file.'));
      fr.readAsDataURL(file);
    });
  }

  function imageMediaType(file) {
    // Use the browser-reported type when available; otherwise infer
    // from the extension. The endpoint only accepts the four common
    // formats Anthropic's vision API supports.
    const t = String((file && file.type) || '').toLowerCase();
    if (t === 'image/png'  || t === 'image/jpeg' ||
        t === 'image/gif'  || t === 'image/webp') return t;
    const ext = fileExtension(file && file.name);
    if (ext === 'png')  return 'image/png';
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
    if (ext === 'gif')  return 'image/gif';
    if (ext === 'webp') return 'image/webp';
    return null;
  }

  async function extractTextFromImage(file, opts) {
    const proxyUrl = readProxyUrl();
    if (!proxyUrl) {
      throw new Error('No proxy URL configured — set it in Settings → Account, then retry.');
    }
    const mediaType = imageMediaType(file);
    if (!mediaType) {
      throw new Error('Unsupported image format. Use PNG, JPEG, GIF, or WebP.');
    }
    const base64 = await fileToBase64(file);
    // Rough size check on the base64 string — match the worker's cap
    // (~3.75 MB decoded → ~5 MB base64). Reject early with a friendlier
    // message than the 413 from the worker.
    if (base64.length > 5_000_000) {
      throw new Error('Image is too large (>5 MB base64). Compress or crop and retry.');
    }
    const body = {
      image_base64: base64,
      media_type:   mediaType,
      hint:         (opts && opts.hint) || '',
    };
    const r = await fetch(proxyUrl + '/api/extract-jd-image', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    let parsed = null;
    try { parsed = await r.json(); } catch (_) {}
    if (r.status === 200 && parsed && parsed.ok && typeof parsed.text === 'string') {
      return parsed.text;
    }
    if (r.status === 422 && parsed && parsed.error === 'no_jd_text_found') {
      throw new Error('No job-description text found in the image. Try a clearer scan, or paste the text manually.');
    }
    const reason = (parsed && (parsed.error || parsed.hint))
                || ('HTTP ' + r.status);
    throw new Error('Image OCR failed: ' + reason);
  }

  // ─── File extraction (v1.40.133) ─────────────────────────────────
  //
  // Reads a JD candidate file and returns its text content. Four
  // paths:
  //   - .txt    → FileReader.readAsText
  //   - .docx   → window.loadMammoth (exposed by app.js)
  //   - .pdf    → window.loadPDFJS  (exposed by app.js)
  //   - image   → POST /api/extract-jd-image on the cv-proxy (vision
  //               OCR via Claude → GPT-4o cascade). Wired up in
  //               v1.40.139.
  //
  // window.loadMammoth and window.loadPDFJS are documented in app.js
  // — they lazy-load their respective bundles on first call and
  // return the library namespace. We call them, then run the same
  // extraction sequence app.js uses internally for its own uploads.

  function fileExtension(name) {
    const s = String(name || '');
    const i = s.lastIndexOf('.');
    return i < 0 ? '' : s.slice(i + 1).toLowerCase();
  }

  async function extractTextFromFile(file) {
    if (!file) throw new Error('No file provided.');
    const ext = fileExtension(file.name);
    if (ext === 'txt') {
      return await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result || ''));
        fr.onerror = () => reject(new Error('Could not read text file.'));
        fr.readAsText(file);
      });
    }
    if (ext === 'docx' || ext === 'doc') {
      if (typeof window.loadMammoth !== 'function') {
        throw new Error('DOCX extractor (mammoth) is not available. Refresh and try again.');
      }
      const mammoth = await window.loadMammoth();
      const buf = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer: buf });
      return String((result && result.value) || '').trim();
    }
    if (ext === 'pdf') {
      // v1.50.152 — REUSE app.js's hardened JD extractor (extractPDFText),
      // exposed as window.AntcvExtractPDFText. It runs the SAME cascade the
      // Generate-CV/CL and wizard uploads already use: pdf.js text → garbled
      // detector → LLM text extraction → vision OCR for image-based PDFs
      // (a LinkedIn "Save as PDF" etc.). This replaces the duplicated, weaker
      // OCR path this sidecar briefly carried (v1.50.151).
      if (typeof window.AntcvExtractPDFText === 'function') {
        const r = await window.AntcvExtractPDFText(file);
        const t = (r && typeof r.text === 'string') ? r.text.trim() : '';
        if (t) return t;
        throw new Error(
          'This PDF has no usable text — it looks image-based and OCR found nothing. ' +
          'Paste the JD text, or upload a screenshot (PNG/JPEG) instead.'
        );
      }
      // Defensive fallback only if the app shell predates the export (should
      // not happen in a same-deploy load): plain pdf.js text, no OCR.
      if (typeof window.loadPDFJS !== 'function') {
        throw new Error('PDF extractor (PDF.js) is not available. Refresh and try again.');
      }
      const pdfjs = await window.loadPDFJS();
      const buf = await file.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: buf, verbosity: 0 }).promise;
      const parts = [];
      for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        const tc = await page.getTextContent();
        const items = (tc && tc.items) || [];
        parts.push(items.map(i => i.str || '').join(' '));
      }
      return parts.join('\n').trim();
    }
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'heic'].indexOf(ext) >= 0) {
      return await extractTextFromImage(file);
    }
    throw new Error('Unsupported file type: .' + (ext || 'unknown') + '. Use PDF, DOCX, or TXT.');
  }

  // ─── UI rendering ─────────────────────────────────────────────────

  function el(tag, attrs, ...children) {
    const e = document.createElement(tag);
    if (attrs) {
      for (const k of Object.keys(attrs)) {
        if (k === 'style' && typeof attrs[k] === 'object') {
          Object.assign(e.style, attrs[k]);
        } else if (k === 'className') {
          e.className = attrs[k];
        } else if (k.startsWith('on') && typeof attrs[k] === 'function') {
          e.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        } else if (k === 'innerHTML') {
          e.innerHTML = attrs[k];
        } else {
          e.setAttribute(k, attrs[k]);
        }
      }
    }
    for (const c of children) {
      if (c == null) continue;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return e;
  }

  // ─── BRAND constants (v1.50.21) ────────────────────────────────
  // Bucket 2 hex-extraction. The JD analysis modal is editor chrome,
  // not document content — its palette stays constant across all 7
  // visual packages. All 61 inline hex literals previously embedded
  // in the CSS template + one inline `style` object are now sourced
  // from this single named map. Future colour adjustments are a
  // single-source edit.
  var BRAND = {
    // navy + neutrals
    navy:         '#283556',
    white:        '#fff',
    bodyText:     '#333',     // primary body text
    mutedText:    '#595959',  // labels, rationale
    mutedSoft:    '#6b7280',  // tab labels, upload status
    mutedFaint:   '#9ca3af',  // empty-state italic
    disabled:     '#999',     // disabled run button + inline subdued
    borderLight:  '#d0d2d6',  // textarea / select border
    borderCard:   '#e0e3e8',  // edit-card border
    separator:    '#e5e7eb',  // tab underline
    bgHover:      '#f5f5f5',  // upload button hover
    bgSubtle:     '#fafafa',  // jdsec card bg
    bgCard:       '#fafbfc',  // edit card bg
    bgInfo:       '#f7fafa',  // summary card bg

    // teal (success / brand accent)
    teal:         '#00746E',  // headings, links, success badges
    tealBright:   '#01B7BB',  // accent (focus rings, copy button)
    tealBgLight:  '#eaf7f7',  // info banner bg
    tealTextDeep: '#07545e',  // info banner text

    // warning / danger
    warningAmber: '#f59e0b',  // error border + fitscore gradient mid
    dangerPink:   '#c22b50',  // error text + gaps heading + fitscore low
    dangerBgLite: '#ffe9ec',  // error banner bg
    dangerDeep:   '#b8001f',  // high-severity flag text

    // misc
    purple:       '#6d28d9',  // CL edit badge
  };

  function injectStylesOnce() {
    if (document.getElementById(STYLE_ID)) return;
    const css = `
      /* Modal overlay + dialog. The FAB itself piggybacks on the
         existing .antcv-fab styling from antcv-overlay.js — we
         don't redefine it here. */
      #${MODAL_ID} {
        position: fixed;
        inset: 0;
        z-index: 2500;
        background: rgba(40, 53, 86, 0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        backdrop-filter: blur(2px);
      }
      .antcv-rf-dialog {
        width: min(820px, 100%);
        max-height: 88vh;
        overflow-y: auto;
        background: ${BRAND.white};
        border-radius: 10px;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
        font-family: Calibri, Arial, sans-serif;
        color: ${BRAND.navy};
      }
      .antcv-rf-header {
        position: sticky;
        top: 0;
        padding: 14px 18px;
        background: ${BRAND.navy};
        color: ${BRAND.white};
        border-radius: 10px 10px 0 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .antcv-rf-header h2 {
        margin: 0;
        font-size: 16px;
        font-weight: 700;
      }
      .antcv-rf-close {
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.35);
        color: ${BRAND.white};
        border-radius: 6px;
        padding: 4px 10px;
        cursor: pointer;
        font-size: 12px;
      }
      .antcv-rf-close:hover { background: rgba(255, 255, 255, 0.10); }
      .antcv-rf-body { padding: 16px 18px; }
      .antcv-rf-row { display: flex; gap: 16px; margin-bottom: 14px; }
      .antcv-rf-label {
        display: block;
        font-size: 11px;
        font-weight: 700;
        color: ${BRAND.mutedText};
        letter-spacing: 0.4px;
        text-transform: uppercase;
        margin-bottom: 4px;
      }
      .antcv-rf-textarea {
        width: 100%;
        min-height: 140px;
        padding: 8px 10px;
        font-family: Georgia, serif;
        font-size: 13px;
        line-height: 1.45;
        color: ${BRAND.bodyText};
        border: 1px solid ${BRAND.borderLight};
        border-radius: 6px;
        resize: vertical;
        box-sizing: border-box;
      }
      .antcv-rf-textarea:focus {
        outline: none;
        border-color: ${BRAND.tealBright};
        box-shadow: 0 0 0 3px rgba(1, 183, 187, 0.18);
      }
      .antcv-rf-select {
        padding: 6px 10px;
        font-size: 12px;
        border: 1px solid ${BRAND.borderLight};
        border-radius: 6px;
        background: ${BRAND.white};
      }
      .antcv-rf-runbtn {
        padding: 10px 16px;
        font-size: 13px;
        font-weight: 700;
        color: ${BRAND.white};
        background: ${BRAND.teal};
        border: none;
        border-radius: 6px;
        cursor: pointer;
      }
      .antcv-rf-runbtn:hover { background: ${BRAND.tealBright}; }
      .antcv-rf-runbtn:disabled {
        background: ${BRAND.disabled};
        cursor: wait;
      }
      .antcv-rf-error {
        padding: 10px 12px;
        background: ${BRAND.dangerBgLite};
        color: ${BRAND.dangerPink};
        border: 1px solid ${BRAND.warningAmber};
        border-radius: 6px;
        font-size: 12px;
        margin-bottom: 12px;
      }
      .antcv-rf-info {
        padding: 8px 12px;
        background: ${BRAND.tealBgLight};
        color: ${BRAND.tealTextDeep};
        border-left: 3px solid ${BRAND.teal};
        border-radius: 4px;
        font-size: 12px;
        margin-bottom: 12px;
      }

      /* ─── Mode tabs (v1.40.133) ─── */
      .antcv-rf-tabs {
        display: flex;
        gap: 4px;
        margin-bottom: 12px;
        border-bottom: 2px solid ${BRAND.separator};
      }
      .antcv-rf-tab {
        background: transparent;
        border: none;
        padding: 8px 14px;
        font-size: 12px;
        font-weight: 700;
        color: ${BRAND.mutedSoft};
        cursor: pointer;
        border-bottom: 2px solid transparent;
        margin-bottom: -2px;
        font-family: inherit;
        transition: color 0.12s, border-color 0.12s;
      }
      .antcv-rf-tab:hover { color: ${BRAND.teal}; }
      .antcv-rf-tab-active {
        color: ${BRAND.teal};
        border-bottom-color: ${BRAND.teal};
      }

      /* ─── File upload row (v1.40.133) ─── */
      .antcv-rf-upload-row {
        display: flex;
        gap: 6px;
        align-items: center;
        flex-wrap: wrap;
        margin-top: 6px;
      }
      .antcv-rf-upload-label {
        font-size: 11px;
        color: ${BRAND.mutedSoft};
        font-weight: 600;
      }
      .antcv-rf-upload-btn {
        font-size: 11px;
        font-weight: 600;
        padding: 4px 10px;
        background: ${BRAND.white};
        color: ${BRAND.navy};
        border: 1px solid ${BRAND.navy};
        border-radius: 4px;
        cursor: pointer;
        font-family: inherit;
      }
      .antcv-rf-upload-btn:hover {
        background: ${BRAND.bgHover};
      }
      .antcv-rf-upload-status {
        font-size: 11px;
        color: ${BRAND.mutedSoft};
        margin-top: 4px;
        min-height: 14px;
      }

      /* ─── Analyze-mode result sections (v1.40.133) ─── */
      .antcv-rf-jdsec {
        margin-bottom: 14px;
        padding: 10px 12px;
        background: ${BRAND.bgSubtle};
        border-left: 3px solid ${BRAND.tealBright};
        border-radius: 4px;
      }
      .antcv-rf-jdsec h3 {
        margin: 0 0 8px 0;
        font-size: 13px;
        color: ${BRAND.navy};
      }
      .antcv-rf-recruiter {
        font-size: 12px;
        line-height: 1.5;
      }
      .antcv-rf-link {
        color: ${BRAND.teal};
        text-decoration: underline;
      }
      .antcv-rf-jdlist {
        margin: 0;
        padding-left: 18px;
        font-size: 12px;
        line-height: 1.5;
      }
      .antcv-rf-jdlist li { margin-bottom: 4px; }
      .antcv-rf-jdlist-flags li {
        padding-left: 4px;
      }
      .antcv-rf-jdlist-flags li[data-sev="high"] {
        color: ${BRAND.dangerDeep};
      }
      .antcv-rf-jdlist-flags li[data-sev="low"] {
        color: ${BRAND.mutedSoft};
      }
      .antcv-rf-empty {
        font-size: 12px;
        color: ${BRAND.mutedFaint};
        font-style: italic;
      }
      .antcv-rf-fitscore-bar {
        position: relative;
        height: 18px;
        background: linear-gradient(to right, ${BRAND.dangerPink} 0%, ${BRAND.warningAmber} 40%, ${BRAND.teal} 75%);
        border-radius: 9px;
        overflow: hidden;
        margin: 6px 0 14px;
      }
      .antcv-rf-fitscore-marker {
        position: absolute;
        top: -2px;
        height: 22px;
        width: 4px;
        background: ${BRAND.navy};
        border: 1px solid ${BRAND.white};
        border-radius: 2px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
        transform: translateX(-50%);
      }
      .antcv-rf-fitscore-text {
        font-size: 11px;
        font-weight: 700;
        color: ${BRAND.mutedText};
        margin-left: 6px;
      }
      .antcv-rf-summary {
        padding: 10px 12px;
        background: ${BRAND.bgInfo};
        border-radius: 6px;
        font-size: 13px;
        line-height: 1.5;
        margin-bottom: 14px;
      }
      .antcv-rf-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
      .antcv-rf-col h3 { font-size: 12px; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 0.5px; }
      .antcv-rf-col ul { margin: 0; padding-left: 18px; font-size: 12px; line-height: 1.5; }
      .antcv-rf-col li { margin-bottom: 4px; }
      .antcv-rf-col.strengths h3 { color: ${BRAND.teal}; }
      .antcv-rf-col.gaps h3 { color: ${BRAND.dangerPink}; }
      .antcv-rf-edit {
        border: 1px solid ${BRAND.borderCard};
        border-radius: 8px;
        padding: 10px 12px;
        margin-bottom: 10px;
        background: ${BRAND.bgCard};
      }
      .antcv-rf-edit-head {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;
        font-size: 12px;
        font-weight: 700;
        color: ${BRAND.navy};
      }
      .antcv-rf-edit-badge {
        font-size: 10px;
        padding: 1px 6px;
        border-radius: 8px;
        background: ${BRAND.teal};
        color: ${BRAND.white};
        text-transform: uppercase;
        letter-spacing: 0.4px;
      }
      .antcv-rf-edit-badge.cl { background: ${BRAND.purple}; }
      .antcv-rf-edit-rationale {
        font-size: 12px;
        color: ${BRAND.mutedText};
        margin-bottom: 8px;
        line-height: 1.45;
      }
      .antcv-rf-edit-preview {
        padding: 8px 10px;
        background: ${BRAND.white};
        border: 1px dashed ${BRAND.borderLight};
        border-radius: 4px;
        font-family: Georgia, serif;
        font-size: 12.5px;
        line-height: 1.5;
        color: ${BRAND.bodyText};
        white-space: pre-wrap;
        word-wrap: break-word;
        max-height: 180px;
        overflow-y: auto;
        margin-bottom: 6px;
      }
      .antcv-rf-edit-actions {
        display: flex;
        gap: 6px;
        align-items: center;
      }
      .antcv-rf-copy-btn {
        font-size: 11px;
        font-weight: 700;
        padding: 4px 10px;
        background: ${BRAND.tealBright};
        color: ${BRAND.white};
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
      .antcv-rf-copy-btn:hover { background: ${BRAND.teal}; }
      .antcv-rf-copy-status {
        font-size: 10px;
        color: ${BRAND.teal};
        font-weight: 700;
      }
      @media print {
        #${MODAL_ID} { display: none !important; }
      }
    `;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = css;
    document.head.appendChild(s);
  }

  // ─── Modal lifecycle ──────────────────────────────────────────────

  function closeModal() {
    const m = document.getElementById(MODAL_ID);
    if (m && m.parentNode) m.parentNode.removeChild(m);
    document.documentElement.style.overflow = '';
  }

  async function openModal() {
    // Guard against double-open
    if (document.getElementById(MODAL_ID)) return;
    injectStylesOnce();
    document.documentElement.style.overflow = 'hidden';

    const lang = readLanguage();
    const isDa = lang === 'da';
    const T = isDa ? {
      title: 'JD-analyse',
      jdLabel: 'Jobopslag (indsæt teksten)',
      docTarget: 'Hvilket dokument?',
      cv: 'CV', cl: 'Følgebrev', both: 'Begge',
      run: 'Kør analyse',
      running: 'Analyserer…',
      close: 'Luk',
      copy: 'Kopier forslag',
      copied: 'Kopieret',
      noProxy: 'Proxy-URL er ikke konfigureret. Åbn Indstillinger.',
      noSections: 'Ingen CV-sektioner fundet i localStorage. Generer eller importér først et CV.',
      jdTooShort: 'Indsæt jobopslag på mindst 50 tegn.',
      noEdits: 'Ingen specifikke ændringer foreslået.',
      fitScore: 'Match-score',
      strengths: 'Styrker',
      gaps: 'Mangler',
      suggestedEdits: 'Foreslåede ændringer',
      noChange: 'Intet automatisk anvendt — kopiér forslag, og indsæt manuelt i editoren.',
      // v1.40.133 — analyze mode + file upload
      modeRecheck: 'Match vs. CV',
      modeAnalyze: 'Rekrutterer & røde flag',
      runAnalyze: 'Analysér JD',
      runRecheck: 'Kør match-analyse',
      uploadLabel: 'Eller upload:',
      uploadPdf: 'PDF',
      uploadDocx: 'Word',
      uploadImage: 'Billede',
      uploadingTpl: 'Læser {file}…',
      uploadFailedTpl: 'Filfejl: {err}',
      recruiter: 'Rekrutterer',
      questions: 'Spørgsmål at stille',
      redFlags: 'Røde flag',
      noRecruiter: 'Ingen tydelig rekrutterer fundet i opslaget.',
      noQuestions: 'Ingen forslag til spørgsmål.',
      noRedFlags: 'Ingen røde flag fundet.',
    } : {
      title: 'JD analysis',
      jdLabel: 'Job description (paste here)',
      docTarget: 'Which document?',
      cv: 'CV', cl: 'Cover letter', both: 'Both',
      run: 'Run analysis',
      running: 'Analysing…',
      close: 'Close',
      copy: 'Copy preview',
      copied: 'Copied',
      noProxy: 'Proxy URL is not configured. Open Settings.',
      noSections: 'No CV sections found in localStorage. Generate or import a CV first.',
      jdTooShort: 'Paste a job description of at least 50 characters.',
      noEdits: 'No specific edits suggested.',
      fitScore: 'Fit score',
      strengths: 'Strengths',
      gaps: 'Gaps',
      suggestedEdits: 'Suggested edits',
      noChange: 'Nothing applied automatically — copy each preview and paste it into the editor.',
      // v1.40.133 — analyze mode + file upload
      modeRecheck: 'Fit vs CV',
      modeAnalyze: 'Recruiter & red flags',
      runAnalyze: 'Analyse JD',
      runRecheck: 'Run fit analysis',
      uploadLabel: 'Or upload:',
      uploadPdf: 'PDF',
      uploadDocx: 'Word',
      uploadImage: 'Image',
      uploadingTpl: 'Reading {file}…',
      uploadFailedTpl: 'File error: {err}',
      recruiter: 'Recruiter',
      questions: 'Questions to ask',
      redFlags: 'Red flags',
      noRecruiter: 'No clear recruiter info found in the JD.',
      noQuestions: 'No suggested questions.',
      noRedFlags: 'No red flags found.',
    };

    const proxyUrl = readProxyUrl();
    const cvSections = readSections('cv_pwa_sections');
    const clSections = readSections('cl_pwa_sections');

    const closeBtn = el('button', { className: 'antcv-rf-close', type: 'button', onClick: closeModal }, T.close);

    const errorBox = el('div', { className: 'antcv-rf-error', style: { display: 'none' } });
    const showError = (msg) => {
      errorBox.textContent = msg;
      errorBox.style.display = 'block';
    };
    const clearError = () => { errorBox.style.display = 'none'; };

    // JD textarea
    const jdField = el('textarea', {
      className: 'antcv-rf-textarea',
      placeholder: T.jdLabel + '…',
    });
    // Pre-fill from /api/active if possible (best-effort)
    if (proxyUrl) {
      fetchActiveJd(proxyUrl).then(jd => {
        if (jd && !jdField.value) jdField.value = jd;
      }).catch(() => {});
    }

    // Doc target selector — only shown when CL is available
    const docTargetSel = el('select', { className: 'antcv-rf-select' },
      el('option', { value: 'cv' }, T.cv),
      clSections ? el('option', { value: 'cl' }, T.cl) : null,
      clSections ? el('option', { value: 'both', selected: 'selected' }, T.both) : null,
    );
    // If no CL, default to CV-only
    if (!clSections) docTargetSel.value = 'cv';

    const resultsArea = el('div', { className: 'antcv-rf-results' });

    // ─── Mode state + tabs (v1.40.133) ──────────────────────────────
    //
    // The panel supports two modes: recheck (JD vs CV fit) and
    // analyze (recruiter/questions/red flags). The mode-tab buttons
    // toggle which API is called when Run is clicked, and which
    // render function paints the results.

    let currentMode = 'recheck'; // default — was the previous sole behaviour

    const tabRecheck = el('button', { className: 'antcv-rf-tab antcv-rf-tab-active', type: 'button', 'data-antcv-rf-tab': 'recheck' }, T.modeRecheck);
    const tabAnalyze = el('button', { className: 'antcv-rf-tab', type: 'button', 'data-antcv-rf-tab': 'analyze' }, T.modeAnalyze);

    function setMode(m) {
      currentMode = m;
      tabRecheck.classList.toggle('antcv-rf-tab-active', m === 'recheck');
      tabAnalyze.classList.toggle('antcv-rf-tab-active', m === 'analyze');
      // Doc-target row only makes sense for the recheck mode
      if (docTargetRow) docTargetRow.style.display = (m === 'recheck' && clSections) ? '' : 'none';
      // Run button label updates to match the active mode
      runBtn.textContent = m === 'analyze' ? T.runAnalyze : T.runRecheck;
      // Clear stale results when switching modes
      resultsArea.innerHTML = '';
      clearError();
    }
    tabRecheck.addEventListener('click', () => setMode('recheck'));
    tabAnalyze.addEventListener('click', () => setMode('analyze'));

    // ─── File upload row (v1.40.133) ────────────────────────────────
    //
    // Hidden file input + three labelled buttons (PDF / Word / Image)
    // that delegate to extractTextFromFile. On success, the extracted
    // text is dropped into the JD textarea (replacing any existing
    // content) and the user can review/edit before running.

    const fileInput = el('input', {
      type: 'file',
      accept: '.pdf,.doc,.docx,.txt,image/*',
      style: { display: 'none' },
    });
    const uploadStatus = el('div', { className: 'antcv-rf-upload-status' });
    fileInput.addEventListener('change', async (ev) => {
      const file = ev.target.files && ev.target.files[0];
      ev.target.value = ''; // allow re-selecting the same file later
      if (!file) return;
      clearError();
      uploadStatus.textContent = T.uploadingTpl.replace('{file}', file.name);
      try {
        const text = await extractTextFromFile(file);
        if (!text || text.length < 20) {
          throw new Error('File parsed but contained no usable text.');
        }
        jdField.value = text;
        uploadStatus.textContent = '';
      } catch (e) {
        const msg = String((e && e.message) || e);
        uploadStatus.textContent = '';
        showError(T.uploadFailedTpl.replace('{err}', msg));
      }
    });

    function makeUploadBtn(label, accept) {
      const b = el('button', { className: 'antcv-rf-upload-btn', type: 'button' }, label);
      b.addEventListener('click', () => {
        fileInput.setAttribute('accept', accept);
        fileInput.click();
      });
      return b;
    }
    const uploadRow = el('div', { className: 'antcv-rf-upload-row' },
      el('span', { className: 'antcv-rf-upload-label' }, T.uploadLabel),
      makeUploadBtn(T.uploadPdf, '.pdf'),
      makeUploadBtn(T.uploadDocx, '.doc,.docx'),
      makeUploadBtn(T.uploadImage, 'image/*'),
      fileInput,
    );

    // Doc target row (only meaningful for recheck mode) — extracted
    // into its own ref so setMode can toggle its visibility.
    const docTargetRow = clSections ? el('div', { className: 'antcv-rf-row' },
      el('div', null,
        el('label', { className: 'antcv-rf-label' }, T.docTarget),
        docTargetSel,
      ),
    ) : null;

    const runBtn = el('button', { className: 'antcv-rf-runbtn', type: 'button' }, T.runRecheck);
    runBtn.addEventListener('click', async () => {
      clearError();
      resultsArea.innerHTML = '';

      if (!proxyUrl) { showError(T.noProxy); return; }
      if (currentMode === 'recheck' && (!cvSections || !cvSections.length)) {
        showError(T.noSections); return;
      }
      const jdText = (jdField.value || '').trim();
      if (jdText.length < 50) { showError(T.jdTooShort); return; }

      runBtn.disabled = true;
      runBtn.textContent = T.running;
      try {
        if (currentMode === 'analyze') {
          const { status, body: respBody, raw } = await postJdAnalysis(proxyUrl, {
            jd_text: jdText,
            candidate_summary: cvSections
              ? JSON.stringify(cvSections).slice(0, 8000) : '',
            search_recruiter: true,
          });
          if (status !== 200 || !respBody || !respBody.ok) {
            const msg = (respBody && (respBody.error || respBody.hint))
              || (raw && raw.slice(0, 200)) || ('HTTP ' + status);
            showError(msg);
            return;
          }
          renderJdAnalysis(resultsArea, respBody, T);
        } else {
          const docTarget = docTargetSel.value;
          const body = {
            jd_text: jdText,
            cv_sections: cvSections,
            doc_target: docTarget,
          };
          if (clSections && (docTarget === 'cl' || docTarget === 'both')) {
            body.cl_sections = clSections;
          }
          const { status, body: respBody } = await postRecheckFit(proxyUrl, body);
          if (status !== 200 || !respBody || !respBody.ok) {
            const msg = (respBody && (respBody.error || respBody.hint)) || ('HTTP ' + status);
            showError(msg);
            return;
          }
          renderAnalysis(resultsArea, respBody.analysis, T);
        }
      } catch (e) {
        showError(String((e && e.message) || e));
      } finally {
        runBtn.disabled = false;
        runBtn.textContent = currentMode === 'analyze' ? T.runAnalyze : T.runRecheck;
      }
    });

    const dialog = el('div', { className: 'antcv-rf-dialog' },
      el('div', { className: 'antcv-rf-header' },
        el('h2', null, T.title),
        closeBtn,
      ),
      el('div', { className: 'antcv-rf-body' },
        el('div', { className: 'antcv-rf-tabs' }, tabRecheck, tabAnalyze),
        errorBox,
        el('div', { className: 'antcv-rf-info' }, T.noChange),
        el('div', { style: { marginBottom: '12px' } },
          el('label', { className: 'antcv-rf-label' }, T.jdLabel),
          jdField,
          uploadRow,
          uploadStatus,
        ),
        docTargetRow,
        el('div', { style: { marginBottom: '14px' } }, runBtn),
        resultsArea,
      ),
    );

    const overlay = el('div', { id: MODAL_ID, onClick: (ev) => {
      // Click outside the dialog closes; clicks inside dialog stay.
      if (ev.target === overlay) closeModal();
    }}, dialog);

    document.body.appendChild(overlay);

    // Esc to close
    const onKey = (ev) => {
      if (ev.key === 'Escape') { closeModal(); document.removeEventListener('keydown', onKey); }
    };
    document.addEventListener('keydown', onKey);

    setTimeout(() => jdField.focus(), 80);
  }

  function renderAnalysis(container, a, T) {
    container.innerHTML = '';
    if (!a || typeof a !== 'object') {
      container.appendChild(el('div', { className: 'antcv-rf-error' }, 'Empty analysis response'));
      return;
    }

    // Fit score bar
    const score = Math.max(0, Math.min(1, Number(a.fit_score) || 0));
    const marker = el('div', {
      className: 'antcv-rf-fitscore-marker',
      style: { left: (score * 100).toFixed(1) + '%' },
    });
    container.appendChild(el('label', { className: 'antcv-rf-label' },
      T.fitScore + ' — ' + Math.round(score * 100) + '%',
    ));
    container.appendChild(el('div', { className: 'antcv-rf-fitscore-bar' }, marker));

    // Summary
    if (a.summary) {
      container.appendChild(el('div', { className: 'antcv-rf-summary' }, a.summary));
    }

    // Strengths + Gaps
    const strengths = Array.isArray(a.strengths) ? a.strengths : [];
    const gaps = Array.isArray(a.gaps) ? a.gaps : [];
    const cols = el('div', { className: 'antcv-rf-cols' });
    const strengthsCol = el('div', { className: 'antcv-rf-col strengths' },
      el('h3', null, T.strengths + ' (' + strengths.length + ')'),
      el('ul', null,
        ...strengths.map(s => el('li', null,
          el('b', null, s.skill || ''),
          s.evidence ? ' — ' + s.evidence : '',
        )),
      ),
    );
    const gapsCol = el('div', { className: 'antcv-rf-col gaps' },
      el('h3', null, T.gaps + ' (' + gaps.length + ')'),
      el('ul', null,
        ...gaps.map(g => el('li', null,
          el('b', null, g.missing || ''),
          g.jd_mention ? ' — ' + g.jd_mention : '',
        )),
      ),
    );
    cols.appendChild(strengthsCol);
    cols.appendChild(gapsCol);
    container.appendChild(cols);

    // Suggested edits
    container.appendChild(el('label', { className: 'antcv-rf-label' }, T.suggestedEdits));
    const edits = Array.isArray(a.suggested_edits) ? a.suggested_edits : [];
    if (!edits.length) {
      container.appendChild(el('div', { className: 'antcv-rf-summary' }, T.noEdits));
      return;
    }
    for (const edit of edits) {
      const badge = el('span', {
        className: 'antcv-rf-edit-badge' + (edit.doc === 'cl' ? ' cl' : ''),
      }, (edit.doc || 'cv').toUpperCase());
      const status = el('span', { className: 'antcv-rf-copy-status' });
      const copyBtn = el('button', {
        className: 'antcv-rf-copy-btn',
        type: 'button',
        onClick: async () => {
          try {
            await navigator.clipboard.writeText(edit.preview || '');
            status.textContent = '✓ ' + T.copied;
            setTimeout(() => { status.textContent = ''; }, 1800);
          } catch (e) {
            status.textContent = '✗ ' + ((e && e.message) || 'clipboard error');
          }
        },
      }, T.copy);
      container.appendChild(el('div', { className: 'antcv-rf-edit' },
        el('div', { className: 'antcv-rf-edit-head' },
          badge,
          ' ' + (edit.section_id || '?'),
          el('span', { style: { fontWeight: '400', color: BRAND.disabled } },
            ' · ' + (edit.change_type || 'reword'),
          ),
        ),
        edit.rationale ? el('div', { className: 'antcv-rf-edit-rationale' }, edit.rationale) : null,
        edit.preview ? el('div', { className: 'antcv-rf-edit-preview' }, edit.preview) : null,
        el('div', { className: 'antcv-rf-edit-actions' }, copyBtn, status),
      ));
    }
  }

  // ─── Render analyze-mode results (v1.40.133) ─────────────────────
  //
  // The /api/jd-analysis endpoint returns:
  //   {
  //     ok: true,
  //     recruiter: { name?, title?, email?, linkedin?, web_signals? } | null,
  //     questions: string[] | { text }[],
  //     red_flags: string[] | { text, severity? }[],
  //   }
  //
  // We render three sections: recruiter card, questions list, red
  // flags list. Empty sections show a "no X found" placeholder so
  // the user can tell whether the LLM looked at all (vs. an error).

  function renderJdAnalysis(container, data, T) {
    container.innerHTML = '';
    if (!data || typeof data !== 'object') {
      container.appendChild(el('div', { className: 'antcv-rf-error' }, 'Empty analyze response'));
      return;
    }

    // Recruiter card
    const r = data.recruiter || null;
    const hasRecruiter = !!(r && (r.name || r.email || r.linkedin ||
      (r.web_signals && r.web_signals.linkedin_url)));
    const recruiterBox = el('div', { className: 'antcv-rf-jdsec' },
      el('h3', null, T.recruiter),
    );
    if (hasRecruiter) {
      const lines = el('div', { className: 'antcv-rf-recruiter' });
      if (r.name)  lines.appendChild(el('div', null, el('b', null, r.name)));
      if (r.title) lines.appendChild(el('div', null, r.title));
      if (r.email) {
        const a = el('a', { href: 'mailto:' + r.email, className: 'antcv-rf-link' }, r.email);
        lines.appendChild(el('div', null, a));
      }
      const linkedin = r.linkedin || (r.web_signals && r.web_signals.linkedin_url);
      if (linkedin) {
        const a = el('a', { href: linkedin, target: '_blank', rel: 'noopener noreferrer', className: 'antcv-rf-link' }, 'LinkedIn');
        lines.appendChild(el('div', null, a));
      }
      recruiterBox.appendChild(lines);
    } else {
      recruiterBox.appendChild(el('div', { className: 'antcv-rf-empty' }, T.noRecruiter));
    }
    container.appendChild(recruiterBox);

    // Questions list
    const questions = Array.isArray(data.questions) ? data.questions : [];
    const qBox = el('div', { className: 'antcv-rf-jdsec' },
      el('h3', null, T.questions + (questions.length ? ' (' + questions.length + ')' : '')),
    );
    if (questions.length) {
      const ul = el('ul', { className: 'antcv-rf-jdlist' });
      for (const q of questions) {
        const txt = typeof q === 'string' ? q : (q && q.text) || '';
        if (txt) ul.appendChild(el('li', null, txt));
      }
      qBox.appendChild(ul);
    } else {
      qBox.appendChild(el('div', { className: 'antcv-rf-empty' }, T.noQuestions));
    }
    container.appendChild(qBox);

    // Red flags list
    const flags = Array.isArray(data.red_flags) ? data.red_flags : [];
    const fBox = el('div', { className: 'antcv-rf-jdsec' },
      el('h3', null, T.redFlags + (flags.length ? ' (' + flags.length + ')' : '')),
    );
    if (flags.length) {
      const ul = el('ul', { className: 'antcv-rf-jdlist antcv-rf-jdlist-flags' });
      for (const f of flags) {
        const txt = typeof f === 'string' ? f : (f && f.text) || '';
        const sev = typeof f === 'object' ? (f.severity || 'med') : 'med';
        if (txt) {
          ul.appendChild(el('li', { 'data-sev': sev }, txt));
        }
      }
      fBox.appendChild(ul);
    } else {
      fBox.appendChild(el('div', { className: 'antcv-rf-empty' }, T.noRedFlags));
    }
    container.appendChild(fBox);
  }

  // ─── FAB + bootstrap ──────────────────────────────────────────────

  // ─── FAB integration via the overlay stack ────────────────────────
  //
  // v1.40.128 created its own floating FAB at the bottom-right. That
  // duplicated the existing FAB stack (`↺` reset, `🎓` JD analysis,
  // `🔀` fusion) from antcv-overlay.js, which made the UI feel
  // cluttered. v1.40.130 changes the integration:
  //
  //   - We DO NOT add our own bottom-right floating button anymore.
  //   - We REPLACE the existing `↺` ("Reset CV content for new JD")
  //     FAB with a `🎯` button that opens the recheck-fit modal.
  //
  // Why drop the reset button entirely? Because `app.js` already
  // auto-resets section content when it detects a new JD in the
  // Generate handler (see `lastGeneratedJDFingerprint` logic at
  // offset ~vl in app.js). The manual `↺` was a redundant escape
  // hatch. Users who really need to reset everything can use
  // Settings → Reset all.
  //
  // The hijack is purely DOM-side: a MutationObserver watches for
  // the `↺` FAB to appear, removes it, and inserts our `🎯` button
  // in its place using the same `antcv-fab` class so it inherits
  // the overlay's styling and stacks correctly with `🎓` and `🔀`.

  const RECHECK_FAB_MARKER = 'data-antcv-recheck-fab';

  function makeRecheckFab() {
    const btn = document.createElement('button');
    btn.className = 'antcv-fab';
    btn.type = 'button';
    btn.textContent = '🎯';
    btn.title = 'JD analysis — recruiter, red flags, and fit vs your CV/CL';
    btn.setAttribute('aria-label', 'JD analysis');
    btn.setAttribute(RECHECK_FAB_MARKER, '1');
    btn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      openModal();
    });
    return btn;
  }

  // Find the existing `↺` FAB created by antcv-overlay.js. Match by
  // aria-label, which is stable across the collapsed/expanded states
  // (the text content swaps between '↺' and '↺ Reset CV for new JD'
  // but aria-label always reads "Reset CV content for new JD").
  function findResetFab() {
    return document.querySelector(
      '.antcv-fab[aria-label="Reset CV content for new JD"]'
    );
  }

  function ensureFabSwap() {
    // Already replaced? Nothing to do.
    if (document.querySelector('.antcv-fab[' + RECHECK_FAB_MARKER + '="1"]')) {
      return;
    }
    const resetFab = findResetFab();
    if (!resetFab || !resetFab.parentNode) return;
    const newBtn = makeRecheckFab();
    resetFab.parentNode.replaceChild(newBtn, resetFab);
  }

  // Tear down anything from v1.40.128 if upgrading mid-session.
  function removeLegacyStandaloneFab() {
    const legacy = document.getElementById(BUTTON_ID);
    if (legacy && legacy.parentNode) legacy.parentNode.removeChild(legacy);
  }

  // v1.40.133 — hide the standalone 🎓 "Analyze JD" FAB from
  // antcv-overlay.js. The unified panel in this sidecar now handles
  // both analyze and recheck modes, so the separate FAB is redundant.
  // We remove it on every mutation cycle in case the overlay re-mounts
  // its stack (e.g., after a settings change). The overlay sets its
  // aria-label to exactly "Analyze JD" which is stable across builds.
  function removeJdAnalyzeFab() {
    const fab = document.querySelector('.antcv-fab[aria-label="Analyze JD"]');
    if (fab && fab.parentNode) fab.parentNode.removeChild(fab);
  }

  function bootIntegration() {
    injectStylesOnce();
    removeLegacyStandaloneFab();
    removeJdAnalyzeFab();
    ensureFabSwap();
    // The overlay creates its FABs asynchronously (after DOMContentLoaded
    // + a short delay). Observe DOM mutations until we've caught the
    // `↺` and replaced it. We keep observing afterwards so that if the
    // overlay ever re-creates its stack (e.g., on a settings change),
    // our swap re-applies on the next tick.
    const observer = new MutationObserver(() => {
      removeLegacyStandaloneFab();
      removeJdAnalyzeFab();
      ensureFabSwap();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Run after DOMContentLoaded; if already loaded, schedule for next tick.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootIntegration);
  } else {
    setTimeout(bootIntegration, 0);
  }

  // Expose a tiny API for tests + debugging.
  window.AntcvRecheckFit = {
    open: openModal,
    close: closeModal,
    version: '1.50.152',
    // v1.40.133 internals exposed for tests
    _extractTextFromFile: extractTextFromFile,
    _postJdAnalysis: postJdAnalysis,
    _renderJdAnalysis: renderJdAnalysis,
    _removeJdAnalyzeFab: removeJdAnalyzeFab,
    // v1.40.139 — image OCR helpers
    _extractTextFromImage: extractTextFromImage,
    _fileToBase64: fileToBase64,
    _imageMediaType: imageMediaType,
  };

  // Public OCR helper. Other sidecars (e.g. antcv-jd-image-ocr.js
  // which hooks the wizard's JD file inputs) call this to avoid
  // duplicating the cv-proxy call.
  window.AntcvJdImageOcr = window.AntcvJdImageOcr || {
    version: '1.40.139',
    extract: extractTextFromImage,
  };
})();
