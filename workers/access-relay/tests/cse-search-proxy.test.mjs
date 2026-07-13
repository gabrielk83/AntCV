/* CSE-PROXY-001 (owner 2026-07-05): GET /api/cse-search — a proxy so the
 * weekly demand-tuning job (CLUSTER-QUAL-001 §7.6, a scheduled Claude Code
 * session, NOT this Worker) can run site-scoped web searches (Jobindex.dk,
 * Glassdoor, etc.) without ever holding a real, billable search-API key.
 * Same shared-token pattern as the existing /api/security-alert endpoint
 * (SECURITY-WEEKLY-001): the real secret is a Worker-only env var; callers
 * authenticate with a separate, narrow-scope CSE_PROXY_TOKEN header instead.
 *
 * Backend order (CSE-PROXY-GOOGLE-ENTITLEMENT-001, 2026-07-13): Brave Search
 * FIRST whenever BRAVE_API_KEY is set (Google CSE 403s on a Google-side
 * entitlement hold), falling through to Google CSE only without a Brave key —
 * mirroring the /api/research handler.
 *
 * Source-level regression lock (auth-heavy HTTP handler with no existing
 * mock harness in this suite — same rationale as cluster-top20-endpoint.test.mjs
 * / the security-alert precedent it mirrors).
 *
 * Run:  node --test workers/access-relay/tests/cse-search-proxy.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const src = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');

function handlerBody() {
  const start = src.indexOf("if (path === '/api/cse-search' && method === 'GET') {");
  assert.ok(start > 0, 'handler must exist');
  // End at the NEXT route (/api/research) — slicing to /__diag would swallow
  // the research handler and false-flag its identityFromRequest call
  // (CSE-PROXY-AUTH-TEST-001).
  const end = src.indexOf("\n  if (path === '/api/research'", start);
  assert.ok(end > start, 'end marker not found');
  return src.slice(start, end);
}

test('the route is wired: GET /api/cse-search checks a shared token header, not a user JWT', () => {
  const body = handlerBody();
  assert.match(body, /request\.headers\.get\('x-antcv-cse-token'\)/);
  assert.match(body, /if \(!env\.CSE_PROXY_TOKEN \|\| tok !== env\.CSE_PROXY_TOKEN\) \{\s*return jsonResponse\(\{ error: 'unauthorized' \}, 401, request, env\);/);
});

test('never calls identityFromRequest / user auth — this is machine-to-machine, not a signed-in user', () => {
  const body = handlerBody();
  assert.equal(/identityFromRequest/.test(body), false, 'must not gate on user sign-in — the weekly job is not a signed-in AntCV user');
});

test('rejects an empty/missing query with 400, before ever calling any backend', () => {
  const body = handlerBody();
  assert.match(body, /if \(!q\) return jsonResponse\(\{ error: 'missing q' \}, 400, request, env\);/);
});

test('Brave is tried FIRST, gated only on env.BRAVE_API_KEY — before any Google gate', () => {
  const body = handlerBody();
  const braveGate = body.indexOf('if (env.BRAVE_API_KEY) {');
  const googleGate = body.indexOf('if (!env.GOOGLE_CSE_KEY)');
  assert.ok(braveGate > 0, 'Brave gate must exist');
  assert.ok(googleGate > 0, 'Google fallback gate must exist');
  assert.ok(braveGate < googleGate, 'Brave path must come before the Google CSE fallback');
  assert.match(body, /api\.search\.brave\.com\/res\/v1\/web\/search/);
  assert.match(body, /'X-Subscription-Token': env\.BRAVE_API_KEY/);
});

test('Brave query shape mirrors /api/research: site: prefix for siteSearch, freshness from dateRestrict', () => {
  const body = handlerBody();
  assert.match(body, /bUrl\.searchParams\.set\('q', siteSearch \? \('site:' \+ siteSearch \+ ' ' \+ q\) : q\);/);
  assert.match(body, /const fr = \/y\/\.test\(dateRestrict\) \? 'py' : \(\/m\/\.test\(dateRestrict\) \? 'pm' : \(\/w\/\.test\(dateRestrict\) \? 'pw' : ''\)\);/);
  assert.match(body, /if \(fr\) bUrl\.searchParams\.set\('freshness', fr\);/);
});

test('Brave items are mapped to the same {title, link, snippet} shape as the Google path', () => {
  const body = handlerBody();
  assert.match(body, /results\.slice\(0, num\)\.map\(\(it\) => \(\{ title: it\.title, link: it\.url, snippet: it\.description \|\| '' \}\)\)/);
  assert.match(body, /source: 'brave'/);
});

test('a non-ok Brave response and a thrown Brave fetch both degrade to an error JSON response, never an unhandled throw', () => {
  const body = handlerBody();
  assert.match(body, /if \(!res\.ok\) \{ const b = await res\.text\(\)\.catch\(\(\) => ''\); return jsonResponse\(\{ error: `Brave \$\{res\.status\}/);
  assert.match(body, /catch \(e\) \{ return jsonResponse\(\{ error: 'Brave: ' \+ String\(e && e\.message \|\| e\) \}, 502, request, env\); \}/);
});

test('without a Brave key, gates on GOOGLE_CSE_KEY with a message naming both backends', () => {
  const body = handlerBody();
  assert.match(body, /if \(!env\.GOOGLE_CSE_KEY\) \{\s*return jsonResponse\(\{ error: 'no search backend: set BRAVE_API_KEY \(preferred\) or GOOGLE_CSE_KEY on the relay' \}, 503, request, env\);/);
});

test('the real API keys are read from env (Worker secrets) and never appear as literals in source', () => {
  const body = handlerBody();
  assert.match(body, /gUrl\.searchParams\.set\('key', env\.GOOGLE_CSE_KEY\);/);
  // Sanity: no AIza-prefixed literal (a real Google key) anywhere in the whole file.
  assert.equal(/AIza[0-9A-Za-z_-]{20,}/.test(src), false, 'a real Google API key must never be committed to source');
});

test('CSE-PROXY-CX-DEAD-VAR-001: the cx honours the GOOGLE_CSE_ID secret, hardcoded value is only the fallback', () => {
  const body = handlerBody();
  assert.match(body, /const CSE_ID = env\.GOOGLE_CSE_ID \|\| '67ce5387bc18f4028';/);
  // Same fix must hold on the /api/research Google fallback — no bare-literal
  // assignment anywhere in the file.
  assert.equal(/const CSE_ID = '67ce5387bc18f4028';/.test(src), false, 'no handler may ignore env.GOOGLE_CSE_ID');
});

test('num is clamped to 1..10 regardless of caller input (both backends share it)', () => {
  const body = handlerBody();
  assert.match(body, /const num = Math\.min\(10, Math\.max\(1, parseInt\(url\.searchParams\.get\('num'\), 10\) \|\| 10\)\);/);
});

test('siteSearch is optional and paired with siteSearchFilter=i (include-only) on the Google path', () => {
  const body = handlerBody();
  assert.match(body, /if \(siteSearch\) \{ gUrl\.searchParams\.set\('siteSearch', siteSearch\); gUrl\.searchParams\.set\('siteSearchFilter', 'i'\); \}/);
});

test('a non-ok Google response and a thrown fetch both degrade to an error JSON response, never an unhandled throw', () => {
  const body = handlerBody();
  assert.match(body, /if \(!res\.ok\) \{[\s\S]{0,200}return jsonResponse\(\{ error: `Google CSE \$\{res\.status\}/);
  assert.match(body, /catch \(e\) \{\s*return jsonResponse\(\{ error: String\(e && e\.message \|\| e\) \}, 502, request, env\);/);
});

test('Google response items are trimmed to title/link/snippet only — no raw payload passthrough', () => {
  const body = handlerBody();
  assert.match(body, /data\.items\.slice\(0, num\)\.map\(\(it\) => \(\{ title: it\.title, link: it\.link, snippet: it\.snippet \}\)\)/);
});

test('there is exactly one /api/cse-search route definition (no accidental duplicate)', () => {
  const count = (src.match(/path === '\/api\/cse-search'/g) || []).length;
  assert.equal(count, 1);
});
