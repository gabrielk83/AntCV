/* DIAGNOSTIC — SETTINGS-SYNC-EXTRA-001 (owner 2026-06-18).
 * Asserts the 6 previously-unsynced standalone settings keys now round-trip
 * PUT /api/prefs -> GET /api/prefs (they were dropped because they were not in
 * the kernel-prefs allowlist). Types: photoPosition (STR), photoSize (NUM),
 * exportPwEnabled (BOOL), enabledProviders / customTopbarPalette / topbarOrder
 * (OBJ). Run: node test/diag-settings-sync-extra.mjs */
import { writeSync } from 'node:fs';
const log = (...a) => writeSync(1, a.join(' ') + '\n');
const relay = (await import('../src/index.js')).default;

const SECRET = 'settings-extra-secret-0123456789abcdef0123456789';
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
async function call(method, path, token, db, bodyObj) {
  const init = { method, headers: { 'Origin': ORIGIN, 'Authorization': 'Bearer ' + token } };
  if (bodyObj !== undefined) { init.headers['content-type'] = 'application/json'; init.body = JSON.stringify(bodyObj); }
  const res = await relay.fetch(new Request('https://relay.example.com' + path, init), env(db), { waitUntil: () => {} });
  let body = null; try { body = await res.json(); } catch (_) {}
  return { status: res.status, body };
}

const EXTRA = {
  photoPosition: 'sidebar_top',
  photoSize: 140,
  exportPwEnabled: true,
  enabledProviders: { anthropic: true, openai: false, gemini: true },
  customTopbarPalette: { bg: '#123456', fg: '#ffffff' },
  topbarOrder: ['name', 'specialisation', 'contact'],
};

const token = await mint(EMAIL);
const db = mockDB(null);

const putRes = await call('PUT', '/api/prefs', token, db, EXTRA);
const saved = (putRes.body && putRes.body.saved) || [];
const dropped = (putRes.body && putRes.body.dropped) || [];
log('PUT status:', putRes.status, '| saved:', saved.join(','), '| dropped:', dropped.join(',') || '(none)');

const getRes = await call('GET', '/api/prefs', token, db);
const prefs = (getRes.body && getRes.body.prefs) || {};

let pass = putRes.status === 200 && getRes.status === 200;
const bad = [];
for (const k of Object.keys(EXTRA)) {
  if (JSON.stringify(prefs[k]) !== JSON.stringify(EXTRA[k])) bad.push(k + ' (got ' + JSON.stringify(prefs[k]) + ')');
  if (dropped.includes(k)) bad.push(k + ' (DROPPED)');
}
if (bad.length) { pass = false; log('FAILED keys:', bad.join('; ')); }
else log('All 6 settings keys round-tripped PUT->GET intact (none dropped).');

log(pass ? 'SETTINGS-SYNC-EXTRA OK' : 'SETTINGS-SYNC-EXTRA FAIL');
process.exitCode = pass ? 0 : 1;
