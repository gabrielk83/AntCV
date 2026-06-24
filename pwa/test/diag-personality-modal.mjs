/* UNIT — Personality is a section in the Review & Edit modal (owner 2026-06-24):
 * shows the kernel result (trait chips + work-style line) and a Retake button,
 * placed above CV sidebar content.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sidecar = await readFile(path.join(ROOT, 'antcv-data-export-360.js'), 'utf8');
const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><html><body></body></html>'); });
await new Promise(r => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
const PI = { name: 'Gabriel', personality: { traits: [{ id: 'calm', label: 'Calm under pressure' }], work_style_line: { en: 'Calm, structured decisions.' } } };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 820, height: 1200 } });
const errs = []; page.on('pageerror', e => errs.push(String(e && e.message)));
await page.goto(base, { waitUntil: 'load' });
await page.evaluate((pi) => { localStorage.setItem('personalInfo', JSON.stringify(pi)); localStorage.setItem('sections', JSON.stringify({ cv: [], cl: [] })); }, PI);
await page.addScriptTag({ content: sidecar });
await page.waitForTimeout(150);
await page.evaluate(() => window.AntcvReviewData && window.AntcvReviewData());
await page.waitForTimeout(150);
await page.evaluate(() => { const m = document.querySelector('[data-antcv-review-modal]'); const h = [...m.querySelectorAll('button')].find(b => /^[▸▾]\s*🧠\s*Personality$/.test((b.textContent || '').replace(/\s+/g, ' ').trim())); if (h) h.click(); });
await page.waitForTimeout(150);
const r = await page.evaluate(() => {
  const m = document.querySelector('[data-antcv-review-modal]');
  const hdr = [...m.querySelectorAll('button')].find(b => /🧠\s*Personality$/.test((b.textContent || '').replace(/\s+/g, ' ').trim()));
  const card = hdr ? hdr.parentElement : null;
  const t = card ? card.textContent || '' : '';
  // Personality must sit above the CV sidebar content header.
  const allBtns = [...m.querySelectorAll('button')];
  const pIdx = allBtns.findIndex(b => /🧠\s*Personality$/.test((b.textContent || '').replace(/\s+/g, ' ').trim()));
  const sbIdx = allBtns.findIndex(b => /CV sidebar content/.test(b.textContent || ''));
  return {
    cardPresent: !!card,
    showsTrait: /Calm under pressure/.test(t),
    showsWorkStyle: /structured decisions/.test(t),
    hasRetake: card ? [...card.querySelectorAll('button')].some(b => /Retake/.test(b.textContent || '')) : false,
    abovesidebar: pIdx >= 0 && sbIdx >= 0 && pIdx < sbIdx,
  };
});
console.log(JSON.stringify(r, null, 1));
const pass = r.cardPresent && r.showsTrait && r.showsWorkStyle && r.hasRetake && r.abovesidebar;
console.log('\nRESULT:', pass ? 'PASS' : 'FAIL');
if (errs.length) console.log('pageerrors:', errs.slice(0, 3).join(' | '));
await browser.close(); await new Promise(r => server.close(r));
process.exit(pass ? 0 : 1);
