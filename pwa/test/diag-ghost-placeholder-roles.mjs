/* DIAGNOSTIC — CV-GHOST-PLACEHOLDER-ROLES-PREVIEW-001 (owner QA 2026-06-24).
 * The CV preview must DROP the generator's UNUSED-SLOT placeholder roles
 * (every bullet === "<unused slot>") so it matches the export (which emits no
 * header for them) — WITHOUT hiding real roles or the fresh-doc me() skeleton
 * (whose bullets are bracketed "[Bullet ...]" placeholders, never "<unused slot>").
 *
 * Injects 4 roles into PROFESSIONAL EXPERIENCE:
 *   r0  real role (on:true, real bullets)                -> renders
 *   r1  real role (on:true, real bullets)                -> renders
 *   rSk fresh-skeleton style (on:true, bracketed bullets)-> renders (must NOT over-hide)
 *   rGh unused slot (on:true, bullets:["<unused slot>"]) -> DROPPED by the fix
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
    {id:'r0',title:'System Architect',company:'Innoviz',years:'2017–2020',on:true,bullets:['Defined the system architecture for automotive LiDAR.']},
    {id:'r1',title:'Founder',company:'Kanzen',years:'2022–2025',on:true,bullets:['Founded a consultancy bridging hardware development.']},
    {id:'rSk',title:'[Role title]',company:'[Company name]',years:'[YYYY – YYYY]',on:true,bullets:['[Bullet KEEPMEVISIBLE skeleton row]']},
    {id:'rGh',title:'',company:'',years:'',on:true,bullets:['<unused slot>']},
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
},sections);
const errs=[];
page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(7000);

const r=await page.evaluate(()=>{
  const paper=document.querySelector('.antcv-preview-paper');
  if(!paper) return { noPaper:true };
  const text=paper.innerText||'';
  const wrappers=Array.from(paper.querySelectorAll('[data-antcv-role-index]'))
    .filter(e=>(e.innerText||'').trim().length>0);
  return {
    hasUnusedSlot:/<unused slot>/i.test(text),
    hasRealRole:/System Architect/.test(text) && /Founder/.test(text),
    hasSkeletonRole:/KEEPMEVISIBLE/.test(text),
    visibleRoleWrappers:wrappers.length,
  };
});
await browser.close();await new Promise(r2=>server.close(r2));

if(r.noPaper){ console.log('FAIL: no .antcv-preview-paper rendered (sign-in gate not passed)'); process.exit(1); }
const checks=[
  ['ghost "<unused slot>" role DROPPED (not in preview)', r.hasUnusedSlot===false],
  ['real roles still render', r.hasRealRole===true],
  ['fresh-skeleton bracketed role still renders (no over-hide)', r.hasSkeletonRole===true],
  ['exactly 3 visible role wrappers (2 real + 1 skeleton, ghost gone)', r.visibleRoleWrappers===3],
];
for(const [n,ok] of checks)console.log(`${n}: ${ok?'OK':'FAIL'}`);
console.log('detail:',JSON.stringify(r));
console.log('app errors:',errs.length,errs.slice(0,2).join('|'));
const ok=checks.every(c=>c[1])&&errs.length===0;
console.log(ok?'GHOST-PLACEHOLDER OK':'GHOST-PLACEHOLDER FAILED');
process.exit(ok?0:1);
