/* PROBE — who writes 'left' onto the CORE COMPETENCIES header in the template state?
 * Boots the template skeleton (same as diag-align-flap), then evaluates 238's
 * section-matching pipeline directly and samples the TH inline align around each
 * suspect's exposed run(). Run: node pwa/test/diag-align-flap-probe.mjs */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.map': 'application/json' };
const server = http.createServer(async (req, res) => {
  try { let rel = decodeURIComponent((req.url || '/').split('?')[0]); if (rel === '/') rel = '/index.html'; const fp = path.join(ROOT, rel); const s = await stat(fp).catch(() => null); if (!s || !s.isFile()) { res.writeHead(404); res.end('nf'); return; } res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' }); res.end(await readFile(fp)); } catch (e) { res.writeHead(500); res.end(String(e && e.message)); }
});
await new Promise(r => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();

let page = await browser.newPage({ viewport: { width: 1400, height: 1400 } });
await page.addInitScript(() => {
  try { if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.reject(new Error('sw-off')); } catch (_) {}
  localStorage.setItem('antcv:disable-loading-gate', '1');
  localStorage.setItem('antcv:auth:token', 't'); localStorage.setItem('antcv:auth:email', 'demo@e.com'); localStorage.setItem('antcv:auth:expires_at', '4102444800');
  localStorage.setItem('session', JSON.stringify({ email: 'demo@e.com', ts: 1717000000000 }));
  localStorage.setItem('step', JSON.stringify('editor')); localStorage.setItem('doc', JSON.stringify('cv'));
  localStorage.setItem('personalInfo', JSON.stringify({ name: '[Your Name]', wizardCompleted: true }));
  localStorage.setItem('language', JSON.stringify('en')); localStorage.setItem('wizardCompleted', JSON.stringify(true));
  localStorage.setItem('stylePackage', JSON.stringify('copenhagen-modern'));
});
await page.goto(base + '/index.html', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(4000);
const skeleton = await page.evaluate(() => (typeof window._antcvBuildTemplateSkeleton === 'function') ? { cv: window._antcvBuildTemplateSkeleton().cv || [], cl: [] } : null);
await page.evaluate((sk) => { localStorage.setItem('sections', JSON.stringify(sk)); }, skeleton);
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(5000);

const report = await page.evaluate(() => {
  const th = Array.from(document.querySelectorAll('th')).find(t => /focus area/i.test(t.textContent));
  const thAlign = () => (th ? th.style.textAlign : 'no-th');
  const out = { probes: [] };
  // 1. How many data-sid=profile / work_style hosts, and do they contain the TH?
  ['profile', 'work_style', 'core_comp'].forEach(sid => {
    const els = Array.from(document.querySelectorAll('[data-sid="' + sid + '"], [data-section-id="' + sid + '"]'));
    out[sid] = els.map(e => ({ tag: e.tagName, cls: String(e.className).slice(0, 60), containsTH: !!(th && e.contains(th)), textHead: (e.textContent || '').slice(0, 40) }));
  });
  // 2. Sample TH align around each suspect's run()
  const suspects = [
    ['238', window.AntcvProfileWorkstyleCjlr238 && window.AntcvProfileWorkstyleCjlr238.run],
    ['234', window.AntcvCoreCompetenciesRowControls242 && window.AntcvCoreCompetenciesRowControls242.run],
    ['237', window.AntcvSelectedOutcomesRowControls237 && window.AntcvSelectedOutcomesRowControls237.run],
  ];
  for (const [name, run] of suspects) {
    if (typeof run !== 'function') { out.probes.push({ name, missing: true }); continue; }
    const before = thAlign();
    try { run(); } catch (e) { out.probes.push({ name, err: String(e && e.message) }); continue; }
    // run() may defer via rAF — force a sync second call won't help; sample now and note deferred
    const after = thAlign();
    out.probes.push({ name, before, after });
  }
  return out;
});
console.log(JSON.stringify(report, null, 1));
// wait for rAF-deferred passes then sample again with per-suspect isolation via repeated calls
const second = await page.evaluate(async () => {
  const th = Array.from(document.querySelectorAll('th')).find(t => /focus area/i.test(t.textContent));
  const thAlign = () => (th ? th.style.textAlign : 'no-th');
  const raf = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const res = [];
  for (const [name, api] of [['238', window.AntcvProfileWorkstyleCjlr238], ['234', window.AntcvCoreCompetenciesRowControls242]]) {
    if (!api || typeof api.run !== 'function') continue;
    const before = thAlign();
    api.run(); await raf(); await raf();
    res.push({ name, before, after: thAlign() });
  }
  return res;
});
console.log('DEFERRED:', JSON.stringify(second));
await browser.close(); await new Promise(r => server.close(r));
