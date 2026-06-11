/* DIAGNOSTIC — PHOTO-POSITIONS-NATIVE-001. Boots the CV preview once and
 * live-switches through EVERY photo position via _antcvSetPhotoPosition,
 * asserting each renders natively:
 *   hidden        → no photo in the paper
 *   sidebar-top   → img in the sidebar, at/below the seam
 *   sidebar-bottom→ img in the sidebar, below the last sidebar section
 *   header-left/right → img inside the candidate band, on that side
 *   main-left/right   → img inside the main column, on that side
 *   band-overlap  → midline on the seam (the bridge)
 */
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
const PHOTO='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const sections={cv:[
  {id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'Profile text. '.repeat(12)},
  {id:'tools',title:'TOOLS & METHODS',loc:'sidebar',on:true,type:'labeled_list',items:[{l:'Engineering',v:'Python, MATLAB'}]},
],cl:[]};
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1600,height:1100}});
await page.addInitScript(({secs,photo})=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify(secs));
  localStorage.setItem('personalInfo',JSON.stringify({name:'Anita Tester'}));
  localStorage.setItem('photo',JSON.stringify(photo));
  localStorage.setItem('photoPosition',JSON.stringify('sidebar-top'));
},{secs:sections,photo:PHOTO});
const errs=[];
page.on('pageerror',e=>errs.push('pageerror: '+(e&&e.message)));
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(6000);

async function probe(pos){
  return await page.evaluate(async(pos)=>{
    window._antcvSetPhotoPosition(pos);
    await new Promise(r=>setTimeout(r,1200));
    const paper=document.querySelector('.antcv-preview-paper');
    const sb=paper.querySelector('.antcv-document-sidebar');
    const main=paper.querySelector('.antcv-document-main');
    const band=paper.querySelector('[data-antcv-candidate-band="1"]');
    const imgs=Array.from(paper.querySelectorAll('img'));
    if(pos==='hidden')return{pos,ok:imgs.length===0,n:imgs.length};
    if(imgs.length!==1)return{pos,ok:false,n:imgs.length};
    const img=imgs[0];const r=img.getBoundingClientRect();
    const inSb=sb&&sb.contains(img),inMain=main&&main.contains(img),inBand=band&&band.contains(img);
    const seam=sb?sb.getBoundingClientRect().top:0;
    const paperMidX=paper.getBoundingClientRect().left+paper.getBoundingClientRect().width/2;
    const leftHalf=(r.left+r.width/2)<paperMidX;
    switch(pos){
      case 'sidebar-top':return{pos,ok:inSb&&r.top>=seam-1&&r.top<seam+120};
      case 'sidebar-bottom':{
        // below the last sidebar section block
        const blocks=Array.from(sb.children).filter(c=>!c.contains(img)&&(c.textContent||'').trim());
        const lastBottom=blocks.length?Math.max(...blocks.map(b=>b.getBoundingClientRect().bottom)):seam;
        return{pos,ok:inSb&&r.top>=lastBottom-2};
      }
      case 'band-overlap':return{pos,ok:inSb&&Math.abs(r.top+r.height/2-seam)<=4};
      case 'header-left':return{pos,ok:inBand&&leftHalf};
      case 'header-right':return{pos,ok:inBand&&!leftHalf};
      case 'main-left':return{pos,ok:inMain&&((r.left+r.width/2)<(main.getBoundingClientRect().left+main.getBoundingClientRect().width/2))};
      case 'main-right':return{pos,ok:inMain&&((r.left+r.width/2)>=(main.getBoundingClientRect().left+main.getBoundingClientRect().width/2))};
    }
    return{pos,ok:false};
  },pos);
}

const order=['hidden','header-left','header-right','main-left','main-right','sidebar-bottom','band-overlap','sidebar-top'];
const results=[];
for(const p of order)results.push(await probe(p));
await browser.close();await new Promise(r2=>server.close(r2));
for(const r of results)console.log(`${r.pos}: ${r.ok?'OK':'FAIL'}${r.n!==undefined?' (imgs '+r.n+')':''}`);
console.log('app errors:',errs.length,errs.slice(0,2).join(' | '));
const ok=results.every(r=>r.ok)&&errs.length===0;
console.log(ok?'PHOTO-POSITIONS OK':'PHOTO-POSITIONS FAILED');
process.exit(ok?0:1);
