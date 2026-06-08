/* DIAGNOSTIC — CV sidebar PREVIEW-map break in isolation
 * (PB-PREVIEW-SIDEBAR-SALMON-PUSH-001).
 *
 * Builds a synthetic CV page-box with a `.antcv-document-sidebar` column holding
 * one labeled_list section (REGULATORY CONTEXT) whose grouped items overflow the
 * TRUE A4 line (USABLE ≈ 1053px). Loads ONLY the measurer sidecar and asserts it
 * writes a GROUP-START break into the PREVIEW map (antcv:autoPagesPreview[sid]),
 * not only the export map (antcv:autoPages). Without the preview-map break the
 * CV-preview-only read (__antcvAutoPB, doc!=='cl' → {}) returns no split, so the
 * whole sidebar renders in one page-box and PUSHES the salmon below A4. */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MEASURER = await readFile(path.join(ROOT, 'antcv-auto-pagebreak-block-001.js'), 'utf8');

// Sidebar labeled_list: 5 groups × (1 group label + 3 entries) = 20 items.
// Group-start indices = 0, 4, 8, 12, 16. Each row ~95px tall → total ~1900px,
// well past USABLE(1053). First overflow ~row 11 → snaps down to group start 8.
const N_GROUPS = 5, PER = 3;
const items = [];
let html = '';
for (let g = 0; g < N_GROUPS; g++) {
  const gi = items.length;
  items.push({ group: 'Group ' + g });
  html += `<div data-antcv-row-path="items.${gi}" style="height:34px;line-height:18px;font-weight:700">Group ${g}</div>`;
  for (let e = 0; e < PER; e++) {
    const ei = items.length;
    items.push({ text: 'Entry ' + g + '.' + e });
    html += `<div data-antcv-row-path="items.${ei}" style="height:95px;line-height:20px">Entry ${g}.${e} — regulatory context detail spanning a few wrapped lines for height.</div>`;
  }
}
const SID = 'regctx';
const HTML = `<!doctype html><html><head><meta charset=utf8></head><body>
<div style="position:absolute;top:0;left:0;width:760px;display:flex">
  <div class="antcv-document-sidebar" data-antcv-document-sidebar="true" style="width:250px">
    <div data-sid="${SID}" style="width:250px">${html}</div>
  </div>
  <div class="antcv-document-main" data-antcv-document-main="true" style="width:510px">
    <div data-sid="profile" style="width:510px"><div data-antcv-row-path="items.0" style="height:200px">Profile</div></div>
  </div>
</div>
<script>${MEASURER}</script>
</body></html>`;
const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(HTML); });
await new Promise(r => server.listen(0, r));
const port = server.address().port;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
await page.addInitScript(([sid, items]) => {
  localStorage.setItem('doc', JSON.stringify('cv'));
  localStorage.setItem('sections', JSON.stringify({ cl: [], cv: [
    { id: sid, type: 'labeled_list', on: true, loc: 'sidebar', title: 'REGULATORY CONTEXT', items },
    { id: 'profile', type: 'text', on: true, loc: 'main', title: 'PROFILE' }
  ] }));
  localStorage.setItem('antcv:autoPages', '{}');
  localStorage.setItem('antcv:autoPagesPreview', '{}');
  localStorage.setItem('antcv:itemPages', '{}');
}, [SID, items]);
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + (e && e.message)));
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(4000);
const r = await page.evaluate(() => {
  const j = (k) => { try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch (_) { return {}; } };
  return { autoPages: j('antcv:autoPages'), autoPagesPreview: j('antcv:autoPagesPreview'), installed: window.__antcvAutoPagebreakInstalled || null };
});
await browser.close(); await new Promise(r => server.close(r));
console.log('measurer installed:', r.installed);
console.log('autoPages (export):', JSON.stringify(r.autoPages));
console.log('autoPagesPreview   :', JSON.stringify(r.autoPagesPreview));
console.log('app errors:', errs.length, errs.slice(0, 2).join(' | '));
const exp = r.autoPages[SID] || {};
const prev = r.autoPagesPreview[SID] || {};
const expKeys = Object.keys(exp).filter(k => Number(exp[k]) >= 2);
const prevKeys = Object.keys(prev).filter(k => Number(prev[k]) >= 2);
console.log('export break keys :', JSON.stringify(expKeys));
console.log('preview break keys:', JSON.stringify(prevKeys));
const groupStarts = [0, 4, 8, 12, 16];
const prevIdx = prevKeys.length ? Number(prevKeys[0]) : -1;
const onGroup = groupStarts.includes(prevIdx);
console.log('preview break index:', prevIdx, 'on group start?', onGroup);
const ok = prevKeys.length === 1 && onGroup && errs.length === 0;
console.log(ok ? 'SIDEBAR-PREVIEW-BREAK OK' : 'SIDEBAR-PREVIEW-BREAK MISSING (bug reproduced)');
process.exit(ok ? 0 : 1);
