/* DIAGNOSTIC — Settings → STANDARD → Personal freeze / button loop (owner 2026-07-03).
 * Live evidence: opening the panel in the owner's real session HARD-FROZE the tab
 * (45s Runtime.evaluate timeouts) — a synchronous loop, most likely a
 * MutationObserver microtask ping-pong (two observers mutating in-callback).
 * Repro: boot with the FULL synthetic Anita kernel (docs/personas/anita) +
 * template sections + demo /config, open the panel, and run a CDP CPU profile
 * around the trigger. The V8 inspector can interrupt a spinning page, so the
 * profile names the looping functions even when the page freezes.
 * Run: node pwa/test/diag-settings-personal-freeze.mjs */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const anita = JSON.parse(await readFile(path.join(ROOT, '..', 'docs', 'personas', 'anita', 'personalInfo.json'), 'utf8'));
const BLOCK = new Set(String(process.env.BLOCK || '').split(',').map((s) => s.trim()).filter(Boolean));
const server = http.createServer(async (req, res) => {
  try {
    let rel = decodeURIComponent((req.url || '/').split('?')[0]);
    if (BLOCK.has(path.basename(rel))) { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end('/* blocked by diag */'); return; }
    if (rel === '/config') { res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); res.end(JSON.stringify({ demo_mode: true, providers: ['anthropic'] })); return; }
    if (req.method !== 'GET') { res.writeHead(404, { 'access-control-allow-origin': '*' }); res.end('{}'); return; }
    if (rel === '/') rel = '/index.html';
    const fp = path.join(ROOT, rel); const s = await stat(fp).catch(() => null);
    if (!s || !s.isFile()) { res.writeHead(404, { 'access-control-allow-origin': '*' }); res.end('nf'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' }); res.end(await readFile(fp));
  } catch (e) { res.writeHead(500); res.end(String(e && e.message)); }
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1600 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e && e.message)));
await page.addInitScript((pi) => {
  try { if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.reject(new Error('sw-off')); } catch (_) {}
  localStorage.setItem('antcv:disable-loading-gate', '1');
  localStorage.setItem('antcv:auth:token', 't'); localStorage.setItem('antcv:auth:email', 'anita@e.com'); localStorage.setItem('antcv:auth:expires_at', '4102444800');
  localStorage.setItem('session', JSON.stringify({ email: 'anita@e.com', ts: 1717000000000 }));
  localStorage.setItem('step', JSON.stringify('editor')); localStorage.setItem('doc', JSON.stringify('cv'));
  localStorage.setItem('personalInfo', JSON.stringify(pi));
  localStorage.setItem('language', JSON.stringify('en')); localStorage.setItem('wizardCompleted', JSON.stringify(true));
  localStorage.setItem('stylePackage', JSON.stringify('copenhagen-modern'));
  localStorage.setItem('toneRegister', JSON.stringify('nordic-minimal'));
  localStorage.setItem('proxyUrl', JSON.stringify(location.origin));
  localStorage.setItem('settingsTab', JSON.stringify('standard'));
  localStorage.setItem('settingsSubTab', JSON.stringify('personal'));
  localStorage.setItem('antcv:settings:languages-expanded', '1');
}, anita.personalInfo || anita);
await page.goto(base + '/index.html', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(3500);
await page.evaluate(() => {
  if (typeof window._antcvBuildTemplateSkeleton === 'function') {
    localStorage.setItem('sections', JSON.stringify({ cv: window._antcvBuildTemplateSkeleton().cv || [], cl: [] }));
  }
});
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(3000);

const cdp = await page.context().newCDPSession(page);
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 250 });
await cdp.send('Profiler.start');

