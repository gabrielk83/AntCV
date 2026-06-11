/* DIAGNOSTIC — PHOTO-SIDEBAR-BRIDGE-001 (preview half). Boots the CV preview
 * with a photo in BRIDGE mode (photoPosition='band-overlap') and asserts:
 *   1. the medallion's vertical MIDLINE sits on the header/sidebar seam
 *      (sidebar top) within a small tolerance;
 *   2. the candidate band's text is inset by the sidebar width (the split
 *      header cell) — name block starts right of the photo zone;
 *   3. control: in default 'sidebar-top' mode the photo sits fully BELOW the
 *      seam and the band text is NOT inset. */
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
// 1x1 red png
const PHOTO='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const sections={cv:[
  {id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'Profile text. '.repeat(12)},
  {id:'tools',title:'TOOLS & METHODS',loc:'sidebar',on:true,type:'labeled_list',items:[{l:'Engineering',v:'Python, MATLAB'}]},
],cl:[]};

async function boot(browser,photoPosition){
  const page=await browser.newPage({viewport:{width:1600,height:1100}});
  await page.addInitScript(({secs,photo,pos})=>{
    localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
    localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
    localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
    localStorage.setItem('sections',JSON.stringify(secs));
    localStorage.setItem('personalInfo',JSON.stringify({name:'Anita Tester'}));
    localStorage.setItem('photo',JSON.stringify(photo));
    localStorage.setItem('photoPosition',JSON.stringify(pos));
  },{secs:sections,photo:PHOTO,pos:photoPosition});
  page.on('pageerror',e=>errs.push('pageerror: '+(e&&e.message)));
  await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
  await page.waitForTimeout(6000);
  const r=await page.evaluate(()=>{
    const paper=document.querySelector('.antcv-preview-paper');
    if(!paper)return{ok:false,why:'no paper'};
    const sb=paper.querySelector('.antcv-document-sidebar');
    if(!sb)return{ok:false,why:'no sidebar'};
    const img=sb.querySelector('img');
    if(!img)return{ok:false,why:'no photo img in sidebar'};
    const seamY=sb.getBoundingClientRect().top;
    const ir=img.getBoundingClientRect();
    const midY=ir.top+ir.height/2;
    // band = the navy div directly above the page rows containing the name
    const name=Array.from(paper.querySelectorAll('div')).find(d=>d.childElementCount===0&&(d.textContent||'').trim()==='Anita Tester');
    const band=name?name.parentElement:null;
    const bandCS=band?getComputedStyle(band):null;
    const paperTop=paper.getBoundingClientRect().top;
    // first sidebar headline = first non-photo content block in the sidebar
    const firstSec=Array.from(sb.children).find(c=>!c.querySelector('img')&&(c.textContent||'').trim());
    const headTop=firstSec?firstSec.getBoundingClientRect().top:null;
    return{ok:true,seamY:Math.round(seamY),photoTop:Math.round(ir.top),photoMid:Math.round(midY),
      photoH:Math.round(ir.height),
      midOnSeam:Math.abs(midY-seamY),
      gapAbove:Math.round(ir.top-paperTop),
      gapBelow:headTop!=null?Math.round(headTop-(ir.top+ir.height)):null,
      bandPadLeft:bandCS?bandCS.paddingLeft:null,
      sbWidth:Math.round(sb.getBoundingClientRect().width)};
  });
  await page.close();
  return r;
}
const errs=[];
const browser=await chromium.launch();
const bridge=await boot(browser,'band-overlap');
const normal=await boot(browser,'sidebar-top');
// LIVE SWITCH (1.50.367): picking the bridge in-session must engage WITHOUT a
// reload — the ◐ button calls window._antcvSetPhotoPosition.
const livePage=await browser.newPage({viewport:{width:1600,height:1100}});
await livePage.addInitScript(({secs,photo})=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify(secs));
  localStorage.setItem('personalInfo',JSON.stringify({name:'Anita Tester'}));
  localStorage.setItem('photo',JSON.stringify(photo));
  localStorage.setItem('photoPosition',JSON.stringify('sidebar-top'));
},{secs:sections,photo:PHOTO});
await livePage.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await livePage.waitForTimeout(6000);
const live=await livePage.evaluate(async()=>{
  if(typeof window._antcvSetPhotoPosition!=='function')return{hook:false};
  window._antcvSetPhotoPosition('band-overlap');
  await new Promise(r=>setTimeout(r,1500));
  const sb=document.querySelector('.antcv-preview-paper .antcv-document-sidebar');
  const img=sb&&sb.querySelector('img');
  if(!sb||!img)return{hook:true,ok:false};
  const seamY=sb.getBoundingClientRect().top;
  const ir=img.getBoundingClientRect();
  return{hook:true,ok:true,midOnSeam:Math.abs(ir.top+ir.height/2-seamY),
    stored:localStorage.getItem('photoPosition')};
});
await livePage.close();
await browser.close();await new Promise(r2=>server.close(r2));
console.log('bridge:',JSON.stringify(bridge));
console.log('normal:',JSON.stringify(normal));
console.log('live switch:',JSON.stringify(live));
console.log('app errors:',errs.length,errs.slice(0,2).join(' | '));
// Round 2: text flows ~28px left over the seam; native size = base ×1.3;
// equal air above (page top → photo) and below (photo → first headline).
const bridgeOk=bridge.ok&&bridge.midOnSeam<=4
  &&parseFloat(bridge.bandPadLeft)>=bridge.sbWidth-34
  &&parseFloat(bridge.bandPadLeft)<=bridge.sbWidth-20;
const sizeOk=bridge.photoH>=Math.round(normal.photoH*1.3)-2;
const gapsOk=bridge.gapBelow!=null&&Math.abs(bridge.gapAbove-bridge.gapBelow)<=8;
const normalOk=normal.ok&&normal.photoTop>=normal.seamY-1
  &&parseFloat(normal.bandPadLeft)<60; // default band padding, no split
const liveOk=live.hook&&live.ok&&live.midOnSeam<=4;
console.log('bridge seam+leftflow:',bridgeOk?'OK':'FAIL','| native 1.3x size:',sizeOk?'OK':'FAIL',`(${normal.photoH}->${bridge.photoH})`,'| equal gaps:',gapsOk?'OK':'FAIL',`(${bridge.gapAbove}/${bridge.gapBelow})`,'| normal untouched:',normalOk?'OK':'FAIL','| live switch:',liveOk?'OK':'FAIL');
const ok=bridgeOk&&sizeOk&&gapsOk&&normalOk&&liveOk&&errs.length===0;
console.log(ok?'PHOTO-BRIDGE OK':'PHOTO-BRIDGE FAILED');
process.exit(ok?0:1);
