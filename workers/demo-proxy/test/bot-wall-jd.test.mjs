/* JD-FETCH-BOT-CHALLENGE-001 — HTTP-status guard in /api/fetch-jd-url.
 * A bot-protected career site (Thales / phenom-feeds, DataDome, Akamai) answers
 * the server-side fetch with 403 (or 401/429/5xx) + an error/challenge HTML
 * body. Before the guard that body was extracted and returned as the "JD".
 * Asserts the guard returns ok:false + wall:true + a paste-manually message and
 * NEVER leaks the wall body — while a normal 200 page still returns the JD.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { handleFetchJdUrl } = await import('../src/fetch-jd-url.js');
const realFetch = globalThis.fetch;

function req(url) {
  return new Request('https://proxy/api/fetch-jd-url', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url }),
  });
}

async function call(url) {
  const res = await handleFetchJdUrl(req(url), {}, () => ({}));
  const j = await res.json().catch(() => ({}));
  return { res, j };
}

test('403 bot wall (Thales/phenom-feeds) → ok:false, wall:true, paste guidance, no body leak', async () => {
  globalThis.fetch = async () => new Response(
    '<!doctype html><html><body><h1>Access Denied</h1><p>You do not have permission to access this resource. Reference #18.abcd.</p></body></html>',
    { status: 403, headers: { 'content-type': 'text/html' } });
  try {
    const { j } = await call('https://careers.thalesgroup.com/global/en/job/TGPTGWGLOBALR03291909EXTERNALENGLOBAL/Project-Manager?utm_source=linkedin&utm_medium=phenom-feeds');
    assert.equal(j.ok, false, 'must not report ok on a 403');
    assert.equal(j.wall, true, 'wall flag set');
    assert.equal(j.status, 403, 'upstream status echoed');
    assert.match(j.error, /blocked|bot protection|login wall/i, 'bot-wall worded error');
    assert.match(j.error, /paste/i, 'points the user at the manual paste fallback');
    assert.ok(!('text' in j) || !j.text, 'never returns the wall body as JD text');
    assert.ok(!/Access Denied|permission to access/i.test(JSON.stringify(j)), 'wall body must not leak');
  } finally { globalThis.fetch = realFetch; }
});

test('429 rate-limit → ok:false with a wait/paste message', async () => {
  globalThis.fetch = async () => new Response('<html><body>Too Many Requests</body></html>',
    { status: 429, headers: { 'content-type': 'text/html' } });
  try {
    const { j } = await call('https://careers.example.com/job/1');
    assert.equal(j.ok, false);
    assert.equal(j.status, 429);
    assert.match(j.error, /429|rate.?limit/i);
  } finally { globalThis.fetch = realFetch; }
});

test('404 → ok:false with an expired/not-found message', async () => {
  globalThis.fetch = async () => new Response('<html><body>Not Found</body></html>',
    { status: 404, headers: { 'content-type': 'text/html' } });
  try {
    const { j } = await call('https://careers.example.com/job/gone');
    assert.equal(j.ok, false);
    assert.equal(j.status, 404);
    assert.match(j.error, /not found|expired/i);
  } finally { globalThis.fetch = realFetch; }
});

test('regression: a normal 200 HTML posting still returns the JD (guard is error-path only)', async () => {
  globalThis.fetch = async () => new Response(
    '<!doctype html><html><head><title>Project Manager | Acme</title></head><body><main>'
    + '<h1>Project Manager</h1><p>We are hiring a project manager to coordinate cross-functional delivery '
    + 'across engineering and operations. You will own the schedule, manage risk, and align stakeholders '
    + 'over at least two hundred and twenty characters of genuine description so the content gate passes.</p>'
    + '</main></body></html>',
    { status: 200, headers: { 'content-type': 'text/html' } });
  try {
    const { j } = await call('https://careers.acme.com/job/100');
    assert.equal(j.ok, true, '2xx fetch unaffected');
    assert.equal(j.status, 200);
    assert.match(j.text, /coordinate cross-functional delivery/, 'JD body returned');
    assert.ok(j.wall == null || j.wall === undefined, 'no wall flag on a clean fetch');
  } finally { globalThis.fetch = realFetch; }
});
