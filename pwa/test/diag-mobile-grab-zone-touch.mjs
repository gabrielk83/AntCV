/* DIAGNOSTIC — GRAB-ZONE-TOUCH-HEADLESS-001 (register rows 100 + 101, desktop nightly 2026-10-16).
 *
 * Rows 100 (GRAB-ZONE-DISMISS-THRESHOLD-001 + GRAB-ZONE-SCROLL-FORWARD-001) and 101
 * (ZOOM-FLOOR-001) shipped 2026-07-05 from a code-reading diagnosis and were only ever
 * locked by SOURCE checks (the unit tests grep app.src.js / app.js for `n - t > 80`,
 * `scrollTop -= n - ly` and `Math.max(0.1, …)`). Nobody had driven the real React
 * handler with a touch sequence. This probe boots the REAL app at a phone viewport,
 * opens the mobile bottom panel and fires native TouchEvents at the sticky grab handle:
 *
 *   A. a 40 px downward slide (an incidental graze / scroll-start) must NOT dismiss the
 *      panel, and the per-move delta must reach the panel's real scrollable content
 *      (its scrollTop moves by the same 40 px) — checked on BOTH the Sections tab (content
 *      is the handle's direct sibling) and the Analysis tab (a sidecar hides the
 *      "Generate a CV first" placeholder between the handle and the content; this is the
 *      case GRAB-ZONE-SCROLL-TARGET-002 fixed — before it the delta went to the hidden node);
 *   B. a 120 px downward slide (a deliberate swipe) MUST dismiss the panel (back to Preview);
 *   C. the preview zoom "−" button, clicked 12×, must floor at 10 % (not the old 35 %),
 *      and one "+" must step back to 20 %.
 *
 * Headless touch emulation is not a real Android finger: it proves the handler logic and
 * the DOM wiring end to end, not the browser's native scroll arbitration. The real-device
 * confirm stays with the owner; this closes the "never exercised in a browser" gap. */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
const server = http.createServer(async (req, res) => {
  try {
    let rel = decodeURIComponent((req.url || '/').split('?')[0]);
    if (rel === '/') rel = '/index.html';
    const fp = path.join(ROOT, rel);
    const s = await stat(fp).catch(() => null);
    if (!s || !s.isFile()) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' });
    res.end(await readFile(fp));
  } catch (e) { res.writeHead(500); res.end(String(e)); }
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;

// Enough sidebar + main content that the Sections tab has something to scroll.
const sections = {
  cv: [
    { id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'Profile line. '.repeat(30) },
    { id: 'exp', title: 'EXPERIENCE', loc: 'main', on: true, type: 'text', content: 'Experience line. '.repeat(60) },
    { id: 'skills', title: 'CORE COMPETENCIES', loc: 'sidebar', on: true, type: 'list', items: Array.from({ length: 14 }, (_, i) => 'Competency ' + (i + 1)) },
    { id: 'tools', title: 'TOOLS & METHODS', loc: 'sidebar', on: true, type: 'list', items: Array.from({ length: 14 }, (_, i) => 'Tool ' + (i + 1)) },
    { id: 'lang', title: 'LANGUAGES', loc: 'sidebar', on: true, type: 'list', items: ['English — fluent', 'Danish — professional'] },
    { id: 'edu', title: 'EDUCATION', loc: 'sidebar', on: true, type: 'list', items: ['MSc Photonics', 'BSc Physics'] },
  ],
  cl: [],
};
const PI = { name: 'Diag User', email: 'd@e.com', wizardCompleted: true };

const errs = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 380, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
page.on('pageerror', e => errs.push('pageerror: ' + (e && e.message)));
await page.addInitScript(({ sections, pi }) => {
  try { if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.reject(new Error('sw-off')); } catch (_) {}
  localStorage.setItem('antcv:disable-loading-gate', '1');
  localStorage.setItem('antcv:auth:token', 't'); localStorage.setItem('antcv:auth:email', 'd@e.com'); localStorage.setItem('antcv:auth:expires_at', '4102444800');
  localStorage.setItem('session', JSON.stringify({ email: 'd@e.com', ts: 1717000000000 }));
  localStorage.setItem('step', JSON.stringify('editor')); localStorage.setItem('doc', JSON.stringify('cv'));
  localStorage.setItem('sections', JSON.stringify(sections));
  localStorage.setItem('personalInfo', JSON.stringify(pi));
  localStorage.setItem('language', JSON.stringify('en')); localStorage.setItem('wizardCompleted', JSON.stringify(true));
  localStorage.setItem('proxyUrl', 'https://cv-proxy.karp-gabriel-a.workers.dev');
}, { sections, pi: PI });
// allow the app + the React CDN; block only the app backends
await page.route('**/*', r => { const u = r.request().url(); if (/workers\.dev|access-relay|cv-proxy|demo-proxy|cloudconvert|c2pa/i.test(u)) return r.abort(); return r.continue(); });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 45000 });
await page.waitForTimeout(7000);

