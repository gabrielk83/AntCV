/* DIAGNOSTIC — CJLR-EXPERIENCE-001 (1.50.381). Per-role alignment for
 * EXPERIENCE bullets:
 *   1. preview bullet rows carry data-antcv-row-path="roles.N.bullets.M"
 *      + data-antcv-role-path="roles.N";
 *   2. a stored antcvItemAlignment[sid]["roles.0"]="center" applies
 *      text-align:center to role 0's bullet rows (role 1 untouched);
 *   3. a per-bullet key beats the role key (roles.1.bullets.0 = right);
 *   4. export half: the docx-client merges the stored map into the
 *      payload as item_alignment (already wired — sanity-locked here).
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

const sections={cv:[
  {id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'Profile.'},
  {id:'experience',title:'PROFESSIONAL EXPERIENCE',loc:'main',on:true,type:'experience',roles:[
    {id:'r0',title:'Founder',company:'Kanzen',period:'2022–2025',bullets:['Founded a consultancy bridging hardware development.','Led RFQ evaluation programmes with structured scoring.']},
    {id:'r1',title:'System Architect',company:'Innoviz',period:'2017–2020',bullets:['Defined the system architecture for automotive LiDAR.','Specified component-level requirements and validation.']},
  ]},
  {id:'tools',title:'TOOLS',loc:'sidebar',on:true,type:'labeled_list',items:[{l:'Eng',v:'Python'}]},
],cl:[]};

const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1600,height:1100}});
await page.addInitScript((secs)=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify(secs));
  localStorage.setItem('personalInfo',JSON.stringify({name:'Anita Tester'}));
  localStorage.setItem('antcvItemAlignment',JSON.stringify({
    experience:{ 'roles.0':'center', 'roles.1.bullets.0':'right' },
  }));
},sections);
const errs=[];
page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(7000);

const r=await page.evaluate(()=>{
  const paper=document.querySelector('.antcv-preview-paper');
  const rows=Array.from(paper.querySelectorAll('[data-antcv-row-path^="roles."]')).map(e=>({
    p:e.getAttribute('data-antcv-row-path'),
    role:e.getAttribute('data-antcv-role-path'),
    ta:getComputedStyle(e).textAlign,
  }));
  return { rows };
});
await browser.close();await new Promise(r2=>server.close(r2));

const r0=r.rows.filter(x=>x.role==='roles.0');
const r1b0=r.rows.find(x=>x.p==='roles.1.bullets.0');
const r1b1=r.rows.find(x=>x.p==='roles.1.bullets.1');
const checks=[
  ['bullet rows carry markers (4)', r.rows.length===4],
  ['role-0 bullets centered (role key)', r0.length===2 && r0.every(x=>x.ta==='center')],
  ['role-1 bullet-0 right (per-bullet beats role default)', !!r1b0 && r1b0.ta==='right'],
  ['role-1 bullet-1 keeps default justify', !!r1b1 && r1b1.ta==='justify'],
];
for(const [n,ok] of checks)console.log(`${n}: ${ok?'OK':'FAIL'}`);
if(!checks.every(c=>c[1]))console.log('rows:',JSON.stringify(r.rows));
console.log('app errors:',errs.length,errs.slice(0,2).join('|'));
const ok=checks.every(c=>c[1])&&errs.length===0;
console.log(ok?'CJLR-EXPERIENCE OK':'CJLR-EXPERIENCE FAILED');
process.exit(ok?0:1);
