/* DIAGNOSTIC — HOWCONTRIBUTE-001. Injects a CL whose HOW I WOULD CONTRIBUTE
 * section has real bullets, boots the full app, then asserts the preview
 * renders the bullet list and the section data still holds the items. */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.webmanifest':'application/manifest+json','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf'};
const server=http.createServer(async(req,res)=>{try{let rel=decodeURIComponent((req.url||'/').split('?')[0]);if(rel==='/')rel='/index.html';const fp=path.join(ROOT,rel);const s=await stat(fp).catch(()=>null);if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;}res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'});res.end(await readFile(fp));}catch(e){res.writeHead(500);res.end(String(e));}});
await new Promise(r=>server.listen(0,r));
const port=server.address().port;
const BULLETS=[
  'Ship the Q3 compliance dashboard within the first 60 days',
  'Cut the regression suite runtime by pairing with the platform team',
  'Document the on-call runbook so the rota scales past five engineers',
];
const sections={cv:[],cl:[
  {id:'greeting',title:'Greeting',loc:'main',on:true,type:'text',content:'Dear Hiring Manager,'},
  {id:'who',title:'WHO I AM',loc:'main',on:true,type:'text',content:'I am a synthetic test candidate with ten years of experience.'},
  {id:'why',title:'WHY THIS POSITION',loc:'main',on:true,type:'text',content:'The role matches my regulatory background.'},
  {id:'contribute',title:'HOW I WOULD CONTRIBUTE',loc:'main',on:true,type:'text_bullets',
   intro:'In the first quarter I would focus on three things.',
   items:BULLETS.slice(),
   closing:'The team gains a faster release cycle and a calmer on-call.'},
  {id:'closing',title:'Closing',loc:'main',on:true,type:'text',content:'Kind regards, Test Candidate'},
]};
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1400,height:1000}});
await page.addInitScript((secs)=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cl'));
  localStorage.setItem('sections',JSON.stringify(secs));localStorage.setItem('personalInfo',JSON.stringify({name:'A'}));
  localStorage.setItem('antcv:autoPages','{}');localStorage.setItem('antcv:itemPages','{}');
},sections);
const errs=[];
page.on('pageerror',e=>errs.push('pageerror: '+(e&&e.message)));
page.on('console',m=>{if(m.type()==='error'){const t=m.text();if(!/CORS|workers\.dev|Failed to load|net::ERR/i.test(t))errs.push(t);}});
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(6000);
const r=await page.evaluate((bullets)=>{
  const flow=document.querySelector('[data-antcv-cl-flow="true"]')||document.body;
  const text=flow.innerText||'';
  const shown=bullets.map(b=>text.includes(b));
  let stored=null;
  try{
    const all=JSON.parse(localStorage.getItem('sections')||'{}');
    const s=(all.cl||[]).find(x=>x&&x.id==='contribute');
    stored=s?{items:s.items,bullets:s.bullets,intro:s.intro,closing:s.closing,type:s.type}:null;
  }catch(_){ }
  return { shown, introShown:text.includes('first quarter I would focus'), closingShown:text.includes('faster release cycle'), stored };
},BULLETS);
await browser.close();await new Promise(r2=>server.close(r2));
console.log('bullets shown in preview:', JSON.stringify(r.shown));
console.log('intro shown:', r.introShown, '| closing shown:', r.closingShown);
console.log('stored contribute after boot:', JSON.stringify(r.stored));
console.log('app errors:', errs.length, errs.slice(0,3).join(' | '));
const ok = r.shown.every(Boolean) && r.introShown && r.closingShown && errs.length===0;
console.log(ok ? 'HOWCONTRIBUTE-PREVIEW OK' : 'HOWCONTRIBUTE-PREVIEW FAILED');
process.exit(ok?0:1);
