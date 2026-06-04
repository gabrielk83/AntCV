/* AntCV — user data export (DATA-EXPORT-001)
 * ============================================================
 *
 * Pure, dependency-free module: collect the user's stored data, wrap it in a
 * versioned envelope, and passphrase-encrypt it (owner decision 2026-06-04:
 * the export is CRYPTO, not plain JSON).
 *
 * Crypto: PBKDF2(SHA-256, 200k) derives an AES-GCM-256 key from the passphrase
 * + a random salt; AES-GCM with a random IV encrypts the JSON. The output
 * envelope carries the salt + IV (not secret) so decrypt only needs the
 * passphrase. WebCrypto is a global in both the browser and Node 18+, so this
 * file runs unmodified in the PWA and under `node --test`.
 *
 * Used by: the Personal-menu "download my data" action (DATA-EXPORT-001) and
 * the erase flow's "save first" checkbox (DELETE-SAVE-001). DOM/menu wiring
 * lives in app.js; this module is the tested core.
 */

const ENVELOPE_VERSION = 1;
const PBKDF2_ITERS = 200000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

// The localStorage keys that make up "the user's data + personal analytics".
// Kept here so the importer/exporter agree on the contract.
const DEFAULT_EXPORT_KEYS = [
  'personalInfo',
  'meta',
  'sections',
  'writingPrefs',
  'antcv.writingPrefs.v1',
  'styleConfig',
  'fontSizes',
  'language',
  'stylePackage',
  'photoShape',
  'antcv:itemPages',
  'analytics',
  'antcv.analytics',
];

function getWebCrypto() {
  const c = (typeof globalThis !== 'undefined' && globalThis.crypto) || null;
  if (!c || !c.subtle) {
    throw new Error('WebCrypto (crypto.subtle) is unavailable in this environment.');
  }
  return c;
}

// Portable base64 (btoa/atob are globals in browser AND Node 18+).
function bytesToB64(bytes) {
  let bin = '';
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin);
}
function b64ToBytes(b64) {
  const bin = atob(String(b64 || ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Read the export keys out of a storage-like object (anything with getItem,
 * e.g. window.localStorage or a plain test double). Missing keys are skipped.
 * JSON values are parsed where possible so the envelope holds structured data.
 */
function collectExportData(storage, keys = DEFAULT_EXPORT_KEYS) {
  if (!storage || typeof storage.getItem !== 'function') {
    throw new Error('collectExportData requires a storage object with getItem().');
  }
  const data = {};
  for (const key of keys) {
    const raw = storage.getItem(key);
    if (raw == null) continue;
    try {
      data[key] = JSON.parse(raw);
    } catch (_) {
      data[key] = raw; // non-JSON value (e.g. a plain string) stored verbatim
    }
  }
  return data;
}

/** Wrap collected data in a versioned, timestamped envelope (pre-encryption). */
function buildEnvelope(data, meta = {}) {
  return {
    app: 'AntCV',
    kind: 'user-data-export',
    version: ENVELOPE_VERSION,
    exportedAt: meta.exportedAt || new Date().toISOString(),
    data: data || {},
  };
}

async function deriveKey(crypto, passphrase, salt) {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(String(passphrase)),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt an envelope object with a passphrase. Returns a JSON-serialisable
 * encrypted envelope (salt + iv + ciphertext, all base64). Throws on an empty
 * passphrase — an unprotected "protected file" is a bug, not a fallback.
 */
async function encryptEnvelope(envelope, passphrase) {
  if (!passphrase || String(passphrase).length === 0) {
    throw new Error('A passphrase is required to encrypt the export.');
  }
  const crypto = getWebCrypto();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(crypto, passphrase, salt);
  const plaintext = new TextEncoder().encode(JSON.stringify(envelope));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return {
    app: 'AntCV',
    kind: 'user-data-export-encrypted',
    version: ENVELOPE_VERSION,
    cipher: 'AES-GCM',
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: PBKDF2_ITERS },
    salt: bytesToB64(salt),
    iv: bytesToB64(iv),
    ciphertext: bytesToB64(new Uint8Array(ct)),
  };
}

/** Reverse encryptEnvelope. Throws if the passphrase is wrong (GCM auth fail). */
async function decryptEnvelope(encrypted, passphrase) {
  if (!encrypted || encrypted.kind !== 'user-data-export-encrypted') {
    throw new Error('Not an AntCV encrypted export envelope.');
  }
  const crypto = getWebCrypto();
  const salt = b64ToBytes(encrypted.salt);
  const iv = b64ToBytes(encrypted.iv);
  const key = await deriveKey(crypto, passphrase, salt);
  let plaintext;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      b64ToBytes(encrypted.ciphertext)
    );
  } catch (_) {
    throw new Error('Decryption failed — wrong passphrase or corrupted file.');
  }
  return JSON.parse(new TextDecoder().decode(plaintext));
}

/** One-call convenience: storage + passphrase → encrypted envelope. */
async function exportEncrypted(storage, passphrase, opts = {}) {
  const data = collectExportData(storage, opts.keys);
  const envelope = buildEnvelope(data, { exportedAt: opts.exportedAt });
  return encryptEnvelope(envelope, passphrase);
}

/** A safe default download filename (no PII, sortable). */
function exportFilename(date = new Date()) {
  const stamp = date.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `antcv-data-${stamp}.antcv.json`;
}

const api = {
  ENVELOPE_VERSION,
  DEFAULT_EXPORT_KEYS,
  collectExportData,
  buildEnvelope,
  encryptEnvelope,
  decryptEnvelope,
  exportEncrypted,
  exportFilename,
};

// Dual export: ES module (tests) + browser global (app.js sidecar use).
export default api;
export {
  ENVELOPE_VERSION,
  DEFAULT_EXPORT_KEYS,
  collectExportData,
  buildEnvelope,
  encryptEnvelope,
  decryptEnvelope,
  exportEncrypted,
  exportFilename,
};
if (typeof window !== 'undefined') {
  window.AntcvDataExport = api;
}
