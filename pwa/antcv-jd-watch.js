/**
 * antcv-jd-watch.js — earlier JD-change detection
 *
 * Background
 * ──────────
 * `app.js`'s Generate handler already auto-resets section content
 * when it detects a new JD fingerprint:
 *
 *   if (a && n.length > 50 && a !== i) {
 *     console.log('[v1.40.106 generate] new JD detected ...');
 *     // resets sections to clean template
 *   }
 *
 * But that detection fires at Generate time, not at upload time. If
 * the user uploads a new JD and looks at the preview before clicking
 * Generate, they still see the old CV content — confusing.
 *
 * This sidecar moves the trigger EARLIER, to the moment the user
 * picks (or drops) a new JD file. We don't reset React state
 * directly — we can't from a sidecar. Instead we do two things:
 *
 *   1. Clear `localStorage.lastGeneratedJDFingerprint` so that
 *      app.js's existing reset logic is *guaranteed* to fire on the
 *      next Generate. (Without this, a JD with the same fingerprint
 *      as last time would skip the reset.)
 *
 *   2. Show a transient toast telling the user that sections will
 *      reset on the next Generate, so they're not surprised by the
 *      blank template.
 *
 * Both file-picker uploads (input change) and drag-drop uploads are
 * watched. URL-paste JD imports aren't covered yet — that path goes
 * through `/api/fetch-jd-url` and would need a fetch hook.
 *
 * Notes
 * ─────
 *   - Only fires if a current `sections` localStorage value exists
 *     (i.e. there's something to reset). First-time uploads are
 *     skipped silently.
 *   - 500ms dedupe in case the change event and drop event both fire
 *     for the same upload.
 *   - The toast lives in the bottom-left so it doesn't overlap the
 *     bottom-right FAB stack.
 *   - The `antcv:jd-changed` custom event is dispatched so other
 *     sidecars can react if they ever need to.
 */

