/* DIAGNOSTIC — outcomes 'results' mode render.
 * Verifies (owner 2026-06-13): each role's Results line is (a) NOT a verbatim
 * echo of the role's own bullets, (b) capped to ~2 lines, (c) only the word
 * "Results:" is bold, (d) the FIRST role is not starved, (e) no role hogs a
 * big chunk. Renders the live preview and dumps each [data-antcv-role-results].
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png' };
const server = http.createServer(async (req,res)=>{
  try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}
});
await new Promise(r=>server.listen(0,r));
const port = server.address().port; const base = `http://127.0.0.1:${port}`;

const ROLES = [
  { title:'Product / Project Expert', company:'Konzen konsulenter i nord ApS', on:true, bullets:[
    'Founded a consultancy bridging hardware product development and technical-commercial evaluation.',
    'Led RFQ and RFI evaluation programmes with structured supplier scoring.'] },
  { title:'System Architect & Change Control Lead', company:'Innoviz Technologies', on:true, bullets:[
    'Owned change governance for the LiDAR product line under Automotive SPICE.',
    'Coordinated cross-team change requests from OEM customers.'] },
  { title:'EO / Optics Engineer', company:'Sirin Optics', on:true, bullets:[
    'Designed optical systems and validation setups.',
    'Characterised machine-vision image sensors.'] },
];
const OUTCOMES = [
  '90% cost reduction through supplier consolidation across the programme',
  'Cut development cycle time by 40% using Six Sigma and design of experiments',
  'Led RFQ and RFI evaluation programmes with structured supplier scoring',  // DUP of role0 bullet -> must be dropped
  'Reduced LiDAR rework by introducing structured change governance and traceability',
  'Improved optical resolution by 2x on the machine-vision sensor line',
  'Patent 241997 cover window reducing crosstalk between optical components', // patent -> filtered
];
const SECTIONS = { cv: [
  { id:'experience', title:'PROFESSIONAL EXPERIENCE', loc:'main', on:true, type:'experience', roles:ROLES },
  { id:'selected_outcomes', title:'SELECTED OUTCOMES', loc:'main', on:true, type:'text_bullets', items:OUTCOMES },
], cl: [] };
const PINFO = { name:'Gabriel Alexander Karp-Gershon', patentNumber:'241997' };

const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1400,height:1700}});
await page.addInitScript(({sections,pinfo})=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','g@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'g@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify(sections));
  localStorage.setItem('personalInfo',JSON.stringify(pinfo));
  localStorage.setItem('language',JSON.stringify('en'));
  localStorage.setItem('wizardCompleted',JSON.stringify(true));
  localStorage.setItem('stylePackage',JSON.stringify('copenhagen-modern'));
  localStorage.setItem('outcomesMode',JSON.stringify('results'));
},{sections:SECTIONS,pinfo:PINFO});
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.goto(base+'/index.html',{waitUntil:'load',timeout:30000});
await page.waitForTimeout(3500);

const res = await page.evaluate(()=>{
  return [...document.querySelectorAll('[data-antcv-role-results]')].map(el=>{
    const label = el.querySelector('span');
    const outerWeight = getComputedStyle(el).fontWeight;
    const labelWeight = label?getComputedStyle(label).fontWeight:null;
    const editSpan = el.querySelector('[data-antcv-results-edit]');
    return { roleIdx: el.getAttribute('data-antcv-role-results'), text: (el.textContent||'').replace(/\s+/g,' ').trim(), len:(el.textContent||'').length, outerWeight, labelWeight, labelText: label?label.textContent:null, editable: !!(editSpan && editSpan.isContentEditable) };
  });
});
console.log('Role-results lines rendered:', res.length);
for(const r of res){
  console.log(`\n  role[${r.roleIdx}] len=${r.len} outerWeight=${r.outerWeight} labelWeight=${r.labelWeight}`);
  console.log(`    "${r.text}"`);
}
// checks
const checks=[];
const C=(n,ok)=>{checks.push(ok);console.log(`${ok?'PASS':'FAIL'} ${n}`)};
C('all 3 roles got a Results line (first role not starved)', res.length===3 && res.some(r=>r.roleIdx==='0'));
C('no line exceeds ~2 lines (<=185 chars)', res.every(r=>r.len<=185));
C('outer text is NORMAL weight (400)', res.every(r=>r.outerWeight==='400'));
C('only "Results:" label is bold (700)', res.every(r=>r.labelWeight==='700'));
C('no role echoes the duplicated bullet verbatim', res.every(r=>!/Led RFQ and RFI evaluation programmes with structured supplier scoring/i.test(r.text.replace('Results: ',''))===false ? true : true) && !res.some(r=>r.text.includes('Led RFQ and RFI evaluation programmes with structured supplier scoring')));
C('patent outcome filtered out', !res.some(r=>/241997|patent/i.test(r.text)));
C('each Results line is editable (contentEditable span)', res.length>0 && res.every(r=>r.editable));
if(errs.length) console.log('pageerrors:', errs.slice(0,3).join(' | '));
await browser.close(); await new Promise(r=>server.close(r));
const ok=checks.every(Boolean);
console.log('\n'+(ok?'OUTCOMES-RESULTS OK':'OUTCOMES-RESULTS FAIL'));
process.exit(ok?0:1);
