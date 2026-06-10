/* DIAGNOSTIC — ANALYSE-JD-BUTTON-POS-001 (owner 2026-06-10: "same row, side
 * by side"). The Analyse-JD button must render NEXT TO "Download analysis" in
 * the 360 EXPORT & DETAIL row; the in-block copy (356 .apjb-run) hides while
 * the row button exists; the row button delegates its click to the real one;
 * the JD-input block sits ABOVE the report block. Loads BOTH sidecars against
 * a synthetic analysis panel. Run: node test/diag-analyse-jd-row.mjs */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const S356 = await readFile(path.join(ROOT, 'antcv-analysis-panel-jd-block-356.js'), 'utf8');
const S360 = await readFile(path.join(ROOT, 'antcv-analysis-report-pdf-360.js'), 'utf8');
const HTML = `<!doctype html><html><head><meta charset=utf8></head><body>
<div class="antcv-editor-side-panel">
  <div>📊 Application Analysis</div>
  <div id="ovf"><div>Overall Fit</div><p>Strong fit for the role.</p></div>
</div>
<script>${S356}</script>
<script>${S360}</script>
</body></html>`;
const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(HTML); });
await new Promise(r => server.listen(0, r));
const port = server.address().port;
const browser = await chromium.launch();
const page = await browser.newPage();
await page.addInitScript(() => {
  localStorage.setItem('rationale', JSON.stringify({
    fit_summary: 'Strong fit.',
    assumptions: ['a1'], recommendations: ['r1'],
    confidence_notes: [{ text: 'gap', confidence: 0.1, issue: 'not stated' }],
  }));
  localStorage.setItem('meta', JSON.stringify({ role: 'PM', company: 'NKT' }));
  localStorage.setItem('personalInfo', JSON.stringify({ name: 'G K' }));
});
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + (e && e.message)));
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(1500);
const r = await page.evaluate(() => {
  const panel = document.querySelector('.antcv-editor-side-panel');
  const report = document.getElementById('antcv-analysis-report');
  const jdBlock = document.getElementById('antcv-analysis-panel-jd-block');
  const an = report && report.querySelector('.arx-analyse');
  const dl = report && report.querySelector('.arx-dl');
  const run = jdBlock && jdBlock.querySelector('.apjb-run');
  // spy: does the row button delegate to the real run button?
  let delegated = false;
  if (run) run.addEventListener('click', () => { delegated = true; });
  if (an) an.click();
  return {
    hasRow: !!(an && dl && an.parentNode === dl.parentNode),
    anBeforeDl: !!(an && dl && (an.compareDocumentPosition(dl) & Node.DOCUMENT_POSITION_FOLLOWING)),
    runHidden: !!(run && getComputedStyle(run).display === 'none'),
    delegated,
    jdAboveReport: !!(jdBlock && report && (jdBlock.compareDocumentPosition(report) & Node.DOCUMENT_POSITION_FOLLOWING)),
    anText: an ? an.textContent : null,
  };
});
await browser.close(); await new Promise(r2 => server.close(r2));
console.log(JSON.stringify(r, null, 1));
console.log('app errors:', errs.length, errs.slice(0, 2).join(' | '));
const A = r.hasRow && r.anBeforeDl;
const B = r.runHidden;
const C = r.delegated;
const D = r.jdAboveReport;
console.log(`CHECK A (Analyse JD beside Download in the EXPORT & DETAIL row): ${A ? 'PASS' : 'FAIL'}`);
console.log(`CHECK B (in-block Analyse button hidden while row button exists): ${B ? 'PASS' : 'FAIL'}`);
console.log(`CHECK C (row button delegates click to the real run button): ${C ? 'PASS' : 'FAIL'}`);
console.log(`CHECK D (JD-input block sits above the report block): ${D ? 'PASS' : 'FAIL'}`);
const ok = A && B && C && D && errs.length === 0;
console.log(ok ? 'ANALYSE-JD-ROW OK (4/4)' : 'ANALYSE-JD-ROW FAIL');
process.exitCode = ok ? 0 : 1;
