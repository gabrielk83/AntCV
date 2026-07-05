/* Unit test — BRAND-FIT-REAL-SAMPLE-001: handleFetchBrandColors().
 *
 * COMPANY-BRAND-FIT-001 (app.src.js) previously relied entirely on the
 * LLM's own knowledge of a company's branding, with the only fallback
 * being a client-side regex-scan of the JD's own prose text for hex
 * codes — which virtually never fires for a real posting (job text
 * doesn't carry CSS). This endpoint fetches the company's ACTUAL
 * website and samples real colors: <meta name="theme-color">, then
 * hex-frequency across inline <style> + linked stylesheets.
 *
 * No live network calls — global fetch is mocked per test.
 */
import assert from 'node:assert';
import { handleFetchBrandColors } from '../src/fetch-brand-colors.js';

let pass = 0;
const ok = (name, cond) => { assert.ok(cond, name); console.log('PASS ' + name); pass++; };

const getCORS = () => ({ 'Access-Control-Allow-Origin': '*' });
const originalFetch = global.fetch;

function withMockFetch(map, fn) {
  global.fetch = async (url) => {
    const u = String(url);
    for (const [pattern, resp] of map) {
      if (u.includes(pattern)) return resp;
    }
    return new Response('not found', { status: 404 });
  };
  return fn().finally(() => { global.fetch = originalFetch; });
}

function htmlResponse(html) {
  return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

async function post(body) {
  const req = new Request('https://worker.test/api/fetch-brand-colors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const resp = await handleFetchBrandColors(req, {}, getCORS);
  return resp.json();
}

// 1. JD URL is already on the company's own (sub)domain — not a job board —
//    root-domain homepage is tried and its theme-color meta wins as navy.
await withMockFetch(
  [['https://www.trackman.com/', htmlResponse(
    '<html><head><meta name="theme-color" content="#EC691A"><style>.btn{background:#ec691a}</style></head><body></body></html>',
  )]],
  async () => {
    const json = await post({ jdUrl: 'https://careers.trackman.com/o/project-manager-hardware-1', companyName: 'Trackman A/S' });
    ok('own-domain: ok:true', json.ok === true);
    ok('own-domain: navy from theme-color', json.navy === '#ec691a');
    ok('own-domain: source names the sampled host', /trackman\.com/.test(json.source) && /theme-color/.test(json.source));
  },
);

// 2. JD came from a third-party job board (LinkedIn) — falls through to a
//    domain guessed from the company name, legal-suffix stripped.
await withMockFetch(
  [['https://www.acmerobotics.com/', htmlResponse(
    '<html><head><style>body{color:#123456}.hero{background-color:#a1b2c3}</style></head></html>',
  )]],
  async () => {
    const json = await post({ jdUrl: 'https://www.linkedin.com/jobs/view/1234567890', companyName: 'Acme Robotics, Inc.' });
    ok('third-party board: falls back to guessed domain', json.ok === true);
    ok('third-party board: navy + accent both sampled', json.navy === '#123456' && json.accent === '#a1b2c3');
  },
);

// 2b. WIDGET-COLOR-CONTAMINATION-001 (owner 2026-07-05, Trackman live-verify):
//     a real company's own careers page can embed "Apply with LinkedIn" /
//     "Apply with Indeed" buttons whose CSS lives on the SAME page — a naive
//     hex-frequency scan would misattribute those partner colors as the
//     company's own brand. #2164f3 is Indeed's actual button color, found on
//     Trackman's real careers page. Must never surface as navy or accent.
await withMockFetch(
  [['https://www.brightgear.com/', htmlResponse(
    '<html><head><meta name="theme-color" content="#8a3ffc"><style>' +
    '.apply-indeed{background:#2164f3}.cookie-accept{background:#2c622c}' +
    '.brand-accent{background:#8a3ffc}</style></head></html>',
  )]],
  async () => {
    const json = await post({ jdUrl: '', companyName: 'BrightGear' });
    ok('widget contamination: ok:true (theme-color still usable)', json.ok === true);
    ok('widget contamination: navy is the real brand color, not Indeed blue', json.navy !== '#2164f3');
    ok('widget contamination: accent never surfaces Indeed blue', json.accent !== '#2164f3');
    ok('widget contamination: accent never surfaces consent-banner green', json.accent !== '#2c622c');
  },
);

// 3. Nothing fetchable anywhere — graceful ok:false, never throws.
await withMockFetch([], async () => {
  const json = await post({ jdUrl: 'https://www.linkedin.com/jobs/view/999', companyName: '' });
  ok('no candidates: graceful ok:false', json.ok === false);
});

// 4. Only one distinct color on the page — accent must NOT duplicate navy
//    (the client's apply path treats accent as optional; a fake duplicate
//    would be worse than none).
await withMockFetch(
  [['https://www.onecolor.com/', htmlResponse(
    '<html><head><meta name="theme-color" content="#334455"></head></html>',
  )]],
  async () => {
    const json = await post({ jdUrl: '', companyName: 'OneColor' });
    ok('single-color page: navy set', json.navy === '#334455');
    ok('single-color page: accent left null, not duplicated', json.accent === null || json.accent === undefined);
  },
);

// 5. Malformed / missing body never throws — method + JSON guards hold.
{
  const req = new Request('https://worker.test/api/fetch-brand-colors', { method: 'GET' });
  const resp = await handleFetchBrandColors(req, {}, getCORS);
  ok('GET method rejected with 405', resp.status === 405);
}
{
  const req = new Request('https://worker.test/api/fetch-brand-colors', { method: 'POST', body: 'not json' });
  const resp = await handleFetchBrandColors(req, {}, getCORS);
  const json = await resp.json();
  ok('invalid JSON body -> ok:false, no throw', json.ok === false);
}

console.log(`\n${pass} assertions passed.`);
