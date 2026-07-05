/* DIAGNOSTIC — owner: "sidebar littel dancing keeps happening. could you stop it?"
 * (reported right after REG-GROUP-FOLD-NAMED-001 shipped). Same measurement
 * pattern as diag-residue-dedup-loop.mjs (RESIDUE-DEDUP-LOOP-001): real-browser
 * boot with a REGULATORY CONTEXT section shaped like the owner's live CV — BOTH
 * "Environmental & Durability" and "Environmental, Durability & Materials
 * Compliance" groups present — then measure post-boot `sections` writes and
 * event-source counts over 15s. PASS = writes stay bounded (a fixed point is
 * reached quickly) and the two groups converge to exactly ONE, not an
 * oscillating fight between antcv-dup-group-merge.js's new named fold and any
 * other sidecar that might reintroduce the split (restore/normalize/residue).
 * Run: node pwa/test/diag-reg-fold-dance.mjs
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer(async (req, res) => {
  try { let rel = decodeURIComponent((req.url || '/').split('?')[0]); if (rel === '/') rel = '/index.html'; const fp = path.join(ROOT, rel); const s = await stat(fp).catch(() => null); if (!s || !s.isFile()) { res.writeHead(404); res.end('nf'); return; } res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' }); res.end(await readFile(fp)); } catch (e) { res.writeHead(500); res.end(String(e && e.message)); }
});
await new Promise(r => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

const SECTIONS = {
  cv: [
    { id: 'regulatory', title: 'REGULATORY CONTEXT', loc: 'sidebar', on: true, type: 'rich_block', items: [
      { grp: true, t: 'Environmental & Durability' },
      { b: 'ISO 14524', t: 'Opto-electronic conversion function' },
      { b: 'STANAG 4694', t: 'Weapon-mounted sight interface context' },
      { b: 'STANAG 4355', t: 'Ballistics / fire-control context' },
      { b: 'DIN EN 61010', t: 'Electrical safety, lab & measurement equipment' },
      { b: 'IEC 60529', t: 'Ingress protection' },
      { grp: true, t: 'Environmental, Durability & Materials Compliance' },
      { b: 'MIL-STD-810G', t: 'Environmental qualification, including Method 514 vibration' },
      { b: 'ISO 16750', t: 'Automotive environmental conditions and testing' },
      { b: 'IEC 60068', t: 'Environmental testing' },
      { b: 'RoHS', t: 'Restricted substances' },
      { b: 'REACH', t: 'Chemical substances compliance' },
    ] },
  ],
  cl: [],
};
const PI = { name: 'Diag User', wizardCompleted: true };

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const errs = []; page.on('pageerror', e => errs.push(String(e && e.message)));
await page.addInitScript(({ sections, pi }) => {
  try { if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.reject(new Error('sw-off')); } catch (_) {}
  localStorage.setItem('antcv:disable-loading-gate', '1');
  localStorage.setItem('antcv:auth:token', 't'); localStorage.setItem('antcv:auth:email', 'demo@e.com'); localStorage.setItem('antcv:auth:expires_at', '4102444800');
  localStorage.setItem('session', JSON.stringify({ email: 'demo@e.com', ts: 1717000000000 }));
  localStorage.setItem('step', JSON.stringify('editor')); localStorage.setItem('doc', JSON.stringify('cv'));
  localStorage.setItem('sections', JSON.stringify(sections));
  localStorage.setItem('personalInfo', JSON.stringify(pi));
  localStorage.setItem('meta', JSON.stringify({ company: 'Trackman A/S', role: 'Project Manager, Hardware' }));
  localStorage.setItem('language', JSON.stringify('en')); localStorage.setItem('wizardCompleted', JSON.stringify(true));
  window.__wr = []; window.__ev = [];
  const _set = localStorage.setItem.bind(localStorage);
  window.addEventListener('antcv:sections-updated', (e) => { window.__ev.push((e.detail && (e.detail.source || e.detail.reason)) || '?'); });
  // count only post-boot writes: arm at +4s (same grace window as the RESIDUE-DEDUP-LOOP-001 probe)
  setTimeout(() => { localStorage.setItem = (k, v) => { if (k === 'sections') window.__wr.push({ t: Date.now(), stack: (new Error()).stack.split('\n').slice(2, 5).map(s => s.trim().replace(/http:\/\/[^/]+\//g, '')).join(' | ') }); return _set(k, v); }; }, 4000);
}, { sections: SECTIONS, pi: PI });
await page.goto(base + '/index.html', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(19000); // 4s boot grace + 15s observation

const out = await page.evaluate(() => {
  const secs = JSON.parse(localStorage.getItem('sections'));
  const reg = secs.cv.find(s => s.id === 'regulatory');
  const groups = reg.items.filter(it => it && it.grp).map(it => it.t);
  const bySrc = {};
  window.__ev.forEach(s => { bySrc[s] = (bySrc[s] || 0) + 1; });
  return {
    writes: window.__wr.length,
    stacks: window.__wr.slice(-8).map(w => w.stack.slice(0, 200)),
    eventCounts: bySrc,
    groups,
    totalRows: reg.items.filter(it => !it.grp).length,
    bodies: reg.items.filter(it => !it.grp).map(it => it.b),
  };
});
console.log('post-boot sections writes in 15s:', out.writes, '| groups:', JSON.stringify(out.groups), '| total rows:', out.totalRows, '| page errors:', errs.length);
console.log('rows:', JSON.stringify(out.bodies));
console.log('page errors:', errs);
console.log('event sources:', JSON.stringify(out.eventCounts));
console.log('write stacks:'); out.stacks.forEach(s => console.log('  -', s));
// This sandbox's egress policy blocks the unpkg.com CDN this app loads React/ReactDOM from
// (documented elsewhere in this repo's diag harnesses), so React never mounts here and the
// PURE-localStorage sidecars (sections-normalize-415, dup-group-merge, etc.) are all this
// harness can actually exercise — which is exactly what this diagnostic targets. Filter only
// that specific, expected pair of errors; any OTHER page error still fails the run.
const unexpectedErrs = errs.filter(e => !/React(DOM)? is not defined/.test(e));
const pass = out.writes <= 4 && out.groups.length === 1 && out.groups[0] === 'Environmental & Durability' && out.totalRows === 10 && unexpectedErrs.length === 0;
console.log(pass ? 'DIAG PASS — converges to one group, bounded writes, no dancing' : 'DIAG FAIL');
await browser.close();
server.close();
process.exit(pass ? 0 : 1);
