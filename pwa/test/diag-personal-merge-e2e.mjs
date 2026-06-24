/* E2E — PERSONAL-MERGE bundles 1-3 in the REAL app (boots index.html, real React
 * + islands). Verifies: the Review & Edit launcher sits in Settings -> Personal;
 * the modal opens collapsed; the Tone & banned terms card hosts the LIVE React
 * tone editors (per-language scope + seeded banned word + semantic rule).
 * Gate-seed: antcv:disable-loading-gate + SW stub (see HARNESS-GATE-SEED-001).
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
], cl: [] };
const PI = {
  name: 'Gabriel', wizardCompleted: true,
  experience: [{ title: 'PdM', company: 'Acme', years: '2020-22', bullets: ['x'], outcomes: ['y'] }],
  stylePrefs: { banned_words: 'spearhead, leverage', banned_phrases: 'team player', semanticConstraintsV2: [{ id: 'x', trigger: 'no line mgmt', avoid: ['led a team'], prefer: ['supervised technically'], reason: '', scope: {} }] },
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
const errs = []; page.on('pageerror', e => errs.push(String(e && e.message)));
const warns = []; page.on('console', m => { if (m.type() === 'error' || /island|ToneEditors|mountTone|React/i.test(m.text())) warns.push(m.type() + ':' + m.text().slice(0, 160)); });
await page.addInitScript(({ sections, pi }) => {
  try { if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.reject(new Error('sw-off')); } catch (_) {}
  localStorage.setItem('antcv:disable-loading-gate', '1');
  localStorage.setItem('antcv:auth:token', 't'); localStorage.setItem('antcv:auth:email', 'g@e.com'); localStorage.setItem('antcv:auth:expires_at', '4102444800');
  localStorage.setItem('session', JSON.stringify({ email: 'g@e.com', ts: 1717000000000 }));
  localStorage.setItem('step', JSON.stringify('editor')); localStorage.setItem('doc', JSON.stringify('cv'));
  localStorage.setItem('sections', JSON.stringify(sections));
  localStorage.setItem('personalInfo', JSON.stringify(pi));
  localStorage.setItem('language', JSON.stringify('en')); localStorage.setItem('wizardCompleted', JSON.stringify(true));
  localStorage.setItem('stylePackage', JSON.stringify('copenhagen-modern'));
}, { sections: SECTIONS, pi: PI });

await page.goto(base + '/index.html', { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(() => !!document.querySelector('.antcv-preview-paper'), { timeout: 16000 }).catch(() => {});

// Open Settings -> Personal.
await page.evaluate(() => { const g = [...document.querySelectorAll('button,[role=button]')].find(b => /⚙|settings/i.test((b.textContent || '') + (b.getAttribute('aria-label') || '') + (b.getAttribute('title') || ''))); if (g) g.click(); });
await page.waitForTimeout(1200);
async function clickExact(t) { return page.evaluate((t) => { const m = [...document.querySelectorAll('button,[role=button],[role=tab],summary,div,span,a')].find(e => e.offsetParent !== null && (e.textContent || '').replace(/\s+/g, ' ').trim() === t); if (m) { m.click(); return true; } return false; }, t); }
await clickExact('Standard'); await page.waitForTimeout(400);
await clickExact('Personal'); await page.waitForTimeout(1800);

const s1 = await page.evaluate(() => {
  const review = document.querySelector('[data-antcv-data-export-ui="review"]');
  const launcher = document.querySelector('[data-antcv-data-export-ui="launcher"]');
  return {
    launcherPresent: !!launcher, launcherOrder: launcher ? getComputedStyle(launcher).order : null,
    importBeforeReview: !!(launcher && launcher.firstElementChild && launcher.firstElementChild.getAttribute('data-antcv-import-replacement') === '1'),
    reviewLabel: review ? (review.textContent || '').trim() : null,
    apiNow: typeof window.AntcvReactIslands, apiVer: (window.AntcvReactIslands && window.AntcvReactIslands.version) || null,
    booted: window.__antcvReactIslandsBooted || null, hasReact: typeof window.React,
    wspMounted: !!document.querySelector('[data-antcv-react-island="writing-style-picker"]'),
  };
});

// Open the modal.
await page.evaluate(() => { const b = document.querySelector('[data-antcv-data-export-ui="review"]'); if (b) b.click(); });
await page.waitForTimeout(500);
const s2 = await page.evaluate(() => {
  const modal = document.querySelector('[data-antcv-review-modal]');
  if (!modal) return { modal: false };
  const headers = [...modal.querySelectorAll('button')].filter(b => { const c = b.firstElementChild; return c && /^[▸▾]$/.test((c.textContent || '').trim()) && b.children.length >= 2 && !b.closest('[data-antcv-react-island]'); });
  const allCollapsed = headers.every(b => { const inner = b.nextElementSibling; return inner && getComputedStyle(inner).display === 'none'; });
  return { modal: true, sectionCount: headers.length, allCollapsed };
});

// Expand Tone & banned terms; let React paint the hosted editors.
await page.evaluate(() => { const modal = document.querySelector('[data-antcv-review-modal]'); const h = [...modal.querySelectorAll('button')].find(b => /Tone & banned terms/.test(b.textContent || '')); if (h) h.click(); });
await page.waitForTimeout(900);
const s3 = await page.evaluate(() => {
  const modal = document.querySelector('[data-antcv-review-modal]');
  const island = modal && modal.querySelector('[data-antcv-react-island="tone-editors"]');
  const scopeBtns = island ? [...island.querySelectorAll('button')].map(b => (b.textContent || '').trim()) : [];
  const mount = modal && [...modal.querySelectorAll('div')].find(d => /Tone & banned terms/.test((d.previousSibling && d.previousSibling.textContent) || ''));
  return {
    islandMounted: !!island,
    apiType: typeof (window.AntcvReactIslands && window.AntcvReactIslands.mountToneEditors),
    bundleVer: (window.AntcvReactIslands && window.AntcvReactIslands.version) || null,
    toneMountHTML: mount ? (mount.innerHTML || '').slice(0, 120) : null,
    hasAllScope: scopeBtns.includes('All languages'),
    seededWord: island ? /spearhead/.test(island.textContent || '') : false,
    seededSem: island ? /led a team/.test(island.textContent || '') : false,
  };
});

console.log('LAUNCHER:', JSON.stringify(s1));
console.log('MODAL:', JSON.stringify(s2));
console.log('TONE:', JSON.stringify(s3));
await page.screenshot({ path: path.join(OUT, 'personal-merge-e2e.png'), fullPage: true });
const pass = s1.launcherPresent && parseInt(s1.launcherOrder, 10) <= -4 && s1.importBeforeReview && s1.reviewLabel && s1.reviewLabel.includes('Review & Edit') &&
  s2.modal && s2.sectionCount >= 8 && s2.allCollapsed &&
  s3.islandMounted && s3.hasAllScope && s3.seededWord && s3.seededSem;
console.log('\nRESULT:', pass ? 'PASS' : 'FAIL');
if (errs.length) console.log('pageerrors:', errs.slice(0, 3).join(' | '));
await browser.close(); await new Promise(r => server.close(r));
process.exit(pass ? 0 : 1);
