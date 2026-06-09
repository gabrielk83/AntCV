/* DIAGNOSTIC — AI notice MOVES when section lengths change in the CV
 * (owner 2026-06-09). Loads ONLY the watermark anchor sidecar against a synthetic
 * last page-box whose two columns have different content heights, and asserts:
 *   (1) the notice anchors to the column with MORE empty space (taller gap),
 *   (2) after the column heights SWAP + an antcv:auto-pages-changed pulse (the
 *       re-pagination signal a length change fires), the notice MOVES to the
 *       other column. */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SIDE = await readFile(path.join(ROOT, 'antcv-watermark-page-anchor-341.js'), 'utf8');
const HTML = `<!doctype html><html><head><meta charset=utf8></head><body>
<div class="antcv-preview-paper" data-antcv-preview-paper="true" style="position:relative;width:760px">
  <div class="antcv-page-row" style="position:relative;height:1100px;display:flex;width:760px">
    <div style="width:50%"><div id="L" style="height:150px">left content</div></div>
    <div style="width:50%"><div id="R" style="height:750px">right content</div></div>
    <div class="antcv-ai-document-watermark">AI-assisted — author retains responsibility for content.</div>
  </div>
</div>
<script>${SIDE}</script>
</body></html>`;
const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(HTML); });
await new Promise(r => server.listen(0, r));
const port = server.address().port;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 1300 } });
await page.addInitScript(() => { localStorage.setItem('doc', JSON.stringify('cv')); });
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + (e && e.message)));
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(1200);
const corner1 = await page.evaluate(() => {
  const w = document.querySelector('.antcv-ai-document-watermark');
  return { corner: w && w.getAttribute('data-antcv-watermark-corner'), side: localStorage.getItem('antcv:aiWmSide') };
});
// SWAP the column heights (left now tall, right short) and fire the re-pagination
// signal a section-length change would emit.
await page.evaluate(() => {
  document.getElementById('L').style.height = '750px';
  document.getElementById('R').style.height = '150px';
  window.dispatchEvent(new CustomEvent('antcv:auto-pages-changed', { detail: { source: 'diag' } }));
});
await page.waitForTimeout(1200);
const corner2 = await page.evaluate(() => {
  const w = document.querySelector('.antcv-ai-document-watermark');
  return { corner: w && w.getAttribute('data-antcv-watermark-corner'), side: localStorage.getItem('antcv:aiWmSide') };
});
await browser.close(); await new Promise(r => server.close(r));
console.log('initial (left short → more space left):', JSON.stringify(corner1));
console.log('after swap + auto-pages-changed (more space right):', JSON.stringify(corner2));
console.log('app errors:', errs.length, errs.slice(0, 2).join(' | '));
const A = corner1.corner === 'left' && corner1.side === 'left';
const B = corner2.corner === 'right' && corner2.side === 'right';
const ok = A && B && errs.length === 0;
console.log(`CHECK A (initial notice on the emptier column): ${A ? 'PASS' : 'FAIL'}`);
console.log(`CHECK B (notice MOVED after length change): ${B ? 'PASS' : 'FAIL'}`);
console.log(ok ? 'WM-MOVE-ON-LENGTH OK' : 'WM-MOVE-ON-LENGTH FAIL');
process.exit(ok ? 0 : 1);
