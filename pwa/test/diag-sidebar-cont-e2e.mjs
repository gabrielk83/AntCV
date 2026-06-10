/* DIAGNOSTIC — PDF sidebar (Cont.) END-TO-END (owner 2026-06-10: preview splits
 * REGULATORY CONTEXT but the exported PDF shows no "(Cont.)" / no move to page 2).
 * Chains the REAL pipeline: full-app render → REAL measurer writes antcv:autoPages
 * → REAL docx-client builds the /generate payload (captured) → REAL docx-worker
 * renders it → assert document.xml splits the sidebar list with a
 * "REGULATORY CONTEXT (CONT.)" heading on a 2nd page-table.
 * Run: node test/diag-sidebar-cont-e2e.mjs */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.webmanifest':'application/manifest+json','.woff':'font/woff','.woff2':'font/woff2' };
const server = http.createServer(async (req, res) => { try { let rel = decodeURIComponent((req.url||'/').split('?')[0]); if (rel==='/') rel='/index.html'; const fp = path.join(ROOT, rel); const s = await stat(fp).catch(()=>null); if (!s||!s.isFile()) { res.writeHead(404); res.end('nf'); return; } res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); } catch(e){ res.writeHead(500); res.end(String(e)); } });
await new Promise(r => server.listen(0, r));
const port = server.address().port;

// Grouped REGULATORY CONTEXT, long enough to overflow one A4 sidebar, with a
// couple of hidden items mixed in (the owner's real data has hidden entries).
const reg = [];
const GROUPS = ['Sensing & imaging', 'Systems & safety', 'Environmental & EMC'];
for (let g = 0; g < GROUPS.length; g++) {
  reg.push({ group: GROUPS[g] });
  const per = g === 0 ? 9 : 6;
  for (let e = 0; e < per; e++) {
    const it = { l: 'STD ' + g + '.' + e, v: 'Applicable framework and obligations described across several wrapped lines of regulatory context text.' };
    if (g === 0 && e === 2) it.hidden = true; // a hidden item before the likely break
    reg.push(it);
  }
}
const sections = { cv: [
  { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', text:'Short profile.' },
  { id:'regctx', title:'REGULATORY CONTEXT', loc:'sidebar', on:true, type:'labeled_list', items: reg },
], cl: [] };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{ width:1400, height:1000 } });
let captured = null;
await page.route('**/generate', async route => {
  try { captured = JSON.parse(route.request().postData() || '{}'); } catch (e) { captured = { __err: String(e) }; }
  await route.fulfill({ status:200, contentType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document', headers:{'Access-Control-Allow-Origin':'*'}, body:'PK' });
});
await page.addInitScript((secs) => {
  localStorage.setItem('antcv:auth:token','t'); localStorage.setItem('antcv:auth:email','d@e.com'); localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session', JSON.stringify({ email:'d@e.com', ts:1717000000000 }));
  localStorage.setItem('step', JSON.stringify('editor')); localStorage.setItem('doc', JSON.stringify('cv'));
  localStorage.setItem('sections', JSON.stringify(secs));
  localStorage.setItem('personalInfo', JSON.stringify({ name:'Anita Myre', location:'Copenhagen' }));
  window.ANTCV_DOCX_WORKER = 'https://docx-worker.example.com';
  window.__DIAG_SECTIONS = secs;
}, sections);
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:'load', timeout:30000 });
await page.waitForTimeout(6000); // let the REAL measurer settle and write antcv:autoPages

const maps = await page.evaluate(() => ({
  autoPages: localStorage.getItem('antcv:autoPages'),
  autoPagesPreview: localStorage.getItem('antcv:autoPagesPreview'),
}));
console.log('autoPages       :', maps.autoPages);
console.log('autoPagesPreview:', maps.autoPagesPreview);

await page.evaluate(async () => { try { await window.exportDocxViaWorker({ sections: window.__DIAG_SECTIONS, doc:'cv', personalInfo:{ name:'Anita Myre', location:'Copenhagen' }, styleConfig:{}, fontSizes:{}, language:'en', navyColor:'#283556' }); } catch (e) {} });
await page.waitForTimeout(400);
await browser.close(); await new Promise(r => server.close(r));

if (!captured || captured.__err) { console.log('NO /generate payload captured', captured && captured.__err); process.exit(1); }
const reg2 = (captured.sections || []).find(s => s.id === 'regctx');
const pagedItems = (reg2 && reg2.items || []).map((it, i) => ({ i, page: it && it._page })).filter(x => x.page >= 2);
console.log('regctx items with _page>=2 in payload:', JSON.stringify(pagedItems));

// What the REAL measurer wrote into the EXPORT map (antcv:autoPages).
let exportMap = {};
try { exportMap = JSON.parse(maps.autoPages || '{}').regctx || {}; } catch (_) {}
const exportBreakIdx = Object.keys(exportMap).filter((k) => Number(exportMap[k]) >= 2).map(Number);

// This guard covers the PREVIEW→CLIENT half end-to-end with the REAL measurer:
//   A. the measurer wrote a regctx break into the EXPORT map (antcv:autoPages),
//      not only the preview map;
//   B. the docx-client forwarded that exact break as items[idx]._page>=2 on the
//      /generate payload (so the worker's sidebar-list split engages).
// The CLIENT→WORKER half (the split emits "REGULATORY CONTEXT (CONT.)" on a 2nd
// page-table) is covered by workers/docx-worker/test/diag-twocol-ownerlike.mjs,
// which feeds the worker items[idx]._page=2 and asserts the (Cont.) heading.
const A = exportBreakIdx.length > 0;
const B = pagedItems.length > 0 && exportBreakIdx.includes(pagedItems[0].i);
console.log(`CHECK A (REAL measurer wrote a regctx break into the EXPORT map antcv:autoPages): ${A ? 'PASS' : 'FAIL'}`);
console.log(`CHECK B (docx-client forwarded that exact break as items[${exportBreakIdx.join(',')}]._page>=2): ${B ? 'PASS' : 'FAIL'}`);
const ok = A && B;
console.log(ok ? 'SIDEBAR-CONT-E2E OK (measurer→client forwards the export break; worker (Cont.) covered by diag-twocol-ownerlike)' : 'SIDEBAR-CONT-E2E FAIL');
process.exit(ok ? 0 : 1);
