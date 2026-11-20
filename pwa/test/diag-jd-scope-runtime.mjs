/* diag-jd-scope-runtime — boots the FULL index.html in headless Chromium and
 * asserts JD-SCOPE-ISOLATION-001 is live: the scope sidecar installed its narrow
 * localStorage redirect, the Fl effect set a per-tab app id, and JD-key writes land
 * on the namespaced slot (never the global slot). Complements boot-smoke.
 * Run: node pwa/test/diag-jd-scope-runtime.mjs   (exit 0 = pass)
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const server = http.createServer(async (req, res) => {
  try {
    let rel = decodeURIComponent((req.url || '/').split('?')[0]);
    if (rel === '/') rel = '/index.html';
    const fp = path.join(ROOT, rel);
    if (!fp.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    const s = await stat(fp).catch(() => null);
    if (!s || !s.isFile()) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' });
    res.end(await readFile(fp));
  } catch (e) { res.writeHead(500); res.end(String(e && e.message)); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch();
const page = await browser.newPage();
try {
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(3500);
  const r = await page.evaluate(() => {
    const raw = window.__antcvJdScopeRaw;
    const S = window.AntcvJdScope;
    const out = { installed: !!window.__antcvJdScopeInstalled, hasApi: !!(S && S.setCurrentAppId) };
    if (!raw || !S) return out;
    // default app id after boot (no cloud restore on a local serve) = kernel
    out.bootAppId = S.getCurrentAppId();
    // write via the (redirected) global key; must land on the namespaced slot
    localStorage.setItem('antcv:lastJdText', 'SMOKE_JD');
    out.nsWritten = raw.getItem('antcv:app:' + S.getCurrentAppId() + ':jdText');
    out.globalUntouched = raw.getItem('antcv:lastJdText'); // should be null
    out.readback = localStorage.getItem('antcv:lastJdText'); // should be SMOKE_JD
    // switch this tab to a real app. JD-SCOPE-COLDSTART-001 (1.51.3762): adopting a
    // real app id CONSUMES the 'kernel' staging slot — it moves into the app's empty
    // slot and the staging slot is emptied (it used to be asserted "unaffected").
    S.setCurrentAppId('999');
    out.migrated999 = raw.getItem('antcv:app:999:jdText');        // SMOKE_JD, moved in
    out.kernelConsumed = raw.getItem('antcv:app:kernel:jdText');  // null, staging emptied
    localStorage.setItem('antcv:lastJdText', 'JD_999');
    out.app999 = raw.getItem('antcv:app:999:jdText');
    // isolation between two REAL apps: a write under 998 must not touch 999's slot
    S.setCurrentAppId('998');
    localStorage.setItem('antcv:lastJdText', 'JD_998');
    out.app998 = raw.getItem('antcv:app:998:jdText');
    out.app999After = raw.getItem('antcv:app:999:jdText');
    S.setCurrentAppId('999');
    out.readback999 = localStorage.getItem('antcv:lastJdText');
    return out;
  });
  const pass = r.installed && r.hasApi && r.nsWritten === 'SMOKE_JD' && r.globalUntouched == null &&
    r.readback === 'SMOKE_JD' && r.migrated999 === 'SMOKE_JD' && r.kernelConsumed == null &&
    r.app999 === 'JD_999' && r.app998 === 'JD_998' && r.app999After === 'JD_999' &&
    r.readback999 === 'JD_999';
  console.log('jd-scope-runtime:', JSON.stringify(r));
  console.log(pass ? 'JD-SCOPE-RUNTIME OK' : 'JD-SCOPE-RUNTIME FAILED');
  await browser.close();
  await new Promise((res) => server.close(res));
  process.exit(pass ? 0 : 1);
} catch (e) {
  console.log('JD-SCOPE-RUNTIME ERROR:', e && e.message);
  await browser.close(); await new Promise((res) => server.close(res));
  process.exit(1);
}
