/* DIAGNOSTIC — PHOTO-BINARY-NOT-IN-KERNEL-001 (owner 2026-06-18).
 * kernel-v2 personalFigure rule: store_binary_in_kernel:false. The photo BINARY
 * must live in the D1 photo_b64 column, NOT the identity blob (where 'photo' in
 * PI_IDENTITY_KEYS would otherwise route a stray personalInfo.photo). Asserts:
 *   A. a personalInfo carrying an embedded photo data-URL -> binary in photo_b64,
 *      NOT in identity; the rest of identity intact.
 *   B. a normal top-level photo PUT still lands in photo_b64 (regression).
 * Run: node test/diag-photo-binary-not-in-kernel.mjs */
import { writeSync } from 'node:fs';
const log = (...a) => writeSync(1, a.join(' ') + '\n');
const relay = (await import('../src/index.js')).default;

const SECRET = 'photo-binary-secret-0123456789abcdef0123456789ab';
const EMAIL = 'karp.gabriel.a@gmail.com';
const ORIGIN = 'https://antcv.pages.dev';

function b64url(b) { let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
async function mint(email) {
  const enc = new TextEncoder(); const now = Math.floor(Date.now() / 1000);
  const h = b64url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const p = b64url(enc.encode(JSON.stringify({ sub: email, email, iat: now, exp: now + 3600, iss: 'antcv-access-relay' })));
  const key = await crypto.subtle.importKey('raw', enc.encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${h}.${p}`));
  return `${h}.${p}.${b64url(new Uint8Array(sig))}`;
}
function mockDB(row) {
  return {
    _row: () => row,
    prepare(sql) {
      return { bind(...args) { return {
        async first() { if (/FROM user_kernel/.test(sql)) return row; return null; },
        async run() { if (/INSERT INTO user_kernel/.test(sql)) { row = { user_hash: args[0], identity: args[1], history: args[2], preferences: args[3], photo_b64: args[4], created_at: args[5], updated_at: args[6] }; } return { success: true, meta: {} }; },
      }; } };
    },
    async batch() { return []; },
  };
}
function kvMock() { const m = new Map(); return { async get(k) { return m.has(k) ? m.get(k) : null; }, async put(k, v) { m.set(k, v); }, async delete(k) { m.delete(k); } }; }
function env(db) { return { JWT_SECRET: SECRET, DB: db, KV_BINDING: kvMock(), ALLOWED_ORIGINS: ORIGIN }; }
async function put(token, db, bodyObj) {
  const res = await relay.fetch(new Request('https://relay.example.com/api/prefs', {
    method: 'PUT', headers: { 'content-type': 'application/json', 'Origin': ORIGIN, 'Authorization': 'Bearer ' + token }, body: JSON.stringify(bodyObj),
  }), env(db), { waitUntil: () => {} });
  let body = null; try { body = await res.json(); } catch (_) {}
  return { status: res.status, body, row: db._row() };
}

const BINARY = 'data:image/png;base64,' + 'A'.repeat(2000);
const token = await mint(EMAIL);

// A — embedded personalInfo.photo binary
const dbA = mockDB(null);
const a = await put(token, dbA, { personalInfo: { name: 'Gabriel K-G', email: EMAIL, headline: 'PM', photo: BINARY } });
const idA = JSON.parse(a.row && a.row.identity || '{}');
const photoInColumn = a.row && a.row.photo_b64 === BINARY;
const photoNotInIdentity = !('photo' in idA);
const identityIntact = idA.name === 'Gabriel K-G' && idA.headline === 'PM';
const A = a.status === 200 && photoInColumn && photoNotInIdentity && identityIntact;
log('A: photo_b64 has binary:', photoInColumn, '| identity has NO photo:', photoNotInIdentity, '| identity intact:', identityIntact);
log('  identity keys:', Object.keys(idA).join(','));
log('CHECK A (embedded photo binary -> column, not kernel): ' + (A ? 'PASS' : 'FAIL'));

// B — normal top-level photo PUT (regression)
const dbB = mockDB(null);
const b = await put(token, dbB, { photo: BINARY, personalInfo: { name: 'Gabriel K-G', email: EMAIL } });
const idB = JSON.parse(b.row && b.row.identity || '{}');
const B = b.status === 200 && b.row.photo_b64 === BINARY && !('photo' in idB);
log('CHECK B (top-level photo still -> column): ' + (B ? 'PASS' : 'FAIL'));

const ok = A && B;
log(ok ? 'PHOTO-BINARY-NOT-IN-KERNEL OK (2/2)' : 'PHOTO-BINARY-NOT-IN-KERNEL FAIL');
process.exitCode = ok ? 0 : 1;
