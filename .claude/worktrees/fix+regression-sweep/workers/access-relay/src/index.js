import { insertLlmCall, aggregateHealth, getLatestHealth, pruneOld, insertQualitySignal } from './telemetry.js';

const VERSION='1.3.0';
// antcv-access-relay — auth + hardening
// =====================================
// Public-facing relay with built-in user authentication.
//
// What's new:
//  - In-app sign-in: Google (RS256 ID token verification) + Email OTP (Resend).
//  - HS256 session JWT issued by the relay (7-day lifetime, silent refresh).
//  - Relay-local /preferences and /signals (stored in this Worker's KV).
//  - Truthful /config — probes upstream to report real provider key state.
//  - JSON 404s and Cloudflare-edge-error detection (no more HTML leaks to PWA).
//  - /__diag endpoint for self-diagnosis.
//  - /analytics is fire-and-forget (always 200, never spams the console).
//
// Architecture (unchanged at the cv-proxy edge):
//   PWA → this relay (verifies JWT) → cv-proxy (CF Access service token) → providers
//
// Required secrets on this worker (`npx wrangler secret put …`):
//   JWT_SECRET                random ≥32-byte string for signing session JWTs
//   CF_ACCESS_CLIENT_ID       service-token client id for cv-proxy's Access policy
//   CF_ACCESS_CLIENT_SECRET   service-token client secret
//   RESEND_API_KEY            Resend API key (for OTP emails)
//
// Required vars (in wrangler.toml):
//   UPSTREAM_ORIGIN   = "https://cv-proxy.karp-gabriel-a.workers.dev"
//   ALLOWED_ORIGINS   = "https://cv-generator-det.pages.dev"
//   GOOGLE_CLIENT_ID  = "<your-oauth-client-id>.apps.googleusercontent.com"
//   EMAIL_FROM        = "AntCV <noreply@yourdomain.com>"      // verified Resend sender
//
// Optional vars:
//   EMAIL_ALLOWLIST   = "you@example.com,team@example.com"    // restrict who can sign in
//
// Required binding (declare in wrangler.toml):
//   KV_BINDING        KV namespace (stores OTPs, rate counters, prefs, signals)

const RELAY_VERSION = 'auth-23-wizard-skipped-and-ai-notice-bool';
const SESSION_TTL_SECONDS    = 7 * 24 * 60 * 60;       // 7 days
const SESSION_REFRESH_WINDOW = 1 * 24 * 60 * 60;       // refresh in last day
const OTP_TTL_SECONDS        = 10 * 60;                // 10 min
const OTP_COOLDOWN_SECONDS   = 60;                     // 1 OTP per email per minute
const OTP_IP_LIMIT_PER_HOUR  = 5;
const OTP_MAX_ATTEMPTS       = 5;

// =====================================================================
//  base64url helpers
// =====================================================================

function b64urlEncodeBytes(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlEncodeText(s) {
  return b64urlEncodeBytes(new TextEncoder().encode(s));
}
function b64urlDecodeBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function b64urlDecodeText(s) {
  return new TextDecoder().decode(b64urlDecodeBytes(s));
}

// =====================================================================
//  HS256 JWT (relay's own session tokens)
// =====================================================================

async function hsKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function signJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const h = b64urlEncodeText(JSON.stringify(header));
  const p = b64urlEncodeText(JSON.stringify(payload));
  const data = `${h}.${p}`;
  const key = await hsKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return `${data}.${b64urlEncodeBytes(new Uint8Array(sig))}`;
}

async function verifyJWT(token, secret) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const data = `${h}.${p}`;
  const key = await hsKey(secret);
  let valid = false;
  try {
    valid = await crypto.subtle.verify(
      'HMAC', key, b64urlDecodeBytes(s), new TextEncoder().encode(data)
    );
  } catch (e) { return null; }
  if (!valid) return null;
  let payload;
  try { payload = JSON.parse(b64urlDecodeText(p)); }
  catch (e) { return null; }
  if (typeof payload.exp !== 'number') return null;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

async function issueSessionToken(secret, email) {
  const now = Math.floor(Date.now() / 1000);
  return signJWT(
    {
      sub: email,
      email: email,
      iat: now,
      exp: now + SESSION_TTL_SECONDS,
      iss: 'antcv-access-relay',
    },
    secret
  );
}

// =====================================================================
//  Google ID token verification (RS256 with JWKS)
// =====================================================================

async function fetchGoogleJWKS() {
  // Cache via the Cache API so we don't hammer Google on every login.
  const cache = caches.default;
  const cacheKey = new Request('https://relay-internal.invalid/google-jwks');
  let cached = await cache.match(cacheKey);
  if (cached) {
    try { return await cached.json(); } catch (e) { /* fall through */ }
  }
  const res = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  if (!res.ok) throw new Error(`Google JWKS fetch failed: ${res.status}`);
  const text = await res.text();
  const jwks = JSON.parse(text);
  const toCache = new Response(text, {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=3600' },
  });
  await cache.put(cacheKey, toCache);
  return jwks;
}

async function verifyGoogleIdToken(idToken, expectedAud) {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('Malformed ID token');
  const [hB64, pB64, sB64] = parts;

  let header, payload;
  try {
    header = JSON.parse(b64urlDecodeText(hB64));
    payload = JSON.parse(b64urlDecodeText(pB64));
  } catch (e) { throw new Error('ID token decode failed'); }

  if (header.alg !== 'RS256') throw new Error('Unexpected alg: ' + header.alg);
  if (!header.kid) throw new Error('No kid in ID token header');

  const jwks = await fetchGoogleJWKS();
  const jwk = (jwks.keys || []).find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('No matching JWK for kid');

  const pubKey = await crypto.subtle.importKey(
    'jwk', jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['verify']
  );

  const data = new TextEncoder().encode(`${hB64}.${pB64}`);
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5', pubKey, b64urlDecodeBytes(sB64), data
  );
  if (!valid) throw new Error('ID token signature invalid');

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp < now) throw new Error('ID token expired');
  if (payload.aud !== expectedAud) throw new Error('Audience mismatch');
  const validIss = ['accounts.google.com', 'https://accounts.google.com'];
  if (!validIss.includes(payload.iss)) throw new Error('Issuer mismatch');
  if (!payload.email) throw new Error('No email claim in ID token');
  if (payload.email_verified === false) throw new Error('Google reports email is not verified');

  return {
    email: String(payload.email).toLowerCase(),
    name: payload.name || '',
    sub: payload.sub,
  };
}

// =====================================================================
//  Resend email
// =====================================================================

async function sendOtpEmail(env, to, code) {
  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY not set on relay');
  const from = env.EMAIL_FROM || 'AntCV <onboarding@resend.dev>';
  const subject = `AntCV sign-in code: ${code}`;
  const text =
    `Your AntCV sign-in code is: ${code}\n\n` +
    `Enter this code in the app to finish signing in. ` +
    `It expires in 10 minutes. If you didn't request it, ignore this email.\n`;
  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Calibri,sans-serif;color:#283556">
<div style="max-width:480px;margin:0 auto;background:#fff;padding:32px;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.05)">
  <h1 style="margin:0 0 16px;font-size:18px;color:#283556;font-weight:600">AntCV sign-in code</h1>
  <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#4a5568">Enter this code in the app to finish signing in:</p>
  <div style="font-size:30px;font-weight:700;letter-spacing:0.18em;color:#00746E;padding:20px 16px;background:#f0fafa;border:1px solid #e0f0f0;text-align:center;border-radius:6px;margin:0 0 20px;font-family:'SF Mono',Menlo,Consolas,monospace">${code}</div>
  <p style="margin:0;font-size:13px;line-height:1.5;color:#718096">Code expires in 10 minutes. If you didn't request this, you can safely ignore the email.</p>
</div>
</body></html>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, text, html }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend ${res.status}: ${body.slice(0, 240)}`);
  }
  return res.json().catch(() => ({}));
}

// v2.8: data retention reminder email.
// Sent at T-30 days from the renewal deadline. The user opens AntCV,
// the cloud-sync GET sees the expiring window, and we fire-and-forget
// this email so they're aware before the in-app modal blocks them.
async function sendRetentionEmail(env, to, daysRemaining, deadlineIso) {
  if (!env.RESEND_API_KEY) {
    console.warn('[retention] RESEND_API_KEY not set, skipping email');
    return null;
  }
  const from = env.EMAIL_FROM || 'AntCV <onboarding@resend.dev>';
  const appUrl = env.APP_URL || 'https://cv-generator-det.pages.dev';
  const subject = daysRemaining <= 0
    ? 'AntCV: please confirm your saved data'
    : `AntCV: please confirm your saved data within ${daysRemaining} days`;
  const deadline = deadlineIso ? new Date(deadlineIso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'soon';
  const text =
    `It's been almost a year since you last confirmed your AntCV data.\n\n` +
    `Open AntCV at ${appUrl} to either:\n` +
    `  - Keep your data for another year (1 click)\n` +
    `  - Delete your account and all stored settings\n\n` +
    `Renewal deadline: ${deadline}\n\n` +
    `What's stored: your name, profile photo, work history, API keys, ` +
    `cover-letter drafts, and theme preferences. All cross-device synced ` +
    `via your hashed email — no AntCV employee can read it.\n\n` +
    `If you do nothing, you'll see the confirmation prompt every time you sign in.\n`;
  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Calibri,sans-serif;color:#283556">
<div style="max-width:480px;margin:0 auto;background:#fff;padding:32px;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.05)">
  <h1 style="margin:0 0 16px;font-size:18px;color:#283556;font-weight:600">Confirm your AntCV data</h1>
  <p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#4a5568">It's been almost a year since you last confirmed your AntCV data. AntCV asks you to renew your consent annually as part of your data-retention controls.</p>
  <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#4a5568"><strong>Renewal deadline:</strong> ${deadline}</p>
  <p style="margin:0 0 24px;font-size:13px;line-height:1.5;color:#4a5568"><strong>What's stored:</strong> your name, profile photo, work history, API keys, cover-letter drafts, and theme preferences. All cross-device synced via your hashed email.</p>
  <div style="text-align:center;margin:0 0 16px">
    <a href="${appUrl}" style="display:inline-block;padding:12px 24px;background:#01B7BB;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px">Open AntCV to renew or delete</a>
  </div>
  <p style="margin:0;font-size:12px;line-height:1.5;color:#718096">If you do nothing, you'll see the confirmation prompt every time you sign in. To delete everything, choose "Delete my account" in the confirmation dialog.</p>
</div>
</body></html>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, text, html }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn(`[retention] sendRetentionEmail failed: ${res.status} ${body.slice(0, 200)}`);
      return null;
    }
    return await res.json().catch(() => ({}));
  } catch (e) {
    console.warn('[retention] sendRetentionEmail error:', e && e.message);
    return null;
  }
}

// v2.8: compute retention status for a prefs record.
// Returns { status, days_remaining, deadline_iso, should_email }.
// status: 'ok' | 'expiring_soon' (T-30 to T+0) | 'expired' (T+0 onwards)
// should_email: true if we should send the reminder now
function computeRetentionStatus(prefs, env) {
  const retentionDays = parseInt(env.RETENTION_DAYS || '365', 10) || 365;
  const reminderDays = 30; // T-30 reminder window
  const now = Date.now();
  const created = prefs.created_at ? new Date(prefs.created_at).getTime() : null;
  const renewed = prefs.last_renewed_at ? new Date(prefs.last_renewed_at).getTime() : created;
  if (!renewed) {
    return { status: 'ok', days_remaining: retentionDays, deadline_iso: null, should_email: false };
  }
  const deadline = renewed + retentionDays * 24 * 3600 * 1000;
  const daysRemaining = Math.ceil((deadline - now) / (24 * 3600 * 1000));
  const deadlineIso = new Date(deadline).toISOString();
  let status = 'ok';
  if (daysRemaining <= 0) status = 'expired';
  else if (daysRemaining <= reminderDays) status = 'expiring_soon';

  // Should we send a reminder email?
  // Conditions: status is expiring_soon OR expired, AND we haven't sent one recently.
  // Last email tracking: prefs.retention_email_sent_at — only send if absent or
  // more than 14 days ago (so the user gets at most ~2-3 reminders, not spam).
  let shouldEmail = false;
  if (status !== 'ok') {
    const lastEmail = prefs.retention_email_sent_at ? new Date(prefs.retention_email_sent_at).getTime() : 0;
    if (now - lastEmail > 14 * 24 * 3600 * 1000) shouldEmail = true;
  }

  return { status, days_remaining: daysRemaining, deadline_iso: deadlineIso, should_email: shouldEmail };
}

// =====================================================================
//  OTP + rate-limit helpers (KV-backed)
// =====================================================================

function generateOtpCode() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0] % 1000000).padStart(6, '0');
}

function normalizeEmail(raw) {
  return String(raw || '').trim().toLowerCase();
}

function isValidEmail(email) {
  // Simple, deliberately not RFC-perfect — Resend will reject anything actually weird.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

// Allowlist sources (in order):
//   1. KV value at "relay:allowlist" (a JSON array). Persisted by the
//      admin endpoint /admin/allowlist; takes precedence when set.
//   2. env.EMAIL_ALLOWLIST var from wrangler.toml. Static; the seed.
//   3. None. Empty list = open (anyone can sign in).
//
// emailAllowed() and getAllowlist() are async because KV is async.

async function getAllowlist(env) {
  // KV first.
  if (env && env.KV_BINDING) {
    try {
      const raw = await env.KV_BINDING.get('relay:allowlist');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return { list: parsed.map((s) => String(s).trim().toLowerCase()).filter(Boolean), source: 'kv' };
        }
      }
    } catch (e) { /* fall through to env */ }
  }
  // Env var fallback.
  const envRaw = (env && env.EMAIL_ALLOWLIST) || '';
  if (envRaw.trim()) {
    return {
      list: envRaw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
      source: 'env',
    };
  }
  return { list: [], source: 'open' };
}

async function setAllowlist(env, list) {
  if (!env || !env.KV_BINDING) {
    throw new Error('KV_BINDING is not configured on the relay; cannot persist allowlist edits.');
  }
  const cleaned = (Array.isArray(list) ? list : [])
    .map((s) => String(s).trim().toLowerCase())
    .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254);
  // De-duplicate, preserving order.
  const seen = new Set();
  const unique = [];
  for (const e of cleaned) { if (!seen.has(e)) { seen.add(e); unique.push(e); } }
  await env.KV_BINDING.put('relay:allowlist', JSON.stringify(unique));
  return unique;
}

async function emailAllowed(env, email) {
  const { list } = await getAllowlist(env);
  if (list.length === 0) return true; // open
  return list.includes(String(email || '').toLowerCase());
}

function adminEmails(env) {
  const raw = (env && env.ADMIN_EMAILS) || '';
  return raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

// Identity (JWT-derived) is admin if its email is in ADMIN_EMAILS.
// If ADMIN_EMAILS is unset, the relay has no admin — admin endpoints
// reject everyone with a clear hint.
function isAdmin(env, id) {
  if (!id || !id.email) return false;
  const list = adminEmails(env);
  if (list.length === 0) return false;
  return list.includes(String(id.email).toLowerCase());
}

function clientIpHash(request) {
  const ip =
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For') ||
    '0.0.0.0';
  // Non-cryptographic hash to avoid storing raw IPs in KV.
  let h = 5381;
  for (let i = 0; i < ip.length; i++) h = ((h << 5) + h + ip.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

async function rateLimitCheck(env, key, max, windowSeconds) {
  if (!env.KV_BINDING) return { ok: true };
  const raw = storageBound ? await kv.get(key) : null;
  const n = raw ? parseInt(raw, 10) : 0;
  if (n >= max) return { ok: false, count: n };
  await env.KV_BINDING.put(key, String(n + 1), { expirationTtl: windowSeconds });
  return { ok: true, count: n + 1 };
}

// =====================================================================
//  CORS
// =====================================================================

function parseAllowedOrigins(env) {
  const raw = (env && env.ALLOWED_ORIGINS) || '';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function corsHeaders(request, env) {
  const allowed = parseAllowedOrigins(env);
  const origin = request.headers.get('Origin') || '';
  let allowOrigin;
  if (allowed.length === 0) allowOrigin = '*';
  else if (allowed.includes(origin)) allowOrigin = origin;
  else allowOrigin = allowed[0];

  const headers = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, x-api-key, x-provider, x-gemini-model, x-antcv-client',
    'Access-Control-Expose-Headers': 'X-Auth-Refresh',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
  if (allowOrigin !== '*') headers['Access-Control-Allow-Credentials'] = 'true';
  return headers;
}

function jsonResponse(data, status, request, env, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env), ...extra },
  });
}

function withCors(response, request, env, extra = {}) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(corsHeaders(request, env))) headers.set(k, v);
  for (const [k, v] of Object.entries(extra)) headers.set(k, v);
  return new Response(response.body, {
    status: response.status, statusText: response.statusText, headers,
  });
}

// =====================================================================
//  Identity (from session JWT)
// =====================================================================

async function identityFromRequest(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  if (!env.JWT_SECRET) return null;
  const payload = await verifyJWT(m[1], env.JWT_SECRET);
  if (!payload || !payload.email) return null;
  return { email: payload.email, exp: payload.exp, iat: payload.iat, token: m[1] };
}

// Returns a header object with X-Auth-Refresh if the caller's token is in
// the last refresh window (so the PWA can rotate it transparently).
async function maybeRefreshHeader(env, identity) {
  if (!identity || !identity.exp) return {};
  const now = Math.floor(Date.now() / 1000);
  if (identity.exp - now > SESSION_REFRESH_WINDOW) return {};
  try {
    const fresh = await issueSessionToken(env.JWT_SECRET, identity.email);
    return { 'X-Auth-Refresh': fresh };
  } catch (e) { return {}; }
}

function userScopedKey(prefix, email) {
  return prefix + ':' + email.toLowerCase().replace(/[^a-z0-9@._-]/g, '_');
}

// v2.5 Phase 2: hashed email keys to keep raw addresses out of the KV
// browser. SHA-256 over lowercased email, base64url-encoded, 32 chars.
async function userScopedKeyHashed(prefix, email) {
  const norm = String(email || '').trim().toLowerCase();
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(norm));
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return prefix + ':' + b64.slice(0, 32);
}

// =====================================================================
//  v2.10: User mode (paid vs demo) for upstream routing
// =====================================================================
//
// Each authenticated user has a `mode` field on their prefs2 KV record:
//   - "paid" (default): forward to cv-proxy (UPSTREAM binding /
//                       UPSTREAM_ORIGIN). Paid is BYOK; users without
//                       their own keys hit a setup-required warning.
//   - "demo":           forward to antcv-demo-proxy (UPSTREAM_DEMO
//                       binding / UPSTREAM_ORIGIN_DEMO). Demo proxy
//                       holds shared keys and enforces its own caps.
//
// Read path is hot — called on every upstream forward — so we keep an
// in-memory cache in module scope. Cloudflare keeps isolates warm
// across requests for active users, so first request per (isolate, user)
// hits KV (~5ms), subsequent requests within the TTL skip it. Cache is
// naturally evicted on isolate restart; we also invalidate after a
// mode-write so the writer's next request sees the new value immediately.
const _modeCache = new Map();  // email (lowercased) -> { mode, expiresAt }
const _MODE_TTL_MS = 60000;

