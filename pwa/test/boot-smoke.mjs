/* AntCV boot-smoke — the blue-screen guard.
 * Serves pwa/ statically, loads index.html in headless Chromium, and asserts:
 *   (1) zero console errors / page errors during boot,
 *   (2) window.glDemo is a function (the app's React root mounted, not blue-screened).
 *
 * Run:  node pwa/test/boot-smoke.mjs
 * Exit 0 = clean boot; exit 1 = error(s) found (prints them).
 *
 * This is the project's #1-risk guard (CLAUDE.md / autonomous-session prompt):
 * run it after ANY change to app.js or the loaded sidecars.
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
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
};

const server = http.createServer(async (req, res) => {
  try {
    let rel = decodeURIComponent((req.url || '/').split('?')[0]);
    if (rel === '/') rel = '/index.html';
    const fp = path.join(ROOT, rel);
    if (!fp.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    const s = await stat(fp).catch(() => null);
    if (!s || !s.isFile()) { res.writeHead(404); res.end('not found'); return; }
    const body = await readFile(fp);
    res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' });
    res.end(body);
  } catch (e) {
    res.writeHead(500); res.end(String(e && e.message));
  }
});

await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const url = `http://127.0.0.1:${port}/index.html`;

const errors = [];
// Third-party / network noise we don't control in a local static serve.
const IGNORE = [
  /Failed to load resource/i,
  /net::ERR_/i,
  /the server responded with a status of 404/i,
  /favicon/i,
  /ServiceWorker/i,
  /sw\.js/i,
  /manifest/i,
  /fonts\.googleapis|gstatic/i,
  // Backend origin restrictions: workers (access-relay /config, proxy, docx) only
  // allow the antcv.pages.dev origin, so a localhost serve always gets a CORS
  // rejection on these. Not an app fault — irrelevant to the blue-screen guard.
  /has been blocked by CORS policy/i,
  /workers\.dev/i,
];
const ignored = (t) => IGNORE.some((re) => re.test(t));

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', (m) => {
  if (m.type() === 'error') {
    const t = m.text();
    if (!ignored(t)) errors.push('console.error: ' + t);
  }
});
page.on('pageerror', (e) => errors.push('pageerror: ' + (e && e.message)));

let glDemoType = 'missing';
try {
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  // Let sidecars + React mount settle.
  await page.waitForTimeout(3500);
  glDemoType = await page.evaluate(() => typeof window.glDemo);
} catch (e) {
  errors.push('navigation: ' + (e && e.message));
}

await browser.close();
await new Promise((r) => server.close(r));

const ok = errors.length === 0 && glDemoType === 'function';
console.log('boot-smoke: glDemo=' + glDemoType + ', errors=' + errors.length);
if (errors.length) errors.forEach((e) => console.log('  ✗ ' + e));
console.log(ok ? 'BOOT-SMOKE OK' : 'BOOT-SMOKE FAILED');
process.exit(ok ? 0 : 1);
