/* DIAGNOSTIC — ROLE-DUP-001 (owner 2026-06-13): "System Architect & CRM"
 * and "System Architect" both visible = not a legal combination.
 *   1. same company + overlapping years + contained title -> merged to the
 *      fuller title, one role survives, visibility unioned;
 *   2. same title at DIFFERENT companies -> untouched;
 *   3. contained title at the same company but NON-overlapping years
 *      (a real promotion/return) -> untouched.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json' };
const server = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}});
await new Promise(r=>server.listen(0,r));
const port = server.address().port;
const browser=await chromium.launch();

async function boot(roles) {
  const page=await browser.newPage({viewport:{width:1400,height:1000}});
  await page.addInitScript(({roles})=>{
    if (localStorage.getItem('__antcvDiagSeeded')) return;
    localStorage.setItem('__antcvDiagSeeded','1');
    localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
    localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
    localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
    localStorage.setItem('sections',JSON.stringify({cv:[
      {id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'P.'},
      {id:'experience',title:'PROFESSIONAL EXPERIENCE',loc:'main',on:true,type:'experience',roles},
    ], cl:[]}));
    localStorage.setItem('personalInfo',JSON.stringify({name:'Anita'}));
    localStorage.setItem('wizardCompleted', JSON.stringify(true));
  },{roles});
  await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
  await page.waitForTimeout(6500);
  const out = await page.evaluate(()=>{
    const cv=(JSON.parse(localStorage.getItem('sections')||'{}').cv||[]);
    const x=cv.find(s=>s.type==='experience');
    return (x&&x.roles||[]).map(r=>({t:r.title,c:r.company,y:r.years,on:r.on!==false,b:(r.bullets||[]).length}));
  });
  await page.close();
  return out;
}

const checks=[];
const check=(n,ok,d)=>{checks.push(ok);console.log(`${n}: ${ok?'OK':'FAIL'}${ok?'':' '+(d||'')}`)};

// 1 — the owner's exact case
const r1 = await boot([
  {id:'r1',title:'System Architect & CRM',company:'Innoviz',years:'2020 - 2025',on:true,bullets:['Owned change control.']},
  {id:'r2',title:'System Architect',company:'Innoviz',years:'2020 - 2025',on:true,bullets:['Did architecture.']},
  {id:'r3',title:'QA Engineer',company:'OtherCo',years:'2015 - 2020',on:true,bullets:['Tested.']},
]);
check('1. contained title same company+years -> ONE role, fuller title kept',
  r1.length===2 && r1.some(r=>r.t==='System Architect & CRM') && !r1.some(r=>r.t==='System Architect') && r1.some(r=>r.t==='QA Engineer'),
  JSON.stringify(r1));

// 2 — same title, different companies: untouched
const r2 = await boot([
  {id:'r1',title:'System Architect',company:'Innoviz',years:'2020 - 2025',on:true,bullets:['A.']},
  {id:'r2',title:'System Architect',company:'Terma',years:'2015 - 2020',on:true,bullets:['B.']},
]);
check('2. same title at different companies untouched', r2.length===2, JSON.stringify(r2));

// 3 — contained title, same company, NON-overlapping years (promotion): untouched
const r3 = await boot([
  {id:'r1',title:'System Architect & CRM',company:'Innoviz',years:'2022 - 2025',on:true,bullets:['A.']},
  {id:'r2',title:'System Architect',company:'Innoviz',years:'2018 - 2021',on:true,bullets:['B.']},
]);
check('3. non-overlapping years (promotion) untouched', r3.length===2, JSON.stringify(r3));

await browser.close(); server.close();
const ok=checks.every(Boolean);
console.log(ok?'ROLE-DUP OK':'ROLE-DUP FAIL');
process.exit(ok?0:1);
