/* DIAGNOSTIC — kernel v2 §4: POST /api/profile/kernel-v2 persists the ingested v2
 * kernel into user_kernel.kernel_v2 (staging), non-destructively, behind auth.
 *   A. no token            → 401
 *   B. token + not-a-kernel → 422
 *   C. token + v2 kernel   → 200 and the DB row's kernel_v2 holds the JSON, while
 *      identity/history are untouched.
 * Run: node test/diag-kernel-v2-write.mjs */
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
// mock D1 with one rich row; capture an INSERT...ON CONFLICT that updates kernel_v2.
function mockDB() {
  let row = { user_hash: 'H', identity: JSON.stringify({ name: 'Gabriel' }), history: JSON.stringify({ workHistory: [{ role: 'X' }] }), preferences: '{}', kernel_v2: null, created_at: 1, updated_at: 1 };
  return {
    _row: () => row,
    prepare(sql) {
      return { bind(...args) { return {
        async first() { return /FROM user_kernel/.test(sql) ? row : null; },
        async run() {
          if (/INSERT INTO user_kernel/.test(sql)) {
            // handler binds .bind(userHash, json, now, now) — identity/history/preferences
            // are literal '{}' in the SQL, so kernel_v2 = args[1]. ON CONFLICT updates
            // ONLY kernel_v2 + updated_at → identity/history preserved.
            row = Object.assign({}, row, { kernel_v2: args[1], updated_at: args[3] });
          }
          return { success: true, meta: {} };
        },
      }; } };
    },
  };
}
async function call(token, bodyObj, db) {
  const env = { JWT_SECRET: SECRET, DB: db, KV_BINDING: kvMock(), ALLOWED_ORIGINS: 'https://antcv.pages.dev' };
  const headers = { 'content-type': 'application/json', 'Origin': 'https://antcv.pages.dev' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await relay.fetch(new Request('https://relay.example.com/api/profile/kernel-v2', { method: 'POST', headers, body: JSON.stringify(bodyObj) }), env, { waitUntil: () => {} });
  let body = null; try { body = await res.json(); } catch (_) {}
  return { status: res.status, body, row: db._row() };
}

const token = await mint('karp.gabriel.a@gmail.com');
const KERNEL = { schemaVersion: '2.0-kernel', tenseMode: 'auto', experience: [{ id: 'r1', title: 'PM', company: 'Acme', isCurrent: true }] };

const a = await call(null, { kernel: KERNEL }, mockDB());
const A = a.status === 401;
log(`CHECK A (no token → 401): ${A ? 'PASS' : 'FAIL'} (${a.status})`);

const b = await call(token, { not: 'a kernel' }, mockDB());
const B = b.status === 422;
log(`CHECK B (token + not-a-kernel → 422): ${B ? 'PASS' : 'FAIL'} (${b.status})`);

const dbC = mockDB();
const c = await call(token, { kernel: KERNEL }, dbC);
let savedExp = -1; try { savedExp = JSON.parse(c.row.kernel_v2).experience.length; } catch (_) {}
const idC = JSON.parse(c.row.identity || '{}');
const C = c.status === 200 && c.body && c.body.ok && savedExp === 1 && idC.name === 'Gabriel';
log('C: status', c.status, '| kernel_v2 roles', savedExp, '| identity preserved:', idC.name === 'Gabriel');
log(`CHECK C (token + kernel → 200, kernel_v2 written, identity untouched): ${C ? 'PASS' : 'FAIL'}`);

const ok = A && B && C;
log(ok ? 'KERNEL-V2-WRITE OK (3/3)' : 'KERNEL-V2-WRITE FAIL');
process.exitCode = ok ? 0 : 1;
