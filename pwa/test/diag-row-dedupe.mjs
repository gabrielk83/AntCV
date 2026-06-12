/* DIAGNOSTIC — ROW-CONTROLS-DEDUPE-001 (1.50.388). Two halves:
 *   A) SYNTHETIC duplication: a fake editor row carrying TWO page-split
 *      buttons + TWO fit buttons → the guard hides the second of each,
 *      keeps singles (enhance/delete) untouched, and the report names them.
 *   B) NO FALSE POSITIVES in the real app: boot the full editor with
 *      labeled_list + table + outcomes, expand each, assert ZERO buttons
 *      get data-antcv-deduped (the native sets are clean one-per-row).
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

// ── A: synthetic page loading just the sidecar ──
const SIDE = await readFile(path.join(ROOT, 'antcv-row-controls-dedupe-388.js'), 'utf8');
const SYN = `<!doctype html><html><body>
<div class="antcv-editor-side-panel">
  <div id="row1">
    <input value="Delivered">
    <button id="p1" title="Start this row on page 2">📄1</button>
    <button id="p2" title="Move this row and all following to the next page">↧</button>
    <button id="f1" title="Fit this row – tighten">⇥</button>
    <button id="f2" title="Compress this row">⇥</button>
    <button id="e1" title="Enrich this row">✨</button>
    <button id="d1" title="Delete">✕</button>
  </div>
  <div id="row2">
    <input value="Other">
    <button id="q1" title="Start this row on page 2">📄1</button>
  </div>
</div>
<script>${SIDE}</script>
</body></html>`;
const browser = await chromium.launch();
{
  const page = await browser.newPage();
  await page.setContent(SYN, { waitUntil: 'load' });
  await page.waitForTimeout(2200);
  const a = await page.evaluate(()=>{
    const vis = (id)=>{ const e=document.getElementById(id); return e && getComputedStyle(e).display !== 'none'; };
    return { p1:vis('p1'), p2:vis('p2'), f1:vis('f1'), f2:vis('f2'), e1:vis('e1'), d1:vis('d1'), q1:vis('q1'),
      report: window.AntcvRowDedupe.report().map(r=>r.cls).sort().join(',') };
  });
  const aOk = a.p1 && !a.p2 && a.f1 && !a.f2 && a.e1 && a.d1 && a.q1 && a.report === 'fit,page';
  console.log(`A synthetic dedupe (hide 2nd page+fit, keep rest): ${aOk?'OK':'FAIL'} ${aOk?'':JSON.stringify(a)}`);
  await page.close();
  if (!aOk) { await browser.close(); await new Promise(r=>server.close(r)); console.log('ROW-DEDUPE FAILED'); process.exit(1); }
}

// ── B: real app, no false positives ──
const sections={cv:[
  {id:'tools',title:'TOOLS & METHODS',loc:'sidebar',on:true,type:'labeled_list',items:[{l:'Engineering',v:'Python, MATLAB'},{l:'Methods',v:'Lean, FMEA'}]},
  {id:'core_comp',title:'CORE COMPETENCIES',loc:'main',on:true,type:'table',rows:[['Focus','Expertise'],['Hardware','Modular platforms.']]},
  {id:'outcomes',title:'SELECTED OUTCOMES',loc:'main',on:true,type:'bullets',items:[{b:'Cut',t:'cycle time 95%'}]},
],cl:[]};
const page = await browser.newPage({ viewport:{ width:1500, height:1100 } });
await page.addInitScript((secs)=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify(secs));
  localStorage.setItem('personalInfo',JSON.stringify({name:'Anita'}));
},sections);
const errs=[];
page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(6000);
const b = await page.evaluate(async ()=>{
  const open=Array.from(document.querySelectorAll('button')).find(x=>/☰\s*Sections/.test(x.textContent||''));
  if(open){ open.click(); await new Promise(r=>setTimeout(r,1000)); }
  for (const title of ['TOOLS','CORE COMPETENCIES','SELECTED OUTCOMES']) {
    const row=Array.from(document.querySelectorAll('[data-section-row-index]')).find(r=>(r.textContent||'').includes(title));
    if(row){ row.click(); await new Promise(r=>setTimeout(r,1300)); }
  }
  window.AntcvRowDedupe.sweep();
  await new Promise(r=>setTimeout(r,400));
  return { deduped: document.querySelectorAll('[data-antcv-deduped]').length };
});
await browser.close(); await new Promise(r=>server.close(r));
const bOk = b.deduped === 0 && errs.length === 0;
console.log(`B real app — zero false positives: ${bOk?'OK':'FAIL'} ${bOk?'':JSON.stringify({...b, errs: errs.slice(0,2)})}`);
console.log(bOk ? 'ROW-DEDUPE OK' : 'ROW-DEDUPE FAILED');
process.exit(bOk ? 0 : 1);
