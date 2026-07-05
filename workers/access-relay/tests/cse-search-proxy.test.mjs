/* CSE-PROXY-001 (owner 2026-07-05): GET /api/cse-search — a proxy so the
 * weekly demand-tuning job (CLUSTER-QUAL-001 §7.6, a scheduled Claude Code
 * session, NOT this Worker) can query Google Custom Search (Jobindex.dk,
 * Glassdoor, etc.) without ever holding the real, billable GOOGLE_CSE_KEY.
 * Same shared-token pattern as the existing /api/security-alert endpoint
 * (SECURITY-WEEKLY-001): the real secret is a Worker-only env var; callers
 * authenticate with a separate, narrow-scope CSE_PROXY_TOKEN header instead.
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
  const end = src.indexOf("\n  if (path === '/__diag'", start);
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

test('gates on GOOGLE_CSE_KEY being configured, distinct from the CSE_PROXY_TOKEN auth gate', () => {
  const body = handlerBody();
  assert.match(body, /if \(!env\.GOOGLE_CSE_KEY\) \{\s*return jsonResponse\(\{ error: 'GOOGLE_CSE_KEY not set on relay' \}, 503, request, env\);/);
});

test('rejects an empty/missing query with 400, before ever calling Google', () => {
  const body = handlerBody();
  assert.match(body, /if \(!q\) return jsonResponse\(\{ error: 'missing q' \}, 400, request, env\);/);
});

test('the real Google API key is read from env (a Worker secret) and never appears as a literal in source', () => {
  const body = handlerBody();
  assert.match(body, /gUrl\.searchParams\.set\('key', env\.GOOGLE_CSE_KEY\);/);
  // Sanity: no AIza-prefixed literal (a real key) anywhere in the whole file.
  assert.equal(/AIza[0-9A-Za-z_-]{20,}/.test(src), false, 'a real Google API key must never be committed to source');
});

test('num is clamped to Google\'s 1..10 range regardless of caller input', () => {
  const body = handlerBody();
  assert.match(body, /const num = Math\.min\(10, Math\.max\(1, parseInt\(url\.searchParams\.get\('num'\), 10\) \|\| 10\)\);/);
});

test('siteSearch is optional and paired with siteSearchFilter=i (include-only) when present', () => {
  const body = handlerBody();
  assert.match(body, /if \(siteSearch\) \{ gUrl\.searchParams\.set\('siteSearch', siteSearch\); gUrl\.searchParams\.set\('siteSearchFilter', 'i'\); \}/);
});

test('a non-ok Google response and a thrown fetch both degrade to an error JSON response, never an unhandled throw', () => {
  const body = handlerBody();
  assert.match(body, /if \(!res\.ok\) \{[\s\S]{0,200}return jsonResponse\(\{ error: `Google CSE \$\{res\.status\}/);
  assert.match(body, /catch \(e\) \{\s*return jsonResponse\(\{ error: String\(e && e\.message \|\| e\) \}, 502, request, env\);/);
});

test('response items are trimmed to title/link/snippet only — no raw Google payload passthrough', () => {
  const body = handlerBody();
  assert.match(body, /data\.items\.slice\(0, num\)\.map\(\(it\) => \(\{ title: it\.title, link: it\.link, snippet: it\.snippet \}\)\)/);
});

test('there is exactly one /api/cse-search route definition (no accidental duplicate)', () => {
  const count = (src.match(/path === '\/api\/cse-search'/g) || []).length;
  assert.equal(count, 1);
});
