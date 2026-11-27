/* DIAGNOSTIC — AI notice MOVES when section lengths change in the CV
 * (owner 2026-06-09). Loads ONLY the watermark anchor sidecar against a synthetic
 * last page-box whose two columns have different content heights, and asserts:
 *   (1) the notice anchors to the column with MORE empty space (taller gap),
 *   (2) after the column heights SWAP + an antcv:auto-pages-changed pulse (the
 *       re-pagination signal a length change fires), the notice MOVES to the
 *       other column.
 * Updated 2026-11-27 (DIAG-FLEET-ROT-001): AI-NOTICE-PREVIEW-AUTO-SIDEBAR-001
 * (owner 2026-07-02) made the PREVIEW auto corner follow the SIDEBAR side, to
 * match the docx-worker export; the geometric emptier-column measure is no longer
 * called. Asserted now: (A) auto = sidebar side (left) on load; (B) a length swap
 * does NOT move it (no preview/export split); (C) the auto-pages-changed re-anchor
 * still runs: sidebar moved right + pulse -> notice right; (D) a manual corner
 * (antcv:aiNoticePos, AI-NOTICE-POSITION-CONTROL-001) wins over the sidebar side. */
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
const readCorner = () => page.evaluate(() => {
  const w = document.querySelector('.antcv-ai-document-watermark');
  return { corner: w && w.getAttribute('data-antcv-watermark-corner'), side: localStorage.getItem('antcv:aiWmSide') };
});
const corner2 = await readCorner();
await page.evaluate(() => {
  localStorage.setItem('sidebarPosition', JSON.stringify('right'));
  window.dispatchEvent(new CustomEvent('antcv:auto-pages-changed', { detail: { source: 'diag' } }));
});
await page.waitForTimeout(1200);
const corner3 = await readCorner();
await page.evaluate(() => {
  localStorage.setItem('antcv:aiNoticePos', 'left');
  window.dispatchEvent(new CustomEvent('antcv:auto-pages-changed', { detail: { source: 'diag' } }));
});
await page.waitForTimeout(1200);
const corner4 = await readCorner();
await browser.close(); await new Promise(r => server.close(r));
console.log('initial (left short → more space left):', JSON.stringify(corner1));
console.log('after swap + auto-pages-changed (more space right):', JSON.stringify(corner2));
console.log('sidebar moved right + pulse:', JSON.stringify(corner3));
console.log('manual corner left + pulse:', JSON.stringify(corner4));
console.log('app errors:', errs.length, errs.slice(0, 2).join(' | '));
const A = corner1.corner === 'left' && corner1.side === 'left';
const B = corner2.corner === 'left' && corner2.side === 'left';
const C = corner3.corner === 'right' && corner3.side === 'right';
const D = corner4.corner === 'left';
const ok = A && B && C && D && errs.length === 0;
console.log(`CHECK A (auto notice on the sidebar side): ${A ? 'PASS' : 'FAIL'}`);
console.log(`CHECK B (length change does not split preview from export): ${B ? 'PASS' : 'FAIL'}`);
console.log(`CHECK C (re-anchors on auto-pages-changed: sidebar right -> right): ${C ? 'PASS' : 'FAIL'}`);
console.log(`CHECK D (manual corner wins): ${D ? 'PASS' : 'FAIL'}`);
console.log(ok ? 'WM-MOVE-ON-LENGTH OK' : 'WM-MOVE-ON-LENGTH FAIL');
process.exit(ok ? 0 : 1);
