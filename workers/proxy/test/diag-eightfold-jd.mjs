/* DIAGNOSTIC — eightfold position-API JD fetch (owner 2026-06-20, NVIDIA).
 * JD-FETCH-EIGHTFOLD-GARBLED-001: jobs.nvidia.com/careers/job/<id> is an
 * eightfold.ai SPA whose server HTML is only the theme/config blob, so the
 * normal fetch returned colour soup, not the JD. Asserts:
 *   (1) L2 rewrites /careers/job/<id>?domain=… to the /api/apply/v2/jobs/<id>
 *       JSON position endpoint;
 *   (2) the JD body is built from the JSON job_description (HTML stripped);
 *   (3) the role/department/location header is prepended;
 *   (4) the config/theme-blob backstop flags a theme JSON blob as low-quality;
 *   (5) on an API miss (404), it falls back to the original page's HTML pipeline.
 * Then a best-effort LIVE probe of the real NVIDIA position API.
 * Run: node test/diag-eightfold-jd.mjs */
import { writeSync } from 'node:fs';
const log = (...a) => writeSync(1, a.join(' ') + '\n');
const { handleFetchJdUrl } = await import('../src/fetch-jd-url.js');

let failures = 0;
function ok(cond, label) { log((cond ? 'PASS' : 'FAIL') + ' — ' + label); if (!cond) failures++; }

const NVIDIA_URL = 'https://jobs.nvidia.com/careers/job/893395051166?domain=nvidia.com&hl=da';
const realFetch = globalThis.fetch;

// ── (1)(2)(3): eightfold JSON happy path ──────────────────────────────────
const API_JSON = {
  id: 893395051166,
  name: 'Test Engineer - Photonic',
  posting_name: 'Test Engineer - Photonic',
  location: 'Denmark, Roskilde',
  locations: ['Denmark, Roskilde'],
  department: 'Engineer, Product',
  business_unit: 'Engineer, Product',
  job_description: '<p>NVIDIA has been transforming computer graphics for 25 years.</p>'
    + '<p>We are hiring a Test Engineer for photonic systems.</p>'
    + '<ul><li>Characterise optical transceivers</li><li>Own ASPICE-aligned test plans</li>'
    + '<li>Work with LiDAR and SiPh modules</li></ul>'
    + '<p>You bring 5+ years of opto-electronic test experience and strong data skills.</p>',
};
let captured = null;
globalThis.fetch = async (u) => {
  captured = String(u);
  return new Response(JSON.stringify(API_JSON), { status: 200, headers: { 'content-type': 'application/json' } });
};
{
  const req = new Request('https://proxy/api/fetch-jd-url', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: NVIDIA_URL }),
  });
  const res = await handleFetchJdUrl(req, {}, () => ({}));
  const j = await res.json().catch(() => ({}));
  ok(/\/api\/apply\/v2\/jobs\/893395051166\?domain=nvidia\.com/.test(captured), 'L2 rewrote to position API: ' + captured);
  ok(res.status === 200 && j.ok === true, 'response ok');
  ok(j.extracted_via === 'eightfold-json', 'extracted_via=eightfold-json (got ' + j.extracted_via + ')');
  ok(/Characterise optical transceivers/.test(j.text) && !/</.test(j.text.replace(/[<>]/g, m => m)), 'JD body present, HTML stripped');
  ok(!/</.test(j.text), 'no angle-bracket tags leaked into text');
  ok(/Test Engineer - Photonic/.test(j.text) && /Engineer, Product/.test(j.text) && /Roskilde/.test(j.text), 'role/dept/location header prepended');
  ok(j.title === 'Test Engineer - Photonic', 'title = role name (got ' + JSON.stringify(j.title) + ')');
  ok(j.wall_hint == null, 'no wall_hint on a clean JD');
}

// ── (4): config/theme-blob backstop flags garbage ─────────────────────────
{
  // Simulate a NON-eightfold SPA (no /careers/job path) that leaks a theme blob
  // through the HTML pipeline as text. Build an HTML page whose body IS the blob.
  const themeBlob = '{"themeOptions":{"name":"PCS Default","customTheme":{"varTheme":{'
    + Array.from({ length: 30 }, (_, i) => `"primary-color-${i}":"#76b900"`).join(',')
    + ',"button-primary-background-color":"#76b900","text-primary-color":"#1a1a1a"}}}}';
  globalThis.fetch = async () => new Response(
    `<!doctype html><html><head><title>Some Role | Acme</title></head><body><main>${themeBlob} ${themeBlob}</main></body></html>`,
    { status: 200, headers: { 'content-type': 'text/html' } });
  const req = new Request('https://proxy/api/fetch-jd-url', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://careers.acme.com/job/123' }),
  });
  const res = await handleFetchJdUrl(req, {}, () => ({}));
  const j = await res.json().catch(() => ({}));
  ok(j.ok === true && typeof j.wall_hint === 'string' && /theme\/config data/.test(j.wall_hint),
    'theme/config blob flagged via wall_hint (got: ' + JSON.stringify(j.wall_hint) + ')');
}

