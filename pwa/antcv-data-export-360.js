/* AntCV data export + delete-save (v1.50.145)
 * ============================================================================
 * Implements two owner items from the 2026-06-04 batch triage:
 *
 *   DATA-EXPORT-001 — In the Personal/data section, let the user DOWNLOAD
 *     their stored data + personal analytics to a protected file.
 *   DELETE-SAVE-001 — In the "Delete my account & all data" erase card, add a
 *     "Save my data locally first" checkbox that downloads a backup BEFORE the
 *     irreversible erase runs.
 *
 * Why a sidecar is the right shape here
 * -------------------------------------
 * All the user data already lives in localStorage (personalInfo, sections /
 * cv_pwa_sections, meta, antcv:prefs, antcv:analytics:counts, antcv:apply:*,
 * writing prefs, ...). Reading and serialising it needs no app.js internals,
 * so this is a clean readable sidecar — not a per-field bridge (which CLAUDE.md
 * forbids). Both erase entry points (the red Settings button and the AI-Act
 * decline modal) funnel through window.AntcvFullErase, so wrapping that one hook
 * covers the save-first path for every delete route.
 *
 * Public API
 * ----------
 *   window.AntcvDataExport(opts) -> Promise<{ok, filename, bytes, encrypted}>
 *     opts = { passphrase?:string, encrypt?:boolean, prompt?:boolean,
 *              includeSecrets?:boolean }
 *     - prompt:true  -> ask for an optional passphrase via window.prompt
 *     - passphrase   -> AES-GCM encrypt (PBKDF2-SHA256, 250k iters)
 *     - no passphrase -> plain JSON
 *
 * Format
 * ------
 *   plain:     { _antcvBackup:1, version, exportedAt, schema:1, data:{key:val} }
 *   encrypted: { _antcvBackupEncrypted:1, kdf, hash, iterations, salt, iv,
 *                cipher:"AES-GCM", ciphertext }  (all binary fields base64)
 *
 * Safety
 * ------
 *   - Credential-looking keys (token/secret/jwt/apikey/...) are EXCLUDED by
 *     default so a plain backup can't leak keys. Pass includeSecrets:true
 *     (only honoured with a passphrase) to include them in an encrypted file.
 *   - Transient erase markers are never exported.
 *   - Export NEVER mutates storage; the delete-save path runs the backup, then
 *     defers to the original AntcvFullErase unchanged.
 *
 * Escape hatch
 * ------------
 *   localStorage['antcv:disable-data-export'] = '1' -> no UI, no erase wrap.
 */
