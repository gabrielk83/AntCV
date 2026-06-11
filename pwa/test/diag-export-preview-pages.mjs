/* DIAGNOSTIC — EXPORT-PAGE2-001 + EXPORT-PREVIEW-FEATURES-001(c).
 * Boots a 2-page CV (long sidebar list → 2 native page-rows), opens the
 * export-preview modal (antcv-pdf-preview-gate.js) and asserts:
 *   1. the modal title counts PAGE-ROWS, not papers ("· 2 pages");
 *   2. the iframe clone carries BOTH page-rows and the page-2 content;
 *   3. the print CSS keys breaks on .antcv-page-row (the native pagination)
 *      and drops the 10mm sheet margin for the full-A4 page-row boxes;
 *   4. the page-selector chips render (one per page) and chip 2 scrolls the
 *      iframe to the second page-row.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml' };
const server = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}});
await new Promise(r=>server.listen(0,r));
const port = server.address().port;

const reg = [];
for (let g = 0; g < 3; g++) {
  reg.push({ group: 'Group ' + g });
  const per = g === 0 ? 16 : 4;
  for (let e = 0; e < per; e++) reg.push({ l: 'Reg ' + g + '.' + e, v: 'Detailed regulatory context line describing the applicable framework, scope and obligations in some depth across several wrapped lines of text.' });
}
const sections = { cv: [
  { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', text:'Short profile line.' },
  { id:'regctx', title:'REGULATORY CONTEXT', loc:'sidebar', on:true, type:'labeled_list', items: reg },
], cl: [] };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{ width:1400, height:1000 } });
await page.addInitScript((secs)=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session', JSON.stringify({ email:'d@e.com', ts:1717000000000 }));
  localStorage.setItem('step', JSON.stringify('editor'));
  localStorage.setItem('doc', JSON.stringify('cv'));
  localStorage.setItem('sections', JSON.stringify(secs));
  localStorage.setItem('personalInfo', JSON.stringify({ name:'Anita Tester' }));
}, sections);
const errs=[];
page.on('pageerror',e=>errs.push('pageerror: '+(e&&e.message)));
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(6500);

const r = await page.evaluate(async ()=>{
  const srcRows = document.querySelectorAll('.antcv-page-row').length;
  window.AntcvPdfPreviewGate.open();
  await new Promise(r2=>setTimeout(r2,1500));
  const title = (document.getElementById('antcv-pdf-preview-modal-title')||{}).textContent || '';
  const ifr = document.getElementById('antcv-pdf-preview-modal-iframe');
  const d = ifr && ifr.contentDocument;
  const css = d ? Array.from(d.querySelectorAll('style')).map(s=>s.textContent||'').join('\n') : '';
  const pager = document.getElementById('antcv-pdf-preview-modal-pager');
  const chips = pager ? Array.from(pager.querySelectorAll('button')).map(b=>b.textContent) : [];
  // chip 2 scrolls the iframe to page-row 2
  let scrolled = false;
  if (pager && chips.length === 2 && d) {
    const before = d.documentElement.scrollTop;
    pager.querySelectorAll('button')[1].click();
    await new Promise(r2=>setTimeout(r2,900));
    const rows = d.querySelectorAll('.antcv-page-row');
    const r2top = rows.length > 1 ? rows[1].getBoundingClientRect().top : 9999;
    scrolled = d.documentElement.scrollTop > before + 100 || Math.abs(r2top) < 200;
  }
  return {
    srcRows,
    title,
    iframeRows: d ? d.querySelectorAll('.antcv-page-row').length : -1,
    page2Content: d ? d.body.textContent.includes('Reg 2.3') : false,
    rowBreakCss: css.includes('.antcv-page-row + .antcv-page-row'),
    zeroMargin: /@page \{ size: A4; margin: 0; \}/.test(css),
    chips,
    scrolled,
  };
});
await browser.close(); await new Promise(r2=>server.close(r2));

const checks = [
  ['2 native page-rows in source', r.srcRows === 2],
  ['title counts page-rows', /· 2 pages/.test(r.title)],
  ['iframe carries both rows', r.iframeRows === 2],
  ['page-2 content in iframe', r.page2Content],
  ['print CSS breaks on page-rows', r.rowBreakCss],
  ['zero sheet margin for native rows', r.zeroMargin],
  ['2 pager chips', r.chips.length === 2],
  ['chip 2 scrolls to page 2', r.scrolled],
];
for (const [n, ok] of checks) console.log(`${n}: ${ok ? 'OK' : 'FAIL'}`);
console.log('app errors:', errs.length, errs.slice(0,2).join(' | '));
if (!checks.every(c=>c[1])) console.log('detail:', JSON.stringify(r));
const ok = checks.every(c=>c[1]) && errs.length===0;
console.log(ok ? 'EXPORT-PREVIEW-PAGES OK' : 'EXPORT-PREVIEW-PAGES FAILED');
process.exit(ok ? 0 : 1);
