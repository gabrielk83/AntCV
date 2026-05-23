/* AntCV cloud-PUT personalInfo shrink WARN (v1.40.288)
 * ──────────────────────────────────────────────────────────────────────
 *
 * Behaviour update (2026-05-21 user feedback)
 * ───────────────────────────────────────────
 *   Gabriel: "if the user himself updates the fields to have
 *   shrunken data — the storage should accept it (maybe with a
 *   warning for data removal)".
 *
 *   Previous behaviour: catastrophic-shrink PUTs were REWRITTEN with
 *   backup content. That's too aggressive — an intentional wipe
 *   (e.g. user clearing fields to anonymise their profile) was
 *   silently undone.
 *
 *   New behaviour: NEVER rewrite the PUT body. Just observe. When a
 *   catastrophic shrink is detected:
 *     - Log a console.warn with the diff.
 *     - Show a one-time-per-session toast telling the user the cloud
 *       was overwritten and that the local backup is preserved.
 *     - The PUT goes through to the relay unchanged.
 *
 *   Recovery from accidental wipes still works via patch 287's
 *   on-load recovery banner.
 */
(function () {
  'use strict';
  var VERSION = '1.40.288-warn';
  if (window.__antcvCloudPutShrinkGuard288 === VERSION) return;
  window.__antcvCloudPutShrinkGuard288 = VERSION;

  var KEY = 'personalInfo';
  var BACKUP_PREFIX = 'antcv:personalInfo:backup:';
  var MAX_BACKUPS = 5;
  var SESSION_TOAST_KEY = 'antcv:shrink-warn-toast-shown-288';
  var TOAST_ID = 'antcv-cloud-shrink-warn-288';
  var TOAST_TIMEOUT_MS = 20000;
  var UNDO_KEY = 'antcv:personalInfo:undo-288';

  var AUTH_FIELDS = {
    aiDisclosureAccepted: true,
    aiDisclosure: true,
    disclosureAccepted: true,
    email: true,
    _comments: true,
  };

  function safeParse(s) {
    if (s === null || s === undefined) return null;
    try { return typeof s === 'string' ? JSON.parse(s) : s; }
    catch (_) { return null; }
  }
  function countSubstantive(pi) {
    if (!pi || typeof pi !== 'object' || Array.isArray(pi)) return 0;
    var n = 0;
    for (var k in pi) {
      if (!Object.prototype.hasOwnProperty.call(pi, k)) continue;
      if (AUTH_FIELDS[k]) continue;
      var v = pi[k];
      if (v === null || v === undefined || v === '') continue;
      if (Array.isArray(v) && v.length === 0) continue;
      if (typeof v === 'object') {
        var any = false;
        for (var kk in v) { if (Object.prototype.hasOwnProperty.call(v, kk)) { any = true; break; } }
        if (!any) continue;
      }
      n++;
    }
    return n;
  }
  function newestBackup() {
    var best = null;
    for (var i = 0; i < MAX_BACKUPS; i++) {
      try {
        var raw = window.localStorage.getItem(BACKUP_PREFIX + i);
        if (!raw) continue;
        var obj = safeParse(raw);
        if (!obj || !obj.data) continue;
        var n = obj.n || countSubstantive(obj.data);
        if (n < 5) continue;
        if (!best || (obj.ts || 0) > (best.ts || 0)) {
          best = { ts: obj.ts || 0, n: n, data: obj.data };
        }
      } catch (_) {}
    }
    return best;
  }

  function isPrefsPut(url, init) {
    if (!init || init.method !== 'PUT') return false;
    var u = '';
    try { u = (typeof url === 'string') ? url : (url && url.url) || ''; }
    catch (_) {}
    return /\/api\/prefs(\?|$|\/)/.test(String(u));
  }

  function toastShown() {
    try { return window.sessionStorage.getItem(SESSION_TOAST_KEY) === '1'; }
    catch (_) { return false; }
  }
  function markToastShown() {
    try { window.sessionStorage.setItem(SESSION_TOAST_KEY, '1'); } catch (_) {}
  }

  function showToast(backupN, newN, backupData) {
    if (toastShown()) return;
    markToastShown();
    if (document.getElementById(TOAST_ID)) return;
    // Stash the about-to-be-overwritten data for the Undo button.
    try {
      window.localStorage.setItem(UNDO_KEY, JSON.stringify({
        ts: Date.now(), n: backupN, data: backupData,
      }));
    } catch (_) {}
    try {
      var toast = document.createElement('div');
      toast.id = TOAST_ID;
      toast.style.cssText = [
        'position:fixed', 'left:12px', 'right:12px',
        'bottom:max(12px, env(safe-area-inset-bottom, 0px) + 8px)',
        'z-index:2147483644',
        'background:#1d2738', 'color:#fff',
        'border:1px solid #FFD27A', 'border-radius:10px',
        'box-shadow:0 8px 24px rgba(0,0,0,0.45)',
        'padding:12px 14px', 'font-family:system-ui,sans-serif',
        'max-width:560px', 'margin:0 auto',
        'font-size:13px', 'line-height:1.45'
      ].join(';');
      toast.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:start;gap:10px;margin-bottom:10px;">' +
          '<div style="flex:1;">' +
            '<div style="font-weight:700;color:#FFD27A;margin-bottom:4px;">' +
              '⚠ Cloud personalInfo overwritten' +
            '</div>' +
            '<div style="color:#cfdbe7;font-size:12px;">' +
              'Wrote <b>' + newN + '</b> field' + (newN === 1 ? '' : 's') +
              ' to cloud (last healthy backup had ' + backupN + '). ' +
              'Tap Undo within 20 seconds if this was not intentional.' +
            '</div>' +
          '</div>' +
          '<button id="' + TOAST_ID + '-close" style="' +
            'background:transparent;color:#8a98ad;border:none;font-size:18px;line-height:1;cursor:pointer;padding:2px 6px;">×</button>' +
        '</div>' +
        '<div style="display:flex;gap:8px;">' +
          '<button id="' + TOAST_ID + '-undo" style="' +
            'flex:1;background:#01B7BB;color:#fff;border:none;border-radius:6px;' +
            'padding:8px 14px;font-weight:700;font-size:13px;cursor:pointer;">' +
            '↶ Undo (restore ' + backupN + ' fields)' +
          '</button>' +
        '</div>';
      document.body.appendChild(toast);
      var btn = document.getElementById(TOAST_ID + '-close');
      if (btn) btn.addEventListener('click', function () {
        try { toast.parentNode.removeChild(toast); } catch (_) {}
      });
      var undoBtn = document.getElementById(TOAST_ID + '-undo');
      if (undoBtn) undoBtn.addEventListener('click', function () {
        try { toast.parentNode.removeChild(toast); } catch (_) {}
        performUndo();
      });
      setTimeout(function () {
        try { toast.parentNode && toast.parentNode.removeChild(toast); } catch (_) {}
      }, TOAST_TIMEOUT_MS);
    } catch (_) {}
  }

  // ── Undo flow ─────────────────────────────────────────────────────
  function relayUrlFromLocal() {
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
  function performUndo() {
    var undo;
    try { undo = safeParse(window.localStorage.getItem(UNDO_KEY)); }
    catch (_) {}
    if (!undo || !undo.data) {
      try { console.warn('[cloud-put-shrink-guard-288] no undo blob found'); } catch (_) {}
      return;
    }
    // Restore locally first. Preserve current auth fields.
    var cur = safeParse(window.localStorage.getItem(KEY)) || {};
    var restored = {};
    for (var k in undo.data) {
      if (Object.prototype.hasOwnProperty.call(undo.data, k)) restored[k] = undo.data[k];
    }
    for (var ak in AUTH_FIELDS) {
      if (cur[ak] !== undefined && cur[ak] !== null && cur[ak] !== '') restored[ak] = cur[ak];
    }
    try { window.localStorage.setItem(KEY, JSON.stringify(restored)); } catch (_) {}
    try {
      window.dispatchEvent(new StorageEvent('storage', {
        key: KEY, newValue: JSON.stringify(restored), storageArea: window.localStorage,
      }));
    } catch (_) {}
    try {
      window.dispatchEvent(new CustomEvent('antcv:personal-info-restored', {
        detail: { source: 'undo-288', n: countSubstantive(restored) },
      }));
    } catch (_) {}
    // Reset session toast flag so a future shrink would still warn.
    try { window.sessionStorage.removeItem(SESSION_TOAST_KEY); } catch (_) {}
    // Re-PUT to cloud (this PUT bypasses our own observer via a marker).
    var relay = relayUrlFromLocal();
    if (relay) {
      try {
        var body = JSON.stringify({ personalInfo: restored });
        var headers = { 'Content-Type': 'application/json' };
        var auth = authHeader();
        if (auth) headers.Authorization = auth;
        window.__antcvShrinkGuardInternalPut = true;
        origFetch.call(window, relay + '/api/prefs', { method: 'PUT', headers: headers, body: body })
          .then(function () { window.__antcvShrinkGuardInternalPut = false; showUndoConfirmToast(restored, false); })
          .catch(function (e) {
            window.__antcvShrinkGuardInternalPut = false;
            try { console.warn('[cloud-put-shrink-guard-288] undo PUT failed:', e && e.message); } catch (_) {}
            showUndoConfirmToast(restored, true);
          });
      } catch (e) {
        window.__antcvShrinkGuardInternalPut = false;
        try { console.warn('[cloud-put-shrink-guard-288] undo PUT exception:', e && e.message); } catch (_) {}
        showUndoConfirmToast(restored, true);
      }
    } else {
      showUndoConfirmToast(restored, true);
    }
  }
  function showUndoConfirmToast(restored, localOnly) {
    try {
      var t = document.createElement('div');
      t.style.cssText = [
        'position:fixed', 'left:12px', 'right:12px',
        'bottom:max(12px, env(safe-area-inset-bottom, 0px) + 8px)',
        'z-index:2147483644',
        'background:#0f4438', 'color:#fff',
        'border:1px solid #01B7BB', 'border-radius:10px',
        'box-shadow:0 8px 24px rgba(0,0,0,0.45)',
        'padding:11px 14px', 'font-family:system-ui,sans-serif',
        'max-width:560px', 'margin:0 auto', 'font-size:13px', 'line-height:1.45'
      ].join(';');
      t.innerHTML =
        '<div style="font-weight:700;color:#7effd4;margin-bottom:4px;">' +
          '✓ Restored ' + countSubstantive(restored) + ' fields' +
          (localOnly ? ' (local only)' : ' to local + cloud') +
        '</div>' +
        '<div style="color:#cfdbe7;font-size:12px;">' +
          'Reload may be needed for form inputs to repopulate.' +
        '</div>';
      document.body.appendChild(t);
      setTimeout(function () { try { t.parentNode && t.parentNode.removeChild(t); } catch (_) {} }, 6000);
    } catch (_) {}
  }

  function catastrophicShrink(parsedBody) {
    if (!parsedBody || typeof parsedBody !== 'object') return null;
    if (!Object.prototype.hasOwnProperty.call(parsedBody, KEY)) return null;
    var newN = countSubstantive(parsedBody[KEY]);
    var backup = newestBackup();
    if (!backup) return null;
    if ((backup.n >= 5 && newN === 0) || (backup.n >= 8 && newN < backup.n / 2)) {
      return { backupN: backup.n, newN: newN, backupData: backup.data };
    }
    return null;
  }

  // Wrap fetch. NEVER rewrites the body — only observes + warns.
  var origFetch = window.fetch;
  if (typeof origFetch !== 'function') return;

  window.fetch = function (url, init) {
    try {
      // Skip observation for our own internal undo PUT so we don't
      // re-toast on our own writes.
      if (!window.__antcvShrinkGuardInternalPut &&
          init && isPrefsPut(url, init) && init.body) {
        var bodyStr = (typeof init.body === 'string') ? init.body : null;
        if (bodyStr) {
          var parsed = safeParse(bodyStr);
          if (parsed && typeof parsed === 'object' && parsed[KEY] !== undefined) {
            var hit = catastrophicShrink(parsed);
            if (hit) {
              try {
                console.warn('[cloud-put-shrink-guard-288] catastrophic shrink observed (allowed): ' +
                  'backup=' + hit.backupN + ' fields -> PUT=' + hit.newN + ' fields.');
              } catch (_) {}
              showToast(hit.backupN, hit.newN, hit.backupData);
            }
          }
        }
      }
    } catch (e) {
      try { console.warn('[cloud-put-shrink-guard-288] observe error:', e && e.message); } catch (_) {}
    }
    return origFetch.call(this, url, init);
  };

  window.AntcvCloudPutShrinkGuard288 = {
    version: VERSION,
    mode: 'observe+undo',
    _catastrophicShrink: catastrophicShrink,
    _showToast: showToast,
    _performUndo: performUndo,
    _newestBackup: newestBackup,
    _countSubstantive: countSubstantive,
  };

  try { console.debug('[cloud-put-shrink-guard-288] installed v' + VERSION + ' (observe + undo mode)'); } catch (_) {}
})();
