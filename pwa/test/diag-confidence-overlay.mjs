/* DIAGNOSTIC — FEATURE-CONF-001 (1.50.386). The confidence overlay:
 *   1. default OFF — no tints;
 *   2. toggled ON: a fabricated bullet (numbers + claims absent from the
 *      user's source facts) tints red/yellow with the issue in the tooltip;
 *      a grounded bullet (text drawn from personalInfo) stays untinted;
 *   3. toggled OFF strips tints and restores the blocks;
 *   4. setScores override wins over the heuristic.
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

const GROUNDED = 'Led modular hardware platform development across optics and electronics with supplier qualification.';
const FABRICATED = 'Commanded 47 orbital spacecraft refuelling missions delivering 9999 tonnes of cryogenic propellant.';
const sections={cv:[
  {id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:GROUNDED},
  {id:'tools',title:'TOOLS',loc:'sidebar',on:true,type:'labeled_list',
   items:[{l:'Achievement',v:FABRICATED}]},
],cl:[]};

const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1500,height:1000}});
await page.addInitScript(({secs,g})=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify(secs));
  localStorage.setItem('personalInfo',JSON.stringify({
    name:'Anita Tester',
    summary:'Hardware project lead: modular hardware platform development across optics, electronics and supplier qualification.',
    workHistory:[{title:'Hardware lead',company:'Kanzen',bullets:[g]}],
  }));
},{secs:sections,g:GROUNDED});
const errs=[];
page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(6500);

const r=await page.evaluate(async ({GROUNDED,FABRICATED})=>{
  const tinted=()=>Array.from(document.querySelectorAll('.antcv-preview-paper [data-antcv-conf-tint]')).map(e=>({
    band:e.dataset.antcvConfTint, txt:(e.textContent||'').slice(0,40), title:(e.title||'').slice(0,120)}));
  const out={ defOff: tinted().length===0, enabled0: window.AntcvConfidence.isEnabled() };
  window.AntcvConfidence.setEnabled(true);
  await new Promise(r=>setTimeout(r,800));
  out.afterOn=tinted();
  const fabBlock=Array.from(document.querySelectorAll('.antcv-preview-paper *')).find(e=>e.dataset&&e.dataset.antcvConfTint&&(e.textContent||'').includes('orbital'));
  out.fabBand=fabBlock?fabBlock.dataset.antcvConfTint:null;
  out.fabTitle=fabBlock?fabBlock.title:null;
  out.groundedTinted=out.afterOn.some(t=>t.txt.includes('Led modular'));
  window.AntcvConfidence.setEnabled(false);
  await new Promise(r=>setTimeout(r,600));
  out.afterOff=tinted().length;
  // 4 — override
  window.AntcvConfidence.setScores({ [GROUNDED]: { confidence: 0.1, issue: 'forced low by test' } });
  window.AntcvConfidence.setEnabled(true);
  await new Promise(r=>setTimeout(r,800));
  out.overrideTinted=tinted().some(t=>t.txt.includes('Led modular')&&t.band==='low');
  return out;
},{GROUNDED,FABRICATED});
await browser.close();await new Promise(r2=>server.close(r2));

const checks=[
  ['default OFF — no tints', r.defOff===true && r.enabled0===false],
  ['fabricated bullet tinted low with issue', r.fabBand==='low' && /not found in your source facts/.test(r.fabTitle||'')],
  ['grounded bullet untinted', r.groundedTinted===false],
  ['toggle OFF strips tints', r.afterOff===0],
  ['setScores override wins', r.overrideTinted===true],
];
for(const [n,ok] of checks)console.log(`${n}: ${ok?'OK':'FAIL'}`);
if(!checks.every(c=>c[1]))console.log('detail:',JSON.stringify(r));
console.log('app errors:',errs.length,errs.slice(0,2).join('|'));
const ok=checks.every(c=>c[1])&&errs.length===0;
console.log(ok?'CONFIDENCE-OVERLAY OK':'CONFIDENCE-OVERLAY FAILED');
process.exit(ok?0:1);