function invalidateModeCache(email) {
  if (email) _modeCache.delete(String(email).toLowerCase());
}

async function getUserMode(env, email) {
  if (!email) return 'paid';
  const norm = String(email).toLowerCase();
  const now = Date.now();
  const cached = _modeCache.get(norm);
  if (cached && cached.expiresAt > now) return cached.mode;

  const kv = env.KV_BINDING || env.ANALYTICS || null;
  let mode = 'paid';
  if (kv) {
    try {
      const key = await userScopedKeyHashed('prefs2', norm);
      const raw = await kv.get(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.mode === 'demo') mode = 'demo';
      }
    } catch (_) { /* fall through to default 'paid' */ }
  }
  _modeCache.set(norm, { mode, expiresAt: now + _MODE_TTL_MS });
  return mode;
}

// Resolve the user's effective mode for an incoming request.
// Anonymous (no JWT) defaults to 'paid' — same as having no record.
async function getUpstreamContext(request, env) {
  const id = await identityFromRequest(request, env);
  const mode = id ? await getUserMode(env, id.email) : 'paid';
  return { mode, email: id ? id.email : null };
}

function hasDemoServiceBinding(env) {
  return !!(env && env.UPSTREAM_DEMO && typeof env.UPSTREAM_DEMO.fetch === 'function');
}

function originForMode(env, mode) {
  return mode === 'demo'
    ? (env.UPSTREAM_ORIGIN_DEMO || null)
    : (env.UPSTREAM_ORIGIN      || null);
}

function hasUpstreamForMode(env, mode) {
  if (mode === 'demo') return hasDemoServiceBinding(env) || !!env.UPSTREAM_ORIGIN_DEMO;
  return hasServiceBinding(env) || !!env.UPSTREAM_ORIGIN;
}

// v2.5: parse ADMIN_EMAIL_ALLOWLIST env var (comma-separated) and check membership.
// v2.9.1: fall back to ADMIN_EMAILS (the var used by isAdmin) when
// ADMIN_EMAIL_ALLOWLIST is unset. Before this change the two checks read
// different env vars: /admin/allowlist used ADMIN_EMAILS, but /api/admin/demo
// and /api/admin/demo-usage-history used ADMIN_EMAIL_ALLOWLIST. A deployment
// that set only one of them would see "Not in ADMIN_EMAIL_ALLOWLIST" 403s on
// the demo endpoints while every other admin endpoint worked. Now both vars
// are accepted and unioned.
function isAdminEmail(email, env) {
  const norm = s => String(s || '').trim().toLowerCase();
  const target = norm(email);
  if (!target) return false;
  const raw1 = (env && env.ADMIN_EMAIL_ALLOWLIST) || '';
  const raw2 = (env && env.ADMIN_EMAILS) || '';
  const list = (raw1 + ',' + raw2).split(',').map(norm).filter(Boolean);
  return list.includes(target);
}

// v2.5: load the admin-published demo config (or null if unset).
async function getAdminDemo(env) {
  const kv = env.KV_BINDING || env.ANALYTICS || null;
  if (!kv) return null;
  try {
    const raw = await kv.get('prefs:__admin_demo__');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Schema: { demoProxyUrl, demoCapUsd, demoEndsAt, demoDescription }
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_) { return null; }
}

// v2.2.0: PWA-facing /api/prefs now splits between KV and D1 internally.
//   KV  (prefs2:<hash>) holds apiKeys + retention metadata + transitional
//                       sections/meta/rationale blobs.
//   D1  (user_kernel)   holds identity (personalInfo identity slice),
//                       history  (personalInfo history slice),
//                       preferences (all UI/AI settings — flat camelCase),
//                       photo_b64.
//
// The PWA's wire shape is unchanged: clients send flat fields, server splits
// them. On read, server merges and returns the flat shape. This isolation
// means we can move pieces between stores again without breaking clients.

// personalInfo top-level keys that belong in user_kernel.identity (single
// values describing the person). Everything else in personalInfo goes to
// user_kernel.history (lists of past roles, schools, publications, etc.)
// or stays as an arbitrary identity extension if unrecognised.
const PI_IDENTITY_KEYS = new Set([
  'name', 'fullName', 'email', 'phone', 'linkedin', 'github', 'website',
  'location', 'citizenship', 'summary', 'notes', 'contactExtra',
  'photo', 'photoCircular', 'photoBorderColor', 'photoBorderWidth',
  'kw', 'st',
]);
const PI_HISTORY_KEYS = new Set([
  'workHistory', 'education', 'publications', 'certifications',
  'languages', 'tools', 'regulatory', 'additional',
  'patentNumber', 'patentDescription',
]);

function splitPersonalInfo(pi) {
  const identity = {};
  const history = {};
  if (pi && typeof pi === 'object') {
    for (const [k, v] of Object.entries(pi)) {
      if (PI_HISTORY_KEYS.has(k)) history[k] = v;
      else identity[k] = v; // identity catches recognised identity keys AND unknown extensions
    }
  }
  return { identity, history };
}

function mergePersonalInfo(identity, history) {
  // Inverse of splitPersonalInfo: rebuild the flat personalInfo shape that
  // the PWA expects. Identity and history are merged with history winning
  // on any key collision (shouldn't happen given disjoint key sets).
  //
  // v2.3.1: normalize snake_case keys to camelCase. v2.2.0's legacyKvToKernel
  // wrote work_history / language_skills / style_package / tone_register /
  // canonical_language / banned_words / banned_phrases into D1. Rows migrated
  // under that version still carry those keys; the PWA's UI looks for the
  // camelCase forms and silently renders nothing. Translating on the way out
  // means those old rows display correctly without a one-off data fix.
  const SNAKE_TO_CAMEL = {
    work_history: 'workHistory',
    language_skills: 'languages',
    style_package: 'stylePackage',
    tone_register: 'toneRegister',
    canonical_language: 'language',
    banned_words: 'bannedWords',
    banned_phrases: 'bannedPhrases',
    full_name: 'fullName',
    patent_number: 'patentNumber',
    patent_description: 'patentDescription',
    contact_extra: 'contactExtra',
  };
  const out = {};
  const _merged = { ...(identity || {}), ...(history || {}) };
  for (const [k, v] of Object.entries(_merged)) {
    const ck = (k in SNAKE_TO_CAMEL) ? SNAKE_TO_CAMEL[k] : k;
    // If both forms are present (rare), camelCase wins.
    if (ck in out && out[ck] !== undefined && out[ck] !== null) continue;
    out[ck] = v;
  }
  return out;
}

// Field groups for /api/prefs PUT routing.
// API keys & retention -> KV. Everything else -> D1 user_kernel.preferences,
// except personalInfo (split via PI_*), photo (-> photo_b64 column), and
// sections/meta/rationale (kept in KV for now, Phase B moves them to /api/applications).
const KV_ONLY_FIELDS = new Set([
  'apiKeys',
  // Transitional — large per-JD blobs that don't belong in user_kernel.
  // Slated to migrate to /api/applications in a future ship.
  'sections', 'meta', 'rationale',
]);

const KERNEL_PREFS_STR_FIELDS = new Set([
  'proxyUrl', 'language', 'navyColor', 'stylePackage',
  'openaiProxyUrl', 'openaiModel', 'mistralModel', 'geminiModel',
  'toneRegister', 'sidebarPosition',
  'memoryDigest', 'memoryDigestHash',
  'profileDoc', 'skillsDoc', 'danishDoc', 'wordsDoc',
  '_erasedAt',
]);
const KERNEL_PREFS_BOOL_FIELDS = new Set([
  'consensusEnabled', 'kernelShowcaseGenerated', 'useChatGPT', 'wizardCompleted',
  // v2.5.4: 4-state wizard contract additions.
  //   wizardSkipped — set true when the user pressed Skip; cleared (false)
  //     when wizardCompleted becomes true (completion overrides skip). Without
  //     this in the allowlist, Skip survives only in localStorage; sign-out
  //     wipes it and sign-in's cloud-restore can't recover it, so the wizard
  //     reopens on every fresh sign-in for any user who chose Skip.
  //   aiNoticeAccepted — boolean form of the EU AI Act Article 50(1)
  //     acknowledgement. Toggleable: setting it false un-acks (per spec
  //     §4 row 6). Coexists with the structured 'aiDisclosureAccepted'
  //     OBJ field, which remains the legacy audit record; this boolean is
  //     the canonical flag the wizard contract reads from.
  'wizardSkipped',
  'aiNoticeAccepted',
]);
const KERNEL_PREFS_NUM_FIELDS = new Set([
  'cvTableRatio', 'clTableRatio', 'cvSidebarRatio',
]);
const KERNEL_PREFS_OBJ_FIELDS = new Set([
  'headerItemLoc', 'headerItemAlign',
  'lineTargets', 'fontSizes',
  'styleConfig', 'customStyleConfig',
  'routingOverrides', 'compressPrefs',
  // v2.5.1: AI Act Article 50(1) acknowledgement record. Written by the
  // PWA's antcv-ai-disclosure.js after the user ticks "I understand and
  // accept these terms." Shape: { version, acceptedAt, identity,
  // userEmail, userAgent, upgradedAt? }. The PWA's cloud-restore branch
  // reads this back so a returning user on a new device skips the
  // disclosure (the acknowledgement is per-identity, not per-device).
  // Stored in D1 user_kernel.preferences alongside other small structured
  // prefs; the existing OBJ validator (null = clear, object = accept) is
  // exactly the right semantics.
  'aiDisclosureAccepted',
  // v2.5.2: enabledLanguages — array of language codes (e.g. ["en","da"])
  // that the user has enabled in the top language bar / wizard. Written by
  // antcv-language-prefs.js. Arrays satisfy typeof === 'object' so the
  // existing OBJ_FIELDS validator passes them through correctly.
  'enabledLanguages',
]);

function isInKernelAllowlist(field) {
  return KERNEL_PREFS_STR_FIELDS.has(field)
      || KERNEL_PREFS_BOOL_FIELDS.has(field)
      || KERNEL_PREFS_NUM_FIELDS.has(field)
      || KERNEL_PREFS_OBJ_FIELDS.has(field);
}

// Validate a single (k, v) pair against the kernel allowlist. Returns
//   {ok: true}             value type-matches; write it.
//   {ok: false, skip: true} value is null and the field doesn't accept null;
//                           don't write, don't flag as dropped (the PWA sends
//                           null defaults for unset fields).
//   {ok: false}            real type mismatch; flag as dropped.
function validateKernelPref(k, v) {
  if (KERNEL_PREFS_STR_FIELDS.has(k)) {
    if (typeof v === 'string') return { ok: true };
    if (v === null || v === undefined) return { ok: false, skip: true };
    return { ok: false };
  }
  if (KERNEL_PREFS_BOOL_FIELDS.has(k)) {
    if (typeof v === 'boolean') return { ok: true };
    if (v === null || v === undefined) return { ok: false, skip: true };
    return { ok: false };
  }
  if (KERNEL_PREFS_NUM_FIELDS.has(k)) {
    if (typeof v === 'number' && Number.isFinite(v)) return { ok: true };
    if (v === null || v === undefined) return { ok: false, skip: true };
    return { ok: false };
  }
  if (KERNEL_PREFS_OBJ_FIELDS.has(k)) {
    // Object fields: null is an explicit clear, undefined is skip.
    if (v === undefined) return { ok: false, skip: true };
    if (v === null) return { ok: true };
    if (typeof v === 'object') return { ok: true };
    return { ok: false };
  }
  return { ok: false };
}

// Fields that ga() emits for informational purposes (version metadata,
// flat apiKey forms that duplicate apiKeys.anthropic, etc). Silently
// accepted — not stored, not flagged as dropped.
const INFORMATIONAL_FIELDS = new Set([
  'version', 'savedAt', 'includeKeys',
  'apiKey', 'openaiKey', 'mistralKey', 'geminiKey', // canonical form is apiKeys object
  'proxyUrl_lastCloud',
]);

