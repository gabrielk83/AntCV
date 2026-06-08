/* DIAGNOSTIC — 1.50.316 PREVIEW-A4-FILL decouple + CL table row-break.
 * Two synthetic CL scenarios loaded against the measurer in isolation:
 *  (1) text_bullets: assert the EXPORT map (antcv:autoPages, 924px line) breaks
 *      EARLIER than the PREVIEW map (antcv:autoPagesPreview, true-A4 1053px line).
 *  (2) table: assert BOTH maps write a numeric row break (drives renderCompetencyTable). */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MEASURER = await readFile(path.join(ROOT, 'antcv-auto-pagebreak-block-001.js'), 'utf8');

function bulletsHtml() {
  let b = '<div data-antcv-cl-item-key="intro" style="height:40px">Intro</div>';
  for (let i = 0; i < 30; i++) b += `<div data-antcv-cl-item-key="bullet_${i}" style="height:62px;line-height:20px">Bullet ${i}</div>`;
  return `<div data-sid="hiwc" style="width:800px">${b}</div>`;
}
function tableHtml() {
  let rows = '';
  for (let i = 0; i < 30; i++) rows += `<tr style="height:55px"><td>Area ${i}</td><td>Detail ${i} lorem ipsum dolor sit amet consectetur.</td></tr>`;
  return `<div data-sid="wib" style="width:800px"><table style="width:800px"><thead><tr style="height:40px"><th>Focus</th><th>Detail</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
async function run(scenario, inner, secList) {
  const HTML = `<!doctype html><html><head><meta charset=utf8></head><body>
  <div data-antcv-cl-flow="true" style="position:absolute;top:0;left:0;width:800px">${inner}</div>
  <script>${MEASURER}</script></body></html>`;
  const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(HTML); });
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.addInitScript((secs) => {
    localStorage.setItem('doc', JSON.stringify('cl'));
    localStorage.setItem('sections', JSON.stringify({ cv: [], cl: secs }));
    localStorage.setItem('antcv:autoPages', '{}');
    localStorage.setItem('antcv:autoPagesPreview', '{}');
    localStorage.setItem('antcv:itemPages', '{}');
  }, secList);
  const errs = [];
  page.on('pageerror', e => errs.push(String(e && e.message)));
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(4000);
  const r = await page.evaluate(() => ({
    exp: JSON.parse(localStorage.getItem('antcv:autoPages') || '{}'),
    prev: JSON.parse(localStorage.getItem('antcv:autoPagesPreview') || '{}'),
  }));
  await browser.close(); await new Promise(r => server.close(r));
  return { ...r, errs };
}

// Scenario 1 — text_bullets decouple
const s1 = await run('bullets', bulletsHtml(), [{ id: 'hiwc', type: 'text_bullets', on: true, loc: 'main', title: 'HOW I WOULD CONTRIBUTE', intro: 'x', items: Array.from({ length: 30 }, (_, i) => 'b' + i), closing: 'c' }]);
const expKey = Object.keys(s1.exp.hiwc || {}).find(k => /^bullet_/.test(k));
const prevKey = Object.keys(s1.prev.hiwc || {}).find(k => /^bullet_/.test(k));
const expIdx = expKey ? Number(expKey.split('_')[1]) : -1;
const prevIdx = prevKey ? Number(prevKey.split('_')[1]) : -1;
console.log('[bullets] export break:', expKey, '| preview break:', prevKey);
const okBullets = expIdx > 0 && prevIdx > expIdx && s1.errs.length === 0;
console.log('[bullets] preview breaks LATER than export (fills A4):', okBullets);

// Scenario 2 — table row-break
const s2 = await run('table', tableHtml(), [{ id: 'wib', type: 'table', on: true, loc: 'main', title: 'WHAT I BRING', rows: [['Focus', 'Detail'], ...Array.from({ length: 30 }, (_, i) => ['Area ' + i, 'Detail ' + i])] }]);
const expRow = Object.keys(s2.exp.wib || {}).find(k => /^\d+$/.test(k));
const prevRow = Object.keys(s2.prev.wib || {}).find(k => /^\d+$/.test(k));
console.log('[table] export row break:', expRow, '| preview row break:', prevRow);
const okTable = Number(expRow) >= 1 && Number(prevRow) >= 1 && Number(prevRow) >= Number(expRow) && s2.errs.length === 0;
console.log('[table] both maps row-break, preview >= export:', okTable);

const ok = okBullets && okTable;
console.log(ok ? 'PREVIEW-A4-TABLE OK' : 'PREVIEW-A4-TABLE INCOMPLETE');
process.exit(ok ? 0 : 1);
