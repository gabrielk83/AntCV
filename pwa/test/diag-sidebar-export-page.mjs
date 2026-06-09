/* DIAGNOSTIC — per-page export, CLIENT half (export review 2026-06-09 "per page").
 * Confirms the docx-client forwards the SIDEBAR auto-break as item._page (so the
 * worker's per-page model engages), COORDINATED with the main experience break.
 * With autoPages = {experience:{1:2}, regctx:{4:2}} the captured /generate payload
 * must carry regctx.items[4]._page === 2 AND experience.roles[1].page === 2. */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.webmanifest':'application/manifest+json','.woff':'font/woff','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{try{let rel=decodeURIComponent((req.url||'/').split('?')[0]);if(rel==='/')rel='/index.html';const fp=path.join(ROOT,rel);const s=await stat(fp).catch(()=>null);if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;}res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'});res.end(await readFile(fp));}catch(e){res.writeHead(500);res.end(String(e));}});
await new Promise(r=>server.listen(0,r));
const port=server.address().port;
const reg=[{group:'Sensing'},{l:'ISO 12233',v:'res'},{l:'ISO 15739',v:'noise'},{l:'EMVA 1288',v:'sensor'},{group:'Systems'},{l:'ISO 26262',v:'safety'},{l:'ASPICE',v:'process'}];
const sections={cv:[
  {id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'P'},
  {id:'experience',title:'PROFESSIONAL EXPERIENCE',loc:'main',on:true,type:'experience',roles:[
    {id:'r1',title:'Role One',company:'C1',years:'2018',on:true,bullets:['a']},
    {id:'r2',title:'Role Two',company:'C2',years:'2020',on:true,bullets:['b']},
  ]},
  {id:'regctx',title:'REGULATORY CONTEXT',loc:'sidebar',on:true,type:'labeled_list',items:reg},
],cl:[]};
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1400,height:1000}});
let captured=null;
await page.route('**/antcv-auto-pagebreak-block-001.js*', route=>route.fulfill({status:200,contentType:'text/javascript',body:'/* blocked */'}));
await page.route('**/generate', async route=>{ try{ captured=JSON.parse(route.request().postData()||'{}'); }catch(e){ captured={__err:String(e)}; } await route.fulfill({status:200,contentType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',headers:{'Access-Control-Allow-Origin':'*'},body:'PK'}); });
await page.addInitScript((secs)=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
  // coordinated auto breaks: experience role idx1 -> p2 ; regctx item idx4 (2nd group) -> p2
  localStorage.setItem('antcv:autoPages', JSON.stringify({ experience:{'1':2}, regctx:{'4':2} }));
  localStorage.setItem('antcv:itemPages','{}');
  window.ANTCV_DOCX_WORKER='https://docx-worker.example.com';
  window.__DIAG_SECTIONS=secs;
}, sections);
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(1200);
await page.evaluate(async ()=>{ try{ await window.exportDocxViaWorker({ sections: window.__DIAG_SECTIONS, doc:'cv', personalInfo:{name:'G'}, styleConfig:{}, fontSizes:{}, language:'en', navyColor:'#283556' }); }catch(e){} });
await page.waitForTimeout(400);
await browser.close(); await new Promise(r=>server.close(r));
if(!captured){ console.log('NO /generate POST captured'); process.exit(1); }
const secs=Array.isArray(captured.sections)?captured.sections:[];
const reg2=secs.find(s=>s.id==='regctx');
const exp=secs.find(s=>s.type==='experience');
const regItem4=reg2&&Array.isArray(reg2.items)?reg2.items[4]:null;
const role1=exp&&Array.isArray(exp.roles)?exp.roles[1]:null;
console.log('regctx item[4]:', JSON.stringify(regItem4));
console.log('experience role[1]:', JSON.stringify(role1));
const A = regItem4 && Number(regItem4._page)===2;          // sidebar break forwarded as _page
const B = role1 && Number(role1.page)===2;                 // main break coordinated at same page
console.log(`CHECK A (sidebar labeled_list item._page=2 forwarded): ${A?'PASS':'FAIL'}`);
console.log(`CHECK B (experience role.page=2 coordinated): ${B?'PASS':'FAIL'}`);
console.log(A&&B ? 'SIDEBAR-EXPORT-PAGE OK' : 'SIDEBAR-EXPORT-PAGE FAIL');
process.exit(A&&B?0:1);
