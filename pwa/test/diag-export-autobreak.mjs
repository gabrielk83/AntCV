/* DIAGNOSTIC — SALMON-AUTO-EXPORT-001 (experience + table). Calls
 * window.exportDocxViaWorker with auto breaks in localStorage, intercepts the
 * /generate POST, and asserts the payload carries effective role.page + row_pages. */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.webmanifest':'application/manifest+json','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf'};
const server=http.createServer(async(req,res)=>{try{let rel=decodeURIComponent((req.url||'/').split('?')[0]);if(rel==='/')rel='/index.html';const fp=path.join(ROOT,rel);const s=await stat(fp).catch(()=>null);if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;}res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'});res.end(await readFile(fp));}catch(e){res.writeHead(500);res.end(String(e));}});
await new Promise(r=>server.listen(0,r));
const port=server.address().port;
const rows=[['Focus','Expertise']];for(let i=1;i<=30;i++)rows.push(['Comp '+i,'Exp '+i]);
const sections={cv:[
  {id:'core',title:'CORE COMPETENCIES',loc:'main',on:true,type:'table',rows},
  {id:'experience',title:'PROFESSIONAL EXPERIENCE',loc:'main',on:true,type:'experience',roles:[
    {id:'r1',title:'A',company:'C1',years:'2010',on:true,bullets:['b']},
    {id:'r2',title:'B',company:'C2',years:'2012',on:true,bullets:['b']},
    {id:'r3',title:'C',company:'C3',years:'2014',on:true,bullets:['b']},
    {id:'r4',title:'D',company:'C4',years:'2016',on:true,bullets:['b']},
  ]},
  {id:'skills',title:'KEY SKILLS',loc:'sidebar',on:true,type:'labeled_list',items:[{l:'X'},{l:'Y'}]},
],cl:[]};
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1400,height:1000}});
let captured=null;
// Block the auto-pagebreak measurer so it can't overwrite our injected
// antcv:autoPages — we are testing the EXPORT client's forwarding in isolation.
await page.route('**/antcv-auto-pagebreak-block-001.js*', route=>route.fulfill({status:200,contentType:'text/javascript',body:'/* blocked for diag */'}));
await page.route('**/generate', async route=>{
  try{ captured = JSON.parse(route.request().postData()||'{}'); }catch(e){ captured={__parseError:String(e)}; }
  await route.fulfill({status:200, contentType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document', headers:{'Access-Control-Allow-Origin':'*'}, body:'PK'});
});
await page.addInitScript((secs)=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
  // auto breaks: experience role 2 -> page 2; core table row 26 -> page 2
  localStorage.setItem('antcv:autoPages', JSON.stringify({ experience:{'2':2}, core:{'26':2} }));
  localStorage.setItem('antcv:itemPages','{}');
  window.ANTCV_DOCX_WORKER='https://docx-worker.example.com';
  window.__DIAG_SECTIONS=secs;
}, sections);
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(1500);
const callRes = await page.evaluate(async ()=>{
  try {
    await window.exportDocxViaWorker({ sections: window.__DIAG_SECTIONS, doc:'cv',
      personalInfo:{name:'A'}, styleConfig:{}, fontSizes:{}, language:'en', navyColor:'#283556' });
    return 'called';
  } catch(e){ return 'export-threw: '+(e&&e.message); }
});
await page.waitForTimeout(500);
await browser.close();await new Promise(r=>server.close(r));
console.log('export call:', callRes);
if(!captured){ console.log('NO /generate POST captured'); process.exit(1); }
const secs = Array.isArray(captured.sections)?captured.sections:[];
const exp = secs.find(s=>s.type==='experience');
const core = secs.find(s=>s.id==='core');
console.log('SECTION IDS:', JSON.stringify(secs.map(s=>({id:s.id,type:s.type,keys:Object.keys(s)}))));
console.log('CORE FULL:', JSON.stringify(core));
const expPages = exp ? (exp.roles||[]).map(r=>r.page||1) : [];
const coreRowPages = core ? (core.row_pages||null) : null;
console.log('experience role pages:', JSON.stringify(expPages));
console.log('core row_pages:', JSON.stringify(coreRowPages));
const A = exp && expPages.length===4 && expPages[0]===1 && expPages[1]===1 && expPages[2]===2 && expPages[3]===2; // role 2 -> pg2 + cascade
const B = coreRowPages && Number(coreRowPages['26'])===2;
console.log('CHECK experience effective role.page (cascade from role idx2):', A?'PASS':'FAIL');
console.log('CHECK table effective row_pages[26]=2:', B?'PASS':'FAIL');
console.log(A&&B ? 'EXPORT-AUTOBREAK OK' : 'EXPORT-AUTOBREAK FAIL');
