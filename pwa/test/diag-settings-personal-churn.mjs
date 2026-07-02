/* DIAGNOSTIC — Settings → STANDARD → Personal "buttons appear and disappear in
 * loop" (owner 2026-07-03, demo). Boots the template/demo state, opens the
 * settings panel to Personal, then for ~15s records BUTTON add/remove churn
 * (identity + parent) and antcv event traffic so the looping injector/remover
 * pair can be named. Run: node pwa/test/diag-settings-personal-churn.mjs */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'test', 'out');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
  try {
    let rel = decodeURIComponent((req.url || '/').split('?')[0]);
    // fake DEMO proxy: /config reports demo_mode so __antcvDemoActive() goes true
    if (rel === '/config') { res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); res.end(JSON.stringify({ demo_mode: true, providers: ['anthropic'], proxy_url: '' })); return; }
    if (req.method !== 'GET') { res.writeHead(404, { 'access-control-allow-origin': '*' }); res.end('{}'); return; }
    if (rel === '/') rel = '/index.html';
    const fp = path.join(ROOT, rel); const s = await stat(fp).catch(() => null);
    if (!s || !s.isFile()) { res.writeHead(404, { 'access-control-allow-origin': '*' }); res.end('nf'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' }); res.end(await readFile(fp));
  } catch (e) { res.writeHead(500); res.end(String(e && e.message)); }
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1600 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e && e.message)));
await page.addInitScript(() => {
  try { if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.reject(new Error('sw-off')); } catch (_) {}
  localStorage.setItem('antcv:disable-loading-gate', '1');
  localStorage.setItem('antcv:auth:token', 't'); localStorage.setItem('antcv:auth:email', 'demo@e.com'); localStorage.setItem('antcv:auth:expires_at', '4102444800');
  localStorage.setItem('session', JSON.stringify({ email: 'demo@e.com', ts: 1717000000000 }));
  localStorage.setItem('step', JSON.stringify('editor')); localStorage.setItem('doc', JSON.stringify('cv'));
  localStorage.setItem('personalInfo', JSON.stringify({ name: '[Your Name]', wizardCompleted: true }));
  localStorage.setItem('language', JSON.stringify('en')); localStorage.setItem('wizardCompleted', JSON.stringify(true));
  localStorage.setItem('stylePackage', JSON.stringify('copenhagen-modern'));
  localStorage.setItem('proxyUrl', JSON.stringify(location.origin));   // demo /config source
});
await page.goto(base + '/index.html', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(3500);
// template skeleton (the demo state)
await page.evaluate(() => {
  if (typeof window._antcvBuildTemplateSkeleton === 'function') {
    localStorage.setItem('sections', JSON.stringify({ cv: window._antcvBuildTemplateSkeleton().cv || [], cl: [] }));
  }
});
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(3000);

// open settings -> STANDARD -> Personal (same driving as diag-gate-probe)
await page.evaluate(() => {
  const g = [...document.querySelectorAll('button,[role=button]')].find((b) => /⚙|settings|gear/i.test((b.textContent || '') + (b.getAttribute('aria-label') || '') + (b.getAttribute('title') || '')));
  if (g) g.click();
});
await page.waitForTimeout(1200);
async function clickExact(t) { return page.evaluate((t) => { const m = [...document.querySelectorAll('button,[role=button],[role=tab],summary,div,span,a')].find((e) => e.offsetParent !== null && (e.textContent || '').replace(/\s+/g, ' ').trim() === t); if (m) { m.click(); return true; } return false; }, t); }
await clickExact('STANDARD'); await page.waitForTimeout(400);
await clickExact('Personal'); await page.waitForTimeout(1500);

const setup = await page.evaluate(() => {
  window.__churn = { adds: {}, removes: {}, events: {}, t0: Date.now(), samples: [] };
  const label = (n) => {
    if (!n || n.nodeType !== 1) return null;
    const btns = n.tagName === 'BUTTON' ? [n] : (n.querySelectorAll ? [...n.querySelectorAll('button')] : []);
    return btns.map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40) || (b.getAttribute('aria-label') || '').slice(0, 40)).filter(Boolean);
  };
  const mo = new MutationObserver((muts) => {
    muts.forEach((m) => {
      if (m.type !== 'childList') return;
      [...m.addedNodes].forEach((n) => (label(n) || []).forEach((t) => { window.__churn.adds[t] = (window.__churn.adds[t] || 0) + 1; }));
      [...m.removedNodes].forEach((n) => (label(n) || []).forEach((t) => { window.__churn.removes[t] = (window.__churn.removes[t] || 0) + 1; }));
    });
  });
  mo.observe(document.body, { childList: true, subtree: true });
  ['antcv:sections-updated', 'antcv:item-pages-changed', 'antcv:pi-updated', 'antcv:prefs-updated'].forEach((ev) => {
    window.addEventListener(ev, (e) => {
      const r = ev + '|' + ((e.detail && (e.detail.reason || e.detail.source)) || 'unknown');
      window.__churn.events[r] = (window.__churn.events[r] || 0) + 1;
    });
  });
  // visibility sampling of the four Personal action buttons
  window.__churnTimer = setInterval(() => {
    const names = ['Import profile', 'Review & Edit', 'Export', 'Apply to user profile', 'Undo last'];
    const s = { t: Date.now() - window.__churn.t0 };
    names.forEach((n) => {
      s[n] = [...document.querySelectorAll('button')].some((b) => b.offsetParent !== null && (b.textContent || '').includes(n));
    });
    window.__churn.samples.push(s);
  }, 300);
  const txt = (document.body.innerText || '');
  return { personalOpen: /WRITING STYLE/i.test(txt), hasImport: /Import profile/i.test(txt) };
});
console.log('SETUP', JSON.stringify(setup));
await page.waitForTimeout(15000);
const rep = await page.evaluate(() => {
  clearInterval(window.__churnTimer);
  // compress samples into per-button visibility transitions
  const keys = Object.keys(window.__churn.samples[0] || {}).filter((k) => k !== 't');
  const trans = {};
  keys.forEach((k) => { trans[k] = []; let last; window.__churn.samples.forEach((s) => { if (s[k] !== last) { trans[k].push(s.t + ':' + s[k]); last = s[k]; } }); });
  return { adds: window.__churn.adds, removes: window.__churn.removes, events: window.__churn.events, trans, n: window.__churn.samples.length };
});
console.log('EVENTS-15s:', JSON.stringify(rep.events));
console.log('BUTTON ADDS (top):', JSON.stringify(Object.entries(rep.adds).sort((a, b) => b[1] - a[1]).slice(0, 15)));
console.log('BUTTON REMOVES (top):', JSON.stringify(Object.entries(rep.removes).sort((a, b) => b[1] - a[1]).slice(0, 15)));
console.log('VISIBILITY TRANSITIONS:', JSON.stringify(rep.trans, null, 1));
if (errs.length) console.log('PAGEERRORS:', errs.slice(0, 5).join(' | '));
await page.screenshot({ path: path.join(OUT, 'settings-personal-churn.png') });
await browser.close(); await new Promise((r) => server.close(r));
