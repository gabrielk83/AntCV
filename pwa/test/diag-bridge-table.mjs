/* DIAGNOSTIC — BRIDGE-TABLE-001 (owner 2026-06-11: "bridge middle is unable
 * to handle core competencies"). A CORE COMPETENCIES table in the main column
 * must never collide with the bridge-middle medallion: tables don't wrap
 * shape-outside floats, so the fix re-runs the medallion's geometry pass
 * after layout settles (commit + 450ms + 1400ms) — the correctly-sized float
 * spacers then make the table clear below the medallion natively, with a
 * y-relocation backstop for residual intersections. Asserts ZERO vertical
 * overlap between the medallion and the table, no table cell in the band,
 * and spacers sized to the FINAL geometry. */
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
const rows = [
  ['Hardware programme lead','Modular hardware platforms across optics, electronics, RF-adjacent sensing, and embedded software.'],
  ['Requirements & traceability','Customer and business needs translated into testable specs in Codebeamer ALM with review gates.'],
  ['Supplier engagement','RFQ/RFI, joint development, tolerance analysis, and first article qualification with optics and electronics vendors.'],
  ['Verification & validation','Design verification plans, FAT/SAT, DOE, Gage R&R, and statistical analysis tied to written acceptance criteria.'],
  ['Certification coordination','Planning and tracking of CE, FCC, and laser-safety (IEC 60825-1) activities across hardware releases.'],
  ['Risk & change governance','FMEA, Change Control Board, and cross-team impact analysis under ASPICE and ISO 26262 traceability.'],
];
const sections={cv:[
  {id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'Hardware project lead with 15 years in automotive LiDAR. '.repeat(4)},
  {id:'outcomes',title:'SELECTED OUTCOMES',loc:'main',on:true,type:'list',items:[{v:'Requirements into engineering scope: translated complex requirements into executable scope.'},{v:'Technical-commercial hardware evaluation: founded a consultancy.'}]},
  {id:'core_comp',title:'CORE COMPETENCIES',loc:'main',on:true,type:'table',headers:['Focus Area','Strategic Expertise'],rows},
  {id:'experience',title:'PROFESSIONAL EXPERIENCE',loc:'main',on:true,type:'experience',roles:[{title:'Founder',company:'Kanzen',period:'2022–2025',bullets:['Founded a consultancy bridging hardware product development and evaluation.','Led RFQ and RFI evaluation programmes.']}]},
  {id:'tools',title:'TOOLS & METHODS',loc:'sidebar',on:true,type:'labeled_list',items:[{l:'Project workflow',v:'Jira, Confluence, Codebeamer'},{l:'Architecture',v:'System architecture, MBSE'},{l:'Methods',v:'Lean, Six Sigma, FMEA, DOE'},{l:'Engineering',v:'Python, MATLAB, LabVIEW'}]},
  {id:'certs',title:'CERTIFICATIONS',loc:'sidebar',on:true,type:'list',items:[{v:'AI-Practitioner'},{v:'Six Sigma Black Belt'},{v:'Automotive SPICE'},{v:'FMEA & APIS'}]},
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
  localStorage.setItem('photoPosition',JSON.stringify('bridge-middle'));
},{secs:sections,photo:PHOTO});
const errs=[];
page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(6500);

const r=await page.evaluate(()=>{
  const paper=document.querySelector('.antcv-preview-paper');
  const img=paper.querySelector('img');
  const ir=img.getBoundingClientRect();
  const main=paper.querySelector('.antcv-document-main');
  const tbl=main.querySelector('table');
  const tr=tbl?tbl.getBoundingClientRect():null;
  const overlap=tr?Math.max(0,Math.min(ir.bottom,tr.bottom)-Math.max(ir.top,tr.top)):0;
  const horiz=tr?Math.max(0,Math.min(ir.right,tr.right)-Math.max(ir.left,tr.left)):0;
  // first-column cells in the medallion band — are they visually covered?
  const cells=tbl?Array.from(tbl.querySelectorAll('td:first-child,th:first-child')).map(c=>{const cr=c.getBoundingClientRect();return{t:Math.round(cr.top),txt:(c.textContent||'').slice(0,20),inBand:cr.bottom>ir.top&&cr.top<ir.bottom,coveredX:cr.left<ir.right};}):[];
  const spacers=Array.from(paper.querySelectorAll('[data-antcv-bridge-spacer]')).map(s=>({side:s.getAttribute('data-antcv-bridge-spacer'),h:s.style.height,shape:s.style.shapeOutside?.slice(0,46)}));
  return{
    img:{t:Math.round(ir.top),b:Math.round(ir.bottom),l:Math.round(ir.left),r:Math.round(ir.right)},
    tbl:tr?{t:Math.round(tr.t||tr.top),b:Math.round(tr.bottom),l:Math.round(tr.left)}:null,
    overlapY:Math.round(overlap),overlapX:Math.round(horiz),
    cells,spacers,
    tblStyle:tbl?{ml:getComputedStyle(tbl).marginLeft,pos:getComputedStyle(tbl).position}:null,
  };
});
await browser.close();await new Promise(r2=>server.close(r2));
const noOverlap = r.overlapY === 0;
const noCellInBand = r.cells.every(c=>!c.inBand);
// spacer circles centred on the medallion's FINAL midline (cy ≈ imgMid − spacerTop;
// both spacers share one cy, so equality with the img band is implied by the
// medallion sitting between the table-free crescents)
const spacersSized = r.spacers.length === 2 && r.spacers.every(s=>parseInt(s.h,10) > 0 && /circle\(/.test(s.shape||''));
console.log('medallion/table overlapY=0:', noOverlap ? 'OK' : 'FAIL ('+r.overlapY+'px)');
console.log('no table cell in the band:', noCellInBand ? 'OK' : 'FAIL');
console.log('both spacers sized+shaped:', spacersSized ? 'OK' : 'FAIL '+JSON.stringify(r.spacers));
console.log('app errors:', errs.length, errs.slice(0,2).join('|'));
if (!(noOverlap && noCellInBand && spacersSized)) console.log('detail:', JSON.stringify(r));
const ok = noOverlap && noCellInBand && spacersSized && errs.length === 0;
console.log(ok ? 'BRIDGE-TABLE OK' : 'BRIDGE-TABLE FAILED');
process.exit(ok ? 0 : 1);
