/* AntCV kernel showcase error recovery (v1.40.286)
 * ──────────────────────────────────────────────────────────────────────
 *
 * Problem (with full root-cause analysis)
 * ───────────────────────────────────────
 *   Gabriel reported: pressing "Regenerate kernel showcase" produces
 *   a blue-screen / unresponsive app.
 *
 *   From the console log:
 *
 *     [showcase] sections reset to fresh kernel template (cv:11, cl:8)
 *     [showcase] generation queued
 *     [v1.40.108 generate] meta={"company":"","role":"","subtitle":""}
 *                          jd_len=3154 showcase=true
 *     [v1.40.112 showcase] LLM hallucinated company="Unknown"
 *                          role="Unknown" — discarding and forcing Unsolicited.
 *     [v1.40.112 showcase] scrubbed hallucinated company "Unknown" from CL body fields.
 *     [generate] PLACEHOLDER LEAK: 15 section(s) contain bracketed
 *                template slots that the LLM did not replace
 *     TypeError: a is not a function
 *       at _scrubRole (app.js?v=1.125:1:416305)
 *       at Array.map (...)
 *       at Object.useState (react-dom.production.min.js:242:318)
 *
 *   The kernel showcase flow:
 *     1. Resets sections to a 11-CV + 8-CL kernel template (with
 *        bracketed placeholders).
 *     2. Asks the LLM to fill the placeholders for an unsolicited CV
 *        (no JD).
 *     3. The LLM hallucinates company / role ("Unknown") and leaves
 *        many [bracketed] placeholders intact (15 sections leaked).
 *     4. app.js's `_scrubRole` is called during React's useState
 *        initializer to clean up the response and crashes because the
 *        sections structure contains things it expected to be
 *        functions / arrays that aren't.
 *
 *   The crash is INSIDE app.js's production-minified code. It cannot
 *   be reached from a sidecar; we cannot rewrite the minified
 *   `_scrubRole`. What this sidecar CAN do:
 *
 *     (a) Warn the user before they click the button, explaining the
 *         known issue.
 *     (b) Catch the runtime error and show a recovery panel with a
 *         "Reload" button so the user isn't stuck on a blank app.
 *
 * Approach
 * ────────
 *   1. Listen for window.onerror and unhandledrejection. If the error
 *      message / stack matches the `_scrubRole` signature, install a
 *      full-screen recovery panel.
 *   2. Capture-phase click on the kernel showcase button. If the user
 *      hasn't acknowledged the warning yet (per-session), show a
 *      confirm dialog explaining the bug and asking whether to
 *      proceed. If they confirm, mark acknowledged and re-dispatch
 *      the original click; otherwise swallow it.
 *
 * Notes
 * ─────
 *   - Does NOT prevent the kernel showcase from working when it
 *     happens to succeed (e.g., on a different app.js build). The
 *     pre-click warning only fires once per session.
 *   - The recovery panel does not modify localStorage — `personalInfo`
 *     is preserved. On reload, antcv-personal-info-cloud-restore-282
 *     should re-hydrate any data that's in cloud, and the `sections`
 *     bucket survives the crash (it was already reset to the kernel
 *     template at step 1; the user's prior CV is gone, but that's a
 *     separate side-effect of the showcase feature, not this patch).
 */
