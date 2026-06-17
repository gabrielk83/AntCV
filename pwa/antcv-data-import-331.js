/* AntCV backup-restore LIBRARY (v1.50.332) — DATA-IMPORT-001
 * ============================================================
 * The restore half of the backup feature (export: antcv-data-export-360).
 * CONSOLIDATED (1.50.332): this no longer renders its own button. The single
 * import entry point is the floating 📥 importer (antcv-data-importer.js); when a
 * dropped .json is an AntcvBackup envelope it delegates here for a lossless
 * (and, if needed, decrypted) full restore. This file is a pure library exposing
 * window.AntcvDataImport.
 *
 * Backup envelope (antcv-data-export-360):
 *   plain:     { _antcvBackup:1, schema, data:{key:parsedJSON|string},
 *                dataRaw:{key:rawString} }   (dataRaw = lossless, schema ≥ 2)
 *   encrypted: { _antcvBackupEncrypted:1, kdf:'PBKDF2', hash:'SHA-256',
 *                iterations:250000, cipher:'AES-GCM', salt, iv, ciphertext } (b64)
 *
 * Restore: dataRaw (byte-for-byte) when present, else JSON.stringify(data[key]).
 *
 * API:
 *   window.AntcvDataImport(envelopeOrText, opts) -> Promise<{
 *       ok, restored, encrypted, cancelled, error }>
 *     opts = { passphrase?, confirm?:bool (default true), reload?:bool }
 */