(function () {
  'use strict';

  const SCRIPT_VERSION = '1.40.131';
  const TOAST_ID = 'antcv-jd-watch-toast';
  const STYLE_ID = 'antcv-jd-watch-styles';
  const INPUT_MARKER = 'data-antcv-jd-watched';

  // ─── Heuristics: is this file a JD candidate? ─────────────────────

  const JD_EXTS = new Set(['pdf', 'doc', 'docx', 'txt']);

  function fileExt(name) {
    const s = String(name || '');
    const dot = s.lastIndexOf('.');
    return dot < 0 ? '' : s.slice(dot + 1).toLowerCase();
  }

  function looksLikeJd(file) {
    if (!file || !file.name) return false;
    return JD_EXTS.has(fileExt(file.name));
  }

  // The JD-specific file input has accept exactly ".pdf,.doc,.docx,.txt"
  // and is not multiple. The wizard input shares the .txt extension
  // but additionally accepts .json and .js and is `multiple`. Re-edit
  // uploads accept .pdf,.doc,.docx (no .txt). Settings/template
  // imports accept only .json. So checking accept + multiple alone is
  // enough to identify the JD input among the rendered file inputs.
  //
  // We use the input's accept attribute as a *positive* signal, but
  // we also accept ANY input whose change event yields a JD-shaped
  // file as long as a current section state exists (i.e. the user is
  // past the wizard and into the editor). This gives us coverage even
  // if app.js renames the inputs in a future version.
  function isJdInput(input) {
    if (!input || input.tagName !== 'INPUT' || input.type !== 'file') {
      return false;
    }
    const accept = (input.getAttribute('accept') || '')
      .toLowerCase()
      .replace(/\s+/g, '');
    const multiple = input.hasAttribute('multiple');
    if (input.id === '_wiz_file_input') return false;
    if (accept.includes('.json') || accept.includes('.js')) return false;
    if (multiple) return false;
    return accept.includes('.txt') || accept === '.pdf,.doc,.docx,.txt';
  }

  // ─── State and helpers ────────────────────────────────────────────

  let lastTriggerMs = 0;
  const DEDUPE_MS = 500;

  function hasExistingSections() {
    try {
      const raw = localStorage.getItem('sections');
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return !!(parsed && (
        (Array.isArray(parsed.cv) && parsed.cv.length) ||
        (Array.isArray(parsed.cl) && parsed.cl.length)
      ));
    } catch (_) {
      return false;
    }
  }

  function clearGeneratedFingerprint() {
    try {
      localStorage.removeItem('lastGeneratedJDFingerprint');
    } catch (_) {}
  }

  function dispatchJdChanged(detail) {
    try {
      window.dispatchEvent(new CustomEvent('antcv:jd-changed', { detail }));
    } catch (_) {}
  }

  // ─── Toast ────────────────────────────────────────────────────────

  function injectStylesOnce() {
    if (document.getElementById(STYLE_ID)) return;
    const css = `
      #${TOAST_ID} {
        position: fixed;
        bottom: 24px;
        left: 24px;
        z-index: 3000;
        max-width: 360px;
        padding: 12px 16px;
        background: #283556;
        color: #fff;
        border-left: 3px solid #01B7BB;
        border-radius: 4px;
        font-family: Calibri, Arial, sans-serif;
        font-size: 13px;
        line-height: 1.4;
        box-shadow: 0 6px 20px rgba(40, 53, 86, 0.25);
        opacity: 0;
        transform: translateY(8px);
        transition: opacity 0.18s, transform 0.18s;
        pointer-events: auto;
      }
      #${TOAST_ID}.antcv-jd-toast-visible {
        opacity: 1;
        transform: translateY(0);
      }
      #${TOAST_ID} .antcv-jd-toast-title {
        font-weight: 700;
        margin-bottom: 4px;
      }
      #${TOAST_ID} .antcv-jd-toast-body {
        color: rgba(255, 255, 255, 0.85);
      }
      @media (max-width: 600px) {
        #${TOAST_ID} {
          left: 12px;
          right: 12px;
          bottom: 12px;
          max-width: none;
        }
      }
      @media print {
        #${TOAST_ID} { display: none !important; }
      }
    `;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  let toastTimer = null;

  function showToast(fileName) {
    injectStylesOnce();
    // Remove any existing toast first.
    const existing = document.getElementById(TOAST_ID);
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    const toast = document.createElement('div');
    toast.id = TOAST_ID;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    const title = document.createElement('div');
    title.className = 'antcv-jd-toast-title';
    title.textContent = 'New JD detected';
    const body = document.createElement('div');
    body.className = 'antcv-jd-toast-body';
    const safe = String(fileName || 'unknown').slice(0, 60);
    body.textContent =
      'Sections will reset to a clean template when you click Generate. (' +
      safe + ')';
    toast.appendChild(title);
    toast.appendChild(body);
    document.body.appendChild(toast);
    // Trigger transition on the next frame.
    requestAnimationFrame(() => {
      toast.classList.add('antcv-jd-toast-visible');
    });
    toastTimer = setTimeout(() => {
      toast.classList.remove('antcv-jd-toast-visible');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 250);
      toastTimer = null;
    }, 5000);
  }

  // ─── Core trigger ─────────────────────────────────────────────────

  function handleJdCandidate(file, source) {
    if (!looksLikeJd(file)) return;
    const now = Date.now();
    if (now - lastTriggerMs < DEDUPE_MS) return;
    lastTriggerMs = now;
    if (!hasExistingSections()) {
      // First-time upload — nothing to reset, no toast needed.
      dispatchJdChanged({
        fileName: file.name, ext: fileExt(file.name), source, hadSections: false,
      });
      return;
    }
    clearGeneratedFingerprint();
    dispatchJdChanged({
      fileName: file.name, ext: fileExt(file.name), source, hadSections: true,
    });
    showToast(file.name);
  }

  // ─── Hook 1: file-input change ────────────────────────────────────

  function attachToInput(input) {
    if (!isJdInput(input)) return;
    if (input.getAttribute(INPUT_MARKER) === '1') return;
    input.setAttribute(INPUT_MARKER, '1');
    input.addEventListener('change', (ev) => {
      try {
        const file = ev.target && ev.target.files && ev.target.files[0];
        if (file) handleJdCandidate(file, 'input-change');
      } catch (_) {}
    }, true);
  }

  function scanInputs() {
    try {
      const inputs = document.querySelectorAll('input[type="file"]');
      for (let i = 0; i < inputs.length; i++) attachToInput(inputs[i]);
    } catch (_) {}
  }

  // ─── Hook 2: document-level drop ──────────────────────────────────
  //
  // Drag-drop uploads in app.js call `Hi(file)` directly via the `Ui`
  // handler rather than routing through the file input, so the input
  // `change` event never fires for them. We listen for `drop` on the
  // document in capture phase so we catch the file before the React
  // handler does its parse, regardless of which zone caught the drop.

  function onDocumentDrop(ev) {
    try {
      const files = ev.dataTransfer && ev.dataTransfer.files;
      if (!files || !files.length) return;
      handleJdCandidate(files[0], 'document-drop');
    } catch (_) {}
  }

  // ─── Boot ─────────────────────────────────────────────────────────

  function init() {
    injectStylesOnce();
    scanInputs();
    document.addEventListener('drop', onDocumentDrop, true);
    // Re-scan whenever the DOM changes, since app.js re-mounts inputs
    // across step transitions (upload → editor → settings).
    const observer = new MutationObserver(() => scanInputs());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 0);
  }

  // Expose a tiny test/debug API.
  window.AntcvJdWatch = {
    version: SCRIPT_VERSION,
    // Test hooks
    _looksLikeJd: looksLikeJd,
    _isJdInput: isJdInput,
    _handleCandidate: handleJdCandidate,
  };
})();