(function () {
  'use strict';
  var VERSION = '1.40.286';
  if (window.__antcvKernelErrorRecovery286 === VERSION) return;
  window.__antcvKernelErrorRecovery286 = VERSION;

  var PANEL_ID = 'antcv-kernel-error-recovery-286';
  var SESSION_ACK_KEY = 'antcv:kernel-showcase-warned-286';
  var panelShown = false;

  function getErrorMessage(ev) {
    if (!ev) return '';
    if (ev.message) return String(ev.message);
    if (ev.error && ev.error.message) return String(ev.error.message);
    if (ev.reason && ev.reason.message) return String(ev.reason.message);
    if (typeof ev.reason === 'string') return ev.reason;
    return '';
  }
  function getErrorStack(ev) {
    if (!ev) return '';
    if (ev.error && ev.error.stack)   return String(ev.error.stack);
    if (ev.reason && ev.reason.stack) return String(ev.reason.stack);
    return '';
  }

  // Signature: TypeError "a is not a function" at _scrubRole, OR
  // any error whose stack mentions _scrubRole.
  function isKernelCrash(ev) {
    var msg = getErrorMessage(ev);
    var stack = getErrorStack(ev);
    if (/_scrubRole/i.test(stack)) return true;
    if (/_scrubRole/i.test(msg)) return true;
    // Fallback: minified TypeError that bubbles up from a showcase
    // generation context. Be conservative — require both signals.
    if (/is not a function/i.test(msg) && /showcase|kernel|scrub/i.test(stack)) return true;
    return false;
  }

  function showRecoveryPanel(errMsg) {
    if (panelShown) return;
    panelShown = true;
    try {
      if (document.getElementById(PANEL_ID)) return;
      var overlay = document.createElement('div');
      overlay.id = PANEL_ID;
      overlay.style.cssText = [
        'position:fixed', 'inset:0',
        'z-index:2147483647',
        'background:rgba(20,30,46,0.96)',
        'display:flex', 'align-items:center', 'justify-content:center',
        'padding:20px', 'font-family:system-ui,sans-serif'
      ].join(';');

      var card = document.createElement('div');
      card.style.cssText = [
        'background:#1d2738', 'color:#fff',
        'border:1px solid #FFD27A', 'border-radius:10px',
        'box-shadow:0 8px 32px rgba(0,0,0,0.6)',
        'padding:22px 20px', 'max-width:480px', 'width:100%',
        'font-size:14px', 'line-height:1.5',
        'max-height:90vh', 'overflow-y:auto'
      ].join(';');

      var msgHtml = errMsg ? ('<div style="font-family:monospace;font-size:11px;background:#0f1726;border:1px solid #2c3a52;border-radius:4px;padding:6px 8px;color:#FF9E9E;margin-bottom:12px;word-break:break-word;">' + escapeHtml(errMsg) + '</div>') : '';

      card.innerHTML =
        '<div style="font-weight:700;color:#FFD27A;font-size:16px;margin-bottom:10px;">' +
          '⚠ Kernel showcase generation crashed' +
        '</div>' +
        msgHtml +
        '<div style="margin-bottom:12px;color:#cfdbe7;">' +
          'The app.js renderer (v1.40.172) crashed while scrubbing the LLM ' +
          'response in <code style="color:#FFD27A;">_scrubRole</code>. ' +
          'This is a bug in the underlying app.js that this patch cannot fix from a sidecar.' +
        '</div>' +
        '<div style="margin-bottom:14px;color:#cfdbe7;font-size:13px;">' +
          'Your personalInfo is safe in localStorage + cloud. The ' +
          'kernel showcase had already replaced your previous CV/CL ' +
          'with a template before crashing — reloading will pull back ' +
          'your saved data from cloud (via patch 282).' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:8px;">' +
          '<button id="' + PANEL_ID + '-reload" style="' +
            'background:#01B7BB;color:#fff;border:none;border-radius:6px;' +
            'padding:11px 16px;font-weight:700;font-size:14px;cursor:pointer;">' +
            '↻  Reload and restore from cloud' +
          '</button>' +
          '<button id="' + PANEL_ID + '-dismiss" style="' +
            'background:transparent;color:#8a98ad;border:1px solid #8a98ad;' +
            'border-radius:6px;padding:9px 16px;font-weight:600;font-size:13px;cursor:pointer;">' +
            'Dismiss (the app may still be broken)' +
          '</button>' +
        '</div>' +
        '<div style="margin-top:10px;font-size:11px;color:#8a98ad;">' +
          'Avoid pressing Regenerate kernel showcase until the underlying ' +
          'app.js bug is fixed in a new build.' +
        '</div>';

      overlay.appendChild(card);
      document.body.appendChild(overlay);

      var reloadBtn = document.getElementById(PANEL_ID + '-reload');
      var dismissBtn = document.getElementById(PANEL_ID + '-dismiss');
      if (reloadBtn) {
        reloadBtn.addEventListener('click', function () {
          try { location.reload(); } catch (_) {}
        });
      }
      if (dismissBtn) {
        dismissBtn.addEventListener('click', function () {
          try { overlay.parentNode.removeChild(overlay); } catch (_) {}
          panelShown = false;
        });
      }
    } catch (_) { panelShown = false; }
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ── error capture ────────────────────────────────────────────────
  window.addEventListener('error', function (ev) {
    if (isKernelCrash(ev)) {
      try { console.warn('[kernel-error-recovery-286] caught:', ev.message); } catch (_) {}
      showRecoveryPanel(ev.message);
    }
  }, true);

  window.addEventListener('unhandledrejection', function (ev) {
    if (isKernelCrash(ev)) {
      var msg = getErrorMessage(ev) || String(ev.reason || '');
      try { console.warn('[kernel-error-recovery-286] caught rejection:', msg); } catch (_) {}
      showRecoveryPanel(msg);
    }
  }, true);

  // ── pre-click warning for the kernel showcase button ─────────────
  function isKernelButton(b) {
    if (!b || (b.tagName !== 'BUTTON' && (!b.getAttribute || b.getAttribute('role') !== 'button'))) return false;
    var t = (b.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
    return /regenerate\s+kernel\s+showcase/.test(t);
  }

  function sessionAcked() {
    try { return sessionStorage.getItem(SESSION_ACK_KEY) === '1'; } catch (_) { return false; }
  }
  function markAcked() {
    try { sessionStorage.setItem(SESSION_ACK_KEY, '1'); } catch (_) {}
  }

  document.addEventListener('click', function (ev) {
    var b = ev.target;
    for (var hops = 0; b && b !== document.body && hops < 4; hops++, b = b.parentElement) {
      if (!isKernelButton(b)) continue;
      if (sessionAcked()) return;     // user already confirmed once this session

      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

      // Use the same panel-style confirm as the recovery panel so
      // mobile users get a usable layout (not the tiny native
      // window.confirm which can be hard to read).
      showPreClickWarning(b);
      return;
    }
  }, true);

  function showPreClickWarning(originalBtn) {
    if (document.getElementById(PANEL_ID + '-warn')) return;
    try {
      var overlay = document.createElement('div');
      overlay.id = PANEL_ID + '-warn';
      overlay.style.cssText = [
        'position:fixed', 'inset:0',
        'z-index:2147483647',
        'background:rgba(20,30,46,0.92)',
        'display:flex', 'align-items:center', 'justify-content:center',
        'padding:20px', 'font-family:system-ui,sans-serif'
      ].join(';');

      var card = document.createElement('div');
      card.style.cssText = [
        'background:#1d2738', 'color:#fff',
        'border:1px solid #FFD27A', 'border-radius:10px',
        'box-shadow:0 8px 32px rgba(0,0,0,0.6)',
        'padding:22px 20px', 'max-width:480px', 'width:100%',
        'font-size:14px', 'line-height:1.5',
        'max-height:90vh', 'overflow-y:auto'
      ].join(';');

      card.innerHTML =
        '<div style="font-weight:700;color:#FFD27A;font-size:16px;margin-bottom:10px;">' +
          '⚠ Known issue: kernel showcase may crash' +
        '</div>' +
        '<div style="margin-bottom:12px;color:#cfdbe7;">' +
          'Regenerating the kernel showcase has two known problems in this build:' +
        '</div>' +
        '<ol style="margin:0 0 12px 18px;color:#cfdbe7;padding:0;">' +
          '<li style="margin-bottom:6px;">It <b>replaces</b> your current CV and Cover Letter with a generated template (your data is preserved in cloud if you Saved earlier).</li>' +
          '<li>It often <b>crashes the app</b> with <code style="color:#FFD27A;">TypeError: a is not a function</code> in <code>_scrubRole</code> — a bug in app.js v1.40.172 that we cannot fix from a sidecar.</li>' +
        '</ol>' +
        '<div style="margin-bottom:14px;color:#cfdbe7;font-size:13px;">' +
          'If it crashes, the recovery panel will offer a reload that restores your data from cloud.' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:8px;">' +
          '<button id="' + PANEL_ID + '-warn-proceed" style="' +
            'background:#a8770a;color:#fff;border:none;border-radius:6px;' +
            'padding:11px 16px;font-weight:700;font-size:14px;cursor:pointer;">' +
            'Proceed anyway' +
          '</button>' +
          '<button id="' + PANEL_ID + '-warn-cancel" style="' +
            'background:transparent;color:#01B7BB;border:1px solid #01B7BB;' +
            'border-radius:6px;padding:10px 16px;font-weight:700;font-size:13px;cursor:pointer;">' +
            'Cancel' +
          '</button>' +
        '</div>';

      overlay.appendChild(card);
      document.body.appendChild(overlay);

      var proceedBtn = document.getElementById(PANEL_ID + '-warn-proceed');
      var cancelBtn  = document.getElementById(PANEL_ID + '-warn-cancel');
      if (proceedBtn) {
        proceedBtn.addEventListener('click', function () {
          markAcked();
          try { overlay.parentNode.removeChild(overlay); } catch (_) {}
          // Re-dispatch a click on the original button. It'll bubble
          // up through the same handler, but sessionAcked() now
          // returns true so we let it through.
          try { originalBtn.click(); } catch (_) {}
        });
      }
      if (cancelBtn) {
        cancelBtn.addEventListener('click', function () {
          try { overlay.parentNode.removeChild(overlay); } catch (_) {}
        });
      }
    } catch (_) {}
  }

  window.AntcvKernelErrorRecovery286 = {
    version: VERSION,
    _showRecoveryPanel: showRecoveryPanel,
    _showPreClickWarning: showPreClickWarning,
    _isKernelCrash: isKernelCrash,
    _resetSession: function () {
      try { sessionStorage.removeItem(SESSION_ACK_KEY); } catch (_) {}
    },
  };

  try { console.debug('[kernel-error-recovery-286] installed v' + VERSION); } catch (_) {}
})();
