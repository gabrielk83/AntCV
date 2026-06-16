/* DIAGNOSTIC — ROLE-DECOMP-001 (owner 2026-06-16).
 * The runtime normalizer (antcv-sections-normalize-415.js) must now KEEP distinct
 * same-company functions as SEPARATE positions (decompose), while still collapsing
 * a genuine EXACT-title append-duplicate. Verifies:
 *  - "System Architect" is NOT folded into "System Architect & Change Control Lead"
 *  - "Customer Change Requests Specialist" survives alongside a Change-Control role
 *    (dropCustomerChangeDup no longer applied)
 *  - two identical-title Kanzen roles still collapse to ONE (exact-dup dedupe kept) */
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

const roles = [
  { id:'r_sa20', title:'System Architect & Change Control Lead', company:'Innoviz Technologies', years:'2020–2025', on:true, bullets:['Owned change governance for the LiDAR line.'] },
  { id:'r_ccr',  title:'Customer Change Requests Specialist',   company:'Innoviz Technologies', years:'2020–2025', on:true, bullets:['Single point of contact for OEM change requests.'] },
  { id:'r_sa17', title:'System Architect',                       company:'Innoviz Technologies', years:'2017–2020', on:true, bullets:['Defined the system architecture for automotive LiDAR.'] },
  // exact-title duplicate Kanzen pair → must collapse to ONE
  { id:'r_kz1',  title:'Product / Project Expert', company:'Kanzen Konsulenter ApS', years:'2022–2026', on:true, bullets:['Bridged hardware and commercial evaluation.'] },
  { id:'r_kz2',  title:'Product / Project Expert', company:'Kanzen Konsulenter ApS', years:'2022–2026', on:true, bullets:['Bridged hardware and commercial evaluation.'] },
];
const sections = { cv: [
  { id:'experience', title:'PROFESSIONAL EXPERIENCE', loc:'main', on:true, type:'experience', roles },
], cl: [] };

const browser = await chromium.launch();
const page = await browser.newPage();
await page.addInitScript((secs)=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session', JSON.stringify({ email:'d@e.com', ts:1717000000000 }));
  localStorage.setItem('step', JSON.stringify('editor'));
  localStorage.setItem('doc', JSON.stringify('cv'));
  localStorage.setItem('sections', JSON.stringify(secs));
}, sections);
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(4500); // 415 poll + normalize

const r = await page.evaluate(()=>{
  const b = JSON.parse(localStorage.getItem('sections')||'{}');
  const exp = (b.cv||[]).find(s=>s&&s.type==='experience');
  const titles = (exp&&exp.roles||[]).map(x=>x.title);
  const has = (re)=>titles.some(t=>re.test(t));
  return {
    titles,
    sysArchSeparate: has(/^System Architect$/) && has(/Change Control Lead/),
    custChangeKept: has(/Customer Change Requests Specialist/),
    kanzenCount: titles.filter(t=>/Product \/ Project Expert/.test(t)).length,
  };
});
await browser.close(); await new Promise(r=>server.close(r));
console.log('--- ROLE-DECOMP-001 ---');
console.log('titles:', JSON.stringify(r.titles));
console.log('app errors:', errs.length, errs.slice(0,3).join(' | '));
const checks = [
  ['"System Architect" NOT merged into the combined-title role (decomposed)', r.sysArchSeparate],
  ['"Customer Change Requests Specialist" kept (not dropped)', r.custChangeKept],
  ['exact-title Kanzen duplicate still collapses to ONE', r.kanzenCount === 1],
  ['no app errors', errs.length === 0],
];
for (const [n,ok] of checks) console.log(`${n}: ${ok?'OK':'FAIL'}`);
const ok = checks.every(c=>c[1]);
console.log(ok ? 'ROLE-DECOMP OK' : 'ROLE-DECOMP FAILED');
process.exit(ok ? 0 : 1);
