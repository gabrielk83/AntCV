/* DIAGNOSTIC — SETTINGS-SWEEP-STABILIZE (register row 17). Follow-up to the
 * Personal-panel fix (SETTINGS-PERSONAL-STABILIZE-001, 1.51.128). Boots the app,
 * opens Settings, and for each STANDARD-tier subtab (Personal/Account/Layout)
 * measures, over 6s AT REST: (a) document-wide DOM mutations, (b) localStorage
 * .setItem writes bucketed by key. A non-idempotent sweep writer shows up as a
 * key re-written many times per second while nothing is happening.
 * PASS = every panel <= 8 mutations AND no key written > 3x in 6s, zero errors.
 * Run: node pwa/test/diag-settings-panels-probe.mjs */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// portable: this file lives in pwa/test/, so the served root is its parent dir
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer(async (req, res) => {
  try { let rel = decodeURIComponent((req.url || '/').split('?')[0]); if (rel === '/') rel = '/index.html'; const fp = path.join(ROOT, rel); const s = await stat(fp).catch(() => null); if (!s || !s.isFile()) { res.writeHead(404); res.end('nf'); return; } res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' }); res.end(await readFile(fp)); } catch (e) { res.writeHead(500); res.end('e'); }
});
await new Promise(r => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
const errs = []; page.on('pageerror', e => errs.push(String(e && e.message)));
await page.addInitScript(() => {
  try { if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.reject(new Error('sw-off')); } catch (_) {}
  localStorage.setItem('antcv:disable-loading-gate', '1');
  localStorage.setItem('antcv:auth:token', 't'); localStorage.setItem('antcv:auth:email', 'demo@e.com'); localStorage.setItem('antcv:auth:expires_at', '4102444800');
  localStorage.setItem('session', JSON.stringify({ email: 'demo@e.com', ts: 1717000000000 }));
  localStorage.setItem('step', JSON.stringify('editor')); localStorage.setItem('doc', JSON.stringify('cv'));
  localStorage.setItem('sections', JSON.stringify({ cv: [{ id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'P.' }], cl: [] }));
  localStorage.setItem('personalInfo', JSON.stringify({ name: 'Diag', wizardCompleted: true }));
  localStorage.setItem('language', JSON.stringify('en')); localStorage.setItem('wizardCompleted', JSON.stringify(true));
  // hook setItem to bucket writes by key
  window.__setCounts = {};
  const _si = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) { try { window.__setCounts[k] = (window.__setCounts[k] || 0) + 1; } catch (_) {} return _si.call(this, k, v); };
});
await page.goto(base + '/index.html', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(5000);
// open Settings (gear)
try { await page.locator('text=⚙').first().click({ timeout: 2500 }); } catch (e) { console.log('settings open fail', e.message); }
await page.waitForTimeout(1200);

async function measure(label) {
  await page.evaluate(() => {
    window.__pm = 0; window.__samples = {};
    window.__setCounts = {};
    if (window.__mo) { try { window.__mo.disconnect(); } catch (_) {} }
    window.__mo = new MutationObserver(m => {
      window.__pm += m.length;
      m.forEach(x => {
        const t = x.target; let chain = []; let n = t.nodeType === 1 ? t : t.parentElement;
        for (let d = 0; n && d < 4; d++, n = n.parentElement) { chain.push(n.tagName + (n.dataset ? Object.keys(n.dataset).slice(0, 2).join(',') : '')); }
        const key = x.type + '|' + (x.attributeName || '') + '|' + chain.join('>');
        window.__samples[key] = (window.__samples[key] || 0) + 1;
      });
    });
    // watch the settings modal (holds all subtab labels), else body
    let root = null;
    const all = Array.from(document.querySelectorAll('div'));
    // standard-tier subtabs are always present in the settings modal; 'Sync' is
    // advanced-tier and only renders under the Advanced section, so don't require it.
    for (const el of all) { const t = el.textContent || ''; if (t.includes('Personal') && t.includes('Account') && t.includes('Layout') && t.includes('Application history')) { if (!root || el.textContent.length < root.textContent.length) root = el; } }
    window.__mo.observe(root || document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    window.__rootFound = !!root;
  });
  await page.waitForTimeout(6000);
  const r = await page.evaluate(() => ({ n: window.__pm, root: window.__rootFound, top: Object.entries(window.__samples).sort((a, b) => b[1] - a[1]).slice(0, 8), sets: Object.entries(window.__setCounts).sort((a, b) => b[1] - a[1]).slice(0, 10) }));
  console.log(`\n== ${label} == mutations/6s: ${r.n}  (rootFound=${r.root})`);
  r.top.forEach(([k, v]) => console.log('   mut', v, k));
  r.sets.forEach(([k, v]) => console.log('   set', v, k));
  // ignore the diagnostic heartbeat (antcv-diag-probes-370 writes a 1Hz scroll-
  // context snapshot to sessionStorage while Settings is open — a debug tool, not a
  // production sweep). Flag only real, high-frequency writers.
  const hotKey = r.sets.find(([k, v]) => v > 3 && !/^antcv:resetprobe/.test(k));
  return { n: r.n, hotKey, sets: r.sets };
}

const results = {};
for (const tab of ['Personal', 'Account', 'Layout']) {
  try { await page.getByText(tab, { exact: true }).first().click({ timeout: 2500 }); } catch (e) { console.log(`subtab ${tab} click fail`, e.message); }
  await page.waitForTimeout(1500);
  results[tab] = await measure(tab);
}
console.log('\npage errors:', errs.length ? errs.slice(0, 3) : 0);
const pass = Object.values(results).every(r => r.n <= 8 && !r.hotKey) && errs.length === 0;
console.log(pass ? 'DIAG PASS — all standard settings panels at rest' : 'DIAG FAIL — a panel churns (see hot mut/set keys above)');
process.exitCode = pass ? 0 : 1;
await browser.close(); server.close();
