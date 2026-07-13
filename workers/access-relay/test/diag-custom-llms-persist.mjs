/* DIAGNOSTIC — CUSTOM-LLM-OVERHAUL-001 remaining leg (relay persist).
 * Asserts the `customLlms` registry (antcv-llm-lab-408.js's 'antcv:customLlms')
 * now round-trips PUT /api/prefs -> GET /api/prefs. It was dropped before because
 * it was not in the kernel-prefs allowlist, so a fresh device lost the registry.
 * Also asserts the array survives intact and that a keyless (secret-stripped)
 * shape — which is what the client pushes — persists correctly.
 * Run: node test/diag-custom-llms-persist.mjs */
import { writeSync } from 'node:fs';
const log = (...a) => writeSync(1, a.join(' ') + '\n');
const relay = (await import('../src/index.js')).default;

const SECRET = 'custom-llms-secret-0123456789abcdef0123456789ab';
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

// The keyless shape the client pushes (secret `key` stripped before upload).
const CUSTOM_LLMS = [
  { id: 'llm1a2b3c', label: 'Local Qwen', baseUrl: 'https://box.example.com/v1', model: 'qwen2.5-72b',
    pricing: { inputPer1M: 0, outputPer1M: 0 }, status: 'approved', addedAt: '2026-07-13T10:00:00.000Z',
    audit: { fit: 'general', score: 0.82 } },
  { id: 'llm4d5e6f', label: 'Mixtral endpoint', baseUrl: 'https://mix.example.com/v1', model: 'mixtral-8x22b',
    pricing: { inputPer1M: 0.6, outputPer1M: 0.6 }, status: 'pending', addedAt: '2026-07-13T10:05:00.000Z' },
];

const token = await mint(EMAIL);
const db = mockDB(null);

const putRes = await call('PUT', '/api/prefs', token, db, { customLlms: CUSTOM_LLMS });
const saved = (putRes.body && putRes.body.saved) || [];
const dropped = (putRes.body && putRes.body.dropped) || [];
log('PUT status:', putRes.status, '| saved:', saved.join(','), '| dropped:', dropped.join(',') || '(none)');

const getRes = await call('GET', '/api/prefs', token, db);
const prefs = (getRes.body && getRes.body.prefs) || {};

let pass = putRes.status === 200 && getRes.status === 200;
if (dropped.includes('customLlms')) { pass = false; log('FAIL — customLlms was DROPPED by the allowlist'); }
if (JSON.stringify(prefs.customLlms) !== JSON.stringify(CUSTOM_LLMS)) {
  pass = false; log('FAIL — customLlms did not round-trip intact. got:', JSON.stringify(prefs.customLlms));
} else {
  log('PASS — customLlms (2 keyless records) round-tripped PUT->GET intact');
}
// Secret boundary: the persisted shape must carry no `key` field.
const leaked = Array.isArray(prefs.customLlms) && prefs.customLlms.some((r) => r && 'key' in r);
if (leaked) { pass = false; log('FAIL — a `key` secret leaked into persisted customLlms'); }
else log('PASS — no `key` secret present in the persisted records');

log(pass ? 'CUSTOM-LLMS-PERSIST OK' : 'CUSTOM-LLMS-PERSIST FAIL');
process.exitCode = pass ? 0 : 1;
