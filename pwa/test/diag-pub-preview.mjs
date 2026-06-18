/* DIAGNOSTIC — PUB-CHAIN-001 preview parity. A non-academic CV preview shows
 * publication title + year only (the academic path is the unchanged original). */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json' };
const server = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}});
await new Promise(r=>server.listen(0,r));
const port=server.address().port, base=`http://127.0.0.1:${port}`;
const PUB='Self-assembling SWCNT-FET sensors — Journal of Nanotechnology, Vol 12, Elsevier, pp 45-60, 2018';
const SECTIONS={cv:[
  {id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'IT expert.'},
  {id:'publications',title:'PUBLICATIONS & PATENTS',loc:'sidebar',on:true,type:'list_italic',items:[PUB]},
],cl:[]};
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1300,height:1200}});
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.addInitScript(({sections})=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','g@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'g@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify(sections));
  localStorage.setItem('personalInfo',JSON.stringify({name:'G',stylePrefs:{style:'nordic-minimal'}}));
  localStorage.setItem('language',JSON.stringify('en'));localStorage.setItem('wizardCompleted',JSON.stringify(true));
  localStorage.setItem('stylePackage',JSON.stringify('copenhagen-modern'));
},{sections:SECTIONS});
await page.goto(base+'/index.html',{waitUntil:'load',timeout:30000});
await page.waitForTimeout(3500);
// innerText excludes <script> content; restrict to the rendered preview paper.
const txt = await page.evaluate(()=>{
  const p = document.querySelector('.antcv-preview-paper') || document.querySelector('.antcv-document-sidebar') || document.getElementById('root');
  return (p ? (p.innerText||'') : '').replace(/\s+/g,' ').trim();
});
await browser.close(); await new Promise(x=>server.close(x));
const checks=[]; const check=(n,ok,d)=>{checks.push(ok);console.log(`${n}: ${ok?'OK':'FAIL'}${ok?'':' '+(d||'')}`)};
console.log('non-academic preview text:', JSON.stringify(txt.slice(0,400)));
check('non-academic: title shown', /SWCNT-FET sensors/.test(txt));
check('non-academic: year shown', /2018/.test(txt));
check('non-academic: chain DROPPED (no Journal/Elsevier)', !/Journal of Nanotechnology|Elsevier/.test(txt));
check('no page errors', errs.length===0, errs.slice(0,2).join(' | '));
const ok=checks.every(Boolean);
console.log(ok?'PUB-PREVIEW OK':'PUB-PREVIEW FAIL');
process.exit(ok?0:1);
