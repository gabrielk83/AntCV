/* DIAGNOSTIC — ROLE-FOUNDER-001 (owner 2026-06-13): strip "Founder" from
 * role titles; keep "Independent"; never mangle a non-Founder "&" title.
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
const page=await browser.newPage({viewport:{width:1400,height:1000}});
await page.addInitScript(()=>{
  if (localStorage.getItem('__antcvDiagSeeded')) return;
  localStorage.setItem('__antcvDiagSeeded','1');
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify({cv:[
    {id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'P.'},
    {id:'experience',title:'PROFESSIONAL EXPERIENCE',loc:'main',on:true,type:'experience',roles:[
      {id:'r1',title:'Founder & CEO',company:'Kanzen',years:'2018 - 2026',on:true,bullets:['Ran it.']},
      {id:'r2',title:'Independent Consultant',company:'Kanzen konsulenter',years:'2018 - 2026',on:true,bullets:['Advised.']},
      {id:'r3',title:'System Architect & CRM',company:'Innoviz',years:'2020 - 2025',on:true,bullets:['Built.']},
    ]},
  ], cl:[]}));
  localStorage.setItem('personalInfo',JSON.stringify({name:'Gabriel'}));
  localStorage.setItem('wizardCompleted', JSON.stringify(true));
});
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(6500);
const titles = await page.evaluate(()=>{
  const cv=(JSON.parse(localStorage.getItem('sections')||'{}').cv||[]);
  const x=cv.find(s=>s.type==='experience');
  return (x&&x.roles||[]).map(r=>r.title);
});
const checks=[];
const check=(n,ok,d)=>{checks.push(ok);console.log(`${n}: ${ok?'OK':'FAIL'}${ok?'':' '+(d||'')}`)};
check('1. "Founder & CEO" -> "CEO" (founder stripped, separator tidied)', titles.includes('CEO') && !titles.some(t=>/founder/i.test(t)), JSON.stringify(titles));
check('2. "Independent Consultant" kept (consultancy)', titles.includes('Independent Consultant'), JSON.stringify(titles));
check('3. "System Architect & CRM" untouched (no founder, & preserved)', titles.includes('System Architect & CRM'), JSON.stringify(titles));
await browser.close(); server.close();
const ok=checks.every(Boolean);
console.log(ok?'ROLE-FOUNDER OK':'ROLE-FOUNDER FAIL');
process.exit(ok?0:1);
