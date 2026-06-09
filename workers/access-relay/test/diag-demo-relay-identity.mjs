/* DIAGNOSTIC — DEMO-RELAY-IDENTITY-001 (owner 2026-06-09).
 * Demo user pressed Generate and every provider failed with 401
 * demo_requires_sign_in, then the demo badge vanished. Cause: the relay
 * routes demo-pinned users to UPSTREAM_DEMO but rawForward stripped the
 * Authorization header and injected no identity, so the demo proxy's
 * demo-enforcement preflight saw an anonymous request.
 *
 * Drives the LIVE relay fetch handler with stub service bindings:
 *   A. demo-mode forward carries Cf-Access-Authenticated-User-Email
 *      (relay-verified, NOT the caller-supplied value)
 *   B. demo-mode forward restores the Bearer for end-to-end JWT verify
 *   C. paid-mode forward still strips Authorization (cv-proxy contract)
 *   D. caller-spoofed Cf-Access-* headers never pass through on paid
 *   E. demo proxy preflight (live demo-enforcement.js) accepts the
 *      forwarded request and resolves the right email + cap
 * Run: node test/diag-demo-relay-identity.mjs
 */
import { writeSync } from 'node:fs';
const log = (...a) => writeSync(1, a.join(' ') + '\n');

const relay = (await import('../src/index.js')).default;
const { preflight: demoPreflight } = await import('../../demo-proxy/src/demo-enforcement.js');

// ── HS256 JWT mint (mirror of the relay's signJWT) ──
const SECRET = 'diag-test-secret-0123456789abcdef0123456789abcdef';
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
  const key = await crypto.subtle.importKey('raw', enc.encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${h}.${p}`));
  return `${h}.${p}.${b64url(new Uint8Array(sig))}`;
}

// ── Stub upstream bindings: capture the forwarded request ──
function captureBinding(store) {
  return {
    fetch: async (url, init) => {
      store.url = String(url);
      store.headers = new Headers((init && init.headers) || {});
      return new Response(JSON.stringify({ ok: true, content: [] }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    },
  };
}

const kvStub = { get: async () => null, put: async () => {}, delete: async () => {} };

const demoCapture = {};
const paidCapture = {};
const RELAY_FORWARD_SECRET = 'diag-relay-forward-secret';
const env = {
  JWT_SECRET: SECRET,
  RELAY_FORWARD_SECRET,
  DEMO_EMAILS: 'demo@example.com',
  ALLOWED_ORIGINS: 'https://antcv.pages.dev',
  UPSTREAM_ORIGIN: 'https://cv-proxy.example.com',
  UPSTREAM_ORIGIN_DEMO: 'https://demo-proxy.example.com',
  UPSTREAM: captureBinding(paidCapture),
  UPSTREAM_DEMO: captureBinding(demoCapture),
  KV_BINDING: kvStub,
};

const BODY = JSON.stringify({ model: 'claude-sonnet-4-6', messages: [{ role: 'user', content: 'hi' }], max_tokens: 16 });

async function llmPost(token, extraHeaders) {
  return relay.fetch(new Request('https://relay.example.com/', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'Origin': 'https://antcv.pages.dev',
      'Authorization': 'Bearer ' + token,
      ...(extraHeaders || {}),
    },
    body: BODY,
  }), env, { waitUntil: () => {} });
}

// ── Demo-pinned user, with a SPOOFED identity header on the inbound call ──
const demoToken = await mint('demo@example.com');
const resDemo = await llmPost(demoToken, {
  'Cf-Access-Authenticated-User-Email': 'attacker@evil.example',
  'X-AntCV-Relay-Auth': 'attacker-guess', // must be replaced, never passed through
});
log('demo POST / status:', resDemo.status, '| forwarded to:', demoCapture.url || '(none)');

const fwdEmail = demoCapture.headers ? demoCapture.headers.get('Cf-Access-Authenticated-User-Email') : null;
const fwdAuth = demoCapture.headers ? demoCapture.headers.get('Authorization') : null;
const A = fwdEmail === 'demo@example.com';
const B = fwdAuth === 'Bearer ' + demoToken;
log(`CHECK A (demo forward carries relay-verified email, spoof replaced): ${A ? 'PASS' : 'FAIL'} (got ${JSON.stringify(fwdEmail)})`);
log(`CHECK B (demo forward restores the Bearer JWT): ${B ? 'PASS' : 'FAIL'}`);

// ── F: demo forward carries the relay-forward secret (DEMO-RELAY-IDENTITY-002) ──
const fwdRelayAuth = demoCapture.headers ? demoCapture.headers.get('X-AntCV-Relay-Auth') : null;
const F = fwdRelayAuth === RELAY_FORWARD_SECRET;
log(`CHECK F (demo forward carries RELAY_FORWARD_SECRET, caller guess replaced): ${F ? 'PASS' : 'FAIL'}`);

// ── Paid user: JWT stripped, spoofed Cf-Access header stripped ──
const paidToken = await mint('payer@example.com');
const resPaid = await llmPost(paidToken, {
  'Cf-Access-Authenticated-User-Email': 'attacker@evil.example',
  'X-AntCV-Relay-Auth': 'attacker-guess',
});
log('paid POST / status:', resPaid.status, '| forwarded to:', paidCapture.url || '(none)');
const C = paidCapture.headers && !paidCapture.headers.get('Authorization');
const D = paidCapture.headers && !paidCapture.headers.get('Cf-Access-Authenticated-User-Email');
log(`CHECK C (paid forward strips Authorization): ${C ? 'PASS' : 'FAIL'}`);
log(`CHECK D (paid forward strips caller-spoofed Cf-Access email): ${D ? 'PASS' : 'FAIL'}`);
const G = paidCapture.headers && !paidCapture.headers.get('X-AntCV-Relay-Auth');
log(`CHECK G (paid forward carries NO relay-forward secret): ${G ? 'PASS' : 'FAIL'}`);

// ── E: live demo-proxy preflight accepts the forwarded request ──
// identityFn mirrors the demo proxy's FIRST trust path (identityFromRequest
// reads Cf-Access-Authenticated-User-Email before anything else).
const forwarded = new Request('https://demo-proxy.example.com/', {
  method: 'POST', headers: demoCapture.headers || new Headers(), body: BODY,
});
const pre = await demoPreflight(forwarded, { DEMO_MODE: 'true', KV_BINDING: kvStub }, async (req) => {
  const e = req.headers.get('Cf-Access-Authenticated-User-Email');
  return e ? { email: e } : null;
});
const E = pre && pre.ok === true && pre.email === 'demo@example.com' && pre.cap > 0;
log(`CHECK E (demo-enforcement preflight passes with forwarded identity): ${E ? 'PASS' : 'FAIL'} (${JSON.stringify({ ok: pre && pre.ok, email: pre && pre.email, error: pre && pre.error })})`);

const ok = A && B && C && D && E && F && G;
log(ok ? 'DEMO-RELAY-IDENTITY OK (7/7)' : 'DEMO-RELAY-IDENTITY FAIL');
process.exitCode = ok ? 0 : 1;
