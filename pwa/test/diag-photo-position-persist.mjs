/* DIAGNOSTIC — PHOTO-PREVIEW-ALT-PERSIST-001. The owner reported (2026-06-07
 * era) that an ALT photo position did not survive a reload. The positions are
 * native app state now (er ← localStorage photoPosition at mount). This test
 * BOOTS (cold) with three representative stored positions and asserts each
 * renders correctly on first paint — i.e. the stored position is honoured
 * without any live switching. Reload persistence == cold-boot correctness.
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

const PHOTO='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const sections={cv:[
  {id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'Profile text. '.repeat(12)},
  {id:'tools',title:'TOOLS',loc:'sidebar',on:true,type:'labeled_list',items:[{l:'Eng',v:'Python'}]},
],cl:[]};

const browser=await chromium.launch();

async function bootWith(pos){
  const page=await browser.newPage({viewport:{width:1600,height:1100}});
  await page.addInitScript(({secs,photo,p})=>{
    localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
    localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
    localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
    localStorage.setItem('sections',JSON.stringify(secs));
    localStorage.setItem('personalInfo',JSON.stringify({name:'Anita Tester'}));
    localStorage.setItem('photo',JSON.stringify(photo));
    localStorage.setItem('photoPosition',JSON.stringify(p));
  },{secs:sections,photo:PHOTO,p:pos});
  const errs=[];
  page.on('pageerror',e=>errs.push(String(e&&e.message)));
  await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
  await page.waitForTimeout(6000);
  const r=await page.evaluate((p)=>{
    const paper=document.querySelector('.antcv-preview-paper');
    if(!paper)return{ok:false,why:'no paper'};
    const imgs=Array.from(paper.querySelectorAll('img'));
    if(p==='none')return{ok:imgs.length===0,n:imgs.length};
    if(imgs.length!==1)return{ok:false,n:imgs.length};
    const img=imgs[0];const ir=img.getBoundingClientRect();
    const sb=paper.querySelector('.antcv-document-sidebar');
    const main=paper.querySelector('.antcv-document-main');
    if(p==='bridge-middle'){
      const seamX=sb.getBoundingClientRect().right;
      return{ok:Math.abs((ir.left+ir.width/2)-seamX)<=4,seamX:Math.round(seamX),cx:Math.round(ir.left+ir.width/2)};
    }
    if(p==='main-right'){
      const mr=main.getBoundingClientRect();
      const right=(ir.left+ir.width/2)>=(mr.left+mr.width/2);
      const circ=/circle/.test(getComputedStyle(img).shapeOutside||'');
      return{ok:main.contains(img)&&right&&circ,right,circ};
    }
    return{ok:false,why:'unknown pos'};
  },pos);
  await page.close();
  return{pos,...r,errs};
}

const results=[];
for(const p of ['bridge-middle','main-right','none'])results.push(await bootWith(p));
await browser.close();await new Promise(r=>server.close(r));
for(const r of results)console.log(`cold boot ${r.pos}: ${r.ok?'OK':'FAIL'}${r.ok?'':' '+JSON.stringify(r)}`);
const ok=results.every(r=>r.ok&&r.errs.length===0);
console.log(ok?'PHOTO-POSITION-PERSIST OK':'PHOTO-POSITION-PERSIST FAILED');
process.exit(ok?0:1);
