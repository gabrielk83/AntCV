/* DIAGNOSTIC — demo/template alignment "jumping" (owner 2026-07-03).
 * Owner report: in demo mode the CORE COMPETENCIES table headers and the
 * TOOLS & METHODS / REGULATORY CONTEXT content jump between justified,
 * centered, and left aligned. Table headers should rest centered; content
 * justified.
 *
 * Repro: boot the real PWA with the TEMPLATE SKELETON sections (the demo /
 * fresh-account state in the owner's screenshot), then for ~20s record:
 *   1. antcv:sections-updated churn (count + reasons)
 *   2. section TYPE flips for tools/regulatory (converter loops)
 *   3. every text-align style mutation on the affected elements (old -> new)
 * Run: node pwa/test/diag-align-flap.mjs
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'test', 'out');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.map': 'application/json' };
const BLOCK = new Set(String(process.env.BLOCK || '').split(',').map(s => s.trim()).filter(Boolean));
const server = http.createServer(async (req, res) => {
  try { let rel = decodeURIComponent((req.url || '/').split('?')[0]); if (rel === '/') rel = '/index.html'; const fp = path.join(ROOT, rel); if (BLOCK.has(path.basename(fp))) { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end('/* blocked by diag */'); return; } const s = await stat(fp).catch(() => null); if (!s || !s.isFile()) { res.writeHead(404); res.end('nf'); return; } res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' }); res.end(await readFile(fp)); } catch (e) { res.writeHead(500); res.end(String(e && e.message)); }
});
await new Promise(r => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();

function initScript(sections) {
  return [({ sections }) => {
    try { if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.reject(new Error('sw-off')); } catch (_) {}
    localStorage.setItem('antcv:disable-loading-gate', '1');
    localStorage.setItem('antcv:auth:token', 't'); localStorage.setItem('antcv:auth:email', 'demo@e.com'); localStorage.setItem('antcv:auth:expires_at', '4102444800');
    localStorage.setItem('session', JSON.stringify({ email: 'demo@e.com', ts: 1717000000000 }));
    localStorage.setItem('step', JSON.stringify('editor')); localStorage.setItem('doc', JSON.stringify('cv'));
    if (sections) localStorage.setItem('sections', JSON.stringify(sections));
    localStorage.setItem('personalInfo', JSON.stringify({ name: '[Your Name]', wizardCompleted: true }));
    localStorage.setItem('language', JSON.stringify('en')); localStorage.setItem('wizardCompleted', JSON.stringify(true));
    localStorage.setItem('stylePackage', JSON.stringify('copenhagen-modern'));
  }, { sections }];
}

// Phase 1: boot with no sections to extract the app's own template skeleton.
let page = await browser.newPage({ viewport: { width: 1400, height: 1400 } });
await page.addInitScript(...initScript(null));
await page.goto(base + '/index.html', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(4000);
const skeleton = await page.evaluate(() => {
  if (typeof window._antcvBuildTemplateSkeleton === 'function') {
    const t = window._antcvBuildTemplateSkeleton();
    return { cv: t.cv || [], cl: [] };
  }
  return null;
});
await page.close();
if (!skeleton) { console.log('NO SKELETON BUILDER — falling back to stored sections after floor'); }

// Phase 2: boot WITH the template skeleton and observe.
page = await browser.newPage({ viewport: { width: 1400, height: 1400 } });
const errs = []; page.on('pageerror', e => errs.push(String(e && e.message)));
await page.addInitScript(...initScript(skeleton));
await page.goto(base + '/index.html', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(2500);

const setup = await page.evaluate(() => {
  window.__flap = { su: { n: 0, reasons: {} }, aligns: [], types: [], t0: Date.now() };
  window.addEventListener('antcv:sections-updated', (e) => {
    window.__flap.su.n++;
    const r = (e.detail && (e.detail.reason || e.detail.source)) || 'unknown';
    window.__flap.su.reasons[r] = (window.__flap.su.reasons[r] || 0) + 1;
  });
  const mo = new MutationObserver(muts => {
    muts.forEach(m => {
      if (m.type !== 'attributes' || m.attributeName !== 'style') return;
      const el = m.target;
      const oldA = /text-align:\s*([a-z]+)/.exec(m.oldValue || '');
      const newA = /text-align:\s*([a-z]+)/.exec(el.getAttribute('style') || '');
      const o = oldA ? oldA[1] : '(none)', n = newA ? newA[1] : '(none)';
      if (o === n) return;
      const sidEl = el.closest && el.closest('[data-sid]');
      const sid = sidEl ? sidEl.getAttribute('data-sid') : '';
      const txt = (el.textContent || '').replace(/\s+/g, ' ').slice(0, 32);
      if (!/core_comp|tools|regulatory/.test(sid) && !/Focus Area|Strategic|Tools:|Methods:|Standards:/i.test(txt)) return;
      window.__flap.aligns.push({ t: Date.now() - window.__flap.t0, sid, tag: el.tagName, o, n, txt });
      if (window.__flap.aligns.length > 400) window.__flap.aligns.shift();
    });
  });
  mo.observe(document.body, { attributes: true, attributeFilter: ['style'], attributeOldValue: true, subtree: true });
  // poll section types for converter loops
  window.__flapTypes = setInterval(() => {
    try {
      const secs = JSON.parse(localStorage.getItem('sections') || '{}');
      const t = {};
      (secs.cv || []).forEach(s => { if (s && /^(tools|regulatory|core_comp)$/.test(s.id)) t[s.id] = s.type; });
      const last = window.__flap.types[window.__flap.types.length - 1];
      const sig = JSON.stringify(t);
      if (!last || last.sig !== sig) window.__flap.types.push({ t: Date.now() - window.__flap.t0, sig });
    } catch (_) {}
  }, 400);
  return {
    sids: Array.from(document.querySelectorAll('[data-sid]')).map(e => e.getAttribute('data-sid')),
    hasFocusArea: /Focus Area/i.test(document.body.innerText),
    hasTools: /TOOLS & METHODS/i.test(document.body.innerText),
  };
});
console.log('SETUP', JSON.stringify(setup));

await page.waitForTimeout(20000);
const report = await page.evaluate(() => {
  clearInterval(window.__flapTypes);
  // resting state of the interesting elements
  const rest = [];
  const tbl = Array.from(document.querySelectorAll('table')).find(t => /focus area/i.test(t.textContent));
  if (tbl) {
    const rows = Array.from(tbl.querySelectorAll('tr'));
    rows.slice(0, 3).forEach((r, i) => rest.push({ what: 'tableRow' + i, a: getComputedStyle(r).textAlign, inline: r.style.textAlign, txt: (r.textContent || '').slice(0, 30) }));
  }
  ['tools', 'regulatory'].forEach(sid => {
    const host = document.querySelector('[data-sid="' + sid + '"]');
    if (host) Array.from(host.querySelectorAll('[data-antcv-row-path]')).slice(0, 3).forEach((el, i) =>
      rest.push({ what: sid + i, a: getComputedStyle(el).textAlign, inline: el.style.textAlign, txt: (el.textContent || '').slice(0, 30) }));
  });
  return { su: window.__flap.su, alignFlips: window.__flap.aligns, typeChanges: window.__flap.types, rest };
});
console.log('SU-20s:', JSON.stringify(report.su));
console.log('TYPE-CHANGES:', JSON.stringify(report.typeChanges));
console.log('ALIGN-FLIPS (' + report.alignFlips.length + '):');
report.alignFlips.slice(0, 80).forEach(f => console.log('  ', JSON.stringify(f)));
console.log('RESTING:', JSON.stringify(report.rest, null, 1));
if (errs.length) console.log('PAGEERRORS:', errs.slice(0, 5).join(' | '));
await page.screenshot({ path: path.join(OUT, 'align-flap.png') });
await browser.close(); await new Promise(r => server.close(r));
