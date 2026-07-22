/* DIAGNOSTIC — AUTOSAVE-STALE-CLOBBER-001 (owner 2026-07-22): optimistic-concurrency (register row 29/31 leg C, owner 2026-07-04
rev guard on PUT /api/applications/:id. A PUT MAY carry base_rev = the updated_at
 * the client last loaded; a mismatch (stale tab replaying old state over a fresher
 * nightly-regen write) is rejected 409 without touching the row. base_rev
 * absent/null keeps the unconditional write (Python nightly / partial PUTs).
 *   A. base_rev == stored updated_at  -> 200, write lands, fresh updated_at returned
 *   B. base_rev <  stored updated_at  -> 409 conflict, row UNCHANGED
 *   C. no base_rev                    -> 200 unconditional (backward compatible)
 *   D. base_rev null                  -> 200 unconditional
 * Run: node test/diag-app-autosave-rev-guard.mjs */
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


let pass = true;
function check(name, ok) { log((ok ? 'PASS' : 'FAIL') + ' — ' + name); if (!ok) pass = false; }

// A — matching base_rev: write lands
{
  const row = trackmanRow(); row.updated_at = 1000;
  const r = await put(1, token, { cv_sections: NEW_CV, base_rev: 1000 }, mockDB(row));
  check('A matching base_rev -> 200 + write lands', r.status === 200 && r.row.cv_sections === JSON.stringify(NEW_CV));
  check('A response carries fresh updated_at', !!(r.body && r.body.application && r.body.application.updated_at > 1000));
}
// B — stale base_rev: 409, row untouched
{
  const row = trackmanRow(); row.updated_at = 2000;
  const r = await put(1, token, { cv_sections: NEW_CV, base_rev: 1000 }, mockDB(row));
  check('B stale base_rev -> 409 conflict', r.status === 409 && r.body && r.body.error === 'conflict' && r.body.updated_at === 2000);
  check('B row cv UNCHANGED', r.row.cv_sections === JSON.stringify(REAL_CV));
}
// C — no base_rev: unconditional (backward compatible)
{
  const row = trackmanRow(); row.updated_at = 2000;
  const r = await put(1, token, { cv_sections: NEW_CV }, mockDB(row));
  check('C no base_rev -> 200 unconditional', r.status === 200 && r.row.cv_sections === JSON.stringify(NEW_CV));
}
// D — explicit null base_rev: unconditional
{
  const row = trackmanRow(); row.updated_at = 2000;
  const r = await put(1, token, { cv_sections: NEW_CV, base_rev: null }, mockDB(row));
  check('D base_rev null -> 200 unconditional', r.status === 200 && r.row.cv_sections === JSON.stringify(NEW_CV));
}
log('\n' + (pass ? 'PASS' : 'FAIL') + ' — AUTOSAVE-STALE-CLOBBER-001 relay rev guard');
process.exit(pass ? 0 : 1);