// v2.5: GET/PUT /api/prefs — user prefs (proxyUrl/photo/apiKeys) + adminDemo
async function handleApiPrefs(request, env) {
  const kv = env.KV_BINDING || env.ANALYTICS || null;
  const id = await identityFromRequest(request, env);
  if (!id) {
    return jsonResponse(
      { error: 'unauthenticated', hint: 'Sign in first.' },
      401, request, env
    );
  }
  const key = await userScopedKeyHashed('prefs2', id.email);
  const userHash = await userHashFromEmail(id.email);
  const d1Available = hasD1(env);
  const refresh = await maybeRefreshHeader(env, id);
  const m = request.method;

  if (m === 'GET') {
    // v2.2.0: merged-read from KV (apiKeys + retention + transitional sections)
    // and D1 user_kernel (identity/history/preferences/photo). The output is
    // a single flat object — clients don't see the split.
    const kvPrefs = await (async () => {
      if (!kv) return {};
      try {
        const raw = await kv.get(key);
        return raw ? (JSON.parse(raw) || {}) : {};
      } catch (_) { return {}; }
    })();

    // Lazy migration: first D1-aware GET for a user with KV-only data backfills
    // D1 from the legacy KV record. Same idempotent helper as /api/profile/kernel.
    let migration = null;
    if (d1Available) {
      try {
        const probe = await env.DB.prepare(
          'SELECT user_hash FROM user_kernel WHERE user_hash = ? LIMIT 1'
        ).bind(userHash).first();
        if (!probe) migration = await migrateKvPrefsToD1IfEmpty(env, id);
      } catch (_) { /* fall through */ }
    }

    let kernel = null;
    if (d1Available) {
      try {
        const row = await env.DB.prepare(
          'SELECT * FROM user_kernel WHERE user_hash = ? LIMIT 1'
        ).bind(userHash).first();
        kernel = shapeKernelRow(row);
      } catch (_) { kernel = null; }
    }

    // v2.3.0 Phase B: read the active application (sections/meta/rationale)
    // and surface it inline on the /api/prefs GET response. This lets the PWA
    // pull everything in one round trip on sign-in/Read-from-Cloud.
    let activeApplication = null;
    if (d1Available) {
      try {
        const ptr = await env.DB.prepare(
          'SELECT application_id FROM active_application WHERE user_hash = ?'
        ).bind(userHash).first();
        if (ptr && ptr.application_id) {
          const appRow = await env.DB.prepare(
            'SELECT * FROM application WHERE id = ? AND user_hash = ?'
          ).bind(ptr.application_id, userHash).first();
          activeApplication = shapeApplicationRow(appRow);
        }
      } catch (_) { activeApplication = null; }
    }

    // Merge into the flat /api/prefs wire shape.
    //  - apiKeys + transitional fields come from KV
    //  - all settings (BYOK, tone, sidebar, style, etc.) come from kernel.preferences
    //  - personalInfo is rebuilt from kernel.identity + kernel.history
    //  - photo comes from kernel.photo_b64
    const merged = {};
    if (kvPrefs && typeof kvPrefs === 'object') {
      if (kvPrefs.apiKeys && typeof kvPrefs.apiKeys === 'object') merged.apiKeys = kvPrefs.apiKeys;
      // proxyUrl historically lived in KV; D1 preferences also carries it after writes.
      // Prefer D1 (newer authority); fall back to KV.
      if (typeof kvPrefs.proxyUrl === 'string') merged.proxyUrl = kvPrefs.proxyUrl;
      // Transitional: sections / meta / rationale stay in KV for now.
      if (kvPrefs.sections) merged.sections = kvPrefs.sections;
      if (kvPrefs.meta) merged.meta = kvPrefs.meta;
      if (kvPrefs.rationale) merged.rationale = kvPrefs.rationale;
    }
    if (kernel) {
      // Spread kernel.preferences as flat top-level fields.
      if (kernel.preferences && typeof kernel.preferences === 'object') {
        for (const [k, v] of Object.entries(kernel.preferences)) {
          if (v !== undefined) merged[k] = v;
        }
      }
      // Rebuild personalInfo from identity + history.
      const pi = mergePersonalInfo(kernel.identity, kernel.history);
      if (Object.keys(pi).length) merged.personalInfo = pi;
      if (kernel.photo_b64) merged.photo = kernel.photo_b64;
    }

    // Defensive strip of LLM-derived doc blobs that should never round-trip.
    const LOCAL_ONLY = ['memoryDigest','memoryDigestHash','profileDoc','skillsDoc','danishDoc','wordsDoc'];
    for (const f of LOCAL_ONLY) {
      if (f in merged) delete merged[f];
    }

    const adminDemo = await getAdminDemo(env);
    const retention = computeRetentionStatus(kvPrefs, env);
    if (retention.should_email && id.email) {
      kvPrefs.retention_email_sent_at = new Date().toISOString();
      if (kv) {
        try { await kv.put(key, JSON.stringify(kvPrefs)); } catch (_) {}
      }
      sendRetentionEmail(env, id.email, retention.days_remaining, retention.deadline_iso).catch(() => {});
    }

    // Phase B: surface active application alongside prefs. The PWA can
    // apply application.cv_sections / .cl_sections / .rationale / .jd_company
    // / .jd_role / .jd_text on read without a second round trip.
    return jsonResponse(
      {
        ok: true,
        prefs: merged,
        active_application: activeApplication,
        adminDemo,
        retention,
        storage: {
          kv: !!kv,
          d1: d1Available,
          kernel_present: !!kernel,
          active_application_present: !!activeApplication,
        },
        migration,
        storage_bound: !!kv,
      },
      200, request, env, refresh
    );
  }

  if (m === 'PUT' || m === 'POST') {
    let data; try { data = await request.json(); }
    catch (_) { return jsonResponse({ error: 'invalid_json' }, 400, request, env, refresh); }
    if (!data || typeof data !== 'object') {
      return jsonResponse({ error: 'invalid_body' }, 400, request, env, refresh);
    }
    const PHOTO_CAP = 500 * 1024;
    if (typeof data.photo === 'string' && data.photo.length > PHOTO_CAP) {
      return jsonResponse(
        { error: 'photo_too_large', maxBytes: PHOTO_CAP, gotBytes: data.photo.length },
        413, request, env, refresh
      );
    }
    // v2.2.0: split-write. Fields are routed to KV or D1 based on the
    // KV_ONLY_FIELDS / KERNEL_PREFS_* allowlists. The wire shape is unchanged;
    // routing is invisible above this line.
    let current = {};
    if (kv) {
      try {
        const raw = await kv.get(key);
        if (raw) current = JSON.parse(raw) || {};
      } catch (_) { current = {}; }
    }
    const saved = [];
    // Retention bookkeeping in KV. created_at is set on FIRST write only.
    const nowIso = new Date().toISOString();
    if (!current.created_at) {
      current.created_at = nowIso;
      current.last_renewed_at = nowIso;
    }
    const dropped = [];

    // =====================================================================
    // KV writes — API keys, transitional blobs, retention.
    // =====================================================================
    if (data.apiKeys && typeof data.apiKeys === 'object') {
      current.apiKeys = data.apiKeys;
      saved.push('apiKeys');
    }
    if (typeof data.proxyUrl === 'string') {
      // proxyUrl is mirrored in both KV and D1.preferences so older clients
      // that read only KV still see it. New clients read it from D1 prefs.
      current.proxyUrl = data.proxyUrl.trim();
      saved.push('proxyUrl');
    }
    // Transitional: sections / meta / rationale stay in KV. Phase B will
    // migrate them to /api/applications rows.
    for (const f of ['sections', 'meta', 'rationale']) {
      if (f in data) {
        if (data[f] === null) { current[f] = null; saved.push(f); }
        else if (typeof data[f] === 'object') { current[f] = data[f]; saved.push(f); }
        else dropped.push(f);
      }
    }
    current.updated_at = nowIso;
    if (kv) {
      try { await kv.put(key, JSON.stringify(current)); }
      catch (eKv) { return jsonResponse({ ok: false, error: 'kv_write_failed', message: String(eKv && eKv.message || eKv) }, 500, request, env, refresh); }
    }

    // =====================================================================
    // D1 writes — identity / history / preferences / photo_b64.
    // =====================================================================
    let d1Written = false;
    if (d1Available) {
      // Read current kernel for read-modify-write merge.
      let curIdentity = {}, curHistory = {}, curPrefs = {}, curPhoto = undefined;
      try {
        const row = await env.DB.prepare(
          'SELECT * FROM user_kernel WHERE user_hash = ? LIMIT 1'
        ).bind(userHash).first();
        if (row) {
          curIdentity = parseJsonField(row.identity, {}) || {};
          curHistory  = parseJsonField(row.history,  {}) || {};
          curPrefs    = parseJsonField(row.preferences, {}) || {};
          curPhoto    = row.photo_b64 || null;
        }
      } catch (_) { /* row missing -> treated as empty kernel */ }

      let kernelDirty = false;
      const newIdentity = { ...curIdentity };
      const newHistory  = { ...curHistory };
      const newPrefs    = { ...curPrefs };
      let newPhoto = curPhoto;

      // personalInfo: split into identity + history, replace cleanly so we
      // don't accumulate stale fields. The PWA always sends the full PI blob.
      //
      // v2.3.1: null is now SKIPPED, not wiped. The PWA's ga() snapshot can
      // send personalInfo: null when localStorage is empty (right after
      // sign-in on a new device, after a hard refresh, etc.) and a wipe in
      // that situation destroys the user's profile. Explicit wipes should
      // target DELETE /api/profile/kernel instead.
      if (data.personalInfo === null) {
        // No-op. Don't add to saved or dropped — it's not an error, it's a skip.
      } else if (data.personalInfo && typeof data.personalInfo === 'object') {
        // v2.3.1: normalize stray snake_case keys in the incoming PI before split.
        // Defense against round-trips where the client re-uploaded a previously
        // mis-normalized response.
        const PI_SNAKE_TO_CAMEL = {
          work_history: 'workHistory',
          language_skills: 'languages',
          full_name: 'fullName',
          patent_number: 'patentNumber',
          patent_description: 'patentDescription',
          contact_extra: 'contactExtra',
        };
        const _piNorm = {};
        for (const [k, v] of Object.entries(data.personalInfo)) {
          const ck = (k in PI_SNAKE_TO_CAMEL) ? PI_SNAKE_TO_CAMEL[k] : k;
          if (!(ck in _piNorm)) _piNorm[ck] = v;
        }
        const split = splitPersonalInfo(_piNorm);
        // Replace identity + history entirely on each full-PI write.
        for (const k of Object.keys(newIdentity)) delete newIdentity[k];
        for (const k of Object.keys(newHistory))  delete newHistory[k];
        Object.assign(newIdentity, split.identity);
        Object.assign(newHistory,  split.history);
        newIdentity.email = id.email; // server-authoritative
        saved.push('personalInfo');
        kernelDirty = true;
      } else if ('personalInfo' in data) {
        dropped.push('personalInfo');
      }

      // photo -> photo_b64 column. Accept string or explicit null.
      if (data.photo === null) {
        newPhoto = null;
        saved.push('photo');
        kernelDirty = true;
      } else if (typeof data.photo === 'string') {
        newPhoto = data.photo;
        saved.push('photo');
        kernelDirty = true;
      } else if ('photo' in data) {
        dropped.push('photo');
      }

      // Every other recognised field -> kernel.preferences (flat camelCase).
      for (const [k, v] of Object.entries(data)) {
        if (k === 'apiKeys' || k === 'proxyUrl' || k === 'sections' || k === 'meta' || k === 'rationale' || k === 'personalInfo' || k === 'photo') continue;
        // v2.3.0: silently ignore informational metadata that ga() includes.
        if (INFORMATIONAL_FIELDS.has(k)) continue;
        if (!isInKernelAllowlist(k)) {
          // Track unknown fields explicitly so the PWA can warn at debug time.
          if (!(k in current)) dropped.push(k);
          continue;
        }
        const v2 = validateKernelPref(k, v);
        if (v2.skip) continue;          // v2.3.0: null/undefined silently skipped
        if (!v2.ok) { dropped.push(k); continue; }
        newPrefs[k] = v;
        saved.push(k);
        kernelDirty = true;
      }

      // Mirror proxyUrl into D1 preferences too so reads from D1-only path work.
      if (typeof data.proxyUrl === 'string') {
        newPrefs.proxyUrl = data.proxyUrl.trim();
        kernelDirty = true;
      }

      if (kernelDirty) {
        const now = Date.now();
        try {
          // Ensure email is always pinned in identity.
          newIdentity.email = id.email;
          const sets = [
            'identity = excluded.identity',
            'history = excluded.history',
            'preferences = excluded.preferences',
            'updated_at = excluded.updated_at',
          ];
          // Only touch photo_b64 when the PUT explicitly included `photo`.
          if (data.photo === null || typeof data.photo === 'string') {
            sets.push('photo_b64 = excluded.photo_b64');
          }
          const sql =
            'INSERT INTO user_kernel (user_hash, identity, history, preferences, photo_b64, created_at, updated_at) ' +
            'VALUES (?, ?, ?, ?, ?, ?, ?) ' +
            'ON CONFLICT(user_hash) DO UPDATE SET ' + sets.join(', ');
          await env.DB.prepare(sql).bind(
            userHash,
            JSON.stringify(newIdentity),
            JSON.stringify(newHistory),
            JSON.stringify(newPrefs),
            newPhoto === undefined ? null : newPhoto,
            now,
            now
          ).run();
          d1Written = true;
        } catch (eD1) {
          // D1 failure must not silently drop data — surface it. KV write
          // already succeeded above (apiKeys + transitional blobs are safe).
          return jsonResponse(
            {
              ok: false,
              error: 'd1_write_failed',
              message: String(eD1 && eD1.message || eD1),
              saved_kv_only: saved.filter(f => f === 'apiKeys' || f === 'proxyUrl' || f === 'sections' || f === 'meta' || f === 'rationale'),
            },
            500, request, env, refresh
          );
        }
      }
    } else {
      // D1 not bound — accept the request but flag the un-persisted kernel fields.
      for (const [k, v] of Object.entries(data)) {
        if (k === 'apiKeys' || k === 'proxyUrl' || k === 'sections' || k === 'meta' || k === 'rationale') continue;
        if (INFORMATIONAL_FIELDS.has(k)) continue; // v2.3.0
        if (k === 'personalInfo' || k === 'photo' || isInKernelAllowlist(k)) dropped.push(k);
      }
    }

    return jsonResponse(
      {
        ok: true,
        persisted: !!kv || d1Written,
        saved, dropped,
        storage: { kv: !!kv, d1: d1Written },
        storage_bound: !!kv,
      },
      200, request, env, refresh
    );
  }

  // v2.5.3: DELETE /api/prefs — full-account deletion.
  //
  // Pre-2.5.3 this only deleted the KV prefs2:<hash> record. The D1
  // user_kernel row (identity, history, preferences, photo_b64), all
  // applications, language views, active_application pointer, and
  // telemetry rows survived. The PWA's GET path then rebuilt
  // personalInfo from the surviving D1 identity+history slices on next
  // sign-in, so a user who clicked "Delete user" and signed back in
  // saw their profile fully restored — including workHistory,
  // languages, and the AI-notice consent (which lives in identity
  // because the PWA's writeCloudAccepted embeds it inside personalInfo
  // and splitPersonalInfo routes it into the identity slice). Reported
  // by Gabriel 2026-05-20.
  //
  // Also: two legacy unhashed KV keys (prefs:<email> and signals:
  // <email>, written by /preferences and /signals through
  // handleKvScoped) were never deleted. Long-lived users still had
  // those records.
  //
  // Now: best-effort wipe of every user-scoped row across both
  // storage tiers. Two separate D1 batches so a missing telemetry
  // table (schema-telemetry.sql may not be applied on every
  // deployment) doesn't roll back the core wipe. Leaf-first ordering
  // means even if D1 foreign keys are off — which is the Cloudflare
  // D1 default — we never orphan children pointing at a deleted
  // parent.
  if (m === 'DELETE') {
    const result = {
      ok: true,
      storage_bound: !!kv,
      details: {},
    };
    let hadErrors = false;

    // 1) KV: current hashed prefs key + the two legacy unhashed keys
    //    written by handleKvScoped under '/preferences' and '/signals'.
    if (kv) {
      const kvTargets = [
        key,                                      // prefs2:<hash> (current canonical)
        userScopedKey('prefs', id.email),         // prefs:<email>  (legacy /preferences)
        userScopedKey('signals', id.email),       // signals:<email> (legacy /signals)
      ];
      const kvOut = {};
      for (const k of kvTargets) {
        try { await kv.delete(k); kvOut[k] = true; }
        catch (e) { kvOut[k] = String(e && e.message || e); hadErrors = true; }
      }
      result.details.kv = kvOut;
    } else {
      result.details.kv = null;
    }

    // 2) D1 core wipe — applications, language views (via application
    //    subquery), active_application pointer, and user_kernel.
    //    Atomic batch; either all succeed or none do.
    if (d1Available) {
      try {
        const coreBatch = await env.DB.batch([
          env.DB.prepare(
            'DELETE FROM language_view WHERE application_id IN (SELECT id FROM application WHERE user_hash = ?)'
          ).bind(userHash),
          env.DB.prepare('DELETE FROM application WHERE user_hash = ?').bind(userHash),
          env.DB.prepare('DELETE FROM active_application WHERE user_hash = ?').bind(userHash),
          env.DB.prepare('DELETE FROM user_kernel WHERE user_hash = ?').bind(userHash),
        ]);
        const ch = (i) => (coreBatch[i] && coreBatch[i].meta && coreBatch[i].meta.changes) || 0;
        result.details.d1_core = {
          language_view:      ch(0),
          application:        ch(1),
          active_application: ch(2),
          user_kernel:        ch(3),
        };
      } catch (e) {
        result.details.d1_core = { error: String(e && e.message || e) };
        hadErrors = true;
      }

      // 3) D1 telemetry wipe — optional, separate batch so a missing
      //    table (schema-telemetry.sql not applied) doesn't roll back
      //    the core wipe above. user_hash on llm_calls is nullable but
      //    DELETE ... WHERE user_hash = ? still matches non-null rows
      //    correctly.
      try {
        const telBatch = await env.DB.batch([
          env.DB.prepare(
            'DELETE FROM llm_quality_signals WHERE call_id IN (SELECT id FROM llm_calls WHERE user_hash = ?)'
          ).bind(userHash),
          env.DB.prepare('DELETE FROM llm_calls WHERE user_hash = ?').bind(userHash),
        ]);
        const ch = (i) => (telBatch[i] && telBatch[i].meta && telBatch[i].meta.changes) || 0;
        result.details.d1_telemetry = {
          llm_quality_signals: ch(0),
          llm_calls:           ch(1),
        };
      } catch (e) {
        // "no such table" is non-fatal — telemetry schema may not have
        // been applied yet. We surface it in the response but don't flip
        // hadErrors, because the user's account data IS gone.
        result.details.d1_telemetry = { error: String(e && e.message || e), nonfatal: true };
      }
    } else {
      result.details.d1_core = null;
      result.details.d1_telemetry = null;
    }

    // Audit log — Cloudflare Logs picks this up via
    // [observability.logs] in wrangler.toml. Gives the operator a
    // paper trail (useful for GDPR Article 17 erasure requests and
    // for debugging "did the relay actually run the wipe?" reports).
    // Logs the hash, not the email — same privacy stance as the KV
    // key naming.
    try {
      console.log(JSON.stringify({
        event: 'user_delete',
        user_hash: userHash,
        at: new Date().toISOString(),
        details: result.details,
        had_errors: hadErrors,
      }));
    } catch (_) { /* never let logging fail the response */ }

    // Backwards-compat top-level fields. Pre-2.5.3 clients expect
    // { ok, persisted, deleted, storage_bound } on this response;
    // adding `details` is additive and doesn't break them.
    result.deleted = !hadErrors;
    result.persisted = !!kv || (d1Available && result.details.d1_core && !result.details.d1_core.error);

    return jsonResponse(result, 200, request, env, refresh);
  }

  return jsonResponse({ error: 'method_not_allowed' }, 405, request, env, refresh);
}

// v2.8: POST /api/prefs/renew — extends data-retention clock by another full year.
// Used by the "Keep my data" button in the PWA's annual-retention modal.
// v2.10: GET /api/user/mode -> { ok, mode }
//        POST /api/user/mode { mode: 'paid' | 'demo' } -> persist
// The mode field lives on prefs2:<hash>, alongside other prefs. We
// invalidate the in-isolate mode cache after a write so the writer's
// next request sees the new value immediately. Cross-isolate staleness
// is bounded by _MODE_TTL_MS (60s).
async function handleApiUserMode(request, env) {
  const id = await identityFromRequest(request, env);
  if (!id) {
    return jsonResponse(
      { error: 'unauthenticated', hint: 'Sign in first.' },
      401, request, env
    );
  }
  const refresh = await maybeRefreshHeader(env, id);
  const kv = env.KV_BINDING || env.ANALYTICS || null;
  if (!kv) {
    return jsonResponse(
      { error: 'no_kv', hint: 'KV_BINDING required for user mode storage.' },
      503, request, env, refresh
    );
  }
  const key = await userScopedKeyHashed('prefs2', id.email);
  const m = request.method;

  if (m === 'GET') {
    const mode = await getUserMode(env, id.email);
    return jsonResponse({ ok: true, mode }, 200, request, env, refresh);
  }

  if (m === 'POST' || m === 'PUT') {
    let body = {};
    try {
      body = await request.json();
    } catch (_) {
      return jsonResponse({ error: 'invalid_json' }, 400, request, env, refresh);
    }
    const wanted = String((body && body.mode) || '').toLowerCase();
    if (wanted !== 'paid' && wanted !== 'demo') {
      return jsonResponse(
        { error: 'invalid_mode', hint: 'mode must be "paid" or "demo"' },
        400, request, env, refresh
      );
    }
    let existing = {};
    try {
      const raw = await kv.get(key);
      if (raw) existing = JSON.parse(raw) || {};
    } catch (_) { existing = {}; }
    existing.mode = wanted;
    existing.modeUpdatedAt = new Date().toISOString();
    await kv.put(key, JSON.stringify(existing));
    invalidateModeCache(id.email);
    return jsonResponse({ ok: true, mode: wanted }, 200, request, env, refresh);
  }

  return jsonResponse(
    { error: 'method_not_allowed', allow: ['GET', 'POST', 'PUT'] },
    405, request, env, refresh
  );
}

async function handleApiPrefsRenew(request, env) {
  const kv = env.KV_BINDING || env.ANALYTICS || null;
  const id = await identityFromRequest(request, env);
  if (!id) return jsonResponse({ error: 'unauthenticated' }, 401, request, env);
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405, request, env);
  if (!kv) return jsonResponse({ ok: true, persisted: false, storage_bound: false }, 200, request, env);
  const refresh = await maybeRefreshHeader(env, id);
  const key = await userScopedKeyHashed('prefs2', id.email);
  try {
    const raw = await kv.get(key);
    const current = raw ? JSON.parse(raw) : {};
    const nowIso = new Date().toISOString();
    if (!current.created_at) current.created_at = nowIso;
    current.last_renewed_at = nowIso;
    // Clear the email marker so a fresh T-30 reminder cycle starts next year
    delete current.retention_email_sent_at;
    current.updated_at = nowIso;
    await kv.put(key, JSON.stringify(current));
    const retention = computeRetentionStatus(current, env);
    return jsonResponse({ ok: true, renewed_at: nowIso, retention }, 200, request, env, refresh);
  } catch (e) {
    return jsonResponse({ error: 'renew_failed', message: String(e && e.message || e) }, 500, request, env, refresh);
  }
}

// v2.5: admin-only — set / clear the shared demo worker config
async function handleApiAdminDemo(request, env) {
  const kv = env.KV_BINDING || env.ANALYTICS || null;
  const id = await identityFromRequest(request, env);
  if (!id) {
    return jsonResponse({ error: 'unauthenticated' }, 401, request, env);
  }
  if (!isAdminEmail(id.email, env)) {
    return jsonResponse({ error: 'forbidden', hint: 'Admin email not in ADMIN_EMAIL_ALLOWLIST or ADMIN_EMAILS.' }, 403, request, env);
  }
  if (!kv) {
    return jsonResponse({ error: 'kv_not_bound' }, 503, request, env);
  }
  const refresh = await maybeRefreshHeader(env, id);
  const m = request.method;
  const key = 'prefs:__admin_demo__';

  if (m === 'GET') {
    const raw = await kv.get(key);
    return jsonResponse(
      { ok: true, demo: raw ? JSON.parse(raw) : null },
      200, request, env, refresh
    );
  }
  if (m === 'PUT' || m === 'POST') {
    let data; try { data = await request.json(); }
    catch (_) { return jsonResponse({ error: 'invalid_json' }, 400, request, env, refresh); }
    if (!data || typeof data.demoProxyUrl !== 'string' || !data.demoProxyUrl.trim()) {
      return jsonResponse({ error: 'demoProxyUrl required' }, 400, request, env, refresh);
    }
    const payload = {
      demoProxyUrl: data.demoProxyUrl.trim(),
      demoCapUsd: Number(data.demoCapUsd) || 0.5,           // per-user default cap
      demoEndsAt: data.demoEndsAt || null,                  // ISO8601 or null
      demoDescription: String(data.demoDescription || '').slice(0, 200),
      // v2.6: optional per-cohort caps. Each tier:
      //   { matchEmail: "regex-string", capUsd: number, label: "string" }
      // First matching tier wins; falls back to demoCapUsd if no match.
      // matchEmail is compiled with `new RegExp(pattern, 'i')` at lookup time.
      // Invalid patterns are silently skipped (logged at preflight time).
      demoTiers: Array.isArray(data.demoTiers)
        ? data.demoTiers
            .filter(t => t && typeof t.matchEmail === 'string' && t.matchEmail.trim())
            .slice(0, 10)
            .map(t => ({
              matchEmail: String(t.matchEmail).slice(0, 200),
              capUsd: Number(t.capUsd) > 0 ? Number(t.capUsd) : (Number(data.demoCapUsd) || 0.5),
              label: String(t.label || '').slice(0, 60),
            }))
        : [],
      updated_at: new Date().toISOString(),
      updated_by: id.email,
    };
    await kv.put(key, JSON.stringify(payload));
    return jsonResponse({ ok: true, demo: payload }, 200, request, env, refresh);
  }
  if (m === 'DELETE') {
    await kv.delete(key);
    return jsonResponse({ ok: true, cleared: true }, 200, request, env, refresh);
  }
  return jsonResponse({ error: 'method_not_allowed' }, 405, request, env, refresh);
}

