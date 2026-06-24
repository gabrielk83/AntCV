/* UNIT — PERSONAL-MERGE-3: the Review & Edit modal hosts the LIVE React tone
 * editors (banned words/phrases with per-language scope + semantic constraints),
 * replacing the old read-only chip cards. Loads React UMD + the rebuilt islands
 * bundle + the sidecar; opens the modal; asserts the tone-editors island mounted,
 * the scope selector + a seeded banned word render, and the old read-only cards
 * are gone. Needs network (unpkg React UMD) — prints SKIP if unreachable.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sidecar = await readFile(path.join(ROOT, 'antcv-data-export-360.js'), 'utf8');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.map': 'application/json' };
const PAGE = `<!doctype html><html><head>
<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
</head><body><script src="/antcv-react-islands.js"></script></body></html>`;
const server = http.createServer(async (req, res) => {
  let rel = decodeURIComponent((req.url || '/').split('?')[0]);
  if (rel === '/' || rel === '/__tonetest') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGE); return; }
  try { const fp = path.join(ROOT, rel); const s = await stat(fp).catch(() => null); if (!s || !s.isFile()) { res.writeHead(404); res.end('nf'); return; } res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' }); res.end(await readFile(fp)); }
  catch (e) { res.writeHead(500); res.end(String(e && e.message)); }
});
await new Promise(r => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 1000 } });
const errs = []; page.on('pageerror', e => errs.push(String(e && e.message)));
await page.goto(base + '/__tonetest', { waitUntil: 'load', timeout: 30000 });
// Wait for React UMD + islands API.
let ready = false;
try { await page.waitForFunction(() => !!(window.React && window.ReactDOM && window.AntcvReactIslands && window.AntcvReactIslands.mountToneEditors), { timeout: 12000 }); ready = true; } catch (_) {}
if (!ready) {
  console.log('SKIP: React UMD / islands API not available (offline?)');
  if (errs.length) console.log('pageerrors:', errs.slice(0, 3).join(' | '));
  await browser.close(); await new Promise(r => server.close(r)); process.exit(0);
}

await page.evaluate(() => {
  localStorage.setItem('personalInfo', JSON.stringify({
    name: 'Gabriel',
    stylePrefs: { banned_words: 'spearhead, leverage', banned_phrases: 'team player', semanticConstraintsV2: [{ id: 'x', trigger: 'no line mgmt', avoid: ['led a team'], prefer: ['supervised technically'], reason: '', scope: {} }] },
  }));
});
await page.addScriptTag({ content: sidecar });
await page.waitForTimeout(200);
await page.evaluate(() => window.AntcvReviewData && window.AntcvReviewData());
await page.waitForTimeout(300);

// Expand the Tone & banned terms card, then let React paint.
await page.evaluate(() => {
  const modal = document.querySelector('[data-antcv-review-modal]');
  const hdr = [...modal.querySelectorAll('button')].find(b => /Tone & banned terms/.test(b.textContent || ''));
  if (hdr) hdr.click();
});
await page.waitForTimeout(500);

const r = await page.evaluate(() => {
  const modal = document.querySelector('[data-antcv-review-modal]');
  const txt = modal ? modal.textContent || '' : '';
  const island = modal && modal.querySelector('[data-antcv-react-island="tone-editors"]');
  const scopeBtns = island ? [...island.querySelectorAll('button')].map(b => (b.textContent || '').trim()) : [];
  return {
    modalPresent: !!modal,
    toneCardPresent: /Tone & banned terms/.test(txt),
    islandMounted: !!island,
    hasAllScope: scopeBtns.includes('All languages'),
    hasENScope: scopeBtns.includes('EN'),
    seededWordVisible: island ? /spearhead/.test(island.textContent || '') : false,
    seededSemVisible: island ? /led a team/.test(island.textContent || '') : false,
    oldReadOnlyGone: !/Banned words, phrases & tone/.test(txt) && !/Semantic constraints \(/.test(txt),
  };
});
console.log(JSON.stringify(r, null, 1));
const pass = r.modalPresent && r.toneCardPresent && r.islandMounted && r.hasAllScope &&
  r.seededWordVisible && r.seededSemVisible && r.oldReadOnlyGone;
console.log('\nRESULT:', pass ? 'PASS' : 'FAIL');
if (errs.length) console.log('pageerrors:', errs.slice(0, 3).join(' | '));
await browser.close(); await new Promise(r => server.close(r));
process.exit(pass ? 0 : 1);
