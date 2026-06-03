/* AntCV fit-cv-cloud-sync sidecar (v1.40.196)
 * ============================================================
 *
 * Two related fit-flow bugs Gabriel reported on 2026-05-19:
 *
 *   (A) "Fit vs CV" modal auto-opens even when no CV is loaded.
 *       For a fresh session or after a Reset CV, the dialog has
 *       nothing to compare — it should stay closed until the user
 *       has a CV.
 *
 *   (B) Run-fit logs "No CV sections found in localStorage" when
 *       the active CV is cloud-resident only (i.e. cloud-restore
 *       hasn't mirrored sections back to localStorage yet, or
 *       wrote to a different key, or completed only personalInfo).
 *
 * Both bugs share the same root signal: does localStorage hold a
 * usable CV for this session? This sidecar exposes one truth-source
 * (`hasUsableCv()`), then wires two interception paths:
 *
 *   - Fit-vs-CV modal mounts → if no CV, close it immediately.
 *   - Run-fit-style buttons → on click, if no CV in localStorage
 *     but the active_application cloud row has cv_sections, sync
 *     them down first, then let the click proceed.
 *
 * We can't see app.js's internal state, but the relay endpoint
 * (`GET /api/prefs`) returns active_application.cv_sections when
 * a cloud-side CV exists. Sync = fetch prefs, write
 * localStorage.sections, dispatch antcv:sections-updated, and
 * give React one tick to react.
 *
 * Detection
 * ---------
 * Fit-vs-CV modal: any [role="dialog"]/[class*="modal" i] whose
 *   visible header text matches /fit\s*(?:vs\.?|against)\s*cv/i,
 *   or carries [data-antcv-modal="fit-vs-cv"] (future-proof).
 *
 * Run-fit button: any element with role="button"/<button> whose
 *   text matches /run\s*fit|recheck\s*fit|re-?run\s*fit|fit\s*against\s*cv|score\s*fit/i,
 *   or carries [data-antcv-action="run-fit"].
 *
 * Storage probe
 * -------------
 * "Usable CV" = localStorage.sections parses as JSON, has a `cv`
 * array, and the cv array contains at least one section whose
 * (items.length || bullets.length || (title && title.length)) > 0.
 * We never gate on a single field because section shape varies
 * across types — emptiness check is structural.
 */
