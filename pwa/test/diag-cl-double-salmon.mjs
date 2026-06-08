/* DIAGNOSTIC — CL-DOUBLE-SALMON-001 (owner 2026-06-09): the CL measurer wrote a
 * hard-coded "page 2" break for EVERY section whose bottom sat past clLimit — so a
 * section living entirely on page 2 got its own spurious "▼ PAGE 2 ▼" bar (two
 * salmons for the same page). Fix: only break sections that SPAN a page boundary,
 * and label with the real cumulative page.
 *
 * Loads ONLY the measurer against a synthetic CL flow with known heights:
 *   greeting/opening : page 1            (no span)
 *   contribute       : spans page 1→2    (PRE-SEEDED broken / sticky)
 *   foundation       : entirely page 2   (MUST NOT be broken — was the bug)
 *   tail             : spans page 2→3    (MUST break at page 3, not 2)
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MEASURER = await readFile(path.join(ROOT, 'antcv-auto-pagebreak-block-001.js'), 'utf8');

// Stack fixed-height blocks in one flow column (top:0). Heights chosen so the
// page lines (USABLE≈1053 preview, USABLE_PDF≈924 export) fall as described above.
const block = (sid, h, label) => `<div data-sid="${sid}" style="height:${h}px;overflow:hidden">${label}</div>`;
const HTML = `<!doctype html><html><head><meta charset=utf8></head><body>
<div data-antcv-cl-flow="true" style="position:absolute;top:0;left:0;width:800px">
  ${block('greeting', 80, 'Dear Hiring Manager,')}
  ${block('opening', 820, 'Opening + WHO I AM body...')}
  ${block('contribute', 500, 'HOW I WOULD CONTRIBUTE (pre-broken)')}
  ${block('foundation', 400, 'FOUNDATION — entirely page 2')}
  ${block('tail', 500, 'CLOSING — spans into page 3')}
</div>
<script>${MEASURER}</script>
</body></html>`;
// cumulative tops: greeting 0, opening 80, contribute 900, foundation 1400, tail 1800, end 2300
const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(HTML); });
await new Promise(r => server.listen(0, r));
const port = server.address().port;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
await page.addInitScript(() => {
  localStorage.setItem('doc', JSON.stringify('cl'));
  localStorage.setItem('sections', JSON.stringify({ cv: [], cl: [
    { id: 'greeting', type: 'text', loc: 'main', on: true, title: '' },
    { id: 'opening', type: 'text', loc: 'main', on: true, title: '' },
    { id: 'contribute', type: 'text_bullets', loc: 'main', on: true, title: 'HOW I WOULD CONTRIBUTE', intro: 'x', items: ['a', 'b'], closing: 'c' },
    { id: 'foundation', type: 'foundation', loc: 'main', on: true, title: 'FOUNDATION', hands_on: 'x', professionally: 'y' },
    { id: 'tail', type: 'text', loc: 'main', on: true, title: '' },
  ] }));
  // PRE-SEED contribute as already broken in BOTH maps so the measurer skips it
  // (sticky) and we exercise the sections AFTER it — exactly the bug window.
  localStorage.setItem('antcv:autoPages', JSON.stringify({ contribute: { bullet_1: 2 } }));
  localStorage.setItem('antcv:autoPagesPreview', JSON.stringify({ contribute: { bullet_1: 2 } }));
  localStorage.setItem('antcv:itemPages', '{}');
});
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + (e && e.message)));
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(4000);
const r = await page.evaluate(() => {
  const j = (k) => { try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch (_) { return {}; } };
  return { ap: j('antcv:autoPages'), app: j('antcv:autoPagesPreview') };
});
await browser.close(); await new Promise(r => server.close(r));
console.log('autoPages       :', JSON.stringify(r.ap));
console.log('autoPagesPreview:', JSON.stringify(r.app));
console.log('app errors:', errs.length, errs.slice(0, 2).join(' | '));
const foundationBroken = !!(r.ap.foundation || r.app.foundation);
const tailPrev = r.app.tail ? Number(Object.values(r.app.tail)[0]) : 0;
const tailExp = r.ap.tail ? Number(Object.values(r.ap.tail)[0]) : 0;
console.log('foundation broken (should be FALSE):', foundationBroken);
console.log('tail preview page (should be 3):', tailPrev, '| tail export page (should be 3):', tailExp);
const A = !foundationBroken;            // page-2-internal section not spuriously broken
const B = tailPrev === 3 && tailExp === 3; // spanning section labeled with the REAL page
const ok = A && B && errs.length === 0;
console.log(`CHECK A (no spurious page-2 break for foundation): ${A ? 'PASS' : 'FAIL'}`);
console.log(`CHECK B (tail spans into page 3 → labeled 3): ${B ? 'PASS' : 'FAIL'}`);
console.log(ok ? 'CL-DOUBLE-SALMON OK' : 'CL-DOUBLE-SALMON FAIL');
process.exit(ok ? 0 : 1);
