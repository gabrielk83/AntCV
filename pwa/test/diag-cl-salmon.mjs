/* DIAGNOSTIC — CL salmon. Injects an overflowing cover letter and checks the
 * preview shows a salmon page-break (the measurer now measures the CL flow). */
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
const para = (n) => `This is paragraph ${n}. `.repeat(90);
const sections={cv:[],cl:[
  {id:'greeting',title:'Greeting',loc:'main',on:true,type:'text',content:'Dear Hiring Manager,'},
  {id:'opening',title:'Opening',loc:'main',on:true,type:'text',content:para(1)},
  {id:'who',title:'WHO I AM',loc:'main',on:true,type:'text',content:para(2)},
  {id:'why',title:'WHY THIS POSITION',loc:'main',on:true,type:'text',content:para(3)},
  {id:'contribute',title:'HOW I WOULD CONTRIBUTE',loc:'main',on:true,type:'text',content:para(4)},
  {id:'closing',title:'Closing',loc:'main',on:true,type:'text',content:para(5)},
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
const r=await page.evaluate(()=>{
  const clFlow = document.querySelector('[data-antcv-cl-flow="true"]');
  const bodyText = clFlow ? clFlow.innerText : '';
  const salmon = bodyText.includes('▼ PAGE');
  let autoPages={};try{autoPages=JSON.parse(localStorage.getItem('antcv:autoPages')||'{}');}catch(_){}
  return { hasClFlow: !!clFlow, salmonShown: salmon, autoPages };
});
await browser.close();await new Promise(r=>server.close(r));
console.log('CL flow container present:', r.hasClFlow);
console.log('autoPages:', JSON.stringify(r.autoPages));
console.log('salmon (▼ PAGE) shown in CL:', r.salmonShown);
console.log('app errors:', errs.length, errs.slice(0,2).join(' | '));
const ok = r.hasClFlow && Object.keys(r.autoPages).length>0 && r.salmonShown && errs.length===0;
console.log(ok ? 'CL-SALMON OK' : 'CL-SALMON INCOMPLETE');
