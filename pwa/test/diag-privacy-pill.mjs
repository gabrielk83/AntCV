/* DIAGNOSTIC — PRIVACY-FAB-FLICKER-MOBILE-001 / PRIVACY-DEMO-001. Boots the
 * editor and asserts the privacy pill: (1) mounts and sits in the top-bar
 * tools row; (2) is recreated after a simulated React wipe of the top bar
 * button; (3) is recreated EVEN when the overlay stack is gone (the demo/
 * mobile condition that previously left it dead until an editor toggle);
 * (4) is visible (computed display/visibility) and stays put for 3s with no
 * disappearance ticks (flicker probe). */
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
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(6000);
const SEL='button[data-antcv-privacy-led-fab="1"]';
const visibleCheck=(SEL)=>{
  const pill=document.querySelector(SEL);
  if(!pill)return{present:false};
  const cs=getComputedStyle(pill);
  const r=pill.getBoundingClientRect();
  return{present:true,inTopTools:!!pill.closest('.antcv-top-tools'),
    visible:cs.display!=='none'&&cs.visibility!=='hidden'&&parseFloat(cs.opacity)>0&&r.width>0&&r.height>0};
};
const phase1=await page.evaluate(visibleCheck,SEL);
// (2) simulated React wipe of the relocated pill
await page.evaluate((SEL)=>{const p=document.querySelector(SEL);if(p&&p.parentNode)p.parentNode.removeChild(p);},SEL);
await page.waitForTimeout(3000);
const phase2=await page.evaluate((SEL)=>!!document.querySelector(SEL),SEL);
// (3) demo/mobile condition: remove the overlay stack entirely AND the pill
await page.evaluate((SEL)=>{
  document.querySelectorAll('.antcv-overlay-bottom-right').forEach(n=>n.remove());
  const p=document.querySelector(SEL);if(p&&p.parentNode)p.parentNode.removeChild(p);
},SEL);
await page.waitForTimeout(3000);
// Force the islands' applyPreviewActions hide pass (it runs on resize), then
// give the 347 sweep a beat to clear any inline hide it re-applies.
await page.evaluate(()=>{window.dispatchEvent(new Event('resize'));document.body.appendChild(document.createElement('i')).remove();});
await page.waitForTimeout(1500);
const phase3=await page.evaluate(visibleCheck,SEL);
// (4) flicker probe: sample every 100ms for 3s — pill must stay present+visible
const flicker=await page.evaluate(async(SEL)=>{
  let gone=0;
  for(let i=0;i<30;i++){
    const p=document.querySelector(SEL);
    const ok=p&&getComputedStyle(p).display!=='none'&&getComputedStyle(p).visibility!=='hidden';
    if(!ok)gone++;
    await new Promise(r=>setTimeout(r,100));
  }
  return gone;
},SEL);
await page.close();
// (5) mobile viewport — the reported device class. Pill must mount in the top
// bar and be visible there too.
const mpage=await browser.newPage({viewport:{width:390,height:844}});
await mpage.addInitScript((secs)=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify(secs));localStorage.setItem('personalInfo',JSON.stringify({name:'A'}));
},sections);
await mpage.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await mpage.waitForTimeout(6000);
const mobile=await mpage.evaluate(visibleCheck,SEL);
await mpage.close();
await browser.close();await new Promise(r2=>server.close(r2));
console.log('phase1 mount:',JSON.stringify(phase1));
console.log('phase2 recreated after wipe:',phase2);
console.log('phase3 recreated w/o overlay:',JSON.stringify(phase3));
console.log('flicker probe missing ticks (of 30):',flicker);
console.log('mobile (390px) mount:',JSON.stringify(mobile));
console.log('app errors:',errs.length,errs.slice(0,2).join(' | '));
const ok=phase1.present&&phase1.inTopTools&&phase1.visible&&phase2&&phase3.present&&phase3.inTopTools&&phase3.visible&&flicker===0&&mobile.present&&mobile.inTopTools&&mobile.visible&&errs.length===0;
console.log(ok?'PRIVACY-PILL OK':'PRIVACY-PILL FAILED');
process.exit(ok?0:1);
