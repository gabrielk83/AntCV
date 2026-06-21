/* AntCV fresh-start delete diag — FRESH-START-DELETE-001.
 * Verifies antcv-fresh-delete.js (AntcvFreshErase / AntcvIsFreshStart /
 * AntcvClearFreshStart):
 *   (1) AntcvFreshErase keeps the API secrets, clears the relay URL + personal
 *       data, and arms the fresh-start cookie.
 *   (2) AntcvIsFreshStart reflects the cookie; AntcvClearFreshStart disarms it.
 *   (3) The app boots cleanly with the fresh-start cookie set (wizard path does
 *       not crash; glDemo mounts), and AntcvIsFreshStart is true in-page.
 *
 * Run:  node pwa/test/diag-fresh-delete.mjs
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};
const server = http.createServer(async (req, res) => {
  try {
    let rel = decodeURIComponent((req.url || '/').split('?')[0]);
    if (rel === '/') rel = '/index.html';
    const fp = path.join(ROOT, rel);
    if (!fp.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    const s = await stat(fp).catch(() => null);
    if (!s || !s.isFile()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' });
    res.end(await readFile(fp));
  } catch (e) { res.writeHead(500); res.end(String(e && e.message)); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const url = `http://127.0.0.1:${port}/index.html`;

let pass = true;
const browser = await chromium.launch();

// ── Scenario 1: the AntcvFreshErase contract ──────────────────────────────
{
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try {
      localStorage.setItem('apiKey', 'sk-secret-anthropic');
      localStorage.setItem('geminiKey', 'g-secret');
      localStorage.setItem('cloudconvertKey', 'cc-secret');
      localStorage.setItem('proxyUrl', 'https://my-relay.workers.dev');
      localStorage.setItem('docxWorkerUrl', 'https://my-docx.workers.dev');
      localStorage.setItem('sections', '{"cv":[1],"cl":[1]}'); // "personal data"
      localStorage.setItem('wizardCompleted', 'true');
    } catch (_) {}
  });
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => {
    const api = typeof window.AntcvFreshErase === 'function' &&
                typeof window.AntcvIsFreshStart === 'function' &&
                typeof window.AntcvClearFreshStart === 'function';
    window.AntcvFreshErase();
    const out = {
      api,
      keptApiKey: localStorage.getItem('apiKey'),
      keptGemini: localStorage.getItem('geminiKey'),
      keptCc: localStorage.getItem('cloudconvertKey'),
      relayCleared: localStorage.getItem('proxyUrl') === null,
      docxCleared: localStorage.getItem('docxWorkerUrl') === null,
      personalCleared: localStorage.getItem('sections') === null,
      wizardCleared: localStorage.getItem('wizardCompleted') === null,
      freshAfterErase: window.AntcvIsFreshStart(),
    };
    window.AntcvClearFreshStart();
    out.freshAfterClear = window.AntcvIsFreshStart();
    return out;
  });
  const checks = [
    ['API present', r.api],
    ['apiKey kept', r.keptApiKey === 'sk-secret-anthropic'],
    ['geminiKey kept', r.keptGemini === 'g-secret'],
    ['cloudconvertKey kept', r.keptCc === 'cc-secret'],
    ['relay URL cleared', r.relayCleared],
    ['docx URL cleared', r.docxCleared],
    ['personal data cleared', r.personalCleared],
    ['wizardCompleted cleared', r.wizardCleared],
    ['fresh-start armed after erase', r.freshAfterErase === true],
    ['fresh-start disarmed after clear', r.freshAfterClear === false],
  ];
  for (const [name, ok] of checks) {
    console.log((ok ? '  ✓ ' : '  ✗ ') + name);
    if (!ok) pass = false;
  }
  await ctx.close();
}

// ── Scenario 2: app boots cleanly with the fresh-start cookie set ──────────
{
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errors = [];
  const IGNORE = [/Failed to load resource/i, /net::ERR_/i, /CORS/i, /workers\.dev/i, /ServiceWorker/i, /favicon/i];
  page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.some(re => re.test(m.text()))) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e && e.message)));
  await page.addInitScript(() => {
    try { document.cookie = 'antcv-just-deleted=' + Date.now() + '; path=/; samesite=lax'; } catch (_) {}
  });
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(3500);
  const r = await page.evaluate(() => ({
    fresh: !!(window.AntcvIsFreshStart && window.AntcvIsFreshStart()),
    glDemo: typeof window.glDemo,
  }));
  const ok = r.fresh && r.glDemo === 'function' && errors.length === 0;
  console.log((r.fresh ? '  ✓ ' : '  ✗ ') + 'AntcvIsFreshStart true at boot');
  console.log((r.glDemo === 'function' ? '  ✓ ' : '  ✗ ') + 'app mounted (glDemo=' + r.glDemo + ')');
  console.log((errors.length === 0 ? '  ✓ ' : '  ✗ ') + 'no boot errors (' + errors.length + ')');
  if (errors.length) errors.slice(0, 5).forEach(e => console.log('      ' + e));
  if (!ok) pass = false;
  await ctx.close();
}

await browser.close();
await new Promise((r) => server.close(r));
console.log(pass ? 'FRESH-DELETE OK' : 'FRESH-DELETE FAILED');
process.exit(pass ? 0 : 1);