// v2.6: admin-only — list recent demo usage across all users.
// Returns aggregate spend per user-month for the current + previous month
// (the only data we keep — keys auto-expire after 60 days).
//
// KV.list() returns up to 1000 keys per call; we cap at 200 to stay
// fast on a free-plan Worker. If you outgrow this, switch to KV cursor
// pagination via `?cursor=<token>` and accumulate client-side.
async function handleApiAdminDemoHistory(request, env) {
  const kv = env.KV_BINDING || env.ANALYTICS || null;
  const id = await identityFromRequest(request, env);
  if (!id) return jsonResponse({ error: 'unauthenticated' }, 401, request, env);
  if (!isAdminEmail(id.email, env)) {
    return jsonResponse({ error: 'forbidden' }, 403, request, env);
  }
  if (!kv) return jsonResponse({ error: 'kv_not_bound', users: [] }, 503, request, env);
  const refresh = await maybeRefreshHeader(env, id);

  try {
    const listed = await kv.list({ prefix: 'demo_usage:', limit: 200 });
    const records = [];
    let totalUsdAllUsers = 0;
    let totalRequestsAllUsers = 0;
    // Fetch each record. With ~200 keys this is ~200 KV reads — fine.
    for (const k of listed.keys) {
      try {
        const raw = await kv.get(k.name);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        // Key format: demo_usage:<hash32>:<YYYY-MM>
        const parts = k.name.split(':');
        const hash = parts[1] || '';
        const month = parts[2] || '';
        const used = Number(parsed.usd_used) || 0;
        const reqs = Number(parsed.requests) || 0;
        totalUsdAllUsers += used;
        totalRequestsAllUsers += reqs;
        records.push({
          user_hash: hash,
          month,
          used_usd: used,
          requests: reqs,
          last_at: parsed.last_at || null,
        });
      } catch (_) { /* skip malformed */ }
    }
    // Sort by usage desc — top spenders first
    records.sort((a, b) => b.used_usd - a.used_usd);
    return jsonResponse({
      ok: true,
      total_records: records.length,
      total_usd_all_users: totalUsdAllUsers,
      total_requests_all_users: totalRequestsAllUsers,
      list_complete: !listed.list_complete ? false : true,  // false if more pages exist
      records,
    }, 200, request, env, refresh);
  } catch (e) {
    return jsonResponse({ error: 'list_failed', message: String(e && e.message || e) }, 500, request, env, refresh);
  }
}

// v2.9: admin-only — list recent access-denied sign-in attempts.
// Each record is one unique email that tried to sign in but wasn't on
// the allowlist. KV entries have a 14-day TTL so the list rolls forward
// naturally.  Query string ?hours=N filters to attempts where last_seen
// is within the last N hours (default 48, max 14*24=336).
async function handleApiAdminAccessRequests(request, env) {
  if (request.method === 'OPTIONS') return jsonResponse({}, 204, request, env);
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'method_not_allowed' }, 405, request, env);
  }
  const kv = env.KV_BINDING || env.ANALYTICS || null;
  const id = await identityFromRequest(request, env);
  if (!id) return jsonResponse({ error: 'unauthenticated' }, 401, request, env);
  if (!isAdminEmail(id.email, env)) {
    return jsonResponse({ error: 'forbidden' }, 403, request, env);
  }
  if (!kv) return jsonResponse({ error: 'kv_not_bound', records: [] }, 503, request, env);
  const refresh = await maybeRefreshHeader(env, id);

  const url = new URL(request.url);
  let hours = Number(url.searchParams.get('hours')) || 48;
  if (hours < 1) hours = 1;
  if (hours > 336) hours = 336;  // 14 days max
  const cutoff = Date.now() - hours * 3600 * 1000;

  try {
    const listed = await kv.list({ prefix: 'access_req:', limit: 500 });
    const requests = [];
    for (const k of listed.keys) {
      try {
        const raw = await kv.get(k.name);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const lastSeen = Number(parsed.last_seen) || 0;
        if (lastSeen < cutoff) continue;
        const email = parsed.email || k.name.replace(/^access_req:/, '');
        // was_allowed: false for fresh denied attempts; if the email got added
        // to the allowlist after the denied attempt, the admin UI will catch
        // that via its own allowlist comparison.
        requests.push({
          email,
          name: parsed.name || '',
          picture: parsed.picture || '',
          ts: lastSeen,
          first_seen: Number(parsed.first_seen) || lastSeen,
          last_seen: lastSeen,
          count: Number(parsed.count) || 1,
          was_allowed: false,
        });
      } catch (_) { /* skip malformed */ }
    }
    // Newest attempts first
    requests.sort((a, b) => b.ts - a.ts);
    return jsonResponse({
      ok: true,
      hours,
      cutoff,
      count: requests.length,
      list_complete: !listed.list_complete ? false : true,
      requests,
    }, 200, request, env, refresh);
  } catch (e) {
    return jsonResponse({ error: 'list_failed', message: String(e && e.message || e) }, 500, request, env, refresh);
  }
}

// =====================================================================
//  D1 — user_kernel / application / language_view / active_application
// =====================================================================
//
// Three-axis storage (see D1 build brief):
//   user_kernel        — facts about the person, never touched by JD
//   application        — one row per (user × JD); generated output
//   language_view      — lazy (application × language) cache
//   active_application — pointer; which application the PWA is editing
//
// Binding name: env.DB (see wrangler.toml [[d1_databases]]).
// Schema lives in ./schema.sql, applied with:
//   npx wrangler d1 execute ant_memory --file=schema.sql --remote
//
// All handlers return jsonResponse(...) and never throw — D1 failures
// degrade to {error: 'd1_*', ...} with the right HTTP status. The PWA
// is allowed to fall back to KV when D1 returns 503 (binding missing).

function hasD1(env) {
  return !!(env && env.DB && typeof env.DB.prepare === 'function');
}

// SHA-256(email) → 32-char base64url. Same algorithm as
// userScopedKeyHashed but without the prefix, suitable for D1
// PRIMARY KEY columns.
async function userHashFromEmail(email) {
  const norm = String(email || '').trim().toLowerCase();
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(norm));
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').slice(0, 32);
}

// SHA-256(jd_text) → 32-char base64url. Used as application.jd_hash
// so re-uploading the same JD body upserts the same row.
async function jdHashFromText(text) {
  const norm = String(text || '').trim();
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(norm));
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').slice(0, 32);
}

function parseJsonField(s, fallback) {
  if (s === null || s === undefined || s === '') return fallback;
  if (typeof s !== 'string') return s;
  try { return JSON.parse(s); } catch (_) { return fallback; }
}

// Render a kernel row from D1 to the wire shape the PWA expects.
function shapeKernelRow(row) {
  if (!row) return null;
  return {
    user_hash:   row.user_hash,
    identity:    parseJsonField(row.identity, {}),
    history:     parseJsonField(row.history, {}),
    preferences: parseJsonField(row.preferences, {}),
    photo_b64:   row.photo_b64 || null,
    created_at:  row.created_at,
    updated_at:  row.updated_at,
  };
}

// Render an application row from D1 to the wire shape.
function shapeApplicationRow(row) {
  if (!row) return null;
  return {
    id:                 row.id,
    user_hash:          row.user_hash,
    jd_hash:            row.jd_hash,
    jd_text:            row.jd_text,
    supporting_context: row.supporting_context || '',
    jd_language:        row.jd_language,
    jd_company:         row.jd_company || '',
    jd_role:            row.jd_role || '',
    category:           row.category,
    rationale:          parseJsonField(row.rationale, null),
    cv_sections:        parseJsonField(row.cv_sections, null),
    cl_sections:        parseJsonField(row.cl_sections, null),
    created_at:         row.created_at,
    updated_at:         row.updated_at,
  };
}

// The 12 fixed categories. Anything else gets coerced to 'unsolicited'.
const CATEGORIES = new Set([
  'engineering_hardware', 'engineering_software', 'product_management',
  'research_phd', 'program_management', 'operations',
  'data_analytics', 'consulting', 'executive',
  'finance', 'people_soft', 'unsolicited',
]);

function normalizeCategory(cat) {
  if (typeof cat !== 'string') return 'unsolicited';
  const c = cat.trim().toLowerCase();
  return CATEGORIES.has(c) ? c : 'unsolicited';
}

// ---- One-time KV → D1 migration --------------------------------------
//
// On first D1-aware read for a user, if user_kernel has no row AND the
// KV /api/prefs key holds data, transform-and-insert. Leave KV intact.
// Idempotent: only fires when the D1 row is absent.

async function loadKvPrefsRecord(env, email) {
  const kv = env.KV_BINDING || env.ANALYTICS || null;
  if (!kv) return null;
  try {
    const key = await userScopedKeyHashed('prefs2', email);
    const raw = await kv.get(key);
    return raw ? (JSON.parse(raw) || null) : null;
  } catch (_) { return null; }
}

// Map the legacy KV prefs shape to a kernel row. The legacy KV
// shape is loose: anything we don't recognise gets dropped silently
// rather than smuggled into preferences.
function legacyKvToKernel(kvPrefs, email) {
  const now = Date.now();
  const photo = (typeof kvPrefs.photo === 'string' && kvPrefs.photo) ? kvPrefs.photo : null;
  // KV prefs2 historically stores: proxyUrl, photo, apiKeys, wizardCompleted,
  // created_at, updated_at, last_renewed_at, retention_email_sent_at.
  // None of those are kernel data per se — wizard's deeper personalInfo
  // (when KV held it) is what we want. Pull it from the cv-proxy
  // KV_BINDING /preferences shape when present.
  const personalInfo = (kvPrefs.personalInfo && typeof kvPrefs.personalInfo === 'object') ? kvPrefs.personalInfo : {};
  const identity = {
    name:        personalInfo.name        || personalInfo.fullName || '',
    email:       email,
    phone:       personalInfo.phone       || '',
    linkedin:    personalInfo.linkedin    || '',
    github:      personalInfo.github      || '',
    location:    personalInfo.location    || '',
    citizenship: personalInfo.citizenship || '',
  };
  // v2.3.0: camelCase to match new writes and the PWA's personalInfo shape.
  const history = {
    workHistory:    Array.isArray(personalInfo.workHistory)    ? personalInfo.workHistory    : [],
    education:      Array.isArray(personalInfo.education)      ? personalInfo.education      : [],
    publications:   Array.isArray(personalInfo.publications)   ? personalInfo.publications   : [],
    certifications: Array.isArray(personalInfo.certifications) ? personalInfo.certifications : [],
    languages:      Array.isArray(personalInfo.languages)      ? personalInfo.languages      : [],
    tools:          Array.isArray(personalInfo.tools)          ? personalInfo.tools          : [],
    regulatory:     Array.isArray(personalInfo.regulatory)     ? personalInfo.regulatory     : [],
    additional:     Array.isArray(personalInfo.additional)     ? personalInfo.additional     : [],
  };
  // v2.3.0: camelCase preferences with the PWA field names. Also pull in
  // BYOK URLs/models and other settings if they were in the legacy KV blob.
  const preferences = {
    stylePackage:    personalInfo.stylePackage    || (typeof kvPrefs.stylePackage    === 'string' ? kvPrefs.stylePackage    : null),
    toneRegister:    personalInfo.toneRegister    || (typeof kvPrefs.toneRegister    === 'string' ? kvPrefs.toneRegister    : 'scandinavian'),
    language:        personalInfo.canonicalLanguage || (typeof kvPrefs.language      === 'string' ? kvPrefs.language        : 'en'),
    bannedWords:     Array.isArray(personalInfo.bannedWords)   ? personalInfo.bannedWords   : [],
    bannedPhrases:   Array.isArray(personalInfo.bannedPhrases) ? personalInfo.bannedPhrases : [],
  };
  // Mirror BYOK + UI settings if the legacy KV blob held them.
  for (const k of ['openaiProxyUrl','openaiModel','mistralModel','geminiModel','sidebarPosition','navyColor']) {
    if (typeof kvPrefs[k] === 'string' && kvPrefs[k]) preferences[k] = kvPrefs[k];
  }
  for (const k of ['useChatGPT','consensusEnabled','kernelShowcaseGenerated','wizardCompleted']) {
    if (typeof kvPrefs[k] === 'boolean') preferences[k] = kvPrefs[k];
  }
  for (const k of ['cvTableRatio','clTableRatio','cvSidebarRatio']) {
    if (typeof kvPrefs[k] === 'number' && Number.isFinite(kvPrefs[k])) preferences[k] = kvPrefs[k];
  }
  for (const k of ['styleConfig','customStyleConfig','lineTargets','fontSizes','headerItemLoc','headerItemAlign','routingOverrides','compressPrefs']) {
    if (kvPrefs[k] && typeof kvPrefs[k] === 'object') preferences[k] = kvPrefs[k];
  }
  return {
    user_hash:   null, // filled by caller
    identity, history, preferences,
    photo_b64:   photo,
    created_at:  kvPrefs.created_at ? new Date(kvPrefs.created_at).getTime() : now,
    updated_at:  now,
  };
}

async function migrateKvPrefsToD1IfEmpty(env, id) {
  if (!hasD1(env) || !id || !id.email) return { migrated: false, reason: 'no_d1_or_id' };
  const userHash = await userHashFromEmail(id.email);
  try {
    const existing = await env.DB.prepare(
      'SELECT user_hash FROM user_kernel WHERE user_hash = ? LIMIT 1'
    ).bind(userHash).first();
    if (existing) return { migrated: false, reason: 'already_present', user_hash: userHash };
  } catch (e) {
    return { migrated: false, reason: 'd1_read_failed', error: String(e && e.message || e) };
  }
  const kvPrefs = await loadKvPrefsRecord(env, id.email);
  if (!kvPrefs) return { migrated: false, reason: 'no_kv_data', user_hash: userHash };
  const k = legacyKvToKernel(kvPrefs, id.email);
  try {
    await env.DB.prepare(
      'INSERT INTO user_kernel (user_hash, identity, history, preferences, photo_b64, created_at, updated_at) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?) ' +
      'ON CONFLICT(user_hash) DO NOTHING'
    ).bind(
      userHash,
      JSON.stringify(k.identity),
      JSON.stringify(k.history),
      JSON.stringify(k.preferences),
      k.photo_b64,
      k.created_at,
      k.updated_at
    ).run();
    return { migrated: true, user_hash: userHash };
  } catch (e) {
    return { migrated: false, reason: 'd1_write_failed', error: String(e && e.message || e) };
  }
}

// ---- /api/profile/kernel --------------------------------------------

async function handleApiProfileKernel(request, env) {
  const id = await identityFromRequest(request, env);
  if (!id) return jsonResponse({ error: 'unauthenticated' }, 401, request, env);
  if (!hasD1(env)) return jsonResponse({ error: 'd1_not_bound' }, 503, request, env);
  const refresh = await maybeRefreshHeader(env, id);
  const userHash = await userHashFromEmail(id.email);
  const m = request.method;

  if (m === 'GET') {
    // Lazy migration: if no row yet, try a one-shot KV → D1 transform.
    let migration = null;
    try {
      const probe = await env.DB.prepare(
        'SELECT user_hash FROM user_kernel WHERE user_hash = ? LIMIT 1'
      ).bind(userHash).first();
      if (!probe) migration = await migrateKvPrefsToD1IfEmpty(env, id);
    } catch (_) { /* falls through to read attempt below */ }
    try {
      const row = await env.DB.prepare(
        'SELECT * FROM user_kernel WHERE user_hash = ? LIMIT 1'
      ).bind(userHash).first();
      return jsonResponse(
        { ok: true, kernel: shapeKernelRow(row), migration },
        200, request, env, refresh
      );
    } catch (e) {
      return jsonResponse(
        { error: 'd1_read_failed', message: String(e && e.message || e) },
        500, request, env, refresh
      );
    }
  }

  if (m === 'PUT' || m === 'POST') {
    let body;
    try { body = await request.json(); }
    catch (_) { return jsonResponse({ error: 'invalid_json' }, 400, request, env, refresh); }
    if (!body || typeof body !== 'object') {
      return jsonResponse({ error: 'invalid_body' }, 400, request, env, refresh);
    }
    // Stripping rule: api_keys, sections, and anything not in the
    // kernel contract are dropped here. Defense in depth — even if the
    // PWA accidentally sends them, they never reach D1.
    const identityIn    = (body.identity    && typeof body.identity    === 'object') ? body.identity    : {};
    const historyIn     = (body.history     && typeof body.history     === 'object') ? body.history     : {};
    const preferencesIn = (body.preferences && typeof body.preferences === 'object') ? body.preferences : {};
    // Always force identity.email to the authenticated user's email —
    // a client can't claim to be someone else.
    identityIn.email = id.email;
    const photoB64 = (typeof body.photo_b64 === 'string') ? body.photo_b64 : (body.photo_b64 === null ? null : undefined);
    const PHOTO_CAP = 500 * 1024;
    if (typeof photoB64 === 'string' && photoB64.length > PHOTO_CAP) {
      return jsonResponse(
        { error: 'photo_too_large', maxBytes: PHOTO_CAP, gotBytes: photoB64.length },
        413, request, env, refresh
      );
    }
    const now = Date.now();
    try {
      // Upsert. SQLite supports ON CONFLICT ... DO UPDATE; we hand-patch
      // photo_b64 only when explicitly provided (so PUT with no photo key
      // doesn't wipe an existing photo).
      const sets = [
        'identity = excluded.identity',
        'history = excluded.history',
        'preferences = excluded.preferences',
        'updated_at = excluded.updated_at',
      ];
      if (photoB64 !== undefined) sets.push('photo_b64 = excluded.photo_b64');
      const sql =
        'INSERT INTO user_kernel (user_hash, identity, history, preferences, photo_b64, created_at, updated_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?) ' +
        'ON CONFLICT(user_hash) DO UPDATE SET ' + sets.join(', ');
      await env.DB.prepare(sql).bind(
        userHash,
        JSON.stringify(identityIn),
        JSON.stringify(historyIn),
        JSON.stringify(preferencesIn),
        photoB64 === undefined ? null : photoB64,
        now,
        now
      ).run();
      const row = await env.DB.prepare(
        'SELECT * FROM user_kernel WHERE user_hash = ? LIMIT 1'
      ).bind(userHash).first();
      return jsonResponse(
        { ok: true, kernel: shapeKernelRow(row) },
        200, request, env, refresh
      );
    } catch (e) {
      return jsonResponse(
        { error: 'd1_write_failed', message: String(e && e.message || e) },
        500, request, env, refresh
      );
    }
  }

  if (m === 'DELETE') {
    // v2.5.3: explicit dependent deletes instead of relying on FK
    // cascade. Cloudflare D1 does NOT enforce foreign keys by default
    // (PRAGMA foreign_keys is off per-connection), so the comment
    // here that claimed "Cascades to application, language_view,
    // active_application" was wishful thinking — those rows actually
    // survived, and on a subsequent sign-in the user looked half-
    // deleted (kernel gone but applications visible in the picker).
    //
    // Same leaf-first ordering and batched semantics as the
    // /api/prefs DELETE handler. KV is intentionally NOT touched
    // here — /api/profile/kernel is the kernel-scoped wipe;
    // /api/prefs is the full-account wipe.
    try {
      const batchResult = await env.DB.batch([
        env.DB.prepare(
          'DELETE FROM language_view WHERE application_id IN (SELECT id FROM application WHERE user_hash = ?)'
        ).bind(userHash),
        env.DB.prepare('DELETE FROM application WHERE user_hash = ?').bind(userHash),
        env.DB.prepare('DELETE FROM active_application WHERE user_hash = ?').bind(userHash),
        env.DB.prepare('DELETE FROM user_kernel WHERE user_hash = ?').bind(userHash),
      ]);
      const ch = (i) => (batchResult[i] && batchResult[i].meta && batchResult[i].meta.changes) || 0;
      return jsonResponse(
        {
          ok: true,
          deleted: true,
          user_hash: userHash,
          details: {
            language_view:      ch(0),
            application:        ch(1),
            active_application: ch(2),
            user_kernel:        ch(3),
          },
        },
        200, request, env, refresh
      );
    } catch (e) {
      return jsonResponse(
        { error: 'd1_delete_failed', message: String(e && e.message || e) },
        500, request, env, refresh
      );
    }
  }

  return jsonResponse({ error: 'method_not_allowed' }, 405, request, env, refresh);
}

