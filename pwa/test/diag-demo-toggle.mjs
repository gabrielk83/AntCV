/* DIAGNOSTIC — DEMO-TOGGLE-001. Opens Settings → Standard → Account, asserts
 * the ACCOUNT MODE toggle renders, clicks 🟡 Demo and verifies:
 * AntcvSetUserMode('demo') was invoked, localStorage antcv:user-mode-cloud
 * mirrors the choice, the reconcile event fired, the reload hint shows, and
 * the block is re-injected after a simulated React wipe. */
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
const sections={cv:[{id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'Profile text. '.repeat(20)}],cl:[]};
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1400,height:1000}});
await page.addInitScript((secs)=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify(secs));localStorage.setItem('personalInfo',JSON.stringify({name:'A'}));
  localStorage.setItem('antcv:user-mode-cloud','paid');
},sections);
const errs=[];
page.on('pageerror',e=>errs.push('pageerror: '+(e&&e.message)));
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(5000);
// spy on AntcvSetUserMode + the reconcile event
await page.evaluate(()=>{
  window.__modeCalls=[];window.__reconciled=[];
  const orig=window.AntcvSetUserMode;
  window.AntcvSetUserMode=(m)=>{window.__modeCalls.push(m);return orig?orig(m):Promise.resolve();};
  window.addEventListener('antcv:user-mode-reconciled',(ev)=>window.__reconciled.push(ev.detail&&ev.detail.mode));
});
await page.evaluate(()=>{window._antcvOpenSettingsRoute({tier:'standard',subtab:'account'});});
await page.waitForTimeout(2000);
const phase1=await page.evaluate(()=>{
  const block=document.querySelector('[data-antcv-demo-toggle="1"]');
  if(!block)return{present:false};
  const demo=block.querySelector('[data-antcv-demo-toggle-btn="demo"]');
  const paid=block.querySelector('[data-antcv-demo-toggle-btn="paid"]');
  return{present:true,hasBoth:!!(demo&&paid)};
});
let clicked=null;
if(phase1.present){
  await page.locator('[data-antcv-demo-toggle-btn="demo"]').click();
  await page.waitForTimeout(800);
  clicked=await page.evaluate(()=>({
    calls:window.__modeCalls,
    reconciled:window.__reconciled,
    ls:localStorage.getItem('antcv:user-mode-cloud'),
    meta:(()=>{try{return JSON.parse(localStorage.getItem('antcv:user-mode-cloud-meta')||'null');}catch(_){return null;}})(),
    hintShown:(()=>{const h=document.querySelector('[data-antcv-demo-toggle-hint="1"]');return!!(h&&getComputedStyle(h).display!=='none');})(),
  }));
}
// React-wipe resilience: remove the block, expect re-injection
await page.evaluate(()=>{const b=document.querySelector('[data-antcv-demo-toggle="1"]');if(b)b.remove();document.body.appendChild(document.createElement('i')).remove();});
await page.waitForTimeout(1500);
const phase2=await page.evaluate(()=>!!document.querySelector('[data-antcv-demo-toggle="1"]'));
await browser.close();await new Promise(r2=>server.close(r2));
console.log('toggle rendered in Account subtab:',JSON.stringify(phase1));
console.log('after click:',JSON.stringify(clicked));
console.log('re-injected after wipe:',phase2);
console.log('app errors:',errs.length,errs.slice(0,2).join(' | '));
const ok=phase1.present&&phase1.hasBoth
  &&clicked&&clicked.calls.includes('demo')&&clicked.ls==='demo'
  &&clicked.reconciled.includes('demo')&&clicked.meta&&clicked.meta.source==='settings-toggle'
  &&clicked.hintShown&&phase2&&errs.length===0;
console.log(ok?'DEMO-TOGGLE OK':'DEMO-TOGGLE FAILED');
process.exit(ok?0:1);
