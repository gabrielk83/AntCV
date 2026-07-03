/* DIAGNOSTIC — long-press hide menu on the REAL rich_block tools shape
 * (owner 2026-07-03 mobile report; root cause RICHBLOCK-SHAPE-001).
 * Verifies the 1.51.117 fix end-to-end in a real browser boot:
 *  1. menu shows per-token entries for a rich {b,t} tools row,
 *  2. "Hide entire element" hides via the SECTION-LEVEL map (preview row gone,
 *     panel eye can restore),
 *  3. hide-token moves the token into a rich-shaped "Hidden -" row that never
 *     renders in preview,
 *  4. menu Restore puts the token back, undo stack works.
 * Run: node pwa/test/diag-longpress-hide.mjs
 */
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
await new Promise(r => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

// The REAL runtime shape: rich_block items {b,t,bullets} + {grp:true,t} groups.
const SECTIONS = {
  cv: [
    { id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'A real profile paragraph for layout.' },
    {
      id: 'tools', title: 'TOOLS & METHODS', loc: 'sidebar', on: true, type: 'rich_block',
      items: [
        { grp: true, t: 'Engineering', bullets: [] },
        { b: 'Lab & fabrication', t: 'Cleanroom fabrication, lithography, deposition, etch, DRIE, PDMS nanoimprint', bullets: [] },
        { b: 'Project & lifecycle', t: 'Codebeamer, Jira, MS Project', bullets: [] },
      ],
    },
  ],
  cl: [],
};
const PI = {
  name: 'Diag User', wizardCompleted: true,
  tools: [
    { l: 'Lab & fabrication', v: 'Cleanroom fabrication, lithography, deposition, etch, DRIE, PDMS nanoimprint' },
    { l: 'Project & lifecycle', v: 'Codebeamer, Jira, MS Project' },
  ],
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 900 }, hasTouch: true, isMobile: true });
const errs = []; page.on('pageerror', e => errs.push(String(e && e.message)));
await page.addInitScript(({ sections, pi }) => {
  try { if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.reject(new Error('sw-off')); } catch (_) {}
  localStorage.setItem('antcv:disable-loading-gate', '1');
  localStorage.setItem('antcv:auth:token', 't'); localStorage.setItem('antcv:auth:email', 'demo@e.com'); localStorage.setItem('antcv:auth:expires_at', '4102444800');
  localStorage.setItem('session', JSON.stringify({ email: 'demo@e.com', ts: 1717000000000 }));
  localStorage.setItem('step', JSON.stringify('editor')); localStorage.setItem('doc', JSON.stringify('cv'));
  localStorage.setItem('sections', JSON.stringify(sections));
  localStorage.setItem('personalInfo', JSON.stringify(pi));
  localStorage.setItem('language', JSON.stringify('en')); localStorage.setItem('wizardCompleted', JSON.stringify(true));
  localStorage.setItem('stylePackage', JSON.stringify('copenhagen-modern'));
}, { sections: SECTIONS, pi: PI });
await page.goto(base + '/index.html', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(4500);

const rowSel = '[data-sid="tools"] [data-antcv-row-path="items.1"]';
async function openMenu() {
  const box = await page.locator(rowSel).first().boundingBox();
  if (!box) return null;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.dispatchEvent(rowSel, 'pointerdown', { button: 0, clientX: x, clientY: y, bubbles: true, composed: true, pointerId: 7 });
  await page.waitForTimeout(750);
  return page.evaluate(() => {
    const m = document.querySelector('[data-antcv-visibility-menu]');
    return m ? Array.from(m.children).map((d) => d.textContent) : null;
  });
}
async function clickEntry(re) {
  return page.evaluate((reSrc) => {
    const m = document.querySelector('[data-antcv-visibility-menu]');
    if (!m) return false;
    const entry = Array.from(m.children).find((d) => new RegExp(reSrc).test(d.textContent));
    if (!entry) return false;
    entry.click();
    return true;
  }, re.source);
}

// (1) menu with per-token entries
const menu1 = await openMenu();
console.log('MENU-1', JSON.stringify(menu1));
const hasTokens = !!(menu1 && menu1.some((t) => /Hide “PDMS nanoimprint”/.test(t)));
console.log('CHECK per-token entries:', hasTokens ? 'PASS' : 'FAIL');

// (2) hide a TOKEN -> rich residue row, never rendered
await clickEntry(/Hide “PDMS nanoimprint”/);
await page.waitForTimeout(2200);
const afterTok = await page.evaluate(() => {
  const b = JSON.parse(localStorage.getItem('sections') || '{}');
  const tools = (b.cv || []).find((s) => s && s.id === 'tools');
  const resRow = tools.items.find((it) => /^Hidden - /.test(String(it.b || it.l || '')));
  const previewTexts = Array.from(document.querySelectorAll('[data-sid="tools"] [data-antcv-row-path]')).map((el) => (el.textContent || '').slice(0, 44));
  return { resRow, previewTexts, analytics: (JSON.parse(localStorage.getItem('antcv:visibilityAnalytics') || '[]')).map((e) => e.action + ':' + (e.token || e.label)) };
});
console.log('AFTER-TOKEN-HIDE residue row:', JSON.stringify(afterTok.resRow));
console.log('AFTER-TOKEN-HIDE preview rows:', JSON.stringify(afterTok.previewTexts));
console.log('CHECK residue rich-shaped:', afterTok.resRow && afterTok.resRow.b === 'Hidden - Lab & fabrication' && /PDMS/.test(afterTok.resRow.t) ? 'PASS' : 'FAIL');
console.log('CHECK residue not rendered:', afterTok.previewTexts.some((t) => /Hidden -/.test(t)) ? 'FAIL' : 'PASS');
console.log('CHECK analytics:', JSON.stringify(afterTok.analytics));

// (3) menu again -> Restore entry present; restore the token
const menu2 = await openMenu();
console.log('MENU-2', JSON.stringify(menu2));
await clickEntry(/Restore “PDMS nanoimprint”/);
await page.waitForTimeout(2200);
const afterRestore = await page.evaluate(() => {
  const b = JSON.parse(localStorage.getItem('sections') || '{}');
  const tools = (b.cv || []).find((s) => s && s.id === 'tools');
  return {
    lab: tools.items.find((it) => String(it.b || it.l || '') === 'Lab & fabrication'),
    residue: tools.items.filter((it) => /^Hidden - /.test(String(it.b || it.l || ''))).length,
  };
});
console.log('AFTER-RESTORE lab row:', JSON.stringify(afterRestore.lab));
console.log('CHECK token restored:', /PDMS nanoimprint/.test(afterRestore.lab && afterRestore.lab.t || '') && afterRestore.residue === 0 ? 'PASS' : 'FAIL');

// (4) hide ENTIRE element -> section-level map; preview row gone; undo brings it back
const menu3 = await openMenu();
await clickEntry(/Hide entire element/);
await page.waitForTimeout(2200);
const afterRow = await page.evaluate(() => {
  const b = JSON.parse(localStorage.getItem('sections') || '{}');
  const tools = (b.cv || []).find((s) => s && s.id === 'tools');
  const previewRow = Array.from(document.querySelectorAll('[data-sid="tools"] [data-antcv-row-path]')).map((el) => (el.textContent || '').slice(0, 30));
  return { hiddenMap: tools.hidden, itemFlag: tools.items[1] && tools.items[1].hidden, previewRow, toast: !!document.querySelector('[data-antcv-visibility-toast]') };
});
console.log('AFTER-ROW-HIDE map:', JSON.stringify(afterRow.hiddenMap), 'itemFlag:', afterRow.itemFlag, 'toast:', afterRow.toast);
console.log('AFTER-ROW-HIDE preview rows:', JSON.stringify(afterRow.previewRow));
console.log('CHECK map-hide (renderer honors):', afterRow.hiddenMap && afterRow.hiddenMap[1] && !afterRow.previewRow.some((t) => /Lab & fabrication/.test(t)) ? 'PASS' : 'FAIL');

// (5) UNDO restores the row
await page.evaluate(() => window.AntcvSidebarVisibilityUx._undoLast());
await page.waitForTimeout(2200);
const afterUndo = await page.evaluate(() => {
  const b = JSON.parse(localStorage.getItem('sections') || '{}');
  const tools = (b.cv || []).find((s) => s && s.id === 'tools');
  const previewRow = Array.from(document.querySelectorAll('[data-sid="tools"] [data-antcv-row-path]')).map((el) => (el.textContent || '').slice(0, 30));
  return { hiddenMap: tools.hidden, previewRow };
});
console.log('AFTER-UNDO map:', JSON.stringify(afterUndo.hiddenMap));
console.log('CHECK undo restored row:', afterUndo.previewRow.some((t) => /Lab & fabrication/.test(t)) ? 'PASS' : 'FAIL');

console.log('PAGE ERRORS:', JSON.stringify(errs));
await browser.close();
await new Promise(r => server.close(r));