// ---- /api/applications  (collection) --------------------------------

async function handleApiApplications(request, env) {
  const id = await identityFromRequest(request, env);
  if (!id) return jsonResponse({ error: 'unauthenticated' }, 401, request, env);
  if (!hasD1(env)) return jsonResponse({ error: 'd1_not_bound' }, 503, request, env);
  const refresh = await maybeRefreshHeader(env, id);
  const userHash = await userHashFromEmail(id.email);
  const m = request.method;

  if (m === 'GET') {
    try {
      const res = await env.DB.prepare(
        'SELECT id, jd_company, jd_role, category, jd_language, updated_at ' +
        'FROM application WHERE user_hash = ? ORDER BY updated_at DESC LIMIT 50'
      ).bind(userHash).all();
      const rows = (res && res.results) ? res.results : [];
      // Group by category for the Settings UI. Categories with zero
      // rows are omitted — the PWA renders only present groups.
      const grouped = {};
      for (const r of rows) {
        const c = r.category || 'unsolicited';
        if (!grouped[c]) grouped[c] = [];
        grouped[c].push(r);
      }
      return jsonResponse(
        { ok: true, applications: rows, grouped, total: rows.length },
        200, request, env, refresh
      );
    } catch (e) {
      return jsonResponse(
        { error: 'd1_read_failed', message: String(e && e.message || e) },
        500, request, env, refresh
      );
    }
  }

  if (m === 'POST') {
    let body;
    try { body = await request.json(); }
    catch (_) { return jsonResponse({ error: 'invalid_json' }, 400, request, env, refresh); }
    if (!body || typeof body.jd_text !== 'string' || !body.jd_text.trim()) {
      return jsonResponse({ error: 'jd_text_required' }, 400, request, env, refresh);
    }
    // Defense: ensure user_kernel exists before inserting, otherwise the
    // FK fails with a confusing message. Auto-create an empty kernel
    // shell on first application — the wizard fills it in later.
    try {
      const k = await env.DB.prepare(
        'SELECT user_hash FROM user_kernel WHERE user_hash = ?'
      ).bind(userHash).first();
      if (!k) {
        // Try lazy migration first; if no KV data, create empty shell.
        const mig = await migrateKvPrefsToD1IfEmpty(env, id);
        if (!mig.migrated) {
          const now = Date.now();
          await env.DB.prepare(
            'INSERT INTO user_kernel (user_hash, identity, history, preferences, photo_b64, created_at, updated_at) ' +
            'VALUES (?, ?, ?, ?, NULL, ?, ?) ON CONFLICT(user_hash) DO NOTHING'
          ).bind(
            userHash,
            JSON.stringify({ email: id.email }),
            JSON.stringify({}),
            JSON.stringify({}),
            now, now
          ).run();
        }
      }
    } catch (_) { /* the INSERT below will surface any remaining issue */ }

    const jdText = body.jd_text.trim();
    const jdHash = await jdHashFromText(jdText);
    const jdCompany        = typeof body.jd_company === 'string' ? body.jd_company.trim() : '';
    const jdRole           = typeof body.jd_role    === 'string' ? body.jd_role.trim()    : '';
    const jdLanguage       = typeof body.jd_language === 'string' && body.jd_language.trim() ? body.jd_language.trim().slice(0, 5) : 'en';
    const category         = normalizeCategory(body.category);
    const supportingCtx    = typeof body.supporting_context === 'string' ? body.supporting_context : '';
    const rationale        = (body.rationale && typeof body.rationale === 'object') ? JSON.stringify(body.rationale) : null;
    const now = Date.now();

    try {
      // Idempotent upsert on (user_hash, jd_hash).
      await env.DB.prepare(
        'INSERT INTO application ' +
        '(user_hash, jd_hash, jd_text, supporting_context, jd_language, jd_company, jd_role, category, rationale, cv_sections, cl_sections, created_at, updated_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?) ' +
        'ON CONFLICT(user_hash, jd_hash) DO UPDATE SET ' +
        '  jd_company = excluded.jd_company, ' +
        '  jd_role = excluded.jd_role, ' +
        '  jd_language = excluded.jd_language, ' +
        '  supporting_context = excluded.supporting_context, ' +
        '  category = excluded.category, ' +
        '  rationale = COALESCE(excluded.rationale, application.rationale), ' +
        '  updated_at = excluded.updated_at'
      ).bind(
        userHash, jdHash, jdText, supportingCtx, jdLanguage,
        jdCompany, jdRole, category, rationale, now, now
      ).run();
      const row = await env.DB.prepare(
        'SELECT * FROM application WHERE user_hash = ? AND jd_hash = ?'
      ).bind(userHash, jdHash).first();
      // Set as active on creation. This matches the PWA's "you just
      // pasted a JD — work on it" expectation.
      if (row && row.id) {
        try {
          await env.DB.prepare(
            'INSERT INTO active_application (user_hash, application_id) VALUES (?, ?) ' +
            'ON CONFLICT(user_hash) DO UPDATE SET application_id = excluded.application_id'
          ).bind(userHash, row.id).run();
        } catch (_) { /* best-effort */ }
      }
      return jsonResponse(
        { ok: true, application: shapeApplicationRow(row) },
        200, request, env, refresh
      );
    } catch (e) {
      return jsonResponse(
        { error: 'd1_write_failed', message: String(e && e.message || e) },
        500, request, env, refresh
      );
    }
  }

  return jsonResponse({ error: 'method_not_allowed' }, 405, request, env, refresh);
}

// ---- /api/applications/:id  (single row) ----------------------------

async function handleApiApplicationById(request, env, idStr) {
  const id = await identityFromRequest(request, env);
  if (!id) return jsonResponse({ error: 'unauthenticated' }, 401, request, env);
  if (!hasD1(env)) return jsonResponse({ error: 'd1_not_bound' }, 503, request, env);
  const refresh = await maybeRefreshHeader(env, id);
  const userHash = await userHashFromEmail(id.email);
  const appId = parseInt(idStr, 10);
  if (!Number.isFinite(appId) || appId <= 0) {
    return jsonResponse({ error: 'invalid_application_id' }, 400, request, env, refresh);
  }
  const m = request.method;

  // Verify ownership before any operation. user_hash on the row must
  // match the JWT's user, otherwise return 404 (not 403 — don't leak
  // existence of other users' rows).
  let owned;
  try {
    owned = await env.DB.prepare(
      'SELECT user_hash FROM application WHERE id = ?'
    ).bind(appId).first();
  } catch (e) {
    return jsonResponse(
      { error: 'd1_read_failed', message: String(e && e.message || e) },
      500, request, env, refresh
    );
  }
  if (!owned || owned.user_hash !== userHash) {
    return jsonResponse({ error: 'not_found' }, 404, request, env, refresh);
  }

  if (m === 'GET') {
    try {
      const row = await env.DB.prepare(
        'SELECT * FROM application WHERE id = ?'
      ).bind(appId).first();
      return jsonResponse(
        { ok: true, application: shapeApplicationRow(row) },
        200, request, env, refresh
      );
    } catch (e) {
      return jsonResponse(
        { error: 'd1_read_failed', message: String(e && e.message || e) },
        500, request, env, refresh
      );
    }
  }

  if (m === 'PUT' || m === 'POST') {
    let body;
    try { body = await request.json(); }
    catch (_) { return jsonResponse({ error: 'invalid_json' }, 400, request, env, refresh); }
    if (!body || typeof body !== 'object') {
      return jsonResponse({ error: 'invalid_body' }, 400, request, env, refresh);
    }
    // Whitelist of mutable fields. Anything else is dropped.
    const sets = [];
    const vals = [];
    if (typeof body.jd_company === 'string') { sets.push('jd_company = ?'); vals.push(body.jd_company); }
    if (typeof body.jd_role    === 'string') { sets.push('jd_role = ?');    vals.push(body.jd_role); }
    if (typeof body.jd_language === 'string' && body.jd_language.trim()) {
      sets.push('jd_language = ?'); vals.push(body.jd_language.trim().slice(0, 5));
    }
    if (typeof body.supporting_context === 'string') {
      sets.push('supporting_context = ?'); vals.push(body.supporting_context);
    }
    if (typeof body.category === 'string') {
      sets.push('category = ?'); vals.push(normalizeCategory(body.category));
    }
    if (body.rationale && typeof body.rationale === 'object') {
      sets.push('rationale = ?'); vals.push(JSON.stringify(body.rationale));
    }
    if (body.cv_sections !== undefined) {
      sets.push('cv_sections = ?');
      vals.push(body.cv_sections === null ? null : JSON.stringify(body.cv_sections));
    }
    if (body.cl_sections !== undefined) {
      sets.push('cl_sections = ?');
      vals.push(body.cl_sections === null ? null : JSON.stringify(body.cl_sections));
    }
    if (!sets.length) {
      return jsonResponse({ error: 'no_fields_to_update' }, 400, request, env, refresh);
    }
    sets.push('updated_at = ?'); vals.push(Date.now());
    vals.push(appId);
    try {
      await env.DB.prepare(
        'UPDATE application SET ' + sets.join(', ') + ' WHERE id = ?'
      ).bind(...vals).run();
      // 10-row sweep: keep the user's newest 10. Run AFTER the update so
      // the just-touched row is freshest and survives.
      try {
        await env.DB.prepare(
          'DELETE FROM application WHERE user_hash = ? AND id NOT IN ' +
          '(SELECT id FROM application WHERE user_hash = ? ORDER BY updated_at DESC LIMIT 5)'
        ).bind(userHash, userHash).run();
      } catch (_) { /* sweep is best-effort */ }
      const row = await env.DB.prepare(
        'SELECT * FROM application WHERE id = ?'
      ).bind(appId).first();
      return jsonResponse(
        { ok: true, application: shapeApplicationRow(row) },
        200, request, env, refresh
      );
    } catch (e) {
      return jsonResponse(
        { error: 'd1_write_failed', message: String(e && e.message || e) },
        500, request, env, refresh
      );
    }
  }

  if (m === 'DELETE') {
    try {
      await env.DB.prepare(
        'DELETE FROM application WHERE id = ?'
      ).bind(appId).run();
      return jsonResponse(
        { ok: true, deleted: true, id: appId },
        200, request, env, refresh
      );
    } catch (e) {
      return jsonResponse(
        { error: 'd1_delete_failed', message: String(e && e.message || e) },
        500, request, env, refresh
      );
    }
  }

  return jsonResponse({ error: 'method_not_allowed' }, 405, request, env, refresh);
}

// ---- /api/active  (pointer to current application) ------------------

async function handleApiActive(request, env) {
  const id = await identityFromRequest(request, env);
  if (!id) return jsonResponse({ error: 'unauthenticated' }, 401, request, env);
  if (!hasD1(env)) return jsonResponse({ error: 'd1_not_bound' }, 503, request, env);
  const refresh = await maybeRefreshHeader(env, id);
  const userHash = await userHashFromEmail(id.email);
  const m = request.method;

  if (m === 'GET') {
    try {
      const row = await env.DB.prepare(
        'SELECT application_id FROM active_application WHERE user_hash = ?'
      ).bind(userHash).first();
      return jsonResponse(
        { ok: true, application_id: row ? row.application_id : null },
        200, request, env, refresh
      );
    } catch (e) {
      return jsonResponse(
        { error: 'd1_read_failed', message: String(e && e.message || e) },
        500, request, env, refresh
      );
    }
  }

  if (m === 'PUT' || m === 'POST') {
    let body;
    try { body = await request.json(); }
    catch (_) { return jsonResponse({ error: 'invalid_json' }, 400, request, env, refresh); }
    const newId = body && Number.isFinite(body.application_id) ? body.application_id : null;
    if (newId !== null) {
      // Verify the application belongs to this user before pointing at it.
      try {
        const check = await env.DB.prepare(
          'SELECT user_hash FROM application WHERE id = ?'
        ).bind(newId).first();
        if (!check || check.user_hash !== userHash) {
          return jsonResponse({ error: 'application_not_found' }, 404, request, env, refresh);
        }
      } catch (e) {
        return jsonResponse(
          { error: 'd1_read_failed', message: String(e && e.message || e) },
          500, request, env, refresh
        );
      }
    }
    try {
      await env.DB.prepare(
        'INSERT INTO active_application (user_hash, application_id) VALUES (?, ?) ' +
        'ON CONFLICT(user_hash) DO UPDATE SET application_id = excluded.application_id'
      ).bind(userHash, newId).run();
      return jsonResponse(
        { ok: true, application_id: newId },
        200, request, env, refresh
      );
    } catch (e) {
      return jsonResponse(
        { error: 'd1_write_failed', message: String(e && e.message || e) },
        500, request, env, refresh
      );
    }
  }

  return jsonResponse({ error: 'method_not_allowed' }, 405, request, env, refresh);
}

// ---- /api/profile/extract-kernel -----------------------------------
// File-upload-driven kernel extraction (brief items 4 + 6). The PWA
// extracts text from PDF/DOCX/TXT files client-side and POSTs the texts
// here. We enforce auth, then forward the request to cv-proxy's
// /api/extract-kernel endpoint where the LLM call happens.
//
// Body shape: { texts: [{filename, content}, ...], expected_name?: string,
//               providers?: ["anthropic","openai",...], models?: {...} }
//
// Response (success): { ok: true, kernel: {...}, provider, duration_ms, attempts, files }
// Response (auth):    { error: 'unauthenticated' }, 401
async function handleApiProfileExtractKernel(request, env) {
  const id = await identityFromRequest(request, env);
  if (!id) return jsonResponse({ error: 'unauthenticated' }, 401, request, env);
  const refresh = await maybeRefreshHeader(env, id);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405, request, env, refresh);
  }
  // Read body once so we can both validate and forward.
  let bodyBytes;
  try { bodyBytes = await request.arrayBuffer(); }
  catch (e) { return jsonResponse({ error: 'invalid_body', message: String(e && e.message || e) }, 400, request, env, refresh); }
  // Forward to cv-proxy at /api/extract-kernel. The relay does not
  // touch the texts — they go straight through.
  const upstreamUrl = buildUpstreamUrl(env, new URL(request.url), '/api/extract-kernel');
  try {
    const _ctx9 = await getUpstreamContext(request, env);
    const upstreamResp = await rawForward(request, env, upstreamUrl, 'POST', bodyBytes, _ctx9.mode);
    // Copy upstream body verbatim. We DO add the refresh header if one
    // was issued, so the PWA's session JWT stays fresh on long
    // extraction calls.
    const respHeaders = new Headers(upstreamResp.headers);
    for (const [k, v] of Object.entries(corsHeaders(request, env))) respHeaders.set(k, v);
    if (refresh) for (const [k, v] of Object.entries(refresh)) respHeaders.set(k, v);
    return new Response(upstreamResp.body, { status: upstreamResp.status, headers: respHeaders });
  } catch (e) {
    return jsonResponse({ error: 'upstream_failed', message: String(e && e.message || e) }, 502, request, env, refresh);
  }
}



// =====================================================================
//  Forward + diagnostics (LLM passthrough to cv-proxy)
// =====================================================================

// Returns true if a Cloudflare service binding is bound to env.UPSTREAM.
// Service bindings are the preferred way to call cv-proxy: they bypass the
// public network entirely (no DNS, no TLS, no Cloudflare Access), avoid the
// "error 1042" same-account fetch block, and authenticate intrinsically.
function hasServiceBinding(env) {
  return !!(env && env.UPSTREAM && typeof env.UPSTREAM.fetch === 'function');
}

function buildUpstreamUrl(env, incomingUrl, overridePath, mode) {
  // For service bindings we still need a URL, but only the path/search are
  // honoured by the binding. We use a synthetic placeholder origin when no
  // origin var is configured. The origin var depends on `mode`:
  //   - 'demo' -> UPSTREAM_ORIGIN_DEMO
  //   - else (default 'paid') -> UPSTREAM_ORIGIN
  const originVar = (mode === 'demo' ? env.UPSTREAM_ORIGIN_DEMO : env.UPSTREAM_ORIGIN);
  const baseStr = (originVar || 'https://upstream.invalid').replace(/\/+$/, '');
  const base = new URL(baseStr);
  const pathToUse = overridePath != null ? overridePath : incomingUrl.pathname;
  return new URL(pathToUse + incomingUrl.search, base);
}

