/* DIAGNOSTIC — HARDREFRESH-001. Opens Settings (Account subtab hosts the
 * "↻ Hard Refresh" button), clicks it, accepts the confirm dialog, and asserts
 * the page actually reloads (navigation observed within 5s). Covers the
 * editor route (the modal mounts there since 1.50.355). */
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
},sections);
const errs=[];
page.on('pageerror',e=>errs.push('pageerror: '+(e&&e.message)));
let dialogSeen=null;
page.on('dialog',async d=>{dialogSeen=d.message().slice(0,60);await d.accept();});
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(4000);
// Reload once so the service worker CONTROLS the page (the owner's failure
// condition) — on first load the SW is registered but not yet controlling.
await page.reload({waitUntil:'load'});
await page.waitForTimeout(4000);
const swControlled=await page.evaluate(()=>!!(navigator.serviceWorker&&navigator.serviceWorker.controller));
await page.evaluate(()=>{window._antcvOpenSettingsRoute({tier:'standard',subtab:'account'});});
await page.waitForTimeout(1500);
const btn=page.locator('button',{hasText:'Hard Refresh'}).first();
const btnVisible=await btn.isVisible().catch(()=>false);
let reloaded=false;
if(btnVisible){
  const nav=page.waitForNavigation({timeout:5000}).then(()=>true).catch(()=>false);
  await btn.click();
  reloaded=await nav;
}
await browser.close();await new Promise(r2=>server.close(r2));
console.log('service worker controlling:',swControlled);
console.log('hard-refresh button visible:',btnVisible);
console.log('confirm dialog shown:',JSON.stringify(dialogSeen));
console.log('page reloaded after OK:',reloaded);
console.log('app errors:',errs.length,errs.slice(0,2).join(' | '));
const ok=btnVisible&&!!dialogSeen&&reloaded&&errs.length===0;
console.log(ok?'HARDREFRESH OK':'HARDREFRESH FAILED');
process.exit(ok?0:1);
