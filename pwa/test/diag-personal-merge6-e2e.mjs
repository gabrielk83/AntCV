/* E2E — PERSONAL-MERGE-6 in the real app: the native Personal-tab dupes are
 * hidden (Full Name / Headline / Quick contact / Background / CV Sidebar, and the
 * writing-style island's Banned words/phrases/Semantic headers), while the KEPT
 * controls (Writing style selector, Advanced tone) stay visible — and the modal
 * still covers the hidden data (Identity + Tone cards present). Coverage-proof
 * for the 1.50.545-style regression risk.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.map': 'application/json' };
const server = http.createServer(async (req, res) => {
  try { let rel = decodeURIComponent((req.url || '/').split('?')[0]); if (rel === '/') rel = '/index.html'; const fp = path.join(ROOT, rel); const s = await stat(fp).catch(() => null); if (!s || !s.isFile()) { res.writeHead(404); res.end('nf'); return; } res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' }); res.end(await readFile(fp)); } catch (e) { res.writeHead(500); res.end(String(e && e.message)); }
});
await new Promise(r => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

const SECTIONS = { cv: [{ id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'IT.' }], cl: [] };
const PI = { name: 'Gabriel', headline: 'IT pro', background: 'bg', wizardCompleted: true, stylePrefs: { banned_words: 'spearhead' } };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1500 } });
const errs = []; page.on('pageerror', e => errs.push(String(e && e.message)));
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
await page.evaluate(() => { const g = [...document.querySelectorAll('button,[role=button]')].find(b => /⚙|settings/i.test((b.textContent || '') + (b.getAttribute('aria-label') || '') + (b.getAttribute('title') || ''))); if (g) g.click(); });
await page.waitForTimeout(1200);
async function clickExact(t) { return page.evaluate((t) => { const m = [...document.querySelectorAll('button,[role=button],[role=tab],summary,div,span,a')].find(e => e.offsetParent !== null && (e.textContent || '').replace(/\s+/g, ' ').trim() === t); if (m) { m.click(); return true; } return false; }, t); }
await clickExact('Standard'); await page.waitForTimeout(400);
await clickExact('Personal'); await page.waitForTimeout(2200);

const r = await page.evaluate(() => {
  const wsp = document.getElementById('antcv-react-writing-style-picker') || document.querySelector('[data-antcv-react-mount="writing-style-picker"]');
  let col = wsp; for (let i = 0; i < 8 && col && col.parentElement; i++) { const cc = getComputedStyle(col.parentElement); if (cc.display === 'flex' && /column/.test(cc.flexDirection)) { col = col.parentElement; break; } col = col.parentElement; }
  const hidden = (el) => !!el && (el.getAttribute('data-antcv-dedup-hidden') === '1' || el.offsetParent === null);
  const visible = (el) => !!el && el.offsetParent !== null;
  const labeled = (re) => [...col.querySelectorAll('div')].find(d => { const l = d.firstElementChild; return l && l.tagName === 'DIV' && re.test((l.textContent || '').trim()) && d.querySelector('input'); });
  const details = (re) => [...col.querySelectorAll('details')].find(dt => { const s = dt.querySelector('summary'); return s && re.test((s.textContent || '').trim()); });
  const wspBtn = (test) => [...wsp.querySelectorAll('button')].find(b => test((b.textContent || '').replace(/[▸▾▶▼]/g, '').replace(/\s+/g, ' ').trim()));
  return {
    nameHidden: hidden(labeled(/^Full Name$/i)),
    headlineHidden: hidden(labeled(/^Headline \/ Job Title/i)),
    quickContactHidden: hidden(col.querySelector('[data-antcv-quick-contact-hdr]')),
    backgroundHidden: hidden(details(/^Background \(work history\)/i)),
    sidebarHidden: hidden(details(/^CV Sidebar Content/i)),
    bannedWordsHidden: hidden(wspBtn(t => t === 'Banned words')),
    bannedPhrasesHidden: hidden(wspBtn(t => /^Banned phrases/i.test(t))),
    semanticHidden: hidden(wspBtn(t => t === 'Semantic constraints')),
    // KEPT controls still visible:
    styleSelectVisible: visible(wsp.querySelector('select')),
    advancedToneVisible: visible(wspBtn(t => t === 'Advanced tone')),
  };
});

// Coverage: the modal still edits identity + tone.
await page.evaluate(() => { const b = document.querySelector('[data-antcv-data-export-ui="review"]'); if (b) b.click(); });
await page.waitForTimeout(400);
const cov = await page.evaluate(() => {
  const modal = document.querySelector('[data-antcv-review-modal]');
  const txt = modal ? modal.textContent || '' : '';
  return { modalOpens: !!modal, identityCard: /Identity & contact/.test(txt), toneCard: /Tone & banned terms/.test(txt) };
});

console.log('HIDE:', JSON.stringify(r, null, 1));
console.log('COVERAGE:', JSON.stringify(cov));
await page.screenshot({ path: path.join(ROOT, 'test', 'out', 'personal-merge6-e2e.png'), fullPage: true });
const allHidden = r.nameHidden && r.headlineHidden && r.quickContactHidden && r.backgroundHidden && r.sidebarHidden && r.bannedWordsHidden && r.bannedPhrasesHidden && r.semanticHidden;
const keptVisible = r.styleSelectVisible && r.advancedToneVisible;
const covered = cov.modalOpens && cov.identityCard && cov.toneCard;
const pass = allHidden && keptVisible && covered;
console.log('\nRESULT:', pass ? 'PASS' : 'FAIL', '(allHidden=' + allHidden + ' keptVisible=' + keptVisible + ' covered=' + covered + ')');
if (errs.length) console.log('pageerrors:', errs.slice(0, 3).join(' | '));
await browser.close(); await new Promise(r => server.close(r));
process.exit(pass ? 0 : 1);
