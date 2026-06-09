/* DIAGNOSTIC — demo-proxy LinkedIn JD fetch (owner 2026-06-09).
 * Drives the live handleFetchJdUrl handler with a LinkedIn /jobs/view URL and a
 * MOCKED fetch returning a sample guest jobPosting fragment (with cookie-consent
 * noise), asserting: (1) L2 rewrote the URL to the guest jobPosting endpoint,
 * (2) the JD body was extracted, (3) the consent banner was stripped. Then a
 * best-effort LIVE reachability probe of the guest endpoint. Run: node test/diag-linkedin-jd.mjs */
import { writeSync } from 'node:fs';
const log = (...a) => writeSync(1, a.join(' ') + '\n');
const { handleFetchJdUrl } = await import('../src/fetch-jd-url.js');

const SAMPLE = `<!doctype html><html><head><title>Senior Systems Engineer — Acme Optics</title></head><body>
<div class="artdeco-global-alert cookie-consent">LinkedIn uses cookies. Accept cookies to continue. Manage your preferences. Sign in to see more.</div>
<section class="show-more-less-html__markup">
  <h2>About the role</h2>
  <p>We are hiring a Senior Systems Engineer to lead electro-optical systems development, owning requirements traceability and ASPICE compliance.</p>
  <ul><li>5+ years in systems engineering</li><li>Hands-on with LiDAR, SPAD and optics</li><li>Supplier coordination and acceptance testing</li></ul>
</section>
<button class="show-more-less-html__button">Show more</button>
<button class="show-more-less-html__button">Show less</button>
<footer>© LinkedIn. Cookie Policy. User Agreement.</footer>
</body></html>`;

let captured = null;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  captured = String(url);
  return new Response(SAMPLE, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
};

const req = new Request('https://demo/api/fetch-jd-url', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ url: 'https://www.linkedin.com/jobs/view/4414211731/?refId=abc' }),
});
const res = await handleFetchJdUrl(req, {}, () => ({}));
const j = await res.json().catch(() => ({}));
globalThis.fetch = realFetch;

const text = String(j.text || j.jd || j.content || '');
log('status:', res.status);
log('fetched URL (should be guest endpoint):', captured);
log('rewrite note:', j.rewrite);
log('ok:', j.ok, '| extracted length:', text.length);
log('extract head:', JSON.stringify(text.slice(0, 140)));
const A = /jobs-guest\/jobs\/api\/jobPosting\/4414211731/.test(captured || '');
const B = j.ok === true && /electro-optical|systems engineer/i.test(text) && /ASPICE/i.test(text);
const C = !/accept cookies|cookie policy|manage your preferences/i.test(text);
log(`CHECK A (L2 rewrote to LinkedIn guest endpoint): ${A ? 'PASS' : 'FAIL'}`);
log(`CHECK B (JD body extracted): ${B ? 'PASS' : 'FAIL'}`);
log(`CHECK C (consent/footer noise stripped): ${C ? 'PASS' : 'FAIL'}`);

// ── D: SLUG URL form (LinkedIn app share sheet) also hits the guest rewrite ──
// (owner 2026-06-09: slug URLs missed the rewrite, fetched the SPA page, and
//  the description came back clamped behind "…see more")
captured = null;
globalThis.fetch = async (url) => {
  captured = String(url);
  return new Response(SAMPLE, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
};
const reqSlug = new Request('https://demo/api/fetch-jd-url', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ url: 'https://www.linkedin.com/jobs/view/senior-systems-engineer-2024-at-acme-optics-4414211731/?utm_source=share' }),
});
const resSlug = await handleFetchJdUrl(reqSlug, {}, () => ({}));
const jSlug = await resSlug.json().catch(() => ({}));
globalThis.fetch = realFetch;
const slugText = String(jSlug.text || '');
const D = /jobs-guest\/jobs\/api\/jobPosting\/4414211731/.test(captured || '');
log('slug fetched URL:', captured);
log(`CHECK D (slug /jobs/view/title-at-co-{id} rewritten to guest endpoint): ${D ? 'PASS' : 'FAIL'}`);

// ── E: "Show more"/"Show less" button artifacts removed from the text ──
const E = !/^\s*show (more|less)\s*$/im.test(slugText) && /ASPICE/i.test(slugText);
log(`CHECK E (Show more/less button labels stripped, body intact): ${E ? 'PASS' : 'FAIL'}`);

const ok = A && B && C && D && E;
log(ok ? 'LINKEDIN-JD-FETCH OK (5/5)' : 'LINKEDIN-JD-FETCH FAIL');

// ── best-effort LIVE reachability probe (does NOT gate the result) ──
try {
  const probeId = '4414211731';
  const r = await realFetch('https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/' + probeId, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36', 'Accept': 'text/html' },
  });
  const ct = (r.headers.get('content-type') || '');
  const body = await r.text();
  log('LIVE probe: status', r.status, '| content-type', ct, '| bytes', body.length, '|', /show-more-less-html|description__text|job/i.test(body) ? 'looks like a JD fragment' : '(no JD markers — may be expired/blocked)');
} catch (e) {
  log('LIVE probe: skipped/failed —', String(e && e.message));
}
// Let the event loop drain (avoid a Windows libuv teardown race on process.exit
// while the live-probe socket is still closing). Set the code, don't hard-exit.
process.exitCode = ok ? 0 : 1;