// Single fetch entry point used by both rawForward and probeUpstream.
// Prefers the service binding for the requested mode (UPSTREAM for paid,
// UPSTREAM_DEMO for demo), falls back to HTTP fetch if no binding.
async function callUpstream(env, upstreamUrl, init, mode) {
  if (mode === 'demo' && hasDemoServiceBinding(env)) {
    return env.UPSTREAM_DEMO.fetch(upstreamUrl.toString(), init);
  }
  if (mode !== 'demo' && hasServiceBinding(env)) {
    // Service binding: invoke cv-proxy directly. The Request URL still needs
    // to look like the upstream so cv-proxy routes it correctly.
    return env.UPSTREAM.fetch(upstreamUrl.toString(), init);
  }
  return fetch(upstreamUrl.toString(), init);
}

async function rawForward(request, env, upstreamUrl, methodOverride, bodyBytes, mode) {
  const headers = new Headers(request.headers);
  // Service tokens still get sent if configured — cv-proxy may sit behind
  // Cloudflare Access even when called via service binding (Access ignores
  // service-binding traffic, so the headers are effectively no-ops there).
  if (env.CF_ACCESS_CLIENT_ID)     headers.set('CF-Access-Client-Id',     env.CF_ACCESS_CLIENT_ID);
  if (env.CF_ACCESS_CLIENT_SECRET) headers.set('CF-Access-Client-Secret', env.CF_ACCESS_CLIENT_SECRET);
  // Don't forward our session JWT to cv-proxy — it has no business with it.
  headers.delete('Authorization');
  headers.delete('Host');

  const method = methodOverride || request.method;
  const init = { method, headers, redirect: 'manual' };
  if (!['GET', 'HEAD'].includes(method)) {
    init.body = bodyBytes ?? request.body;
  }
  return callUpstream(env, upstreamUrl, init, mode);
}

function isCloudflareErrorPage(status, contentType, bodyText) {
  if (!bodyText) return false;
  const ct = (contentType || '').toLowerCase();
  // CF returns "error code: 1042" as plain-text body when a Worker tries to
  // fetch another Worker on the same account via *.workers.dev.
  if (/error code:\s*1042/i.test(bodyText)) return true;
  if (!ct.includes('text/html') && !ct.includes('text/plain')) return false;
  if (/<html[^>]*class="no-js[^"]*"/i.test(bodyText)) return true;
  if (/cloudflare/i.test(bodyText) && /error/i.test(bodyText)) return true;
  if (/Cloudflare Access/i.test(bodyText)) return true;
  return false;
}

function classifyForwardFailure(status, upstreamOrigin, bodyText) {
  if (/error code:\s*1042/i.test(bodyText || '')) {
    return {
      error: 'upstream_same_account_fetch_blocked',
      hint:
        `Cloudflare blocks one Worker fetching another Worker on the same account ` +
        `via *.workers.dev (error 1042). Bind cv-proxy to this relay as a service ` +
        `binding instead. In antcv-access-relay/wrangler.toml add:\n` +
        `  [[services]]\n  binding = "UPSTREAM"\n  service = "cv-proxy"\n` +
        `Then \`npx wrangler deploy\`.`,
    };
  }
  if (status === 404) {
    return {
      error: 'upstream_not_found',
      hint:
        `Cloudflare returned a 404 "site not found" page for ${upstreamOrigin}. ` +
        `Verify cv-proxy is deployed at this exact hostname, or update UPSTREAM_ORIGIN in wrangler.toml.`,
    };
  }
  if (status === 401 || status === 403) {
    return {
      error: 'upstream_auth_failed',
      hint:
        `Upstream returned ${status} (Cloudflare Access likely rejected the service token). ` +
        `Check that CF_ACCESS_CLIENT_ID / CF_ACCESS_CLIENT_SECRET on this relay match a service token registered ` +
        `with the Access policy on ${upstreamOrigin}.`,
    };
  }
  /* v2.4.0: explicit 402 (insufficient credits) so the PWA's classifier
     picks this up as "billing" and surfaces the credit banner. Without
     this, a 402 from upstream Anthropic/OpenAI would hit the generic
     unexpected_response path and the user wouldn't get a clear
     "top up your credits" message. */
  if (status === 402) {
    return {
      error: 'upstream_insufficient_credits',
      message: `Upstream returned 402 \u2014 insufficient credits. Top up your provider account, or switch providers in Settings \u2192 Routing.`,
      hint:
        `Upstream Anthropic/OpenAI/Mistral/Gemini account has run out of credits or payment is required. ` +
        `Body snippet: ${(bodyText || '').slice(0, 200)}`,
    };
  }
  if (status === 429) {
    return {
      error: 'upstream_rate_limit',
      message: `Upstream returned 429 \u2014 rate limit hit. Wait a minute and retry, or switch providers.`,
      hint: `Upstream rate-limited the request. Body: ${(bodyText || '').slice(0, 200)}`,
    };
  }
  if (status >= 500) {
    return {
      error: 'upstream_server_error',
      hint: `Upstream returned ${status}. Check cv-proxy's Workers logs.`,
    };
  }
  return {
    error: 'upstream_unexpected_response',
    hint: `Upstream returned ${status} with HTML body. Snippet: ${(bodyText || '').slice(0, 160)}`,
  };
}

async function forwardWithDiagnostics(request, env, upstreamUrl, methodOverride, bodyBytes, mode) {
  const originVal = originForMode(env, mode);
  const upstreamOrigin = originVal
    ? new URL(originVal).origin
    : (mode === 'demo'
        ? (hasDemoServiceBinding(env) ? 'service:antcv-demo-proxy' : 'unknown')
        : (hasServiceBinding(env)     ? 'service:cv-proxy'         : 'unknown'));
  let res;
  try {
    res = await rawForward(request, env, upstreamUrl, methodOverride, bodyBytes, mode);
  } catch (e) {
    return {
      kind: 'error_response',
      response: jsonResponse(
        {
          error: 'upstream_fetch_threw',
          upstream: upstreamOrigin,
          message: e && e.message ? e.message : String(e),
        },
        502, request, env
      ),
    };
  }

  if (res.ok) return { kind: 'ok_response', response: res };

  const ctype = res.headers.get('content-type') || '';
  if (ctype.includes('text/html') || ctype.includes('text/plain')) {
    let bodyText = '';
    try { bodyText = await res.text(); } catch (e) { /* ignore */ }
    if (isCloudflareErrorPage(res.status, ctype, bodyText)) {
      const diag = classifyForwardFailure(res.status, upstreamOrigin, bodyText);
      return {
        kind: 'error_response',
        response: jsonResponse(
          { error: diag.error, upstream: upstreamOrigin, upstream_status: res.status, hint: diag.hint },
          502, request, env
        ),
      };
    }
    return {
      kind: 'ok_response',
      response: new Response(bodyText, {
        status: res.status,
        headers: { 'Content-Type': ctype || 'text/plain', ...corsHeaders(request, env) },
      }),
    };
  }

  return { kind: 'ok_response', response: res };
}

async function probeUpstreamMode(env, mode) {
  const useBinding = (mode === 'demo' ? hasDemoServiceBinding(env) : hasServiceBinding(env));
  if (!useBinding && !(mode === 'demo' ? env.UPSTREAM_ORIGIN_DEMO : env.UPSTREAM_ORIGIN)) {
    return { reachable: false, error: 'no_upstream_configured', hint: 'Bind cv-proxy as a service binding (binding=UPSTREAM(_DEMO), service=cv-proxy or antcv-demo-proxy) in wrangler.toml, or set UPSTREAM_ORIGIN.' };
  }
  if (!useBinding && (!env.CF_ACCESS_CLIENT_ID || !env.CF_ACCESS_CLIENT_SECRET)) {
    return { reachable: false, error: 'no_service_token_configured', hint: 'When using HTTP fallback (no service binding), CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET must be set.' };
  }
  const baseStr = ((mode === 'demo' ? env.UPSTREAM_ORIGIN_DEMO : env.UPSTREAM_ORIGIN) || 'https://cv-proxy.invalid').replace(/\/+$/, '');
  const upstreamUrl = new URL(baseStr + '/config');
  const ctrl = new AbortController();
  const tmo = setTimeout(() => ctrl.abort(), 4000);
  try {
    const headers = { Accept: 'application/json' };
    if (env.CF_ACCESS_CLIENT_ID)     headers['CF-Access-Client-Id']     = env.CF_ACCESS_CLIENT_ID;
    if (env.CF_ACCESS_CLIENT_SECRET) headers['CF-Access-Client-Secret'] = env.CF_ACCESS_CLIENT_SECRET;
    const res = await callUpstream(env, upstreamUrl, {
      method: 'GET',
      headers,
      signal: ctrl.signal,
    }, mode);
    clearTimeout(tmo);
    const ctype = res.headers.get('content-type') || '';
    let bodyText = ''; try { bodyText = await res.text(); } catch (e) {}
    if (!res.ok) {
      if (isCloudflareErrorPage(res.status, ctype, bodyText)) {
        const diag = classifyForwardFailure(res.status, baseStr, bodyText);
        return { reachable: false, upstream_status: res.status, error: diag.error, hint: diag.hint, transport: useBinding ? 'service_binding' : 'http' };
      }
      return { reachable: false, upstream_status: res.status, error: 'upstream_non_ok', body_snippet: bodyText.slice(0, 200), transport: useBinding ? 'service_binding' : 'http' };
    }
    let parsed; try { parsed = JSON.parse(bodyText); } catch (e) {
      return { reachable: false, error: 'upstream_not_json', body_snippet: bodyText.slice(0, 200), transport: useBinding ? 'service_binding' : 'http' };
    }
    return { reachable: true, upstream_config: parsed, transport: useBinding ? 'service_binding' : 'http' };
  } catch (e) {
    clearTimeout(tmo);
    return {
      reachable: false,
      error: e && e.name === 'AbortError' ? 'upstream_timeout' : 'upstream_fetch_threw',
      message: e && e.message ? e.message : String(e),
    };
  }
}

// /__diag wrapper: probe both tiers so admins can see at a glance
// whether each upstream path is reachable.
async function probeUpstream(env) {
  return {
    paid: await probeUpstreamMode(env, 'paid'),
    demo: await probeUpstreamMode(env, 'demo'),
  };
}

// =====================================================================
//  Auth handlers
// =====================================================================

async function handleAuthGoogle(request, env) {
  if (!env.JWT_SECRET) return jsonResponse({ error: 'JWT_SECRET not set on relay' }, 500, request, env);
  if (!env.GOOGLE_CLIENT_ID) return jsonResponse({ error: 'GOOGLE_CLIENT_ID not set on relay' }, 500, request, env);

  let body;
  try { body = await request.json(); }
  catch (e) { return jsonResponse({ error: 'Invalid JSON' }, 400, request, env); }
  const idToken = body && body.id_token;
  if (!idToken) return jsonResponse({ error: 'Missing id_token in body' }, 400, request, env);

  let claims;
  try { claims = await verifyGoogleIdToken(idToken, env.GOOGLE_CLIENT_ID); }
  catch (e) {
    return jsonResponse({ error: 'google_token_invalid', message: e.message }, 401, request, env);
  }
  if (!await emailAllowed(env, claims.email)) {
    // v2.9: log the denied attempt so admins can review pending access requests
    try {
      const kv = env.KV_BINDING || env.ANALYTICS || null;
      if (kv && claims.email) {
        const emailKey = String(claims.email).toLowerCase();
        const key = 'access_req:' + emailKey;
        const now = Date.now();
        let rec;
        try {
          const raw = await kv.get(key);
          rec = raw ? JSON.parse(raw) : null;
        } catch (_) { rec = null; }
        if (!rec || typeof rec !== 'object') {
          rec = { email: emailKey, first_seen: now, last_seen: now, count: 1, name: claims.name || '', picture: claims.picture || '' };
        } else {
          rec.last_seen = now;
          rec.count = (Number(rec.count) || 0) + 1;
          if (claims.name && !rec.name) rec.name = claims.name;
          if (claims.picture && !rec.picture) rec.picture = claims.picture;
        }
        // 14-day TTL — admin pulls this for the "recent requests" panel.
        await kv.put(key, JSON.stringify(rec), { expirationTtl: 60 * 60 * 24 * 14 });
      }
    } catch (_) { /* logging is best-effort */ }
    return jsonResponse(
      { error: 'email_not_allowed', email: claims.email, hint: 'Add this email to EMAIL_ALLOWLIST.' },
      403, request, env
    );
  }
  const token = await issueSessionToken(env.JWT_SECRET, claims.email);
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  return jsonResponse(
    { ok: true, token, email: claims.email, expires_at: exp, method: 'google' },
    200, request, env
  );
}

async function handleAuthEmailRequest(request, env) {
  if (!env.JWT_SECRET) return jsonResponse({ error: 'JWT_SECRET not set on relay' }, 500, request, env);
  if (!env.RESEND_API_KEY) return jsonResponse({ error: 'RESEND_API_KEY not set on relay' }, 500, request, env);
  if (!env.KV_BINDING) return jsonResponse({ error: 'KV_BINDING not bound (required for OTP storage)' }, 503, request, env);

  let body;
  try { body = await request.json(); }
  catch (e) { return jsonResponse({ error: 'Invalid JSON' }, 400, request, env); }

  const email = normalizeEmail(body && body.email);
  if (!isValidEmail(email)) {
    return jsonResponse({ error: 'invalid_email', hint: 'Provide a real email address.' }, 400, request, env);
  }
  if (!await emailAllowed(env, email)) {
    // Don't tell the requester whether the email is on the allowlist —
    // return the same generic OK we'd return for an allowed email so an
    // attacker can't enumerate allowed accounts.
    return jsonResponse({ ok: true, sent: false, reason: 'silently_dropped' }, 200, request, env);
  }

  // Rate limits.
  const cooldownKey = `rate:otp_email:${email}`;
  const ipKey = `rate:otp_ip:${clientIpHash(request)}`;
  const cd = await env.KV_BINDING.get(cooldownKey);
  if (cd) {
    return jsonResponse({ error: 'cooldown', hint: 'Wait a minute before requesting another code.' }, 429, request, env);
  }
  const ipRl = await rateLimitCheck(env, ipKey, OTP_IP_LIMIT_PER_HOUR, 60 * 60);
  if (!ipRl.ok) {
    return jsonResponse({ error: 'ip_rate_limited', hint: 'Too many OTP requests from this IP this hour.' }, 429, request, env);
  }

  const code = generateOtpCode();
  const otpKey = `otp:${email}`;
  await env.KV_BINDING.put(
    otpKey,
    JSON.stringify({ code, attempts: 0, created_at: Date.now() }),
    { expirationTtl: OTP_TTL_SECONDS }
  );
  await env.KV_BINDING.put(cooldownKey, '1', { expirationTtl: OTP_COOLDOWN_SECONDS });

  try {
    await sendOtpEmail(env, email, code);
  } catch (e) {
    // Wipe the OTP so the user can retry without waiting for cooldown.
    await env.KV_BINDING.delete(otpKey).catch(() => {});
    await env.KV_BINDING.delete(cooldownKey).catch(() => {});
    return jsonResponse({ error: 'email_send_failed', message: e.message }, 502, request, env);
  }
  return jsonResponse({ ok: true, sent: true, expires_in: OTP_TTL_SECONDS }, 200, request, env);
}

async function handleAuthEmailVerify(request, env) {
  if (!env.JWT_SECRET) return jsonResponse({ error: 'JWT_SECRET not set on relay' }, 500, request, env);
  if (!env.KV_BINDING) return jsonResponse({ error: 'KV_BINDING not bound' }, 503, request, env);

  let body;
  try { body = await request.json(); }
  catch (e) { return jsonResponse({ error: 'Invalid JSON' }, 400, request, env); }

  const email = normalizeEmail(body && body.email);
  const code = String((body && body.code) || '').trim();
  if (!isValidEmail(email) || !/^\d{4,8}$/.test(code)) {
    return jsonResponse({ error: 'invalid_input' }, 400, request, env);
  }

  const otpKey = `otp:${email}`;
  const raw = await env.KV_BINDING.get(otpKey);
  if (!raw) {
    return jsonResponse({ error: 'no_active_code', hint: 'Request a new code.' }, 401, request, env);
  }
  let entry;
  try { entry = JSON.parse(raw); }
  catch (e) {
    await env.KV_BINDING.delete(otpKey).catch(() => {});
    return jsonResponse({ error: 'corrupt_otp_entry' }, 500, request, env);
  }
  if ((entry.attempts || 0) >= OTP_MAX_ATTEMPTS) {
    await env.KV_BINDING.delete(otpKey).catch(() => {});
    return jsonResponse({ error: 'too_many_attempts', hint: 'Request a new code.' }, 429, request, env);
  }
  if (entry.code !== code) {
    entry.attempts = (entry.attempts || 0) + 1;
    // Preserve remaining TTL — best effort: rewrite with a small safety TTL.
    const remainingTtl = Math.max(60, OTP_TTL_SECONDS - Math.floor((Date.now() - (entry.created_at || Date.now())) / 1000));
    await env.KV_BINDING.put(otpKey, JSON.stringify(entry), { expirationTtl: remainingTtl });
    return jsonResponse(
      { error: 'wrong_code', attempts_remaining: Math.max(0, OTP_MAX_ATTEMPTS - entry.attempts) },
      401, request, env
    );
  }

  // Success — burn the OTP.
  await env.KV_BINDING.delete(otpKey).catch(() => {});
  if (!await emailAllowed(env, email)) {
    // Defense-in-depth: allowlist could have changed since the code was sent.
    return jsonResponse({ error: 'email_not_allowed' }, 403, request, env);
  }
  const token = await issueSessionToken(env.JWT_SECRET, email);
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  return jsonResponse(
    { ok: true, token, email, expires_at: exp, method: 'email' },
    200, request, env
  );
}

async function handleAuthMe(request, env) {
  const id = await identityFromRequest(request, env);
  const refresh = await maybeRefreshHeader(env, id);
  return jsonResponse(
    {
      authenticated: !!id,
      user: id ? { email: id.email } : null,
      expires_at: id ? id.exp : null,
    },
    200, request, env, refresh
  );
}

// =====================================================================
//  Storage handlers (relay-local KV, JWT-scoped)
// =====================================================================

