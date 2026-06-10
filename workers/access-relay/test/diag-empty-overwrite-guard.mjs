/* DIAGNOSTIC — DEMO-RESET-EMPTY-OVERWRITE-001 (owner 2026-06-10 data loss).
 * A fresh post-hard-reset session accepted the AI disclosure, which PUT a
 * personalInfo carrying ONLY {email, aiDisclosure, disclosureAccepted,
 * aiDisclosureAccepted} to /api/prefs BEFORE cloud-restore ran. The relay's
 * full-replace then wiped the rich identity/history → a 132-byte identity
 * (observed live for karp.gabriel.a@gmail.com). Drives the LIVE relay fetch
 * handler with a mock D1 holding a rich kernel:
 *   A. auth-only personalInfo PUT → rich identity/history PRESERVED (guarded)
 *   B. a genuine rich personalInfo PUT → replaces normally (guard doesn't fire)
 *   C. /api/profile/kernel auth-only PUT → rich kernel preserved too
 * Run: node test/diag-empty-overwrite-guard.mjs */
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

// Mock D1 holding ONE user_kernel row.
function mockDB(row) {
  return {
    _row: () => row,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (/FROM user_kernel/.test(sql)) return row;
              if (/FROM active_application/.test(sql)) return null;
              if (/FROM application/.test(sql)) return null;
              return null;
            },
            async run() {
              if (/INSERT INTO user_kernel/.test(sql)) {
                row = { user_hash: args[0], identity: args[1], history: args[2], preferences: args[3], photo_b64: args[4], created_at: args[5], updated_at: args[6] };
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

const RICH_IDENTITY = { name: 'Gabriel Karp-Gershon', headline: 'Electro-Optics Engineer', location: 'Copenhagen', citizenship: 'EU Citizen', email: 'karp.gabriel.a@gmail.com' };
const RICH_HISTORY = { workHistory: [{ role: 'System Architect', company: 'Innoviz' }], education: [{ deg: 'M.Sc. EE' }], certifications: ['Six Sigma BB'] };
function freshRow() {
  return { user_hash: 'HASH', identity: JSON.stringify(RICH_IDENTITY), history: JSON.stringify(RICH_HISTORY), preferences: JSON.stringify({ language: 'en' }), photo_b64: 'PHOTO', created_at: 1, updated_at: 1 };
}

function kvMock() { const m = new Map(); return { async get(k) { return m.has(k) ? m.get(k) : null; }, async put(k, v) { m.set(k, v); }, async delete(k) { m.delete(k); } }; }

async function put(path, token, bodyObj, db) {
  const env = { JWT_SECRET: SECRET, DB: db, KV_BINDING: kvMock(), ALLOWED_ORIGINS: 'https://antcv.pages.dev' };
  const res = await relay.fetch(new Request('https://relay.example.com' + path, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'Origin': 'https://antcv.pages.dev', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify(bodyObj),
  }), env, { waitUntil: () => {} });
  let body = null; try { body = await res.json(); } catch (_) {}
  return { status: res.status, body, row: db._row() };
}

const token = await mint('karp.gabriel.a@gmail.com');
const AUTH_ONLY_PI = { email: 'karp.gabriel.a@gmail.com', aiDisclosure: true, disclosureAccepted: true, aiDisclosureAccepted: '2026-06-09T08:02:16.907Z' };

// A — /api/prefs auth-only PUT must preserve the rich kernel
const dbA = mockDB(freshRow());
const a = await put('/api/prefs', token, { personalInfo: AUTH_ONLY_PI }, dbA);
const idA = JSON.parse(a.row.identity || '{}'); const histA = JSON.parse(a.row.history || '{}');
const A = a.status === 200 && idA.name === 'Gabriel Karp-Gershon' && idA.headline && Array.isArray(histA.workHistory) && histA.workHistory.length === 1 && idA.aiDisclosure === true;
log('A identity keys:', Object.keys(idA).join(','));
log(`CHECK A (/api/prefs auth-only PUT preserves rich identity+history): ${A ? 'PASS' : 'FAIL'}`);

// B — a genuine rich PUT still replaces (guard does NOT fire)
const dbB = mockDB(freshRow());
const NEW_PI = { name: 'Gabriel K-G', headline: 'New Headline', location: 'Aarhus', email: 'karp.gabriel.a@gmail.com', workHistory: [{ role: 'PM', company: 'X' }, { role: 'Lead', company: 'Y' }] };
const b = await put('/api/prefs', token, { personalInfo: NEW_PI }, dbB);
const idB = JSON.parse(b.row.identity || '{}'); const histB = JSON.parse(b.row.history || '{}');
const B = b.status === 200 && idB.location === 'Aarhus' && idB.headline === 'New Headline' && histB.workHistory.length === 2;
log(`CHECK B (genuine rich PUT replaces normally): ${B ? 'PASS' : 'FAIL'}`);

// C — /api/profile/kernel auth-only PUT must preserve the rich kernel
const dbC = mockDB(freshRow());
const c = await put('/api/profile/kernel', token, { identity: { email: 'karp.gabriel.a@gmail.com', aiDisclosure: true, disclosureAccepted: true }, history: {} }, dbC);
const idC = JSON.parse(c.row.identity || '{}'); const histC = JSON.parse(c.row.history || '{}');
const C = c.status === 200 && idC.name === 'Gabriel Karp-Gershon' && Array.isArray(histC.workHistory) && histC.workHistory.length === 1;
log('C identity keys:', Object.keys(idC).join(','));
log(`CHECK C (/api/profile/kernel auth-only PUT preserves rich kernel): ${C ? 'PASS' : 'FAIL'}`);

const ok = A && B && C;
log(ok ? 'EMPTY-OVERWRITE-GUARD OK (3/3)' : 'EMPTY-OVERWRITE-GUARD FAIL');
process.exitCode = ok ? 0 : 1;
