/* DIAGNOSTIC — DEMO-RELAY-IDENTITY-002 (follow-up to -001).
 * The demo proxy is not behind Cloudflare Access, so Cf-Access-* identity
 * headers were trusted from ANY caller: a direct request with a forged
 * Cf-Access-Authenticated-User-Email bypassed the demo sign-in gate and
 * burned shared demo budget. Lock: when RELAY_FORWARD_SECRET is set, those
 * headers are only trusted alongside a matching X-AntCV-Relay-Auth header
 * (sent by the access relay on demo-mode forwards after JWT verification).
 *
 * Drives the LIVE demo-proxy fetch handler (src/index.js default export):
 *   A. armed + forged identity header, no relay auth   → 401 demo_requires_sign_in
 *   B. armed + forged identity header, WRONG relay auth → 401
 *   C. armed + identity header + correct relay auth     → 200 (LLM stubbed)
 *   D. armed + no identity headers + verified Bearer    → 200 (JWT path unaffected)
 *   E. NOT armed + forged identity header               → 200 (legacy trust until
 *      the secret is set on both Workers — documents why arming it matters)
 * Run: node test/diag-relay-auth-gate.mjs
 */
import { writeSync } from 'node:fs';
const log = (...a) => writeSync(1, a.join(' ') + '\n');

const worker = (await import('../src/index.js')).default;

// ── HS256 JWT mint (same shape the relay issues) ──
const JWT_SECRET = 'gate-test-jwt-secret-0123456789abcdef0123456789';
function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function mint(email) {
  const enc = new TextEncoder();
  const now = Math.floor(Date.now() / 1000);
  const h = b64url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const p = b64url(enc.encode(JSON.stringify({ sub: email, email, iat: now, exp: now + 3600, iss: 'antcv-access-relay' })));
  const key = await crypto.subtle.importKey('raw', enc.encode(JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${h}.${p}`));
  return `${h}.${p}.${b64url(new Uint8Array(sig))}`;
}

function mockKV() {
  const store = new Map();
  return {
    async get(k) { return store.has(k) ? store.get(k) : null; },
    async put(k, v) { store.set(k, v); },
    async delete(k) { store.delete(k); },
  };
}

const RELAY_SECRET = 'gate-test-relay-forward-secret';
function makeEnv(armed) {
  return {
    DEMO_MODE: 'true',
    ALLOWED_ORIGINS: 'https://antcv.pages.dev',
    Claude_API_Key: 'sk-ant-test-not-real',
    JWT_SECRET,
    ...(armed ? { RELAY_FORWARD_SECRET: RELAY_SECRET } : {}),
    KV_BINDING: mockKV(),
    ANALYTICS: mockKV(),
  };
}

// Stub the provider call — Anthropic-shaped non-streaming JSON.
const realFetch = globalThis.fetch;
globalThis.fetch = async () => new Response(JSON.stringify({
  id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-sonnet-4-6',
  content: [{ type: 'text', text: 'stubbed' }],
  usage: { input_tokens: 10, output_tokens: 5 },
}), { status: 200, headers: { 'content-type': 'application/json' } });

const BODY = JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 16, messages: [{ role: 'user', content: 'hi' }] });
async function post(env, extraHeaders) {
  const res = await worker.fetch(new Request('https://antcv-demo-proxy.test/', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'Origin': 'https://antcv.pages.dev', ...(extraHeaders || {}) },
    body: BODY,
  }), env, { waitUntil: () => {} });
  let body = null;
  try { body = await res.clone().json(); } catch (_) {}
  return { status: res.status, body, demoHeader: res.headers.get('X-AntCV-Demo') };
}

const FORGED = { 'Cf-Access-Authenticated-User-Email': 'attacker@evil.example' };

// A — armed, forged, no relay-auth header
const a = await post(makeEnv(true), FORGED);
const A = a.status === 401 && a.body && a.body.error === 'demo_requires_sign_in';
log(`CHECK A (armed: forged direct request rejected 401): ${A ? 'PASS' : 'FAIL'} (status ${a.status}, error ${a.body && a.body.error})`);

// B — armed, forged, wrong relay-auth value
const b = await post(makeEnv(true), { ...FORGED, 'X-AntCV-Relay-Auth': 'wrong-secret-same-length-padding' });
const B = b.status === 401 && b.body && b.body.error === 'demo_requires_sign_in';
log(`CHECK B (armed: wrong relay-auth value rejected 401): ${B ? 'PASS' : 'FAIL'} (status ${b.status})`);

// C — armed, identity + correct relay-auth (what the relay sends)
const c = await post(makeEnv(true), {
  'Cf-Access-Authenticated-User-Email': 'demo@example.com',
  'X-AntCV-Relay-Auth': RELAY_SECRET,
});
const C = c.status === 200;
log(`CHECK C (armed: relay-forwarded identity accepted): ${C ? 'PASS' : 'FAIL'} (status ${c.status}, X-AntCV-Demo ${c.demoHeader})`);

// D — armed, no Cf-Access headers, verified Bearer (JWT path must be unaffected)
const d = await post(makeEnv(true), { 'Authorization': 'Bearer ' + await mint('demo@example.com') });
const D = d.status === 200;
log(`CHECK D (armed: verified Bearer JWT still accepted): ${D ? 'PASS' : 'FAIL'} (status ${d.status})`);

// E — NOT armed: legacy trust (back-compat until the secret is set on both Workers)
const e = await post(makeEnv(false), FORGED);
const E = e.status === 200;
log(`CHECK E (not armed: legacy header trust preserved — arm the secret to close): ${E ? 'PASS' : 'FAIL'} (status ${e.status})`);

globalThis.fetch = realFetch;
const ok = A && B && C && D && E;
log(ok ? 'RELAY-AUTH-GATE OK (5/5)' : 'RELAY-AUTH-GATE FAIL');
process.exitCode = ok ? 0 : 1;
