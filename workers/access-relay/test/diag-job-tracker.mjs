/* DIAGNOSTIC — JOB-TRACKER-001: GET/PUT/DELETE /api/job-tracker with optimistic
 * concurrency. The per-user job-search workbook is stored as one JSON `doc` with
 * a monotonic `rev`; a stale base_rev must 409 (return current doc) not clobber.
 *   A no token → 401
 *   B GET empty → {ok, doc:null, rev:0}
 *   C PUT (no base_rev) → 200, rev 1
 *   D GET → doc present, rev 1
 *   E PUT base_rev=1 → 200, rev 2
 *   F PUT base_rev=1 (stale) → 409, returns current rev 2 + doc, NO overwrite
 *   G PUT base_rev=null (force) → 200, rev 3
 *   H DELETE → row gone; GET → doc:null, rev 0
 * Run: node test/diag-job-tracker.mjs */
import { writeSync } from 'node:fs';
const log = (...a) => writeSync(1, a.join(' ') + '\n');
const relay = (await import('../src/index.js')).default;

const SECRET = 'guard-test-secret-0123456789abcdef0123456789abcd';
function b64url(bytes){let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
async function mint(email){const enc=new TextEncoder();const now=Math.floor(Date.now()/1000);
  const h=b64url(enc.encode(JSON.stringify({alg:'HS256',typ:'JWT'})));
  const p=b64url(enc.encode(JSON.stringify({sub:email,email,iat:now,exp:now+3600,iss:'antcv-access-relay'})));
  const key=await crypto.subtle.importKey('raw',enc.encode(SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const sig=await crypto.subtle.sign('HMAC',key,enc.encode(`${h}.${p}`));
  return `${h}.${p}.${b64url(new Uint8Array(sig))}`;}
function kvMock(){const m=new Map();return{async get(k){return m.has(k)?m.get(k):null;},async put(k,v){m.set(k,v);},async delete(k){m.delete(k);}};}

// Stateful mock D1 emulating job_tracker + a seeded user_kernel parent row.
function mockDB(){
  let jt = null; // { doc:<str>, rev:<int>, updated_at:<int> }
  const kernelExists = true;
  return {
    _jt: () => jt,
    prepare(sql){
      return { bind(...args){ return {
        async first(){
          if (/FROM user_kernel/.test(sql)) return kernelExists ? { user_hash: 'H' } : null;
          if (/SELECT rev FROM job_tracker/.test(sql)) return jt ? { rev: jt.rev } : null;
          if (/SELECT doc FROM job_tracker/.test(sql)) return jt ? { doc: jt.doc } : null;
          if (/SELECT doc, rev, updated_at FROM job_tracker/.test(sql)) return jt ? { doc: jt.doc, rev: jt.rev, updated_at: jt.updated_at } : null;
          return null;
        },
        async run(){
          if (/INSERT INTO job_tracker/.test(sql)) jt = { doc: args[1], rev: args[2], updated_at: args[3] };
          else if (/DELETE FROM job_tracker/.test(sql)) jt = null;
          return { success: true, meta: {} };
        },
        async all(){ return { results: [] }; },
      }; } };
    },
  };
}

async function call(method, token, bodyObj, db){
  const env = { JWT_SECRET: SECRET, DB: db, KV_BINDING: kvMock(), ALLOWED_ORIGINS: 'https://antcv.pages.dev' };
  const headers = { 'content-type': 'application/json', 'Origin': 'https://antcv.pages.dev' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const init = { method, headers };
  if (bodyObj !== undefined) init.body = JSON.stringify(bodyObj);
  const res = await relay.fetch(new Request('https://relay.example.com/api/job-tracker', init), env, { waitUntil: () => {} });
  let body = null; try { body = await res.json(); } catch (_) {}
  return { status: res.status, body };
}

const token = await mint('karp.gabriel.a@gmail.com');
const DOC1 = { version: 1, envelope: { salary: '~60k DKK' }, rows: [{ id: 'kk_bionic', rank: 9, tracked: 'Not started' }] };
const DOC2 = { version: 1, envelope: { salary: '~60k DKK' }, rows: [{ id: 'kk_bionic', rank: 9, tracked: 'Submitted' }] };
const db = mockDB();

const a = await call('GET', null, undefined, db);
const A = a.status === 401;
log(`CHECK A (no token → 401): ${A?'PASS':'FAIL'} (${a.status})`);

const b = await call('GET', token, undefined, db);
const B = b.status === 200 && b.body.ok && b.body.doc === null && b.body.rev === 0;
log(`CHECK B (GET empty → doc null, rev 0): ${B?'PASS':'FAIL'} (rev ${b.body&&b.body.rev})`);

const c = await call('PUT', token, { doc: DOC1 }, db);
const C = c.status === 200 && c.body.ok && c.body.rev === 1;
log(`CHECK C (PUT no base_rev → 200, rev 1): ${C?'PASS':'FAIL'} (${c.status} rev ${c.body&&c.body.rev})`);

const d = await call('GET', token, undefined, db);
const D = d.status === 200 && d.body.doc && d.body.doc.rows[0].id === 'kk_bionic' && d.body.rev === 1;
log(`CHECK D (GET → doc present, rev 1): ${D?'PASS':'FAIL'} (rev ${d.body&&d.body.rev})`);

const e = await call('PUT', token, { doc: DOC2, base_rev: 1 }, db);
const E = e.status === 200 && e.body.rev === 2;
log(`CHECK E (PUT base_rev=1 → 200, rev 2): ${E?'PASS':'FAIL'} (${e.status} rev ${e.body&&e.body.rev})`);

const f = await call('PUT', token, { doc: DOC1, base_rev: 1 }, db);
const F = f.status === 409 && f.body.error === 'conflict' && f.body.rev === 2 && f.body.doc && f.body.doc.rows[0].tracked === 'Submitted';
log(`CHECK F (stale base_rev=1 → 409, current rev 2 returned, NO clobber): ${F?'PASS':'FAIL'} (${f.status})`);

const g = await call('PUT', token, { doc: DOC1, base_rev: null }, db);
const G = g.status === 200 && g.body.rev === 3;
log(`CHECK G (force base_rev=null → 200, rev 3): ${G?'PASS':'FAIL'} (${g.status} rev ${g.body&&g.body.rev})`);

const hDel = await call('DELETE', token, undefined, db);
const hGet = await call('GET', token, undefined, db);
const H = hDel.status === 200 && hDel.body.deleted === true && hGet.body.doc === null && hGet.body.rev === 0;
log(`CHECK H (DELETE → gone; GET doc null rev 0): ${H?'PASS':'FAIL'}`);

const ok = A&&B&&C&&D&&E&&F&&G&&H;
log(ok ? 'JOB-TRACKER OK (8/8)' : 'JOB-TRACKER FAIL');
process.exitCode = ok ? 0 : 1;
