// =================================================================
//  jwt-verify.js
//
//  HS256 JWT verification — interoperable with antcv-access-relay's
//  signJWT() / verifyJWT(). The relay issues `Authorization: Bearer
//  <jwt>` tokens with payload { sub, email, iat, exp, iss }. cv-proxy
//  needs to read these tokens so /preferences, /signals, and other
//  identity-scoped endpoints work after CF Access is removed from
//  the route.
//
//  Both services use the same shared secret stored in JWT_SECRET (or
//  RELAY_JWT_SECRET as a fallback name). The secret is a random ≥32-
//  byte string; HS256 (HMAC-SHA256) is symmetric so the secret must
//  match on both sides.
//
//  Public API:
//    verifyRelayJWT(token, secret) → { email, sub, iat, exp, iss } | null
//
//  All decoding is async because SubtleCrypto.verify() is. The check
//  enforces:
//    - 3-segment token shape
//    - HMAC signature matches
//    - exp is a number and >= now (clock-skew tolerance: 0 — relay
//      issues 7-day tokens, much longer than typical clock drift)
// =================================================================


function b64urlDecodeBytes(s) {
  // base64url → base64 → Uint8Array. Pad with `=` to length-multiple-of-4
  // before passing to atob().
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64urlDecodeText(s) {
  return new TextDecoder().decode(b64urlDecodeBytes(s));
}

async function hsKey(secret) {
  // crypto.subtle.importKey wants raw key material — TextEncoder
  // converts the secret to bytes.
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}


/**
 * Verify an HS256 JWT issued by the auth-relay.
 *
 * Returns the decoded payload on success, or null on any failure.
 * Never throws — caller can treat the return as a simple presence
 * check.
 *
 * @param {string} token   The raw JWT (without "Bearer " prefix)
 * @param {string} secret  The HMAC secret shared with the relay
 * @returns {Promise<object|null>}
 */
export async function verifyRelayJWT(token, secret) {
  if (typeof token !== 'string' || typeof secret !== 'string' || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const data = `${h}.${p}`;
  let key;
  try { key = await hsKey(secret); }
  catch (e) { return null; }
  let valid = false;
  try {
    valid = await crypto.subtle.verify(
      'HMAC',
      key,
      b64urlDecodeBytes(s),
      new TextEncoder().encode(data),
    );
  } catch (e) { return null; }
  if (!valid) return null;
  let payload;
  try { payload = JSON.parse(b64urlDecodeText(p)); }
  catch (e) { return null; }
  // Reject malformed payloads — exp must be a number, and email must
  // be present and string. The relay always sets both, so a missing
  // field signals tampering or a token issued by a different service.
  if (typeof payload.exp !== 'number') return null;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  if (typeof payload.email !== 'string' || !payload.email) return null;
  return payload;
}


/**
 * Try to identify the caller from an Authorization: Bearer header.
 * Returns { email } on success, null otherwise. Caller must already
 * have the JWT_SECRET available — this function does no key lookup
 * of its own.
 */
export async function identityFromBearer(request, secret) {
  if (!secret) return null;
  const auth = request.headers.get('Authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const payload = await verifyRelayJWT(m[1], secret);
  if (!payload) return null;
  return { email: payload.email };
}
