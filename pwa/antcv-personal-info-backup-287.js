/* AntCV personalInfo rolling backup + recovery (v1.40.287)
 * ──────────────────────────────────────────────────────────────────────
 *
 * Problem
 * ───────
 *   2026-05-21 incident: after a kernel-showcase crash and reload, the
 *   cloud's personalInfo had shrunk from 36 fields to 4 (the only ones
 *   left are the auth boilerplate: aiDisclosureAccepted,
 *   aiDisclosure, disclosureAccepted, email). The log shows the
 *   substantive fields (name, headline, location, citizenship, phone,
 *   linkedin, background, publications, experience, workStyle, …)
 *   were present in session 1 but lost between session 1's last PUT
 *   and session 2's GET. Either:
 *     (a) the last PUT happened to fire after app.js had momentarily
 *         wiped personalInfo in memory and pushed an empty value
 *         back, or
 *     (b) the relay didn't persist the substantive fields for some
 *         other reason.
 *
 *   Either way, the user is left without their data and the local
 *   storage now mirrors the same wiped state.
 *
 * Protection (in this patch)
 * ──────────────────────────
 *   1. Maintain a rolling set of localStorage backups under keys
 *        antcv:personalInfo:backup:0..4
 *      Each backup is { ts, n, data } where n is the count of
 *      substantive fields (i.e. fields beyond auth boilerplate). The
 *      newest substantive personalInfo is always saved; oldest slot is
 *      overwritten when 5 backups already exist.
 *
 *   2. Detect "wipe-on-load" state on each page load. After a short
 *      delay (so cloud-restore / il() have time to run), inspect
 *      localStorage.personalInfo:
 *        - If its substantive-field count is < 5 AND
 *        - At least one backup has >= 5 substantive fields AND
 *        - The newest such backup is < 7 days old
 *      then show a fixed-position recovery banner letting the user
 *      restore from any of the most recent 3 backups.
 *
 *   3. The recovery banner preserves whatever auth fields exist in
 *      the wiped state (aiDisclosureAccepted, email, etc.) and merges
 *      the substantive fields from the backup on top. It then fires a
 *      storage event and reloads so React rehydrates cleanly.
 *
 * Backup write triggers (belt-and-braces)
 * ───────────────────────────────────────
 *   - Hook localStorage.setItem to back up the OLD substantive value
 *     just before any write to `personalInfo`. This catches the
 *     moment of a wipe.
 *   - Listen for `antcv:personal-info-restored` and `storage` events.
 *   - Periodic poll every 5 seconds — defensive, in case a write
 *     bypasses our hook (e.g. via a different storage wrapper).
 *
 * Safe-by-default
 * ───────────────
 *   - We don't BLOCK writes — only mirror them. This patch never
 *     prevents app.js from saving (which would risk other breakage).
 *   - The recovery banner is opt-in. The user must click to restore.
 *   - The banner is suppressed once per session via sessionStorage so
 *     it doesn't re-appear after dismissal.
 *
 * The cloud-write protection (preventing shrunken PUTs from reaching
 * the relay) is in a SEPARATE sidecar (v1.40.288) — see that file's
 * docblock. They cooperate but each is self-contained.
 */