(function () {
  'use strict';

  if (window.__antcvFitCvCloudSyncInstalled) return;
  window.__antcvFitCvCloudSyncInstalled = '1.40.196';

  // ─── CV presence probe ───────────────────────────────────────────
  function readSectionsBundle() {
    try {
      const raw = localStorage.getItem('sections');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) { return null; }
  }

  function isPlainObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

  function isSectionUsable(s) {
    if (!isPlainObject(s)) return false;
    const itemsN = Array.isArray(s.items) ? s.items.length : 0;
    const bulletsN = Array.isArray(s.bullets) ? s.bullets.length : 0;
    const titleN = (typeof s.title === 'string') ? s.title.trim().length : 0;
    const bodyN = (typeof s.body === 'string') ? s.body.trim().length : 0;
    return itemsN > 0 || bulletsN > 0 || (titleN > 0 && bodyN > 0);
  }

  function hasUsableCv() {
    const bundle = readSectionsBundle();
    if (!bundle) return false;
    const list = Array.isArray(bundle) ? bundle : bundle.cv;
    if (!Array.isArray(list) || !list.length) return false;
    return list.some(isSectionUsable);
  }

  // ─── Relay sync ──────────────────────────────────────────────────
  function getRelayBase() {
    let v = '';
    try { v = String(localStorage.getItem('relayUrl') || ''); } catch (_) {}
    if (!v && typeof window !== 'undefined' && window.ANTCV_RELAY_URL) {
      v = String(window.ANTCV_RELAY_URL);
    }
    return v.replace(/\/+$/, '');
  }

  function getAuthToken() {
    try { return localStorage.getItem('antcv:auth:token') || ''; } catch (_) { return ''; }
  }

  let syncInflight = null;
  // Returns a promise resolving with { synced: bool, reason: string }.
  // Idempotent: concurrent calls share one flight.
  function syncCvFromCloud() {
    if (syncInflight) return syncInflight;
    syncInflight = (async function () {
      try {
        const base = getRelayBase();
        const token = getAuthToken();
        if (!base) return { synced: false, reason: 'no-relay-url' };
        if (!token) return { synced: false, reason: 'no-auth-token' };
        const res = await window.fetch(base + '/api/prefs', {
          method: 'GET',
          headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' },
        });
        if (!res.ok) return { synced: false, reason: 'http-' + res.status };
        let body;
        try { body = await res.json(); } catch (_) { return { synced: false, reason: 'bad-json' }; }
        const aa = body && body.active_application;
        const cvFromCloud = aa && aa.cv_sections;
        const clFromCloud = aa && aa.cl_sections;
        if (!Array.isArray(cvFromCloud) || !cvFromCloud.length) {
          return { synced: false, reason: 'cloud-cv-empty' };
        }
        // Merge into localStorage.sections — preserve cl side if
        // present locally and missing in cloud, vice versa.
        let cur = readSectionsBundle();
        if (!cur || (!Array.isArray(cur) && !isPlainObject(cur))) cur = { cv: [], cl: [] };
        if (Array.isArray(cur)) cur = { cv: cur, cl: [] };
        cur.cv = cvFromCloud;
        if (Array.isArray(clFromCloud) && clFromCloud.length && (!Array.isArray(cur.cl) || !cur.cl.length)) {
          cur.cl = clFromCloud;
        }
        try { localStorage.setItem('sections', JSON.stringify(cur)); } catch (_) {}
        // Mirror meta so the React state-rehydrate sees it.
        if (aa && (aa.jd_company || aa.jd_role)) {
          try {
            const metaRaw = localStorage.getItem('meta') || '{}';
            let meta = {};
            try { meta = JSON.parse(metaRaw) || {}; } catch (_) {}
            if (aa.jd_company) meta.company = aa.jd_company;
            if (aa.jd_role) meta.role = aa.jd_role;
            localStorage.setItem('meta', JSON.stringify(meta));
          } catch (_) {}
        }
        try {
          window.dispatchEvent(new CustomEvent('antcv:sections-updated', {
            detail: { source: 'fit-cv-cloud-sync' },
          }));
        } catch (_) {}
        try { console.debug('[fit-cv-cloud-sync] mirrored cv_sections from cloud (' +
                            cvFromCloud.length + ' sections)'); } catch (_) {}
        return { synced: true, reason: 'ok', sections: cvFromCloud.length };
      } catch (e) {
        try { console.warn('[fit-cv-cloud-sync] cloud sync failed:', e && e.message); } catch (_) {}
        return { synced: false, reason: 'exception' };
      } finally {
        // Clear inflight one tick later so adjacent triggers can re-try.
        setTimeout(function () { syncInflight = null; }, 0);
      }
    })();
    return syncInflight;
  }

  // ─── Bug A: suppress Fit-vs-CV auto-open when no CV ──────────────
  function isFitVsCvModal(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.getAttribute('data-antcv-modal') === 'fit-vs-cv') return true;
    // Heuristic: heading text inside the element.
    const head = el.querySelector('h1, h2, h3, [role="heading"], [data-antcv-modal-title]');
    const txt = (head ? head.textContent : el.textContent || '').slice(0, 200);
    if (!txt) return false;
    return /fit\s*(?:vs\.?|against)\s*cv|fit-vs-cv|fit vs\.? CV/i.test(txt);
  }

  function isVisible(el) {
    if (!el) return false;
    const cs = (el.ownerDocument && el.ownerDocument.defaultView)
      ? el.ownerDocument.defaultView.getComputedStyle(el) : null;
    if (!cs) return true;
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    return el.offsetWidth > 0 || el.offsetHeight > 0;
  }

  function closeModal(el) {
    // Strategy: find a Close button inside the modal and click it.
    // Fallback: hide via inline style + dispatch Escape key.
    const closers = el.querySelectorAll(
      '[aria-label*="close" i], [data-antcv-close], button[title*="close" i], ' +
      '[class*="close" i] > button, button[class*="close" i]'
    );
    for (const c of closers) {
      if (isVisible(c)) {
        try { c.click(); return true; } catch (_) {}
      }
    }
    // Fallback: dispatch Escape on the modal.
    try {
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
    } catch (_) {}
    try { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true })); } catch (_) {}
    // Last resort: visual-hide so the user isn't blocked.
    try {
      el.style.display = 'none';
      el.setAttribute('data-antcv-fit-guard-suppressed', '1');
    } catch (_) {}
    return true;
  }

  function maybeSuppressFitVsCvModal(el) {
    if (!isFitVsCvModal(el)) return false;
    if (el.getAttribute('data-antcv-fit-guard-checked') === '1') return false;
    // Wait one frame for React to settle, then re-check.
    requestAnimationFrame(function () {
      el.setAttribute('data-antcv-fit-guard-checked', '1');
      if (!isVisible(el)) return;
      if (hasUsableCv()) return;
      // No usable CV → close.
      try { console.debug('[fit-cv-cloud-sync] Fit-vs-CV opened without a CV — closing & syncing'); } catch (_) {}
      closeModal(el);
      // Try a one-shot cloud sync in the background; if it succeeds
      // the user can re-open the modal manually.
      syncCvFromCloud().then(function (r) {
        if (r && r.synced) {
          showToast('CV synced from cloud — click Fit vs CV again to compare.');
        } else if (r && r.reason === 'cloud-cv-empty') {
          showToast('No CV is loaded yet. Generate one first, then compare.');
        }
      });
    });
    return true;
  }

  // ─── Bug B: Run-fit-style buttons gate ──────────────────────────
  const RUN_FIT_RE = /run\s*fit|recheck\s*fit|re-?run\s*fit|fit\s*against\s*cv|score\s*fit|re-?fit/i;

  function isRunFitButton(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.getAttribute('data-antcv-action') === 'run-fit') return true;
    const tag = (el.tagName || '').toLowerCase();
    const role = (el.getAttribute('role') || '').toLowerCase();
    if (tag !== 'button' && role !== 'button') return false;
    const t = (el.textContent || '').trim();
    if (!t || t.length > 80) return false;
    return RUN_FIT_RE.test(t);
  }

  // Capture-phase click interceptor. If clicked and no usable CV,
  // we stop the click, run a cloud-sync, then programmatically
  // re-click after the sync completes. We tag the synthetic click
  // with __antcvFitGated so the same handler doesn't loop.
  function onCaptureClick(ev) {
    const path = ev.composedPath ? ev.composedPath() : [];
    let btn = null;
    for (const n of path) {
      if (isRunFitButton(n)) { btn = n; break; }
    }
    if (!btn) {
      // Fallback: walk up from target.
      let cur = ev.target;
      while (cur && cur !== document) {
        if (isRunFitButton(cur)) { btn = cur; break; }
        cur = cur.parentNode;
      }
    }
    if (!btn) return;
    if (ev.__antcvFitGated) return;          // post-sync re-click
    if (btn.disabled) return;
    if (hasUsableCv()) return;               // happy path — let through

    // No CV → intercept.
    ev.preventDefault();
    ev.stopImmediatePropagation();
    showToast('CV not in browser storage yet — syncing from cloud…');
    syncCvFromCloud().then(function (r) {
      if (r && r.synced) {
        showToast('CV synced. Running fit…', 1500);
        try {
          // Re-dispatch the same click as a trusted-ish event so React
          // handlers fire. We mark it so we don't loop.
          const evt = new MouseEvent('click', {
            bubbles: true, cancelable: true, view: window,
          });
          evt.__antcvFitGated = true;
          btn.dispatchEvent(evt);
        } catch (_) {}
      } else {
        const reason = (r && r.reason) || 'unknown';
        if (reason === 'cloud-cv-empty') {
          showToast('No CV exists yet — generate one first.', 4000);
        } else if (reason === 'no-auth-token') {
          showToast('Sign in to pull your CV from the cloud.', 4000);
        } else {
          showToast('Could not sync CV (' + reason + '). Try again or generate locally.', 4000);
        }
      }
    });
  }

  // ─── Toast UI ────────────────────────────────────────────────────
  let toastEl = null;
  let toastTimer = null;
  function showToast(message, durationMs) {
    durationMs = durationMs || 3000;
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.setAttribute('data-antcv-fit-toast', '1');
      Object.assign(toastEl.style, {
        position: 'fixed', bottom: '20px', left: '50%',
        transform: 'translateX(-50%)', zIndex: '9991',
        background: '#283556', color: '#fff',
        padding: '10px 16px', borderRadius: '6px',
        fontFamily: 'Trebuchet MS, Calibri, sans-serif',
        fontSize: '13px', fontWeight: '500',
        boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
        maxWidth: '90vw', textAlign: 'center',
      });
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.style.opacity = '1';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      if (!toastEl) return;
      toastEl.style.opacity = '0';
    }, durationMs);
  }

  // ─── Observer wiring ─────────────────────────────────────────────
  try {
    const mo = new MutationObserver(function (records) {
      for (const r of records) {
        for (const n of (r.addedNodes || [])) {
          if (!n || n.nodeType !== 1) continue;
          maybeSuppressFitVsCvModal(n);
          // Also descendants.
          if (n.querySelectorAll) {
            const inner = n.querySelectorAll('[role="dialog"], [class*="modal" i]');
            for (const m of inner) maybeSuppressFitVsCvModal(m);
          }
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  } catch (_) {}

  document.addEventListener('click', onCaptureClick, true /* capture */);

  // First-pass: if a fit-vs-cv modal is already open at boot, evaluate.
  setTimeout(function () {
    document.querySelectorAll('[role="dialog"], [class*="modal" i]')
      .forEach(maybeSuppressFitVsCvModal);
  }, 400);

  // Public API.
  window.AntcvFitCvCloudSync = {
    version: '1.40.196',
    hasUsableCv: hasUsableCv,
    syncCvFromCloud: syncCvFromCloud,
    _onCaptureClick: onCaptureClick,
    _showToast: showToast,
  };

  try { console.debug('[fit-cv-cloud-sync] installed v1.40.196'); } catch (_) {}
})();
