/* AntCV full erase — account delete clears local + cloud (v1.40.290)
 * ──────────────────────────────────────────────────────────────────────
 *
 * Problem
 * ───────
 *   window.AntcvFullErase is referenced from antcv-ai-notice-actions.js
 *   (line 144) and antcv-ai-wizard-slide.js (line 183) — both wired to
 *   the "Disagree & Delete user" button in the EU AI Act consent step.
 *   But no patch actually defines AntcvFullErase. The fallback in those
 *   callers is just localStorage.clear() + location.reload(), which
 *   does NOT clear:
 *     - cloud /api/prefs (Cloudflare relay personalInfo + settings)
 *     - sessionStorage (auth and disclosure-decline markers)
 *     - IndexedDB (where some local job/section data lives)
 *     - service-worker cache (next reload may still serve stale data)
 *
 *   Gabriel: "if the user is deleting his account - all data must be
 *   removed including all the local and cloud storages".
 *
 * This patch
 * ──────────
 *   Defines window.AntcvFullErase as a Promise-returning function that:
 *     1. Wipes cloud personalInfo by PUTting {personalInfo:{}} to the
 *        configured relay's /api/prefs endpoint. Best-effort — failures
 *        do not block the rest of the erase.
 *     2. Clears localStorage and sessionStorage.
 *     3. Drops every IndexedDB database we can enumerate.
 *     4. Unregisters every active service worker and clears all
 *        CacheStorage caches.
 *     5. Calls AntcvAuth.signOut() if available (revokes any session).
 *     6. Reloads to a clean state.
 *
 *   It also injects a confirmation dialog before doing any of the above,
 *   because the previous flow only fired AntcvFullErase implicitly when
 *   the user clicked "Disagree & Delete user" — without showing what
 *   was about to happen. The dialog explains the scope of the erase and
 *   requires explicit confirmation.
 *
 *   The dialog is bypassed if the caller passes { skipConfirm: true } —
 *   useful for tests or programmatic teardown.
 *
 * Trigger points
 * ──────────────
 *   - Other patches calling window.AntcvFullErase() (no args) now get
 *     the full flow with confirmation.
 *   - Click handlers on .antcv-ai-delete buttons are intercepted here
 *     as a redundancy (in case the rescue patch didn't wire its own
 *     handler).
 */
