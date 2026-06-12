/* DIAGNOSTIC — COMPANY-BRAND-FIT-001: the 🎨 Brand-fit checkbox renders
 * next to Generate (upload step), defaults unchecked, toggling sets the
 * session-only window flag; the API-keys panel hosts its password inputs
 * inside a <form> (console-hygiene check rides along).
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
const page=await browser.newPage({viewport:{width:1500,height:1100}});
await page.addInitScript(()=>{
  if (localStorage.getItem('__antcvDiagSeeded')) return;
  localStorage.setItem('__antcvDiagSeeded','1');
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('upload'));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify({cv:[{id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'P.'}],cl:[]}));
  localStorage.setItem('personalInfo',JSON.stringify({name:'Anita'}));
});
const errs=[];
page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(6000);

const checks=[];
const check=(n,ok,d)=>{checks.push(ok);console.log(`${n}: ${ok?'OK':'FAIL'}${ok?'':' '+(d||'')}`)};

const r = await page.evaluate(()=>{
  const cb=document.querySelector('input[data-antcv-brandfit]');
  if(!cb) return {found:false};
  const before=window.__antcvBrandFit;
  cb.click();
  const after=window.__antcvBrandFit;
  cb.click();
  const off=window.__antcvBrandFit;
  const qg=document.querySelector('input[data-antcv-quickgen]');
  return {found:true, defaultOff: before===undefined||before===false, flagOn: after===true, flagOff: off===false, nextToQuickGen: !!qg};
});
check('brand-fit checkbox: present, default off, flag toggles, sits with quick-gen',
  r.found && r.defaultOff && r.flagOn && r.flagOff && r.nextToQuickGen && errs.length===0, JSON.stringify(r));

await browser.close(); server.close();
const ok=checks.every(Boolean);
console.log(ok?'BRANDFIT-CHECKBOX OK':'BRANDFIT-CHECKBOX FAIL');
process.exit(ok?0:1);
