/* DIAGNOSTIC — MOB-009 device-parity guard.
 *
 * MOB-009 ("exported CV PDF badly split", owner mobile report 2026-07-07). The
 * export forwards antcv:autoPages (written by the auto-pagebreak measurer, which
 * reads the live PREVIEW DOM) to the docx-worker → CloudConvert → PDF. The
 * preview paper is transform:scale(ui) with ui<1 on mobile, so a NATURAL
 * hypothesis was: the measurer reads scaled px and computes DIFFERENT page
 * breaks on mobile, producing a badly-split mobile export.
 *
 * This guard DISPROVES that hypothesis and locks it: it boots the SAME
 * multi-page CV (profile + a 26-row core-competency table + 8 experience roles
 * + a heavy sidebar) on desktop (1400px, scale≈1) and mobile (390px, scale≈0.47)
 * and asserts the resulting antcv:autoPages are IDENTICAL. The measurer already
 * divides measured px by the paper's transform scale
 * (antcv-auto-pagebreak-block-001.js ~L733-739), so page breaks are
 * device-independent. If a future change breaks that scale correction, mobile
 * exports would split differently from desktop and THIS test catches it.
 *
 * NOTE: this proves the break POSITIONS match across devices; it does NOT prove
 * those positions are aesthetically ideal (blank lower-page sidebar, mid-unit
 * cuts) — that pagination-QUALITY work is row 59A (generator-owned), and the
 * preview↔LibreOffice fidelity gap can only be checked against a real
 * CloudConvert export. */
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

const B=(n,p)=>Array.from({length:n},(_,i)=>`${p} bullet ${i+1}: a realistic accomplishment line long enough to wrap once or twice at the A4 main-column width and add measurable vertical height to the role.`);
const roles=Array.from({length:8},(_,i)=>({id:'r'+(i+1),title:'Senior Position Number '+(i+1),company:'Company '+(i+1),years:(2008+i)+'-'+(2009+i),on:true,bullets:B(4,'R'+(i+1))}));
const tableRows=[['Focus','Expertise']];for(let i=1;i<=26;i++)tableRows.push(['Focus area '+i,'A fairly detailed expertise description for area '+i+' that wraps.']);
const sections={cv:[
  {id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:('A seasoned professional profile paragraph that spans several lines. ').repeat(8)},
  {id:'core',title:'CORE COMPETENCIES',loc:'main',on:true,type:'table',rows:tableRows},
  {id:'experience',title:'PROFESSIONAL EXPERIENCE',loc:'main',on:true,type:'experience',roles},
  {id:'skills',title:'KEY SKILLS',loc:'sidebar',on:true,type:'labeled_list',items:Array.from({length:20},(_,i)=>({l:'Skill '+(i+1)}))},
  {id:'certs',title:'CERTIFICATIONS',loc:'sidebar',on:true,type:'labeled_list',items:Array.from({length:14},(_,i)=>({l:'Certification number '+(i+1)}))},
],cl:[]};

async function measure(width,height,isMobile){
  const browser=await chromium.launch();
  const page=await browser.newPage({viewport:{width,height},hasTouch:isMobile,isMobile});
  await page.addInitScript((secs)=>{
    localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
    localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
    localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
    localStorage.setItem('sections',JSON.stringify(secs));localStorage.setItem('personalInfo',JSON.stringify({name:'Test Candidate',title:'Professional'}));
    localStorage.removeItem('antcv:autoPages');localStorage.removeItem('antcv:autoPagesPreview');
  },sections);
  await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
  await page.waitForTimeout(9000); // measurer is debounced + re-runs; let it settle
  const out=await page.evaluate(()=>{
    const paper=document.querySelector('[data-antcv-preview-paper="true"]');
    let scale=null;if(paper){const r=paper.getBoundingClientRect();scale=paper.offsetWidth?+(r.width/paper.offsetWidth).toFixed(3):null;}
    return {autoPages:JSON.parse(localStorage.getItem('antcv:autoPages')||'{}'),previewScale:scale};
  });
  await browser.close();
  return out;
}

const desktop=await measure(1400,1000,false);
const mobile=await measure(390,844,true);
await new Promise(r=>server.close(r));
console.log('DESKTOP:',JSON.stringify(desktop));
console.log('MOBILE :',JSON.stringify(mobile));
// Sanity: content actually paginated (a break exists) and the mobile preview
// really IS scaled down — otherwise the parity assertion is vacuous.
const paginated=Object.keys(desktop.autoPages).length>0;
const mobileScaled=mobile.previewScale!==null&&mobile.previewScale<0.9;
const parity=JSON.stringify(desktop.autoPages)===JSON.stringify(mobile.autoPages);
const ok=paginated&&mobileScaled&&parity;
console.log('paginated:',paginated,'| mobileScaled:',mobileScaled,'| parity:',parity);
console.log(ok?'MOB009-AUTOPAGES-DEVICE-PARITY OK':'MOB009-AUTOPAGES-DEVICE-PARITY FAILED');
process.exit(ok?0:1);
