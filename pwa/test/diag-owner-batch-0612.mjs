/* DIAGNOSTIC — owner batch 2026-06-12 PM, behavioural halves:
 *   1. OUTCOMES-MODE-001 default: outcomes section renders, NO per-role
 *      "Results:" line;
 *   2. outcomesMode='results': outcomes section HIDDEN, the matching role
 *      carries a "Results:" line with the outcome text, unmatched outcomes
 *      attach to the first visible role;
 *   3. the Display selector buttons render in the outcomes editor;
 *   4. QUICK-GEN-001: the checkbox renders on the upload step, default
 *      unchecked, toggling sets window.__antcvQuickGen (session-only);
 *   5. analysis-foreground divert in the export modal: with the foreground
 *      check stubbed true, Save-as-PDF calls the analysis exporter and
 *      closes the modal (no CV print).
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

const sections={cv:[
  {id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'Profile.'},
  {id:'outcomes',title:'SELECTED OUTCOMES',loc:'main',on:true,type:'bullets',items:[
    {b:'Cut',t:'Innoviz change cycle from 250 to 10 days.'},
    {b:'Built',t:'an optical lab with structured acceptance tests.'},
  ]},
  {id:'experience',title:'PROFESSIONAL EXPERIENCE',loc:'main',on:true,type:'experience',roles:[
    {id:'r0',title:'Change Control Lead',company:'Innoviz Technologies',years:'2020–2025',bullets:['Owned change governance.']},
    {id:'r1',title:'Optics Engineer',company:'Sirin Labs',years:'2014–2017',bullets:['Led optical stack.']},
  ]},
],cl:[]};

const browser=await chromium.launch();
async function boot({mode, step}={}) {
  const page=await browser.newPage({viewport:{width:1500,height:1100}});
  await page.addInitScript(({secs,mode,step})=>{
    localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
    localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
    localStorage.setItem('step',JSON.stringify(step||'editor'));localStorage.setItem('doc',JSON.stringify('cv'));
    localStorage.setItem('sections',JSON.stringify(secs));
    localStorage.setItem('personalInfo',JSON.stringify({name:'Anita'}));
    if(mode) localStorage.setItem('outcomesMode',JSON.stringify(mode));
  },{secs:sections,mode,step});
  const errs=[];
  page.on('pageerror',e=>errs.push(String(e&&e.message)));
  await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
  await page.waitForTimeout(6000);
  return {page, errs};
}

const checks=[];
const check=(n,ok,d)=>{checks.push(ok);console.log(`${n}: ${ok?'OK':'FAIL'}${ok?'':' '+(d||'')}`)};

// 1 — default mode
{
  const {page,errs}=await boot({});
  const r=await page.evaluate(()=>({
    so: !!document.querySelector('.antcv-preview-paper [data-sid="outcomes"]'),
    results: document.querySelectorAll('[data-antcv-role-results]').length,
  }));
  check('default: outcomes section shown, no Results lines', r.so && r.results===0 && errs.length===0, JSON.stringify(r));
  await page.close();
}
// 2 — results mode
{
  const {page,errs}=await boot({mode:'results'});
  const r=await page.evaluate(()=>{
    const lines=Array.from(document.querySelectorAll('[data-antcv-role-results]')).map(e=>({i:e.getAttribute('data-antcv-role-results'),txt:(e.textContent||'').slice(0,90)}));
    return {
      so: !!document.querySelector('.antcv-preview-paper [data-sid="outcomes"]'),
      lines,
    };
  });
  const innovizLine=r.lines.find(l=>l.txt.includes('Innoviz change cycle'));
  const firstRoleLine=r.lines.find(l=>l.i==='0');
  const unmatchedOnFirst=firstRoleLine && firstRoleLine.txt.includes('optical lab');
  check('results mode: section hidden, matched + unmatched Results lines',
    !r.so && !!innovizLine && unmatchedOnFirst && errs.length===0, JSON.stringify(r));
  await page.close();
}
// 3 — editor selector buttons
{
  const {page}=await boot({});
  const r=await page.evaluate(async ()=>{
    const open=Array.from(document.querySelectorAll('button')).find(b=>/☰\s*Sections/.test(b.textContent||''));
    if(open){ open.click(); await new Promise(r2=>setTimeout(r2,1000)); }
    const row=Array.from(document.querySelectorAll('[data-section-row-index]')).find(r2=>/OUTCOMES/.test(r2.textContent||''));
    if(row){ row.click(); await new Promise(r2=>setTimeout(r2,1300)); }
    const btns=Array.from(document.querySelectorAll('.antcv-editor-side-panel button')).map(b=>(b.textContent||'').trim());
    return { hasSection: btns.includes('Outcomes section'), hasResults: btns.includes('Results per role') };
  });
  check('editor Display selector renders', r.hasSection && r.hasResults, JSON.stringify(r));
  await page.close();
}
// 4 — quick-gen checkbox on the upload step
{
  const {page,errs}=await boot({step:'upload'});
  const r=await page.evaluate(()=>{
    const cb=document.querySelector('input[data-antcv-quickgen]');
    if(!cb) return {found:false};
    const before=window.__antcvQuickGen;
    cb.click();
    const after=window.__antcvQuickGen;
    return {found:true, defaultUnchecked: before===undefined||before===false, flagAfter: after===true};
  });
  check('quick-gen checkbox: present, default off, flag toggles', r.found && r.defaultUnchecked && r.flagAfter && errs.length===0, JSON.stringify(r));
  await page.close();
}
// 5 — analysis divert in the export modal
{
  const {page,errs}=await boot({});
  const r=await page.evaluate(async ()=>{
    let exported=0;
    window.AntcvPrintIframePreview = window.AntcvPrintIframePreview || {};
    window.AntcvPrintIframePreview._analysisViewIsForeground = () => true;
    window.AntcvAnalysisReportPdf360 = window.AntcvAnalysisReportPdf360 || {};
    window.AntcvAnalysisReportPdf360._export = () => { exported++; };
    window.AntcvPdfPreviewGate.open();
    await new Promise(r2=>setTimeout(r2,800));
    const print=document.getElementById('antcv-pdf-preview-modal-print');
    if(print) print.click();
    await new Promise(r2=>setTimeout(r2,400));
    return { exported, modalGone: !document.getElementById('antcv-pdf-preview-modal-backdrop') };
  });
  check('Save-as-PDF diverts to the analysis exporter when foreground', r.exported===1 && r.modalGone && errs.length===0, JSON.stringify(r));
  await page.close();
}

await browser.close(); await new Promise(r=>server.close(r));
const ok=checks.every(Boolean);
console.log(ok?'OWNER-BATCH-0612 OK':'OWNER-BATCH-0612 FAILED');
process.exit(ok?0:1);
