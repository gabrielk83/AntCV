/* DIAGNOSTIC — SETTINGS-PERSONAL-STABILIZE-001 (owner 2026-07-04: 'stabilise
 * all the jumps in the personal menu … final, fixed solution … no crashes').
 * Boots the app, opens Settings -> Personal, and measures DOM mutation churn
 * inside the panel over 8s at rest. Pre-fix: 3938 mutations (four
 * non-idempotent sidecar writers re-stamping attributes/text every tick).
 * PASS = <= 5 mutations in 8s and zero page errors.
 * Run: node pwa/test/diag-personal-panel-probe.mjs */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// Portable repo-relative root (this file lives in pwa/test) — a hardcoded desktop
// path 404'd every asset in CI, so the app never booted (DIAG-PROBE-WINPATH-001).
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
  // The editor no longer mounts (blank body → no settings gear) without a meta
  // identity — seed it like diag-panel-button-audit does (DIAG-PROBE-NO-META-001).
  localStorage.setItem('meta', JSON.stringify({ company: 'Diag Co', role: 'Diag Role' }));
  localStorage.setItem('language', JSON.stringify('en')); localStorage.setItem('wizardCompleted', JSON.stringify(true));
});
await page.goto(base + '/index.html', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(5000);
// open Settings + Personal subtab via a direct DOM click. A Playwright locator
// click flaked in headless CI two ways: the ⚙ button carries an emoji
// variation-selector that defeats text= / hasText matching, and a real-mouse
// click times out on the re-rendering toolbar's actionability wait. A node click
// is what historically worked and reliably opens the panel (DIAG-PROBE-NO-META-001).
const opened = await page.evaluate(() => {
  const gear = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes('⚙'));
  if (!gear) return false; gear.click(); return true;
});
if (!opened) console.log('settings open fail: no ⚙ button found');
await page.waitForTimeout(1500);
// click the Personal subtab (leaf element whose exact text is "Personal")
await page.evaluate(() => {
  const el = Array.from(document.querySelectorAll('button,[role="tab"],a,span,div'))
    .find(e => e.children.length === 0 && (e.textContent || '').trim() === 'Personal');
  if (el) (el.closest('button,[role="tab"],a') || el).click();
});
await page.waitForTimeout(1200);
// find the panel container that holds "WRITING STYLE"
const snap = await page.evaluate(() => {
  const all = Array.from(document.querySelectorAll('div,section'));
  let panel = null;
  for (const el of all) {
    const t = el.textContent || '';
    if (t.includes('WRITING STYLE') && t.includes('Review & Edit')) {
      if (!panel || el.textContent.length < panel.textContent.length) panel = el;
    }
  }
  if (!panel) return { found: false };
  const kids = Array.from(panel.children).map((c, i) => ({
    i,
    tag: c.tagName.toLowerCase(),
    order: getComputedStyle(c).order,
    marker: (c.getAttribute('data-antcv') || c.getAttribute('data-antcv-block') || '').slice(0, 40),
    cls: String(c.className || '').slice(0, 40),
    text: (c.textContent || '').trim().slice(0, 70),
  }));
  // churn: watch for 8s
  window.__pm = 0; window.__samples = {};
  const mo = new MutationObserver(m => {
    window.__pm += m.length;
    m.forEach(x => {
      const t = x.target;
      let chain=[]; let n=t.nodeType===1?t:t.parentElement; for(let d=0;n&&d<4;d++,n=n.parentElement){chain.push(n.tagName+(n.dataset?Object.keys(n.dataset).slice(0,2).join(','):''));} const added=(x.addedNodes&&x.addedNodes[0])?String(x.addedNodes[0].textContent||x.addedNodes[0].nodeName).slice(0,40):''; const key = x.type + '|' + (x.attributeName || '') + '|' + chain.join('>') + '|' + added;
      window.__samples[key] = (window.__samples[key] || 0) + 1;
    });
  });
  mo.observe(panel, { subtree: true, childList: true, attributes: true });
  window.__panelSel = true;
  return { found: true, kids, display: getComputedStyle(panel).display };
});
console.log(snap.kids ? snap.kids.map(k=>k.i+" order="+k.order+" "+k.tag+" :: "+k.text.slice(0,55)).join(String.fromCharCode(10)) : JSON.stringify(snap));
if (!snap.found) { console.log('DIAG FAIL — Personal panel never opened (settings gear / subtab not reached)'); process.exitCode = 1; await browser.close(); server.close(); process.exit(1); }
await page.waitForTimeout(8000);
const churn = await page.evaluate(() => ({ n: window.__pm || 0, top: Object.entries(window.__samples || {}).sort((a,b)=>b[1]-a[1]).slice(0,14) }));
console.log('mutations over 8s:', churn.n); churn.top.forEach(([k,v])=>console.log('  ', v, k)); console.log('page errors:', errs.length ? errs.slice(0,3) : 0); const pass = churn.n <= 5 && errs.length === 0; console.log(pass ? 'DIAG PASS — Personal panel is still at rest' : 'DIAG FAIL'); process.exitCode = pass ? 0 : 1;
await browser.close(); server.close();
