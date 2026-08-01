/* DIAGNOSTIC — APP-CAP-50-BULK-REGEN-001 (owner 2026-07-23 full-list regen).
 * The history cap was enforced by DELETE: any row that fell out of the newest
 * 50 was destroyed. Once the account actually reached 50 that made every bulk
 * process destructive - a regen writes new rows, each PUT re-runs the sweep,
 * and the owner's OLDEST generated applications were deleted to pay for them.
 * The 2026-07-23 run had to be stopped at 49 by hand to stop it eating
 * originals. The sweep is now DISPOSABLE-ONLY: it may delete a content-less
 * stub, never a row carrying a CV or a cover letter.
 *   A. the sweep DELETE carries an emptiness guard on BOTH sections columns
 *   B. that guard, evaluated as written, matches ONLY the both-empty row
 *   C. a PUT past the cap reports history_over_cap instead of silently deleting
 *   D. the collection LIST no longer caps at 50 (kept rows must stay visible)
 * Run: node test/diag-app-cap-50-no-content-delete.mjs */
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

const REAL_CV = [{ id: 'profile', type: 'text', content: 'Saved work.' }];
function appRow() {
  return { id: 1, user_hash: HASH, jd_company: 'Trackman A/S', jd_role: 'PM',
           cv_sections: JSON.stringify(REAL_CV), cl_sections: '[]', subtitle: '',
           category: 'engineering_hardware', updated_at: 1000 };
}

/* Mock D1 that RECORDS every statement, so the sweep the worker actually sends
 * can be inspected. `count` is what the post-sweep COUNT(*) returns. */
function mockDB(row, count) {
  const seen = [];
  return {
    _seen: () => seen,
    _row: () => row,
    prepare(sql) {
      seen.push(sql);
      return {
        bind(...args) {
          return {
            async first() {
              if (/COUNT\(\*\)/.test(sql)) return { n: count };
              if (/FROM application WHERE id/.test(sql)) return row;
              return null;
            },
            async all() { return { results: [] }; },
            async run() {
              if (/^UPDATE application SET/.test(sql.trim())) {
                const m = sql.match(/SET ([\s\S]+) WHERE/);
                const cols = m[1].split(',').map((s) => s.trim().split(/\s*=/)[0]);
                cols.forEach((c, i) => { row[c] = args[i]; });
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
  return { status: res.status, body, seen: db._seen() };
}

async function list(token, db) {
  const env = { JWT_SECRET: SECRET, DB: db, KV_BINDING: kvMock(), ALLOWED_ORIGINS: 'https://antcv.pages.dev' };
  const res = await relay.fetch(new Request('https://relay.example.com/api/applications', {
    headers: { Origin: 'https://antcv.pages.dev', Authorization: 'Bearer ' + token },
  }), env, { waitUntil: () => {} });
  let body = null; try { body = await res.json(); } catch (_) {}
  return { status: res.status, body, seen: db._seen() };
}

/* Evaluate the emptiness predicate EXACTLY as the worker wrote it, against a
 * row. Reads the fragment out of the emitted SQL rather than restating it, so
 * deleting the guard from the worker fails this check instead of passing a
 * copy of itself. */
function emptyPredicate(sql) {
  const m = sql.match(/\(COALESCE\(TRIM\(cv_sections\)[\s\S]*?\)\)/);
  if (!m) return null;
  const frag = m[0];
  const cols = frag.match(/TRIM\((\w+)\)/g).map((s) => s.slice(5, -1));
  const lits = (frag.match(/IN \(([^)]*)\)/g) || []).map((s) =>
    s.slice(4, -1).split(',').map((x) => x.trim().replace(/^'|'$/g, '')));
  if (cols.length !== 2 || lits.length !== 2) return null;
  return (row) => cols.every((c, i) => lits[i].includes(String(row[c] == null ? '' : row[c]).trim()));
}

let pass = true;
function check(name, ok) { log((ok ? 'PASS' : 'FAIL') + ' - ' + name); if (!ok) pass = false; }

const token = await mint('karp.gabriel.a@gmail.com');

// A + B — the sweep may only reach content-less rows
{
  const db = mockDB(appRow(), 50);
  const r = await put(1, token, { cv_sections: REAL_CV }, db);
  const del = r.seen.find((s) => /^DELETE FROM application WHERE user_hash/.test(s.trim()));
  check('A sweep DELETE exists', !!del);
  check('A sweep guards BOTH sections columns',
        !!del && /cv_sections/.test(del) && /cl_sections/.test(del));
  const isEmpty = del && emptyPredicate(del);
  check('A emptiness predicate is parseable from the emitted SQL', !!isEmpty);
  if (isEmpty) {
    check('B row with a CV is NOT disposable',
          isEmpty({ cv_sections: JSON.stringify(REAL_CV), cl_sections: '[]' }) === false);
    check('B row with only a cover letter is NOT disposable',
          isEmpty({ cv_sections: '[]', cl_sections: JSON.stringify([{ id: 'opening' }]) }) === false);
    check('B empty stub IS disposable',
          isEmpty({ cv_sections: '[]', cl_sections: null }) === true);
    check('B stub written as an empty object IS disposable',
          isEmpty({ cv_sections: '{}', cl_sections: '' }) === true);
  }
}

// C — over the cap the client is TOLD, not silently pruned
{
  const db = mockDB(appRow(), 57);
  const r = await put(1, token, { cv_sections: REAL_CV }, db);
  check('C over cap -> 200 with history_over_cap = 7',
        r.status === 200 && r.body && r.body.history_over_cap === 7);
}
{
  const db = mockDB(appRow(), 42);
  const r = await put(1, token, { cv_sections: REAL_CV }, db);
  check('C under cap -> no history_over_cap noise',
        r.status === 200 && r.body && r.body.history_over_cap === undefined);
}

// D — kept rows must stay VISIBLE (a 50-row list is the same bug in a hat)
{
  const db = mockDB(appRow(), 57);
  const r = await list(token, db);
  const sel = r.seen.find((s) => /SELECT id, jd_company/.test(s));
  check('D collection list does not cap at 50', !!sel && !/LIMIT 50\b/.test(sel));
  check('D collection list stays bounded', !!sel && /LIMIT \d+/.test(sel));
}

log('\n' + (pass ? 'PASS' : 'FAIL') + ' - APP-CAP-50-BULK-REGEN-001 disposable-only sweep');
process.exit(pass ? 0 : 1);
