/* DIAGNOSTIC — REGULAR-MODE-STALE-SETUP-001 (owner 2026-06-09). In BYOK mode
 * the "⚠ Setup needed" warning + "🟡 Use demo" coin stayed until a manual
 * refresh; the DEMO preview watermark did the same. Loads the new 372 sidecar
 * + the patched demo-watermark against a synthetic header + preview paper and
 * a stub /config reporting demo_mode:true, then flips key-presence at runtime:
 *   A. no keys at boot → chips visible, watermark applied
 *   B. apiKey appears (same-tab write, NO storage event) → chips hidden + watermark gone within one poll tick
 *   C. key removed → chips restored, watermark re-applied
 *   D. React-style re-render recreates a chip while keyed → re-hidden
 * Run: node test/diag-setup-chips-live.mjs */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const S372 = await readFile(path.join(ROOT, 'antcv-setup-chips-live-372.js'), 'utf8');
const SWM = await readFile(path.join(ROOT, 'antcv-demo-watermark.js'), 'utf8');
const HTML = `<!doctype html><html><head><meta charset=utf8></head><body>
<div id="hdr">
  <div id="chip1">⚠ Setup needed</div>
  <button id="chip2">🟡 Use demo</button>
</div>
<div class="antcv-preview-paper"><p>CV page</p></div>
<script>${S372}</script>
<script>${SWM}</script>
</body></html>`;
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/config')) {
    res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-credentials': 'true' });
    res.end(JSON.stringify({ demo_mode: true }));
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end(HTML);
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;
const browser = await chromium.launch();
const page = await browser.newPage();
await page.addInitScript((p) => { window.ANTCV_RELAY_URL = 'http://127.0.0.1:' + p + ''; }, port);
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + (e && e.message)));
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 30000 });

const state = () => page.evaluate(() => ({
  chip1: getComputedStyle(document.getElementById('chip1')).display,
  chip2: document.getElementById('chip2') ? getComputedStyle(document.getElementById('chip2')).display : 'gone',
  wm: document.querySelector('.antcv-preview-paper').getAttribute('data-antcv-demo-wm'),
}));

await page.waitForTimeout(1200);
const a = await state();
const A = a.chip1 !== 'none' && a.chip2 !== 'none' && a.wm === '1';

// B — same-tab key write (no storage event); the 1.5s poll must catch it
await page.evaluate(() => localStorage.setItem('apiKey', 'sk-ant-test'));
await page.waitForTimeout(2200);
const b = await state();
const B = b.chip1 === 'none' && b.chip2 === 'none' && b.wm !== '1';

// C — key removed → chips restored, watermark back
await page.evaluate(() => localStorage.removeItem('apiKey'));
await page.waitForTimeout(2200);
const c = await state();
const C = c.chip1 !== 'none' && c.chip2 !== 'none' && c.wm === '1';

// D — keyed again, then a "re-render" recreates chip1 → observer re-hides it
await page.evaluate(() => localStorage.setItem('apiKey', 'sk-ant-test'));
await page.waitForTimeout(2200);
await page.evaluate(() => {
  const old = document.getElementById('chip1');
  const fresh = document.createElement('div');
  fresh.id = 'chip1'; fresh.textContent = '⚠ Setup needed';
  old.parentNode.replaceChild(fresh, old);
});
await page.waitForTimeout(600);
const d = await state();
const D = d.chip1 === 'none';

await browser.close(); await new Promise(r2 => server.close(r2));
console.log(JSON.stringify({ a, b, c, d }, null, 1));
console.log('app errors:', errs.length, errs.slice(0, 2).join(' | '));
console.log(`CHECK A (no keys: chips visible + DEMO watermark on): ${A ? 'PASS' : 'FAIL'}`);
console.log(`CHECK B (key appears same-tab: chips hidden + watermark off, no refresh): ${B ? 'PASS' : 'FAIL'}`);
console.log(`CHECK C (key removed: chips + watermark restored): ${C ? 'PASS' : 'FAIL'}`);
console.log(`CHECK D (re-rendered chip re-hidden while keyed): ${D ? 'PASS' : 'FAIL'}`);
const ok = A && B && C && D && errs.length === 0;
console.log(ok ? 'SETUP-CHIPS-LIVE OK (4/4)' : 'SETUP-CHIPS-LIVE FAIL');
process.exitCode = ok ? 0 : 1;