async function handleKvScoped(request, env, prefix, payloadField, maxStringLen) {
  // Prefer the dedicated relay KV binding, but also allow ANALYTICS as a shared
  // KV fallback. This lets the same namespace be bound across all workers.
  const kv = env.KV_BINDING || env.ANALYTICS || null;
  const storageBound = !!kv;
  const id = await identityFromRequest(request, env);
  if (!id) {
    return jsonResponse(
      { error: 'unauthenticated', hint: 'Sign in via /auth/google or /auth/email/* first.' },
      401, request, env
    );
  }
  const key = userScopedKey(prefix, id.email);
  const refresh = await maybeRefreshHeader(env, id);
  const m = request.method;

  if (m === 'GET') {
    const raw = storageBound ? await kv.get(key) : null;
    const fallback = payloadField === 'preferences' ? { preferences: null } : { signals: '' };
    return new Response(raw || JSON.stringify(fallback), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env), ...refresh },
    });
  }
  if (m === 'PUT' || m === 'POST') {
    let data; try { data = await request.json(); }
    catch (e) { return jsonResponse({ error: 'Invalid JSON' }, 400, request, env, refresh); }

    let safe;
    if (payloadField === 'signals') {
      safe = { signals: String((data && data.signals) || '').slice(0, maxStringLen), updated_at: new Date().toISOString() };
    } else {
      safe = { preferences: data, updated_at: new Date().toISOString(), version: 2 };
    }
    if (!storageBound) {
      return jsonResponse({ ok: true, persisted: false, storage_bound: false, updated_at: safe.updated_at }, 200, request, env, refresh);
    }
    await kv.put(key, JSON.stringify(safe));
    return jsonResponse({ ok: true, persisted: true, storage_bound: true, updated_at: safe.updated_at }, 200, request, env, refresh);
  }
  return jsonResponse({ error: 'method_not_allowed' }, 405, request, env, refresh);
}

// =====================================================================
//  Main router
// =====================================================================

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env || {}, ctx || null);
  },
  // Cron trigger: aggregate llm_calls into llm_provider_health, then
  // prune rows past retention. Configured in wrangler.toml under
  // [triggers] crons. The dashboard and autorotate logic read from
  // the aggregated table, never from llm_calls directly (which can
  // hold millions of rows).
  //
  // Aggregation runs every tick (every 5 minutes). Prune runs only on
  // the first tick of each UTC day (00:00–00:04 UTC) — DELETE has more
  // cost than a no-op aggregation and there's no reason to prune more
  // than once a day given the 90/30-day retention windows.
  async scheduled(event, env, ctx) {
    const job = (async () => {
      try {
        const aggResult = await aggregateHealth(env);
        console.log('[cron] aggregateHealth done:', JSON.stringify(aggResult));
        const d = new Date();
        if (d.getUTCHours() === 0 && d.getUTCMinutes() < 5) {
          const pruneResult = await pruneOld(env);
          console.log('[cron] pruneOld done:', JSON.stringify(pruneResult));
        }
      } catch (e) {
        console.warn('[cron] scheduled job threw:', e && e.message ? e.message : e);
      }
    })();
    if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(job);
    else await job;
  },
};

async function handleRequest(request, env, ctx) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }

 const url = new URL(request.url);

// compatibility aliases for older frontend routes
if (url.pathname === '/api/me') {
  url.pathname = '/me';
}
if (url.pathname === '/api/config') {
  url.pathname = '/config';
}
if (url.pathname === '/api/logout') {
  url.pathname = '/logout';
}