(function () {
  'use strict';
  var VERSION = '1.50.566-userbound-append';
  if (window.__antcvDataImport331 === VERSION) return;
  window.__antcvDataImport331 = VERSION;

  // ── decrypt (mirror of the export's PBKDF2 → AES-GCM) ──────────────────
  function b64ToBuf(b64) {
    var bin = atob(String(b64 || ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  function decryptEnvelope(env, passphrase) {
    var subtle = window.crypto && window.crypto.subtle;
    if (!subtle) return Promise.reject(new Error('WebCrypto unavailable — cannot open an encrypted backup here.'));
    if (passphrase == null || passphrase === '') return Promise.reject(new Error('A passphrase is required to open this encrypted backup.'));
    var enc = new TextEncoder();
    var iterations = Number(env.iterations) || 250000;
    var hash = env.hash || 'SHA-256';
    return subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey'])
      .then(function (km) {
        return subtle.deriveKey(
          { name: 'PBKDF2', salt: b64ToBuf(env.salt), iterations: iterations, hash: hash },
          km, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
      })
      .then(function (key) {
        return subtle.decrypt({ name: 'AES-GCM', iv: b64ToBuf(env.iv) }, key, b64ToBuf(env.ciphertext));
      })
      .then(function (buf) {
        var inner = JSON.parse(new TextDecoder().decode(buf));
        if (!inner || inner._antcvBackup !== 1) throw new Error('Decrypted file is not an AntCV backup.');
        return inner;
      })
      .catch(function (e) {
        throw new Error(/not an AntCV/.test(String(e && e.message))
          ? e.message : 'Wrong passphrase, or the backup file is corrupt.');
      });
  }

  // ── SETTINGS-EXPORT-001: account-locked (user-bound) decrypt ──────────
  // Mirror of antcv-data-export-360's exportUserBound: fetch the per-account
  // key (GET /api/export-key, derived server-side from JWT_SECRET + the
  // signed-in email) and AES-GCM decrypt. A different account derives a
  // different key, so the auth tag fails — the file opens only for its owner.
  function proxyBase() {
    try {
      var v = JSON.parse(localStorage.getItem('proxyUrl') || '""') || '';
      if (!v) v = JSON.parse(localStorage.getItem('relayUrl') || '""') || '';
      v = String(v || '').replace(/\/+$/, '');
      if (!v && typeof window.ANTCV_RELAY_URL === 'string') v = String(window.ANTCV_RELAY_URL).replace(/\/+$/, '');
      return v;
    } catch (_) { return ''; }
  }
  function fetchExportKey() {
    var base = proxyBase();
    if (!base) return Promise.reject(new Error('Not connected — sign in so AntCV can fetch your account key.'));
    return fetch(base + '/api/export-key', { method: 'GET', credentials: 'include' })
      .then(function (r) {
        if (r.status === 401) throw new Error('Sign in first — an account-locked file opens only for its owner account.');
        if (!r.ok) throw new Error('Could not fetch the account key (HTTP ' + r.status + ').');
        return r.json();
      })
      .then(function (j) { if (!j || !j.ok || !j.key) throw new Error('Account key unavailable.'); return j; });
  }
  function decryptUserBound(env) {
    var subtle = window.crypto && window.crypto.subtle;
    if (!subtle) return Promise.reject(new Error('WebCrypto unavailable — cannot open an account-locked file here.'));
    return fetchExportKey().then(function (info) {
      if (env.owner && info.owner && String(env.owner) !== String(info.owner)) {
        throw new Error('This file is locked to a different AntCV account. Sign in as that account (or ask an admin) to open it.');
      }
      return subtle.importKey('raw', b64ToBuf(info.key), { name: 'AES-GCM' }, false, ['decrypt'])
        .then(function (key) { return subtle.decrypt({ name: 'AES-GCM', iv: b64ToBuf(env.iv) }, key, b64ToBuf(env.ciphertext)); })
        .then(function (buf) {
          var inner = JSON.parse(new TextDecoder().decode(buf));
          if (!inner || inner._antcvBackup !== 1) throw new Error('Decrypted file is not an AntCV backup.');
          return inner;
        })
        .catch(function (e) {
          if (/different AntCV account|not an AntCV/.test(String(e && e.message))) throw e;
          throw new Error('Could not open this account-locked file — it may belong to another account or be corrupt.');
        });
    });
  }

  // ── banned-list APPEND (owner 2026-06-17) ─────────────────────────────
  // On import, banned lists must be the UNION of current + imported, not a
  // blind overwrite. All banned data lives under personalInfo:
  //   stylePrefs.banned_words / banned_phrases  (comma-strings)
  //   stylePrefs.bannedContextual               (array of rules)
  //   writingPrefs.extraBannedWords/Phrases     ({ lang: [..] } buckets)
  function unionCsv(a, b) {
    var seen = {}, out = [];
    [a, b].forEach(function (s) {
      String(s || '').split(',').forEach(function (t) {
        var v = t.trim(); if (!v) return; var k = v.toLowerCase();
        if (!seen[k]) { seen[k] = 1; out.push(v); }
      });
    });
    return out.join(', ');
  }
  function unionArr(a, b, keyOf) {
    var seen = {}, out = [];
    [Array.isArray(a) ? a : [], Array.isArray(b) ? b : []].forEach(function (arr) {
      arr.forEach(function (item) {
        var k = keyOf(item); if (k == null) return; k = String(k).toLowerCase();
        if (!seen[k]) { seen[k] = 1; out.push(item); }
      });
    });
    return out;
  }
  function unionBucket(a, b) {
    var out = {}, langs = {};
    [a || {}, b || {}].forEach(function (m) { Object.keys(m || {}).forEach(function (l) { langs[l] = 1; }); });
    Object.keys(langs).forEach(function (l) {
      var seen = {}, list = [];
      [(a && a[l]) || [], (b && b[l]) || []].forEach(function (arr) {
        (Array.isArray(arr) ? arr : []).forEach(function (w) {
          var v = String(w || '').trim(); if (!v) return; var k = v.toLowerCase();
          if (!seen[k]) { seen[k] = 1; list.push(v); }
        });
      });
      out[l] = list;
    });
    return out;
  }
  // Given an incoming personalInfo (object), union the CURRENT account's banned
  // lists into it so import appends rather than discards them.
  function mergeBannedIntoPI(incomingPI) {
    var cur = {};
    try { cur = JSON.parse(localStorage.getItem('personalInfo') || '{}') || {}; } catch (_) { cur = {}; }
    var pi = incomingPI && typeof incomingPI === 'object' ? incomingPI : {};
    var cs = cur.stylePrefs || {}, is = pi.stylePrefs = pi.stylePrefs || {};
    is.banned_words = unionCsv(cs.banned_words, is.banned_words);
    is.banned_phrases = unionCsv(cs.banned_phrases, is.banned_phrases);
    is.bannedContextual = unionArr(cs.bannedContextual, is.bannedContextual, function (r) {
      return r && typeof r === 'object' ? ((r.avoid || r.pattern || '') + '|' + JSON.stringify(r.when || r.context || '')) : null;
    });
    var cw = cur.writingPrefs || {}, iw = pi.writingPrefs = pi.writingPrefs || {};
    iw.extraBannedWords = unionBucket(cw.extraBannedWords, iw.extraBannedWords);
    iw.extraBannedPhrases = unionBucket(cw.extraBannedPhrases, iw.extraBannedPhrases);
    return pi;
  }

  // ── restore a PLAIN envelope into localStorage ────────────────────────
  function restorePlain(env) {
    if (!env || env._antcvBackup !== 1) return { ok: false, error: 'Not an AntCV backup file.' };
    var raw = (env.dataRaw && typeof env.dataRaw === 'object') ? env.dataRaw : null;
    var data = (env.data && typeof env.data === 'object') ? env.data : null;
    if (!raw && !data) return { ok: false, error: 'Backup contains no data.' };
    var ls;
    try { ls = window.localStorage; } catch (_) { return { ok: false, error: 'localStorage unavailable.' }; }
    var count = 0, k;
    // APPEND banned lists rather than overwrite: merge the current account's
    // banned data into the incoming personalInfo before it lands.
    function valueFor(key, isRaw) {
      if (key === 'personalInfo') {
        var pi;
        try { pi = isRaw ? JSON.parse(String(raw[key])) : data[key]; } catch (_) { pi = isRaw ? null : data[key]; }
        if (pi && typeof pi === 'object') { try { return JSON.stringify(mergeBannedIntoPI(pi)); } catch (_) {} }
      }
      return isRaw ? String(raw[key]) : JSON.stringify(data[key]);
    }
    if (raw) {
      for (k in raw) { if (!Object.prototype.hasOwnProperty.call(raw, k)) continue; try { ls.setItem(k, valueFor(k, true)); count++; } catch (_) {} }
    } else {
      for (k in data) {
        if (!Object.prototype.hasOwnProperty.call(data, k)) continue;
        try { ls.setItem(k, valueFor(k, false)); count++; } catch (_) {}
      }
    }
    return { ok: true, restored: count };
  }

  // ── public entry: accept text or a parsed envelope ────────────────────
  function importData(input, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var env;
      try { env = (typeof input === 'string') ? JSON.parse(input) : input; }
      catch (_) { return resolve({ ok: false, error: 'File is not valid JSON.' }); }
      if (!env || typeof env !== 'object') return resolve({ ok: false, error: 'Empty or invalid backup file.' });

      var afterEnvelope = function (plainEnv, wasEncrypted) {
        if (opts.confirm !== false && typeof window.confirm === 'function') {
          var when = plainEnv.exportedAt ? (' from ' + String(plainEnv.exportedAt).slice(0, 10)) : '';
          if (!window.confirm('Restore this backup' + when + '?\n\nThis OVERWRITES your current AntCV data in this browser. There is no undo.')) {
            return resolve({ ok: false, cancelled: true });
          }
        }
        var r = restorePlain(plainEnv);
        r.encrypted = !!wasEncrypted;
        if (r.ok && opts.reload && typeof window.location !== 'undefined') {
          try { setTimeout(function () { window.location.reload(); }, 400); } catch (_) {}
        }
        resolve(r);
      };

      if (env._antcvBackupUserBound === 1) {
        decryptUserBound(env)
          .then(function (inner) { afterEnvelope(inner, true); })
          .catch(function (e) { resolve({ ok: false, encrypted: true, userBound: true, error: (e && e.message) || 'Could not open account-locked file.' }); });
        return;
      }
      if (env._antcvBackupEncrypted === 1) {
        decryptEnvelope(env, opts.passphrase)
          .then(function (inner) { afterEnvelope(inner, true); })
          .catch(function (e) { resolve({ ok: false, encrypted: true, error: (e && e.message) || 'Could not open encrypted backup.' }); });
        return;
      }
      if (env._antcvBackup === 1) { afterEnvelope(env, false); return; }
      resolve({ ok: false, error: 'Not an AntCV backup file (missing _antcvBackup marker).' });
    });
  }

  window.AntcvDataImport = importData;
  // also expose a quick predicate so the floating importer can detect a backup
  window.AntcvIsBackupEnvelope = function (obj) {
    return !!(obj && (obj._antcvBackup === 1 || obj._antcvBackupEncrypted === 1 || obj._antcvBackupUserBound === 1));
  };
  window.AntcvDataImport331 = { version: VERSION, _restorePlain: restorePlain, _decrypt: decryptEnvelope, _import: importData };
  try { console.debug('[data-import-331] installed ' + VERSION + ' (backup-restore library)'); } catch (_) {}
})();
