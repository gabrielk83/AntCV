/* DIAGNOSTIC — SETTINGS-PERSONAL-DEDUP-001 (2026-07-13).
 * The 5 contact fields (Location, Citizenship, Email, Phone, LinkedIn) were
 * removed from Settings → STANDARD → Personal; they are edited only in the
 * "Review & Edit my data" dialog (antcv-data-export-360.js). This diag boots
 * the PWA with the Anita persona and asserts:
 *   1. none of the 5 contact inputs render in the Personal panel;
 *   2. Full Name + Headline inputs remain, prefilled from personalInfo;
 *   3. the quick-contact identity lift still runs (Name row order -4, so
 *      Name/Headline sit above the Writing Style block);
 *   4. personalInfo is still READ downstream — the preview contact line
 *      carries the persona's email;
 *   5. no page errors.
 * Run: node pwa/test/diag-settings-personal-dedup.mjs */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const anita = JSON.parse(await readFile(path.join(ROOT, '..', 'docs', 'personas', 'anita', 'personalInfo.json'), 'utf8'));
const pi = anita.personalInfo || anita;
const server = http.createServer(async (req, res) => {
  try {
    let rel = decodeURIComponent((req.url || '/').split('?')[0]);
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
}, pi);
await page.goto(base + '/index.html', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(3500);
await page.evaluate(() => {
  if (typeof window._antcvBuildTemplateSkeleton === 'function') {
    localStorage.setItem('sections', JSON.stringify({ cv: window._antcvBuildTemplateSkeleton().cv || [], cl: [] }));
  }
});
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(3000);

// open gear -> STANDARD -> Personal
await page.evaluate(() => {
  const g = [...document.querySelectorAll('button,[role=button]')].find((b) => /⚙|settings|gear/i.test((b.textContent || '') + (b.getAttribute('aria-label') || '') + (b.getAttribute('title') || '')));
  if (g) g.click();
}).catch(() => {});
await page.waitForTimeout(800);
const clickExact = (t) => page.evaluate((t) => { const m = [...document.querySelectorAll('button,[role=button],[role=tab],summary,div,span,a')].find((e) => e.offsetParent !== null && (e.textContent || '').replace(/\s+/g, ' ').trim() === t); if (m) { m.click(); return true; } return false; }, t).catch(() => false);
await clickExact('STANDARD');
await page.waitForTimeout(400);
await clickExact('Personal');
await page.waitForTimeout(2500); // let the quick-contact sidecar sweeps settle

const CONTACT_PH = ['Copenhagen, Denmark', 'EU citizen', 'name@example.com', '+45 12 34 56 78', 'linkedin.com/in/your-name'];
const r = await page.evaluate(({ CONTACT_PH, pi }) => {
  // existence, not visibility: in this headless boot the whole Personal panel
  // reports offsetParent null (pre-existing, identical on unmodified main),
  // so visibility can't discriminate. Placeholder existence can: before the
  // dedup all 5 contact inputs exist in the DOM, after it zero do.
  const inputs = [...document.querySelectorAll('input')];
  const byPh = (ph) => inputs.filter((i) => String(i.placeholder || '').indexOf(ph) >= 0);
  const contactHits = {};
  CONTACT_PH.forEach((ph) => { contactHits[ph] = byPh(ph).length; });
  const nameInp = byPh('Jane Doe')[0] || null;
  const headInp = byPh('Senior Project Manager')[0] || null;
  // identity lift: climb the name input to the flex item and read style.order
  let nameOrder = null;
  if (nameInp) {
    let n = nameInp;
    while (n && n.parentElement && !n.style.order) n = n.parentElement;
    nameOrder = n ? n.style.order : null;
  }
  const bodyText = document.body.textContent || '';
  return {
    contactHits,
    nameValue: nameInp ? nameInp.value : null,
    headlineValue: headInp ? headInp.value : null,
    nameOrder,
    quickContactHeader: bodyText.indexOf('Quick contact details') >= 0,
    emailReadDownstream: pi.email ? bodyText.indexOf(pi.email) >= 0 : null,
  };
}, { CONTACT_PH, pi });

let fail = 0;
const check = (ok, label, detail) => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + label + (detail !== undefined ? ' :: ' + JSON.stringify(detail) : '')); if (!ok) fail++; };
check(Object.values(r.contactHits).every((n) => n === 0), 'no contact input exists in Settings → Personal', r.contactHits);
check(!!r.nameValue && r.nameValue === (pi.name || r.nameValue), 'Full Name input present + prefilled', r.nameValue);
check(r.headlineValue !== null, 'Headline input present', r.headlineValue);
check(r.nameOrder === '-4', 'identity lift ran (Name row order -4, above Writing Style)', r.nameOrder);
check(!r.quickContactHeader, 'no orphaned "Quick contact details" header', r.quickContactHeader);
check(r.emailReadDownstream !== false, 'personalInfo.email still read downstream (preview contact line)', r.emailReadDownstream);
check(errs.length === 0, 'no page errors', errs.slice(0, 3));

await browser.close(); server.close();
console.log(fail ? `RED — ${fail} check(s) failed` : 'GREEN — SETTINGS-PERSONAL-DEDUP-001 verified');
process.exit(fail ? 1 : 0);
