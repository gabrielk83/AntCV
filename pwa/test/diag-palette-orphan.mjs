/* DIAGNOSTIC — PACKAGE-PALETTE-MIX-001 root verification (owner repro from
 * 2026-06-06): seed the returning-user orphan stylePackage "scandinavian",
 * reload, and assert the APPJS-ID-SCHEME-UNIFY migration (1.50.387):
 *   1. localStorage.stylePackage is REWRITTEN to "copenhagen-modern";
 *   2. body[data-package] agrees (no persisted-id mismatch);
 *   3. the rendered palette is the Copenhagen default (no black mix):
 *      sidebar background is the navy family, not rgb(0,0,0);
 *   4. a second reload stays stable (no re-orphaning).
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
  localStorage.setItem('sections',JSON.stringify({cv:[{id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'P.'},{id:'tools',title:'TOOLS',loc:'sidebar',on:true,type:'labeled_list',items:[{l:'Eng',v:'Python'}]}],cl:[]}));
  localStorage.setItem('personalInfo',JSON.stringify({name:'Anita'}));
  localStorage.setItem('wizardCompleted', JSON.stringify(true));
  // the owner's returning-user orphan
  localStorage.setItem('stylePackage', JSON.stringify('scandinavian'));
});
const errs=[];
page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(7000);

const state = () => page.evaluate(()=>{
  const sb=document.querySelector('.antcv-document-sidebar,[data-antcv-document-sidebar]');
  return {
    stored: localStorage.getItem('stylePackage'),
    bodyPkg: document.body.getAttribute('data-package'),
    sidebarBg: sb? getComputedStyle(sb).backgroundColor : '(no sidebar)',
  };
});
const checks=[];
const check=(n,ok,d)=>{checks.push(ok);console.log(`${n}: ${ok?'OK':'FAIL'}${ok?'':' '+(d||'')}`)};

let s = await state();
check('1. orphan id migrated in storage', /copenhagen-modern/.test(String(s.stored)), JSON.stringify(s));
check('2. body[data-package] agrees', s.bodyPkg==='copenhagen-modern', JSON.stringify(s.bodyPkg));
check('3. sidebar palette is navy-family, not black', s.sidebarBg!=='rgb(0, 0, 0)' && s.sidebarBg!=='(no sidebar)', JSON.stringify(s.sidebarBg));

await page.reload({waitUntil:'load'});
await page.waitForTimeout(6000);
s = await state();
check('4. second reload stable (no re-orphaning)', /copenhagen-modern/.test(String(s.stored)) && s.bodyPkg==='copenhagen-modern', JSON.stringify(s));
check('no page errors', errs.length===0, errs.join('|').slice(0,200));

await browser.close(); server.close();
const ok=checks.every(Boolean);
console.log(ok?'PALETTE-ORPHAN OK':'PALETTE-ORPHAN FAIL');
process.exit(ok?0:1);
