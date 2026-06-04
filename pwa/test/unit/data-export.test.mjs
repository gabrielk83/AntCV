// Unit tests for the DATA-EXPORT-001 encrypted-export contract.
// Pure logic, no DOM, uses the global WebCrypto (Node 18+). Run with:
//   node --test pwa/test/unit/
//
// Covers key collection from a storage double, the envelope shape, the
// passphrase-encrypt round-trip, wrong-passphrase rejection, the
// no-passphrase guard, and a stable, PII-free filename.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_EXPORT_KEYS,
  collectExportData,
  buildEnvelope,
  encryptEnvelope,
  decryptEnvelope,
  exportEncrypted,
  exportFilename,
} from '../../lib/data-export.js';

// Minimal localStorage double.
function makeStorage(obj) {
  return { getItem: (k) => (k in obj ? obj[k] : null) };
}

// ─── collectExportData ─────────────────────────────────────────────────────
test('collectExportData parses JSON values and skips missing keys', () => {
  const storage = makeStorage({
    personalInfo: JSON.stringify({ name: 'Anita', workHistory: [1, 2, 3] }),
    language: 'da', // non-JSON plain string
    // sections intentionally absent
  });
  const data = collectExportData(storage);
  assert.deepEqual(data.personalInfo, { name: 'Anita', workHistory: [1, 2, 3] });
  assert.equal(data.language, 'da'); // verbatim when not JSON
  assert.ok(!('sections' in data)); // missing keys skipped
});

test('collectExportData honours a custom key list', () => {
  const storage = makeStorage({ a: '1', b: '"two"', c: 'x' });
  const data = collectExportData(storage, ['a', 'b']);
  assert.deepEqual(data, { a: 1, b: 'two' });
  assert.ok(!('c' in data));
});

test('collectExportData rejects a non-storage argument', () => {
  assert.throws(() => collectExportData({}), /getItem/);
});

test('DEFAULT_EXPORT_KEYS includes the core user-data keys', () => {
  for (const k of ['personalInfo', 'sections', 'writingPrefs']) {
    assert.ok(DEFAULT_EXPORT_KEYS.includes(k), `missing ${k}`);
  }
});

// ─── buildEnvelope ─────────────────────────────────────────────────────────
test('buildEnvelope wraps data with app/version/timestamp', () => {
  const env = buildEnvelope({ personalInfo: { name: 'A' } }, { exportedAt: '2026-06-04T00:00:00Z' });
  assert.equal(env.app, 'AntCV');
  assert.equal(env.kind, 'user-data-export');
  assert.equal(env.version, 1);
  assert.equal(env.exportedAt, '2026-06-04T00:00:00Z');
  assert.deepEqual(env.data.personalInfo, { name: 'A' });
});

// ─── encrypt / decrypt round-trip ──────────────────────────────────────────
test('encryptEnvelope → decryptEnvelope round-trips the data', async () => {
  const env = buildEnvelope({ personalInfo: { name: 'Anita', secret: 42 } });
  const enc = await encryptEnvelope(env, 'correct horse battery staple');

  // Envelope is structurally an encrypted blob, not the plaintext.
  assert.equal(enc.kind, 'user-data-export-encrypted');
  assert.equal(enc.cipher, 'AES-GCM');
  assert.ok(enc.salt && enc.iv && enc.ciphertext);
  assert.ok(!JSON.stringify(enc).includes('Anita')); // plaintext not leaked

  const back = await decryptEnvelope(enc, 'correct horse battery staple');
  assert.deepEqual(back.data.personalInfo, { name: 'Anita', secret: 42 });
});

test('decryptEnvelope fails with the wrong passphrase', async () => {
  const enc = await encryptEnvelope(buildEnvelope({ x: 1 }), 'right');
  await assert.rejects(decryptEnvelope(enc, 'wrong'), /wrong passphrase or corrupted/i);
});

test('encryptEnvelope refuses an empty passphrase', async () => {
  await assert.rejects(encryptEnvelope(buildEnvelope({ x: 1 }), ''), /passphrase is required/i);
});

test('two encryptions of the same data differ (random salt + iv)', async () => {
  const env = buildEnvelope({ x: 1 });
  const a = await encryptEnvelope(env, 'pw');
  const b = await encryptEnvelope(env, 'pw');
  assert.notEqual(a.ciphertext, b.ciphertext);
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(a.iv, b.iv);
});

// ─── exportEncrypted convenience ───────────────────────────────────────────
test('exportEncrypted collects + encrypts from storage in one call', async () => {
  const storage = makeStorage({ personalInfo: JSON.stringify({ name: 'A' }) });
  const enc = await exportEncrypted(storage, 'pw');
  const back = await decryptEnvelope(enc, 'pw');
  assert.deepEqual(back.data.personalInfo, { name: 'A' });
});

// ─── exportFilename ────────────────────────────────────────────────────────
test('exportFilename is stable, sortable, and carries no PII', () => {
  const name = exportFilename(new Date('2026-06-04T13:45:09Z'));
  assert.equal(name, 'antcv-data-2026-06-04-13-45-09.antcv.json');
});
