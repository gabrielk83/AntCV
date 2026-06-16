/* DIAGNOSTIC — EXP-ORDER-ON-ADD-001 (owner 2026-06-16).
 * antcv-experience-order.js: a role ADDED (or its year completed) re-sorts the
 * Experience roles reverse-chron with the volunteer role LAST; a pure manual
 * reorder (same ids + years) is respected (no re-sort). */
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

// deliberately OUT of order, with the volunteer role in the middle.
const roles = [
  { id:'idf', title:'Computer Systems Administrator', company:'IDF', years:'2001–2003', on:true },
  { id:'cw', title:'Team Operations Manager', company:'Copenhagen Wolves RFC, Pan Idræt', years:'2023 - present', on:true },
  { id:'kanzen', title:'Product / Project Expert', company:'Kanzen', years:'2022 - 2026', on:true },
  { id:'sirin', title:'Senior Optics Engineer', company:'Sirin', years:'2014–2017', on:true },
];
const sections = { cv: [
  { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', content:'P.' },
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
await page.waitForTimeout(3500);

const titles = async ()=> page.evaluate(()=>{
  const b=JSON.parse(localStorage.getItem('sections')||'{}'); const e=(b.cv||[]).find(s=>s&&s.type==='experience');
  return (e&&e.roles||[]).map(r=>r.id);
});
const firstRun = await titles(); // first run must NOT reorder

// 1) ADD a role (new id) → must trigger a reverse-chron sort, volunteer last.
await page.evaluate(()=>{
  const b=JSON.parse(localStorage.getItem('sections')||'{}'); const e=(b.cv||[]).find(s=>s&&s.type==='experience');
  e.roles.push({ id:'mepro', title:'Electro-Optics Team Leader', company:'Meprolight', years:'2013–2014', on:true });
  localStorage.setItem('sections', JSON.stringify(b));
  window.dispatchEvent(new CustomEvent('antcv:sections-updated',{detail:{source:'test'}}));
});
await page.waitForTimeout(2000);
const afterAdd = await titles();

// 2) pure manual REORDER (same ids+years) → must be respected (no re-sort).
await page.evaluate(()=>{
  const b=JSON.parse(localStorage.getItem('sections')||'{}'); const e=(b.cv||[]).find(s=>s&&s.type==='experience');
  e.roles.reverse();
  localStorage.setItem('sections', JSON.stringify(b));
  window.dispatchEvent(new CustomEvent('antcv:sections-updated',{detail:{source:'test'}}));
});
await page.waitForTimeout(2000);
const afterReorder = await titles();
const reorderExpected = [...afterAdd].reverse();

await browser.close(); await new Promise(r=>server.close(r));
console.log('--- EXP-ORDER-ON-ADD-001 ---');
console.log('first run (no sort):', JSON.stringify(firstRun));
console.log('after add (sorted) :', JSON.stringify(afterAdd));
console.log('after manual reorder:', JSON.stringify(afterReorder));
console.log('app errors:', errs.length, errs.slice(0,3).join(' | '));
const order = ['kanzen','sirin','mepro','idf','cw']; // reverse-chron, volunteer LAST
const checks = [
  ['first run leaves order untouched', JSON.stringify(firstRun)===JSON.stringify(['idf','cw','kanzen','sirin'])],
  ['adding a role re-sorts reverse-chron with volunteer (cw) LAST', JSON.stringify(afterAdd)===JSON.stringify(order)],
  ['a pure manual reorder is RESPECTED (not re-sorted)', JSON.stringify(afterReorder)===JSON.stringify(reorderExpected)],
  ['no app errors', errs.length === 0],
];
for (const [n,ok] of checks) console.log(`${n}: ${ok?'OK':'FAIL'}`);
const ok = checks.every(c=>c[1]);
console.log(ok ? 'EXP-ORDER OK' : 'EXP-ORDER FAILED');
process.exit(ok ? 0 : 1);
