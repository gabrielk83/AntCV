/* DIAGNOSTIC — RESIDUE-DEDUP-LOOP-001 (owner live "regulatory is very jumpy"):
 * real-browser boot with the Trackman-shaped fixture that triggered the
 * tools-corecomp-dedup <-> tools-hidden-residue write storm (43 writes/18s in
 * the owner's tab). PASS = sections writes stay bounded (<=4 in 15s) and the
 * "Hidden - <category>" residue row survives.
 * Run: node pwa/test/diag-residue-dedup-loop.mjs
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
    { id: 'core_comp', title: 'CORE COMPETENCIES', loc: 'main', on: true, type: 'table', rows: [
      ['Focus Area', 'Strategic Expertise'],
      ['Optics, photonics & sensing', 'Electro-optics platforms'],
      ['Validation', 'DV/PV, FAT/SAT'],
    ] },
    { id: 'tools', title: 'TOOLS & METHODS', loc: 'sidebar', on: true, type: 'rich_block', items: [
      { grp: true, t: 'Tools', bullets: [] },
      { b: 'Software', t: 'Jira, Git', bullets: [] },
      { b: 'Hidden - Optics, photonics & sensing', t: 'optical metrology, machine vision', bullets: [] },
    ] },
    { id: 'regulatory', title: 'REGULATORY CONTEXT', loc: 'sidebar', on: true, type: 'labeled_list', items: [
      { l: 'ASPICE', v: 'Requirements, traceability' },
    ] },
  ],
  cl: [],
};
const PI = { name: 'Diag User', wizardCompleted: true, tools: [
  { l: 'Software', v: 'Jira, Git' },
  { l: 'Optics, photonics & sensing', v: 'optical metrology, machine vision' },
] };

const browser = await chromium.launch();
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
  // count only post-boot writes: arm at +4s
  setTimeout(() => { localStorage.setItem = (k, v) => { if (k === 'sections') window.__wr.push({ t: Date.now(), stack: (new Error()).stack.split('\n').slice(2, 5).map(s => s.trim().replace(/http:\/\/[^/]+\//g, '')).join(' | ') }); return _set(k, v); }; }, 4000);
}, { sections: SECTIONS, pi: PI });
await page.goto(base + '/index.html', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(19000); // 4s boot grace + 15s observation

const out = await page.evaluate(() => {
  const secs = JSON.parse(localStorage.getItem('sections'));
  const tools = secs.cv.find(s => s.id === 'tools');
  const bySrc = {};
  window.__ev.forEach(s => { bySrc[s] = (bySrc[s] || 0) + 1; });
  return {
    writes: window.__wr.length,
    stacks: window.__wr.slice(-6).map(w => w.stack.slice(0, 200)),
    eventCounts: bySrc,
    residueRows: tools.items.filter(it => /^Hidden - /.test(String(it.b || it.l || ''))).length,
    toolsRows: tools.items.length,
  };
});
console.log('post-boot sections writes in 15s:', out.writes, '| residue rows:', out.residueRows, '| tools rows:', out.toolsRows, '| page errors:', errs.length);
console.log('event sources:', JSON.stringify(out.eventCounts));
console.log('write stacks:'); out.stacks.forEach(s => console.log('  -', s));
const pass = out.writes <= 4 && out.residueRows === 1 && errs.length === 0;
console.log(pass ? 'DIAG PASS — the write storm is dead, residue row stable' : 'DIAG FAIL');
await browser.close();
server.close();
process.exit(pass ? 0 : 1);
