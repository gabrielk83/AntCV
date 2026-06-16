/* DIAGNOSTIC — RESULTS-TIGHTENING-STRIP-001 (owner 2026-06-15): per-role
 * "Results:" lines vanish from all-but-first role after the "Tightening to
 * length targets…" generation step. Hypothesis: the distribution matches roles
 * by OBJECT IDENTITY (__vis.indexOf(role)); the tightening writeback recreates
 * role objects while __antcvOrigRoles keeps the OLD objects → identity match
 * fails. This renders the editor twice:
 *   A. baseline (no __antcvOrigRoles)         — expect every role to get results
 *   B. post-tightening sim (__antcvOrigRoles = CLONED roles, same ids/titles but
 *      DIFFERENT object identity than section.roles) — observe the collapse.
 * Run from pwa/. */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml' };
const server = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}});
await new Promise(r=>server.listen(0,r));
const base = `http://127.0.0.1:${server.address().port}`;

const ROLES = [
  { id:'r1', title:'Change Control Lead', company:'Kanzen', years:'2024', on:true, bullets:['Owned the change control board across optics.'] },
  { id:'r2', title:'System Architect', company:'Innoviz', years:'2020', on:true, bullets:['Defined LiDAR system architecture.'] },
  { id:'r3', title:'Optics Engineer', company:'Sirin', years:'2014', on:true, bullets:['Led optics assembly for smartphone camera.'] },
  { id:'r4', title:'Electro Optics Engineer', company:'Meprolight', years:'2010', on:true, bullets:['Designed thermal imaging modules.'] },
];
// one outcome whose tokens match each role (so best-match spreads to all 4)
const OUTCOMES = { id:'outcomes', title:'SELECTED OUTCOMES', loc:'main', on:true, type:'text_bullets',
  items:[
    'Reduced change control board cycle time across optics by 40%',
    'Architected LiDAR system spanning optics and firmware',
    'Shipped smartphone camera optics assembly to volume',
    'Delivered thermal imaging modules to production at Meprolight',
  ] };

function expSection(withOrig) {
  const s = { id:'experience', title:'PROFESSIONAL EXPERIENCE', loc:'main', on:true, type:'experience', roles: ROLES };
  if (withOrig) s.__antcvOrigRoles = ROLES.map(r => ({ ...r })); // CLONES: same ids/titles, different identity
  return s;
}

async function run(label, withOrig) {
  const SECTIONS = { cv: [ { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', content:'X' }, OUTCOMES, expSection(withOrig) ], cl: [] };
  const PINFO = { name:'Gabriel Alexander Karp-Gershon', title:'P', email:'g@example.com', phone:'+45', location:'2300, København S', photo:'' };
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport:{width:1400,height:2000} });
  await page.addInitScript(({sections,pinfo})=>{
    localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','g@example.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
    localStorage.setItem('session',JSON.stringify({email:'g@example.com',ts:1717000000000}));
    localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
    localStorage.setItem('sections',JSON.stringify(sections));
    localStorage.setItem('personalInfo',JSON.stringify(pinfo));
    localStorage.setItem('language',JSON.stringify('en'));localStorage.setItem('wizardCompleted',JSON.stringify(true));
    localStorage.setItem('stylePackage',JSON.stringify('copenhagen-modern'));
    localStorage.setItem('__antcvOutcomesMode',JSON.stringify('results'));
  },{sections:SECTIONS,pinfo:PINFO});
  await page.goto(base+'/index.html',{waitUntil:'load',timeout:30000});
  await page.waitForTimeout(3500);
  const res = await page.evaluate(()=>{
    const els=[...document.querySelectorAll('[data-antcv-role-results]')];
    return els.map(e=>({ idx:e.getAttribute('data-antcv-role-results'), text:(e.textContent||'').replace(/\s+/g,' ').trim().slice(0,40) }));
  });
  await browser.close();
  console.log(`\n[${label}] roles with a Results line: ${res.length}/4`);
  res.forEach(r=>console.log(`  role idx ${r.idx}: "${r.text}"`));
  return res.length;
}

const a = await run('A baseline (no __antcvOrigRoles)', false);
const b = await run('B post-tightening sim (stale __antcvOrigRoles clones)', true);
await new Promise(r=>server.close(r));
console.log(`\nRESULT: baseline=${a}/4, post-tightening-sim=${b}/4`);
console.log(b < a ? 'REPRO CONFIRMED — identity match drops results after role objects are recreated' : 'NOT reproduced by this sim');
process.exitCode = 0;
