/* CLUSTER-QUAL-001 stage 2b regression guard (register row 9, spec section 3.4).
 *
 * GET /api/cluster-top20 is the new read endpoint the client calls to fetch
 * a category's real D1-backed top-20 qualifications for generation-time
 * demand weighting. This handler composes several auth-dependent helpers
 * (identityFromRequest -> JWT verification, maybeRefreshHeader, etc.) that
 * have no existing mock harness in this test suite (every other
 * access-relay test here — d1-write-retry, cluster-qual-extraction,
 * cluster-qual-fit-scoring — extracts PURE, no-auth helper functions, never
 * a full HTTP handler). Rather than build new auth-mocking infrastructure
 * for one endpoint, this is a source-level regression lock: it proves the
 * handler is correctly wired into routing, gates on auth/D1 same as every
 * sibling handler, derives the cluster the same way stage 1/2a already do,
 * and degrades gracefully (empty top20, not an error) when there's no
 * cluster to query — the exact shape the client-side fallback depends on.
 *
 * Run:  node --test workers/access-relay/tests/cluster-top20-endpoint.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const src = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');

test('the route is wired: GET /api/cluster-top20 dispatches to handleApiClusterTop20', () => {
  assert.match(src, /if \(path === '\/api\/cluster-top20'\) \{\s*return handleApiClusterTop20\(request, env\);\s*\}/);
});

test('the handler gates on authentication and D1 binding, same pattern as every sibling handler', () => {
  const start = src.indexOf('async function handleApiClusterTop20(request, env) {');
  assert.ok(start > 0, 'handler must exist');
  const body = src.slice(start, start + 900);
  assert.match(body, /const id = await identityFromRequest\(request, env\);/);
  assert.match(body, /if \(!id\) return jsonResponse\(\{ error: 'unauthenticated' \}, 401, request, env\);/);
  assert.match(body, /if \(!hasD1\(env\)\) return jsonResponse\(\{ error: 'd1_not_bound' \}, 503, request, env\);/);
});

test('the handler derives cluster_id via clusterForCategory (the SAME mapping stage 1/2a use, not a second copy)', () => {
  const start = src.indexOf('async function handleApiClusterTop20(request, env) {');
  const body = src.slice(start, start + 900);
  assert.match(body, /const category = normalizeCategory\(url\.searchParams\.get\('category'\)\);/);
  assert.match(body, /const clusterId = clusterForCategory\(category\);/);
});

test('an unrecognized/unsolicited category returns an empty top20, not an error (client falls back to the static seed)', () => {
  const start = src.indexOf('async function handleApiClusterTop20(request, env) {');
  const body = src.slice(start, start + 1200);
  assert.match(body, /if \(!clusterId\) \{\s*return jsonResponse\(\{ ok: true, cluster_id: null, top20: \[\] \}, 200, request, env\);\s*\}/);
});

test('the query reads cluster_top_qualifications ordered by rank, and shared_clusters is parsed defensively', () => {
  const start = src.indexOf('async function handleApiClusterTop20(request, env) {');
  const end = src.indexOf('\n}', src.indexOf('d1_read_failed', start));
  const body = src.slice(start, end);
  assert.match(body, /FROM cluster_top_qualifications WHERE user_hash = \? AND cluster_id = \? ORDER BY rank ASC/);
  assert.match(body, /try \{ return JSON\.parse\(r\.shared_clusters \|\| '\[\]'\); \} catch \(_\) \{ return \[\]; \}/, 'a malformed shared_clusters value must never throw');
});

test('there is exactly one handleApiClusterTop20 definition (no accidental duplicate)', () => {
  const count = (src.match(/async function handleApiClusterTop20\(/g) || []).length;
  assert.equal(count, 1);
});
