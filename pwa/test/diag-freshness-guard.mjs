/* AntCV freshness-guard diag — STALE-SW-DEMASK-001.
 * Verifies antcv-hardrefresh-force-349.js (v789 freshness guard):
 *   (1) the guaranteed-fresh API is installed,
 *   (2) when the network-fresh index.html reports a NEWER release than the
 *       loaded one, an honest "Update" banner appears (de-masking),
 *   (3) when the deployed release == loaded release, NO banner appears.
 *
 * The network probe (`./index.html?_fresh=…`, cache:no-store) is intercepted
 * via Playwright routing so we can control the "deployed" version. Auto-reload
 * is disabled (antcv:disable-freshness-auto) so the test only asserts the
 * banner, never navigates away.
 *
 * Run:  node pwa/test/diag-freshness-guard.mjs
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
  } catch (e) { res.writeHead(500); res.end(String(e && e.message)); }
});

await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const url = `http://127.0.0.1:${port}/index.html`;

// Read the loaded release version (the seed in the served index.html) so the
// test is robust to future version bumps.
const idxHtml = await readFile(path.join(ROOT, 'index.html'), 'utf8');
const loadedV = (/window\.ANTCV_VERSION\s*=\s*['"]([^'"]+)['"]/.exec(idxHtml) || [])[1];
function bump(v) { // produce a strictly-newer patch
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(v);
  return `${m[1]}.${m[2]}.${parseInt(m[3], 10) + 5}`;
}
const newerV = bump(loadedV);

async function run(deployedSeed) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  const page = await ctx.newPage();
  // Disable auto-reload so we only assert the banner.
  await page.addInitScript(() => {
    try { localStorage.setItem('antcv:disable-freshness-auto', '1'); } catch (_) {}
  });
  // Intercept ONLY the freshness probe (index.html?_fresh=…); serve a mocked
  // index.html whose ANTCV_VERSION seed is the "deployed" version under test.
  await page.route('**/index.html*', (route) => {
    const u = route.request().url();
    if (u.includes('_fresh=')) {
      const html = `<!doctype html><html><head>` +
        `<script>window.ANTCV_VERSION='${deployedSeed}';</script>` +
        `</head><body>mocked deployed index</body></html>`;
      return route.fulfill({ status: 200, contentType: 'text/html', body: html });
    }
    return route.continue();
  });

  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  // The guard polls up to ~8s for the loaded version, then fetches the probe.
  await page.waitForTimeout(4000);

  const apiOk = await page.evaluate(() =>
    typeof window.AntcvForceReload === 'function' &&
    typeof window.AntcvGuaranteedFresh === 'function' &&
    typeof window.AntcvCheckFreshness === 'function' &&
    !!(window.AntcvHardRefreshForce && /freshness-guard/.test(window.AntcvHardRefreshForce.version))
  );
  const banner = await page.evaluate(() => {
    const b = document.getElementById('antcv-stale-banner');
    return b ? b.textContent : null;
  });
  await browser.close();
  return { apiOk, banner };
}

let pass = true;

// Scenario A: deployed is NEWER → expect banner mentioning the deployed version.
const a = await run(newerV);
if (!a.apiOk) { console.log('  ✗ freshness API not installed'); pass = false; }
else console.log('  ✓ freshness API installed');
if (a.banner && a.banner.includes(newerV) && a.banner.includes(loadedV)) {
  console.log(`  ✓ STALE detected → banner shown (loaded ${loadedV}, deployed ${newerV})`);
} else {
  console.log(`  ✗ STALE not surfaced — banner=${JSON.stringify(a.banner)}`); pass = false;
}

// Scenario B: deployed == loaded → expect NO banner.
const b = await run(loadedV);
if (b.banner == null) {
  console.log(`  ✓ FRESH (deployed == loaded ${loadedV}) → no banner`);
} else {
  console.log(`  ✗ false-positive banner on fresh tab — banner=${JSON.stringify(b.banner)}`); pass = false;
}

await new Promise((r) => server.close(r));
console.log(pass ? 'FRESHNESS-GUARD OK' : 'FRESHNESS-GUARD FAILED');
process.exit(pass ? 0 : 1);