// open gear -> STANDARD -> Personal
await page.evaluate(() => {
  const g = [...document.querySelectorAll('button,[role=button]')].find((b) => /⚙|settings|gear/i.test((b.textContent || '') + (b.getAttribute('aria-label') || '') + (b.getAttribute('title') || '')));
  if (g) g.click();
}).catch(() => {});
await page.waitForTimeout(800);
const clickExact = (t) => page.evaluate((t) => { const m = [...document.querySelectorAll('button,[role=button],[role=tab],summary,div,span,a')].find((e) => e.offsetParent !== null && (e.textContent || '').replace(/\s+/g, ' ').trim() === t); if (m) { m.click(); return true; } return false; }, t).catch(() => 'frozen');
console.log('STANDARD:', await clickExact('STANDARD'));
await page.waitForTimeout(400);
console.log('Personal:', await clickExact('Personal'));

// record residual mutations (who keeps churning?)
await page.evaluate(() => {
  window.__muts = {};
  const sig = (n) => {
    if (!n || n.nodeType !== 1) return n && n.nodeType === 3 ? '#text' : '?';
    const e = n;
    return e.tagName + (e.id ? '#' + e.id : '') + [...e.attributes].filter((a) => a.name.startsWith('data-antcv')).map((a) => '[' + a.name + ']').join('');
  };
  new MutationObserver((ms) => ms.forEach((m) => {
    const k = m.type + '|' + sig(m.target) + (m.attributeName ? '|' + m.attributeName : '');
    window.__muts[k] = (window.__muts[k] || 0) + 1;
  })).observe(document.body, { childList: true, subtree: true, attributes: true, attributeOldValue: false });
}).catch(() => {});

// probe responsiveness for 24s. A HARD loop (the owner’s original freeze) never
// recovers; heavy-but-recovering churn answers most probes. FROZEN = the page
// missed a MAJORITY of probes AND the final probe (no recovery).
let misses = 0, lastAlive = false;
for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(3000);
  const alive = await Promise.race([
    page.evaluate(() => 1).catch(() => -1),
    new Promise((r) => setTimeout(() => r('timeout'), 3000)),
  ]);
  console.log('t+' + (i + 1) * 3 + 's alive:', alive);
  if (alive === 'timeout') misses++; lastAlive = alive === 1;
}
const frozen = misses >= 5 && !lastAlive;
console.log('probe misses:', misses + '/8', '| recovered at end:', lastAlive);

const { profile } = await cdp.send('Profiler.stop');
// aggregate self time per callFrame, attributing NATIVE frames to their nearest
// JS ancestor so querySelector storms name their caller
const byNode = new Map(profile.nodes.map((n) => [n.id, n]));
const parent = new Map();
profile.nodes.forEach((n) => (n.children || []).forEach((c) => parent.set(c, n.id)));
const self = new Map();
(profile.samples || []).forEach((id, i) => {
  const dt = (profile.timeDeltas && profile.timeDeltas[i]) || 0;
  let n = byNode.get(id); if (!n) return;
  let hops = 0;
  while (n && (!n.callFrame.url || n.callFrame.url.startsWith('native')) && hops < 30) { const p = parent.get(n.id); n = p ? byNode.get(p) : null; hops++; }
  const f = (n || byNode.get(id)).callFrame;
  const key = (f.url ? f.url.split('/').pop().split('?')[0] : '(native)') + ' :: ' + (f.functionName || '(anon)') + ' @' + f.lineNumber;
  self.set(key, (self.get(key) || 0) + dt);
});
const total = [...self.values()].reduce((a, b) => a + b, 0);
console.log('FROZEN:', frozen, '| profile total ms:', Math.round(total / 1000));
[...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([k, v]) => console.log('  ', Math.round(v / 1000) + 'ms', (100 * v / total).toFixed(1) + '%', k));
const muts = await page.evaluate(() => window.__muts).catch(() => null);
if (muts) {
  console.log('RESIDUAL MUTATIONS (top 15):');
  Object.entries(muts).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([k, v]) => console.log('  ', v, k));
}
if (errs.length) console.log('PAGEERRORS:', errs.slice(0, 5).join(' | '));
await browser.close(); await new Promise((r) => server.close(r));