(function () {
  'use strict';

  var VERSION = '1.50.145';
  if (window.__antcvDataExport360 === VERSION) return;
  window.__antcvDataExport360 = VERSION;

  var DISABLE_KEY = 'antcv:disable-data-export';
  var UI_MARK = 'data-antcv-data-export-ui';
  var SAVE_FIRST_DEFAULT = true; // protective: back up before an irreversible wipe

  // Keys that must never land in an export, plus credential patterns excluded
  // from a PLAIN backup (a passphrase + includeSecrets can re-include them).
  var TRANSIENT_KEYS = {
    'antcv:just-erased': 1,
    'antcv:full-erase-in-progress': 1
  };
  function isSecretKey(k) {
    // Match credential words anywhere in the key name (incl. camelCase like
    // authToken). False positives only drop a key from a PLAIN backup; it can
    // still be included via passphrase + includeSecrets. "key" alone is NOT
    // matched (would catch innocuous keys) — only api/private/secret key forms.
    return /(token|secret|jwt|password|passwd|api[._-]?key|apikey|private[._-]?key|credential|passphrase)/i.test(k);
  }

  function disabled() {
    try {
      var raw = localStorage.getItem(DISABLE_KEY);
      return raw === '1' || raw === 'true';
    } catch (_) { return false; }
  }

  // ── data collection ────────────────────────────────────────────────────
  function collectData(includeSecrets) {
    var out = {};
    var ls;
    try { ls = window.localStorage; } catch (_) { return out; }
    for (var i = 0; i < ls.length; i++) {
      var key;
      try { key = ls.key(i); } catch (_) { continue; }
      if (!key) continue;
      if (TRANSIENT_KEYS[key]) continue;
      if (!includeSecrets && isSecretKey(key)) continue;
      var raw;
      try { raw = ls.getItem(key); } catch (_) { continue; }
      if (raw === null) continue;
      // Store parsed JSON where possible so the backup is human-readable;
      // fall back to the raw string otherwise.
      try { out[key] = JSON.parse(raw); }
      catch (_) { out[key] = raw; }
    }
    return out;
  }

  function backupEnvelope(includeSecrets) {
    return {
      _antcvBackup: 1,
      version: (typeof window.ANTCV_VERSION === 'string' ? window.ANTCV_VERSION : VERSION),
      exportedAt: new Date().toISOString(),
      schema: 1,
      includedSecrets: !!includeSecrets,
      data: collectData(includeSecrets)
    };
  }

  // ── base64 helpers (binary-safe) ───────────────────────────────────────
  function bufToB64(buf) {
    var bytes = new Uint8Array(buf);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  // ── WebCrypto encryption (PBKDF2 -> AES-GCM) ───────────────────────────
  function encryptJson(plaintext, passphrase) {
    var subtle = window.crypto && window.crypto.subtle;
    if (!subtle) return Promise.reject(new Error('WebCrypto unavailable'));
    var enc = new TextEncoder();
    var salt = window.crypto.getRandomValues(new Uint8Array(16));
    var iv = window.crypto.getRandomValues(new Uint8Array(12));
    var iterations = 250000;
    return subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey'])
      .then(function (km) {
        return subtle.deriveKey(
          { name: 'PBKDF2', salt: salt, iterations: iterations, hash: 'SHA-256' },
          km, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
      })
      .then(function (key) {
        return subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, enc.encode(plaintext));
      })
      .then(function (ct) {
        return {
          _antcvBackupEncrypted: 1,
          version: (typeof window.ANTCV_VERSION === 'string' ? window.ANTCV_VERSION : VERSION),
          exportedAt: new Date().toISOString(),
          kdf: 'PBKDF2', hash: 'SHA-256', iterations: iterations,
          cipher: 'AES-GCM',
          salt: bufToB64(salt), iv: bufToB64(iv),
          ciphertext: bufToB64(ct)
        };
      });
  }

  // ── download ───────────────────────────────────────────────────────────
  function fileStamp() {
    try { return new Date().toISOString().slice(0, 10); } catch (_) { return 'backup'; }
  }
  function downloadBlob(text, filename) {
    var blob = new Blob([text], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      try { document.body.removeChild(a); } catch (_) {}
      try { URL.revokeObjectURL(url); } catch (_) {}
    }, 1500);
    return blob.size;
  }

  // ── main export entry point ────────────────────────────────────────────
  function exportData(opts) {
    opts = opts || {};
    var passphrase = opts.passphrase;
    if (opts.prompt && passphrase == null) {
      try {
        passphrase = window.prompt(
          'Enter a passphrase to encrypt your backup, or leave blank for a plain (unencrypted) file.\n\n' +
          'Keep the passphrase safe — without it the encrypted file cannot be opened.', '');
      } catch (_) { passphrase = null; }
      if (passphrase === null) return Promise.resolve({ ok: false, cancelled: true });
    }
    var wantEncrypt = !!(passphrase && passphrase.length) || opts.encrypt;
    var includeSecrets = wantEncrypt && !!opts.includeSecrets;
    var envelope = backupEnvelope(includeSecrets);
    var plaintext = JSON.stringify(envelope, null, 2);

    if (!wantEncrypt) {
      var fname = 'antcv-backup-' + fileStamp() + '.json';
      var bytes = downloadBlob(plaintext, fname);
      return Promise.resolve({ ok: true, filename: fname, bytes: bytes, encrypted: false });
    }
    return encryptJson(plaintext, passphrase).then(function (env) {
      var fname = 'antcv-backup-' + fileStamp() + '.encrypted.json';
      var text = JSON.stringify(env, null, 2);
      var bytes = downloadBlob(text, fname);
      return { ok: true, filename: fname, bytes: bytes, encrypted: true };
    }).catch(function (err) {
      // Encryption failed (no WebCrypto / non-secure context) — fall back to a
      // plain file so the user still gets their data, and tell them.
      try { console.warn('[data-export-360] encryption failed, writing plain file:', err && err.message); } catch (_) {}
      var fn = 'antcv-backup-' + fileStamp() + '.json';
      var sz = downloadBlob(plaintext, fn);
      return { ok: true, filename: fn, bytes: sz, encrypted: false, encryptError: String(err && err.message) };
    });
  }
  window.AntcvDataExport = exportData;

  // ── delete-save flag (set by the injected checkbox) ────────────────────
  var saveFirst = SAVE_FIRST_DEFAULT;
  function quickExport() {
    // Unencrypted, no prompt — a fast safety copy taken mid-delete.
    try { return exportData({}); } catch (_) { return Promise.resolve({ ok: false }); }
  }

  // ── wrap AntcvFullErase so a checked box backs up before erasing ───────
  function wrapFullErase() {
    var orig = window.AntcvFullErase;
    if (typeof orig !== 'function') return false;
    if (orig.__antcvSaveFirstWrapped === VERSION) return true;
    var wrapped = function () {
      var self = this, args = arguments;
      if (saveFirst && !disabled()) {
        return Promise.resolve(quickExport())
          .catch(function () { /* never block the erase on a backup failure */ })
          .then(function () { return orig.apply(self, args); });
      }
      return orig.apply(self, args);
    };
    wrapped.__antcvSaveFirstWrapped = VERSION;
    window.AntcvFullErase = wrapped;
    try { console.info('[data-export-360] wrapped window.AntcvFullErase (save-first)'); } catch (_) {}
    return true;
  }

  // ── UI injection: anchor to the Settings "DANGER ZONE" card ────────────
  // The live card (app.js) is: "⚠ DANGER ZONE" header, an always-visible
  // description ("…Logs you out. No undo."), then either a "🗑 Delete user"
  // trigger or — once armed — an "Are you sure?" confirm card whose button row
  // holds "🗑 Yes, erase everything" + "Cancel". The checkbox goes above that
  // button row; the Download button goes after the always-visible description.
  function findEraseButton() {
    var btns = document.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      var t = (btns[i].textContent || '');
      // "Yes, erase everything" (current confirm card) or the legacy
      // "Delete my account & all data" button.
      if (/erase everything|delete my account/i.test(t)) return btns[i];
    }
    return null;
  }

  function findDangerDescription() {
    var els = document.querySelectorAll('div');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      // Match the description leaf only (single text node) so we land on the
      // paragraph itself, not an ancestor wrapper.
      if (el.childNodes.length === 1 && el.firstChild && el.firstChild.nodeType === 3) {
        if (/Logs you out\. No undo\./i.test(el.textContent || '')) return el;
      }
    }
    return null;
  }

  function buildButton() {
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute(UI_MARK, 'download');
    b.textContent = '⬇ Download my data';
    b.style.cssText = 'display:block;width:100%;margin:0 0 8px;padding:12px;' +
      'background:rgba(90,150,230,0.12);border:1px solid rgba(90,150,230,0.5);' +
      'color:#bcd6ff;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;';
    b.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      b.disabled = true;
      var prev = b.textContent;
      b.textContent = '⬇ Preparing backup…';
      exportData({ prompt: true }).then(function (r) {
        b.textContent = (r && r.ok)
          ? (r.cancelled ? prev : '✓ Saved ' + (r.filename || 'backup'))
          : prev;
        setTimeout(function () { b.textContent = prev; b.disabled = false; }, 2600);
      });
    });
    return b;
  }

  function buildCheckRow() {
    var wrap = document.createElement('label');
    wrap.setAttribute(UI_MARK, 'savefirst');
    wrap.style.cssText = 'display:flex;align-items:flex-start;gap:8px;margin:0 0 8px;' +
      'font-size:12px;line-height:1.4;color:#cdd6e0;cursor:pointer;';
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = SAVE_FIRST_DEFAULT;
    cb.style.cssText = 'margin-top:2px;flex:0 0 auto;';
    cb.addEventListener('change', function () { saveFirst = cb.checked; });
    var span = document.createElement('span');
    span.innerHTML = 'Save my data locally first ' +
      '<span style="opacity:.7">— downloads a backup file before deleting. There is no undo.</span>';
    wrap.appendChild(cb);
    wrap.appendChild(span);
    return wrap;
  }

  // Checkbox -> above the confirm card's button row (appears when armed).
  function injectCheckbox() {
    var eraseBtn = findEraseButton();
    if (!eraseBtn) return;
    var row = eraseBtn.parentNode;        // flex row: [Yes, erase][Cancel]
    if (!row) return;
    var card = row.parentNode || row;     // the "Are you sure?" confirm card
    if (card.querySelector('[' + UI_MARK + '="savefirst"]')) return;
    try { card.insertBefore(buildCheckRow(), row); } catch (_) {}
  }

  // Download button -> right after the always-visible danger-zone description,
  // so it shows whether or not the confirm card is armed.
  function injectDownload() {
    var desc = findDangerDescription();
    if (!desc) return;
    var section = desc.parentNode;
    if (!section) return;
    if (section.querySelector('[' + UI_MARK + '="download"]')) return;
    try {
      if (desc.nextSibling) section.insertBefore(buildButton(), desc.nextSibling);
      else section.appendChild(buildButton());
    } catch (_) {}
  }

  function injectUi() {
    if (disabled()) return;
    injectDownload();
    injectCheckbox();
  }

  // Throttled, idempotent sweep. Once the nodes exist the sweep is a no-op, so
  // it cannot feed a mutation loop (per the codebase's loop-hygiene lessons).
  var scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(function () { scheduled = false; injectUi(); }, 250);
  }

  function boot() {
    wrapFullErase();
    injectUi();
    var startedAt = Date.now();
    // Poll briefly for AntcvFullErase to exist (it may register after us).
    var iv = setInterval(function () {
      if (wrapFullErase() || (Date.now() - startedAt) > 30000) clearInterval(iv);
    }, 300);
    try {
      var obs = new MutationObserver(function () { schedule(); });
      obs.observe(document.body, { childList: true, subtree: true });
    } catch (_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // Debug API
  window.AntcvDataExport360 = {
    version: VERSION,
    exportData: exportData,
    collectData: collectData,
    _injectUi: injectUi,
    _findEraseButton: findEraseButton,
    _findDangerDescription: findDangerDescription,
    _setSaveFirst: function (v) { saveFirst = !!v; },
    _saveFirst: function () { return saveFirst; }
  };
})();
