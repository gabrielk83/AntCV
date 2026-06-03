/* AntCV PDF-error toast sidecar (v1.40.194)
 * ============================================================
 *
 * Before this sidecar, when /generate-pdf failed (502 from
 * CloudConvert scope errors, 503 when the worker isn't configured,
 * timeouts, etc.) the only signal the user saw was a `[pdf]
 * (this is non-fatal — falling back to browser print)` line in the
 * browser console. The on-screen export proceeded silently via
 * window.print(), and the user had no idea their CloudConvert key
 * was misconfigured.
 *
 * This sidecar listens for the `antcv:pdf-export-error` custom event
 * dispatched by antcv-docx-client.js (v1.40.194+) and renders a
 * small, dismissible chip in the corner of the viewport. The chip:
 *
 *   - Shows ⚠ + a one-line headline ("PDF export degraded")
 *   - Carries a tooltip with the parsed upstream error
 *   - Stays visible until dismissed or until a successful export
 *     fires `antcv:pdf-export-success`
 *   - Self-dismisses after 20 s if untouched
 *   - Suppresses the "isConfigError" case (worker not configured)
 *     because that's a deliberate non-error state — the PWA falls
 *     back to browser print, which is the correct default-deployment
 *     behaviour for users without a docx-worker.
 *
 * Styling matches the existing in-app banners: warm-amber border,
 * pale-amber background, 600-weight headline, 13px body. Z-index is
 * 9990 — below the LED FAB (10000+) but above the preview pane.
 *
 * No external dependencies. Pure DOM. Safe to load before or after
 * antcv-docx-client.js because we attach to window events lazily.
 */
(function () {
  'use strict';

  const SCRIPT_VERSION = '1.40.194';
  if (window.__antcvPdfErrorToastInstalled) return;
  window.__antcvPdfErrorToastInstalled = SCRIPT_VERSION;

  const TOAST_ID = 'antcv-pdf-error-toast';
  const AUTO_DISMISS_MS = 20_000;
  let dismissTimer = null;

  function ensureContainer() {
    let el = document.getElementById(TOAST_ID);
    if (el) return el;
    el = document.createElement('div');
    el.id = TOAST_ID;
    Object.assign(el.style, {
      position: 'fixed',
      right: '16px',
      bottom: '88px',  // sits above the privacy LED FAB (~72px)
      zIndex: '9990',
      maxWidth: '340px',
      padding: '10px 12px 10px 14px',
      borderRadius: '8px',
      border: '1px solid #d97706',
      background: '#fef3c7',
      color: '#92400e',
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      fontSize: '13px',
      lineHeight: '1.4',
      boxShadow: '0 4px 12px rgba(0,0,0,0.10)',
      display: 'none',
      flexDirection: 'column',
      gap: '4px',
      pointerEvents: 'auto',
    });
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
    return el;
  }

  function classifyError(detail) {
    // Translate common upstream errors to human-readable headlines.
    // detail.detail is the parsed string; detail.upstream is the
    // parsed JSON body from the worker if present.
    const s = String(detail && detail.detail || '').toLowerCase();
    const up = detail && detail.upstream || null;
    if (s.indexOf('invalid scope') >= 0 || (up && /scope/i.test(up.message || ''))) {
      return {
        headline: 'PDF export — CloudConvert key needs scopes',
        body: 'The API key is rejecting jobs with "Invalid scope". Add task.read, task.write, user.read to it in the CloudConvert dashboard. PDF fell back to browser print this time.',
      };
    }
    if (s.indexOf('pdf_not_configured') >= 0) {
      return null;   // suppress — non-error
    }
    if (s.indexOf('timeout') >= 0 || s.indexOf('did not complete within') >= 0) {
      return {
        headline: 'PDF export — conversion timed out',
        body: 'The CloudConvert job ran longer than the worker budget. PDF fell back to browser print. Retry once; if it persists, check the docx-worker logs.',
      };
    }
    if (detail && detail.status >= 500) {
      return {
        headline: 'PDF export degraded (' + detail.status + ')',
        body: 'The docx-worker returned ' + detail.status + '. PDF fell back to browser print. Detail: ' + (s.slice(0, 220) || '(none)'),
      };
    }
    return {
      headline: 'PDF export failed',
      body: (s.slice(0, 280) || 'Unknown error'),
    };
  }

  function show(detail) {
    const classified = classifyError(detail);
    if (!classified) return;   // suppressed
    const el = ensureContainer();
    el.innerHTML = '';

    const head = document.createElement('div');
    head.style.display = 'flex';
    head.style.justifyContent = 'space-between';
    head.style.alignItems = 'flex-start';
    head.style.gap = '8px';

    const headline = document.createElement('div');
    headline.style.fontWeight = '700';
    headline.style.fontSize = '13px';
    headline.style.lineHeight = '1.35';
    headline.textContent = '\u26A0\uFE0F ' + classified.headline;

    const close = document.createElement('button');
    close.type = 'button';
    close.setAttribute('aria-label', 'Dismiss');
    close.textContent = '\u00D7';
    Object.assign(close.style, {
      background: 'transparent',
      border: 'none',
      color: '#92400e',
      fontSize: '20px',
      fontWeight: '600',
      lineHeight: '1',
      cursor: 'pointer',
      padding: '0 0 0 6px',
      marginTop: '-2px',
    });
    close.addEventListener('click', hide);

    head.appendChild(headline);
    head.appendChild(close);

    const body = document.createElement('div');
    body.style.fontSize = '12px';
    body.style.color = '#7c2d12';
    body.textContent = classified.body;

    el.appendChild(head);
    el.appendChild(body);
    el.style.display = 'flex';
    el.title = String(detail && detail.detail || '').slice(0, 600);

    if (dismissTimer) clearTimeout(dismissTimer);
    dismissTimer = setTimeout(hide, AUTO_DISMISS_MS);
  }

  function hide() {
    const el = document.getElementById(TOAST_ID);
    if (el) el.style.display = 'none';
    if (dismissTimer) { clearTimeout(dismissTimer); dismissTimer = null; }
  }

  window.addEventListener('antcv:pdf-export-error', function (ev) {
    try { show(ev && ev.detail); } catch (e) {
      console.warn('[pdf-error-toast] show failed:', e && e.message);
    }
  });

  window.addEventListener('antcv:pdf-export-success', function () {
    try { hide(); } catch (_) {}
  });

  // Public API for tests + manual dismiss.
  window.AntcvPdfErrorToast = {
    version: SCRIPT_VERSION,
    _show: show,
    _hide: hide,
    _classifyError: classifyError,
  };
})();
