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
  var VERSION = '1.50.332-data-import-lib';
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

  // ── restore a PLAIN envelope into localStorage ────────────────────────
  function restorePlain(env) {
    if (!env || env._antcvBackup !== 1) return { ok: false, error: 'Not an AntCV backup file.' };
    var raw = (env.dataRaw && typeof env.dataRaw === 'object') ? env.dataRaw : null;
    var data = (env.data && typeof env.data === 'object') ? env.data : null;
    if (!raw && !data) return { ok: false, error: 'Backup contains no data.' };
    var ls;
    try { ls = window.localStorage; } catch (_) { return { ok: false, error: 'localStorage unavailable.' }; }
    var count = 0, k;
    if (raw) {
      for (k in raw) { if (!Object.prototype.hasOwnProperty.call(raw, k)) continue; try { ls.setItem(k, String(raw[k])); count++; } catch (_) {} }
    } else {
      for (k in data) {
        if (!Object.prototype.hasOwnProperty.call(data, k)) continue;
        try { ls.setItem(k, JSON.stringify(data[k])); count++; } catch (_) {}
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
    return !!(obj && (obj._antcvBackup === 1 || obj._antcvBackupEncrypted === 1));
  };
  window.AntcvDataImport331 = { version: VERSION, _restorePlain: restorePlain, _decrypt: decryptEnvelope, _import: importData };
  try { console.debug('[data-import-331] installed ' + VERSION + ' (backup-restore library)'); } catch (_) {}
})();
