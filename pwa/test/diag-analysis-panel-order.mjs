/* DIAGNOSTIC — analysis panel section ORDER (owner 2026-06-09). Assumptions +
 * Recommendations must sit just BELOW "Overall Fit" (upper part), and Confidence
 * Review must sit ABOVE the Download button. Loads ONLY antcv-analysis-report-pdf-360
 * against a synthetic panel (header + an "Overall Fit" section) with a seeded
 * rationale, then asserts the DOM placement. */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SIDE = await readFile(path.join(ROOT, 'antcv-analysis-report-pdf-360.js'), 'utf8');
const HTML = `<!doctype html><html><head><meta charset=utf8></head><body>
<div class="antcv-editor-side-panel">
  <div>📊 Application Analysis</div>
  <div id="ovf"><div>Overall Fit</div><p>Strong fit for the role.</p></div>
  <div id="sfp"><div>Strongest Fit Points</div><ul><li>x</li></ul></div>
  <div id="gaps"><div>Gaps / Honest Assessment</div></div>
</div>
<script>${SIDE}</script>
</body></html>`;
const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(HTML); });
await new Promise(r => server.listen(0, r));
const port = server.address().port;
const browser = await chromium.launch();
const page = await browser.newPage();
await page.addInitScript(() => {
  localStorage.setItem('rationale', JSON.stringify({
    fit_summary: 'Strong fit for the role.',
    assumptions: ['LiDAR experience is transferable'],
    recommendations: ['Highlight optical systems experience'],
    confidence_notes: [{ text: 'supercontinuum gap', confidence: 0.0, issue: 'not stated' }],
  }));
  localStorage.setItem('meta', JSON.stringify({ role: 'PM', company: 'NKT' }));
  localStorage.setItem('personalInfo', JSON.stringify({ name: 'G K' }));
});
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + (e && e.message)));
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(1200);
const r = await page.evaluate(() => {
  const panel = document.querySelector('.antcv-editor-side-panel');
  const top = document.getElementById('antcv-analysis-report-top');
  const bottom = document.getElementById('antcv-analysis-report');
  const ovf = document.getElementById('ovf');
  const T = (el) => (el ? (el.textContent || '') : '');
  // order helper: index of a node among panel children (by DOM walk)
  const kids = panel ? Array.from(panel.children) : [];
  const idxOf = (el) => kids.indexOf(el);
  // within the bottom block, is the Confidence group before the download row?
  let confBeforeDl = false;
  if (bottom) {
    const dl = bottom.querySelector('.arx-dl');
    const conf = Array.prototype.find.call(bottom.querySelectorAll('.arx-grp'), g => /confidence/i.test(g.textContent || ''));
    if (dl && conf) confBeforeDl = (conf.compareDocumentPosition(dl) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  }
  return {
    hasTop: !!top, hasBottom: !!bottom,
    topAfterOvf: !!(top && ovf && ovf.nextElementSibling === top),
    topText: T(top).replace(/\s+/g, ' ').slice(0, 80),
    topHasAssum: /assumptions/i.test(T(top)) && /LiDAR/i.test(T(top)),
    topHasRecs: /recommendations/i.test(T(top)) && /optical systems/i.test(T(top)),
    bottomHasConf: /confidence/i.test(T(bottom)),
    bottomHasDl: !!(bottom && bottom.querySelector('.arx-dl')),
    confBeforeDl,
    bottomHasAssumRecs: /your assumptions|LiDAR|optical systems/i.test(T(bottom)),
    topIdx: idxOf(top), bottomIdx: idxOf(bottom), ovfIdx: idxOf(ovf),
  };
});
await browser.close(); await new Promise(r => server.close(r));
console.log(JSON.stringify(r, null, 1));
console.log('app errors:', errs.length, errs.slice(0, 2).join(' | '));
const A = r.hasTop && r.topAfterOvf && r.topHasAssum && r.topHasRecs;        // A+R just below Overall Fit
const B = r.hasBottom && r.bottomHasConf && r.bottomHasDl && r.confBeforeDl; // Confidence above Download
const C = !r.bottomHasAssumRecs;                                            // A+R removed from the bottom block
const D = r.topIdx > r.ovfIdx && r.bottomIdx > r.topIdx;                    // overall order: Overall Fit → top → … → bottom
console.log(`CHECK A (Assumptions+Recommendations just below Overall Fit): ${A ? 'PASS' : 'FAIL'}`);
console.log(`CHECK B (Confidence Review above the Download button): ${B ? 'PASS' : 'FAIL'}`);
console.log(`CHECK C (A+R no longer in the bottom block): ${C ? 'PASS' : 'FAIL'}`);
console.log(`CHECK D (panel order Overall Fit → A+R → … → bottom): ${D ? 'PASS' : 'FAIL'}`);
const ok = A && B && C && D && errs.length === 0;
console.log(ok ? 'ANALYSIS-PANEL-ORDER OK' : 'ANALYSIS-PANEL-ORDER FAIL');
process.exitCode = ok ? 0 : 1;
