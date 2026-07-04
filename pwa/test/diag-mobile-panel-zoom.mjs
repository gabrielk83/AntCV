/* DIAGNOSTIC — MOBILE-PANEL-ZOOM-001 (register row 46, owner mobile P0).
 * On a phone at 100% zoom the options cluster under "Generate CV & Cover Letter"
 * (Quick generation / Speed pills / Cap $ / Brand fit) is CLIPPED — the Brand-fit
 * row falls off the bottom of the viewport. Reproduce at a 380px-wide phone
 * viewport, then walk UP from the Brand-fit row to find the ancestor that clips
 * (overflow hidden/clip while scrollHeight > clientHeight) — the fix target. */
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
const errs=[];
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:380,height:780},deviceScaleFactor:2,isMobile:true,hasTouch:true});
await page.addInitScript(()=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('personalInfo',JSON.stringify({name:'Anita Tester',email:'a@t.dk'}));
  localStorage.setItem('proxyUrl','https://cv-proxy.karp-gabriel-a.workers.dev');
  // land on the generate/upload screen with a JD present so the whole cluster renders
  localStorage.setItem('step',JSON.stringify('upload'));
  localStorage.setItem('antcv:lastJdText','We are hiring a product manager for a hardware platform. '.repeat(20));
});
page.on('pageerror',e=>errs.push('pageerror: '+(e&&e.message)));
// allow the app + the React CDN; block only the app backends (relay/proxy/workers)
await page.route('**/*',r=>{const u=r.request().url();if(/workers\.dev|access-relay|cv-proxy|demo-proxy|cloudconvert|c2pa/i.test(u))return r.abort();return r.continue();});
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(6000);

const report=await page.evaluate(()=>{
  const norm=s=>(s||'').replace(/\s+/g,' ').trim();
  // find the Brand-fit control (label text contains "Brand fit")
  let brand=null;
  const all=Array.from(document.querySelectorAll('label,div,span,button'));
  for(const el of all){ if(/brand fit/i.test(norm(el.textContent))&&el.querySelectorAll('*').length<6){brand=el;break;} }
  const genBtn=Array.from(document.querySelectorAll('button')).find(b=>/generate cv/i.test(norm(b.textContent)));
  const vh=window.innerHeight,vw=window.innerWidth;
  const out={vh,vw,brandFound:!!brand,genFound:!!genBtn};
  if(genBtn){const r=genBtn.getBoundingClientRect();out.genRect={top:Math.round(r.top),bottom:Math.round(r.bottom)};}
  if(brand){
    const r=brand.getBoundingClientRect();
    out.brandRect={top:Math.round(r.top),bottom:Math.round(r.bottom)};
    out.brandBelowFold=r.bottom>vh; out.brandTopBelowFold=r.top>vh;
    // walk ancestors, report overflow/height and whether it clips
    const chain=[];
    let node=brand;
    while(node&&node!==document.documentElement){
      const cs=getComputedStyle(node);
      const clips=(cs.overflowY==='hidden'||cs.overflowY==='clip'||cs.overflow==='hidden'||cs.overflow==='clip');
      const scrolls=(cs.overflowY==='auto'||cs.overflowY==='scroll');
      const truncated=node.scrollHeight>node.clientHeight+2;
      chain.push({
        tag:node.tagName.toLowerCase(),
        cls:norm(node.className&&node.className.toString&&node.className.toString()).slice(0,40),
        data:Object.keys(node.dataset||{}).slice(0,3).join(','),
        h:node.clientHeight, sh:node.scrollHeight,
        overflowY:cs.overflowY, height:cs.height, maxHeight:cs.maxHeight, position:cs.position,
        clips, scrolls, truncated,
        CLIP_SUSPECT: clips&&truncated,
      });
      node=node.parentElement;
    }
    out.ancestors=chain;
    out.firstClipSuspect=chain.find(c=>c.CLIP_SUSPECT)||null;
  }
  return out;
});
console.log('viewport:',report.vw+'x'+report.vh,'| genBtn:',JSON.stringify(report.genRect),'| brandFound:',report.brandFound);
if(report.brandRect){
  console.log('brandRect:',JSON.stringify(report.brandRect),'| brandBelowFold:',report.brandBelowFold,'brandTopBelowFold:',report.brandTopBelowFold);
}
console.log('FIRST CLIP SUSPECT:',JSON.stringify(report.firstClipSuspect,null,1));
console.log('--- ancestor chain (brand -> root) ---');
(report.ancestors||[]).forEach((c,i)=>console.log(`[${i}] <${c.tag}> cls="${c.cls}" data="${c.data}" h=${c.h} sh=${c.sh} ovY=${c.overflowY} height=${c.height} maxH=${c.maxHeight} pos=${c.position} ${c.CLIP_SUSPECT?'<<< CLIP SUSPECT':''}`));
console.log('app errors:',errs.length,errs.slice(0,3).join(' | '));

// Reachability test: scroll the nearest scrollable ancestor of the brand row to
// the bottom, then confirm the brand row is fully within the viewport. This is
// the real acceptance criterion — the cluster must be REACHABLE at 100% zoom,
// whether or not it fits above the fold initially.
const reach=await page.evaluate(()=>{
  const norm=s=>(s||'').replace(/\s+/g,' ').trim();
  let brand=null;
  for(const el of Array.from(document.querySelectorAll('label,div,span,button'))){ if(/brand fit/i.test(norm(el.textContent))&&el.querySelectorAll('*').length<6){brand=el;break;} }
  if(!brand) return {ok:false,why:'brand not found'};
  // find nearest scrollable ancestor
  let sc=brand.parentElement;
  while(sc&&sc!==document.documentElement){ const cs=getComputedStyle(sc); if((cs.overflowY==='auto'||cs.overflowY==='scroll')&&sc.scrollHeight>sc.clientHeight+2) break; sc=sc.parentElement; }
  const hadScroller=!!(sc&&sc!==document.documentElement);
  if(hadScroller) sc.scrollTop=sc.scrollHeight;
  return new Promise(res=>setTimeout(()=>{
    const r=brand.getBoundingClientRect();
    res({ok:true,hadScroller,afterScroll:{top:Math.round(r.top),bottom:Math.round(r.bottom)},vh:window.innerHeight,fullyVisible:r.top>=0&&r.bottom<=window.innerHeight+1});
  },250));
});
await browser.close();server.close();
console.log('reachability:',JSON.stringify(reach));
const clipGone=report.firstClipSuspect===null;
const reachable=reach.ok&&reach.fullyVisible;
const pass=clipGone&&reachable&&errs.length===0;
console.log(pass?'DIAG PASS — no clip; Brand-fit reachable by scroll within the viewport':'DIAG FAIL — clip present or Brand-fit unreachable');
process.exit(pass?0:1);
