/* DIAGNOSTIC — CL-SALMON-SLOW-001 (owner 2026-06-09 "took a long time"): the CL
 * measurer broke ONE section per compute and leaned on incidental re-triggers to
 * paginate the rest (slow). Now it breaks EVERY spanning section in one pass.
 *
 * Isolation harness (no React, so no re-render to re-trip the source fingerprint):
 * with the OLD one-per-compute `break`, only the FIRST spanning section would be
 * written and the measurer would then no-op. With the fix, BOTH spanning sections
 * are written in a single settle, each with its real cumulative page; a page-2
 * internal section between them is left alone.
 *   bodyA  : page 1
 *   secB   : spans 1→2  → expect page 2
 *   secC   : page 2     → expect NO break
 *   secD   : spans 2→3  → expect page 3
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MEASURER = await readFile(path.join(ROOT, 'antcv-auto-pagebreak-block-001.js'), 'utf8');
const block = (sid, h, label) => `<div data-sid="${sid}" style="height:${h}px;overflow:hidden">${label}</div>`;
const HTML = `<!doctype html><html><head><meta charset=utf8></head><body>
<div data-antcv-cl-flow="true" style="position:absolute;top:0;left:0;width:800px">
  ${block('bodyA', 900, 'page 1 body')}
  ${block('secB', 400, 'spans 1 to 2')}
  ${block('secC', 400, 'entirely page 2')}
  ${block('secD', 500, 'spans 2 to 3')}
</div>
<script>${MEASURER}</script>
</body></html>`;
// tops: bodyA 0, secB 900, secC 1300, secD 1700, end 2200
const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(HTML); });
await new Promise(r => server.listen(0, r));
const port = server.address().port;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
await page.addInitScript(() => {
  localStorage.setItem('doc', JSON.stringify('cl'));
  localStorage.setItem('sections', JSON.stringify({ cv: [], cl: [
    { id: 'bodyA', type: 'text', loc: 'main', on: true, title: '' },
    { id: 'secB', type: 'text', loc: 'main', on: true, title: 'B' },
    { id: 'secC', type: 'text', loc: 'main', on: true, title: 'C' },
    { id: 'secD', type: 'text', loc: 'main', on: true, title: 'D' },
  ] }));
  localStorage.setItem('antcv:autoPages', '{}');
  localStorage.setItem('antcv:autoPagesPreview', '{}');
  localStorage.setItem('antcv:itemPages', '{}');
});
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + (e && e.message)));
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(4000);
const r = await page.evaluate(() => {
  const j = (k) => { try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch (_) { return {}; } };
  return { app: j('antcv:autoPagesPreview') };
});
await browser.close(); await new Promise(r => server.close(r));
const pg = (o) => (o ? Number(Object.values(o)[0]) : 0);
console.log('autoPagesPreview:', JSON.stringify(r.app));
console.log('app errors:', errs.length, errs.slice(0, 2).join(' | '));
const bP = pg(r.app.secB), dP = pg(r.app.secD), cBroken = !!r.app.secC;
console.log('secB page (want 2):', bP, '| secD page (want 3):', dP, '| secC broken (want false):', cBroken);
const ok = bP === 2 && dP === 3 && !cBroken && errs.length === 0;
console.log(`CHECK (both spanning sections broken in one pass, correct pages, internal section skipped): ${ok ? 'PASS' : 'FAIL'}`);
console.log(ok ? 'CL-ONEPASS OK' : 'CL-ONEPASS FAIL');
process.exit(ok ? 0 : 1);
