/* DIAGNOSTIC — AUTOSAVE-NO-DOWNGRADE-001 (register row 29/31 leg C, owner 2026-07-04
 * "the fuck?" Trackman revert). The client auto-saves the active app on every row
 * switch / tick with the CURRENT React sections + meta; a transient EMPTY or
 * UNSOLICITED state at that beat poisons a real targeted row. The relay PUT
 * /api/applications/:id now refuses to downgrade a real-company row or blank a
 * populated one (an explicit null wipe is still honoured).
 *   A. real-company row + PUT jd_company:'' + real cv     -> company PRESERVED, cv updated
 *   B. populated row      + PUT cv_sections:[]            -> cv PRESERVED (blank blocked)
 *   C. real-company row   + PUT real company + real cv    -> updated normally (guard inert)
 *   D. populated row      + PUT cv_sections:null          -> nulled (deliberate wipe honoured)
 *   E. unsolicited row    + PUT jd_company:'NIL …' upgrade -> upgraded (no false block)
 * Run: node test/diag-app-autosave-downgrade-guard.mjs */
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
async function userHash(email) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(email).trim().toLowerCase()));
  const bytes = new Uint8Array(buf); let bin = ''; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').slice(0, 32);
}
const HASH = await userHash('karp.gabriel.a@gmail.com');

// Mock D1 holding ONE application row (id 1). Applies UPDATEs by parsing the SET clause.
function mockDB(row) {
  return {
    _row: () => row,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (/FROM application WHERE id/.test(sql)) return row;   // ownership select + final select *
              return null;
            },
            async run() {
              if (/^UPDATE application SET/.test(sql.trim())) {
                const m = sql.match(/SET ([\s\S]+) WHERE/);
                const cols = m[1].split(',').map((s) => s.trim().split(/\s*=/)[0]);
                cols.forEach((c, i) => { row[c] = args[i]; });   // last arg is appId (ignored)
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

async function put(id, token, bodyObj, db) {
  const env = { JWT_SECRET: SECRET, DB: db, KV_BINDING: kvMock(), ALLOWED_ORIGINS: 'https://antcv.pages.dev' };
  const res = await relay.fetch(new Request('https://relay.example.com/api/applications/' + id, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', Origin: 'https://antcv.pages.dev', Authorization: 'Bearer ' + token },
    body: JSON.stringify(bodyObj),
  }), env, { waitUntil: () => {} });
  let body = null; try { body = await res.json(); } catch (_) {}
  return { status: res.status, body, row: db._row() };
}

const token = await mint('karp.gabriel.a@gmail.com');
const REAL_CV = [{ id: 'profile', type: 'text', content: 'Fresh Trackman profile.' }];
const NEW_CV = [{ id: 'profile', type: 'text', content: 'Newer content.' }];
function trackmanRow() { return { user_hash: HASH, jd_company: 'Trackman A/S', jd_role: 'PM', cv_sections: JSON.stringify(REAL_CV), cl_sections: JSON.stringify([{ id: 'opening', t: 'x' }]), subtitle: '', category: 'engineering_hardware' }; }
function unsolRow() { return { user_hash: HASH, jd_company: 'Unsolicited', jd_role: 'Open Application', cv_sections: JSON.stringify(REAL_CV), cl_sections: '[]', subtitle: '', category: 'unsolicited' }; }

// A — downgrade blocked, real cv still written
const dbA = mockDB(trackmanRow());
const a = await put(1, token, { cv_sections: NEW_CV, cl_sections: [{ id: 'opening', t: 'x' }], jd_company: '', jd_role: '', subtitle: 's' }, dbA);
const A = a.status === 200 && a.row.jd_company === 'Trackman A/S' && JSON.parse(a.row.cv_sections)[0].content === 'Newer content.';
log(`CHECK A (downgrade jd_company:'' blocked; real cv still written): ${A ? 'PASS' : 'FAIL'}  co=${a.row.jd_company}`);

// B — blank cv over populated blocked
const dbB = mockDB(trackmanRow());
const b = await put(1, token, { cv_sections: [], jd_company: 'Trackman A/S', jd_role: 'PM' }, dbB);
const B = b.status === 200 && JSON.parse(b.row.cv_sections)[0].content === 'Fresh Trackman profile.';
log(`CHECK B (empty cv_sections over populated is blocked): ${B ? 'PASS' : 'FAIL'}`);

// C — legit write passes
const dbC = mockDB(trackmanRow());
const c = await put(1, token, { cv_sections: NEW_CV, jd_company: 'Trackman A/S', jd_role: 'PM Hardware' }, dbC);
const C = c.status === 200 && JSON.parse(c.row.cv_sections)[0].content === 'Newer content.' && c.row.jd_role === 'PM Hardware';
log(`CHECK C (genuine write passes, guard inert): ${C ? 'PASS' : 'FAIL'}`);

// D — explicit null wipe honoured
const dbD = mockDB(trackmanRow());
const d = await put(1, token, { cv_sections: null }, dbD);
const D = d.status === 200 && (d.row.cv_sections === null);
log(`CHECK D (explicit null wipe still honoured): ${D ? 'PASS' : 'FAIL'}  cv=${d.row.cv_sections}`);

// E — unsolicited row upgraded (no false block)
const dbE = mockDB(unsolRow());
const e = await put(1, token, { jd_company: 'NIL Technology', jd_role: 'Nanooptics Engineer' }, dbE);
const E = e.status === 200 && e.row.jd_company === 'NIL Technology';
log(`CHECK E (unsolicited row upgraded to a real company): ${E ? 'PASS' : 'FAIL'}  co=${e.row.jd_company}`);

const ok = A && B && C && D && E;
log(ok ? 'AUTOSAVE-NO-DOWNGRADE-GUARD OK (5/5)' : 'AUTOSAVE-NO-DOWNGRADE-GUARD FAIL');
process.exitCode = ok ? 0 : 1;
