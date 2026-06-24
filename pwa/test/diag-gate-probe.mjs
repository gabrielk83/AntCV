/* PROBE — what does the app render with seeded auth + loading-gate disabled?
 * Serves the real pwa over http, seeds session, disables the loading overlay and
 * SW, boots, and reports for 14s whether the editor (.antcv-preview-paper),
 * topbar, settings, or a sign-in / account-mode screen appears.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'test', 'out');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.map': 'application/json' };
const server = http.createServer(async (req, res) => {
  try { let rel = decodeURIComponent((req.url || '/').split('?')[0]); if (rel === '/') rel = '/index.html'; const fp = path.join(ROOT, rel); const s = await stat(fp).catch(() => null); if (!s || !s.isFile()) { res.writeHead(404); res.end('nf'); return; } res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' }); res.end(await readFile(fp)); } catch (e) { res.writeHead(500); res.end(String(e && e.message)); }
});
await new Promise(r => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
await mkdir(OUT, { recursive: true });

const SECTIONS = { cv: [
  { id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'IT expert.' },
  { id: 'experience', title: 'EXPERIENCE', loc: 'main', on: true, type: 'experience', roles: [{ title: 'PdM', company: 'Acme', years: '2020-22', bullets: ['Did a thing'] }] },
  { id: 'languages', title: 'LANGUAGES', loc: 'sidebar', on: true, type: 'text', content: 'EN, DA' },
], cl: [] };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
const logs = []; page.on('console', m => logs.push(m.type() + ':' + m.text().slice(0, 120)));
const errs = []; page.on('pageerror', e => errs.push(String(e && e.message)));
await page.addInitScript(({ sections }) => {
  try { if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.reject(new Error('sw-off')); } catch (_) {}
  localStorage.setItem('antcv:disable-loading-gate', '1');
  localStorage.setItem('antcv:auth:token', 't'); localStorage.setItem('antcv:auth:email', 'g@e.com'); localStorage.setItem('antcv:auth:expires_at', '4102444800');
  localStorage.setItem('session', JSON.stringify({ email: 'g@e.com', ts: 1717000000000 }));
  localStorage.setItem('step', JSON.stringify('editor')); localStorage.setItem('doc', JSON.stringify('cv'));
  localStorage.setItem('sections', JSON.stringify(sections));
  localStorage.setItem('personalInfo', JSON.stringify({ name: 'Gabriel', wizardCompleted: true, experience: [{ title: 'PdM', company: 'Acme', years: '2020-22', bullets: ['x'] }] }));
  localStorage.setItem('language', JSON.stringify('en')); localStorage.setItem('wizardCompleted', JSON.stringify(true));
  localStorage.setItem('stylePackage', JSON.stringify('copenhagen-modern'));
}, { sections: SECTIONS });

await page.goto(base + '/index.html', { waitUntil: 'load', timeout: 30000 });
for (let i = 0; i < 7; i++) {
  await page.waitForTimeout(2000);
  const snap = await page.evaluate(() => {
    const has = (s) => !!document.querySelector(s);
    const txt = (document.body.textContent || '').replace(/\s+/g, ' ').trim();
    const overlay = document.getElementById('antcv-login-loading-overlay');
    return {
      previewPaper: has('.antcv-preview-paper'), topbar: has('.antcv-topbar'),
      overlayUp: !!(overlay && overlay.offsetParent !== null),
      signInWord: /Sign in|SIGN IN|Continue with/.test(txt),
      accountMode: /ACCOUNT MODE/.test(txt),
      gear: [...document.querySelectorAll('button,[role=button]')].some(b => /⚙/.test((b.textContent || '') + (b.getAttribute('aria-label') || '') + (b.getAttribute('title') || ''))),
      bodyLen: txt.length, head: txt.slice(0, 90),
    };
  });
  console.log(`t+${(i + 1) * 2}s`, JSON.stringify(snap));
  if (snap.previewPaper) break;
}
await page.screenshot({ path: path.join(OUT, 'gate-probe.png') });

// ---- drive settings open ----
const gearInfo = await page.evaluate(() => {
  const cand = [...document.querySelectorAll('button,[role=button]')].map(b => ({
    t: (b.textContent || '').trim().slice(0, 20), aria: b.getAttribute('aria-label') || '', title: b.getAttribute('title') || '',
    r: b.getBoundingClientRect(),
  })).filter(b => /⚙|settings|gear/i.test(b.t + ' ' + b.aria + ' ' + b.title));
  return cand.map(c => ({ t: c.t, aria: c.aria, title: c.title, x: Math.round(c.r.x), y: Math.round(c.r.y) }));
});
console.log('GEAR CANDIDATES:', JSON.stringify(gearInfo));
await page.evaluate(() => {
  const g = [...document.querySelectorAll('button,[role=button]')].find(b => /⚙|settings|gear/i.test((b.textContent || '') + (b.getAttribute('aria-label') || '') + (b.getAttribute('title') || '')));
  if (g) g.click();
});
await page.waitForTimeout(1400);
const afterGear = await page.evaluate(() => {
  const txt = (document.body.textContent || '').replace(/\s+/g, ' ');
  const tabBtns = [...document.querySelectorAll('button,[role=button],[role=tab]')].map(b => (b.textContent || '').trim()).filter(t => t && t.length < 22 && /standard|personal|user|layout|account|tone|style/i.test(t));
  return { standard: /STANDARD/.test(txt), personalWord: /Personal/.test(txt), wsp: !!document.getElementById('antcv-react-writing-style-picker'), langAnchor: !!document.getElementById('antcv-react-personal-languages'), tabBtns: [...new Set(tabBtns)].slice(0, 20) };
});
console.log('AFTER GEAR:', JSON.stringify(afterGear));
// try clicking STANDARD then Personal
async function clickExact(t) { return page.evaluate((t) => { const m = [...document.querySelectorAll('button,[role=button],[role=tab],summary,div,span,a')].find(e => e.offsetParent !== null && (e.textContent || '').replace(/\s+/g, ' ').trim() === t); if (m) { m.click(); return true; } return false; }, t); }
const cs = await clickExact('STANDARD'); await page.waitForTimeout(500);
const cp = await clickExact('Personal'); await page.waitForTimeout(1800);
const personal = await page.evaluate(() => ({
  wsp: !!document.getElementById('antcv-react-writing-style-picker'),
  langAnchor: !!document.getElementById('antcv-react-personal-languages'),
  launcher: !!document.querySelector('[data-antcv-data-export-ui="launcher"]'),
  reviewBtn: !!document.querySelector('[data-antcv-data-export-ui="review"]'),
}));
console.log('clickStandard:', cs, 'clickPersonal:', cp);
console.log('PERSONAL STATE:', JSON.stringify(personal));
await page.screenshot({ path: path.join(OUT, 'gate-probe-personal.png'), fullPage: true });
console.log('--- console (first 10) ---'); logs.slice(0, 10).forEach(l => console.log('  ' + l));
if (errs.length) console.log('--- pageerrors ---', errs.slice(0, 4).join(' | '));
await browser.close(); await new Promise(r => server.close(r));
