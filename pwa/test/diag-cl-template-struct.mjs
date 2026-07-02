/* DIAGNOSTIC — TEMPLATE-STRUCT-DEFAULT-001 (owner 2026-07-03).
 * Boot the real PWA with NO toneRegister and EMPTY cl sections (the fresh/demo
 * state) on doc='cl'; the me() floor must provide the PROPER docx-matching CL
 * skeleton, not the legacy pre-Nordic shape the owner screenshotted.
 * Run: node pwa/test/diag-cl-template-struct.mjs */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
  try { let rel = decodeURIComponent((req.url || '/').split('?')[0]); if (rel === '/') rel = '/index.html'; const fp = path.join(ROOT, rel); const s = await stat(fp).catch(() => null); if (!s || !s.isFile()) { res.writeHead(404); res.end('nf'); return; } res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' }); res.end(await readFile(fp)); } catch (e) { res.writeHead(500); res.end(String(e && e.message)); }
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1600 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e && e.message)));
await page.addInitScript(() => {
  try { if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.reject(new Error('sw-off')); } catch (_) {}
  localStorage.setItem('antcv:disable-loading-gate', '1');
  localStorage.setItem('antcv:auth:token', 't'); localStorage.setItem('antcv:auth:email', 'fresh@e.com'); localStorage.setItem('antcv:auth:expires_at', '4102444800');
  localStorage.setItem('session', JSON.stringify({ email: 'fresh@e.com', ts: 1717000000000 }));
  localStorage.setItem('step', JSON.stringify('editor')); localStorage.setItem('doc', JSON.stringify('cl'));
  localStorage.setItem('sections', JSON.stringify({ cv: [], cl: [] }));   // empty -> me() floor provides the skeleton
  localStorage.setItem('personalInfo', JSON.stringify({ name: '[Your Name]', wizardCompleted: true }));
  localStorage.setItem('language', JSON.stringify('en')); localStorage.setItem('wizardCompleted', JSON.stringify(true));
  // NO toneRegister — the exact fresh/demo condition that used to fall to legacy
});
await page.goto(base + '/index.html', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(6000);

const snap = await page.evaluate(() => {
  const txt = (document.body.innerText || '').replace(/\s+/g, ' ');
  const secs = (() => { try { return JSON.parse(localStorage.getItem('sections') || '{}'); } catch (_) { return {}; } })();
  const cl = Array.isArray(secs.cl) ? secs.cl : [];
  return {
    order: cl.map((s) => s && s.id).join(','),
    bringType: (cl.find((s) => s && s.id === 'bring') || {}).type,
    contributeType: (cl.find((s) => s && s.id === 'contribute') || {}).type,
    properGreeting: txt.includes('Dear [Hiring Team / Name],'),
    hasApplyingLine: txt.includes('I am applying for [Role title] at [Company]'),
    hasWhy: txt.includes('Why this company and role'),
    hasWhoLead: txt.includes('Who I am:') || txt.includes('Who I am'),
    hasNeedRows: txt.includes('[Need from JD/company'),
    hasContributeLead: txt.includes('loses time, clarity, trust, or traceability'),
    hasGoal: /Goal:?\s*\[Outcome based on the role\/company needs/.test(txt),
    legacyGreeting: txt.includes('Dear [Hiring Manager],'),
    legacyFocusRows: txt.includes('[Focus area 1]') && txt.includes('[Strategic expertise'),
    legacySpecificThing: txt.includes('[Specific thing you would do 1]'),
  };
});
console.log(JSON.stringify(snap, null, 1));
if (errs.length) console.log('PAGEERRORS:', errs.slice(0, 4).join(' | '));
const ok = snap.properGreeting && snap.hasApplyingLine && snap.hasWhy && snap.hasNeedRows &&
  snap.hasContributeLead && snap.hasGoal && snap.bringType === 'rich_block' && snap.contributeType === 'rich_block' &&
  !snap.legacyGreeting && !snap.legacyFocusRows && !snap.legacySpecificThing && errs.length === 0;
console.log(ok ? 'CL-TEMPLATE-STRUCT OK' : 'CL-TEMPLATE-STRUCT FAIL');
await browser.close(); await new Promise((r) => server.close(r));
process.exit(ok ? 0 : 1);
