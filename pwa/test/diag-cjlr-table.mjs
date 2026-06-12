/* DIAGNOSTIC — CJLR-TABLE-001 (1.50.383). The CORE COMPETENCIES per-row
 * CJLR is owned by antcv-core-competencies-row-controls-234.js (storage
 * antcv.coreCompetencies.rowAlignment.v1, "row-<i>" over the FULL rows
 * array). Locks the PREVIEW half that already existed: a stored
 * row-1 = center renders the first data row's cells centered while row 2
 * keeps the sidecar's left default. (Export parity is locked by
 * test/unit/table-align-forward.test.mjs + the worker's
 * diag-cjlr-table-export.mjs.) */
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
  {id:'core_comp',title:'CORE COMPETENCIES',loc:'main',on:true,type:'table',
   rows:[['Focus Area','Strategic Expertise'],['Hardware lead','CenterMeRowOne'],['Requirements','LeftRowTwo']]},
],cl:[]};

const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1600,height:1100}});
await page.addInitScript((secs)=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify(secs));
  localStorage.setItem('personalInfo',JSON.stringify({name:'Anita Tester'}));
  localStorage.setItem('antcv.coreCompetencies.rowAlignment.v1',JSON.stringify({ 'row-1':'center' }));
},sections);
const errs=[];
page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(7000);

const r=await page.evaluate(()=>{
  const paper=document.querySelector('.antcv-preview-paper');
  const tds=Array.from(paper.querySelectorAll('td'));
  const find=(txt)=>tds.find(td=>(td.textContent||'').includes(txt));
  const c1=find('CenterMeRowOne'), c2=find('LeftRowTwo');
  return {
    r1: c1 ? getComputedStyle(c1).textAlign : 'missing',
    r2: c2 ? getComputedStyle(c2).textAlign : 'missing',
  };
});
await browser.close();await new Promise(r2=>server.close(r2));

const checks=[
  ['row-1 expertise centered (234 sidecar applies stored value)', r.r1==='center'],
  ['row-2 keeps the left default', r.r2==='left'],
];
for(const [n,ok] of checks)console.log(`${n}: ${ok?'OK':'FAIL'}`);
if(!checks.every(c=>c[1]))console.log('detail:',JSON.stringify(r));
console.log('app errors:',errs.length,errs.slice(0,2).join('|'));
const ok=checks.every(c=>c[1])&&errs.length===0;
console.log(ok?'CJLR-TABLE OK':'CJLR-TABLE FAILED');
process.exit(ok?0:1);
