/* DIAGNOSTIC — FOUNDATION per-subsection controls (owner 2026-06-09).
 * Seeds antcv.foundationControls.v1 with a CJLR alignment + a manual page break
 * for the "professionally" sub-part, renders the FULL CL editor, and asserts the
 * sidecar self-heals the PREVIEW:
 *   (A) the professionally paragraph picks up the alignment (left),
 *   (B) the page break is reconciled into antcv:itemPages[foundation][1] -> salmon,
 *   (C) the local Enhance/Fix transforms are wired (debug API).
 * (The PANEL buttons attach only when the foundation card is expanded — verified
 *  visually by the owner; here we verify the preview + data plumbing.) */
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
  {id:'whoami',type:'text',on:true,loc:'main',title:'WHO I AM',content:'I am an engineer with broad experience.'},
  {id:'foundation',type:'foundation',on:true,loc:'main',title:'FOUNDATION',hands_on:'I start by framing the problem and building the smallest prototype.',professionally:'I keep decisions and their rationale visible in shared notes.'},
]};
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1500,height:1200}});
const errs=[]; page.on('pageerror',e=>errs.push('pageerror: '+(e&&e.message)));
page.on('console',m=>{ if(m.type()==='error'){const t=m.text(); if(!/CORS|workers\.dev|Failed to load|net::ERR/i.test(t)) errs.push('console.error: '+t);} });
await page.addInitScript((secs)=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cl'));
  localStorage.setItem('sections',JSON.stringify(secs));localStorage.setItem('personalInfo',JSON.stringify({name:'G K',headline:'X'}));
  // SEED: professionally -> left aligned + page 2 (manual break)
  localStorage.setItem('antcv.foundationControls.v1', JSON.stringify({ hands_on:{align:'center'}, professionally:{align:'left',page:2} }));
  localStorage.setItem('antcv:itemPages','{}');
}, sections);
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(5000);
const r=await page.evaluate(()=>{
  const fnd=document.querySelector('.antcv-preview-paper [data-sid="foundation"], [data-sid="foundation"]');
  const ps=fnd?Array.from(fnd.querySelectorAll('p')).map(p=>({txt:(p.textContent||'').slice(0,25),align:p.style.textAlign})):[];
  const ho=ps.find(p=>/hands[\s-]*on|praktisk/i.test(p.txt))||null;
  const pr=ps.find(p=>/profession/i.test(p.txt))||null;
  let ip={}; try{ip=JSON.parse(localStorage.getItem('antcv:itemPages')||'{}');}catch(_){}
  const salmon=Array.from(document.querySelectorAll('*')).some(e=>{try{return /▼ PAGE/.test(e.textContent||'')&&e.children.length===0;}catch(_){return false;}});
  const api=window.AntcvFoundationControls327||null;
  const enr=api?api._enrich('I keep notes visible'):null;
  const cmp=api?api._compress('I really just basically keep the notes'):null;
  return { installed: api?api.version:null, ho, pr, ipFoundation: ip.foundation||{}, salmon, enr, cmp };
});
await browser.close();await new Promise(r=>server.close(r));
console.log('sidecar installed:', r.installed);
console.log('hands_on para align:', r.ho&&r.ho.align, '| professionally para align:', r.pr&&r.pr.align);
console.log('itemPages.foundation:', JSON.stringify(r.ipFoundation));
console.log('salmon shown in preview:', r.salmon);
console.log('enrich sample:', JSON.stringify(r.enr));
console.log('compress sample:', JSON.stringify(r.cmp));
console.log('app errors:', errs.length, errs.slice(0,3).join(' | '));
const A = r.pr && r.pr.align === 'left' && r.ho && r.ho.align === 'center';
const B = Number(r.ipFoundation['1']) === 2 && r.salmon;
const C = !!r.installed && /scope|value/i.test(String(r.enr||'')) && !/really|basically/i.test(String(r.cmp||''));
console.log(`CHECK A (CJLR applied to both foundation paragraphs): ${A?'PASS':'FAIL'}`);
console.log(`CHECK B (manual page break reconciled -> itemPages[foundation][1]=2 + salmon): ${B?'PASS':'FAIL'}`);
console.log(`CHECK C (local Enhance/Fix transforms wired): ${C?'PASS':'FAIL'}`);
const ok = A && B && C && errs.length===0;
console.log(ok ? 'FOUNDATION-CONTROLS OK' : 'FOUNDATION-CONTROLS INCOMPLETE');
process.exit(ok?0:1);
