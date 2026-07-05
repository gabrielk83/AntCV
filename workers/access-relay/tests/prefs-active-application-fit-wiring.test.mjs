/* CLUSTER-QUAL-001 stage 3 regression guard (register row 9, spec section 6
 * rollout step 6, "PWA: add a fit panel").
 *
 * GET /api/prefs already surfaces the active application inline (Phase B) so
 * the PWA restores cv_sections/rationale/meta in one round trip. This proves
 * activeApplication.fit is wired into that SAME response via
 * fetchApplicationFit — no second endpoint — the same source-level-lock
 * pattern as cluster-top20-endpoint.test.mjs (handleApiPrefs is an
 * auth-heavy HTTP handler with no existing mock harness in this suite;
 * fetchApplicationFit's own logic is functionally tested in
 * application-fit-read.test.mjs).
 *
 * Run:  node --test workers/access-relay/tests/prefs-active-application-fit-wiring.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const src = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');

test('handleApiPrefs calls fetchApplicationFit and attaches it to activeApplication.fit', () => {
  const start = src.indexOf('async function handleApiPrefs(request, env) {');
  assert.ok(start > 0, 'handler must exist');
  const end = src.indexOf('\n  }\n', src.indexOf("if (m === 'GET')", start));
  const body = src.slice(start, end > start ? end : start + 4000);
  assert.match(body, /if \(activeApplication && d1Available\) \{\s*activeApplication\.fit = await fetchApplicationFit\(env, userHash, activeApplication\.id\);/);
});

test('the fit wiring runs AFTER activeApplication is built (fetchApplicationFit needs activeApplication.id)', () => {
  const shapeIdx = src.indexOf('activeApplication = shapeApplicationRow(appRow);');
  const wireIdx = src.indexOf('activeApplication.fit = await fetchApplicationFit(');
  assert.ok(shapeIdx > 0 && wireIdx > 0, 'both sites must exist');
  assert.ok(wireIdx > shapeIdx, 'the fit fetch must come after activeApplication is shaped, since it reads activeApplication.id');
});

test('fetchApplicationFit is defined exactly once (no accidental duplicate)', () => {
  const count = (src.match(/async function fetchApplicationFit\(/g) || []).length;
  assert.equal(count, 1);
});

test('fetchApplicationFit scopes its application_fit read to BOTH application_id and the requesting user_hash', () => {
  const start = src.indexOf('async function fetchApplicationFit(');
  const body = src.slice(start, start + 900);
  assert.match(body, /FROM application_fit WHERE application_id = \? AND user_hash = \?/, 'a fit row must never leak across users even if application_id were guessed');
});
