/* DIAGNOSTIC — GEN-SCE-FLAG-001 client half: a fetch response carrying
 * X-AntCV-Flagged: 1 raises the amber toast (with the banned-word counts);
 * a clean response raises nothing; the toast is debounced.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json' };
const server = http.createServer(async (req,res)=>{
  if (req.url.startsWith('/flagged')) { res.writeHead(200,{'content-type':'application/json','access-control-allow-origin':'*','access-control-expose-headers':'X-AntCV-Flagged, X-AntCV-Sce-Banned-Words, X-AntCV-Sce-Banned-Phrases','X-AntCV-Flagged':'1','X-AntCV-Sce-Banned-Words':'2','X-AntCV-Sce-Banned-Phrases':'1'}); res.end('{}'); return; }
  if (req.url.startsWith('/clean')) { res.writeHead(200,{'content-type':'application/json','access-control-allow-origin':'*'}); res.end('{}'); return; }
  try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}
});
await new Promise(r=>server.listen(0,r));
const port = server.address().port;
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1200,height:900}});
await page.addInitScript(()=>{
  if (localStorage.getItem('__antcvDiagSeeded')) return;
  localStorage.setItem('__antcvDiagSeeded','1');
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify({cv:[{id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'P.'}],cl:[]}));
  localStorage.setItem('personalInfo',JSON.stringify({name:'Anita'}));
});
const errs=[];
page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(7000);

const checks=[];
const check=(n,ok,d)=>{checks.push(ok);console.log(`${n}: ${ok?'OK':'FAIL'}${ok?'':' '+(d||'')}`)};

check('sidecar installed', await page.evaluate(()=>window.__antcvSceFlagToast==='1.50.399'));
await page.evaluate(async (port)=>{ await window.fetch(`http://127.0.0.1:${port}/clean`); }, port);
await page.waitForTimeout(500);
check('clean response: no toast', await page.evaluate(()=>!document.querySelector('[data-antcv-sce-flag-toast]')));
await page.evaluate(async (port)=>{ await window.fetch(`http://127.0.0.1:${port}/flagged`); }, port);
await page.waitForTimeout(700);
const toast = await page.evaluate(()=>{const t=document.querySelector('[data-antcv-sce-flag-toast]');return t?(t.textContent||''):null;});
check('flagged response: toast with counts', !!toast && /flagged wording/.test(toast) && /2 banned word/.test(toast), JSON.stringify(toast));
await page.evaluate(async (port)=>{ await window.fetch(`http://127.0.0.1:${port}/flagged`); }, port);
await page.waitForTimeout(500);
check('debounced: still one toast', (await page.evaluate(()=>document.querySelectorAll('[data-antcv-sce-flag-toast]').length))===1);
check('no page errors', errs.length===0, errs.join('|').slice(0,200));

await browser.close(); server.close();
const ok=checks.every(Boolean);
console.log(ok?'SCE-FLAG-TOAST OK':'SCE-FLAG-TOAST FAIL');
process.exit(ok?0:1);