(function () {
  'use strict';
  var VERSION = '1.40.290';
  if (window.__antcvFullErase290 === VERSION) return;
  window.__antcvFullErase290 = VERSION;

  var DIALOG_ID = 'antcv-full-erase-confirm-290';

  function relayUrl() {
    try {
      var v = window.localStorage.getItem('relayUrl') ||
              window.localStorage.getItem('proxyUrl') || '';
      if (v) return String(v).replace(/\/+$/, '');
    } catch (_) {}
    return '';
  }
  function authHeader() {
    try {
      var t = window.localStorage.getItem('antcv:auth:token') || '';
      if (t) return 'Bearer ' + t;
    } catch (_) {}
    return '';
  }

  async function wipeCloud() {
    var relay = relayUrl();
    if (!relay) return { ok: false, reason: 'no-relay-configured' };
    try {
      var headers = { 'Content-Type': 'application/json' };
      var auth = authHeader();
      if (auth) headers.Authorization = auth;

      // The relay accepts partial PUTs and stores keys independently.
      // Send empty replacements for every key we know lives there.
      var emptyBody = {
        personalInfo: {},
        apiKeys: {},
        proxyUrl: '',
        openaiProxyUrl: '',
        openaiModel: '',
        mistralModel: '',
        geminiModel: '',
        language: '',
        navyColor: '',
        consensusEnabled: false,
        useChatGPT: false,
        toneRegister: '',
        sidebarPosition: '',
        kernelShowcaseGenerated: false,
        _comments: 'erased ' + new Date().toISOString(),
      };
      var resp = await fetch(relay + '/api/prefs', {
        method: 'PUT',
        headers: headers,
        body: JSON.stringify(emptyBody),
      });
      // Also attempt a DELETE in case the relay supports it.
      try {
        await fetch(relay + '/api/prefs', { method: 'DELETE', headers: headers });
      } catch (_) {}
      return { ok: resp && resp.ok, status: resp && resp.status };
    } catch (e) {
      return { ok: false, reason: e && e.message };
    }
  }

  async function wipeIndexedDB() {
    if (!window.indexedDB) return { ok: true, dbs: [] };
    var names = [];
    try {
      if (typeof window.indexedDB.databases === 'function') {
        var dbs = await window.indexedDB.databases();
        names = (dbs || []).map(function (d) { return d && d.name; }).filter(Boolean);
      }
    } catch (_) {}
    // Add any known names if enumeration isn't supported (Safari).
    var known = ['antcv', 'antcv-applications', 'antcv-cache', 'antcv-data', 'antcv-store',
                 'keyval-store', 'localforage', 'antcv-sections', 'antcv-personalInfo'];
    var seen = {};
    var all = [];
    names.concat(known).forEach(function (n) { if (n && !seen[n]) { seen[n] = true; all.push(n); } });
    for (var i = 0; i < all.length; i++) {
      try {
        await new Promise(function (resolve) {
          var req = window.indexedDB.deleteDatabase(all[i]);
          req.onsuccess = function () { resolve(true); };
          req.onerror = function () { resolve(false); };
          req.onblocked = function () { resolve(false); };
          // Some browsers never fire these events for unknown DBs.
          setTimeout(function () { resolve(false); }, 2000);
        });
      } catch (_) {}
    }
    return { ok: true, dbs: all };
  }

  async function wipeCachesAndSW() {
    var out = { caches: 0, sw: 0 };
    try {
      if (window.caches && typeof window.caches.keys === 'function') {
        var keys = await window.caches.keys();
        for (var i = 0; i < keys.length; i++) {
          try { await window.caches.delete(keys[i]); out.caches++; } catch (_) {}
        }
      }
    } catch (_) {}
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
        var regs = await navigator.serviceWorker.getRegistrations();
        for (var j = 0; j < regs.length; j++) {
          try { await regs[j].unregister(); out.sw++; } catch (_) {}
        }
      }
    } catch (_) {}
    return out;
  }

  async function signOut() {
    try {
      if (window.AntcvAuth && typeof window.AntcvAuth.signOut === 'function') {
        await window.AntcvAuth.signOut();
        return { ok: true };
      }
    } catch (e) {
      return { ok: false, reason: e && e.message };
    }
    return { ok: false, reason: 'no-AntcvAuth' };
  }

  // ── The full erase flow ───────────────────────────────────────────
  async function fullErase(opts) {
    opts = opts || {};
    var report = { started: new Date().toISOString(), steps: {} };
    try {
      // 1. Cloud first (while we still have auth token in localStorage).
      report.steps.cloud = await wipeCloud();
    } catch (e) { report.steps.cloud = { ok: false, reason: e && e.message }; }
    try {
      // 2. IndexedDB.
      report.steps.indexedDB = await wipeIndexedDB();
    } catch (e) { report.steps.indexedDB = { ok: false, reason: e && e.message }; }
    try {
      // 3. CacheStorage + service workers.
      report.steps.caches = await wipeCachesAndSW();
    } catch (e) { report.steps.caches = { ok: false, reason: e && e.message }; }
    try {
      // 4. Sign-out — may itself clear localStorage but we wipe after anyway.
      report.steps.signOut = await signOut();
    } catch (e) { report.steps.signOut = { ok: false, reason: e && e.message }; }
    try {
      // 5. Local storage (sync).
      window.localStorage.clear();
      window.sessionStorage.clear();
      report.steps.localStorage = { ok: true };
    } catch (e) { report.steps.localStorage = { ok: false, reason: e && e.message }; }
    report.completed = new Date().toISOString();

    try { console.warn('[full-erase-290] complete:', report); } catch (_) {}

    if (!opts.skipReload) {
      // Replace location so back-button doesn't restore stale state.
      try { window.location.replace(window.location.origin + window.location.pathname); }
      catch (_) { try { window.location.reload(); } catch (_) {} }
    }
    return report;
  }

  // ── Confirmation dialog ───────────────────────────────────────────
  function showConfirm() {
    return new Promise(function (resolve) {
      if (document.getElementById(DIALOG_ID)) { resolve(false); return; }
      try {
        var overlay = document.createElement('div');
        overlay.id = DIALOG_ID;
        overlay.style.cssText = [
          'position:fixed', 'inset:0',
          'z-index:2147483647',
          'background:rgba(20,30,46,0.94)',
          'display:flex', 'align-items:center', 'justify-content:center',
          'padding:20px', 'font-family:system-ui,sans-serif'
        ].join(';');
        var card = document.createElement('div');
        card.style.cssText = [
          'background:#1d2738', 'color:#fff',
          'border:1px solid #FF5C5C', 'border-radius:10px',
          'box-shadow:0 8px 32px rgba(0,0,0,0.6)',
          'padding:22px 20px', 'max-width:480px', 'width:100%',
          'font-size:14px', 'line-height:1.5',
          'max-height:90vh', 'overflow-y:auto'
        ].join(';');
        card.innerHTML =
          '<div style="font-weight:700;color:#FF5C5C;font-size:16px;margin-bottom:12px;">' +
            '⚠ Delete account and erase all data' +
          '</div>' +
          '<div style="margin-bottom:12px;color:#cfdbe7;">' +
            'This will permanently remove:' +
          '</div>' +
          '<ul style="margin:0 0 14px 18px;color:#cfdbe7;padding:0;">' +
            '<li style="margin-bottom:6px;">Cloud personalInfo, preferences, API keys, application history (relay /api/prefs)</li>' +
            '<li style="margin-bottom:6px;">Local browser storage (localStorage + sessionStorage)</li>' +
            '<li style="margin-bottom:6px;">Local IndexedDB databases</li>' +
            '<li style="margin-bottom:6px;">Service worker + cached assets</li>' +
            '<li>Your sign-in session (you will be signed out)</li>' +
          '</ul>' +
          '<div style="margin-bottom:14px;color:#FFD27A;font-size:12px;">' +
            'This cannot be undone. Make sure you have exported anything you want to keep.' +
          '</div>' +
          '<div style="display:flex;flex-direction:column;gap:8px;">' +
            '<button id="' + DIALOG_ID + '-confirm" style="' +
              'background:#FF5C5C;color:#fff;border:none;border-radius:6px;' +
              'padding:11px 16px;font-weight:700;font-size:14px;cursor:pointer;">' +
              'Yes, delete everything' +
            '</button>' +
            '<button id="' + DIALOG_ID + '-cancel" style="' +
              'background:transparent;color:#01B7BB;border:1px solid #01B7BB;' +
              'border-radius:6px;padding:10px 16px;font-weight:700;font-size:13px;cursor:pointer;">' +
              'Cancel' +
            '</button>' +
          '</div>';
        overlay.appendChild(card);
        document.body.appendChild(overlay);
        var confirmBtn = document.getElementById(DIALOG_ID + '-confirm');
        var cancelBtn  = document.getElementById(DIALOG_ID + '-cancel');
        if (confirmBtn) confirmBtn.addEventListener('click', function () {
          try { overlay.parentNode.removeChild(overlay); } catch (_) {}
          resolve(true);
        });
        if (cancelBtn) cancelBtn.addEventListener('click', function () {
          try { overlay.parentNode.removeChild(overlay); } catch (_) {}
          resolve(false);
        });
      } catch (_) { resolve(false); }
    });
  }

  // Public API.
  window.AntcvFullErase = async function (opts) {
    opts = opts || {};
    if (!opts.skipConfirm) {
      var ok = await showConfirm();
      if (!ok) return { cancelled: true };
    }
    return fullErase(opts);
  };

  // Backstop: capture-phase click on .antcv-ai-delete buttons in case
  // the rescue/wizard patches don't have a handler bound (defensive).
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    for (var hops = 0; t && t !== document.body && hops < 4; hops++, t = t.parentElement) {
      if (!t.classList) continue;
      if (t.classList.contains('antcv-ai-delete') ||
          (t.getAttribute && t.getAttribute('data-antcv-delete-user') === '1')) {
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        window.AntcvFullErase().catch(function (e) {
          try { console.warn('[full-erase-290] erase failed:', e && e.message); } catch (_) {}
        });
        return;
      }
    }
  }, true);

  try { console.debug('[full-erase-290] installed v' + VERSION + ' — window.AntcvFullErase ready'); } catch (_) {}
})();
