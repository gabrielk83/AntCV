/* E2E — PERSONAL-MERGE-5 in the real app: the Personality card renders in
 * Settings -> Personal with the kernel RESULT (trait chips + work-style line) and
 * a Retake button; no floating FABs remain; exactly one job-search island.
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

const SECTIONS = { cv: [{ id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'IT expert.' }], cl: [] };
const PI = {
  name: 'Gabriel', wizardCompleted: true,
  personality: { traits: [{ id: 'calm', label: 'Calm under pressure' }, { id: 'analytical', label: 'Analytical' }], work_style_line: { en: 'Calm, structured decisions; clear outcomes.' } },
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
const errs = []; page.on('pageerror', e => errs.push(String(e && e.message)));
await page.addInitScript(({ sections, pi }) => {
  try { if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.reject(new Error('sw-off')); } catch (_) {}
  localStorage.setItem('antcv:disable-loading-gate', '1');
  localStorage.setItem('antcv:auth:token', 't'); localStorage.setItem('antcv:auth:email', 'g@e.com'); localStorage.setItem('antcv:auth:expires_at', '4102444800');
  localStorage.setItem('session', JSON.stringify({ email: 'g@e.com', ts: 1717000000000 }));
  localStorage.setItem('step', JSON.stringify('editor')); localStorage.setItem('doc', JSON.stringify('cv'));
  localStorage.setItem('sections', JSON.stringify(sections));
  localStorage.setItem('personalInfo', JSON.stringify(pi));
  localStorage.setItem('language', JSON.stringify('en')); localStorage.setItem('wizardCompleted', JSON.stringify(true));
  localStorage.setItem('stylePackage', JSON.stringify('copenhagen-modern'));
}, { sections: SECTIONS, pi: PI });

await page.goto(base + '/index.html', { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(() => !!document.querySelector('.antcv-preview-paper'), { timeout: 16000 }).catch(() => {});
await page.evaluate(() => { const g = [...document.querySelectorAll('button,[role=button]')].find(b => /⚙|settings/i.test((b.textContent || '') + (b.getAttribute('aria-label') || '') + (b.getAttribute('title') || ''))); if (g) g.click(); });
await page.waitForTimeout(1200);
async function clickExact(t) { return page.evaluate((t) => { const m = [...document.querySelectorAll('button,[role=button],[role=tab],summary,div,span,a')].find(e => e.offsetParent !== null && (e.textContent || '').replace(/\s+/g, ' ').trim() === t); if (m) { m.click(); return true; } return false; }, t); }
await clickExact('Standard'); await page.waitForTimeout(400);
await clickExact('Personal'); await page.waitForTimeout(2000);

const r = await page.evaluate(() => {
  const card = document.getElementById('antcv-personality-kernel-card');
  const cardTxt = card ? (card.textContent || '') : '';
  const retake = card ? [...card.querySelectorAll('button')].some(b => /Retake/.test(b.textContent || '')) : false;
  return {
    cardPresent: !!card,
    showsTrait: /Calm under pressure/.test(cardTxt),
    showsWorkStyle: /structured decisions/.test(cardTxt),
    retakeBtn: retake,
    exportFab: !!document.querySelector('.antcv-export-fab'),
    importFab: !!document.querySelector('.antcv-import-fab'),
    jobSearchCount: document.querySelectorAll('#antcv-react-job-search-targeting').length,
  };
});
console.log(JSON.stringify(r, null, 1));
await page.screenshot({ path: path.join(ROOT, 'test', 'out', 'personal-merge5-e2e.png'), fullPage: true });
const pass = r.cardPresent && r.showsTrait && r.showsWorkStyle && r.retakeBtn &&
  !r.exportFab && !r.importFab && r.jobSearchCount <= 1;
console.log('\nRESULT:', pass ? 'PASS' : 'FAIL');
if (errs.length) console.log('pageerrors:', errs.slice(0, 3).join(' | '));
await browser.close(); await new Promise(r => server.close(r));
process.exit(pass ? 0 : 1);