const grabSel = '.antcv-panel-grab-zone';

// Click a bottom-bar tab by its exact label; returns the label clicked or null.
const openTab = async (labels) => {
  const clicked = await page.evaluate((labels) => {
    const norm = s => (s || '').replace(/\s+/g, ' ').trim();
    const btns = Array.from(document.querySelectorAll('button'));
    for (const L of labels) { const b = btns.find(x => norm(x.textContent) === L); if (b) { b.click(); return L; } }
    return null;
  }, labels);
  await page.waitForTimeout(1500);
  return clicked;
};

// Synthetic touch helper: native TouchEvents bubble to React's root listener.
const touch = async (phase, y) => page.evaluate(({ sel, phase, y }) => {
  const el = document.querySelector(sel);
  if (!el) return false;
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const t = new Touch({ identifier: 1, target: el, clientX: x, clientY: y, pageX: x, pageY: y });
  const ev = new TouchEvent(phase, { touches: phase === 'touchend' ? [] : [t], targetTouches: phase === 'touchend' ? [] : [t], changedTouches: [t], bubbles: true, cancelable: true, composed: true });
  el.dispatchEvent(ev);
  return true;
}, { sel: grabSel, phase, y });

// The content the handle is supposed to scroll: the first displayed sibling after the
// handle that overflows (the panel itself as a last resort). Preset its scrollTop so a
// downward slide has room to move it toward the top.
const primeScroller = async (preset) => page.evaluate(({ sel, preset }) => {
  const g = document.querySelector(sel); if (!g) return null;
  const r = g.getBoundingClientRect();
  const sibs = []; let n = g.nextElementSibling;
  while (n) { const cs = getComputedStyle(n); sibs.push({ display: cs.display, h: n.clientHeight, sh: n.scrollHeight, data: Object.keys(n.dataset || {}).join(',') }); n = n.nextElementSibling; }
  let s = g.nextElementSibling;
  while (s && (getComputedStyle(s).display === 'none' || s.scrollHeight <= s.clientHeight + 1)) s = s.nextElementSibling;
  if (!s) s = g.parentElement;
  s.scrollTop = preset;
  const directHidden = !!g.nextElementSibling && getComputedStyle(g.nextElementSibling).display === 'none';
  s.setAttribute('data-diag-scroller', '1');
  return { grabTop: Math.round(r.top), grabH: Math.round(r.height), siblings: sibs, directSiblingHidden: directHidden, scrollerH: s.clientHeight, scrollerSH: s.scrollHeight, scrollTop: s.scrollTop, touchAction: getComputedStyle(g).touchAction };
}, { sel: grabSel, preset });
const readScroller = async () => page.evaluate((sel) => {
  const s = document.querySelector('[data-diag-scroller]');
  return { grabStill: !!document.querySelector(sel), scrollTop: s ? s.scrollTop : null };
}, grabSel);

