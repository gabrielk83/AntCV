/* DIAGNOSTIC — CL-PDF-PRINT-PATH-001: the client print FALLBACK (kl()) used when
 * no server PDF is available must produce a CL-specific "CoverLetter_…" filename,
 * not a generic one. Renders the CL editor, FORCES the print fallback
 * (isPdfWorkerAvailable → false) + no-ops the actual print, clicks ⬇ PDF, and
 * asserts the print iframe's <title> (which drives the Save-as-PDF filename)
 * starts with "CoverLetter_<name>". */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.webmanifest':'application/manifest+json','.woff':'font/woff','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{try{let rel=decodeURIComponent((req.url||'/').split('?')[0]);if(rel==='/')rel='/index.html';const fp=path.join(ROOT,rel);const s=await stat(fp).catch(()=>null);if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;}res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'});res.end(await readFile(fp));}catch(e){res.writeHead(500);res.end(String(e));}});
await new Promise(r=>server.listen(0,r));const port=server.address().port;
const sections={cv:[],cl:[
  {id:'greeting',type:'text',on:true,loc:'main',title:'',content:'Dear Hiring Manager,'},
  {id:'opening',type:'text',on:true,loc:'main',title:'',content:'I am applying for a role in electro-optics.'},
  {id:'whoami',type:'text',on:true,loc:'main',title:'WHO I AM',content:'I am a systems engineer.'},
]};
const personalInfo={name:'Gabriel Karp-Gershon',headline:'Engineer',email:'g@e.com'};
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1500,height:1100}});
const errs=[]; page.on('pageerror',e=>{ const m=String(e&&e.message); if(!/Failed to fetch|CORS|net::ERR|Failed to load/i.test(m)) errs.push('pageerror: '+m); });
await page.addInitScript(([secs,pi])=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cl'));
  localStorage.setItem('sections',JSON.stringify(secs));localStorage.setItem('personalInfo',JSON.stringify(pi));
  localStorage.setItem('meta',JSON.stringify({company:'Unsolicited',role:'Founder & Product Expert',subtitle:'A • B'}));
  // FORCE the client print fallback (no server PDF), and no-op the actual print dialog.
  window.isPdfWorkerAvailable = async () => false;
  window.__antcvCapturedIframeTitle = null;
  const _print = window.print; window.print = function(){};
}, [sections, personalInfo]);
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(4500);
// no-op iframe print so the dialog never blocks
await page.evaluate(() => { try { HTMLIFrameElement.prototype.__noprint = true; } catch(_){} });
// find + click the ⬇ PDF export button
const clicked = await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('button'));
  const b = btns.find(x => /⬇\s*PDF|export as pdf/i.test((x.textContent||'') + ' ' + (x.title||'')));
  if (!b) return false; b.click(); return true;
});
await page.waitForTimeout(2500);
const r = await page.evaluate(() => {
  // the print path appends a hidden iframe; read its document <title>
  const ifr = Array.from(document.querySelectorAll('iframe'));
  let titles = [];
  for (const f of ifr) { try { const t = f.contentDocument && f.contentDocument.title; if (t) titles.push(t); } catch(_){} }
  return { clickedTitleDoc: document.title, iframeTitles: titles, iframeCount: ifr.length };
});
await browser.close(); await new Promise(r=>server.close(r));
console.log('PDF button clicked:', clicked);
console.log('iframe count:', r.iframeCount, '| iframe <title>s:', JSON.stringify(r.iframeTitles));
console.log('document.title during print:', JSON.stringify(r.clickedTitleDoc));
console.log('app errors:', errs.length, errs.slice(0,2).join(' | '));
const allTitles = r.iframeTitles.concat([r.clickedTitleDoc]);
const hit = allTitles.find(t => /^CoverLetter_Gabriel/i.test(String(t||'')));
const ok = clicked && !!hit && errs.length === 0;
console.log('CL print filename (CoverLetter_…):', JSON.stringify(hit || null));
console.log(`CHECK (print fallback sets a CL-specific filename): ${ok ? 'PASS' : 'FAIL'}`);
console.log(ok ? 'CL-PRINT-FILENAME OK' : 'CL-PRINT-FILENAME INCONCLUSIVE');
process.exitCode = ok ? 0 : 1;
