/* DIAGNOSTIC — sections-normalize-415 (restore-proof):
 *   1. boot with RECOMMENDATIONS before experience + a "Founder & CEO" role
 *      -> normalized (rec after experience, founder stripped);
 *   2. simulate the kernel cloud-restore writing the STALE order back AFTER
 *      load (write localStorage + dispatch antcv:sections-updated) -> the
 *      normalizer re-applies (this is the bug the React effect couldn't win).
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
const STALE = {cv:[
  {id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'P.'},
  {id:'core_comp',title:'CORE COMPETENCIES',loc:'main',on:true,type:'table',rows:[['Focus','Expertise'],['A','B']]},
  {id:'recommendations',title:'RECOMMENDATIONS',loc:'main',on:true,type:'text',content:'On request.'},
  {id:'experience',title:'PROFESSIONAL EXPERIENCE',loc:'main',on:true,type:'experience',roles:[
    {id:'r1',title:'Founder & CEO',company:'Kanzen',years:'2018 - 2026',on:true,bullets:['Ran it.']},
  ]},
],cl:[]};
await page.addInitScript((STALE)=>{
  if (localStorage.getItem('__antcvDiagSeeded')) return;
  localStorage.setItem('__antcvDiagSeeded','1');
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify(STALE));
  localStorage.setItem('personalInfo',JSON.stringify({name:'Gabriel'}));
  localStorage.setItem('wizardCompleted', JSON.stringify(true));
}, STALE);
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(6500);

const checks=[];
const check=(n,ok,d)=>{checks.push(ok);console.log(`${n}: ${ok?'OK':'FAIL'}${ok?'':' '+(d||'')}`)};

const read = ()=>page.evaluate(()=>{
  const cv=(JSON.parse(localStorage.getItem('sections')||'{}').cv||[]);
  const exp=cv.find(s=>s.type==='experience');
  return { order:cv.map(s=>s.id), title:(exp&&exp.roles[0]&&exp.roles[0].title)||'' };
});
let s = await read();
check('1. boot: rec after experience + founder stripped',
  s.order.indexOf('recommendations')>s.order.indexOf('experience') && !/founder/i.test(s.title), JSON.stringify(s));

// 2 — simulate the cloud-restore reapplying the stale slot AFTER load
await page.evaluate((STALE)=>{
  localStorage.setItem('sections', JSON.stringify(STALE));
  window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail:{ source:'KERNEL-CLOUD-PERSIST' } }));
}, STALE);
await page.waitForTimeout(800);
s = await read();
check('2. post-restore: normalizer re-applies (rec after exp, founder stripped)',
  s.order.indexOf('recommendations')>s.order.indexOf('experience') && !/founder/i.test(s.title), JSON.stringify(s));

await browser.close(); server.close();
const ok=checks.every(Boolean);
console.log(ok?'SECTIONS-NORMALIZE OK':'SECTIONS-NORMALIZE FAIL');
process.exit(ok?0:1);