const caseA = async (tabLabels, preset) => {
  const tab = await openTab(tabLabels);
  if (!tab || !(await page.$(grabSel))) return { tab, ok: false, reason: 'panel not open' };
  const g = await primeScroller(preset);
  const y0 = g.grabTop + Math.max(4, Math.floor(g.grabH / 2));
  await touch('touchstart', y0);
  await touch('touchmove', y0 + 15);
  await touch('touchmove', y0 + 40);
  await touch('touchend', y0 + 40);
  await page.waitForTimeout(400);
  const after = await readScroller();
  await page.evaluate(() => { const s = document.querySelector('[data-diag-scroller]'); if (s) s.removeAttribute('data-diag-scroller'); });
  const moved = after.scrollTop !== null ? preset - after.scrollTop : null;
  return { tab, directSiblingHidden: g.directSiblingHidden, scroller: { h: g.scrollerH, sh: g.scrollerSH }, preset, after: after.scrollTop, moved, grabStill: after.grabStill, ok: after.grabStill && moved !== null && Math.abs(moved - 40) <= 2 };
};

// ---- A1. Sections tab (content = direct sibling), A2. Analysis tab (hidden placeholder first)
const A1 = await caseA(['☰ Sections', '¶ Sections', '☰ Sektioner'], 200);
const A2 = await caseA(['🎯 Analysis', '📊 Analysis', '🎯 Analyse'], 60);

// ---- B. 120 px swipe on whatever tab is open: dismiss (grab zone unmounts)
let B = { grabStill: true };
if (await page.$(grabSel)) {
  const g = await primeScroller(0);
  const y0 = g.grabTop + Math.max(4, Math.floor(g.grabH / 2));
  await touch('touchstart', y0);
  await touch('touchmove', y0 + 50);
  await touch('touchmove', y0 + 120);
  await touch('touchend', y0 + 120);
  await page.waitForTimeout(700);
  B = await page.evaluate((sel) => ({ grabStill: !!document.querySelector(sel) }), grabSel);
}

// ---- C. zoom floor: 12 × "−" must read 10 %, then one "+" reads 20 %
const zoom = await page.evaluate(async () => {
  const norm = s => (s || '').replace(/\s+/g, ' ').trim();
  const ctl = document.querySelector('[aria-label="Preview zoom control"]');
  if (!ctl) return { found: false };
  const btns = Array.from(ctl.querySelectorAll('button'));
  const minus = btns.find(b => norm(b.textContent) === '−' || norm(b.textContent) === '-');
  const plus = btns.find(b => norm(b.textContent) === '+');
  const label = () => { const l = btns.find(b => /%$/.test(norm(b.textContent))); return l ? norm(l.textContent) : null; };
  const wait = () => new Promise(r => setTimeout(r, 60));
  const start = label();
  for (let i = 0; i < 12; i++) { minus.click(); await wait(); }
  const floor = label();
  plus.click(); await wait();
  const up = label();
  return { found: true, start, floor, up };
});

await browser.close(); server.close();

console.log('A1 Sections (40px graze):', JSON.stringify(A1));
console.log('A2 Analysis (40px graze):', JSON.stringify(A2));
console.log('B  (120px swipe):', JSON.stringify(B));
console.log('C  (zoom floor):', JSON.stringify(zoom));
if (errs.length) console.log('page errors:', errs.join(' | '));

const okA1 = !!A1.ok, okA2 = !!A2.ok;
const okB = !B.grabStill;
const okC = zoom.found && zoom.floor === '10%' && zoom.up === '20%';
console.log(`A1 sections forward: ${okA1 ? 'OK' : 'FAIL'}   A2 analysis forward: ${okA2 ? 'OK' : 'FAIL'}   B dismiss>80px: ${okB ? 'OK' : 'FAIL'}   C zoom floor 10%: ${okC ? 'OK' : 'FAIL'}   pageErrors=${errs.length}`);
const ok = okA1 && okA2 && okB && okC && errs.length === 0;
console.log(ok ? 'GRAB-ZONE-TOUCH-HEADLESS OK' : 'GRAB-ZONE-TOUCH-HEADLESS FAILED');
process.exit(ok ? 0 : 1);
