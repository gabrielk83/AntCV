/* DIAGNOSTIC — GEN-CONTAMINATION-PRESERVE-DRAFTS-001 (owner 2026-06-28, CRITICAL data loss).
 * A FULL regen calls POST /api/prefs/wipe-generated as STAGE 1. The old handler ran a
 * BLANKET `UPDATE application SET cv_sections=NULL, cl_sections=NULL WHERE user_hash=?`,
 * nulling EVERY saved application's content — not just the active (auto-applied) seed.
 * Loading a nulled draft then showed only the template skeleton (empty sections trip the
 * client minimum-sections floor). Confirmed live: 3 of 4 of the owner's saved apps had
 * cv_sections/cl_sections = NULL.
 *
 * Drives the LIVE relay fetch handler with a mock D1 holding THREE application rows
 * (id 1 = active, ids 2 & 3 = saved drafts) + an active_application pointer → 1, and a
 * language_view row per app. Single-user mock, so user_hash is not modelled. Asserts:
 *   A. the ACTIVE app's sections are nulled
 *   B. both SAVED DRAFTS keep their sections (the data-loss fix)
 *   C. only the ACTIVE app's language_view is deleted; drafts' views survive
 *   D. kernel_showcase is deleted (contamination seed still cleared)
 * Run: node test/diag-wipe-generated-preserves-drafts.mjs */
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

// Single-user in-memory D1 mock. ACTIVE_IDS = the active_application pointer set.
function mockDB(state) {
  function exec(sql) {
    let changes = 0;
    if (/UPDATE application SET cv_sections = NULL/i.test(sql)) {
      const scoped = /active_application/i.test(sql); // fixed handler scopes to active
      for (const app of state.applications) {
        if (scoped && !state.activeIds.includes(app.id)) continue; // PRESERVE drafts
        if (app.cv_sections !== null || app.cl_sections !== null) changes++;
        app.cv_sections = null; app.cl_sections = null;
      }
    } else if (/DELETE FROM language_view/i.test(sql)) {
      const scoped = /active_application/i.test(sql);
      const ids = scoped ? state.activeIds : state.applications.map(a => a.id);
      const before = state.language_view.length;
      state.language_view = state.language_view.filter(v => !ids.includes(v.application_id));
      changes = before - state.language_view.length;
    } else if (/DELETE FROM kernel_showcase/i.test(sql)) {
      const before = state.kernel_showcase.length;
      state.kernel_showcase = [];
      changes = before;
    }
    return { success: true, meta: { changes } };
  }
  return {
    prepare(sql) { return { bind() { return { async first() { return null; }, async run() { return exec(sql); } }; } }; },
    async batch(stmts) { const out = []; for (const s of stmts) out.push(await s.run()); return out; },
  };
}

const token = await mint('karp.gabriel.a@gmail.com');
const state = {
  applications: [
    { id: 1, cv_sections: '[{"id":"core_comp"}]', cl_sections: '[{"id":"bring"}]' },        // active
    { id: 2, cv_sections: '[{"id":"core_comp","rows":5}]', cl_sections: '[{"id":"bring"}]' }, // saved draft
    { id: 3, cv_sections: '[{"id":"experience"}]', cl_sections: '[{"id":"contribute"}]' },   // saved draft
  ],
  activeIds: [1],
  language_view: [{ application_id: 1 }, { application_id: 2 }, { application_id: 3 }],
  kernel_showcase: [{}],
};

const env = { JWT_SECRET: SECRET, DB: mockDB(state), KV_BINDING: kvMock(), ALLOWED_ORIGINS: 'https://antcv.pages.dev' };
const res = await relay.fetch(new Request('https://relay.example.com/api/prefs/wipe-generated', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'Origin': 'https://antcv.pages.dev', 'Authorization': 'Bearer ' + token },
}), env, { waitUntil: () => {} });
let body = null; try { body = await res.json(); } catch (_) {}

const active = state.applications.find(a => a.id === 1);
const draft2 = state.applications.find(a => a.id === 2);
const draft3 = state.applications.find(a => a.id === 3);

const A = res.status === 200 && active.cv_sections === null && active.cl_sections === null;
const B = draft2.cv_sections !== null && draft2.cl_sections !== null && draft3.cv_sections !== null && draft3.cl_sections !== null;
const C = !state.language_view.some(v => v.application_id === 1)
  && state.language_view.some(v => v.application_id === 2)
  && state.language_view.some(v => v.application_id === 3);
const D = state.kernel_showcase.length === 0;

log('response:', JSON.stringify(body));
log('active(id1):', active.cv_sections === null ? 'nulled' : 'KEPT');
log('draft(id2):', draft2.cv_sections ? 'kept' : 'LOST', '| draft(id3):', draft3.cv_sections ? 'kept' : 'LOST');
log('language_view remaining app ids:', state.language_view.map(v => v.application_id).join(','));
log(`CHECK A (active app sections nulled): ${A ? 'PASS' : 'FAIL'}`);
log(`CHECK B (saved drafts PRESERVED): ${B ? 'PASS' : 'FAIL'}`);
log(`CHECK C (only active language_view deleted): ${C ? 'PASS' : 'FAIL'}`);
log(`CHECK D (kernel_showcase cleared): ${D ? 'PASS' : 'FAIL'}`);

const ok = A && B && C && D;
log(ok ? 'WIPE-GENERATED-PRESERVE-DRAFTS OK (4/4)' : 'WIPE-GENERATED-PRESERVE-DRAFTS FAIL');
process.exitCode = ok ? 0 : 1;
