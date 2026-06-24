/* AntCV data export + delete-save (v1.50.147)
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

  var VERSION = '1.50.849-review-collapse';
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

  // 1.50.331 DATA-IMPORT-001: the parsed `data` map runs every value through
  // JSON.parse, which is LOSSY — it can't tell a JSON-encoded string (e.g. doc
  // stored as '"cv"') from a raw string. `dataRaw` carries the EXACT
  // localStorage strings so the importer (antcv-data-import-331) can restore them
  // byte-for-byte. `data` stays for human-readability + back-compat.
  function collectDataRaw(includeSecrets) {
    var out = {};
    var ls;
    try { ls = window.localStorage; } catch (_) { return out; }
    for (var i = 0; i < ls.length; i++) {
      var key;
      try { key = ls.key(i); } catch (_) { continue; }
      if (!key || TRANSIENT_KEYS[key]) continue;
      if (!includeSecrets && isSecretKey(key)) continue;
      var raw;
      try { raw = ls.getItem(key); } catch (_) { continue; }
      if (raw === null) continue;
      out[key] = raw;
    }
    return out;
  }

  function backupEnvelope(includeSecrets) {
    return {
      _antcvBackup: 1,
      version: (typeof window.ANTCV_VERSION === 'string' ? window.ANTCV_VERSION : VERSION),
      exportedAt: new Date().toISOString(),
      schema: 2,
      includedSecrets: !!includeSecrets,
      data: collectData(includeSecrets),
      dataRaw: collectDataRaw(includeSecrets)
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

  // ── SETTINGS-EXPORT-001 (owner 2026-06-17): account-locked export ──────
  // A server-held-key, USER-BOUND encrypted export — no passphrase. The AES-256
  // key is derived server-side (HKDF) from the relay JWT_SECRET + the signed-in
  // email (GET /api/export-key), so the file opens ONLY for the same account
  // (or an admin). Includes ALL settings + the unsolicited baseline (it is the
  // same full localStorage dump as the plain backup, just account-encrypted).
  function proxyBase() {
    try {
      var v = JSON.parse(localStorage.getItem('proxyUrl') || '""') || '';
      if (!v) v = JSON.parse(localStorage.getItem('relayUrl') || '""') || '';
      v = String(v || '').replace(/\/+$/, '');
      if (!v && typeof window.ANTCV_RELAY_URL === 'string') v = String(window.ANTCV_RELAY_URL).replace(/\/+$/, '');
      return v;
    } catch (_) { return ''; }
  }
  function b64ToBuf(b64) {
    var bin = atob(String(b64 || '')); var u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  function fetchExportKey() {
    var base = proxyBase();
    if (!base) return Promise.reject(new Error('Not connected — sign in so AntCV can fetch your account key.'));
    return fetch(base + '/api/export-key', { method: 'GET', credentials: 'include' })
      .then(function (r) {
        if (r.status === 401) throw new Error('Sign in first — an account-locked export needs your account.');
        if (!r.ok) throw new Error('Could not fetch the account key (HTTP ' + r.status + ').');
        return r.json();
      })
      .then(function (j) {
        if (!j || !j.ok || !j.key) throw new Error('Account key unavailable.');
        return j; // { owner, key, alg, bits }
      });
  }
  function exportUserBound() {
    var subtle = window.crypto && window.crypto.subtle;
    if (!subtle) return Promise.reject(new Error('WebCrypto unavailable (needs a secure context).'));
    var envelope = backupEnvelope(true); // includeSecrets — file is account-encrypted at rest
    var plaintext = JSON.stringify(envelope);
    var enc = new TextEncoder();
    var iv = window.crypto.getRandomValues(new Uint8Array(12));
    var keyInfo;
    return fetchExportKey()
      .then(function (info) {
        keyInfo = info;
        return subtle.importKey('raw', b64ToBuf(info.key), { name: 'AES-GCM' }, false, ['encrypt']);
      })
      .then(function (key) { return subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, enc.encode(plaintext)); })
      .then(function (ct) {
        var env = {
          _antcvBackupUserBound: 1,
          owner: keyInfo.owner,
          version: (typeof window.ANTCV_VERSION === 'string' ? window.ANTCV_VERSION : VERSION),
          exportedAt: new Date().toISOString(),
          cipher: 'AES-GCM', iv: bufToB64(iv), ciphertext: bufToB64(ct)
        };
        var fname = 'antcv-settings-' + fileStamp() + '.locked.json';
        var bytes = downloadBlob(JSON.stringify(env, null, 2), fname);
        return { ok: true, filename: fname, bytes: bytes, encrypted: true, userBound: true };
      });
  }
  window.AntcvDataExportUserBound = exportUserBound;

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

  // ── UI injection ───────────────────────────────────────────────────────
  // Two homes in Settings:
  //   * the "Save my data locally first" checkbox goes into the DANGER ZONE
  //     "Are you sure?" confirm card, above its "🗑 Yes, erase everything" /
  //     "Cancel" button row;
  //   * the "⬇ Download my data" button goes at the END of the PRIVACY zone,
  //     right after the "What LLM providers see" box (its last line mentions
  //     "zero-retention modes"). (Owner placement, v1.50.146 — was the danger
  //     zone in v1.50.145, v1.50.146.)
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

  // Returns the "What LLM providers see" box (the privacy zone's last block) so
  // the Download button can be appended after it, ending the privacy zone.
  function findPrivacyProvidersBox() {
    var els = document.querySelectorAll('div');
    // 1) strict: the provider-text leaf is a single text node mentioning
    //    zero-retention. el.parent = the bordered "What LLM providers see" box.
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.childNodes.length === 1 && el.firstChild && el.firstChild.nodeType === 3 &&
          /zero-retention modes/i.test(el.textContent || '')) {
        return el.parentNode || el;
      }
    }
    // ROBUST-ANCHOR-001 (owner 2026-06-18, "the buttons disappeared"): if the
    // text leaf got wrapped (a nested span, a line split), fall back to the
    // smallest leaf-ish div whose OWN text mentions zero-retention, then to the
    // "What LLM providers see" header box. Keeps the buttons anchored even when
    // the privacy block's DOM shape shifts.
    for (var j = 0; j < els.length; j++) {
      var e = els[j];
      if (/zero-retention modes/i.test(e.textContent || '') && !e.querySelector('div')) return e.parentNode || e;
    }
    for (var k = 0; k < els.length; k++) {
      var h = els[k];
      if (/what llm providers see/i.test(h.textContent || '') && !h.querySelector('div')) return h.parentNode || h;
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

  function buildLockedButton() {
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute(UI_MARK, 'locked');
    b.textContent = '🔒 Export (account-locked)';
    b.title = 'Encrypted and locked to your account — no passphrase. Only you (signed in) can import it back.';
    b.style.cssText = 'display:block;width:100%;margin:0 0 8px;padding:12px;' +
      'background:rgba(1,183,187,0.12);border:1px solid rgba(1,183,187,0.5);' +
      'color:#bdf0f1;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;';
    b.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      b.disabled = true;
      var prev = b.textContent;
      b.textContent = '🔒 Encrypting to your account…';
      exportUserBound().then(function (r) {
        b.textContent = (r && r.ok) ? '✓ Saved ' + (r.filename || 'file') : prev;
        setTimeout(function () { b.textContent = prev; b.disabled = false; }, 2600);
      }).catch(function (err) {
        b.textContent = '⚠ ' + ((err && err.message) || 'Export failed');
        setTimeout(function () { b.textContent = prev; b.disabled = false; }, 3600);
      });
    });
    return b;
  }

  // ── REVIEW-DATA-001 (owner 2026-06-18): friendly "Review my data" modal ──
  // Replaces the plain "Download my data" button. Shows everything AntCV holds
  // as the GROUND TRUTH for generation, in a readable sectioned view with
  // explanations + tips, and inline editing for the core identity / summary /
  // visibility fields. The structured editors (experience, semantic constraints,
  // CV sidebar) render read-friendly here and point to their home in Settings →
  // Personal (where the SEMANTIC-CONSTRAINTS-002 card editor now lives).
  function rdReadPI() {
    try { var pi = JSON.parse(localStorage.getItem('personalInfo') || '{}') || {}; return (pi && pi.personalInfo) ? pi.personalInfo : (pi || {}); }
    catch (_) { return {}; }
  }
  function rdSavePI(pi) {
    try { localStorage.setItem('personalInfo', JSON.stringify(pi)); } catch (_) {}
    try { window._antcvCloudWrite && window._antcvCloudWrite({ personalInfo: pi }); } catch (_) {}
    try { window.dispatchEvent(new StorageEvent('storage', { key: 'personalInfo' })); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('antcv:personalinfo-changed')); } catch (_) {}
  }
  function rdEl(tag, css, text) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (text != null) e.textContent = text; return e; }
  function rdArr(v) { return Array.isArray(v) ? v.filter(Boolean) : (v ? [String(v)] : []); }
  function rdChips(list, bg, fg, empty) {
    var box = rdEl('div', 'display:flex;flex-wrap:wrap;gap:4px;align-items:center;');
    if (!list.length) { box.appendChild(rdEl('span', 'font-size:11px;opacity:.45;', empty || 'none set')); return box; }
    list.forEach(function (c) { box.appendChild(rdEl('span', 'font-size:11px;padding:2px 8px;border-radius:11px;background:' + bg + ';color:' + fg + ';', String(c).trim())); });
    return box;
  }
  function rdField(label, value, onSave, multiline) {
    var wrap = rdEl('div', 'display:flex;flex-direction:column;gap:3px;margin:0 0 7px;');
    var top = rdEl('div', 'display:flex;align-items:center;gap:8px;');
    top.appendChild(rdEl('div', 'font-size:10px;text-transform:uppercase;letter-spacing:.5px;opacity:.55;', label));
    var saved = rdEl('span', 'font-size:10px;color:#5dcaa5;opacity:0;transition:opacity .2s;', '✓ saved');
    top.appendChild(saved);
    wrap.appendChild(top);
    var inp = document.createElement(multiline ? 'textarea' : 'input');
    if (multiline) inp.rows = 3;
    inp.value = value == null ? '' : String(value);
    inp.style.cssText = 'width:100%;box-sizing:border-box;padding:7px 9px;background:rgba(255,255,255,.05);' +
      'color:#e6eef3;border:1px solid rgba(255,255,255,.16);border-radius:6px;font-family:inherit;font-size:12.5px;' +
      (multiline ? 'resize:vertical;line-height:1.45;' : '');
    function commit() { onSave(inp.value); saved.style.opacity = '1'; setTimeout(function () { saved.style.opacity = '0'; }, 1400); }
    inp.addEventListener('blur', commit);
    inp.addEventListener('keydown', function (e) { if (!multiline && e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
    wrap.appendChild(inp);
    return wrap;
  }
  // PERSONAL-MERGE-2 (owner 2026-06-24): every card is a disclosure, COLLAPSED by
  // default so the modal opens as a clean list of headings instead of a wall of
  // fields. Open/closed state persists per section (keyed off the title, minus any
  // parenthetical count so the key stays stable as counts change).
  function rdCollapseKey(title) {
    return 'antcv:rvCollapse:' + String(title).replace(/\(.*?\)/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  function rdSection(emoji, title, explanation) {
    var sec = rdEl('div', 'background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.10);border-radius:10px;padding:12px 13px;');
    var key = rdCollapseKey(title);
    var collapsed = true;
    try { if (localStorage.getItem(key) === '0') collapsed = false; } catch (_) {}
    var hdr = rdEl('button', 'display:flex;align-items:center;gap:8px;width:100%;padding:0;margin:0;background:transparent;border:none;cursor:pointer;text-align:left;color:inherit;');
    hdr.type = 'button';
    var caret = rdEl('span', 'font-size:10px;opacity:.6;flex:0 0 auto;', '▸');
    hdr.appendChild(caret);
    hdr.appendChild(rdEl('span', 'font-size:13px;font-weight:700;color:#e6eef3;flex:1;', emoji + '  ' + title));
    sec.appendChild(hdr);
    var inner = rdEl('div', 'margin-top:9px;');
    if (explanation) inner.appendChild(rdEl('div', 'font-size:11px;opacity:.6;line-height:1.45;margin:0 0 9px;', explanation));
    var body = rdEl('div', 'display:flex;flex-direction:column;gap:6px;');
    inner.appendChild(body);
    sec.appendChild(inner);
    function apply() { inner.style.display = collapsed ? 'none' : ''; caret.textContent = collapsed ? '▸' : '▾'; }
    apply();
    hdr.addEventListener('click', function () { collapsed = !collapsed; try { localStorage.setItem(key, collapsed ? '1' : '0'); } catch (_) {} apply(); });
    return { sec: sec, body: body };
  }
  function rdTip(text) {
    return rdEl('div', 'font-size:11px;line-height:1.45;color:#bdf0f1;background:rgba(1,183,187,.10);' +
      'border-left:3px solid #01B7BB;border-radius:0 6px 6px 0;padding:7px 10px;margin:2px 0 0;', '💡  ' + text);
  }
  function rdPill(text, ok) {
    return rdEl('span', 'font-size:10px;padding:2px 8px;border-radius:10px;white-space:nowrap;' +
      (ok ? 'background:rgba(93,202,165,.16);color:#9fe1cb;' : 'background:rgba(255,255,255,.08);color:#aab4c2;'), text);
  }

  // SIDEBAR-STRUCTURED-001 (owner 2026-06-18): structured row editors for the
  // CV-sidebar lists, replacing the pipe-delimited "Label | value" textareas —
  // but inside the stable Review modal (NOT live-injected into the React Personal
  // tab), writing personalInfo via the same clean-read/clean-write + events path
  // the semantic island uses. Serialises to the EXACT native shapes so a later
  // re-apply / generation reads them identically.
  var RD_ROW_INPUT = 'flex:1;min-width:54px;padding:5px 7px;background:rgba(255,255,255,.05);color:#e6eef3;' +
    'border:1px solid rgba(255,255,255,.16);border-radius:5px;font-family:inherit;font-size:12px;box-sizing:border-box;';
  function rdMiniBtn(label, title) {
    var b = rdEl('button', 'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.18);color:#e6eef3;' +
      'border-radius:5px;font-size:11px;padding:4px 9px;cursor:pointer;', label);
    b.type = 'button'; if (title) b.title = title; return b;
  }
  // cfg: { emoji, title, help, key, kind:'lv'|'str'|'degsch'|'reg', cols:[..] }
  function rdSidebarSection(cfg, initialArr) {
    var arr = (Array.isArray(initialArr) ? initialArr : []).map(function (r) {
      if (cfg.kind === 'str') return { t: String(r == null ? '' : r) };
      if (cfg.kind === 'degsch') return { deg: String((r && r.deg) || ''), sch: String((r && r.sch) || '') };
      if (cfg.grouped && r && r.group != null) return { group: String(r.group || '') };
      return { l: String((r && r.l) || ''), v: String((r && r.v) || '') };
    });
    function toNative() {
      return arr.map(function (r) {
        if (cfg.kind === 'str') return r.t.trim();
        if (cfg.kind === 'degsch') return { deg: r.deg.trim(), sch: r.sch.trim() };
        if ('group' in r) return { group: r.group.trim() };
        return { l: r.l.trim(), v: r.v.trim() };
      }).filter(function (r) {
        if (cfg.kind === 'str') return !!r;
        if ('group' in (r || {})) return !!r.group;
        if (cfg.kind === 'degsch') return r.deg || r.sch;
        return r.l || r.v;
      });
    }
    function commit() { var cur = rdReadPI(); cur[cfg.key] = toNative(); rdSavePI(cur); }
    var sec = rdSection(cfg.emoji, cfg.title, cfg.help);
    var list = rdEl('div', 'display:flex;flex-direction:column;gap:5px;');
    sec.body.appendChild(list);
    function render() {
      while (list.firstChild) list.removeChild(list.firstChild);
      arr.forEach(function (r, i) { list.appendChild(rowEl(r, i)); });
    }
    function delBtn(i) {
      var x = rdEl('button', 'flex:0 0 auto;background:transparent;border:none;color:#f3b4b3;font-size:15px;line-height:1;cursor:pointer;padding:0 4px;', '×');
      x.type = 'button'; x.title = 'Remove'; x.setAttribute('aria-label', 'Remove row');
      x.addEventListener('click', function () { arr.splice(i, 1); commit(); render(); });
      return x;
    }
    function inp(val, ph, onIn) {
      var e = rdEl('input', RD_ROW_INPUT); e.value = val; e.placeholder = ph || '';
      e.addEventListener('input', function () { onIn(e.value); });
      e.addEventListener('blur', commit);
      return e;
    }
    function rowEl(r, i) {
      var row = rdEl('div', 'display:flex;gap:5px;align-items:center;');
      if ('group' in r) {
        row.appendChild(rdEl('span', 'flex:0 0 auto;font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:#9fe1cb;padding:2px 6px;background:rgba(93,202,165,.14);border-radius:4px;', 'group'));
        row.appendChild(inp(r.group, 'Group heading…', function (v) { r.group = v; }));
      } else if (cfg.kind === 'str') {
        row.appendChild(inp(r.t, cfg.cols[0] + '…', function (v) { r.t = v; }));
      } else if (cfg.kind === 'degsch') {
        row.appendChild(inp(r.deg, cfg.cols[0], function (v) { r.deg = v; }));
        row.appendChild(inp(r.sch, cfg.cols[1], function (v) { r.sch = v; }));
      } else {
        row.appendChild(inp(r.l, cfg.cols[0], function (v) { r.l = v; }));
        row.appendChild(inp(r.v, cfg.cols[1], function (v) { r.v = v; }));
      }
      row.appendChild(delBtn(i));
      return row;
    }
    var addRow = rdEl('div', 'display:flex;gap:6px;margin-top:7px;');
    var addItem = rdMiniBtn('+ ' + (cfg.kind === 'str' ? cfg.cols[0] : 'row'));
    addItem.addEventListener('click', function () {
      arr.push(cfg.kind === 'str' ? { t: '' } : cfg.kind === 'degsch' ? { deg: '', sch: '' } : { l: '', v: '' });
      render();
    });
    addRow.appendChild(addItem);
    if (cfg.grouped) {
      var addGrp = rdMiniBtn('+ group heading');
      addGrp.addEventListener('click', function () { arr.push({ group: '' }); render(); });
      addRow.appendChild(addGrp);
    }
    sec.body.appendChild(addRow);
    render();
    return sec.sec;
  }

  // WORK-HISTORY-EDIT-001 (owner 2026-06-18): edit existing roles inline in the
  // modal — title / company / years / visibility + bullets & outcomes (one per
  // line). Edits in place on a deep clone so id / altTitles / mergeGroup /
  // _visibilityNote / category survive; writes the whole experience[] back.
  // Add/remove a ROLE still lives in the app's Experience section (avoids
  // accidental loss here).
  function rdInpCommit(val, ph, setModel, commit, bold) {
    var e = rdEl('input', RD_ROW_INPUT + (bold ? 'font-weight:600;' : ''));
    e.value = val == null ? '' : String(val); e.placeholder = ph || '';
    e.addEventListener('input', function () { setModel(e.value); });
    e.addEventListener('blur', commit);
    return e;
  }
  function rdLineArea(label, arr, setModel, commit) {
    var w = rdEl('div', 'display:flex;flex-direction:column;gap:3px;');
    w.appendChild(rdEl('div', 'font-size:10px;opacity:.5;text-transform:uppercase;letter-spacing:.5px;', label));
    var ta = rdEl('textarea', 'width:100%;box-sizing:border-box;padding:6px 8px;background:rgba(255,255,255,.05);color:#e6eef3;' +
      'border:1px solid rgba(255,255,255,.16);border-radius:5px;font-family:inherit;font-size:12px;line-height:1.45;resize:vertical;');
    ta.rows = Math.min(7, Math.max(2, (Array.isArray(arr) ? arr.length : 0) || 2));
    ta.value = (Array.isArray(arr) ? arr : []).join('\n');
    ta.addEventListener('input', function () { setModel(ta.value.split('\n')); });
    ta.addEventListener('blur', commit);
    w.appendChild(ta);
    return w;
  }
  function rdWorkHistory(initial) {
    var roles = (Array.isArray(initial) ? initial : []).map(function (r) { try { return JSON.parse(JSON.stringify(r || {})); } catch (_) { return {}; } });
    function commit() {
      var clean = roles.map(function (r) {
        var c = {}; for (var k in r) if (Object.prototype.hasOwnProperty.call(r, k)) c[k] = r[k];
        if (Array.isArray(c.bullets)) c.bullets = c.bullets.map(function (s) { return String(s).trim(); }).filter(Boolean);
        if (Array.isArray(c.outcomes)) c.outcomes = c.outcomes.map(function (s) { return String(s).trim(); }).filter(Boolean);
        return c;
      });
      var cur = rdReadPI(); cur.experience = clean; rdSavePI(cur);
    }
    var s = rdSection('💼', 'Work history (' + roles.length + ' roles)', 'Edit titles, dates, visibility, bullets and outcomes. Add or remove a role in the editor’s Experience section.');
    roles.forEach(function (r, ri) {
      var card = rdEl('div', 'background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:9px 10px;margin-bottom:7px;display:flex;flex-direction:column;gap:6px;');
      // PERSONAL-MERGE-2: each role collapses to title/company/years; bullets &
      // outcomes hide behind a per-role caret (collapsed by default) so 12 roles
      // read as a list, not a wall. State persists per role id/index.
      var rKey = 'antcv:rvRole:' + (r.id || ('idx' + ri));
      var rCollapsed = true;
      try { if (localStorage.getItem(rKey) === '0') rCollapsed = false; } catch (_) {}
      var h = rdEl('div', 'display:flex;gap:6px;align-items:center;');
      var rCaret = rdEl('button', 'flex:0 0 auto;background:transparent;border:none;color:#e6eef3;font-size:11px;opacity:.6;cursor:pointer;padding:0 2px;', '▸');
      rCaret.type = 'button'; rCaret.title = 'Expand / collapse this role';
      h.appendChild(rCaret);
      h.appendChild(rdInpCommit(r.title, 'Job title', function (v) { r.title = v; }, commit, true));
      var visLbl = rdEl('label', 'display:flex;align-items:center;gap:5px;font-size:11px;opacity:.8;cursor:pointer;flex:0 0 auto;');
      var vis = document.createElement('input'); vis.type = 'checkbox'; vis.checked = r.on !== false; vis.style.cssText = 'accent-color:#01B7BB;';
      vis.addEventListener('change', function () { r.on = vis.checked; commit(); });
      visLbl.appendChild(vis); visLbl.appendChild(rdEl('span', null, 'shown'));
      h.appendChild(visLbl);
      card.appendChild(h);
      var cy = rdEl('div', 'display:flex;gap:6px;');
      cy.appendChild(rdInpCommit(r.company, 'Company', function (v) { r.company = v; }, commit));
      cy.appendChild(rdInpCommit(r.years, 'Years', function (v) { r.years = v; }, commit));
      card.appendChild(cy);
      var detail = rdEl('div', 'display:flex;flex-direction:column;gap:6px;');
      detail.appendChild(rdLineArea('Bullets', r.bullets, function (a) { r.bullets = a; }, commit));
      detail.appendChild(rdLineArea('Outcomes', r.outcomes, function (a) { r.outcomes = a; }, commit));
      card.appendChild(detail);
      function rApply() { detail.style.display = rCollapsed ? 'none' : ''; rCaret.textContent = rCollapsed ? '▸' : '▾'; }
      rApply();
      rCaret.addEventListener('click', function () { rCollapsed = !rCollapsed; try { localStorage.setItem(rKey, rCollapsed ? '1' : '0'); } catch (_) {} rApply(); });
      s.body.appendChild(card);
    });
    if (!roles.length) s.body.appendChild(rdEl('div', 'font-size:11px;opacity:.45;', 'No work history stored yet.'));
    return s.sec;
  }

  function openReview() {
    // REVIEW-MODAL-RESILIENT-001 (owner 2026-06-18, "nothing happens"): never let
    // a stale/hidden modal block reopening — remove it and open fresh.
    try { var __ex = document.querySelector('[data-antcv-review-modal]'); if (__ex) __ex.remove(); } catch (_) {}
    var pi = rdReadPI();
    var sp = pi.stylePrefs || {};
    function patch(o) { var cur = rdReadPI(); for (var k in o) { if (Object.prototype.hasOwnProperty.call(o, k)) cur[k] = o[k]; } rdSavePI(cur); }
    function patchVis(key, val) { var cur = rdReadPI(); var vc = cur.visibilityControls || {}; vc[key] = val; cur.visibilityControls = vc; rdSavePI(cur); }

    // REVIEW-DATA-ZINDEX-001 (owner 2026-06-22: "loading but hidden behind set-menu"). The Settings
    // drawer / set-menu sits in the 2147483xxx top layer, so a z-index:100000 overlay rendered behind
    // it. Lift the modal into that same top band (above the drawer + mobile bottom-nav 2147483600).
    var overlay = rdEl('div', 'position:fixed;inset:0;z-index:2147483646;background:rgba(10,15,30,.74);' +
      'display:flex;align-items:flex-start;justify-content:center;padding:24px 14px;overflow:auto;');
    overlay.setAttribute('data-antcv-review-modal', '1');
    var card = rdEl('div', 'width:100%;max-width:720px;background:#1d2740;border:1px solid rgba(255,255,255,.13);' +
      'border-radius:14px;color:#e6eef3;display:flex;flex-direction:column;max-height:92vh;box-shadow:0 12px 48px rgba(0,0,0,.4);font-family:inherit;');
    function close() { try { document.body.removeChild(overlay); } catch (_) {} document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', onKey);

    // Header
    var head = rdEl('div', 'display:flex;align-items:center;gap:10px;padding:15px 18px;border-bottom:1px solid rgba(255,255,255,.10);');
    head.appendChild(rdEl('div', 'font-size:16px;font-weight:700;flex:1;', '📋  Review & Edit my data'));
    var x = rdEl('button', 'background:transparent;border:none;color:#e6eef3;font-size:22px;line-height:1;cursor:pointer;opacity:.7;padding:2px 6px;', '×');
    x.type = 'button'; x.title = 'Close'; x.addEventListener('click', close);
    head.appendChild(x);
    card.appendChild(head);

    // Scrollable body
    var body = rdEl('div', 'overflow:auto;padding:14px 18px 18px;display:flex;flex-direction:column;gap:11px;');
    card.appendChild(body);

    // Show the modal NOW (header + empty body) so a later section error can't
    // make the whole thing silently fail to appear; sections build into the live
    // DOM below, guarded so one bad section degrades gracefully.
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    try {

    body.appendChild(rdEl('div', 'font-size:12px;line-height:1.5;opacity:.8;',
      'This is everything AntCV has stored about you — the ground truth behind every CV and cover letter it writes. ' +
      'Review it, fix anything wrong, and it is used as-is. Nothing here leaves your device until you export or generate.'));

    // 1 — Identity & contact (editable)
    var s1 = rdSection('👤', 'Identity & contact', 'Your name and contact block. Edits save instantly.');
    s1.body.appendChild(rdField('Full name', pi.name, function (v) { patch({ name: v }); }));
    s1.body.appendChild(rdField('Headline / specialization line', pi.headline, function (v) { patch({ headline: v }); }));
    var grid = rdEl('div', 'display:grid;grid-template-columns:1fr 1fr;gap:0 10px;');
    grid.appendChild(rdField('Email', pi.email, function (v) { patch({ email: v }); }));
    grid.appendChild(rdField('Phone', pi.phone, function (v) { patch({ phone: v }); }));
    grid.appendChild(rdField('Location', pi.location, function (v) { patch({ location: v }); }));
    grid.appendChild(rdField('Citizenship', pi.citizenship, function (v) { patch({ citizenship: v }); }));
    s1.body.appendChild(grid);
    s1.body.appendChild(rdField('LinkedIn', pi.linkedin, function (v) { patch({ linkedin: v }); }));
    // Headline variants — the positioning lines AntCV picks from per application type.
    var HV = (pi.headlines && typeof pi.headlines === 'object') ? pi.headlines : {};
    var HV_LABELS = { unsolicited: 'Unsolicited / general', photonicsEO: 'Photonics / electro-optics', commercialProduct: 'Commercial / product', broad: 'Broad IT / business analysis' };
    var HV_KEYS = ['unsolicited', 'photonicsEO', 'commercialProduct', 'broad'];
    Object.keys(HV).forEach(function (k) { if (HV_KEYS.indexOf(k) < 0) HV_KEYS.push(k); });
    var hvWrap = rdEl('div', 'margin:9px 0 2px;padding-top:9px;border-top:1px solid rgba(255,255,255,.08);');
    hvWrap.appendChild(rdEl('div', 'font-size:10px;text-transform:uppercase;letter-spacing:.5px;opacity:.55;margin-bottom:5px;', 'Headline variants — picked per application type'));
    HV_KEYS.forEach(function (k) {
      hvWrap.appendChild(rdField(HV_LABELS[k] || k, HV[k] || '', function (v) {
        var cur = rdReadPI(); var h = (cur.headlines && typeof cur.headlines === 'object') ? cur.headlines : {}; h[k] = v; cur.headlines = h; rdSavePI(cur);
      }));
    });
    s1.body.appendChild(hvWrap);
    s1.body.appendChild(rdTip('Phone is hidden on the CV by default — toggle visibility in the “What’s shown” section below.'));
    body.appendChild(s1.sec);

    // 2 — Professional summary (editable)
    var s2 = rdSection('📝', 'Professional summary', 'The main context the AI uses for who you are.');
    s2.body.appendChild(rdField('Background', pi.background, function (v) { patch({ background: v }); }, true));
    s2.body.appendChild(rdTip('Keep it factual and 2–4 sentences. This is not a contact field — it is the “about you” the writer reads first.'));
    body.appendChild(s2.sec);

    // 3 — Work history (editable role cards)
    body.appendChild(rdWorkHistory(pi.experience));

    // 4 — Semantic constraints (read-friendly)
    var rules = (function () {
      var v2 = Array.isArray(sp.semanticConstraintsV2) ? sp.semanticConstraintsV2 : [];
      var bc = Array.isArray(sp.bannedContextual) ? sp.bannedContextual : [];
      var src = v2.length ? v2 : bc;
      return src.map(function (r) {
        var sc = r.scope || r.when || r.context || {};
        return {
          trigger: String(r.trigger || ''),
          avoid: rdArr(r.avoid != null ? r.avoid : r.pattern),
          prefer: rdArr(r.prefer != null ? r.prefer : (r.use_instead != null ? r.use_instead : r.replacement)),
          scope: String(sc.role_company || sc.companyContains || sc.role_title || sc.titleContains || '')
        };
      }).filter(function (r) { return r.avoid.length || r.trigger; });
    })();
    var s4 = rdSection('🎯', 'Semantic constraints (' + rules.length + ')', 'Rules that steer wording by meaning — avoid X, prefer Y, optionally only for certain roles.');
    rules.forEach(function (r) {
      var rc = rdEl('div', 'padding:7px 0;border-top:1px solid rgba(255,255,255,.06);display:flex;flex-direction:column;gap:5px;');
      var th = rdEl('div', 'display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;');
      th.appendChild(rdEl('span', 'font-size:12px;', r.trigger || 'general rule'));
      if (r.scope) th.appendChild(rdPill('scope: ' + r.scope, false));
      rc.appendChild(th);
      var ap = rdEl('div', 'display:flex;gap:6px;align-items:center;flex-wrap:wrap;');
      ap.appendChild(rdEl('span', 'font-size:10px;color:#f3b4b3;', 'avoid'));
      ap.appendChild(rdChips(r.avoid, 'rgba(229,75,74,.16)', '#f3b4b3'));
      ap.appendChild(rdEl('span', 'font-size:12px;opacity:.5;', '→'));
      ap.appendChild(rdEl('span', 'font-size:10px;color:#bdf0f1;', 'prefer'));
      ap.appendChild(rdChips(r.prefer, 'rgba(1,183,187,.16)', '#bdf0f1'));
      rc.appendChild(ap);
      s4.body.appendChild(rc);
    });
    if (!rules.length) s4.body.appendChild(rdEl('div', 'font-size:11px;opacity:.45;', 'No semantic constraints set.'));
    s4.body.appendChild(rdTip('Edit these in Settings → Personal → Tone & banned terms → Semantic constraints.'));
    body.appendChild(s4.sec);

    // 5 — Banned terms & tone (read)
    function splitList(v) { return String(v || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean); }
    var s5 = rdSection('🚫', 'Banned words, phrases & tone', 'Terms the writer must never use, and the tone it should keep.');
    var bw = rdEl('div', 'display:flex;flex-direction:column;gap:3px;');
    bw.appendChild(rdEl('div', 'font-size:10px;text-transform:uppercase;letter-spacing:.5px;opacity:.55;', 'banned words'));
    bw.appendChild(rdChips(splitList(sp.banned_words), 'rgba(229,75,74,.14)', '#f3b4b3'));
    s5.body.appendChild(bw);
    var bph = rdEl('div', 'display:flex;flex-direction:column;gap:3px;');
    bph.appendChild(rdEl('div', 'font-size:10px;text-transform:uppercase;letter-spacing:.5px;opacity:.55;', 'banned phrases'));
    bph.appendChild(rdChips(splitList(sp.banned_phrases), 'rgba(229,75,74,.14)', '#f3b4b3'));
    s5.body.appendChild(bph);
    var bt = rdEl('div', 'display:flex;flex-direction:column;gap:3px;');
    bt.appendChild(rdEl('div', 'font-size:10px;text-transform:uppercase;letter-spacing:.5px;opacity:.55;', 'preferred tone'));
    bt.appendChild(rdChips(splitList(sp.preferred_tone), 'rgba(1,183,187,.14)', '#bdf0f1'));
    s5.body.appendChild(bt);
    body.appendChild(s5.sec);

    // 6 — Languages (read)
    var langs = Array.isArray(pi.languages) ? pi.languages : [];
    var s6 = rdSection('🗣️', 'Languages', 'Languages and levels — used for both writing language and CV content.');
    if (langs.length) {
      langs.forEach(function (l) {
        var row = rdEl('div', 'display:flex;gap:8px;align-items:baseline;padding:3px 0;');
        row.appendChild(rdEl('span', 'font-size:12.5px;font-weight:600;min-width:90px;', l.lang || ''));
        row.appendChild(rdEl('span', 'font-size:11.5px;opacity:.7;', [l.level, l.note].filter(Boolean).join(' — ')));
        s6.body.appendChild(row);
      });
    } else { s6.body.appendChild(rdEl('div', 'font-size:11px;opacity:.45;', 'No languages stored.')); }
    body.appendChild(s6.sec);

    // 7 — CV sidebar content (structured row editors — replaces the pipe textareas)
    body.appendChild(rdEl('div', 'font-size:13px;font-weight:700;margin:6px 0 0;', '📎  CV sidebar content'));
    body.appendChild(rdEl('div', 'font-size:11px;opacity:.6;line-height:1.45;margin:0 0 2px;', 'The structured side column. Edits save instantly and flow into new CVs (existing drafts keep theirs until re-applied). Group headings are preserved.'));
    body.appendChild(rdSidebarSection({ emoji: '🔧', title: 'Tools & methods', help: 'Label + value per row; add group headings to organise.', key: 'tools', kind: 'lv', grouped: true, cols: ['Label', 'Value'] }, pi.tools));
    body.appendChild(rdSidebarSection({ emoji: '🎓', title: 'Education', help: 'Degree + school / details per row.', key: 'education', kind: 'degsch', cols: ['Degree', 'School / details'] }, pi.education));
    body.appendChild(rdSidebarSection({ emoji: '📜', title: 'Certifications', help: 'One per row.', key: 'certifications', kind: 'str', cols: ['Certification'] }, pi.certifications));
    body.appendChild(rdSidebarSection({ emoji: '📐', title: 'Regulatory / standards', help: 'Code + description per row; add group headings to organise.', key: 'regulatory', kind: 'lv', grouped: true, cols: ['Code', 'Description'] }, pi.regulatory));
    body.appendChild(rdSidebarSection({ emoji: '➕', title: 'Additional info', help: 'Label + value per row.', key: 'additional', kind: 'lv', cols: ['Label', 'Value'] }, pi.additional));

    // 8 — What's shown vs hidden (editable toggles)
    var vc = pi.visibilityControls || {};
    var s8 = rdSection('👁️', 'What’s shown on the CV', 'Quick toggles for the optional blocks. These apply as defaults.');
    [
      ['Phone number', 'showPhoneByDefault', false],
      ['Citizenship', 'showCitizenshipByDefault', true],
      ['Accessibility note', 'showAccessibilityByDefault', false],
      ['Patent', 'showPatentByDefault', true],
      ['Publications', 'showPublicationsByDefault', true],
      ['Photo', 'showPhotoByDefault', false]
    ].forEach(function (t) {
      var has = Object.prototype.hasOwnProperty.call(vc, t[1]);
      var row = rdEl('label', 'display:flex;align-items:center;gap:9px;padding:4px 0;cursor:pointer;font-size:12.5px;');
      var cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = has ? !!vc[t[1]] : !!t[2];
      cb.style.cssText = 'flex:0 0 auto;width:15px;height:15px;accent-color:#01B7BB;';
      cb.addEventListener('change', function () { patchVis(t[1], cb.checked); });
      row.appendChild(cb); row.appendChild(rdEl('span', null, t[0]));
      s8.body.appendChild(row);
    });
    body.appendChild(s8.sec);

    // Footer
    var foot = rdEl('div', 'border-top:1px solid rgba(255,255,255,.10);padding:13px 18px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;');
    var exp = rdEl('button', 'flex:1;min-width:200px;padding:11px;background:rgba(1,183,187,0.14);border:1px solid rgba(1,183,187,0.5);' +
      'color:#bdf0f1;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;', '🔒 Export (account-locked)');
    exp.type = 'button';
    exp.title = 'Encrypted and locked to your account — only you (signed in) can import it back.';
    exp.addEventListener('click', function () {
      exp.disabled = true; var p = exp.textContent; exp.textContent = '🔒 Encrypting…';
      exportUserBound().then(function (r) { exp.textContent = (r && r.ok) ? '✓ Saved ' + (r.filename || 'file') : p; setTimeout(function () { exp.textContent = p; exp.disabled = false; }, 2600); })
        .catch(function (err) { exp.textContent = '⚠ ' + ((err && err.message) || 'Failed'); setTimeout(function () { exp.textContent = p; exp.disabled = false; }, 3600); });
    });
    foot.appendChild(exp);
    var done = rdEl('button', 'padding:11px 18px;background:transparent;border:1px solid rgba(255,255,255,.2);color:#e6eef3;border-radius:8px;font-size:13px;cursor:pointer;', 'Done');
    done.type = 'button'; done.addEventListener('click', close);
    foot.appendChild(done);
    card.appendChild(foot);

    } catch (__e) {
      try {
        console.error('[review-modal] section build failed:', __e);
        if (body) body.appendChild(rdEl('div', 'color:#f3b4b3;font-size:12px;padding:8px 0;', '⚠ Some sections failed to load: ' + ((__e && __e.message) || __e)));
      } catch (_) {}
    }
  }
  window.AntcvReviewData = openReview;

  function buildReviewButton() {
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute(UI_MARK, 'review');
    b.textContent = '📋 Review & Edit my data';
    b.title = 'See and edit everything AntCV has stored about you — it is used as-is.';
    b.style.cssText = 'display:block;width:100%;margin:0 0 8px;padding:12px;' +
      'background:rgba(90,150,230,0.12);border:1px solid rgba(90,150,230,0.5);' +
      'color:#bcd6ff;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;';
    b.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      try { openReview(); }
      catch (err) { try { console.error('[review-modal] open failed:', err); alert('Review & Edit my data could not open: ' + ((err && err.message) || err)); } catch (_) {} }
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

  // The writing-style picker island mounts ONLY in Settings -> Personal, so it
  // is a reliable anchor for the Personal flex column.
  function findPersonalColumn() {
    var anchor = document.getElementById('antcv-react-writing-style-picker')
      || document.querySelector('[data-antcv-react-mount="writing-style-picker"]');
    if (!anchor) return null;
    var el = anchor;
    for (var i = 0; i < 8 && el && el.parentNode && el.parentNode !== document.body; i++) {
      el = el.parentNode;
      try {
        var cs = getComputedStyle(el);
        if (cs.display === 'flex' && /column/.test(cs.flexDirection)) return el;
      } catch (_) {}
    }
    return anchor.parentNode || null;
  }

  // PERSONAL-MERGE-1 (owner 2026-06-24): the Review & Edit + account-locked
  // export controls move OUT of the Account privacy zone and INTO Settings ->
  // Personal (the modal is now the single review/edit surface, launched from
  // Personal). Anchored to the top of the Personal flex column via order:-20.
  function injectLauncher() {
    var col = findPersonalColumn();
    if (!col) return;
    if (col.querySelector('[' + UI_MARK + '="launcher"]')) return;
    // Remove any stale privacy-zone / older-build copies before re-homing.
    try {
      var stale = document.querySelectorAll(
        '[' + UI_MARK + '="review"],[' + UI_MARK + '="locked"],[' + UI_MARK + '="download"],[' + UI_MARK + '="launcher"]');
      Array.prototype.forEach.call(stale, function (n) { try { n.remove(); } catch (_) {} });
    } catch (_) {}
    try {
      var wrap = document.createElement('div');
      wrap.setAttribute(UI_MARK, 'launcher');
      wrap.style.cssText = 'order:-20;display:flex;flex-direction:column;margin:0 0 6px;';
      wrap.appendChild(buildReviewButton());
      wrap.appendChild(buildLockedButton());
      col.insertBefore(wrap, col.firstChild);
    } catch (_) {}
  }

  // Account-locked export FAB, mounted LITERALLY beside the floating 📥 importer
  // chip (antcv-data-importer.js .antcv-import-fab) so export + import sit
  // together (owner 2026-06-17). Mirrors the importer FAB's fixed position and
  // offsets it 52px to the right.
  function mountExportFab() {
    if (disabled()) return;
    if (document.querySelector('.antcv-export-fab')) return;
    var imp = document.querySelector('.antcv-import-fab');
    if (!imp) return; // wait for the importer FAB to exist
    var cs = getComputedStyle(imp);
    var b = document.createElement('button');
    b.className = 'antcv-export-fab';
    b.type = 'button';
    b.textContent = '🔒';
    b.title = 'Export my settings, locked to my account (no passphrase — only I can import it back)';
    var leftPx = parseFloat(cs.left); if (isNaN(leftPx)) leftPx = 16;
    b.style.cssText = 'position:fixed;z-index:99998;bottom:' + cs.bottom + ';left:' + (leftPx + 52) + 'px;' +
      'width:44px;height:44px;border-radius:50%;background:#283556;color:#fff;border:none;cursor:pointer;' +
      'font-size:17px;box-shadow:0 2px 8px rgba(0,0,0,0.18);display:flex;align-items:center;justify-content:center;transition:background .15s;';
    b.addEventListener('mouseenter', function () { b.style.background = '#01B7BB'; });
    b.addEventListener('mouseleave', function () { b.style.background = '#283556'; });
    b.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      var prev = b.textContent; b.disabled = true; b.textContent = '⏳';
      exportUserBound().then(function () { b.textContent = '✓'; setTimeout(function () { b.textContent = prev; b.disabled = false; }, 1800); })
        .catch(function (err) { b.textContent = '⚠'; b.title = (err && err.message) || 'Export failed'; setTimeout(function () { b.textContent = prev; b.disabled = false; }, 2600); });
    });
    document.body.appendChild(b);
  }

  function injectUi() {
    if (disabled()) return;
    injectLauncher();
    injectCheckbox();
    mountExportFab();
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
    openReview: openReview,
    _injectUi: injectUi,
    _findEraseButton: findEraseButton,
    _findPrivacyProvidersBox: findPrivacyProvidersBox,
    _findPersonalColumn: findPersonalColumn,
    _setSaveFirst: function (v) { saveFirst = !!v; },
    _saveFirst: function () { return saveFirst; }
  };
})();
