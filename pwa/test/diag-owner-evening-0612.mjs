/* DIAGNOSTIC — owner batch 2026-06-12 EVENING, behavioural halves:
 *   1. RECOMMENDATIONS-SECTION-001 backfill: stored sections WITHOUT a
 *      recommendations section gain one directly after experience, with
 *      the references one-liner, and it renders in the preview;
 *   2. backfill idempotent: a section titled REFERENCER blocks a second
 *      insert;
 *   3. LINKEDIN-CLICK-001 + CONTACT-LOCAL-FORM-001: the header contact
 *      line renders the LinkedIn entry as an <a href> and the location in
 *      Danish local form ("2300, København S", no "Denmark");
 *   4. NO-JUSTIFY-GAPS-001: sidebar labeled_list rows compute
 *      text-align:left (not justify);
 *   5. ADV-SPACING-CONTROLS-001: seamGap/sidebarEdgePad/sectionGap values
 *      in styleConfig move the live preview geometry.
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

const baseSections = (extra=[]) => ({cv:[
  {id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'Profile.'},
  {id:'experience',title:'PROFESSIONAL EXPERIENCE',loc:'main',on:true,type:'experience',roles:[
    {id:'r0',title:'Change Control Lead',company:'Innoviz Technologies',years:'2020-2025',bullets:['Owned change governance.']},
  ]},
  {id:'tools',title:'TOOLS & METHODS',loc:'sidebar',on:true,type:'labeled_list',items:[
    {l:'Engineering',v:'Python, MATLAB, LabVIEW, COMSOL, Zemax and more tools to wrap'},
  ]},
  ...extra,
],cl:[]});

const browser=await chromium.launch();
async function boot({secs, styleConfig, personalInfo}={}) {
  const page=await browser.newPage({viewport:{width:1500,height:1100}});
  await page.addInitScript(({secs,styleConfig,personalInfo})=>{
    localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
    localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
    localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
    localStorage.setItem('sections',JSON.stringify(secs));
    localStorage.setItem('personalInfo',JSON.stringify(personalInfo||{name:'Anita'}));
    if(styleConfig) localStorage.setItem('styleConfig',JSON.stringify(styleConfig));
  },{secs,styleConfig,personalInfo});
  const errs=[];
  page.on('pageerror',e=>errs.push(String(e&&e.message)));
  await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
  await page.waitForTimeout(6000);
  return {page, errs};
}

const checks=[];
const check=(n,ok,d)=>{checks.push(ok);console.log(`${n}: ${ok?'OK':'FAIL'}${ok?'':' '+(d||'')}`)};

// 1 — backfill inserts after experience and renders
{
  const {page,errs}=await boot({secs:baseSections()});
  const r=await page.evaluate(()=>{
    const stored=JSON.parse(localStorage.getItem('sections')||'{}');
    const ids=(stored.cv||[]).map(s=>s.id);
    const xi=ids.indexOf('experience'), ri=ids.indexOf('recommendations');
    const rec=(stored.cv||[]).find(s=>s.id==='recommendations');
    const el=document.querySelector('.antcv-preview-paper [data-sid="recommendations"]');
    return {ids, after: ri===xi+1, content: rec&&rec.content, rendered: !!el, txt: el?(el.textContent||'').slice(0,80):''};
  });
  check('backfill: recommendations after experience + rendered',
    r.after && /recommenders on request/.test(r.content||'') && r.rendered && /recommenders on request/i.test(r.txt) && errs.length===0,
    JSON.stringify(r));
  await page.close();
}
// 2 — idempotence: an existing REFERENCER section blocks the insert
{
  const {page}=await boot({secs:baseSections([{id:'refs_custom',title:'REFERENCER',loc:'main',on:true,type:'text',content:'Egne referencer.'}])});
  const r=await page.evaluate(()=>{
    const stored=JSON.parse(localStorage.getItem('sections')||'{}');
    return {count:(stored.cv||[]).filter(s=>s.id==='recommendations'||/REFERENCER|RECOMMENDATIONS/i.test(String(s.title||''))).length};
  });
  check('backfill idempotent with existing REFERENCER section', r.count===1, JSON.stringify(r));
  await page.close();
}
// 3 — LinkedIn anchor + Danish local form in the header
{
  const {page,errs}=await boot({secs:baseSections(),personalInfo:{name:'Gabriel',linkedin:'linkedin.com/in/gabriel-karp',location:'Copenhagen, Denmark'}});
  const r=await page.evaluate(()=>{
    const a=Array.from(document.querySelectorAll('a')).find(x=>/linkedin\.com\/in\/gabriel-karp/.test(x.getAttribute('href')||''));
    const hdr=document.body.innerText||'';
    return {anchor: !!a, href: a?a.getAttribute('href'):null, target: a?a.getAttribute('target'):null,
      local: hdr.includes('2300, København S'), noDenmark: !/2300, København S[^\n]*Denmark/.test(hdr)};
  });
  check('LinkedIn clickable + "2300, København S" local form',
    r.anchor && /^https:\/\//.test(r.href||'') && r.target==='_blank' && r.local && r.noDenmark && errs.length===0,
    JSON.stringify(r));
  await page.close();
}
// 4 — sidebar rows left-aligned
{
  const {page}=await boot({secs:baseSections()});
  const r=await page.evaluate(()=>{
    const row=document.querySelector('[data-antcv-document-sidebar] [data-antcv-row-path]');
    return {found: !!row, align: row?getComputedStyle(row).textAlign:null};
  });
  check('sidebar rows left-aligned (no justify gaps)', r.found && r.align==='left', JSON.stringify(r));
  await page.close();
}
// 5 — spacing controls move the live geometry
{
  const {page}=await boot({secs:baseSections(),styleConfig:{seamGap:20,sidebarEdgePad:2,mainSectionGap:24,candidateGap:9,bodyEdgePad:14}});
  const r=await page.evaluate(()=>{
    const sb=document.querySelector('[data-antcv-document-sidebar]');
    const main=document.querySelector('.antcv-document-main');
    const sec=document.querySelector('.antcv-preview-paper [data-sid="profile"]');
    return {
      sbPad: sb?getComputedStyle(sb).padding:null,
      mainPadLeft: main?getComputedStyle(main).paddingLeft:null,
      mainPadTop: main?getComputedStyle(main).paddingTop:null,
      secGap: sec?getComputedStyle(sec).marginBottom:null,
    };
  });
  // SPACING-COMFORT-DEFAULT-001: mainEdgeIndent is unseeded here, so the
  // fallback is now the comfort 14px (was 10) — left pad = 14 + seam 20.
  check('spacing sliders drive the preview (seam 20 + edge 14 = 34px left pad; sidebar 14px/2px; section 24px)',
    r.mainPadLeft==='34px' && r.sbPad==='14px 2px' && r.mainPadTop==='14px' && r.secGap==='24px',
    JSON.stringify(r));
  await page.close();
}

await browser.close();
server.close();
const ok=checks.every(Boolean);
console.log(ok?'OWNER-EVENING-0612 OK':'OWNER-EVENING-0612 FAIL');
process.exit(ok?0:1);
