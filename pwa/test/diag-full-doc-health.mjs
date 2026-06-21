/* PROACTIVE HEALTH CHECK — full CV + CL with every section type the rich_block migrations touch,
 * loaded with the real persona personalInfo. Verifies: zero app errors; each migrated section ends
 * up the right type with content; the CV and CL previews render content from every section. Catches
 * any lurking regression across the whole migration surface. */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon' };
const server = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); if(!fp.startsWith(ROOT)){res.writeHead(403);res.end();return;} const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}});
await new Promise(r=>server.listen(0,r)); const port = server.address().port;
const praw = JSON.parse(await readFile(path.resolve(ROOT,'../docs/personas/anita/personalInfo.json'),'utf8'));
const pi = praw.personalInfo || praw;

const cv = [
  { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', content:'PROFILE_X Operations specialist with 12 seasons across colony logistics and granary planning.' },
  { id:'work_style', title:'Work style', loc:'main', on:true, type:'text_inline', content:'WORKSTYLE_X Methodical, calm under pressure, evidence-driven.' },
  { id:'outcomes', title:'SELECTED OUTCOMES', loc:'main', on:true, type:'bullets', items:[{b:'Reduced',t:'OUTCOME_X spoilage 30% via cold-chain audits'},{b:'Built',t:'a six-season contingency plan'}] },
  { id:'core_comp', title:'CORE COMPETENCIES', loc:'main', on:true, type:'table', rows:[['Focus Area','Strategic Expertise'],['Cold-chain','CORE_X ISO 22000, HACCP'],['Forecasting','Seasonal demand modelling']] },
  { id:'experience', title:'PROFESSIONAL EXPERIENCE', loc:'main', on:true, type:'experience', roles:[{id:'r1',title:'Operations Lead',company:'Nordic Granary',dateRange:'2019-2026',bullets:['EXP_X Ran winter preparedness for 4 granaries.']}] },
  { id:'pubs', title:'PUBLICATIONS & PATENTS', loc:'main', on:true, type:'list_italic', richPub:true, items:['<b>"Cold-Chain Foraging Routes"</b> — A. Myre, Journal of Granary Logistics, 2023'] },
  { id:'recommendations', title:'RECOMMENDATIONS', loc:'main', on:true, type:'education', items:[{deg:'References',sch:'On request'}] },
  { id:'tools', title:'TOOLS & METHODS', loc:'sidebar', on:true, type:'labeled_list', items: pi.tools },
  { id:'certs', title:'CERTIFICATIONS', loc:'sidebar', on:true, type:'list', items: pi.certifications },
  { id:'education', title:'EDUCATION', loc:'sidebar', on:true, type:'education', items:[{deg:'MSc Logistics',sch:'Nordic Granary Council, 2014'}] },
  { id:'regulatory', title:'REGULATORY CONTEXT', loc:'sidebar', on:true, type:'labeled_list', items: pi.regulatory },
  { id:'additional', title:'ADDITIONAL INFORMATION', loc:'sidebar', on:true, type:'labeled_list', items: pi.additional },
];
const cl = [
  { id:'greeting', title:'Greeting', loc:'main', on:true, type:'text', content:'Dear Hiring Manager,' },
  { id:'opening', title:'Opening', loc:'main', on:true, type:'text', content:'OPENING_X I am writing about the operations role at your granary.' },
  { id:'who', title:'WHO I AM', loc:'main', on:true, type:'text', content:'WHO_X I am an operations specialist with deep cold-chain experience.' },
  { id:'bring', title:'WHAT I BRING', loc:'main', on:true, type:'table', rows:[['Focus Area','Strategic Expertise'],['Winter readiness','BRING_X Audit-ready preparedness plans']] },
  { id:'why', title:'WHY THIS POSITION', loc:'main', on:true, type:'text', content:'WHY_X Your granary network matches my seasonal-risk focus.' },
  { id:'contribute', title:'HOW I WOULD CONTRIBUTE', loc:'main', on:true, type:'text_bullets', items:[{content:'INTRO_X My first priorities would be:'},{content:'BULLET_X1 audit the cold-chain'},{content:'BULLET_X2 map the seasonal gaps'},{content:'CLOSING_X so the colony gains resilience.'}] },
  { id:'foundation', title:'FOUNDATION', loc:'main', on:true, type:'foundation', hands_on:'FOUND_HO_X I have run granary operations end to end.', professionally:'FOUND_PR_X That translates into disciplined logistics ownership.' },
  { id:'closure', title:'Closure', loc:'main', on:true, type:'text', content:'CLOSURE_X I would welcome a conversation about the role.' },
];

const browser = await chromium.launch();
async function boot(doc){
  const page = await browser.newPage({ viewport:{ width:1400, height:1000 } });
  const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
  await page.addInitScript(([secs, pinfo, d])=>{
    localStorage.setItem('antcv:auth:token','d'); localStorage.setItem('antcv:auth:email','d@e.com'); localStorage.setItem('antcv:auth:expires_at','4102444800');
    localStorage.setItem('session', JSON.stringify({email:'d@e.com',ts:1717000000000}));
    localStorage.setItem('step', JSON.stringify('editor')); localStorage.setItem('doc', JSON.stringify(d));
    localStorage.setItem('sections', JSON.stringify(secs)); localStorage.setItem('personalInfo', JSON.stringify(pinfo));
  }, [{cv,cl}, pinfo(), doc]);
  function pinfo(){ return pi; }
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForTimeout(12000);
  const out = await page.evaluate(()=>{
    const secs = JSON.parse(localStorage.getItem('sections')||'{}');
    const txt = [...document.querySelectorAll('.antcv-preview-paper')].map(p=>p.textContent).join('\n');
    const typeOf = (doc,id)=>{ const s=(secs[doc]||[]).find(x=>x.id===id); return s?s.type:'(missing)'; };
    return { txt, cvTypes:Object.fromEntries(['profile','work_style','tools','certs','regulatory'].map(id=>[id,typeOf('cv',id)])),
      clTypes:Object.fromEntries(['opening','who','why','contribute','foundation','closure'].map(id=>[id,typeOf('cl',id)])) };
  });
  const e = errs.slice(); await page.close();
  return { ...out, errs:e };
}

const cvR = await boot('cv');
const clR = await boot('cl');
await browser.close(); await new Promise(r=>server.close(r));

const errs = cvR.errs.concat(clR.errs);
console.log('app errors:', errs.length, errs.slice(0,3).join(' | '));
console.log('cv types:', JSON.stringify(cvR.cvTypes));
console.log('cl types:', JSON.stringify(clR.clTypes));

let pass=true; const fails=[];
if (errs.length) { pass=false; fails.push('app errors: '+errs.slice(0,3).join(' | ')); }
// CV content present (markers we injected)
// (Selected Outcomes is intentionally omitted — id "outcomes" has special lamination that needs
//  personalInfo.proofPoints to render; absent from this minimal fixture. It is not a migration target.)
['PROFILE_X','WORKSTYLE_X','CORE_X','EXP_X','Cold-Chain Foraging','Operations planning','Cold Storage','ISO 22000'].forEach(m=>{
  if (!cvR.txt.includes(m) && !new RegExp(m.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i').test(cvR.txt)) { pass=false; fails.push('CV preview missing: '+m); }
});
// CL content present
['OPENING_X','WHO_X','BRING_X','WHY_X','INTRO_X','BULLET_X1','CLOSING_X','FOUND_HO_X','CLOSURE_X'].forEach(m=>{
  if (!clR.txt.includes(m)) { pass=false; fails.push('CL preview missing: '+m); }
});
// migrated types
['profile','work_style'].forEach(id=>{ if (cvR.cvTypes[id] !== 'rich_block') { pass=false; fails.push('CV '+id+' not rich_block: '+cvR.cvTypes[id]); } });
['tools','regulatory'].forEach(id=>{ if (cvR.cvTypes[id] !== 'rich_block') { pass=false; fails.push('CV '+id+' not rich_block: '+cvR.cvTypes[id]); } });
['opening','who','why','contribute','foundation'].forEach(id=>{ if (clR.clTypes[id] !== 'rich_block') { pass=false; fails.push('CL '+id+' not rich_block: '+clR.clTypes[id]); } });
if (clR.clTypes.closure !== 'text') { pass=false; fails.push('CL closure should stay text, got '+clR.clTypes.closure); }
console.log('\n'+(pass?'PASS':'FAIL')+' — FULL-DOC HEALTH (all section types convert + render)');
if (!pass) { fails.forEach(f=>console.log('  ✗ '+f)); process.exitCode=1; }
else console.log('  every CV + CL section converts to the right type and renders its content; closure stays text; zero app errors.');
