import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json' };
let captured = [];
const server = http.createServer(async (req,res)=>{
  if (req.method==='POST' && req.url.startsWith('/api/llm')) {
    let body=''; req.on('data',c=>body+=c); req.on('end',()=>{ captured.push(body); res.writeHead(200,{'content-type':'application/json','access-control-allow-origin':'*'}); res.end('{"ok":true}'); });
    return;
  }
  try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}
});
await new Promise(r=>server.listen(0,r));
const port = server.address().port;
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1500,height:1100}});
await page.addInitScript(()=>{
  if (localStorage.getItem('__antcvDiagSeeded')) return;
  localStorage.setItem('__antcvDiagSeeded','1');
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify({cv:[{id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'P.'}],cl:[]}));
  localStorage.setItem('personalInfo',JSON.stringify({name:'Anita'}));
});
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(7000);
const wrapState = await page.evaluate(()=>({
  wrapped: !!(window.fetch && window.fetch.__antcvWritingStyleFetchWrap),
  islandsBooted: window.__antcvReactIslandsBooted || null,
}));
console.log('wrap state:', JSON.stringify(wrapState));
await page.evaluate(async (port)=>{
  await window.fetch(`http://127.0.0.1:${port}/api/llm`, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ system:'sys', messages:[{role:'user',content:'hi'}], max_tokens: 10 }) });
}, port);
await page.waitForTimeout(800);
console.log('captured bodies:', captured.length);
for (const b of captured) {
  let j; try { j=JSON.parse(b); } catch { j=null; }
  console.log('has envelope:', !!(j && j._antcv_writing_style), '| keys:', j?Object.keys(j).join(','):'unparsed');
  if (j && j._antcv_writing_style) console.log('envelope writingStyle:', j._antcv_writing_style.writingStyle, '| ats:', j._antcv_writing_style.ats);
}
await browser.close(); server.close();
