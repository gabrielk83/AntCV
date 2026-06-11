/* DIAGNOSTIC — ANALYSIS-MOBILE-SCROLL-001. On a 390px viewport, opens the
 * 🎯 Analysis tab with a long seeded rationale and asserts the report is
 * actually scrollable on mobile: a scrollable ancestor of the analysis
 * content exists (scrollHeight > clientHeight), programmatic scrollTop
 * sticks, and the report PDF export control is reachable (visible within
 * the scrollable area). */
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
const long=(s,n)=>Array.from({length:n},(_,i)=>`${s} item ${i+1} with enough words to take real vertical space in the panel.`);
const rationale={
  fit_summary:'A solid overall fit with several concrete anchors in the candidate background. '.repeat(4),
  top_fit_points:long('Fit point',8),
  gaps:long('Gap',6),
  tailoring_decisions:'Tailoring decisions paragraph. '.repeat(12),
  cover_letter_strategy:'Cover letter strategy paragraph. '.repeat(12),
  red_flags:long('Red flag',4),
  assumptions:long('Assumption',5),
  recommendations:long('Recommendation',6),
  confidence_notes:long('Confidence note',4).map(t=>({text:t,confidence:0.4,issue:'weak grounding'})),
  detected_language:'en',
  supporting_context:'',
};
const sections={cv:[{id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'Profile text. '.repeat(15)}],cl:[]};
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
await page.addInitScript(({secs,rat})=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify(secs));localStorage.setItem('personalInfo',JSON.stringify({name:'A'}));
  localStorage.setItem('rationale',JSON.stringify(rat));
  localStorage.setItem('meta',JSON.stringify({company:'Kvadrat',role:'PM',subtitle:'X'}));
},{secs:sections,rat:rationale});
const errs=[];
page.on('pageerror',e=>errs.push('pageerror: '+(e&&e.message)));
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(5000);
// open the Analysis tab via the bottom nav (multiple "Analysis" buttons can
// exist in DOM; click the VISIBLE one)
const tabVisible=await page.evaluate(()=>{
  const vis=el=>{const r=el.getBoundingClientRect();const cs=getComputedStyle(el);return r.width>0&&r.height>0&&cs.display!=='none'&&cs.visibility!=='hidden';};
  const b=Array.from(document.querySelectorAll('button')).filter(vis)
    .find(x=>/Analysis|Analyse/.test((x.textContent||'')));
  if(!b)return false;
  b.click();return true;
});
await page.waitForTimeout(2500);
const r=await page.evaluate(()=>{
  const norm=s=>String(s||'').replace(/\s+/g,' ').trim();
  // the analysis content root: the element containing the panel heading
  const all=Array.from(document.querySelectorAll('div'));
  const head=all.find(n=>n.childElementCount===0&&/Application Analysis/.test(norm(n.textContent)))
    ||all.find(n=>/Application Analysis/.test(norm(n.textContent))&&n.getBoundingClientRect().height<200);
  if(!head)return{panelShown:false};
  // find the nearest scrollable ancestor
  let n=head,scroller=null;
  while(n&&n!==document.body){
    const cs=getComputedStyle(n);
    if((cs.overflowY==='auto'||cs.overflowY==='scroll')&&n.scrollHeight>n.clientHeight+10){scroller=n;break;}
    n=n.parentElement;
  }
  if(!scroller)return{panelShown:true,scrollerFound:false};
  const before=scroller.scrollTop;
  scroller.scrollTop=scroller.scrollHeight;
  const after=scroller.scrollTop;
  const moved=after>before+50;
  // export control: the 360 download button must sit INSIDE the scrollable
  // area, and after scrolling to the bottom it must be in view.
  const dl=scroller.querySelector('#antcv-analysis-report .arx-dl');
  let exportReachable=false;
  if(dl){
    const r=dl.getBoundingClientRect();const sr=scroller.getBoundingClientRect();
    exportReachable=r.height>0&&r.top>=sr.top-2&&r.bottom<=sr.bottom+2;
  }
  const usableWindow=scroller.clientHeight;
  scroller.scrollTop=0;
  return{panelShown:true,scrollerFound:true,scrollH:scroller.scrollHeight,clientH:usableWindow,
    scrollMoved:moved,exportBtn:dl?norm(dl.textContent):null,exportReachable};
});
await browser.close();await new Promise(r2=>server.close(r2));
console.log('analysis tab visible+clicked:',tabVisible);
console.log('panel state:',JSON.stringify(r));
console.log('app errors:',errs.length,errs.slice(0,2).join(' | '));
// usable window ≥150px guards against the historic 28px collapsed scroller.
const ok=tabVisible&&r.panelShown&&r.scrollerFound&&r.scrollMoved&&r.clientH>=150
  &&!!r.exportBtn&&r.exportReachable&&errs.length===0;
console.log(ok?'ANALYSIS-MOBILE-SCROLL OK':'ANALYSIS-MOBILE-SCROLL FAILED');
process.exit(ok?0:1);
