// demo-fetchjd-relay.test.mjs
// ============================================================
// DEMO-FETCHJD-WORKERURL-001 (owner 2026-06-09): the home Fetch-JD handler (Wn,
// app.src.js) resolved its endpoint from localStorage.proxyUrl only, so demo
// users (no proxyUrl) hit "Configure Worker URL in Settings → API Keys first."
// Fix: when proxyUrl is empty, fall back to window.ANTCV_RELAY_URL (set from
// relay-config.json, forwards /api/fetch-jd-url to the demo-proxy) — matching
// Generate / Analyse-JD / recheck-fit. Mirror of the exact resolution.

import { test } from 'node:test';
import assert from 'node:assert/strict';

// Mirror of app.src.js Wn proxy/relay resolution (1.50.338).
function resolveFetchJdBase(proxyUrl, relayUrl) {
  let t = (proxyUrl || '').toString().trim().replace(/^http:\/\//i, 'https://').replace(/\/+$/, '');
  if (!t) {
    const r = (relayUrl || '').toString().trim().replace(/^http:\/\//i, 'https://').replace(/\/+$/, '');
    if (r) t = r;
  }
  return t; // '' => the "Configure Worker URL" error path
}

test('D1 — proxyUrl set: used as-is (regular/BYOK unchanged)', () => {
  assert.equal(resolveFetchJdBase('https://cv-proxy.example.com/', ''), 'https://cv-proxy.example.com');
});

test('D2 — DEMO: no proxyUrl, relay set → falls back to the relay (the fix)', () => {
  assert.equal(resolveFetchJdBase('', 'https://antcv-access-relay.karp-gabriel-a.workers.dev'),
    'https://antcv-access-relay.karp-gabriel-a.workers.dev');
});

test('D3 — both empty → no base (error path preserved)', () => {
  assert.equal(resolveFetchJdBase('', ''), '');
});

test('D4 — proxyUrl wins over relay when both present', () => {
  assert.equal(resolveFetchJdBase('https://my-proxy.example.com', 'https://relay.example.com'), 'https://my-proxy.example.com');
});

test('D5 — http relay is upgraded to https + trailing slash trimmed', () => {
  assert.equal(resolveFetchJdBase('', 'http://relay.example.com/'), 'https://relay.example.com');
});
