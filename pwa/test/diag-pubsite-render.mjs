/* E2E — PUB-MASTERSITE-001: when section.masterSite.on, the publications section
 * renders an "All publications: <label>" link in the live preview. Boots the real
 * editor with a seeded publications section carrying masterSite.
 */
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

const URL = 'https://scholar.google.com/citations?user=ABC';
const SECTIONS = { cv: [
  { id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'IT expert.' },
  { id: 'pubs', title: 'PUBLICATIONS', loc: 'main', on: true, type: 'list_italic', richPub: true, items: ['First paper — Journal, 2020'], masterSite: { on: true, label: 'Google Scholar', url: URL } },
], cl: [] };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
const errs = []; page.on('pageerror', e => errs.push(String(e && e.message)));
await page.addInitScript(({ sections, url }) => {
  try { if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.reject(new Error('sw-off')); } catch (_) {}
  localStorage.setItem('antcv:disable-loading-gate', '1');
  localStorage.setItem('antcv:auth:token', 't'); localStorage.setItem('antcv:auth:email', 'g@e.com'); localStorage.setItem('antcv:auth:expires_at', '4102444800');
  localStorage.setItem('session', JSON.stringify({ email: 'g@e.com', ts: 1717000000000 }));
  localStorage.setItem('step', JSON.stringify('editor')); localStorage.setItem('doc', JSON.stringify('cv'));
  localStorage.setItem('sections', JSON.stringify(sections));
  localStorage.setItem('personalInfo', JSON.stringify({ name: 'Gabriel', wizardCompleted: true }));
  localStorage.setItem('language', JSON.stringify('en')); localStorage.setItem('wizardCompleted', JSON.stringify(true));
  localStorage.setItem('stylePackage', JSON.stringify('copenhagen-modern'));
}, { sections: SECTIONS, url: URL });

await page.goto(base + '/index.html', { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(() => !!document.querySelector('.antcv-preview-paper'), { timeout: 16000 }).catch(() => {});
await page.waitForTimeout(1500);

const r = await page.evaluate((url) => {
  const paper = document.querySelector('.antcv-preview-paper');
  const txt = paper ? (paper.textContent || '') : (document.body.textContent || '');
  const links = [...document.querySelectorAll('.antcv-preview-paper a, a')].map(a => a.getAttribute('href'));
  return {
    previewUp: !!paper,
    showsLabel: /All publications:/.test(txt),
    showsScholar: /Google Scholar/.test(txt),
    linkPresent: links.includes(url),
  };
}, URL);
console.log(JSON.stringify(r, null, 1));
await page.screenshot({ path: path.join(ROOT, 'test', 'out', 'pubsite-render.png'), fullPage: true });
const pass = r.previewUp && r.showsLabel && r.showsScholar && r.linkPresent;
console.log('\nRESULT:', pass ? 'PASS' : 'FAIL');
if (errs.length) console.log('pageerrors:', errs.slice(0, 3).join(' | '));
await browser.close(); await new Promise(r => server.close(r));
process.exit(pass ? 0 : 1);
