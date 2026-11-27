/* DIAGNOSTIC — TENSE-RELOCATE-001: the EXPERIENCE TENSE control injects beside
 * the languages card in Personal (order 28), reads styleConfig.expTense, and
 * writing it persists to styleConfig (via the live hook _antcvSetExpTense,
 * WITHOUT flipping the package to "custom").
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
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify({cv:[{id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'P.'}],cl:[]}));
  localStorage.setItem('personalInfo',JSON.stringify({name:'Anita'}));
  localStorage.setItem('wizardCompleted', JSON.stringify(true));
  // seed a known package so we can assert it is NOT flipped to "custom"
  localStorage.setItem('stylePackage', JSON.stringify('copenhagen-modern'));
});
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(5500);

const checks=[];
const check=(n,ok,d)=>{checks.push(ok);console.log(`${n}: ${ok?'OK':'FAIL'}${ok?'':' '+(d||'')}`)};

// the live hook must exist (set during the editor render)
const hook = await page.evaluate(()=>typeof window._antcvSetExpTense);
check('0. live hook _antcvSetExpTense exists', hook==='function', hook);

// TENSE-POPIN-002 (1.50.626, owner): the tense control lives INSIDE the
// LanguageCard island and renders only when Languages is expanded. While the
// islands bundle is loaded, the standalone sidecar card is NEVER built, not even
// beside a languages anchor. (The 1.50.4xx standalone placement this diag first
// asserted was retired on purpose; DIAG-FLEET-ROT-001, 2026-11-27.)
const placed = await page.evaluate(async ()=>{
  const col = document.createElement('div');
  col.style.display='flex'; col.style.flexDirection='column';
  const lang = document.createElement('div'); lang.id='antcv-react-personal-languages'; lang.style.order='27';
  col.appendChild(lang); document.body.appendChild(col);
  await new Promise(r=>setTimeout(r,3200)); // past the 2800 ms grace timer
  return { islandsScript: !!document.querySelector('script[src*="antcv-react-islands"]'), standalone: !!document.getElementById('antcv-tense-control-422') };
});
check('1. no standalone tense card while the islands bundle is loaded', placed.islandsScript && !placed.standalone, JSON.stringify(placed));

// the live hook persists styleConfig.expTense WITHOUT flipping the package to custom
const after = await page.evaluate(async ()=>{
  window._antcvSetExpTense('past');
  await new Promise(r=>setTimeout(r,300));
  let sc={}; try{ sc=JSON.parse(localStorage.getItem('styleConfig')||'{}'); }catch(_){}
  let pkg=null; try{ pkg=JSON.parse(localStorage.getItem('stylePackage')||'null'); }catch(_){}
  return { expTense: sc.expTense, pkg };
});
check('2. _antcvSetExpTense(past) persists styleConfig.expTense=past, package unchanged', after.expTense==='past' && after.pkg==='copenhagen-modern', JSON.stringify(after));
check('no page errors', errs.length===0, errs.join('|').slice(0,200));

await browser.close(); server.close();
const ok=checks.every(Boolean);
console.log(ok?'TENSE-CONTROL OK':'TENSE-CONTROL FAIL');
process.exit(ok?0:1);
