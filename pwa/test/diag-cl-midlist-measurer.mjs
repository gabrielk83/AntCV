/* DIAGNOSTIC — CL mid-list MEASURER in isolation (1.50.315 CL-MIDLIST Part 2).
 * Builds a synthetic CL flow: one text_bullets section whose tagged bullets
 * (data-antcv-cl-item-key="bullet_N") overflow the Word-equivalent page line
 * mid-list. Loads ONLY the measurer sidecar (no app kernel to wipe the bullets)
 * and asserts it writes an ITEM-level break keyed bullet_<n> with n>0. */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MEASURER = await readFile(path.join(ROOT, 'antcv-auto-pagebreak-block-001.js'), 'utf8');
// 30 tagged bullets, ~64px tall each → bottoms cross ~949px around bullet 14.
let bullets = '';
for (let i = 0; i < 30; i++) {
  bullets += `<div data-antcv-cl-item-key="bullet_${i}" style="height:62px;line-height:20px">Bullet ${i} — meaningful work applying experience to deliver measurable results.</div>`;
}
const HTML = `<!doctype html><html><head><meta charset=utf8></head><body>
<div data-antcv-cl-flow="true" style="position:absolute;top:0;left:0;width:800px">
  <div data-sid="hiwc" style="width:800px">
    <div data-antcv-cl-item-key="intro" style="height:40px">Intro line</div>
    ${bullets}
    <div data-antcv-cl-item-key="closing" style="height:40px">Closing line</div>
  </div>
</div>
<script>${MEASURER}</script>
</body></html>`;
const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(HTML); });
await new Promise(r => server.listen(0, r));
const port = server.address().port;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
await page.addInitScript(() => {
  localStorage.setItem('doc', JSON.stringify('cl'));
  localStorage.setItem('sections', JSON.stringify({ cv: [], cl: [
    { id: 'hiwc', type: 'text_bullets', on: true, loc: 'main', title: 'HOW I WOULD CONTRIBUTE',
      intro: 'Intro line', items: Array.from({ length: 30 }, (_, i) => 'Bullet ' + i), closing: 'Closing line' }
  ] }));
  localStorage.setItem('antcv:autoPages', '{}');
  localStorage.setItem('antcv:itemPages', '{}');
});
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + (e && e.message)));
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(4000);
const r = await page.evaluate(() => {
  let autoPages = {}; try { autoPages = JSON.parse(localStorage.getItem('antcv:autoPages') || '{}'); } catch (_) {}
  return { autoPages, installed: window.__antcvAutoPagebreakInstalled || null };
});
await browser.close(); await new Promise(r => server.close(r));
console.log('measurer installed:', r.installed);
console.log('autoPages:', JSON.stringify(r.autoPages));
console.log('app errors:', errs.length, errs.slice(0, 2).join(' | '));
const hiwc = r.autoPages.hiwc || {};
const brk = Object.keys(hiwc).filter(k => Number(hiwc[k]) >= 2);
console.log('hiwc break keys:', JSON.stringify(brk));
const midKey = brk.find(k => /^bullet_(\d+)$/.test(k));
const midIdx = midKey ? Number(/^bullet_(\d+)$/.exec(midKey)[1]) : -1;
console.log('mid-list break bullet index:', midIdx);
const ok = midIdx > 0 && brk.length === 1 && errs.length === 0;
console.log(ok ? 'CL-MIDLIST-MEASURER OK' : 'CL-MIDLIST-MEASURER INCOMPLETE');
process.exit(ok ? 0 : 1);
