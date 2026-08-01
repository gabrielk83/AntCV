/* DIAGNOSTIC — FOREIGN-NIGHT-WRITER-2026-07-23.
 * At 04:37-04:42 an unidentified headless automation created an empty stub
 * application, MOVED THE GLOBAL ACTIVE POINTER onto it, and the owner's real
 * active application came back blank. Nothing on the row identified the writer.
 * POST /api/applications now (1) logs every stub creation with everything the
 * request says about its caller and (2) only lets a BROWSER-shaped caller move
 * the global pointer - "you just pasted a JD" is a browser expectation, and a
 * script that dies before restoring the pointer must not be able to leave it
 * moved.
 *   A. headless POST (no device_id, no fetch metadata) -> row created, pointer NOT moved
 *   B. PWA POST with device_id                          -> pointer moved
 *   C. browser POST without device_id (sec-fetch-site)  -> pointer still moved
 *   D. a stub creation is logged with UA / origin / ray / device_id
 * Run: node test/diag-foreign-writer-pointer-guard.mjs */
import { writeSync } from 'node:fs';
const log = (...a) => writeSync(1, a.join(' ') + '\n');
const relay = (await import('../src/index.js')).default;

const SECRET = 'guard-test-secret-0123456789abcdef0123456789abcd';
function b64url(bytes) { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
async function mint(email) {
  const enc = new TextEncoder(); const now = Math.floor(Date.now() / 1000);
  const h = b64url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const p = b64url(enc.encode(JSON.stringify({ sub: email, email, iat: now, exp: now + 3600, iss: 'antcv-access-relay' })));
  const key = await crypto.subtle.importKey('raw', enc.encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${h}.${p}`));
  return `${h}.${p}.${b64url(new Uint8Array(sig))}`;
}
function kvMock() { const m = new Map(); return { async get(k) { return m.has(k) ? m.get(k) : null; }, async put(k, v) { m.set(k, v); }, async delete(k) { m.delete(k); } }; }

/* Mock D1: one user_kernel row, and a freshly created (stub) application row.
 * Records active-pointer writes so the guard can be observed. */
function mockDB() {
  const pointerWrites = [];
  const row = { id: 2746, user_hash: 'HASH', jd_hash: 'JD', jd_text: 'nvidia ose jd',
                jd_company: 'NVIDIA', jd_role: 'OSE', subtitle: '', category: 'engineering_hardware',
                cv_sections: null, cl_sections: null, created_at: 1, updated_at: 1 };
  return {
    _pointerWrites: () => pointerWrites,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (/FROM user_kernel/.test(sql)) return { user_hash: 'HASH' };
              if (/COUNT\(\*\)/.test(sql)) return { n: 3 };
              if (/FROM application/.test(sql)) return row;
              return null;
            },
            async all() { return { results: [] }; },
            async run() {
              if (/INSERT INTO active_application\b/.test(sql)) {
                pointerWrites.push({ table: 'global', appId: args[1], deviceId: args[2] });
              }
              if (/INSERT INTO active_application_device/.test(sql)) {
                pointerWrites.push({ table: 'device', appId: args[2], deviceId: args[1] });
              }
              return { success: true, meta: {} };
            },
          };
        },
      };
    },
    async batch() { return []; },
  };
}

async function post(token, headers, bodyObj) {
  const db = mockDB();
  const env = { JWT_SECRET: SECRET, DB: db, KV_BINDING: kvMock(), ALLOWED_ORIGINS: 'https://antcv.pages.dev' };
  const res = await relay.fetch(new Request('https://relay.example.com/api/applications', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Origin: 'https://antcv.pages.dev', Authorization: 'Bearer ' + token, ...headers },
    body: JSON.stringify(bodyObj),
  }), env, { waitUntil: () => {} });
  let body = null; try { body = await res.json(); } catch (_) {}
  return { status: res.status, body, pointerWrites: db._pointerWrites() };
}

const BASE = { jd_text: 'nvidia ose jd', jd_company: 'NVIDIA', jd_role: 'OSE', category: 'engineering_hardware' };

let pass = true;
function check(name, ok) { log((ok ? 'PASS' : 'FAIL') + ' - ' + name); if (!ok) pass = false; }

// capture console.log so the identification line can be asserted
const lines = [];
const realLog = console.log;
console.log = (...a) => { lines.push(a.join(' ')); };

const token = await mint('karp.gabriel.a@gmail.com');

// A — headless: urllib sends no device_id and no fetch metadata
const a = await post(token, { 'user-agent': 'Mozilla/5.0 (AntCV gen-runner)' }, BASE);
// B — the PWA, which always sends device_id via AntcvJdScope.deviceId()
const b = await post(token, { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/141' },
                     { ...BASE, device_id: 'dev-abc-123' });
// C — a browser whose device_id is missing still carries fetch metadata
const c = await post(token, { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/141',
                              'sec-fetch-site': 'cross-site', 'cf-ray': '9abc-CPH' }, BASE);

console.log = realLog;

check('A headless POST still creates the application', a.status === 200 && !!(a.body && a.body.application));
check('A headless POST does NOT move the global pointer',
      a.pointerWrites.filter((w) => w.table === 'global').length === 0);
check('B PWA POST (device_id) moves the global pointer',
      b.pointerWrites.some((w) => w.table === 'global' && w.deviceId === 'dev-abc-123'));
check('B PWA POST also writes the per-device pointer',
      b.pointerWrites.some((w) => w.table === 'device' && w.deviceId === 'dev-abc-123'));
check('C browser without device_id still moves the pointer',
      c.pointerWrites.some((w) => w.table === 'global'));

// D — identification
const stub = lines.filter((l) => l.includes('STUB-CREATE'));
check('D every stub creation is logged', stub.length === 3);
check('D the log names the caller (ua, origin, device_id, ray)',
      stub.every((l) => /ua=/.test(l) && /origin=/.test(l) && /device_id=/.test(l) && /ray=/.test(l)));
check('D the headless line is identifiable as headless',
      stub.some((l) => /gen-runner/.test(l) && /browserish=false/.test(l)));
check('D a suppressed pointer write says so',
      lines.some((l) => /ACTIVE-POINTER-SUPPRESSED/.test(l)));

log('\n' + (pass ? 'PASS' : 'FAIL') + ' - FOREIGN-NIGHT-WRITER pointer guard + caller identification');
process.exit(pass ? 0 : 1);