(function () {
  'use strict';
  var VERSION = '1.40.287';
  if (window.__antcvPersonalInfoBackup287 === VERSION) return;
  window.__antcvPersonalInfoBackup287 = VERSION;

  var KEY = 'personalInfo';
  var BACKUP_PREFIX = 'antcv:personalInfo:backup:';
  var BACKUP_INDEX_KEY = 'antcv:personalInfo:backup:index';   // last-written slot
  var MAX_BACKUPS = 5;
  var MIN_SUBSTANTIVE = 5;
  var SESSION_DISMISS_KEY = 'antcv:pi-recovery-banner-dismissed-287';
  var STALE_BACKUP_MS = 7 * 24 * 60 * 60 * 1000;   // 7 days

  // Fields we ignore when counting "substantive" content. These are
  // either auth boilerplate or always-present app metadata.
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

  function readCurrent() {
    try { return safeParse(window.localStorage.getItem(KEY)); }
    catch (_) { return null; }
  }

  function listBackups() {
    var out = [];
    for (var i = 0; i < MAX_BACKUPS; i++) {
      try {
        var raw = window.localStorage.getItem(BACKUP_PREFIX + i);
        if (!raw) continue;
        var obj = safeParse(raw);
        if (!obj || !obj.data) continue;
        out.push({
          idx: i,
          ts: obj.ts || 0,
          n: obj.n || countSubstantive(obj.data),
          data: obj.data,
        });
      } catch (_) {}
    }
    out.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });   // newest first
    return out;
  }

  function nextSlot() {
    // Read all slots, pick the EMPTIEST (or oldest) one for overwrite.
    var slots = [];
    for (var i = 0; i < MAX_BACKUPS; i++) {
      try {
        var raw = window.localStorage.getItem(BACKUP_PREFIX + i);
        if (!raw) { slots.push({ idx: i, ts: 0 }); continue; }
        var obj = safeParse(raw);
        slots.push({ idx: i, ts: (obj && obj.ts) || 0 });
      } catch (_) { slots.push({ idx: i, ts: 0 }); }
    }
    slots.sort(function (a, b) { return a.ts - b.ts; });   // oldest first
    return slots[0].idx;
  }

  function backupIfSubstantive(pi, reason) {
    if (!pi) return false;
    var n = countSubstantive(pi);
    if (n < MIN_SUBSTANTIVE) return false;
    // Don't double-write identical content.
    var existing = listBackups();
    if (existing.length && existing[0].n === n) {
      try {
        if (JSON.stringify(existing[0].data) === JSON.stringify(pi)) return false;
      } catch (_) {}
    }
    var slot = nextSlot();
    try {
      window.localStorage.setItem(BACKUP_PREFIX + slot, JSON.stringify({
        ts: Date.now(),
        n: n,
        reason: String(reason || ''),
        data: pi,
      }));
      try { window.localStorage.setItem(BACKUP_INDEX_KEY, String(slot)); } catch (_) {}
      try { console.debug('[pi-backup-287] saved backup slot=' + slot + ' n=' + n + ' reason=' + reason); } catch (_) {}
      return true;
    } catch (e) {
      try { console.warn('[pi-backup-287] save failed:', e && e.message); } catch (_) {}
      return false;
    }
  }

  function dismissed() {
    try { return window.sessionStorage.getItem(SESSION_DISMISS_KEY) === '1'; }
    catch (_) { return false; }
  }
  function markDismissed() {
    try { window.sessionStorage.setItem(SESSION_DISMISS_KEY, '1'); } catch (_) {}
  }

  // ── recovery banner ───────────────────────────────────────────────
  function showRecoveryBanner(backups) {
    if (dismissed()) return;
    if (document.getElementById('antcv-pi-recovery-287')) return;

    var current = readCurrent() || {};
    var currentN = countSubstantive(current);

    try {
      var panel = document.createElement('div');
      panel.id = 'antcv-pi-recovery-287';
      panel.style.cssText = [
        'position:fixed', 'left:12px', 'right:12px',
        'bottom:max(12px, env(safe-area-inset-bottom, 0px) + 8px)',
        'z-index:2147483645',
        'background:#1d2738', 'color:#fff',
        'border:1px solid #01B7BB', 'border-radius:10px',
        'box-shadow:0 8px 32px rgba(0,0,0,0.5)',
        'padding:14px 16px', 'font-family:system-ui,sans-serif',
        'max-width:560px', 'margin:0 auto',
        'font-size:14px', 'line-height:1.4'
      ].join(';');

      var head =
        '<div style="font-weight:700;color:#FFD27A;margin-bottom:8px;">' +
          '💾 personalInfo looks wiped — local backup available' +
        '</div>' +
        '<div style="margin-bottom:10px;color:#cfdbe7;font-size:13px;">' +
          'Current personalInfo has only <b>' + currentN + '</b> substantive field' + (currentN === 1 ? '' : 's') + '. ' +
          backups.length + ' local backup' + (backups.length === 1 ? '' : 's') + ' found. Choose a version to restore — your email and auth flags are preserved either way:' +
        '</div>';

      var buttons = '';
      backups.slice(0, 3).forEach(function (b) {
        var ageMin = Math.max(1, Math.round((Date.now() - b.ts) / 60000));
        var ageStr;
        if (ageMin < 60) ageStr = ageMin + ' min ago';
        else if (ageMin < 24 * 60) ageStr = Math.round(ageMin / 60) + 'h ago';
        else ageStr = Math.round(ageMin / 60 / 24) + 'd ago';
        buttons +=
          '<button data-backup-idx="' + b.idx + '" style="' +
            'display:block;width:100%;background:#01B7BB;color:#fff;border:none;border-radius:6px;' +
            'padding:10px 14px;font-weight:700;font-size:13px;cursor:pointer;margin-bottom:6px;text-align:left;">' +
            'Restore ' + b.n + ' fields (' + ageStr + ')' +
          '</button>';
      });

      var foot =
        '<button id="antcv-pi-recovery-287-dismiss" style="' +
          'background:transparent;color:#8a98ad;border:1px solid #8a98ad;' +
          'border-radius:6px;padding:7px 12px;font-weight:600;font-size:12px;cursor:pointer;width:100%;">' +
          'Dismiss for this session' +
        '</button>' +
        '<div style="margin-top:8px;font-size:11px;color:#8a98ad;">' +
          'Backups live in your browser localStorage and survive page reloads, but not browser-data clearing or incognito sessions.' +
        '</div>';

      panel.innerHTML = head + buttons + foot;
      document.body.appendChild(panel);

      panel.querySelectorAll('[data-backup-idx]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var idx = parseInt(btn.getAttribute('data-backup-idx'), 10);
          var target;
          for (var i = 0; i < backups.length; i++) {
            if (backups[i].idx === idx) { target = backups[i]; break; }
          }
          if (!target) return;
          try {
            var cur = readCurrent() || {};
            var merged = JSON.parse(JSON.stringify(target.data));
            // Preserve current auth fields.
            for (var ak in AUTH_FIELDS) {
              if (cur[ak] !== undefined && cur[ak] !== null && cur[ak] !== '') {
                merged[ak] = cur[ak];
              }
            }
            window.localStorage.setItem(KEY, JSON.stringify(merged));
            try {
              window.dispatchEvent(new StorageEvent('storage', {
                key: KEY, newValue: JSON.stringify(merged),
                storageArea: window.localStorage,
              }));
            } catch (_) {}
            try {
              window.dispatchEvent(new CustomEvent('antcv:personal-info-restored', {
                detail: { source: 'pi-backup-banner-287', backupIdx: idx, n: target.n },
              }));
            } catch (_) {}
            try { panel.parentNode.removeChild(panel); } catch (_) {}
            // Force reload — React state needs to re-initialise to pick
            // up the restored fields in form inputs.
            setTimeout(function () { try { location.reload(); } catch (_) {} }, 250);
          } catch (e) {
            try { console.warn('[pi-backup-287] restore failed:', e && e.message); } catch (_) {}
          }
        });
      });

      var dis = document.getElementById('antcv-pi-recovery-287-dismiss');
      if (dis) dis.addEventListener('click', function () {
        markDismissed();
        try { panel.parentNode.removeChild(panel); } catch (_) {}
      });
    } catch (e) {
      try { console.warn('[pi-backup-287] banner build failed:', e && e.message); } catch (_) {}
    }
  }

  function checkRecovery() {
    if (dismissed()) return;
    var current = readCurrent();
    var currentN = countSubstantive(current);
    if (currentN >= MIN_SUBSTANTIVE) return;
    var backups = listBackups();
    if (!backups.length) return;
    // Filter to backups that actually have content and aren't stale.
    var usable = backups.filter(function (b) {
      if (b.n < MIN_SUBSTANTIVE) return false;
      if (b.ts && (Date.now() - b.ts) > STALE_BACKUP_MS) return false;
      return true;
    });
    if (!usable.length) return;
    showRecoveryBanner(usable);
  }

  // ── setItem hook ──────────────────────────────────────────────────
  // Hook BEFORE the write so we can capture the OLD substantive value.
  // We wrap Storage.prototype.setItem (same pattern as shape-guard) so
  // all localStorage and sessionStorage setItem calls funnel through.
  // We filter by key === 'personalInfo' below to keep the work minimal.
  try {
    var proto = (typeof Storage !== 'undefined' && Storage.prototype)
      ? Storage.prototype
      : Object.getPrototypeOf(window.localStorage);
    var origSetItem = proto.setItem;
    var hooked = function (k, v) {
      if (k === KEY) {
        try {
          var oldRaw = origSetItem === proto.setItem ? null : null;
          try { oldRaw = window.localStorage.getItem(k); } catch (_) {}
          var oldPi = safeParse(oldRaw);
          var oldN = countSubstantive(oldPi);
          var newPi = safeParse(v);
          var newN = countSubstantive(newPi);
          if (oldN >= MIN_SUBSTANTIVE && newN < oldN) {
            backupIfSubstantive(oldPi, 'pre-shrink-write (' + oldN + '->' + newN + ')');
          } else if (newN >= MIN_SUBSTANTIVE) {
            backupIfSubstantive(newPi, 'healthy-write n=' + newN);
          }
        } catch (_) {}
      }
      return origSetItem.call(this, k, v);
    };
    proto.setItem = hooked;
  } catch (_) {}

  // ── polling safety net ────────────────────────────────────────────
  var lastSeen = null;
  function poll() {
    try {
      var cur = readCurrent();
      var n = countSubstantive(cur);
      if (n >= MIN_SUBSTANTIVE) {
        var serialized = '';
        try { serialized = JSON.stringify(cur); } catch (_) {}
        if (serialized && serialized !== lastSeen) {
          lastSeen = serialized;
          backupIfSubstantive(cur, 'poll');
        }
      }
    } catch (_) {}
  }
  setInterval(poll, 5000);

  // ── triggers ──────────────────────────────────────────────────────
  window.addEventListener('antcv:personal-info-restored', function () {
    setTimeout(poll, 100);
  });
  window.addEventListener('storage', function (ev) {
    if (ev && ev.key === KEY) setTimeout(poll, 100);
  });

  // Initial backup + recovery check.
  function init() {
    poll();
    setTimeout(checkRecovery, 3500);    // wait for cloud-restore + il()
    setTimeout(checkRecovery, 7000);    // and a second pass after slower paths
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    setTimeout(init, 0);
  }

  window.AntcvPersonalInfoBackup287 = {
    version: VERSION,
    _listBackups: listBackups,
    _backupNow: function () { return backupIfSubstantive(readCurrent(), 'manual'); },
    _showRecovery: function () {
      try { window.sessionStorage.removeItem(SESSION_DISMISS_KEY); } catch (_) {}
      checkRecovery();
    },
    _countSubstantive: countSubstantive,
    _readCurrent: readCurrent,
  };

  try { console.debug('[pi-backup-287] installed v' + VERSION); } catch (_) {}
})();