const path = url.pathname.replace(/\/+$/, '') || '/';
const method = request.method;

  // --- Public: health, /__diag, /me, /config, /logout ---

  if ((path === '/' || path === '/__health' || path === '/health') && (method === 'GET' || method === 'HEAD')) {
    const id = await identityFromRequest(request, env);
    const userMode = id ? await getUserMode(env, id.email) : null;
    return jsonResponse(
      {
        ok: true, worker: 'antcv-access-relay', version: RELAY_VERSION,
        upstream: env.UPSTREAM_ORIGIN || null,
        upstream_demo: env.UPSTREAM_ORIGIN_DEMO || null,
        authenticated: !!id,
        user_mode: userMode,
        endpoints: {
          me:       url.origin + '/me',
          config:   url.origin + '/config',
          diag:     url.origin + '/__diag',
          logout:   url.origin + '/logout',
          mode:     url.origin + '/api/user/mode',
          auth_google:        url.origin + '/auth/google',
          auth_email_request: url.origin + '/auth/email/request',
          auth_email_verify:  url.origin + '/auth/email/verify',
        },
      },
      200, request, env
    );
  }

  if (path === '/__diag' && method === 'GET') {
    const probe = await probeUpstream(env);
    const id = await identityFromRequest(request, env);
    return jsonResponse(
      {
        ok: true, worker: 'antcv-access-relay', version: RELAY_VERSION,
        relay: {
          upstream_origin: env.UPSTREAM_ORIGIN || null,
          upstream_origin_configured: !!env.UPSTREAM_ORIGIN,
          upstream_service_binding: hasServiceBinding(env),
          upstream_transport: hasServiceBinding(env) ? 'service_binding' : (env.UPSTREAM_ORIGIN ? 'http' : 'none'),
          upstream_origin_demo: env.UPSTREAM_ORIGIN_DEMO || null,
          upstream_origin_demo_configured: !!env.UPSTREAM_ORIGIN_DEMO,
          upstream_demo_service_binding: hasDemoServiceBinding(env),
          upstream_demo_transport: hasDemoServiceBinding(env) ? 'service_binding' : (env.UPSTREAM_ORIGIN_DEMO ? 'http' : 'none'),
          cf_access_client_id_set: !!env.CF_ACCESS_CLIENT_ID,
          cf_access_client_secret_set: !!env.CF_ACCESS_CLIENT_SECRET,
          jwt_secret_set: !!env.JWT_SECRET,
          google_client_id_set: !!env.GOOGLE_CLIENT_ID,
          resend_api_key_set: !!env.RESEND_API_KEY,
          email_from: env.EMAIL_FROM || null,
          email_allowlist_set: !!(env.EMAIL_ALLOWLIST || '').trim(),
          admin_emails_set: adminEmails(env).length > 0,
          admin_emails_count: adminEmails(env).length,
          upstream_analytics_secret_set: !!env.UPSTREAM_ANALYTICS_SECRET,
          kv_binding: !!env.KV_BINDING,
          analytics_binding: !!env.ANALYTICS,
          d1_DB_binding: hasD1(env),
          preferences_storage_bound: !!(env.KV_BINDING || env.ANALYTICS),
          allowed_origins: parseAllowedOrigins(env),
          request_origin: request.headers.get('Origin') || null,
        },
        identity: { authenticated: !!id, email: id ? id.email : null },
        upstream_probe: probe,
      },
      200, request, env
    );
  }

  if (path === '/me' && method === 'GET') {
    return handleAuthMe(request, env);
  }
  if (path === '/auth/me' && method === 'GET') {
    return handleAuthMe(request, env);
  }

  if (path === '/logout' || (path === '/me' && url.searchParams.get('logout') === '1')) {
    const setupUrl = env.SETUP_URL || 'https://cv-generator-det.pages.dev';
    return new Response(null, {
      status: 302,
      headers: {
        Location: setupUrl + '?hardReset=1&logout=1',
        'Set-Cookie': 'antcv_session=; Max-Age=0; Path=/; Secure; SameSite=None',
        ...corsHeaders(request, env),
      },
    });
  }
  if (path === '/auth/logout') {
    return jsonResponse({ ok: true, signed_out: true, hard_reset_url: (env.SETUP_URL || 'https://cv-generator-det.pages.dev') + '?hardReset=1&logout=1' }, 200, request, env);
  }

  // --- Auth endpoints (no JWT required — these issue them) ---

  if (path === '/auth/google' && method === 'POST') {
    return handleAuthGoogle(request, env);
  }
  if (path === '/auth/email/request' && method === 'POST') {
    return handleAuthEmailRequest(request, env);
  }
  if (path === '/auth/email/verify' && method === 'POST') {
    return handleAuthEmailVerify(request, env);
  }

  // --- /config (probes upstream for honest reporting) ---

  if (path === '/config' && (method === 'GET' || method === 'POST')) {
    // v2.10: probeUpstream now returns { paid, demo }. We surface server_keys
    // and analytics flags from the user's effective tier (or paid by default),
    // and expose both upstreams in parallel `upstream` / `upstream_demo` blocks.
    const probe = await probeUpstream(env);
    const id = await identityFromRequest(request, env);
    const userMode = id ? await getUserMode(env, id.email) : null;
    const activeProbe = (userMode === 'demo') ? probe.demo : probe.paid;
    let serverKeys = { anthropic: false, openai: false, mistral: false, gemini: false };
    let analyticsKv = !!env.ANALYTICS, signalsKv = !!(env.KV_BINDING || env.ANALYTICS), preferencesKv = !!(env.KV_BINDING || env.ANALYTICS), analyticsEngine = false;
    if (activeProbe && activeProbe.reachable && activeProbe.upstream_config) {
      const u = activeProbe.upstream_config;
      if (u.server_keys) serverKeys = u.server_keys;
      analyticsKv = !!u.analytics_kv;
      analyticsEngine = !!u.analytics_engine;
      // signals/preferences are RELAY-local now — keep our own status.
    }
    const refresh = await maybeRefreshHeader(env, id);
    return jsonResponse(
      {
        proxy_url: url.origin,
        server_keys: serverKeys,
        analytics_kv: analyticsKv,
        analytics_engine: analyticsEngine,
        signals_kv: signalsKv,
        preferences_kv: preferencesKv,
        relay: true,
        user_mode: userMode,
        mode_endpoint: url.origin + '/api/user/mode',
        auth: {
          required: true,
          methods: { google: !!env.GOOGLE_CLIENT_ID, email_otp: !!env.RESEND_API_KEY },
          google_client_id: env.GOOGLE_CLIENT_ID || null,
          authenticated: !!id,
          user: id ? { email: id.email, is_admin: isAdmin(env, id) } : null,
        },
        upstream: {
          origin: env.UPSTREAM_ORIGIN ? new URL(env.UPSTREAM_ORIGIN).origin : null,
          reachable: !!(probe.paid && probe.paid.reachable),
          ...((probe.paid && probe.paid.reachable) ? {} : { error: probe.paid && probe.paid.error, hint: probe.paid && probe.paid.hint, status: probe.paid && probe.paid.upstream_status }),
        },
        upstream_demo: {
          origin: env.UPSTREAM_ORIGIN_DEMO ? new URL(env.UPSTREAM_ORIGIN_DEMO).origin : null,
          reachable: !!(probe.demo && probe.demo.reachable),
          ...((probe.demo && probe.demo.reachable) ? {} : { error: probe.demo && probe.demo.error, hint: probe.demo && probe.demo.hint, status: probe.demo && probe.demo.upstream_status }),
        },
      },
      200, request, env, refresh
    );
  }

  // --- /admin/allowlist : ADMIN-ONLY, runtime-edit the email allowlist ---
  // GET  → { allowlist: [...], source: 'kv' | 'env' | 'open' }
  // PUT  body: { allowlist: [...emails] } → replaces KV value, returns updated list
  if (path === '/admin/allowlist' && (method === 'GET' || method === 'PUT')) {
    const id = await identityFromRequest(request, env);
    if (!id) {
      return jsonResponse({ error: 'unauthenticated', hint: 'Sign in first.' }, 401, request, env);
    }
    if (!isAdmin(env, id)) {
      const list = adminEmails(env);
      return jsonResponse(
        {
          error: 'admin_required',
          hint: list.length === 0
            ? 'No admin email is configured. Set ADMIN_EMAILS on the relay (comma-separated).'
            : 'This account is not on the admin list.',
          your_email: id.email,
        },
        403, request, env
      );
    }
    const refresh = await maybeRefreshHeader(env, id);
    if (method === 'GET') {
      const cur = await getAllowlist(env);
      return jsonResponse({
        allowlist: cur.list,
        source: cur.source,
        kv_supported: !!(env.KV_BINDING || env.ANALYTICS),
        env_seed_present: !!((env.EMAIL_ALLOWLIST || '').trim()),
      }, 200, request, env, refresh);
    }
    // PUT
    let body;
    try { body = await request.json(); }
    catch (e) { return jsonResponse({ error: 'invalid_json' }, 400, request, env, refresh); }
    if (!body || !Array.isArray(body.allowlist)) {
      return jsonResponse({ error: 'expected_allowlist_array', hint: 'POST { "allowlist": ["a@b.com", ...] }' }, 400, request, env, refresh);
    }
    try {
      const saved = await setAllowlist(env, body.allowlist);
      // Defensive: never let an admin lock themselves out. If non-empty
      // and the editing admin's email isn't on the list, append it.
      if (saved.length > 0 && !saved.includes(String(id.email).toLowerCase())) {
        saved.push(String(id.email).toLowerCase());
        await env.KV_BINDING.put('relay:allowlist', JSON.stringify(saved));
      }
      return jsonResponse({ allowlist: saved, source: saved.length ? 'kv' : 'open', saved_at: new Date().toISOString() }, 200, request, env, refresh);
    } catch (e) {
      return jsonResponse({ error: 'allowlist_save_failed', message: e && e.message ? e.message : String(e) }, 500, request, env, refresh);
    }
  }


  if (path === '/preferences') return handleKvScoped(request, env, 'prefs', 'preferences', 200000);
  if (path === '/signals')     return handleKvScoped(request, env, 'signals', 'signals', 100000);

  // v2.5 Phase 2 endpoints
  // v2.8: POST /api/prefs/renew — user confirmed they want to keep their
  // data for another year. Updates last_renewed_at to now, clears the
  // email-sent marker so future T-30 reminders can fire again next year.
  if (path === '/api/prefs/renew') {
    return handleApiPrefsRenew(request, env);
  }
  if (path === '/api/prefs')          return handleApiPrefs(request, env);
  if (path === '/api/user/mode')      return handleApiUserMode(request, env);
  if (path === '/api/admin/demo')     return handleApiAdminDemo(request, env);
  if (path === '/api/admin/demo-usage-history') return handleApiAdminDemoHistory(request, env);
  if (path === '/api/admin/access-requests') return handleApiAdminAccessRequests(request, env);

  // --- D1: /api/profile/kernel, /api/applications, /api/active ---
  //
  // These supersede KV-based prefs storage. The PWA reads D1 first;
  // /api/prefs above stays in place for backwards compatibility and
  // for fields that aren't part of the kernel contract (proxyUrl, etc).
  if (path === '/api/profile/kernel') {
    return handleApiProfileKernel(request, env);
  }
  if (path === '/api/profile/extract-kernel') {
    return handleApiProfileExtractKernel(request, env);
  }
  if (path === '/api/applications') {
    return handleApiApplications(request, env);
  }
  // /api/applications/:id — id segment captured from the URL.
  {
    const appIdMatch = path.match(/^\/api\/applications\/(\d+)$/);
    if (appIdMatch) {
      return handleApiApplicationById(request, env, appIdMatch[1]);
    }
  }
  if (path === '/api/active') {
    return handleApiActive(request, env);
  }

  // --- /analytics : public, fire-and-forget, never blocking ---
  //
  // Two write paths:
  //   1. Forward to cv-proxy (Analytics Engine + KV). Existing path,
  //      unchanged behaviour.
  //   2. If event.event === 'llm_call', tee into D1 llm_calls for the
  //      Analytics tab + autorotate logic. ctx.waitUntil keeps this
  //      off the response critical path; failure logs but never
  //      affects the response.
  //
  // Identity comes from the JWT (when present) → user_hash in D1.
  // Anonymous events get user_hash = NULL.

  if (path === '/analytics' && method === 'POST') {
    let bodyBytes;
    try { bodyBytes = await request.arrayBuffer(); }
    catch (e) {
      return jsonResponse({ ok: false, error: 'body_read_failed', persisted: false }, 200, request, env);
    }

    // Tee to D1. Parse the body once, do not block the response on the
    // insert. The PWA contract is "/analytics always returns 200 fast".
    if (hasD1(env) && bodyBytes && bodyBytes.byteLength > 0) {
      const teeJob = (async () => {
        try {
          const text = new TextDecoder().decode(bodyBytes);
          const event = JSON.parse(text);
          if (event && event.event === 'llm_call') {
            const id = await identityFromRequest(request, env);
            await insertLlmCall(env, id, event);
          }
        } catch (e) {
          console.warn('[analytics-tee] failed:', e && e.message ? e.message : e);
        }
      })();
      if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(teeJob);
      // else: run inline; not ideal but won't break /analytics since
      // the entire block is wrapped in best-effort error handling.
    }

    const haveUpstream = hasServiceBinding(env) || (env.UPSTREAM_ORIGIN && env.CF_ACCESS_CLIENT_ID && env.CF_ACCESS_CLIENT_SECRET);
    if (!haveUpstream) {
      return jsonResponse({ ok: true, persisted: false, reason: 'no_upstream' }, 200, request, env);
    }
    const _ctx10 = await getUpstreamContext(request, env);
    const upstreamUrl = buildUpstreamUrl(env, url, null, _ctx10.mode);
    const result = await forwardWithDiagnostics(request, env, upstreamUrl, null, bodyBytes, _ctx10.mode);
    if (result.kind === 'ok_response' && result.response.ok) {
      return withCors(result.response, request, env);
    }
    return jsonResponse({ ok: true, persisted: false, reason: 'upstream_unavailable' }, 200, request, env);
  }

  // --- /api/llm-health : ANY signed-in user, latest provider+task health snapshot ---
  //
  // Reads from llm_provider_health (the rolling-window aggregate updated
  // by the cron trigger). The PWA's Analytics tab calls this; the
  // autorotate logic can also call it to deprioritise degraded providers.
  //
  // Query params:
  //   window=60|1440|10080|all   (default 60; 'all' returns all three keyed by minutes)
  //   provider=claude|openai|mistral|gemini
  //   task=<one of the 18 task names>
  //
  // Returns 200 with { ok, window_minutes, window_start, rows } even
  // when the table is empty (rows: []), so the PWA can render an
  // empty-state instead of treating it as an error.
  if (path === '/api/llm-health' && method === 'GET') {
    const id = await identityFromRequest(request, env);
    if (!id) {
      return jsonResponse({ error: 'unauthenticated', hint: 'Sign in first.' }, 401, request, env);
    }
    if (!hasD1(env)) {
      return jsonResponse({ error: 'd1_unavailable', hint: 'Bind DB in wrangler.toml and apply schema-telemetry.sql.' }, 503, request, env);
    }
    const refresh = await maybeRefreshHeader(env, id);
    const windowRaw = url.searchParams.get('window');
    const windowMinutes = windowRaw === 'all' ? 'all' : (Number(windowRaw) || 60);
    const provider = url.searchParams.get('provider') || null;
    const task     = url.searchParams.get('task') || null;
    try {
      const out = await getLatestHealth(env, { windowMinutes, provider, task });
      return jsonResponse(out, 200, request, env, refresh);
    } catch (e) {
      return jsonResponse({ error: 'health_read_failed', message: e && e.message ? e.message : String(e) }, 500, request, env, refresh);
    }
  }

  // --- /api/llm-health/aggregate : ADMIN-ONLY, manual cron-equivalent ---
  //
  // Runs the same aggregation the cron trigger runs, on demand. Useful
  // for smoke-testing after a schema change and for the deploy flow
  // (the dashboard shouldn't be empty for the first 5 minutes after
  // first deploy). Idempotent — safe to call repeatedly.
  if (path === '/api/llm-health/aggregate' && method === 'POST') {
    const id = await identityFromRequest(request, env);
    if (!id) {
      return jsonResponse({ error: 'unauthenticated' }, 401, request, env);
    }
    if (!isAdmin(env, id)) {
      return jsonResponse({ error: 'admin_required', your_email: id.email }, 403, request, env);
    }
    if (!hasD1(env)) {
      return jsonResponse({ error: 'd1_unavailable' }, 503, request, env);
    }
    const refresh = await maybeRefreshHeader(env, id);
    try {
      const result = await aggregateHealth(env);
      return jsonResponse(result, 200, request, env, refresh);
    } catch (e) {
      return jsonResponse({ error: 'aggregate_failed', message: e && e.message ? e.message : String(e) }, 500, request, env, refresh);
    }
  }

  // --- /api/llm-quality-signal : signed-in user, post-hoc quality flag ---
  //
  // The PWA's leak scanner runs asynchronously after an LLM call
  // completes (in a useEffect), so quality signals arrive separately
  // from the originating llm_call event. POST one of:
  //
  //   { call_id: <int>, signal_type, severity, signal_value? }
  //   { request_id: <str>, signal_type, severity, signal_value? }
  //   { provider, task, signal_type, severity, signal_value? }   ← fuzzy
  //
  // The fuzzy match looks up the most recent llm_calls row matching
  // (user_hash, provider, task) within the last 5 minutes. It exists
  // so the PWA can emit signals before it learns to thread
  // request_id through; once request_id is wired through PWA-side,
  // prefer that path.
  //
  // signal_type ∈ { placeholder_leak, fabrication, banned_word,
  //                 wrong_field_name, user_thumbs_down }
  // severity    ∈ { critical, warning, info }  (default 'info')
  //
  // For placeholder_leak / fabrication / banned_word the handler also
  // back-fills the count/flag on the llm_calls row so the next
  // aggregation cron picks it up.
  if (path === '/api/llm-quality-signal' && method === 'POST') {
    const id = await identityFromRequest(request, env);
    if (!id) {
      return jsonResponse({ error: 'unauthenticated' }, 401, request, env);
    }
    if (!hasD1(env)) {
      return jsonResponse({ error: 'd1_unavailable' }, 503, request, env);
    }
    const refresh = await maybeRefreshHeader(env, id);
    let body;
    try { body = await request.json(); }
    catch (e) {
      return jsonResponse({ error: 'invalid_json' }, 400, request, env, refresh);
    }
    try {
      const result = await insertQualitySignal(env, id, body);
      const status = result.ok ? 200
                   : result.reason === 'call_not_found' ? 404
                   : result.reason === 'invalid_signal_type' ? 400
                   : 500;
      return jsonResponse(result, status, request, env, refresh);
    } catch (e) {
      return jsonResponse({ error: 'quality_signal_failed', message: e && e.message ? e.message : String(e) }, 500, request, env, refresh);
    }
  }

  // --- /api/llm-health/prune : ADMIN-ONLY, manual prune trigger ---
  //
  // Same prune that the cron runs after aggregation, on demand.
  // Useful for forcing a cleanup after retention-policy changes
  // without waiting for the next 5-min cron tick.
  if (path === '/api/llm-health/prune' && method === 'POST') {
    const id = await identityFromRequest(request, env);
    if (!id) return jsonResponse({ error: 'unauthenticated' }, 401, request, env);
    if (!isAdmin(env, id)) return jsonResponse({ error: 'admin_required', your_email: id.email }, 403, request, env);
    if (!hasD1(env)) return jsonResponse({ error: 'd1_unavailable' }, 503, request, env);
    const refresh = await maybeRefreshHeader(env, id);
    try {
      const result = await pruneOld(env);
      return jsonResponse(result, 200, request, env, refresh);
    } catch (e) {
      return jsonResponse({ error: 'prune_failed', message: e && e.message ? e.message : String(e) }, 500, request, env, refresh);
    }
  }

  // --- /analytics/summary : ADMIN-ONLY, gated by JWT (no user-facing secret) ---
  // The relay knows who's signed in (JWT) and holds the cv-proxy secret in
  // env.UPSTREAM_ANALYTICS_SECRET. It injects the secret on behalf of admins
  // so the PWA never has to ask the user for one.
  if (path === '/analytics/summary' && method === 'GET') {
    const id = await identityFromRequest(request, env);
    if (!id) {
      return jsonResponse(
        { error: 'unauthenticated', hint: 'Sign in first.' },
        401, request, env
      );
    }
    if (!isAdmin(env, id)) {
      const list = adminEmails(env);
      return jsonResponse(
        {
          error: 'admin_required',
          hint: list.length === 0
            ? 'No admin email is configured. Set ADMIN_EMAILS on the relay (comma-separated).'
            : 'This account is not on the admin list.',
          your_email: id.email,
        },
        403, request, env
      );
    }
    const haveUpstream = hasServiceBinding(env) || (env.UPSTREAM_ORIGIN && env.CF_ACCESS_CLIENT_ID && env.CF_ACCESS_CLIENT_SECRET);
    if (!haveUpstream) {
      return jsonResponse({ error: 'no_upstream' }, 502, request, env);
    }
    // Build upstream URL with the secret as a query param. The cv-proxy
    // verifies the secret as defense in depth.
    const _adminCtx = await getUpstreamContext(request, env);
    const _adminMode = _adminCtx.mode;
    const _adminBase = originForMode(env, _adminMode) || 'https://cv-proxy.invalid';
    const baseStr = _adminBase.replace(/\/+$/, '');
    const upstreamUrl = new URL(baseStr + '/analytics/summary');
    if (env.UPSTREAM_ANALYTICS_SECRET) {
      upstreamUrl.searchParams.set('secret', env.UPSTREAM_ANALYTICS_SECRET);
    }
    const refresh = await maybeRefreshHeader(env, id);
    try {
      const headers = { Accept: 'application/json' };
      if (env.CF_ACCESS_CLIENT_ID)     headers['CF-Access-Client-Id']     = env.CF_ACCESS_CLIENT_ID;
      if (env.CF_ACCESS_CLIENT_SECRET) headers['CF-Access-Client-Secret'] = env.CF_ACCESS_CLIENT_SECRET;
      const upstreamRes = await callUpstream(env, upstreamUrl, { method: 'GET', headers }, _adminMode);
      const ctype = upstreamRes.headers.get('content-type') || 'application/json';
      const bodyText = await upstreamRes.text();
      const cors = corsHeaders(request, env);
      return new Response(bodyText, {
        status: upstreamRes.status,
        headers: {
          'Content-Type': ctype,
          ...cors,
          ...(refresh || {}),
        },
      });
    } catch (e) {
      return jsonResponse(
        { error: 'upstream_fetch_threw', message: e && e.message ? e.message : String(e) },
        502, request, env, refresh
      );
    }
  }


  // --- /api/analytics/export and /analytics/export : ADMIN-ONLY ---
  //
  // Same gating shape as /analytics/summary above (JWT → isAdmin →
  // forward to cv-proxy with the upstream secret query param). The
  // export endpoint differs in three ways:
  //
  //   1. The PWA calls this with /api/ prefix (the "Export JSON" and
  //      "Export CSV" buttons in Settings hit /api/analytics/export?format=…).
  //      The summary handler matches /analytics/summary only because
  //      another path-rewriting layer in the PWA configuration mapped
  //      it that way. To be safe we accept BOTH /api/analytics/export
  //      and /analytics/export so users don't get surprise 404s when
  //      the upstream URL has or lacks the /api segment.
  //
  //   2. Forward original query string verbatim (format=json|csv,
  //      view=sessions|…, optional date range). The upstream uses
  //      these to decide JSON vs CSV body and which view to dump.
  //
  //   3. Preserve cv-proxy's Content-Type and Content-Disposition
  //      headers in the response so the browser triggers a download
  //      with the suggested filename (cv-proxy sets
  //      `attachment; filename="antcv-analytics-…csv"` for CSV).

  if ((path === '/api/analytics/export' || path === '/analytics/export') && method === 'GET') {
    const id = await identityFromRequest(request, env);
    if (!id) {
      return jsonResponse(
        { error: 'unauthenticated', hint: 'Sign in first.' },
        401, request, env
      );
    }
    if (!isAdmin(env, id)) {
      const list = adminEmails(env);
      return jsonResponse(
        {
          error: 'admin_required',
          hint: list.length === 0
            ? 'No admin email is configured. Set ADMIN_EMAILS on the relay (comma-separated).'
            : 'This account is not on the admin list.',
          your_email: id.email,
        },
        403, request, env
      );
    }
    const haveUpstream = hasServiceBinding(env) || (env.UPSTREAM_ORIGIN && env.CF_ACCESS_CLIENT_ID && env.CF_ACCESS_CLIENT_SECRET);
    if (!haveUpstream) {
      return jsonResponse({ error: 'no_upstream' }, 502, request, env);
    }
    const _adminCtx2 = await getUpstreamContext(request, env);
    const _adminMode2 = _adminCtx2.mode;
    const _adminBase2 = originForMode(env, _adminMode2) || 'https://cv-proxy.invalid';
    const baseStr = _adminBase2.replace(/\/+$/, '');
    const upstreamUrl = new URL(baseStr + '/analytics/export');
    // Forward original query (format, view, date range, etc.) so the
    // upstream selects the right view and serialiser.
    for (const [k, v] of url.searchParams) upstreamUrl.searchParams.set(k, v);
    if (env.UPSTREAM_ANALYTICS_SECRET) {
      upstreamUrl.searchParams.set('secret', env.UPSTREAM_ANALYTICS_SECRET);
    }
    const refresh = await maybeRefreshHeader(env, id);
    try {
      const headers = { Accept: 'application/json, text/csv' };
      if (env.CF_ACCESS_CLIENT_ID)     headers['CF-Access-Client-Id']     = env.CF_ACCESS_CLIENT_ID;
      if (env.CF_ACCESS_CLIENT_SECRET) headers['CF-Access-Client-Secret'] = env.CF_ACCESS_CLIENT_SECRET;
      const upstreamRes = await callUpstream(env, upstreamUrl, { method: 'GET', headers }, _adminMode2);
      const bodyText = await upstreamRes.text();

      // Pass through Content-Type and Content-Disposition unchanged so
      // the browser knows JSON vs CSV and shows the download dialog
      // with the cv-proxy-suggested filename.
      const cors = corsHeaders(request, env);
      const responseHeaders = new Headers();
      const passThrough = ['content-type', 'content-disposition', 'cache-control'];
      for (const h of passThrough) {
        const v = upstreamRes.headers.get(h);
        if (v) responseHeaders.set(h, v);
      }
      if (!responseHeaders.has('content-type')) {
        responseHeaders.set('content-type', 'application/json');
      }
      for (const [k, v] of Object.entries(cors)) responseHeaders.set(k, v);
      if (refresh) for (const [k, v] of Object.entries(refresh)) responseHeaders.set(k, v);

      return new Response(bodyText, {
        status: upstreamRes.status,
        headers: responseHeaders,
      });
    } catch (e) {
      return jsonResponse(
        { error: 'upstream_fetch_threw', message: e && e.message ? e.message : String(e) },
        502, request, env, refresh
      );
    }
  }


  // --- LLM proxy (root POST) — JWT REQUIRED ---

  if (path === '/' && method === 'POST') {
    if (!hasServiceBinding(env) && !env.UPSTREAM_ORIGIN) {
      return jsonResponse({ error: 'No upstream configured. Bind cv-proxy as service binding (UPSTREAM) or set UPSTREAM_ORIGIN.' }, 500, request, env);
    }
    if (!hasServiceBinding(env) && (!env.CF_ACCESS_CLIENT_ID || !env.CF_ACCESS_CLIENT_SECRET)) {
      return jsonResponse({ error: 'Service-token secrets missing on relay (only required when not using a service binding).' }, 500, request, env);
    }
    const id = await identityFromRequest(request, env);
    if (!id) {
      return jsonResponse(
        { error: 'unauthenticated', hint: 'Sign in first via /auth/google or /auth/email/*.' },
        401, request, env
      );
    }
    const refresh = await maybeRefreshHeader(env, id);

    let bodyBytes;
    try { bodyBytes = await request.arrayBuffer(); }
    catch (e) {
      return jsonResponse({ error: 'body_read_failed', message: e.message }, 400, request, env, refresh);
    }

    // v1.50.18-debug-body: ALWAYS log a slice of the inbound body so
    // we can see what the PWA is sending and confirm the relay's
    // code is the version we expect. Surfaces the field shape that
    // governs the normaliser conditional below.
    try {
      const debugBodyText = new TextDecoder().decode(bodyBytes);
      try {
        const dbg = JSON.parse(debugBodyText);
        console.log('[access-relay debug] inbound POST / — model=' + String(dbg.model) +
          ', has-system-top=' + (typeof dbg.system === 'string') +
          ', messages.length=' + (Array.isArray(dbg.messages) ? dbg.messages.length : 'NA') +
          ', messages-with-role-system=' + (Array.isArray(dbg.messages)
            ? dbg.messages.filter(m => m && m.role === 'system').length : 'NA'));
      } catch (_) {
        console.log('[access-relay debug] inbound POST / — non-JSON body (first 200):', debugBodyText.slice(0, 200));
      }
    } catch (_) {}

    // v1.50.18-fix-anthropic-system: Anthropic's Messages API rejects
    // role:"system" inside the messages array (HTTP 400). The PWA
    // (app.js — minified bundle) constructs Anthropic requests with
    // role:"system" at messages[0] (OpenAI shape). The downstream
    // proxy is supposed to normalise, but we cannot rely on every
    // downstream deployment being on the latest version — service
    // bindings and edge caches can lag. Normalise here at the relay
    // EDGE so the bytes that leave this worker are always valid
    // regardless of which downstream proxy receives them (cv-proxy,
    // antcv-demo-proxy, or any future variant).
    //
    // Detection: only mutate if the body parses as JSON and the
    // model field starts with claude- (Anthropic naming convention).
    // OpenAI / Mistral / Gemini bodies are passed through untouched.
    try {
      const textBody = new TextDecoder().decode(bodyBytes);
      const parsed = JSON.parse(textBody);
      const isClaude = parsed && typeof parsed.model === 'string'
        && /^claude[-_]/i.test(parsed.model);
      if (isClaude && Array.isArray(parsed.messages) && parsed.messages.length > 0) {
        const collectedSystem = [];
        const remainingMessages = [];
        for (let i = 0; i < parsed.messages.length; i++) {
          const m = parsed.messages[i];
          if (m && m.role === 'system') {
            if (typeof m.content === 'string') {
              if (m.content.trim()) collectedSystem.push(m.content);
            } else if (Array.isArray(m.content)) {
              const txt = m.content
                .filter(b => b && b.type === 'text' && typeof b.text === 'string')
                .map(b => b.text)
                .join('\n');
              if (txt.trim()) collectedSystem.push(txt);
            }
          } else {
            remainingMessages.push(m);
          }
        }
        if (collectedSystem.length > 0) {
          const existingTopSystem =
            typeof parsed.system === 'string' ? parsed.system : '';
          const merged = collectedSystem.join('\n\n') +
            (existingTopSystem ? '\n\n' + existingTopSystem : '');
          parsed.system = merged;
          parsed.messages = remainingMessages;
          // Re-encode and replace bodyBytes so the forward sends the
          // normalised version.
          bodyBytes = new TextEncoder().encode(JSON.stringify(parsed)).buffer;
          try { console.log('[access-relay anthropic-normalise] lifted', collectedSystem.length, 'system message(s) to top-level system for model=' + parsed.model); } catch (_) {}
        }
      }
    } catch (_) {
      // Non-JSON or non-Claude body — pass through unchanged.
    }

    const _ctx10 = await getUpstreamContext(request, env);
    const upstreamUrl = buildUpstreamUrl(env, url, null, _ctx10.mode);
    const result = await forwardWithDiagnostics(request, env, upstreamUrl, null, bodyBytes, _ctx10.mode);
    if (result.kind === 'error_response') {
      // Re-attach refresh header to the error response.
      const r = result.response;
      const headers = new Headers(r.headers);
      for (const [k, v] of Object.entries(refresh)) headers.set(k, v);
      return new Response(r.body, { status: r.status, statusText: r.statusText, headers });
    }
    return withCors(result.response, request, env, refresh);
  }

  // --- v2.9.2: generic /api/* passthrough to cv-proxy (JWT REQUIRED) ---
  //
  // The PWA points its proxyUrl at the relay, so any /api/* path the
  // PWA calls (jd-analysis, supervisor/check, fetch-jd-url, etc.)
  // arrives here. Earlier versions only forwarded root POST (LLM
  // /v1/messages-style calls) and specific internal routes
  // (/api/prefs, /api/me, /api/config, /api/admin/*). Everything
  // else 404'd at the relay edge.
  //
  // This block catches anything starting with /api/ that wasn't
  // already handled above, verifies the user's JWT (same as the
  // root POST path), and forwards through the existing diagnostics
  // pipeline. The cv-proxy already routes these paths internally
  // (see ./jd-analysis.js, ./fetch-jd-url.js, ./supervisor.js).
  //
  // Methods accepted: POST (jd-analysis, supervisor/check, fetch-jd-url
  // are all POST). GET is also forwarded for forward-compat with any
  // /api/* GET endpoints cv-proxy may add.
  if (path.startsWith('/api/') && (method === 'POST' || method === 'GET')) {
    if (!hasServiceBinding(env) && !env.UPSTREAM_ORIGIN) {
      return jsonResponse({ error: 'No upstream configured. Bind cv-proxy as service binding (UPSTREAM) or set UPSTREAM_ORIGIN.' }, 500, request, env);
    }
    if (!hasServiceBinding(env) && (!env.CF_ACCESS_CLIENT_ID || !env.CF_ACCESS_CLIENT_SECRET)) {
      return jsonResponse({ error: 'Service-token secrets missing on relay (only required when not using a service binding).' }, 500, request, env);
    }
    const id = await identityFromRequest(request, env);
    if (!id) {
      return jsonResponse(
        { error: 'unauthenticated', hint: 'Sign in first via /auth/google or /auth/email/*.' },
        401, request, env
      );
    }
    const refresh = await maybeRefreshHeader(env, id);

    let bodyBytes = null;
    if (method === 'POST') {
      try { bodyBytes = await request.arrayBuffer(); }
      catch (e) {
        return jsonResponse({ error: 'body_read_failed', message: e.message }, 400, request, env, refresh);
      }
    }
    const _ctx10 = await getUpstreamContext(request, env);
    const upstreamUrl = buildUpstreamUrl(env, url, null, _ctx10.mode);
    const result = await forwardWithDiagnostics(request, env, upstreamUrl, null, bodyBytes, _ctx10.mode);
    if (result.kind === 'error_response') {
      const r = result.response;
      const headers = new Headers(r.headers);
      for (const [k, v] of Object.entries(refresh)) headers.set(k, v);
      return new Response(r.body, { status: r.status, statusText: r.statusText, headers });
    }
    return withCors(result.response, request, env, refresh);
  }

  // --- Fallthrough: clean JSON 404 ---

  return jsonResponse(
    { error: 'not_found', path, method, hint: 'See / for available routes.' },
    404, request, env
  );
}
