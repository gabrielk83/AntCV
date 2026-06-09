/* AntCV data IMPORT / restore (v1.50.331) — DATA-IMPORT-001
 * ============================================================
 * The counterpart to FT-DATA-EXPORT (antcv-data-export-360). Restores a backup
 * file produced by "⬇ Download my data" back into localStorage.
 *
 * Backup envelope (antcv-data-export-360):
 *   plain:     { _antcvBackup:1, schema, data:{key:parsedJSON|string},
 *                dataRaw:{key:rawString} }   (dataRaw added schema 2 — lossless)
 *   encrypted: { _antcvBackupEncrypted:1, kdf:'PBKDF2', hash:'SHA-256',
 *                iterations:250000, cipher:'AES-GCM', salt, iv, ciphertext }
 *                (base64; decrypts to the plain envelope JSON)
 *
 * Restore strategy (lossless-first):
 *   - dataRaw present  → setItem(key, rawString) byte-for-byte (schema ≥ 2).
 *   - else `data`      → setItem(key, JSON.stringify(value)) — correct for every
 *                        key the app stores via its JSON localStorage wrapper
 *                        (the overwhelming majority); legacy plain backups.
 *
 * Public API (also used by the headless round-trip test):
 *   window.AntcvDataImport(envelopeOrText, opts) -> Promise<{
 *       ok, restored, encrypted, cancelled, error }>
 *     opts = { passphrase?, confirm?:bool (default true for UI; pass false to
 *              skip the overwrite confirm), reload?:bool (default false) }
 *
 * Safety: never auto-runs; only a user file-pick (with an overwrite confirm) or
 * an explicit API call writes anything. Escape hatch:
 *   localStorage['antcv:disable-data-import'] = '1'  → no UI.
 */
(function () {
  'use strict';
  var VERSION = '1.50.331-data-import';
  if (window.__antcvDataImport331 === VERSION) return;
  window.__antcvDataImport331 = VERSION;

  var DISABLE_KEY = 'antcv:disable-data-import';
  var UI_MARK = 'data-antcv-data-import-ui';

  function disabled() { try { var v = localStorage.getItem(DISABLE_KEY); return v === '1' || v === 'true'; } catch (_) { return false; } }

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
        var text = new TextDecoder().decode(buf);
        var inner = JSON.parse(text);
        if (!inner || inner._antcvBackup !== 1) throw new Error('Decrypted file is not an AntCV backup.');
        return inner;
      })
      .catch(function (e) {
        // AES-GCM auth failure → wrong passphrase / corrupt file.
        throw new Error(/operation|decrypt|auth|tag/i.test(String(e && e.message)) && !/not an AntCV/.test(String(e && e.message))
          ? 'Wrong passphrase, or the backup file is corrupt.' : (e && e.message) || 'Decryption failed.');
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
        var v = data[k];
        try { ls.setItem(k, typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v)); count++; } catch (_) {}
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
        // Overwrite confirm (UI path); programmatic callers pass confirm:false.
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

  // ── UI: a "⬆ Restore my data" button next to "⬇ Download my data" ──────
  function findDownloadButton() {
    var btns = document.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      if (/download my data/i.test(btns[i].textContent || '')) return btns[i];
    }
    return null;
  }
  function pickFileThenImport(btn) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    input.addEventListener('change', function () {
      var f = input.files && input.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        var text = String(reader.result || '');
        var env;
        try { env = JSON.parse(text); } catch (_) { setStatus(btn, '✗ Not a valid backup file', 3000); return; }
        var pass;
        if (env && env._antcvBackupEncrypted === 1) {
          try { pass = window.prompt('This backup is encrypted. Enter its passphrase:'); } catch (_) { pass = null; }
          if (pass == null) { setStatus(btn, 'Restore cancelled', 1800); return; }
        }
        setStatus(btn, '⬆ Restoring…', 0);
        importData(env, { passphrase: pass, confirm: true, reload: true }).then(function (r) {
          if (r.cancelled) { setStatus(btn, 'Restore cancelled', 1800); return; }
          setStatus(btn, r.ok ? ('✓ Restored ' + r.restored + ' items — reloading…') : ('✗ ' + (r.error || 'Restore failed')), r.ok ? 0 : 4000);
        });
      };
      reader.onerror = function () { setStatus(btn, '✗ Could not read the file', 3000); };
      reader.readAsText(f);
    });
    (document.body || document.documentElement).appendChild(input);
    input.click();
    setTimeout(function () { try { input.remove(); } catch (_) {} }, 0);
  }
  var _label = '⬆ Restore from backup';
  function setStatus(btn, msg, revertMs) {
    if (!btn) return;
    btn.textContent = msg;
    if (revertMs) setTimeout(function () { btn.textContent = _label; btn.disabled = false; }, revertMs);
  }
  function buildButton() {
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute(UI_MARK, 'restore');
    b.textContent = _label;
    b.style.cssText = 'display:block;width:100%;margin:0 0 8px;padding:12px;' +
      'background:rgba(120,200,140,0.12);border:1px solid rgba(120,200,140,0.5);' +
      'color:#bfe9c8;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;';
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); pickFileThenImport(b); });
    return b;
  }
  function injectUI() {
    if (disabled()) return;
    if (document.querySelector('[' + UI_MARK + '="restore"]')) return;
    var dl = findDownloadButton();
    if (!dl || !dl.parentNode) return;
    var btn = buildButton();
    dl.parentNode.insertBefore(btn, dl.nextSibling);
  }

  var pending = false;
  function schedule() { if (pending) return; pending = true; requestAnimationFrame(function () { pending = false; try { injectUI(); } catch (_) {} }); }
  function start() {
    schedule(); [300, 800, 1800, 3500].forEach(function (ms) { setTimeout(schedule, ms); });
    try { new MutationObserver(schedule).observe(document.body || document.documentElement, { childList: true, subtree: true }); } catch (_) {}
    window.addEventListener('antcv:sections-updated', schedule);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();

  window.AntcvDataImport331 = { version: VERSION, _restorePlain: restorePlain, _decrypt: decryptEnvelope, run: schedule };
  try { console.debug('[data-import-331] installed ' + VERSION); } catch (_) {}
})();
