/* DIAGNOSTIC — EXPORT-PREVIEW-ZOOM-001 (owner 2026-06-15: "zoom OUT so an entire
 * page fits the export preview"). The fit was width-only; now it also fits the
 * page HEIGHT. Boot a tall CV, open the preview modal, and assert the applied
 * --antcv-fit zoom makes ONE page fit the modal viewport height (scale ≤
 * availH/pageHeight, and < 1 i.e. it actually zoomed out). */
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

// a tall single page of content
const reg = [];
for (let g = 0; g < 2; g++) { reg.push({ group: 'Group ' + g }); for (let e = 0; e < 6; e++) reg.push({ l: 'Reg '+g+'.'+e, v: 'Detailed regulatory context line describing the framework and obligations across several wrapped lines of text here.' }); }
const sections = { cv: [
  { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', content:'Short profile line.' },
  { id:'regctx', title:'REGULATORY CONTEXT', loc:'sidebar', on:true, type:'labeled_list', items: reg },
], cl: [] };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{ width:1200, height:760 } });
await page.addInitScript((secs)=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session', JSON.stringify({ email:'d@e.com', ts:1717000000000 }));
  localStorage.setItem('step', JSON.stringify('editor'));
  localStorage.setItem('doc', JSON.stringify('cv'));
  localStorage.setItem('sections', JSON.stringify(secs));
  localStorage.setItem('personalInfo', JSON.stringify({ name:'Anita Tester' }));
}, sections);
const errs=[]; page.on('pageerror',e=>errs.push('pageerror: '+(e&&e.message)));
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(6500);

const r = await page.evaluate(async ()=>{
  window.AntcvPdfPreviewGate.open();
  await new Promise(r2=>setTimeout(r2,1800));
  const ifr = document.getElementById('antcv-pdf-preview-modal-iframe');
  const d = ifr && ifr.contentDocument;
  if (!d || !d.body) return { ok:false, why:'no iframe doc' };
  const fit = parseFloat(getComputedStyle(d.body).getPropertyValue('--antcv-fit')) || (d.body.classList.contains('antcv-fit-width') ? null : 1);
  const paper = d.body.querySelector('.antcv-preview-paper');
  const pageEl = paper && (paper.querySelector('.antcv-page-row') || paper);
  const ph = pageEl ? pageEl.getBoundingClientRect().height : 0;
  const availH = (ifr.clientHeight || 0) - 24;
  return { ok:true, fit, ph, availH, hasClass: d.body.classList.contains('antcv-fit-width') };
});
await browser.close(); await new Promise(r2=>server.close(r2));
console.log('--- EXPORT-PREVIEW-ZOOM-001 ---');
console.log(JSON.stringify(r));
console.log('app errors:', errs.length, errs.slice(0,2).join(' | '));
// page height at natural scale exceeds the viewport → must zoom out so it fits
const fitsHeight = r.ok && r.fit != null && r.ph>0 && r.availH>0 && (r.ph * r.fit) <= r.availH + 2;
const zoomedOut = r.ok && r.fit != null && r.fit < 1;
const checks = [
  ['modal opened with fit applied', r.ok && r.hasClass === true],
  ['zoomed OUT (scale < 1)', zoomedOut],
  ['one page fits the viewport height', fitsHeight],
  ['no app errors', errs.length === 0],
];
for (const [n,ok] of checks) console.log(`${n}: ${ok?'OK':'FAIL'}`);
const ok = checks.every(c=>c[1]);
console.log(ok ? 'EXPORT-PREVIEW-ZOOM OK' : 'EXPORT-PREVIEW-ZOOM FAILED');
process.exit(ok ? 0 : 1);