// ── (5): API 404 → fall back to the original page's HTML pipeline ──────────
{
  let urls = [];
  globalThis.fetch = async (u) => {
    urls.push(String(u));
    if (/\/api\/apply\/v2\/jobs\//.test(String(u))) {
      return new Response('not found', { status: 404, headers: { 'content-type': 'text/plain' } });
    }
    // original page HTML with a real JD body
    return new Response(
      '<!doctype html><html><head><title>Fallback Role | Acme</title></head><body><main>'
      + '<h1>Fallback Role</h1><p>This is a genuine job description with enough text to pass the minimum content threshold so the HTML pipeline returns it. We need a senior engineer to do meaningful work across optical systems and data pipelines for at least two hundred and twenty characters total here.</p>'
      + '</main></body></html>',
      { status: 200, headers: { 'content-type': 'text/html' } });
  };
  const req = new Request('https://proxy/api/fetch-jd-url', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://jobs.acme.com/careers/job/999999?domain=acme.com' }),
  });
  const res = await handleFetchJdUrl(req, {}, () => ({}));
  const j = await res.json().catch(() => ({}));
  ok(urls.some(u => /\/api\/apply\/v2\/jobs\/999999/.test(u)), 'tried the position API first');
  ok(urls.some(u => /jobs\.acme\.com\/careers\/job\/999999/.test(u)), 'fell back to the original page');
  ok(j.ok === true && /genuine job description/.test(j.text), 'fallback returned the HTML-pipeline JD');
  ok(/html-fallback/.test(String(j.rewrite || '')), 'rewrite note records the html-fallback');
}

// ── (6): JD-FETCH-HOST-001 — branded eightfold host, NO ?domain= param ─────
// jobs.nvidia.com/careers/job/<id> shared WITHOUT the ?domain= param used to
// miss the eightfold rewrite (host is not *.eightfold.ai), fetch the SPA shell,
// and return the theme blob or a wrong/featured job. The /careers/job/<digits>
// path alone must now trigger the position API with a domain derived from the
// registrable host (jobs.nvidia.com → nvidia.com).
{
  let captured6 = null;
  globalThis.fetch = async (u) => {
    captured6 = String(u);
    return new Response(JSON.stringify(API_JSON), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const req = new Request('https://proxy/api/fetch-jd-url', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://jobs.nvidia.com/careers/job/893395051166' }),
  });
  const res = await handleFetchJdUrl(req, {}, () => ({}));
  const j = await res.json().catch(() => ({}));
  ok(/\/api\/apply\/v2\/jobs\/893395051166\?domain=nvidia\.com/.test(captured6),
    'no-?domain host still rewrote to position API with derived domain: ' + captured6);
  ok(res.status === 200 && j.ok === true && j.extracted_via === 'eightfold-json',
    'no-?domain path returned the JSON JD, not the SPA shell');
  ok(/Characterise optical transceivers/.test(j.text || ''),
    'no-?domain path carried the correct JD body');
}

globalThis.fetch = realFetch;

// ── LIVE probe (best-effort; does not affect pass/fail) ───────────────────
try {
  const r = await fetch('https://jobs.nvidia.com/api/apply/v2/jobs/893395051166?domain=nvidia.com',
    { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const j = await r.json();
  log('LIVE probe: HTTP ' + r.status + ', name=' + j.name + ', job_description chars=' + (j.job_description || '').length);
} catch (e) {
  log('LIVE probe skipped/failed (offline?): ' + e.message);
}

log('\n' + (failures === 0 ? 'ALL EIGHTFOLD DIAG CHECKS PASS' : failures + ' CHECK(S) FAILED'));
// Set exitCode (not process.exit) so Node drains the live-probe keep-alive
// socket cleanly — process.exit() mid-connection trips a libuv assert on Windows.
process.exitCode = failures === 0 ? 0 : 1;
